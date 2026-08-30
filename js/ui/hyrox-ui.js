// DOM/interaction layer for the Hyrox calculator (Section 15/17: UI calls into
// the pure logic module and only handles display, input capture, formatting).
//
// Unlike Running/Cycling/Swimming/Triathlon, Hyrox has no unit toggle (race
// distances are fixed international metric specs, even at US events) and no
// distance-selector chips (the 16-segment structure never varies) — every
// segment is just a plain minutes/seconds "time to complete" input, summed to a
// total finish time (same total-time-from-legs model as triathlon-ui.js).
//
// All 16 segments are homogeneous in shape (unlike Triathlon's legs, which mix
// h/m/s legs, m/s transitions, and pace/speed inputs), so this file drives its
// DOM lookups and event wiring directly from HYROX_STATIONS rather than
// duplicating 16 near-identical blocks — the logic module's own toTotalSeconds
// validation (missing/malformed components, negative values, seconds >= 59)
// covers everything a segment needs without UI-level pre-validation.
//
// Section 13: all 16 segments are required (blank on both a segment's m/s
// fields means "incomplete", not invalid — placeholder shown, no error);
// genuinely invalid values (zero/negative, malformed time components) surface
// as an inline error under that segment, via the same label-prefix routing the
// other calculators use. isExtremeValue() is checked after every successful
// calculation, using each segment's own resolved seconds plus the total, and
// shown as a non-blocking soft warning (Section 13).
// Section 18: results update live, debounced briefly after the last keystroke.

import { calculateTotalTime, isExtremeValue, formatTime, HYROX_STATIONS } from '../logic/hyrox.js';

const PLACEHOLDER = '–:––:––';
const DEBOUNCE_MS = 300;
const EXTREME_WARNING_MESSAGE = "That's an extreme time — double check your inputs.";

const form = document.querySelector('.calculator');
const heroResult = document.querySelector('.hero-result');
const extremeWarning = document.getElementById('extreme-warning');

// 'sledPush' -> 'sled-push' — camelCase station keys map to kebab-case HTML ids,
// matching this project's existing id conventions.
function toKebabId(key) {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

const segments = HYROX_STATIONS.map((station) => {
  const id = toKebabId(station.key);
  return {
    key: station.key,
    label: station.label,
    minutesInput: document.getElementById(`${id}-minutes`),
    secondsInput: document.getElementById(`${id}-seconds`),
    errorEl: document.getElementById(`${id}-error`)
  };
});

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

// Returns a { minutes, seconds } object, or null if both fields are blank
// (Section 13: "incomplete", not invalid).
function readSegmentDuration(segment) {
  const minutesRaw = segment.minutesInput.value.trim();
  const secondsRaw = segment.secondsInput.value.trim();

  if (minutesRaw === '' && secondsRaw === '') {
    return null;
  }

  return {
    minutes: minutesRaw === '' ? 0 : Number(minutesRaw),
    seconds: secondsRaw === '' ? 0 : Number(secondsRaw)
  };
}

function renderResult(totalSeconds) {
  heroResult.textContent = totalSeconds === null ? PLACEHOLDER : formatTime(totalSeconds);
}

function recalculate() {
  const durations = {};
  let hasIncomplete = false;

  segments.forEach((segment) => {
    const duration = readSegmentDuration(segment);
    durations[segment.key] = duration;
    if (duration === null) {
      hasIncomplete = true;
    }
    clearFieldError(segment.errorEl);
  });

  if (hasIncomplete) {
    renderResult(null);
    showWarning(false);
    return;
  }

  try {
    const total = calculateTotalTime(durations);
    const segmentSeconds = segments.map((segment) => {
      const d = durations[segment.key];
      return d.minutes * 60 + d.seconds;
    });
    showWarning(isExtremeValue(segmentSeconds, total));
    renderResult(total);
  } catch (err) {
    renderResult(null);
    showWarning(false);
    const failedSegment = segments.find((segment) => err.message.startsWith(segment.label));
    if (failedSegment) {
      showFieldError(failedSegment.errorEl, err.message);
    }
  }
}

const debouncedRecalculate = debounce(recalculate, DEBOUNCE_MS);

segments.forEach((segment) => {
  [segment.minutesInput, segment.secondsInput].forEach((input) => {
    input.addEventListener('input', debouncedRecalculate);
  });
});

form.addEventListener('submit', (e) => e.preventDefault());

recalculate();
