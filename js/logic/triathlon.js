// Pure, DOM-free calculation functions for the Triathlon calculator.
// Per PROJECT_BIBLE.md Section 15/17: calculator logic is separated from UI (no DOM code here).
// Per Section 18: Triathlon has NO Pace/Time/Distance solve-for toggle — it always
// takes distance (standard or custom, per leg — see TRIATHLON_STANDARD_DISTANCES)
// and time (or transition time) per leg as direct inputs, and always outputs total
// finish time. There is no "solve backward" mode in v1, so this module doesn't
// compute pace/speed/time from distance the way running.js/cycling.js/swimming.js
// do — a future UI can still show informational per-leg pace/speed by importing
// calculatePace/calculateSpeed directly from those modules; that's not this
// module's job (Section 15/17: no duplicated cross-cutting logic between modules).
// Per Section 12: Total finish time = swim time + T1 + bike time + T2 + run time,
// rounded to the nearest whole second, displayed h:mm:ss.
// Per Section 13: swim/bike/run leg times must be > 0 (a leg can't take zero time);
// T1/T2 transition times may be zero (a blank field defaults to zero at the UI
// boundary; this module defaults an omitted transition to zero too) but not negative.

export const TRIATHLON_STANDARD_DISTANCES = [
  { label: 'Sprint', swimMeters: 750, bikeMeters: 20000, runMeters: 5000 },
  { label: 'Olympic', swimMeters: 1500, bikeMeters: 40000, runMeters: 10000 },
  { label: 'T100', swimMeters: 2000, bikeMeters: 80000, runMeters: 18000 },
  { label: 'Half Distance', swimMeters: 1900, bikeMeters: 90000, runMeters: 21097.5 },
  { label: 'Full Distance', swimMeters: 3800, bikeMeters: 180000, runMeters: 42195 }
];

// Accepts either a plain number of seconds, or a { hours, minutes, seconds } object.
// Object form is validated strictly (Section 13: impossible time formats are rejected).
function toTotalSeconds(input, label) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`${label} must be a finite number of seconds`);
    }
    return input;
  }

  if (input && typeof input === 'object') {
    const { hours = 0, minutes = 0, seconds = 0 } = input;

    if (![hours, minutes, seconds].every(Number.isFinite)) {
      throw new Error(`${label} hours, minutes, and seconds must all be numbers`);
    }
    if (hours < 0) {
      throw new Error(`${label} hours must not be negative`);
    }
    if (minutes < 0 || minutes > 59) {
      throw new Error(`${label} minutes must be between 0 and 59`);
    }
    if (seconds < 0 || seconds >= 60) {
      throw new Error(`${label} seconds must be between 0 and 59`);
    }

    return hours * 3600 + minutes * 60 + seconds;
  }

  throw new Error(`${label} must be a number of seconds or an { hours, minutes, seconds } object`);
}

function assertPositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is required and must be a valid number`);
  }
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function assertNonNegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is required and must be a valid number`);
  }
  if (value < 0) {
    throw new Error(`${label} must not be negative`);
  }
}

function roundHalfUp(value) {
  return Math.round(value);
}

// swimTime, bikeTime, runTime: number of seconds, or { hours, minutes, seconds } —
// required, must resolve to a positive duration (a leg can't take zero time).
// t1Time, t2Time: same accepted forms, but optional (default to 0 — a blank
// transition field per Section 13) and may be zero, just not negative.
// Returns full-precision total finish time in seconds.
export function calculateTotalTime({ swimTime, t1Time = 0, bikeTime, t2Time = 0, runTime }) {
  const swimSeconds = toTotalSeconds(swimTime, 'Swim time');
  assertPositive(swimSeconds, 'Swim time');

  const t1Seconds = toTotalSeconds(t1Time, 'T1');
  assertNonNegative(t1Seconds, 'T1');

  const bikeSeconds = toTotalSeconds(bikeTime, 'Bike time');
  assertPositive(bikeSeconds, 'Bike time');

  const t2Seconds = toTotalSeconds(t2Time, 'T2');
  assertNonNegative(t2Seconds, 'T2');

  const runSeconds = toTotalSeconds(runTime, 'Run time');
  assertPositive(runSeconds, 'Run time');

  return swimSeconds + t1Seconds + bikeSeconds + t2Seconds + runSeconds;
}

// Formats a total duration as "h:mm:ss" (or "m:ss" under an hour), rounded to the
// nearest whole second (round-half-up) — same as Running/Cycling/Swimming (Section 12).
export function formatTime(totalSeconds) {
  assertPositive(totalSeconds, 'Duration');
  const rounded = roundHalfUp(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
