// DOM/interaction layer for the Running calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
//
// Scope of this file for now: "Solve for Pace" mode only (Distance + Time -> Pace).
// The Time/Distance solve-for tabs are visually selectable but intentionally inert —
// wiring their behavior is a separate follow-up step.
//
// Section 12: unit conversion happens only at the input boundary (custom distance
// entry, here) and the output boundary (formatting the result for display).
// Section 13: genuinely invalid values (zero/negative/malformed) surface as inline
// errors; simply-not-filled-in-yet inputs show the placeholder instead of an error.
// Section 18: results update live, debounced briefly after the last keystroke;
// switching KM/MI immediately re-displays the already-calculated result.

import { calculatePace, formatPaceMinPerKm, formatPaceMinPerMile, RUNNING_STANDARD_DISTANCES } from '../logic/running.js';
import { kmToMeters, milesToMeters } from '../logic/unitConversion.js';

const PLACEHOLDER = '–:––';
const DEBOUNCE_MS = 300;

const form = document.querySelector('.calculator');
const unitRadios = document.querySelectorAll('input[name="unit-system"]');
const standardChips = document.querySelectorAll('.chip[data-distance-meters]');
const customChip = document.getElementById('chip-custom');
const customField = document.getElementById('custom-distance-field');
const distanceInput = document.getElementById('distance-input');
const distanceUnitSuffix = customField.querySelector('.input-unit-suffix');
const distanceError = document.getElementById('distance-error');
const hoursInput = document.getElementById('time-hours');
const minutesInput = document.getElementById('time-minutes');
const secondsInput = document.getElementById('time-seconds');
const timeError = document.getElementById('time-error');
const heroResult = document.querySelector('.hero-result');
const resultSublabel = document.querySelector('.result-sublabel');

function getChipDistanceMeters(chip) {
  const standard = RUNNING_STANDARD_DISTANCES.find((d) => d.label === chip.textContent.trim());
  return standard ? standard.meters : null;
}

const initiallySelectedChip = Array.from(standardChips).find((c) => c.getAttribute('aria-pressed') === 'true');

let currentUnit = document.querySelector('input[name="unit-system"]:checked').value;
let isCustomDistance = false;
let distanceMeters = initiallySelectedChip ? getChipDistanceMeters(initiallySelectedChip) : null;
let lastPaceResult = null;

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

function renderResult() {
  if (!lastPaceResult) {
    heroResult.textContent = PLACEHOLDER;
  } else if (currentUnit === 'km') {
    heroResult.textContent = formatPaceMinPerKm(lastPaceResult.secPerKm);
  } else {
    heroResult.textContent = formatPaceMinPerMile(lastPaceResult.secPerMile);
  }
  resultSublabel.textContent = currentUnit === 'km' ? 'min / km' : 'min / mi';
}

function recalculate() {
  const distance = readDistanceMeters();
  const duration = readDuration();

  if (distance === null || duration === null) {
    lastPaceResult = null;
    clearFieldError(distanceError);
    clearFieldError(timeError);
    renderResult();
    return;
  }

  try {
    lastPaceResult = calculatePace(distance, duration);
    clearFieldError(distanceError);
    clearFieldError(timeError);
  } catch (err) {
    lastPaceResult = null;
    if (err.message.startsWith('Distance')) {
      showFieldError(distanceError, err.message);
      clearFieldError(timeError);
    } else {
      showFieldError(timeError, err.message);
      clearFieldError(distanceError);
    }
  }

  renderResult();
}

const debouncedRecalculate = debounce(recalculate, DEBOUNCE_MS);

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
    renderResult();
  });
});

[distanceInput, hoursInput, minutesInput, secondsInput].forEach((input) => {
  input.addEventListener('input', debouncedRecalculate);
});

form.addEventListener('submit', (e) => e.preventDefault());

recalculate();
