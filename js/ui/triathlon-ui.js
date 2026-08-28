// DOM/interaction layer for the Triathlon calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
//
// Unlike Running/Cycling/Swimming, Triathlon has no overall Pace/Time/Distance
// solve-for toggle (Section 18): it always outputs total finish time, never a
// pace/speed/distance. Each of the three legs, however, has its own Time/Pace
// (swim, run) or Time/Speed (bike) toggle — Time is the original v1 default; when
// Pace/Speed is selected, that leg's duration is computed from its distance (the
// selected standard or custom leg distance) via calculateTime, imported directly
// from running.js/cycling.js/swimming.js rather than duplicated here (Section
// 15/17: no duplicated cross-cutting logic between modules) — triathlon.js itself
// is untouched and still only sums five already-resolved time values. Distance is
// otherwise only used for the small leg-distance badges shown next to each leg's
// heading — badge formatting reuses formatDistanceKm/Miles from running.js and
// formatDistanceMeters/Yards from swimming.js rather than reimplementing them.
//
// The global unit toggle here is Metric/Imperial rather than a single specific pair
// like KM/MI or M/YD, because Triathlon spans BOTH conventions at once per Section 4:
// swim uses metres/yards, bike and run use km/miles. Custom leg distances are each
// backed by a full-precision shadow (swimMeters/bikeMeters/runMeters, canonical
// metres) using the same toggle-safe pattern as the other calculators — typing
// re-derives the shadow, toggling only re-renders the displayed text — even though
// nothing downstream calculates with these values, so the custom fields themselves
// never silently reinterpret their digits under the new unit.
//
// Section 13: swim/bike/run leg durations are required (blank on all three of a
// leg's h/m/s fields in Time mode, or a blank/incomplete pace/speed field in
// Pace/Speed mode, means "incomplete", not invalid — placeholder shown, no error).
// Transition times (T1/T2) are optional: a fully blank transition defaults to zero
// rather than blocking the calculation, per the confirmed Triathlon validation rule.
// Genuinely invalid values (zero/negative leg time, zero/negative pace or speed,
// negative transition, malformed time/pace components) surface as inline errors
// under the relevant field.
// Section 18: results update live, debounced briefly after the last keystroke.

import { calculateTotalTime, formatTime, TRIATHLON_STANDARD_DISTANCES } from '../logic/triathlon.js';
import {
  calculateTime as calculateRunTime,
  calculatePace as calculateRunPace,
  formatPaceMinPerKm,
  formatPaceMinPerMile,
  formatDistanceKm,
  formatDistanceMiles
} from '../logic/running.js';
import {
  calculateTime as calculateBikeTime,
  calculateSpeed as calculateBikeSpeed,
  formatSpeedKmh,
  formatSpeedMph
} from '../logic/cycling.js';
import {
  calculateTime as calculateSwimTime,
  calculatePace as calculateSwimPace,
  formatPacePer100m,
  formatPacePer100yd,
  formatDistanceMeters,
  formatDistanceYards
} from '../logic/swimming.js';
import { kmToMeters, metersToKm, milesToMeters, metersToMiles, yardsToMeters, metersToYards, METERS_PER_YARD } from '../logic/unitConversion.js';

const PLACEHOLDER = '–:––:––';
const DEBOUNCE_MS = 300;

const form = document.querySelector('.calculator');
const unitRadios = document.querySelectorAll('input[name="unit-system"]');

const standardChips = document.querySelectorAll('.chip[data-swim-meters]');
const customChip = document.getElementById('chip-custom');
const customDistanceFields = document.getElementById('custom-distance-fields');

const swimDistanceInput = document.getElementById('swim-distance-input');
const swimDistanceUnit = document.getElementById('swim-distance-unit');
const swimDistanceError = document.getElementById('swim-distance-error');
const swimDistanceBadge = document.getElementById('swim-distance-badge');

