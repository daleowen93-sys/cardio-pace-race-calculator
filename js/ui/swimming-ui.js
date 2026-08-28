// DOM/interaction layer for the Swimming calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
// Mirrors running-ui.js's mode-aware pattern, adapted for Swimming's pace-per-
// 100m/100yd/500m and its M/YD (metres/yards) unit toggle instead of KM/MI.
//
// Three Solve For modes are wired here:
//   Pace     — Distance + Time     -> Pace     (calculatePace)
//   Time     — Distance + Pace     -> Time     (calculateTime)
//   Distance — Time + Pace         -> Distance (calculateDistance)
//
// Section 12 / CLAUDE.md: the custom distance and Pace inputs are each unit-
// dependent (their typed numbers mean something different in M vs YD), so each is
// backed by a full-precision "shadow" value in a canonical unit that never changes
// with the toggle — customDistanceMeters (metres) and paceSecPer100mFull (seconds
// per 100m):
//   - Typing re-derives the shadow from the freshly typed text (new source of truth).
//   - Toggling M/YD never touches the shadow — it only re-renders the displayed
//     text, rounded, in the new unit (programmatic .value assignment doesn't fire
//     'input', so it can't accidentally overwrite the shadow with a rounded value).
// All calculation reads the shadow, never the displayed text — repeated toggling
// back and forth never loses precision or drifts a result.
//
// Pace is combined into a plain seconds-per-100m number here in the UI layer (not
// passed as an { hours, minutes, seconds } object) because swimming.js's
// calculateTime/calculateDistance intentionally only accept pace as a plain number
// (Section 12: pace has no meaningful hours component) — so component-range
// validation (e.g. seconds 0-59) for the Pace input has to happen here, mirroring
// what swimming.js already does internally for the Duration object form. That
// validation runs at sync time (see syncPaceFromInput/paceSyncError below), not at
// read time, since the shadow itself can no longer throw.
//
// Converting a pace between M and YD is the OPPOSITE direction to converting a
// plain distance: pace is time PER distance (a reciprocal quantity), so going
// m -> yd multiplies (100yd is a shorter distance than 100m, so it takes less time
// at the same rate), not divides. This is the same relationship swimming.js's
// calculatePace itself uses (secPer100yd = secPer100m * METERS_PER_YARD).
//
// Section 13: genuinely invalid values (zero/negative/malformed) surface as inline
// errors; simply-not-filled-in-yet inputs show the placeholder instead of an error.
// isExtremeValue() is checked after every successful calculation, in all three
// modes — using the actual (distance, duration) pair the scenario represents,
// regardless of which one was the solved-for output — and shown as a non-blocking
// soft warning.
// Section 18: results update live, debounced briefly after the last keystroke.
// Switching M/YD re-renders unit-dependent fields from their full-precision shadow
// and recalculates immediately (synchronous, no perceptible delay). Switching Solve
// For tabs resets the result to the placeholder and immediately (non-debounced)
// recalculates from whatever the newly-visible fields already contain.
//
// Swimming-specific: the Pace-mode hero shows pace/100m (M) or pace/100yd (YD),
// with a secondary pace/500m stat shown only in metric (M) mode (Section 12: no
// imperial equivalent for pace/500m). The secondary stat never appears in Time or
// Distance mode, since it's a reading of the Pace *result*, not an input.

import {
  calculatePace,
  calculateTime,
  calculateDistance,
  formatPacePer100m,
  formatPacePer100yd,
  formatPacePer500m,
  formatTime,
  formatDistanceMeters,
  formatDistanceYards,
  isExtremeValue,
  SWIMMING_STANDARD_DISTANCES
} from '../logic/swimming.js';
import { yardsToMeters, metersToYards, METERS_PER_YARD } from '../logic/unitConversion.js';
import { prefersImperial } from './unitPreference.js';

const PLACEHOLDER = '–:––';
const DEBOUNCE_MS = 300;
const EXTREME_WARNING_MESSAGE = "That's an extreme distance/duration — double check your inputs.";

const form = document.querySelector('.calculator');
const unitRadios = document.querySelectorAll('input[name="unit-system"]');
const solveForRadios = document.querySelectorAll('input[name="solve-for"]');

