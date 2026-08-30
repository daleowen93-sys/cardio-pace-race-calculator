// DOM/interaction layer for the Hyrox calculator (Section 15/17: UI calls into
// the pure logic module and only handles display, input capture, formatting).
//
// Unlike Running/Cycling/Swimming/Triathlon, Hyrox has no unit toggle (race
// distances are fixed international metric specs, even at US events) and no
// distance-selector chips (the 16-segment structure never varies) — every
// segment is just a plain minutes/seconds "time to complete" input, summed to a
// total finish time (same total-time-from-legs model as triathlon-ui.js).
//
// The 8 running legs share ONE Time/Pace toggle (not one each) — Section 18:
// in practice every run split comes from the same source in one sitting (a
// watch giving times, or a training plan giving target paces), so a per-run
// toggle would just be 8x the UI for a mode nobody actually mixes. Unlike
// Triathlon's runs, this needs no unit conversion or calculatePace/
// calculateTime round-trip through running.js: every Hyrox run is exactly
// 1km, so "time for this run" and "pace per km" are the same number — the
// toggle only changes which input is live and which is shown as a read-only
// echo underneath; both read the same { minutes, seconds } shape into the
// calculation. The 8 stations have no natural pace concept and keep their
// original plain time-only input.
//
// Section 13: all 16 segments are required (blank on both a segment's active
// m/s fields means "incomplete", not invalid — placeholder shown, no error);
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
const runsModeRadios = document.querySelectorAll('input[name="runs-mode"]');

// 'sledPush' -> 'sled-push' — camelCase station keys map to kebab-case HTML ids,
// matching this project's existing id conventions.
function toKebabId(key) {
  return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}

let runsMode = 'time';

const segments = HYROX_STATIONS.map((station) => {
  const id = toKebabId(station.key);
  const isRun = station.key.startsWith('run');

  const base = {
    key: station.key,
    label: station.label,
    isRun,
    minutesInput: document.getElementById(`${id}-minutes`),
    secondsInput: document.getElementById(`${id}-seconds`),
    errorEl: document.getElementById(`${id}-error`)
  };

  if (!isRun) {
    return base;
  }

  return {
    ...base,
    timeFields: document.getElementById(`${id}-time-fields`),
    paceFields: document.getElementById(`${id}-pace-fields`),
    paceMinutesInput: document.getElementById(`${id}-pace-minutes`),
    paceSecondsInput: document.getElementById(`${id}-pace-seconds`),
    paceReadout: document.getElementById(`${id}-pace-readout`),
    paceValue: document.getElementById(`${id}-pace-value`),
    timeReadout: document.getElementById(`${id}-time-readout`),
    timeValue: document.getElementById(`${id}-time-value`)
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

// Returns a { minutes, seconds } object, or null if both of the segment's
// currently-active fields are blank (Section 13: "incomplete", not invalid).
// In Pace mode, a run reads its pace fields instead of its time fields — same
// shape either way, since a 1km run's pace and time are the same number.
function readSegmentDuration(segment) {
  const usesPaceFields = segment.isRun && runsMode === 'pace';
  const minutesInput = usesPaceFields ? segment.paceMinutesInput : segment.minutesInput;
  const secondsInput = usesPaceFields ? segment.paceSecondsInput : segment.secondsInput;

  const minutesRaw = minutesInput.value.trim();
  const secondsRaw = secondsInput.value.trim();

  if (minutesRaw === '' && secondsRaw === '') {
    return null;
  }

  return {
    minutes: minutesRaw === '' ? 0 : Number(minutesRaw),
    seconds: secondsRaw === '' ? 0 : Number(secondsRaw)
  };
}

// Shows this run's OTHER metric underneath — Pace when in Time mode, Time when
// in Pace mode — using the same resolved duration (no conversion needed, see
// file header). Hidden when incomplete or not yet a valid positive duration.
function renderRunReadout(run, duration) {
  const readoutEl = runsMode === 'time' ? run.paceReadout : run.timeReadout;
  const valueEl = runsMode === 'time' ? run.paceValue : run.timeValue;
  const otherReadoutEl = runsMode === 'time' ? run.timeReadout : run.paceReadout;
  otherReadoutEl.hidden = true;

  if (duration === null) {
    readoutEl.hidden = true;
    return;
  }
  const seconds = duration.minutes * 60 + duration.seconds;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    readoutEl.hidden = true;
    return;
  }
  const formatted = formatTime(seconds);
  valueEl.textContent = runsMode === 'time' ? `${formatted} /km` : formatted;
  readoutEl.hidden = false;
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
    if (segment.isRun) {
      renderRunReadout(segment, duration);
    }
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
      if (failedSegment.isRun) {
        renderRunReadout(failedSegment, null);
      }
    }
  }
}

const debouncedRecalculate = debounce(recalculate, DEBOUNCE_MS);

function setRunsMode(mode) {
  runsMode = mode;
  segments.forEach((segment) => {
    if (!segment.isRun) {
      return;
    }
    segment.timeFields.hidden = mode === 'pace';
    segment.paceFields.hidden = mode === 'time';
    clearFieldError(segment.errorEl);
  });
  recalculate();
}

runsModeRadios.forEach((radio) => {
  radio.addEventListener('change', () => setRunsMode(radio.value));
});

segments.forEach((segment) => {
  const inputs = segment.isRun
    ? [segment.minutesInput, segment.secondsInput, segment.paceMinutesInput, segment.paceSecondsInput]
    : [segment.minutesInput, segment.secondsInput];
  inputs.forEach((input) => input.addEventListener('input', debouncedRecalculate));
});

form.addEventListener('submit', (e) => e.preventDefault());

recalculate();