const bikeDistanceInput = document.getElementById('bike-distance-input');
const bikeDistanceUnit = document.getElementById('bike-distance-unit');
const bikeDistanceError = document.getElementById('bike-distance-error');
const bikeDistanceBadge = document.getElementById('bike-distance-badge');

const runDistanceInput = document.getElementById('run-distance-input');
const runDistanceUnit = document.getElementById('run-distance-unit');
const runDistanceError = document.getElementById('run-distance-error');
const runDistanceBadge = document.getElementById('run-distance-badge');

const swimModeRadios = document.querySelectorAll('input[name="swim-mode"]');
const swimTimeFields = document.getElementById('swim-time-fields');
const swimHoursInput = document.getElementById('swim-hours');
const swimMinutesInput = document.getElementById('swim-minutes');
const swimSecondsInput = document.getElementById('swim-seconds');
const swimTimeError = document.getElementById('swim-time-error');
const swimPaceFields = document.getElementById('swim-pace-fields');
const swimPaceUnitHint = document.getElementById('swim-pace-unit-hint');
const swimPaceMinutesInput = document.getElementById('swim-pace-minutes');
const swimPaceSecondsInput = document.getElementById('swim-pace-seconds');
const swimTimeReadout = document.getElementById('swim-time-readout');
const swimTimeValue = document.getElementById('swim-time-value');
const swimPaceReadout = document.getElementById('swim-pace-readout');
const swimPaceValue = document.getElementById('swim-pace-value');

const bikeModeRadios = document.querySelectorAll('input[name="bike-mode"]');
const bikeTimeFields = document.getElementById('bike-time-fields');
const bikeHoursInput = document.getElementById('bike-hours');
const bikeMinutesInput = document.getElementById('bike-minutes');
const bikeSecondsInput = document.getElementById('bike-seconds');
const bikeTimeError = document.getElementById('bike-time-error');
const bikeSpeedField = document.getElementById('bike-speed-field');
const bikeSpeedInput = document.getElementById('bike-speed-input');
const bikeSpeedUnitSuffix = document.getElementById('bike-speed-unit-suffix');
const bikeTimeReadout = document.getElementById('bike-time-readout');
const bikeTimeValue = document.getElementById('bike-time-value');
const bikeSpeedReadout = document.getElementById('bike-speed-readout');
const bikeSpeedValue = document.getElementById('bike-speed-value');

const runModeRadios = document.querySelectorAll('input[name="run-mode"]');
const runTimeFields = document.getElementById('run-time-fields');
const runHoursInput = document.getElementById('run-hours');
const runMinutesInput = document.getElementById('run-minutes');
const runSecondsInput = document.getElementById('run-seconds');
const runTimeError = document.getElementById('run-time-error');
const runPaceFields = document.getElementById('run-pace-fields');
const runPaceUnitHint = document.getElementById('run-pace-unit-hint');
const runPaceMinutesInput = document.getElementById('run-pace-minutes');
const runPaceSecondsInput = document.getElementById('run-pace-seconds');
const runTimeReadout = document.getElementById('run-time-readout');
const runTimeValue = document.getElementById('run-time-value');
const runPaceReadout = document.getElementById('run-pace-readout');
const runPaceValue = document.getElementById('run-pace-value');

const t1MinutesInput = document.getElementById('t1-minutes');
const t1SecondsInput = document.getElementById('t1-seconds');
const t1Error = document.getElementById('t1-error');

const t2MinutesInput = document.getElementById('t2-minutes');
const t2SecondsInput = document.getElementById('t2-seconds');
const t2Error = document.getElementById('t2-error');

const heroResult = document.querySelector('.hero-result');

function getChipDistances(chip) {
  const standard = TRIATHLON_STANDARD_DISTANCES.find((d) => d.label === chip.textContent.trim());
  return standard ? { swim: standard.swimMeters, bike: standard.bikeMeters, run: standard.runMeters } : null;
}

const initiallySelectedChip = Array.from(standardChips).find((c) => c.getAttribute('aria-pressed') === 'true');
const initialDistances = initiallySelectedChip ? getChipDistances(initiallySelectedChip) : null;