const distanceFieldGroup = document.getElementById('distance-field-group');
const standardChips = document.querySelectorAll('.chip[data-distance-meters]');
const customChip = document.getElementById('chip-custom');
const customField = document.getElementById('custom-distance-field');
const distanceInput = document.getElementById('distance-input');
const distanceUnitSuffix = customField.querySelector('.input-unit-suffix');
const distanceError = document.getElementById('distance-error');

const paceFieldGroup = document.getElementById('pace-field-group');
const paceUnitHint = document.getElementById('pace-unit-hint');
const paceMinutesInput = document.getElementById('pace-minutes');
const paceSecondsInput = document.getElementById('pace-seconds');
const paceError = document.getElementById('pace-error');

const timeFieldGroup = document.getElementById('time-field-group');
const hoursInput = document.getElementById('time-hours');
const minutesInput = document.getElementById('time-minutes');
const secondsInput = document.getElementById('time-seconds');
const timeError = document.getElementById('time-error');

const resultLabel = document.querySelector('.result-label');
const heroResult = document.querySelector('.hero-result');
const resultSublabel = document.querySelector('.result-sublabel');
const resultSecondary = document.getElementById('result-secondary');
const resultSecondaryValue = resultSecondary.querySelector('.result-secondary-value');
const extremeWarning = document.getElementById('extreme-warning');

function getChipDistanceMeters(chip) {
  const standard = SWIMMING_STANDARD_DISTANCES.find((d) => d.label === chip.textContent.trim());
  return standard ? standard.meters : null;
}

const initiallySelectedChip = Array.from(standardChips).find((c) => c.getAttribute('aria-pressed') === 'true');

// Section 12: default unit is auto-detected from the browser locale, overriding
// the static HTML's metric default, before any state is read from the toggle.
if (prefersImperial()) {
  document.getElementById('unit-yd').checked = true;
}

function updateUnitLabels() {
  distanceUnitSuffix.textContent = currentUnit;
  paceUnitHint.textContent = currentUnit === 'm' ? '(min/100m)' : '(min/100yd)';
}

let currentUnit = document.querySelector('input[name="unit-system"]:checked').value; // 'm' | 'yd'
let currentMode = document.querySelector('input[name="solve-for"]:checked').value;
let isCustomDistance = false;
let distanceMeters = initiallySelectedChip ? getChipDistanceMeters(initiallySelectedChip) : null;
let lastResult = null; // shape depends on currentMode: {secPer100m,secPer100yd,secPer500m} | seconds | meters

// Full-precision shadows for unit-dependent inputs, always in a canonical unit
// (metres / seconds-per-100m) regardless of the current M/YD toggle. null = untouched.
let customDistanceMeters = null;
let paceSecPer100mFull = null;
// Set by syncPaceFromInput when the Pace fields' raw text is genuinely malformed
// (e.g. seconds >= 60) rather than merely empty — consulted by recalculateTime/
// recalculateDistance so the same error message still surfaces as before.
let paceSyncError = null;

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

function showWarning(show) {
  extremeWarning.textContent = show ? EXTREME_WARNING_MESSAGE : '';
  extremeWarning.hidden = !show;
}

function showSecondary(show) {
  resultSecondary.hidden = !show;
}

// Shows `message` under the field whose label prefixes err.message, clears the other(s).
function routeError(err, mapping) {
  mapping.forEach(([prefix, el]) => {
    if (err.message.startsWith(prefix)) {
      showFieldError(el, err.message);
    } else {
      clearFieldError(el);
    }
  });
}

