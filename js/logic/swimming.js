// Pure, DOM-free calculation functions for the Swimming calculator.
// Per PROJECT_BIBLE.md Section 15/17: calculator logic is separated from UI (no DOM code here).
// Per Section 12: canonical internal units are metres (distance) and seconds (duration).
// Swimming uses PACE (like Running) rather than speed, but expressed per 100m/100yd/500m
// rather than per km/mile (Section 4) — its imperial unit is YARDS, not miles.
// Full precision is used for all calculation; rounding happens only in the format* helpers below.
// Per Section 13: zero/negative values and impossible time formats are rejected with a clear
// error; Swimming has its own (lower) extreme-value threshold, exposed as a non-throwing
// soft-warning check rather than a validation error.
// Per Section 9: standard Swimming distances are exported below (Triathlon distances are
// defined separately in triathlon.js, not duplicated here).

import { metersToYards, yardsToMeters } from './unitConversion.js';

export const SWIMMING_STANDARD_DISTANCES = [
  { label: '400m', meters: 400 },
  { label: '800m', meters: 800 },
  { label: '1500m', meters: 1500 },
  { label: '5K', meters: 5000 },
  { label: '10K', meters: 10000 }
];

// Section 13: soft-warning thresholds (not blocked) — roughly 50 km or 24 hours,
// to accommodate legitimate marathon/channel swims.
const EXTREME_DISTANCE_METERS = 50 * 1000;
const EXTREME_DURATION_SECONDS = 24 * 3600;

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

// Pace is always a plain number of seconds per 100m (Section 12: canonical units) —
// like Running's pace and Cycling's speed, it has no meaningful { hours, minutes,
// seconds } form.
function toPaceSecPer100m(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Pace must be a finite number of seconds per 100m');
  }
  assertPositive(value, 'Pace');
  return value;
}

function roundHalfUp(value) {
  return Math.round(value);
}

function formatMinSec(totalSeconds, label) {
  assertPositive(totalSeconds, label);
  const rounded = roundHalfUp(totalSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// distanceMeters: number in metres.
// durationSeconds: number of seconds, or { hours, minutes, seconds }.
// Returns full-precision pace per 100m, per 100yd, and per 500m.
export function calculatePace(distanceMeters, durationSeconds) {
  assertPositive(distanceMeters, 'Distance');
  const totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  assertPositive(totalSeconds, 'Duration');

  const secPer100m = totalSeconds / (distanceMeters / 100);
  return {
    secPer100m,
    secPer100yd: totalSeconds / (metersToYards(distanceMeters) / 100),
    secPer500m: secPer100m * 5
  };
}

// distanceMeters: number in metres.
// paceSecPer100m: plain number of seconds per 100m.
// Returns full-precision total duration in seconds.
export function calculateTime(distanceMeters, paceSecPer100m) {
  assertPositive(distanceMeters, 'Distance');
  const pace = toPaceSecPer100m(paceSecPer100m);

  return pace * (distanceMeters / 100);
}

// durationSeconds: number of seconds, or { hours, minutes, seconds }.
// paceSecPer100m: plain number of seconds per 100m.
// Returns full-precision distance in metres.
export function calculateDistance(durationSeconds, paceSecPer100m) {
  const totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  assertPositive(totalSeconds, 'Duration');
  const pace = toPaceSecPer100m(paceSecPer100m);

  return (totalSeconds / pace) * 100;
}

// Section 13: soft warning (not a thrown error) for marathon/channel-scale inputs —
// roughly above 50 km or 24 hours. Invalid/incomplete inputs are treated as "not
// extreme" (false) rather than throwing, since this is an advisory check, not a validator.
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

// Formats a seconds/100m pace as "m:ss", rounded to the nearest whole second (Section 12).
export function formatPacePer100m(secPer100m) {
  return formatMinSec(secPer100m, 'Pace');
}

// Formats a seconds/100yd pace as "m:ss", rounded to the nearest whole second (Section 12).
export function formatPacePer100yd(secPer100yd) {
  return formatMinSec(secPer100yd, 'Pace');
}

// Formats a seconds/500m pace as "m:ss", rounded to the nearest whole second (Section 12).
export function formatPacePer500m(secPer500m) {
  return formatMinSec(secPer500m, 'Pace');
}

// Formats a distance in metres as whole metres, no decimal places (Section 12).
export function formatDistanceMeters(meters) {
  assertPositive(meters, 'Distance');
  return meters.toFixed(0);
}

// Formats a distance in metres as whole yards, no decimal places (Section 12).
export function formatDistanceYards(meters) {
  assertPositive(meters, 'Distance');
  return metersToYards(meters).toFixed(0);
}

// Formats a total duration as "h:mm:ss" (or "m:ss" under an hour), rounded to the
// nearest whole second (round-half-up) — same as Running/Cycling (Section 12).
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
