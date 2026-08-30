// Section 19: formula, validation, rounding, and boundary tests for js/logic/hyrox.js.

import { calculateTotalTime, isExtremeValue, formatTime, HYROX_STATIONS } from '../js/logic/hyrox.js';

describe('HYROX_STATIONS', () => {
  test('has the 16 expected segments in official race order', () => {
    expect(HYROX_STATIONS).toHaveLength(16);
    expect(HYROX_STATIONS.map((s) => s.label)).toEqual([
      'Run 1', 'SkiErg', 'Run 2', 'Sled Push', 'Run 3', 'Sled Pull', 'Run 4', 'Burpee Broad Jumps',
      'Run 5', 'Row', 'Run 6', 'Farmers Carry', 'Run 7', 'Sandbag Lunges', 'Run 8', 'Wall Balls'
    ]);
  });

  test('ends on Wall Balls with no run after it', () => {
    expect(HYROX_STATIONS[HYROX_STATIONS.length - 1].label).toBe('Wall Balls');
  });
});

// Real-world example: a clean, evenly-paced finish — 8 runs at 5:00 each (40:00
// total running) and 8 stations at 3:00 each (24:00 total) — a plausible
// recreational Hyrox finish time.
describe('calculateTotalTime — known example (8x 5:00 runs + 8x 3:00 stations)', () => {
  const segments = {};
  for (const station of HYROX_STATIONS) {
    segments[station.key] = station.label.startsWith('Run') ? { minutes: 5, seconds: 0 } : { minutes: 3, seconds: 0 };
  }

  test('totals exactly 1:04:00', () => {
    expect(calculateTotalTime(segments)).toBe(64 * 60);
    expect(formatTime(calculateTotalTime(segments))).toBe('1:04:00');
  });
});

describe('calculateTotalTime — accepts plain-number seconds alongside { minutes, seconds } objects', () => {
  test('mixed input forms sum correctly', () => {
    const segments = {};
    for (const station of HYROX_STATIONS) {
      segments[station.key] = 60; // 1 minute each, as a plain number
    }
    expect(calculateTotalTime(segments)).toBe(16 * 60);
  });
});

describe('formatTime', () => {
  test('formats under an hour as m:ss', () => {
    expect(formatTime(1200)).toBe('20:00');
  });

  test('formats an hour or more as h:mm:ss', () => {
    expect(formatTime(64 * 60)).toBe('1:04:00');
  });

  test('rounds half-up to the nearest whole second', () => {
    expect(formatTime(90.5)).toBe('1:31');
    expect(formatTime(90.4)).toBe('1:30');
  });
});

describe('validation — Section 13', () => {
  const validSegments = {};
  for (const station of HYROX_STATIONS) {
    validSegments[station.key] = { minutes: 3, seconds: 0 };
  }

  test('rejects a missing segment', () => {
    const segments = { ...validSegments };
    delete segments.wallBalls;
    expect(() => calculateTotalTime(segments)).toThrow('Wall Balls');
  });

  test('rejects a zero-duration segment', () => {
    const segments = { ...validSegments, sledPush: { minutes: 0, seconds: 0 } };
    expect(() => calculateTotalTime(segments)).toThrow('Sled Push must be greater than zero');
  });

  test('rejects a negative-duration segment', () => {
    const segments = { ...validSegments, row: -30 };
    expect(() => calculateTotalTime(segments)).toThrow('Row must be greater than zero');
  });

  test('rejects seconds >= 60 (impossible time format)', () => {
    const segments = { ...validSegments, run1: { minutes: 5, seconds: 60 } };
    expect(() => calculateTotalTime(segments)).toThrow('Run 1 seconds must be between 0 and 59');
  });

  test('rejects negative minutes', () => {
    const segments = { ...validSegments, run1: { minutes: -1, seconds: 0 } };
    expect(() => calculateTotalTime(segments)).toThrow('Run 1 minutes must not be negative');
  });
});

describe('isExtremeValue — Section 13 soft-warning thresholds (1h/segment, 6h total)', () => {
  test('flags a single segment just over 1 hour', () => {
    expect(isExtremeValue([3601, 60, 60], 3721)).toBe(true);
  });

  test('flags a total just over 6 hours', () => {
    const segments = new Array(16).fill(1351); // 16 * 1351 = 21616s = 6h00m16s
    expect(isExtremeValue(segments, 21616)).toBe(true);
  });

  test('does not flag a normal recreational finish', () => {
    const segments = [
      300, 300, 300, 300, 300, 300, 300, 300, // 8 runs at 5:00
      180, 180, 180, 180, 180, 180, 180, 180 // 8 stations at 3:00
    ];
    expect(isExtremeValue(segments, 3840)).toBe(false);
  });

  test('does not flag exactly at the thresholds', () => {
    expect(isExtremeValue([3600], 3600)).toBe(false);
  });
});
