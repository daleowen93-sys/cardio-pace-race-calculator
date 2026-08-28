// DOM/interaction layer for the Cycling calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
// Mirrors running-ui.js's mode-aware pattern, adapted for speed instead of pace.
//
// Three Solve For modes are wired here:
//   Speed    — Distance + Time     -> Speed    (calculateSpeed)
//   Time     — Distance + Speed    -> Time     (calculateTime)
//   Distance — Time + Speed        -> Distance (calculateDistance)
//
// Section 12: unit conversion happens only at the input boundary and output boundary,
// and full-precision values are always used for further calculation — never a
// rounded display value. The Speed and custom Distance inputs are each backed by a
// full-precision "shadow" value (speedKmhFull / customDistanceMeters), stored in a
// canonical unit that never changes with the KM/MI toggle. The field's *displayed*
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
// Section 13: genuinely invalid values (zero/negative/malformed) surface as inline
// errors; simply-not-filled-in-yet inputs show the placeholder instead of an error.
// isExtremeValue() is checked after every successful calculation, in all three modes
// — using the actual (distance, duration) pair the scenario represents, regardless of
// which one was the solved-for output — and shown as a non-blocking soft warning.
// Section 18: results update live, debounced briefly after the last keystroke.
// Switching KM/MI re-renders unit-dependent fields from their full-precision shadow
// and recalculates immediately (synchronous, no perceptible delay). Switching Solve
// For tabs resets the result to the placeholder and immediately (non-debounced)
// recalculates from whatever the newly-visible fields already contain.

import {
  calculateSpeed,
  calculateTime,
  calculateDistance,
  formatSpeedKmh,
  formatSpeedMph,
  formatTime,
  formatDistanceKm,
  formatDistanceMiles,
  isExtremeValue,
  CYCLING_STANDARD_DISTANCES
} from '../logic/cycling.js';
import { kmToMeters, milesToMeters, metersToKm, metersToMiles } from '../logic/unitConversion.js';
import { prefersImperial } from './unitPreference.js';

const PLACEHOLDER = '–.–';
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

const speedFieldGroup = document.getElementById('speed-field-group');
const speedUnitHint = document.getElementById('speed-unit-hint');
const speedInput = document.getElementById('speed-input');
const speedUnitSuffix = document.getElementById('speed-unit-suffix');
const speedError = document.getElementById('speed-error');

const timeFieldGroup = document.getElementById('time-field-group');
const hoursInput = document.getElementById('time-hours');
const minutesInput = document.getElementById('time-minutes');
const secondsInput = document.getElementById('time-seconds');
const timeError = document.getElementById('time-error');

const resultLabel = document.querySelector('.result-label');
const heroResult = document.querySelector('.hero-result');
const resultSublabel = document.querySelector('.result-sublabel');
const extremeWarning = document.getElementById('extreme-warning');

function getChipDistanceMeters(chip) {
  const standard = CYCLING_STANDARD_DISTANCES.find((d) => d.label === chip.textContent.trim());
  return standard ? standard.meters : null;
}

const initiallySelectedChip = Array.from(standardChips).find((c) => c.getAttribute('aria-pressed') === 'true');

// Section 12: default unit is auto-detected from the browser locale, overriding
// the static HTML's metric default, before any state is read from the toggle.
if (prefersImperial()) {
  document.getElementById('unit-mi').checked = true;
}

function updateUnitLabels() {
  distanceUnitSuffix.textContent = currentUnit;
  speedUnitSuffix.textContent = currentUnit === 'km' ? 'km/h' : 'mph';
  speedUnitHint.textContent = currentUnit === 'km' ? '(km/h)' : '(mph)';
}

let currentUnit = document.querySelector('input[name="unit-system"]:checked').value;
let currentMode = document.querySelector('input[name="solve-for"]:checked').value;
let isCustomDistance = false;
let distanceMeters = initiallySelectedChip ? getChipDistanceMeters(initiallySelectedChip) : null;
let lastResult = null; // shape depends on currentMode: {kmh,mph} | seconds | meters

// Full-precision shadows for unit-dependent inputs, always in a canonical unit
// (metres / km/h) regardless of the current KM/MI toggle. null = untouched/invalid.
let customDistanceMeters = null;
let speedKmhFull = null;

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