let currentUnit = document.querySelector('input[name="unit-system"]:checked').value; // 'metric' | 'imperial'
let isCustomDistance = false;
// Canonical metres per leg — either the selected standard chip's values, or (when
// Custom is active) each leg's own full-precision shadow. Used only for the badges
// / custom-field display; never read by calculateTotalTime.
let swimMeters = initialDistances ? initialDistances.swim : null;
let bikeMeters = initialDistances ? initialDistances.bike : null;
let runMeters = initialDistances ? initialDistances.run : null;
let lastResult = null; // total seconds, or null

// Per-leg input mode: 'time' (direct duration, the original v1 behaviour) or
// 'pace'/'speed' (compute that leg's duration from its distance + a pace/speed
// input instead). Section 15/17: the conversion reuses calculateTime from
// running.js/cycling.js/swimming.js rather than duplicating pace/speed math here
// — triathlon.js itself is untouched and still only sums five time values.
let swimMode = 'time';
let bikeMode = 'time';
let runMode = 'time';

// Full-precision shadows for the pace/speed inputs, always in a canonical unit
// (seconds/100m, km/h, seconds/km) regardless of the current Metric/Imperial
// toggle — same shadow-value pattern as the other calculators. null = untouched.
let swimPaceSecPer100mFull = null;
let bikeSpeedKmhFull = null;
let runPaceSecPerKmFull = null;
// Set when a pace field's raw min/sec text is genuinely malformed (e.g. seconds
// >= 60) rather than merely empty — thrown by readSwimDuration/readRunDuration
// so recalculate() surfaces it under that leg's existing error paragraph.
let swimPaceSyncError = null;
let runPaceSyncError = null;

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showFieldError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function clearFieldError(el) {
  el.textContent = '';
  el.hidden = true;
}

// Shows `message` under the field whose label prefixes err.message, clears the others.
function routeError(err, mapping) {
  mapping.forEach(([prefix, el]) => {
    if (err.message.startsWith(prefix)) {
      showFieldError(el, err.message);
    } else {
      clearFieldError(el);
    }
  });
}

function setBadgesVisible(visible) {
  [swimDistanceBadge, bikeDistanceBadge, runDistanceBadge].forEach((el) => {
    el.hidden = !visible;
  });
}

function updateBadges() {
  swimDistanceBadge.textContent = swimMeters === null
    ? ''
    : (currentUnit === 'metric' ? `${formatDistanceMeters(swimMeters)}m` : `${formatDistanceYards(swimMeters)}yd`);
  bikeDistanceBadge.textContent = bikeMeters === null
    ? ''
    : (currentUnit === 'metric' ? `${formatDistanceKm(bikeMeters)}km` : `${formatDistanceMiles(bikeMeters)}mi`);
  runDistanceBadge.textContent = runMeters === null
    ? ''
    : (currentUnit === 'metric' ? `${formatDistanceKm(runMeters)}km` : `${formatDistanceMiles(runMeters)}mi`);
}

// Re-derives the given leg's canonical-metres shadow from its custom distance
// input, at full precision. Called immediately on 'input' (genuine typing only —
// programmatic .value assignment during a toggle does not fire 'input').
function syncSwimDistanceFromInput() {
  const raw = swimDistanceInput.value.trim();
  if (raw === '') {
    swimMeters = null;
    clearFieldError(swimDistanceError);
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    swimMeters = null;
    clearFieldError(swimDistanceError);
    return;
  }
  const meters = currentUnit === 'metric' ? value : yardsToMeters(value);
  if (meters <= 0) {
    swimMeters = null;
    showFieldError(swimDistanceError, 'Swim distance must be greater than zero');
    return;
  }
  swimMeters = meters;
  clearFieldError(swimDistanceError);
}

