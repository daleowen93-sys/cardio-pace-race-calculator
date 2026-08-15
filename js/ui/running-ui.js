// DOM/interaction layer for the Running calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
//
// Three Solve For modes are wired here:
//   Pace     — Distance + Time     -> Pace     (calculatePace)
//   Time     — Distance + Pace     -> Time     (calculateTime)
//   Distance — Time + Pace         -> Distance (calculateDistance)
//
// Section 12: unit conversion happens only at the input boundary and output boundary,
// and full-precision values are always used for further calculation — never a
// rounded display value. The Pace and custom Distance inputs are each backed by a
// full-precision "shadow" value (paceSecPerKmFull / customDistanceMeters), stored in
// a canonical unit that never changes with the KM/MI toggle. The field's *displayed*
// text is only ever a rounded view of that shadow:
//   - Typing (an 'input' event) re-derives the shadow from the freshly typed text,
//     at whatever precision the user typed — that's the new source of truth.
//   - Toggling KM/MI does NOT touch the shadow (the real-world quantity hasn't
//     changed) — it only re-renders the displayed text, rounded, in the new unit.
// This is why setting .value programmatically during a toggle is safe: it doesn't
// fire an 'input' event, so it can't accidentally overwrite the shadow with a
// rounded value. All calculation reads the shadow, never the displayed text, so
// repeated toggling back and forth never loses precision or drifts a result.
//
// The Pace input is combined into a plain seconds-per-km number here in the UI
// layer (not passed as an { hours, minutes, seconds } object) because running.js's
// calculateTime/calculateDistance intentionally only accept pace as a plain number
// (Section 12: pace has no meaningful hours component) — so component-range
// validation (e.g. seconds 0-59) for the Pace input has to happen here, mirroring
// what running.js already does internally for the Duration object form. That
// validation runs at sync time (see syncPaceFromInput/paceSyncError below), not at
// read time, since the shadow itself can no longer throw.
//
// Section 13: genuinely invalid values (zero/negative/malformed) surface as inline
// errors; simply-not-filled-in-yet inputs show the placeholder instead of an error.
// Section 18: results update live, debounced briefly after the last keystroke.
// Switching KM/MI re-renders unit-dependent fields from their full-precision shadow
// and recalculates immediately (synchronous, no perceptible delay). Switching Solve
// For tabs resets the result to the placeholder and immediately (non-debounced)
// recalculates from whatever the newly-visible fields already contain.

import {
  calculatePace,
  calculateTime,
  calculateDistance,
  formatPaceMinPerKm,
  formatPaceMinPerMile,
  formatTime,
  formatDistanceKm,
  formatDistanceMiles,
  RUNNING_STANDARD_DISTANCES
} from '../logic/running.js';
import { kmToMeters, milesToMeters, metersToKm, metersToMiles } from '../logic/unitConversion.js';

const PLACEHOLDER = '–:––';
const DEBOUNCE_MS = 300;

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

function getChipDistanceMeters(chip) {
  const standard = RUNNING_STANDARD_DISTANCES.find((d) => d.label === chip.textContent.trim());
  return standard ? standard.meters : null;
}

const initiallySelectedChip = Array.from(standardChips).find((c) => c.getAttribute('aria-pressed') === 'true');

let currentUnit = document.querySelector('input[name="unit-system"]:checked').value;
let currentMode = document.querySelector('input[name="solve-for"]:checked').value;
let isCustomDistance = false;
let distanceMeters = initiallySelectedChip ? getChipDistanceMeters(initiallySelectedChip) : null;
let lastResult = null; // shape depends on currentMode: {secPerKm,secPerMile} | seconds | meters

