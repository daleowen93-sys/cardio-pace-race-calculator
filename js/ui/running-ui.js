// DOM/interaction layer for the Running calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
//
// Three Solve For modes are wired here:
//   Pace     — Distance + Time     -> Pace     (calculatePace)
//   Time     — Distance + Pace     -> Time     (calculateTime)
//   Distance — Time + Pace         -> Distance (calculateDistance)
//
// Section 12: unit conversion happens only at the input boundary (custom distance
// entry, and the Pace input's min/sec value, both interpreted per the current
// KM/MI toggle) and the output boundary (formatting the result for display).
// The Pace input is combined into a plain seconds-per-km number here in the UI
// layer (not passed as an { hours, minutes, seconds } object) because running.js's
// calculateTime/calculateDistance intentionally only accept pace as a plain number
// (Section 12: pace has no meaningful hours component) — so component-range
// validation (e.g. seconds 0-59) for the Pace input has to happen here, mirroring
// what running.js already does internally for the Duration object form.
//
// Section 13: genuinely invalid values (zero/negative/malformed) surface as inline
// errors; simply-not-filled-in-yet inputs show the placeholder instead of an error.
// Section 18: results update live, debounced briefly after the last keystroke;
// switching KM/MI immediately re-displays the already-calculated result without
// recomputing. Switching Solve For tabs resets the result to the placeholder and
// immediately (non-debounced) recalculates from whatever the newly-visible fields
// already contain.

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
import { kmToMeters, milesToMeters, metersToMiles } from '../logic/unitConversion.js';

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

// Returns distance in metres, or null if the relevant input hasn't been filled in yet.
function readDistanceMeters() {
  if (!isCustomDistance) {
    return distanceMeters;
  }

  const raw = distanceInput.value.trim();
  if (raw === '') {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return null;
  }

  return currentUnit === 'km' ? kmToMeters(value) : milesToMeters(value);
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

// Returns pace in seconds/km (running.js's canonical form), or null if untouched.
// May throw (see combinePaceComponents).
function readPaceSecPerKm() {
  const entered = combinePaceComponents();
  if (entered === null) {
    return null;
  }
  return currentUnit === 'km' ? entered : entered * metersToMiles(1000);
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
  let pace;
  try {
    pace = readPaceSecPerKm();
  } catch (err) {
    lastResult = null;
    routeError(err, [['Distance', distanceError], ['Pace', paceError]]);
    renderResult();
    return;
  }

  const distance = readDistanceMeters();

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
  let pace;
  try {
    pace = readPaceSecPerKm();
  } catch (err) {
    lastResult = null;
    routeError(err, [['Duration', timeError], ['Pace', paceError]]);
    renderResult();
    return;
  }

  const duration = readDuration();

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
    distanceUnitSuffix.textContent = currentUnit;
    paceUnitHint.textContent = currentUnit === 'km' ? '(min/km)' : '(min/mi)';
    renderResult();
  });
});

[distanceInput, hoursInput, minutesInput, secondsInput, paceMinutesInput, paceSecondsInput].forEach((input) => {
  input.addEventListener('input', debouncedRecalculate);
});

form.addEventListener('submit', (e) => e.preventDefault());

setMode(currentMode);