function syncBikeDistanceFromInput() {
  const raw = bikeDistanceInput.value.trim();
  if (raw === '') {
    bikeMeters = null;
    clearFieldError(bikeDistanceError);
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    bikeMeters = null;
    clearFieldError(bikeDistanceError);
    return;
  }
  const meters = currentUnit === 'metric' ? kmToMeters(value) : milesToMeters(value);
  if (meters <= 0) {
    bikeMeters = null;
    showFieldError(bikeDistanceError, 'Bike distance must be greater than zero');
    return;
  }
  bikeMeters = meters;
  clearFieldError(bikeDistanceError);
}

function syncRunDistanceFromInput() {
  const raw = runDistanceInput.value.trim();
  if (raw === '') {
    runMeters = null;
    clearFieldError(runDistanceError);
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    runMeters = null;
    clearFieldError(runDistanceError);
    return;
  }
  const meters = currentUnit === 'metric' ? kmToMeters(value) : milesToMeters(value);
  if (meters <= 0) {
    runMeters = null;
    showFieldError(runDistanceError, 'Run distance must be greater than zero');
    return;
  }
  runMeters = meters;
  clearFieldError(runDistanceError);
}

// Combines a pace field's min/sec inputs into a plain number of seconds in the
// *entered* unit — null if untouched, throws for genuinely malformed component
// values (Section 13: impossible time formats). Shared by the Swim and Run pace
// fields, which are identical in shape.
function combinePaceComponents(minutesInput, secondsInput) {
  const minutesRaw = minutesInput.value.trim();
  const secondsRaw = secondsInput.value.trim();

  if (minutesRaw === '' && secondsRaw === '') {
    return null;
  }

  const minutes = minutesRaw === '' ? 0 : Number(minutesRaw);
  const seconds = secondsRaw === '' ? 0 : Number(secondsRaw);

  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    throw new Error('Pace minutes and seconds must be numbers');
  }
  if (minutes < 0) {
    throw new Error('Pace minutes must not be negative');
  }
  if (seconds < 0 || seconds >= 60) {
    throw new Error('Pace seconds must be between 0 and 59');
  }

  return minutes * 60 + seconds;
}

// Re-derives swimPaceSecPer100mFull from the Swim Pace field, at full precision.
// Mirrors swimming-ui.js's syncPaceFromInput — pace converts in the OPPOSITE
// direction to a plain distance (yd -> 100m pace divides, since 100yd is a
// shorter distance than 100m).
function syncSwimPaceFromInput() {
  swimPaceSyncError = null;
  try {
    const entered = combinePaceComponents(swimPaceMinutesInput, swimPaceSecondsInput);
    if (entered === null) {
      swimPaceSecPer100mFull = null;
      return;
    }
    swimPaceSecPer100mFull = currentUnit === 'metric' ? entered : entered / METERS_PER_YARD;
  } catch (err) {
    swimPaceSecPer100mFull = null;
    swimPaceSyncError = err;
  }
}

// Re-derives runPaceSecPerKmFull from the Run Pace field, at full precision.
// Mirrors running-ui.js's syncPaceFromInput.
function syncRunPaceFromInput() {
  runPaceSyncError = null;
  try {
    const entered = combinePaceComponents(runPaceMinutesInput, runPaceSecondsInput);
    if (entered === null) {
      runPaceSecPerKmFull = null;
      return;
    }
    runPaceSecPerKmFull = currentUnit === 'metric' ? entered : entered * metersToMiles(1000);
  } catch (err) {
    runPaceSecPerKmFull = null;
    runPaceSyncError = err;
  }
}

// Re-derives bikeSpeedKmhFull from the Bike Speed field, at full precision.
// Mirrors cycling-ui.js's syncSpeedFromInput.
function syncBikeSpeedFromInput() {
  const raw = bikeSpeedInput.value.trim();
  if (raw === '') {
    bikeSpeedKmhFull = null;
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    bikeSpeedKmhFull = null;
    return;
  }
  bikeSpeedKmhFull = currentUnit === 'metric' ? value : metersToKm(milesToMeters(value));
}

