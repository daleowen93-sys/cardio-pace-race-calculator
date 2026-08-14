// Pure, DOM-free calculation functions for the Cycling calculator.
// Per PROJECT_BIBLE.md Section 15/17: calculator logic is separated from UI (no DOM code here).
// Per Section 12: canonical internal units are metres (distance) and seconds (duration).
// Cycling uses SPEED (km/h, mph) rather than pace — the key difference from running.js.
// Full precision is used for all calculation; rounding happens only in the format* helpers below.
// Per Section 13: zero/negative values and impossible time formats are rejected with a clear
// error; Cycling additionally has its own (higher) extreme-value threshold, exposed as a
// non-throwing soft-warning check rather than a validation error.
// Per Section 9: standard Cycling race distances are exported below.

import { metersToKm, metersToMiles, kmToMeters } from './unitConversion.js';

export const CYCLING_STANDARD_DISTANCES = [
  { label: '40K Time Trial', meters: 40000 },
  { label: 'Metric Century', meters: 100000 },
  { label: 'Century', meters: 160934.4 }
];

// Section 13: soft-warning thresholds (not blocked) — roughly 2,000 km or 100 hours,
// to accommodate legitimate ultra-distance cycling events.
const EXTREME_DISTANCE_METERS = 2000 * 1000;
const EXTREME_DURATION_SECONDS = 100 * 3600;

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

// Speed is always a plain number of km/h (Section 12: canonical units) —
// like Running's pace, it has no meaningful { hours, minutes, seconds } form.
function toSpeedKmh(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Speed must be a finite number of km/h');
  }
  assertPositive(value, 'Speed');
  return value;
}

function roundHalfUp(value) {
  return Math.round(value);
}

// distanceMeters: number in metres.
// durationSeconds: number of seconds, or { hours, minutes, seconds }.
// Returns full-precision speed in both km/h and mph.
export function calculateSpeed(distanceMeters, durationSeconds) {
  assertPositive(distanceMeters, 'Distance');
  const totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  assertPositive(totalSeconds, 'Duration');

  const hours = totalSeconds / 3600;
  return {
    kmh: metersToKm(distanceMeters) / hours,
    mph: metersToMiles(distanceMeters) / hours
  };
}

// distanceMeters: number in metres.
// speedKmh: plain number of km/h.
// Returns full-precision total duration in seconds.
export function calculateTime(distanceMeters, speedKmh) {
  assertPositive(distanceMeters, 'Distance');
  const speed = toSpeedKmh(speedKmh);

  const hours = metersToKm(distanceMeters) / speed;
  return hours * 3600;
}

// durationSeconds: number of seconds, or { hours, minutes, seconds }.
// speedKmh: plain number of km/h.
// Returns full-precision distance in metres.
export function calculateDistance(durationSeconds, speedKmh) {
  const totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  assertPositive(totalSeconds, 'Duration');
  const speed = toSpeedKmh(speedKmh);

  const hours = totalSeconds / 3600;
  return kmToMeters(speed * hours);
}

// Section 13: soft warning (not a thrown error) for ultra-distance inputs — roughly
// above 2,000 km or 100 hours. Invalid/incomplete inputs are treated as "not extreme"
// (false) rather than throwing, since this is an advisory check, not a validator.
export function isExtremeValue(distanceMeters, durationSeconds) {
  const distanceExtreme = typeof distanceMeters === 'number'
    && Number.isFinite(distanceMeters)
    && distanceMeters > EXTREME_DISTANCE_METERS;

  let totalSeconds = null;
  try {
    totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  } catch {
    totalSeconds = null;
  }
  const durationExtreme = typeof totalSeconds === 'number'
    && Number.isFinite(totalSeconds)
    && totalSeconds > EXTREME_DURATION_SECONDS;

  return distanceExtreme || durationExtreme;
}

// Formats speed in km/h, rounded to 1 decimal place (Section 12).
export function formatSpeedKmh(kmh) {
  assertPositive(kmh, 'Speed');
  return kmh.toFixed(1);
}

// Formats speed in mph, rounded to 1 decimal place (Section 12).
export function formatSpeedMph(mph) {
  assertPositive(mph, 'Speed');
  return mph.toFixed(1);
}

// Formats a distance in metres as kilometres, rounded to 2 decimal places (Section 12).
export function formatDistanceKm(meters) {
  assertPositive(meters, 'Distance');
  return metersToKm(meters).toFixed(2);
}

// Formats a distance in metres as miles, rounded to 2 decimal places (Section 12).
export function formatDistanceMiles(meters) {
  assertPositive(meters, 'Distance');
  return metersToMiles(meters).toFixed(2);
}

// Formats a total duration as "h:mm:ss" (or "m:ss" under an hour), rounded to the
// nearest whole second (round-half-up) — same as Running (Section 12).
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