// Same principle as syncCustomDistanceFromInput, for the Speed input.
function syncSpeedFromInput() {
  const raw = speedInput.value.trim();
  if (raw === '') {
    speedKmhFull = null;
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    speedKmhFull = null;
    return;
  }
  speedKmhFull = currentUnit === 'km' ? value : metersToKm(milesToMeters(value));
}

// Re-renders the custom distance field's displayed text (rounded to 2dp, Section 12)
// from its full-precision shadow, in the current unit. Never touches the shadow.
function refreshDistanceDisplay() {
  if (!isCustomDistance || customDistanceMeters === null) {
    return;
  }
  const value = currentUnit === 'km' ? metersToKm(customDistanceMeters) : metersToMiles(customDistanceMeters);
  distanceInput.value = value.toFixed(2);
}

// Same principle as refreshDistanceDisplay, for the Speed field (rounded to 1dp).
function refreshSpeedDisplay() {
  if (speedKmhFull === null) {
    return;
  }
  const value = currentUnit === 'km' ? speedKmhFull : metersToMiles(kmToMeters(speedKmhFull));
  speedInput.value = value.toFixed(1);
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

// Returns speed in km/h (cycling.js's canonical form), or null if untouched.
function readSpeedKmh() {
  return speedKmhFull;
}

function currentSublabel() {
  if (currentMode === 'speed') return currentUnit === 'km' ? 'km/h' : 'mph';
  if (currentMode === 'distance') return currentUnit === 'km' ? 'km' : 'mi';
  return '';
}

function renderResult() {
  if (lastResult === null) {
    heroResult.textContent = PLACEHOLDER;
  } else if (currentMode === 'speed') {
    heroResult.textContent = currentUnit === 'km' ? formatSpeedKmh(lastResult.kmh) : formatSpeedMph(lastResult.mph);
  } else if (currentMode === 'time') {
    heroResult.textContent = formatTime(lastResult);
  } else {
    heroResult.textContent = currentUnit === 'km' ? formatDistanceKm(lastResult) : formatDistanceMiles(lastResult);
  }
  resultSublabel.textContent = currentSublabel();
}

function recalculateSpeed() {
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
    lastResult = calculateSpeed(distance, duration);
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
  const distance = readDistanceMeters();
  const speed = readSpeedKmh();

  if (distance === null || speed === null) {
    lastResult = null;
    clearFieldError(distanceError);
    clearFieldError(speedError);
    showWarning(false);
    renderResult();
    return;
  }

  try {
    const seconds = calculateTime(distance, speed);
    lastResult = seconds;
    clearFieldError(distanceError);
    clearFieldError(speedError);
    showWarning(isExtremeValue(distance, seconds));
  } catch (err) {
    lastResult = null;
    showWarning(false);
    routeError(err, [['Distance', distanceError], ['Speed', speedError]]);
  }

  renderResult();
}

function recalculateDistance() {
  const duration = readDuration();
  const speed = readSpeedKmh();

  if (duration === null || speed === null) {
    lastResult = null;
    clearFieldError(timeError);
    clearFieldError(speedError);
    showWarning(false);
    renderResult();
    return;
  }

  try {
    const meters = calculateDistance(duration, speed);
    lastResult = meters;
    clearFieldError(timeError);
    clearFieldError(speedError);
    showWarning(isExtremeValue(meters, duration));
  } catch (err) {
    lastResult = null;
    showWarning(false);
    routeError(err, [['Duration', timeError], ['Speed', speedError]]);
  }

  renderResult();
}

function recalculate() {
  if (currentMode === 'speed') {
    recalculateSpeed();
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
  speedFieldGroup.hidden = mode === 'speed';
  timeFieldGroup.hidden = mode === 'time';

  resultLabel.textContent = mode === 'speed' ? 'Speed' : mode === 'time' ? 'Time' : 'Distance';

  lastResult = null;
  clearFieldError(distanceError);
  clearFieldError(timeError);
  clearFieldError(speedError);
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
    refreshSpeedDisplay();

    updateUnitLabels();
    recalculate();
  });
});

distanceInput.addEventListener('input', () => {
  syncCustomDistanceFromInput();
  debouncedRecalculate();
});

speedInput.addEventListener('input', () => {
  syncSpeedFromInput();
  debouncedRecalculate();
});

[hoursInput, minutesInput, secondsInput].forEach((input) => {
  input.addEventListener('input', debouncedRecalculate);
});

form.addEventListener('submit', (e) => e.preventDefault());

updateUnitLabels();
setMode(currentMode);