// Re-renders the Swim/Run pace fields' displayed text (nearest whole second) and
// the Bike speed field's displayed text (1dp) from their full-precision shadows,
// in the current unit. Never touches the shadows.
function refreshSwimPaceDisplay() {
  if (swimPaceSecPer100mFull === null) {
    return;
  }
  const displaySeconds = currentUnit === 'metric' ? swimPaceSecPer100mFull : swimPaceSecPer100mFull * METERS_PER_YARD;
  const rounded = Math.round(displaySeconds);
  swimPaceMinutesInput.value = Math.floor(rounded / 60);
  swimPaceSecondsInput.value = rounded % 60;
}

function refreshRunPaceDisplay() {
  if (runPaceSecPerKmFull === null) {
    return;
  }
  const displaySeconds = currentUnit === 'metric' ? runPaceSecPerKmFull : runPaceSecPerKmFull / metersToMiles(1000);
  const rounded = Math.round(displaySeconds);
  runPaceMinutesInput.value = Math.floor(rounded / 60);
  runPaceSecondsInput.value = rounded % 60;
}

function refreshBikeSpeedDisplay() {
  if (bikeSpeedKmhFull === null) {
    return;
  }
  const value = currentUnit === 'metric' ? bikeSpeedKmhFull : metersToMiles(kmToMeters(bikeSpeedKmhFull));
  bikeSpeedInput.value = value.toFixed(1);
}

// Updates the pace/speed fields' unit-dependent labels — called both at init and
// on every unit toggle, so a field never shows stale-unit text (Section 12).
function updateLegUnitLabels() {
  swimPaceUnitHint.textContent = currentUnit === 'metric' ? 'Pace (min/100m)' : 'Pace (min/100yd)';
  runPaceUnitHint.textContent = currentUnit === 'metric' ? 'Pace (min/km)' : 'Pace (min/mi)';
  bikeSpeedUnitSuffix.textContent = currentUnit === 'metric' ? 'km/h' : 'mph';
}

// Re-renders a custom distance field's displayed text from its full-precision
// shadow, in the current unit. Never touches the shadow.
function refreshCustomDistanceDisplays() {
  if (!isCustomDistance) {
    return;
  }
  if (swimMeters !== null) {
    swimDistanceInput.value = (currentUnit === 'metric' ? swimMeters : metersToYards(swimMeters)).toFixed(0);
  }
  if (bikeMeters !== null) {
    bikeDistanceInput.value = (currentUnit === 'metric' ? metersToKm(bikeMeters) : metersToMiles(bikeMeters)).toFixed(2);
  }
  if (runMeters !== null) {
    runDistanceInput.value = (currentUnit === 'metric' ? metersToKm(runMeters) : metersToMiles(runMeters)).toFixed(2);
  }
}

// Returns a { hours, minutes, seconds } object, or null if nothing has been typed
// yet (a leg time is required — this is the "incomplete" signal, not zero/invalid).
function readLegDuration(hoursInput, minutesInput, secondsInput) {
  const hoursRaw = hoursInput.value.trim();
  const minutesRaw = minutesInput.value.trim();
  const secondsRaw = secondsInput.value.trim();

  if (hoursRaw === '' && minutesRaw === '' && secondsRaw === '') {
    return null;
  }

  return {
    hours: hoursRaw === '' ? 0 : Number(hoursRaw),
    minutes: minutesRaw === '' ? 0 : Number(minutesRaw),
    seconds: secondsRaw === '' ? 0 : Number(secondsRaw)
  };
}

// Returns 0 if the transition is entirely blank (Section 13: blank defaults to
// zero, never blocks the calculation), else a { minutes, seconds } object.
function readTransition(minutesInput, secondsInput) {
  const minutesRaw = minutesInput.value.trim();
  const secondsRaw = secondsInput.value.trim();

  if (minutesRaw === '' && secondsRaw === '') {
    return 0;
  }

  return {
    minutes: minutesRaw === '' ? 0 : Number(minutesRaw),
    seconds: secondsRaw === '' ? 0 : Number(secondsRaw)
  };
}

function renderResult() {
  heroResult.textContent = lastResult === null ? PLACEHOLDER : formatTime(lastResult);
}