// Combines the Pace min/sec inputs into a plain number in the *entered* unit
// (sec/100m or sec/100yd, per currentUnit) — null if untouched, throws for
// genuinely malformed component values (Section 13: impossible time formats).
function combinePaceComponents() {
  const minutesRaw = paceMinutesInput.value.trim();
  const secondsRaw = paceSecondsInput.value.trim();

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

// Re-derives customDistanceMeters from whatever's currently typed in the custom
// distance field, at full precision. Called immediately on 'input' (genuine typing
// only — programmatic .value assignment during a toggle does not fire 'input').
function syncCustomDistanceFromInput() {
  const raw = distanceInput.value.trim();
  if (raw === '') {
    customDistanceMeters = null;
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    customDistanceMeters = null;
    return;
  }
  customDistanceMeters = currentUnit === 'm' ? value : yardsToMeters(value);
}

// Same principle as syncCustomDistanceFromInput, for the Pace input. Component-range
// validation (combinePaceComponents) still runs here, at typing time; a thrown error
// is captured in paceSyncError rather than propagating, so recalculate() can surface
// it exactly as before.
function syncPaceFromInput() {
  paceSyncError = null;
  try {
    const entered = combinePaceComponents();
    if (entered === null) {
      paceSecPer100mFull = null;
      return;
    }
    // m -> 100m pace is already canonical; yd -> 100m pace divides (see file header
    // for why pace inverts the plain-distance conversion direction).
    paceSecPer100mFull = currentUnit === 'm' ? entered : entered / METERS_PER_YARD;
  } catch (err) {
    paceSecPer100mFull = null;
    paceSyncError = err;
  }
}

// Re-renders the custom distance field's displayed text (whole units, Section 12)
// from its full-precision shadow, in the current unit. Never touches the shadow.
function refreshDistanceDisplay() {
  if (!isCustomDistance || customDistanceMeters === null) {
    return;
  }
  const value = currentUnit === 'm' ? customDistanceMeters : metersToYards(customDistanceMeters);
  distanceInput.value = value.toFixed(0);
}

// Same principle as refreshDistanceDisplay, for the Pace fields (rounded to the
// nearest whole second, Section 12).
function refreshPaceDisplay() {
  if (paceSecPer100mFull === null) {
    return;
  }
  const displaySeconds = currentUnit === 'm' ? paceSecPer100mFull : paceSecPer100mFull * METERS_PER_YARD;
  const rounded = Math.round(displaySeconds);
  paceMinutesInput.value = Math.floor(rounded / 60);
  paceSecondsInput.value = rounded % 60;
}

// Returns distance in metres, or null if the relevant input hasn't been filled in yet.
function readDistanceMeters() {
  return isCustomDistance ? customDistanceMeters : distanceMeters;
}

// Returns a { hours, minutes, seconds } object, or null if nothing has been typed yet.
function readDuration() {
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

function currentSublabel() {
  if (currentMode === 'pace') return currentUnit === 'm' ? 'min / 100m' : 'min / 100yd';
  if (currentMode === 'distance') return currentUnit === 'm' ? 'm' : 'yd';
  return '';
}

function renderResult() {
  if (lastResult === null) {
    heroResult.textContent = PLACEHOLDER;
    showSecondary(false);
  } else if (currentMode === 'pace') {
    if (currentUnit === 'm') {
      heroResult.textContent = formatPacePer100m(lastResult.secPer100m);
      resultSecondaryValue.textContent = formatPacePer500m(lastResult.secPer500m);
      showSecondary(true);
    } else {
      heroResult.textContent = formatPacePer100yd(lastResult.secPer100yd);
      showSecondary(false);
    }
  } else if (currentMode === 'time') {
    heroResult.textContent = formatTime(lastResult);
    showSecondary(false);
  } else {
    heroResult.textContent = currentUnit === 'm' ? formatDistanceMeters(lastResult) : formatDistanceYards(lastResult);
    showSecondary(false);
  }
  resultSublabel.textContent = currentSublabel();
}

function recalculatePace() {
  const distance = readDistanceMeters();
  const duration = readDuration();

  if (distance === null || duration === null) {
    lastResult = null;
    clearFieldError(distanceError);
    clearFieldError(timeError);
    showWarning(false);
    renderResult();
    return;
  }

  try {
    lastResult = calculatePace(distance, duration);
    clearFieldError(distanceError);
    clearFieldError(timeError);
    showWarning(isExtremeValue(distance, duration));
  } catch (err) {
    lastResult = null;
    showWarning(false);
    routeError(err, [['Distance', distanceError], ['Duration', timeError]]);
  }

  renderResult();
}

function recalculateTime() {
  if (paceSyncError) {
    lastResult = null;
    showWarning(false);
    routeError(paceSyncError, [['Distance', distanceError], ['Pace', paceError]]);
    renderResult();
    return;
  }

  const distance = readDistanceMeters();
  const pace = paceSecPer100mFull;

  if (distance === null || pace === null) {
    lastResult = null;
    clearFieldError(distanceError);
    clearFieldError(paceError);
    showWarning(false);
    renderResult();
    return;
  }

  try {
    const seconds = calculateTime(distance, pace);
    lastResult = seconds;
    clearFieldError(distanceError);
    clearFieldError(paceError);
    showWarning(isExtremeValue(distance, seconds));
  } catch (err) {
    lastResult = null;
    showWarning(false);
    routeError(err, [['Distance', distanceError], ['Pace', paceError]]);
  }

  renderResult();
}

function recalculateDistance() {
  if (paceSyncError) {
    lastResult = null;
    showWarning(false);
    routeError(paceSyncError, [['Duration', timeError], ['Pace', paceError]]);
    renderResult();
    return;
  }

  const duration = readDuration();
  const pace = paceSecPer100mFull;

  if (duration === null || pace === null) {
    lastResult = null;
    clearFieldError(timeError);
    clearFieldError(paceError);
    showWarning(false);
    renderResult();
    return;
  }

  try {
    const meters = calculateDistance(duration, pace);
    lastResult = meters;
    clearFieldError(timeError);
    clearFieldError(paceError);
    showWarning(isExtremeValue(meters, duration));
  } catch (err) {
    lastResult = null;
    showWarning(false);
    routeError(err, [['Duration', timeError], ['Pace', paceError]]);
  }

  renderResult();
}

function recalculate() {
  if (currentMode === 'pace') {
    recalculatePace();
  } else if (currentMode === 'time') {
    recalculateTime();
  } else {
    recalculateDistance();
  }
}

const debouncedRecalculate = debounce(recalculate, DEBOUNCE_MS);

function setMode(mode) {
  currentMode = mode;

  distanceFieldGroup.hidden = mode === 'distance';
  paceFieldGroup.hidden = mode === 'pace';
  timeFieldGroup.hidden = mode === 'time';

  resultLabel.textContent = mode === 'pace' ? 'Pace' : mode === 'time' ? 'Time' : 'Distance';

  lastResult = null;
  clearFieldError(distanceError);
  clearFieldError(timeError);
  clearFieldError(paceError);
  showWarning(false);

  recalculate();
}

solveForRadios.forEach((radio) => {
  radio.addEventListener('change', () => setMode(radio.value));
});

standardChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    standardChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', 'true');
    customChip.setAttribute('aria-pressed', 'false');
    customChip.setAttribute('aria-expanded', 'false');
    customField.hidden = true;
    clearFieldError(distanceError);

    isCustomDistance = false;
    distanceMeters = getChipDistanceMeters(chip);
    recalculate();
  });
});

customChip.addEventListener('click', () => {
  standardChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
  customChip.setAttribute('aria-pressed', 'true');
  customChip.setAttribute('aria-expanded', 'true');
  customField.hidden = false;

  isCustomDistance = true;
  distanceInput.focus();
  recalculate();
});

unitRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    currentUnit = document.querySelector('input[name="unit-system"]:checked').value;

    // Re-render from the (unchanged) full-precision shadows — never re-derive them
    // from the rounded displayed text. See file header for why this is safe.
    refreshDistanceDisplay();
    refreshPaceDisplay();

    updateUnitLabels();
    recalculate();
  });
});

distanceInput.addEventListener('input', () => {
  syncCustomDistanceFromInput();
  debouncedRecalculate();
});

[paceMinutesInput, paceSecondsInput].forEach((input) => {
  input.addEventListener('input', () => {
    syncPaceFromInput();
    debouncedRecalculate();
  });
});

[hoursInput, minutesInput, secondsInput].forEach((input) => {
  input.addEventListener('input', debouncedRecalculate);
});

form.addEventListener('submit', (e) => e.preventDefault());

updateUnitLabels();
setMode(currentMode);
