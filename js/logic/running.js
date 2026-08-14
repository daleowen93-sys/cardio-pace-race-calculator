// Pure, DOM-free calculation functions for the Running calculator.
// Per PROJECT_BIBLE.md Section 15/17: calculator logic is separated from UI (no DOM code here).
// Per Section 12: canonical internal units are metres (distance) and seconds (duration).
// Full precision is used for all calculation; rounding happens only in the format* helpers below.
// Per Section 13: zero/negative values and impossible time formats are rejected with a clear error.
// Per Section 9: standard Running race distances are exported below.

import { metersToKm, metersToMiles, kmToMeters } from './unitConversion.js';

export const RUNNING_STANDARD_DISTANCES = [
  { label: '1 Mile', meters: 1609.344 },
  { label: '5K', meters: 5000 },
  { label: '10K', meters: 10000 },
  { label: 'Half Marathon', meters: 21097.5 },
  { label: 'Marathon', meters: 42195 }
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

// Pace is always a plain number of seconds/km (Section 12: canonical units) —
// unlike duration, it has no meaningful { hours, minutes, seconds } form.
function toPaceSeconds(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Pace must be a finite number of seconds per km');
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
// Returns full-precision pace in both seconds/km and seconds/mile.
export function calculatePace(distanceMeters, durationSeconds) {
  assertPositive(distanceMeters, 'Distance');
  const totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  assertPositive(totalSeconds, 'Duration');

  return {
    secPerKm: totalSeconds / metersToKm(distanceMeters),
    secPerMile: totalSeconds / metersToMiles(distanceMeters)
  };
}

// distanceMeters: number in metres.
// paceSecPerKm: plain number of seconds/km.
// Returns full-precision total duration in seconds.
export function calculateTime(distanceMeters, paceSecPerKm) {
  assertPositive(distanceMeters, 'Distance');
  const pace = toPaceSeconds(paceSecPerKm);

  return pace * metersToKm(distanceMeters);
}

// durationSeconds: number of seconds, or { hours, minutes, seconds }.
// paceSecPerKm: plain number of seconds/km.
// Returns full-precision distance in metres.
export function calculateDistance(durationSeconds, paceSecPerKm) {
  const totalSeconds = toTotalSeconds(durationSeconds, 'Duration');
  assertPositive(totalSeconds, 'Duration');
  const pace = toPaceSeconds(paceSecPerKm);

  return kmToMeters(totalSeconds / pace);
}

// Formats a seconds/km pace as "m:ss", rounded to the nearest whole second (round-half-up).
export function formatPaceMinPerKm(secPerKm) {
  return formatMinSec(secPerKm, 'Pace');
}

// Formats a seconds/mile pace as "m:ss", rounded to the nearest whole second (round-half-up).
export function formatPaceMinPerMile(secPerMile) {
  return formatMinSec(secPerMile, 'Pace');
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
// nearest whole second (round-half-up).
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