// Shows this leg's own computed time under its Pace/Speed input — only in
// Pace/Speed mode, since in Time mode the time IS the input, already visible in
// the h/m/s fields above. `duration` is whatever readSwimDuration (etc.) returned:
// a plain number of seconds, a { hours, minutes, seconds } object, or null.
function renderLegTime(readoutEl, valueEl, mode, duration) {
  if (mode === 'time' || duration === null) {
    readoutEl.hidden = true;
    return;
  }
  const seconds = typeof duration === 'number'
    ? duration
    : duration.hours * 3600 + duration.minutes * 60 + duration.seconds;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    readoutEl.hidden = true;
    return;
  }
  valueEl.textContent = formatTime(seconds);
  readoutEl.hidden = false;
}

// The mirror of renderLegTime: shows this leg's resulting Pace/Speed under its
// Time input — only in Time mode, using that leg's distance (the selected
// standard or custom leg distance). `duration` is whatever readSwimDuration
// (etc.) returned in Time mode: a { hours, minutes, seconds } object, or null.
// A caught calculatePace/calculateSpeed error (e.g. all-zero duration) just
// hides the readout — the leg's own field-error paragraph already covers that
// case via calculateTotalTime's validation.
function renderSwimPaceReadout(duration) {
  if (swimMode !== 'time' || swimMeters === null || duration === null) {
    swimPaceReadout.hidden = true;
    return;
  }
  try {
    const pace = calculateSwimPace(swimMeters, duration);
    swimPaceValue.textContent = currentUnit === 'metric'
      ? `${formatPacePer100m(pace.secPer100m)} /100m`
      : `${formatPacePer100yd(pace.secPer100yd)} /100yd`;
    swimPaceReadout.hidden = false;
  } catch {
    swimPaceReadout.hidden = true;
  }
}

function renderBikeSpeedReadout(duration) {
  if (bikeMode !== 'time' || bikeMeters === null || duration === null) {
    bikeSpeedReadout.hidden = true;
    return;
  }
  try {
    const speed = calculateBikeSpeed(bikeMeters, duration);
    bikeSpeedValue.textContent = currentUnit === 'metric'
      ? `${formatSpeedKmh(speed.kmh)} km/h`
      : `${formatSpeedMph(speed.mph)} mph`;
    bikeSpeedReadout.hidden = false;
  } catch {
    bikeSpeedReadout.hidden = true;
  }
}

function renderRunPaceReadout(duration) {
  if (runMode !== 'time' || runMeters === null || duration === null) {
    runPaceReadout.hidden = true;
    return;
  }
  try {
    const pace = calculateRunPace(runMeters, duration);
    runPaceValue.textContent = currentUnit === 'metric'
      ? `${formatPaceMinPerKm(pace.secPerKm)} /km`
      : `${formatPaceMinPerMile(pace.secPerMile)} /mi`;
    runPaceReadout.hidden = false;
  } catch {
    runPaceReadout.hidden = true;
  }
}

// Returns this leg's duration — a { hours, minutes, seconds } object in 'time'
// mode (unchanged v1 behaviour), or a plain number of seconds computed from
// distance + pace/speed in 'pace'/'speed' mode — or null if incomplete. Throws
// for a genuinely invalid pace/speed (Section 13), which recalculate() catches
// and routes to this leg's own error paragraph.
function readSwimDuration() {
  if (swimMode === 'time') {
    return readLegDuration(swimHoursInput, swimMinutesInput, swimSecondsInput);
  }
  if (swimPaceSyncError) {
    throw swimPaceSyncError;
  }
  if (swimMeters === null || swimPaceSecPer100mFull === null) {
    return null;
  }
  return calculateSwimTime(swimMeters, swimPaceSecPer100mFull);
}

function readBikeDuration() {
  if (bikeMode === 'time') {
    return readLegDuration(bikeHoursInput, bikeMinutesInput, bikeSecondsInput);
  }
  if (bikeMeters === null || bikeSpeedKmhFull === null) {
    return null;
  }
  return calculateBikeTime(bikeMeters, bikeSpeedKmhFull);
}