// Full-precision shadows for unit-dependent inputs, always in a canonical unit
// (metres / seconds-per-km) regardless of the current KM/MI toggle. null = untouched.
let customDistanceMeters = null;
let paceSecPerKmFull = null;
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
// (sec/km or sec/mi, per currentUnit) — null if untouched, throws for genuinely
// malformed component values (Section 13: impossible time formats).
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
  customDistanceMeters = currentUnit === 'km' ? kmToMeters(value) : milesToMeters(value);
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
      paceSecPerKmFull = null;
      return;
    }
    paceSecPerKmFull = currentUnit === 'km' ? entered : entered * metersToMiles(1000);
  } catch (err) {
    paceSecPerKmFull = null;
    paceSyncError = err;
  }
}

// Re-renders the custom distance field's displayed text (rounded to 2dp, Section 12)
// from its full-precision shadow, in the current unit. Never touches the shadow.
function refreshDistanceDisplay() {
  if (!isCustomDistance || customDistanceMeters === null) {
    return;
  }
  const value = currentUnit === 'km'
    ? metersToKm(customDistanceMeters)
    : metersToMiles(customDistanceMeters);
  distanceInput.value = value.toFixed(2);
}

// Same principle as refreshDistanceDisplay, for the Pace fields (rounded to the
// nearest whole second, Section 12). paceSecPerKmFull is always seconds/km; this
// re-derives seconds/mile for display by dividing by the same factor
// readPaceSecPerKm multiplies by to go the other way.
function refreshPaceDisplay() {
  if (paceSecPerKmFull === null) {
    return;
  }
  const displaySeconds = currentUnit === 'km' ? paceSecPerKmFull : paceSecPerKmFull / metersToMiles(1000);
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
  if (currentMode === 'pace') return currentUnit === 'km' ? 'min / km' : 'min / mi';
  if (currentMode === 'distance') return currentUnit === 'km' ? 'km' : 'mi';
  return '';
}

function renderResult() {
  if (lastResult === null) {
    heroResult.textContent = PLACEHOLDER;
  } else if (currentMode === 'pace') {
    heroResult.textContent = currentUnit === 'km'
      ? formatPaceMinPerKm(lastResult.secPerKm)
      : formatPaceMinPerMile(lastResult.secPerMile);
  } else if (currentMode === 'time') {
    heroResult.textContent = formatTime(lastResult);
  } else {
    heroResult.textContent = currentUnit === 'km' ? formatDistanceKm(lastResult) : formatDistanceMiles(lastResult);
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
    renderResult();
    return;
  }

  try {
    lastResult = calculatePace(distance, duration);
    clearFieldError(distanceError);
    clearFieldError(timeError);
  } catch (err) {
    lastResult = null;
    routeError(err, [['Distance', distanceError], ['Duration', timeError]]);
  }

  renderResult();
}

function recalculateTime() {
  if (paceSyncError) {
    lastResult = null;
    routeError(paceSyncError, [['Distance', distanceError], ['Pace', paceError]]);
    renderResult();
    return;
  }

  const distance = readDistanceMeters();
  const pace = paceSecPerKmFull;

  if (distance === null || pace === null) {
    lastResult = null;
    clearFieldError(distanceError);
    clearFieldError(paceError);
    renderResult();
    return;
  }

  try {
    lastResult = calculateTime(distance, pace);
    clearFieldError(distanceError);
    clearFieldError(paceError);
  } catch (err) {
    lastResult = null;
    routeError(err, [['Distance', distanceError], ['Pace', paceError]]);
  }

  renderResult();
}

function recalculateDistance() {
  if (paceSyncError) {
    lastResult = null;
    routeError(paceSyncError, [['Duration', timeError], ['Pace', paceError]]);
    renderResult();
    return;
  }

  const duration = readDuration();
  const pace = paceSecPerKmFull;

  if (duration === null || pace === null) {
    lastResult = null;
    clearFieldError(timeError);
    clearFieldError(paceError);
    renderResult();
    return;
  }

  try {
    lastResult = calculateDistance(duration, pace);
    clearFieldError(timeError);
    clearFieldError(paceError);
  } catch (err) {
    lastResult = null;
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

    distanceUnitSuffix.textContent = currentUnit;
    paceUnitHint.textContent = currentUnit === 'km' ? '(min/km)' : '(min/mi)';
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

setMode(currentMode);
