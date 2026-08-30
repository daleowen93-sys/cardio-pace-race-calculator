// Pure, DOM-free calculation functions for the Hyrox calculator.
// Per PROJECT_BIBLE.md Section 15/17: calculator logic is separated from UI (no DOM code here).
// Per Section 9: Hyrox is a fixed-structure race — 8x 1km runs alternating with 8
// fixed functional stations, always in the same order, ending on Wall Balls (no
// run after the final station). Unlike Running/Cycling/Swimming, none of the 16
// segments has a variable, user-chosen distance — each is just "time to
// complete", summed to a total finish time (same total-time-from-legs model as
// triathlon.js). Official station weights/rep counts differ by division
// (Open/Pro, Men/Women), but the weight doesn't change the time math — only the
// segment's time counts, so this module stays generic across divisions
// (confirmed: no division selector). Every segment is required and must be > 0
// — unlike Triathlon's T1/T2 transitions, there's no "optional" segment here;
// all 16 are real, completed parts of the race.
// Race distances are fixed international specs (metric-only, even at US
// events), so — unlike the other four calculators — there is no metric/imperial
// toggle for Hyrox at all.

export const HYROX_STATIONS = [
  { key: 'run1', label: 'Run 1', badge: '1km' },
  { key: 'skierg', label: 'SkiErg', badge: '1000m' },
  { key: 'run2', label: 'Run 2', badge: '1km' },
  { key: 'sledPush', label: 'Sled Push', badge: '50m' },
  { key: 'run3', label: 'Run 3', badge: '1km' },
  { key: 'sledPull', label: 'Sled Pull', badge: '50m' },
  { key: 'run4', label: 'Run 4', badge: '1km' },
  { key: 'burpeeBroadJumps', label: 'Burpee Broad Jumps', badge: '80m' },
  { key: 'run5', label: 'Run 5', badge: '1km' },
  { key: 'row', label: 'Row', badge: '1000m' },
  { key: 'run6', label: 'Run 6', badge: '1km' },
  { key: 'farmersCarry', label: 'Farmers Carry', badge: '200m' },
  { key: 'run7', label: 'Run 7', badge: '1km' },
  { key: 'sandbagLunges', label: 'Sandbag Lunges', badge: '100m' },
  { key: 'run8', label: 'Run 8', badge: '1km' },
  { key: 'wallBalls', label: 'Wall Balls', badge: '100 reps' }
];

// Section 13: soft-warning thresholds. Hyrox segments have fixed, non-user-chosen
// distances, so there's no pace to sanity-check against like the other
// calculators — instead this flags an implausible single-segment time (1 hour
// comfortably exceeds even a struggling beginner's slowest station) or an
// implausible total (6 hours comfortably exceeds even the slowest realistic
// full-race finish).
const EXTREME_SEGMENT_SECONDS = 60 * 60;
const EXTREME_TOTAL_SECONDS = 6 * 60 * 60;

// Accepts either a plain number of seconds, or a { minutes, seconds } object
// (no hours — no single Hyrox segment realistically runs past 59 minutes).
// Object form is validated strictly (Section 13: impossible time formats are rejected).
function toTotalSeconds(input, label) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new Error(`${label} must be a finite number of seconds`);
    }
    return input;
  }

  if (input && typeof input === 'object') {
    const { minutes = 0, seconds = 0 } = input;

    if (![minutes, seconds].every(Number.isFinite)) {
      throw new Error(`${label} minutes and seconds must both be numbers`);
    }
    if (minutes < 0) {
      throw new Error(`${label} minutes must not be negative`);
    }
    if (seconds < 0 || seconds >= 60) {
      throw new Error(`${label} seconds must be between 0 and 59`);
    }

    return minutes * 60 + seconds;
  }

  throw new Error(`${label} must be a number of seconds or a { minutes, seconds } object`);
}

function assertPositive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is required and must be a valid number`);
  }
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

function roundHalfUp(value) {
  return Math.round(value);
}

// segments: an object keyed by each HYROX_STATIONS[].key, each value a number of
// seconds or a { minutes, seconds } object. All 16 are required.
export function calculateTotalTime(segments) {
  let total = 0;
  for (const station of HYROX_STATIONS) {
    const seconds = toTotalSeconds(segments[station.key], station.label);
    assertPositive(seconds, station.label);
    total += seconds;
  }
  return total;
}

// segmentSecondsList: a plain array of each segment's total seconds (already
// resolved by the caller — see file header for why there's no distance/duration
// pair to check here instead).
export function isExtremeValue(segmentSecondsList, totalSeconds) {
  const totalExtreme = typeof totalSeconds === 'number'
    && Number.isFinite(totalSeconds)
    && totalSeconds > EXTREME_TOTAL_SECONDS;

  const segmentExtreme = segmentSecondsList.some(
    (seconds) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds > EXTREME_SEGMENT_SECONDS
  );

  return totalExtreme || segmentExtreme;
}

// Formats a total duration as "h:mm:ss" (or "m:ss" under an hour), rounded to
// the nearest whole second (round-half-up).
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