function readRunDuration() {
  if (runMode === 'time') {
    return readLegDuration(runHoursInput, runMinutesInput, runSecondsInput);
  }
  if (runPaceSyncError) {
    throw runPaceSyncError;
  }
  if (runMeters === null || runPaceSecPerKmFull === null) {
    return null;
  }
  return calculateRunTime(runMeters, runPaceSecPerKmFull);
}

function recalculate() {
  let swimDuration = null;
  let bikeDuration = null;
  let runDuration = null;
  let hasLegError = false;

  try {
    swimDuration = readSwimDuration();
    clearFieldError(swimTimeError);
    renderLegTime(swimTimeReadout, swimTimeValue, swimMode, swimDuration);
    renderSwimPaceReadout(swimDuration);
  } catch (err) {
    showFieldError(swimTimeError, err.message);
    renderLegTime(swimTimeReadout, swimTimeValue, swimMode, null);
    renderSwimPaceReadout(null);
    hasLegError = true;
  }

  try {
    bikeDuration = readBikeDuration();
    clearFieldError(bikeTimeError);
    renderLegTime(bikeTimeReadout, bikeTimeValue, bikeMode, bikeDuration);
    renderBikeSpeedReadout(bikeDuration);
  } catch (err) {
    showFieldError(bikeTimeError, err.message);
    renderLegTime(bikeTimeReadout, bikeTimeValue, bikeMode, null);
    renderBikeSpeedReadout(null);
    hasLegError = true;
  }

  try {
    runDuration = readRunDuration();
    clearFieldError(runTimeError);
    renderLegTime(runTimeReadout, runTimeValue, runMode, runDuration);
    renderRunPaceReadout(runDuration);
  } catch (err) {
    showFieldError(runTimeError, err.message);
    renderLegTime(runTimeReadout, runTimeValue, runMode, null);
    renderRunPaceReadout(null);
    hasLegError = true;
  }

  if (hasLegError) {
    lastResult = null;
    clearFieldError(t1Error);
    clearFieldError(t2Error);
    renderResult();
    return;
  }

  if (swimDuration === null || bikeDuration === null || runDuration === null) {
    lastResult = null;
    clearFieldError(t1Error);
    clearFieldError(t2Error);
    renderResult();
    return;
  }

  const t1 = readTransition(t1MinutesInput, t1SecondsInput);
  const t2 = readTransition(t2MinutesInput, t2SecondsInput);

  try {
    lastResult = calculateTotalTime({ swimTime: swimDuration, t1Time: t1, bikeTime: bikeDuration, t2Time: t2, runTime: runDuration });
    clearFieldError(t1Error);
    clearFieldError(t2Error);
  } catch (err) {
    lastResult = null;
    routeError(err, [
      ['Swim time', swimTimeError],
      ['T1', t1Error],
      ['Bike time', bikeTimeError],
      ['T2', t2Error],
      ['Run time', runTimeError]
    ]);
  }

  renderResult();
}

const debouncedRecalculate = debounce(recalculate, DEBOUNCE_MS);

function setSwimMode(mode) {
  swimMode = mode;
  swimTimeFields.hidden = mode === 'pace';
  swimPaceFields.hidden = mode === 'time';
  clearFieldError(swimTimeError);
  recalculate();
}

function setBikeMode(mode) {
  bikeMode = mode;
  bikeTimeFields.hidden = mode === 'speed';
  bikeSpeedField.hidden = mode === 'time';
  clearFieldError(bikeTimeError);
  recalculate();
}

function setRunMode(mode) {
  runMode = mode;
  runTimeFields.hidden = mode === 'pace';
  runPaceFields.hidden = mode === 'time';
  clearFieldError(runTimeError);
  recalculate();
}

swimModeRadios.forEach((radio) => {
  radio.addEventListener('change', () => setSwimMode(radio.value));
});

