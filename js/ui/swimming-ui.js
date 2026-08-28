// DOM/interaction layer for the Swimming calculator (Section 15/17: UI calls into
// the pure logic modules and only handles display, input capture, formatting).
// Mirrors running-ui.js's proven pattern, adapted for Swimming's pace-per-100m/
// 100yd/500m and its M/YD (metres/yards) unit toggle instead of KM/MI.
//
// Scope of this file for now: "Solve for Pace" mode only (Distance + Time -> Pace).
// The Time/Distance solve-for tabs are visually selectable but intentionally inert —
// wiring their behavior is a separate follow-up step.
//
// Section 12 / CLAUDE.md: the custom distance input is unit-dependent (its typed
// number means something different in M vs YD), so it's backed by a full-precision
// "shadow" value (customDistanceMeters) in canonical metres, exactly like Running/
// Cycling's custom distance and Cycling's Speed field:
//   - Typing re-derives the shadow from the freshly typed text (new source of truth).
//   - Toggling M/YD never touches the shadow — it only re-renders the displayed
//     text, rounded, in the new unit. Calculation always reads the shadow.
// Standard distance chips are immune to this entirely — their meters values are
// canonical already and never need reinterpretation.
//
// Section 13: genuinely invalid values (zero/negative/malformed) surface as inline
// errors; simply-not-filled-in-yet inputs show the placeholder instead of an error.
// Section 18: results update live, debounced briefly after the last keystroke;
// switching M/YD re-renders unit-dependent fields from their shadow and
// recalculates immediately (synchronous, no perceptible delay).
//
// Swimming-specific: the hero shows pace/100m (M) or pace/100yd (YD). A secondary
// pace/500m stat is shown alongside the hero only in metric (M) mode — per Section
// 12, pace/500m is a metric-only reading, with no imperial equivalent.

import { calculatePace, formatPacePer100m, formatPacePer100yd, formatPacePer500m, SWIMMING_STANDARD_DISTANCES } from '../logic/swimming.js';
import { yardsToMeters, metersToYards } from '../logic/unitConversion.js';

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
const resultSecondary = document.getElementById('result-secondary');
const resultSecondaryValue = resultSecondary.querySelector('.result-secondary-value');

function getChipDistanceMeters(chip) {
  const standard = SWIMMING_STANDARD_DISTANCES.find((d) => d.label === chip.textContent.trim());
  return standard ? standard.meters : null;
}

const initiallySelectedChip = Array.from(standardChips).find((c) => c.getAttribute('aria-pressed') === 'true');

let currentUnit = document.querySelector('input[name="unit-system"]:checked').value; // 'm' | 'yd'
let isCustomDistance = false;
let distanceMeters = initiallySelectedChip ? getChipDistanceMeters(initiallySelectedChip) : null;
let customDistanceMeters = null; // full-precision shadow, canonical metres, null = untouched
let lastPaceResult = null; // { secPer100m, secPer100yd, secPer500m } | null

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

function showSecondary(show) {
  resultSecondary.hidden = !show;
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

// Re-renders the custom distance field's displayed text (whole units, Section 12)
// from its full-precision shadow, in the current unit. Never touches the shadow.
function refreshDistanceDisplay() {
  if (!isCustomDistance || customDistanceMeters === null) {
    return;
  }
  const value = currentUnit === 'm' ? customDistanceMeters : metersToYards(customDistanceMeters);
  distanceInput.value = value.toFixed(0);
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

function renderResult() {
  if (!lastPaceResult) {
    heroResult.textContent = PLACEHOLDER;
    resultSublabel.textContent = currentUnit === 'm' ? 'min / 100m' : 'min / 100yd';
    showSecondary(false);
    return;
  }

  if (currentUnit === 'm') {
    heroResult.textContent = formatPacePer100m(lastPaceResult.secPer100m);
    resultSublabel.textContent = 'min / 100m';
    resultSecondaryValue.textContent = formatPacePer500m(lastPaceResult.secPer500m);
    showSecondary(true);
  } else {
    heroResult.textContent = formatPacePer100yd(lastPaceResult.secPer100yd);
    resultSublabel.textContent = 'min / 100yd';
    showSecondary(false);
  }
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

    // Re-render from the (unchanged) full-precision shadow — never re-derive it
    // from the rounded displayed text.
    refreshDistanceDisplay();
    distanceUnitSuffix.textContent = currentUnit;
    recalculate();
  });
});

distanceInput.addEventListener('input', () => {
  syncCustomDistanceFromInput();
  debouncedRecalculate();
});

[hoursInput, minutesInput, secondsInput].forEach((input) => {
  input.addEventListener('input', debouncedRecalculate);
});

form.addEventListener('submit', (e) => e.preventDefault());

recalculate();
