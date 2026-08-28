// DOM/interaction layer for the Triathlon calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
//
// Unlike Running/Cycling/Swimming, Triathlon has no Pace/Time/Distance solve-for
// toggle (Section 18): it always takes distance (per leg, standard or custom) and
// time (or transition time) per leg as inputs, and always outputs total finish
// time. Distance is captured here purely for the small leg-distance badges shown
// next to each leg's heading — it is NOT passed into calculateTotalTime, which only
// sums the five time values (Section 15/17: no duplicated cross-cutting logic —
// badge formatting reuses formatDistanceKm/Miles from running.js and
// formatDistanceMeters/Yards from swimming.js rather than reimplementing them).
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
// Section 13: swim/bike/run leg times are required (blank on all three of a leg's
// h/m/s fields means "incomplete", not invalid — placeholder shown, no error).
// Transition times (T1/T2) are optional: a fully blank transition defaults to zero
// rather than blocking the calculation, per the confirmed Triathlon validation rule.
// Genuinely invalid values (zero/negative leg time, negative transition, malformed
// time components) surface as inline errors under the relevant field.
// Section 18: results update live, debounced briefly after the last keystroke.

import { calculateTotalTime, formatTime, TRIATHLON_STANDARD_DISTANCES } from '../logic/triathlon.js';
import { formatDistanceKm, formatDistanceMiles } from '../logic/running.js';
import { formatDistanceMeters, formatDistanceYards } from '../logic/swimming.js';
import { kmToMeters, metersToKm, milesToMeters, metersToMiles, yardsToMeters, metersToYards } from '../logic/unitConversion.js';
import { prefersImperial } from './unitPreference.js';

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

const swimHoursInput = document.getElementById('swim-hours');
const swimMinutesInput = document.getElementById('swim-minutes');
const swimSecondsInput = document.getElementById('swim-seconds');
const swimTimeError = document.getElementById('swim-time-error');

const bikeHoursInput = document.getElementById('bike-hours');
const bikeMinutesInput = document.getElementById('bike-minutes');
const bikeSecondsInput = document.getElementById('bike-seconds');
const bikeTimeError = document.getElementById('bike-time-error');

const runHoursInput = document.getElementById('run-hours');
const runMinutesInput = document.getElementById('run-minutes');
const runSecondsInput = document.getElementById('run-seconds');
const runTimeError = document.getElementById('run-time-error');

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

// Section 12: default unit is auto-detected from the browser locale, overriding
// the static HTML's metric default, before any state is read from the toggle.
if (prefersImperial()) {
  document.getElementById('unit-imperial').checked = true;
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

function clearAllTimeErrors() {
  [swimTimeError, t1Error, bikeTimeError, t2Error, runTimeError].forEach(clearFieldError);
}

function renderResult() {
  heroResult.textContent = lastResult === null ? PLACEHOLDER : formatTime(lastResult);
}

function recalculate() {
  const swimDuration = readLegDuration(swimHoursInput, swimMinutesInput, swimSecondsInput);
  const bikeDuration = readLegDuration(bikeHoursInput, bikeMinutesInput, bikeSecondsInput);
  const runDuration = readLegDuration(runHoursInput, runMinutesInput, runSecondsInput);

  if (swimDuration === null || bikeDuration === null || runDuration === null) {
    lastResult = null;
    clearAllTimeErrors();
    renderResult();
    return;
  }

  const t1 = readTransition(t1MinutesInput, t1SecondsInput);
  const t2 = readTransition(t2MinutesInput, t2SecondsInput);

  try {
    lastResult = calculateTotalTime({ swimTime: swimDuration, t1Time: t1, bikeTime: bikeDuration, t2Time: t2, runTime: runDuration });
    clearAllTimeErrors();
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
updateBadges();
recalculate();