bikeModeRadios.forEach((radio) => {
  radio.addEventListener('change', () => setBikeMode(radio.value));
});

runModeRadios.forEach((radio) => {
  radio.addEventListener('change', () => setRunMode(radio.value));
});

standardChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const distances = getChipDistances(chip);
    if (!distances) {
      return;
    }

    standardChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    customChip.setAttribute('aria-pressed', 'false');
    customChip.setAttribute('aria-expanded', 'false');
    customDistanceFields.hidden = true;
    clearFieldError(swimDistanceError);
    clearFieldError(bikeDistanceError);
    clearFieldError(runDistanceError);

    isCustomDistance = false;
    swimMeters = distances.swim;
    bikeMeters = distances.bike;
    runMeters = distances.run;
    setBadgesVisible(true);
    updateBadges();
    recalculate();
  });
});

customChip.addEventListener('click', () => {
  standardChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
  customChip.setAttribute('aria-pressed', 'true');
  customChip.setAttribute('aria-expanded', 'true');
  customDistanceFields.hidden = false;
  setBadgesVisible(false);

  isCustomDistance = true;
  swimMeters = null;
  bikeMeters = null;
  runMeters = null;
  swimDistanceInput.value = '';
  bikeDistanceInput.value = '';
  runDistanceInput.value = '';
  clearFieldError(swimDistanceError);
  clearFieldError(bikeDistanceError);
  clearFieldError(runDistanceError);
  swimDistanceInput.focus();
  recalculate();
});

unitRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    currentUnit = document.querySelector('input[name="unit-system"]:checked').value;

    swimDistanceUnit.textContent = currentUnit === 'metric' ? 'm' : 'yd';
    bikeDistanceUnit.textContent = currentUnit === 'metric' ? 'km' : 'mi';
    runDistanceUnit.textContent = currentUnit === 'metric' ? 'km' : 'mi';

    if (isCustomDistance) {
      refreshCustomDistanceDisplays();
    } else {
      updateBadges();
    }

    // Re-render from the (unchanged) full-precision shadows — never re-derive them
    // from the rounded displayed text. See the sync/refresh functions above.
    refreshSwimPaceDisplay();
    refreshBikeSpeedDisplay();
    refreshRunPaceDisplay();
    updateLegUnitLabels();

    recalculate();
  });
});

swimDistanceInput.addEventListener('input', () => {
  syncSwimDistanceFromInput();
  debouncedRecalculate();
});

bikeDistanceInput.addEventListener('input', () => {
  syncBikeDistanceFromInput();
  debouncedRecalculate();
});

runDistanceInput.addEventListener('input', () => {
  syncRunDistanceFromInput();
  debouncedRecalculate();
});

[swimPaceMinutesInput, swimPaceSecondsInput].forEach((input) => {
  input.addEventListener('input', () => {
    syncSwimPaceFromInput();
    debouncedRecalculate();
  });
});

bikeSpeedInput.addEventListener('input', () => {
  syncBikeSpeedFromInput();
  debouncedRecalculate();
});

[runPaceMinutesInput, runPaceSecondsInput].forEach((input) => {
  input.addEventListener('input', () => {
    syncRunPaceFromInput();
    debouncedRecalculate();
  });
});

[
  swimHoursInput, swimMinutesInput, swimSecondsInput,
  bikeHoursInput, bikeMinutesInput, bikeSecondsInput,
  runHoursInput, runMinutesInput, runSecondsInput,
  t1MinutesInput, t1SecondsInput,
  t2MinutesInput, t2SecondsInput
].forEach((input) => {
  input.addEventListener('input', debouncedRecalculate);
});

form.addEventListener('submit', (e) => e.preventDefault());

swimDistanceUnit.textContent = currentUnit === 'metric' ? 'm' : 'yd';
bikeDistanceUnit.textContent = currentUnit === 'metric' ? 'km' : 'mi';
runDistanceUnit.textContent = currentUnit === 'metric' ? 'km' : 'mi';
updateLegUnitLabels();
updateBadges();
recalculate();
