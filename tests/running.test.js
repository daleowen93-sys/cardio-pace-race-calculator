// Section 19: formula, validation, rounding, and boundary tests for js/logic/running.js.

import {
  calculatePace,
  calculateTime,
  calculateDistance,
  formatPaceMinPerKm,
  formatPaceMinPerMile,
  formatDistanceKm,
  formatDistanceMiles,
  formatTime,
  isExtremeValue,
  RUNNING_STANDARD_DISTANCES
} from '../js/logic/running.js';

describe('RUNNING_STANDARD_DISTANCES', () => {
  test('has the 5 expected standard distances', () => {
    expect(RUNNING_STANDARD_DISTANCES).toHaveLength(5);
  });

  test('Marathon is 42195m', () => {
    const marathon = RUNNING_STANDARD_DISTANCES.find((d) => d.label === 'Marathon');
    expect(marathon.meters).toBe(42195);
  });

  test('Half Marathon is 21097.5m', () => {
    const half = RUNNING_STANDARD_DISTANCES.find((d) => d.label === 'Half Marathon');
    expect(half.meters).toBe(21097.5);
  });
});

describe('calculatePace — known real-world example (Half Marathon in 1:30:00)', () => {
  const result = calculatePace(21097.5, { hours: 1, minutes: 30, seconds: 0 });

  test('secPerKm is correct', () => {
    expect(result.secPerKm).toBeCloseTo(255.95449697831498, 8);
  });

  test('secPerMile is correct', () => {
    expect(result.secPerMile).toBeCloseTo(411.91883398506934, 8);
  });

  test('formats to 4:16 min/km', () => {
    expect(formatPaceMinPerKm(result.secPerKm)).toBe('4:16');
  });

  test('formats to 6:52 min/mile', () => {
    expect(formatPaceMinPerMile(result.secPerMile)).toBe('6:52');
  });
});

describe('calculatePace — plain-number duration (5K in 20:00)', () => {
  test('secPerKm is exactly 240 (4:00/km)', () => {
    const result = calculatePace(5000, 1200);
    expect(result.secPerKm).toBe(240);
    expect(formatPaceMinPerKm(result.secPerKm)).toBe('4:00');
  });
});

describe('calculateTime / calculateDistance — inverse of calculatePace', () => {
  const distance = 21097.5;
  const durationSeconds = 5400;
  const pace = calculatePace(distance, durationSeconds).secPerKm;

  test('calculateTime reconstructs the original duration', () => {
    expect(calculateTime(distance, pace)).toBeCloseTo(durationSeconds, 6);
  });

  test('calculateDistance reconstructs the original distance', () => {
    expect(calculateDistance(durationSeconds, pace)).toBeCloseTo(distance, 6);
  });
});

describe('formatDistanceKm / formatDistanceMiles', () => {
  test('formats 10000m as 10.00 km', () => {
    expect(formatDistanceKm(10000)).toBe('10.00');
  });

  test('formats a marathon as 26.22 miles', () => {
    expect(formatDistanceMiles(42195)).toBe('26.22');
  });
});

describe('formatTime', () => {
  test('formats under an hour as m:ss', () => {
    expect(formatTime(1200)).toBe('20:00');
  });

  test('formats an hour or more as h:mm:ss', () => {
    expect(formatTime(5400)).toBe('1:30:00');
  });

  test('rounds half-up to the nearest whole second', () => {
    expect(formatTime(90.5)).toBe('1:31');
    expect(formatTime(90.4)).toBe('1:30');
  });
});

describe('validation — Section 13', () => {
  test('rejects zero distance', () => {
    expect(() => calculatePace(0, 1200)).toThrow('Distance must be greater than zero');
  });

  test('rejects negative distance', () => {
    expect(() => calculatePace(-5000, 1200)).toThrow('Distance must be greater than zero');
  });

  test('rejects zero duration', () => {
    expect(() => calculatePace(5000, 0)).toThrow('Duration must be greater than zero');
  });

  test('rejects negative pace', () => {
    expect(() => calculateTime(5000, -240)).toThrow();
  });

  test('rejects duration minutes > 59', () => {
    expect(() => calculatePace(5000, { hours: 0, minutes: 60, seconds: 0 })).toThrow(
      'minutes must be between 0 and 59'
    );
  });

  test('rejects duration seconds >= 60 (impossible time format)', () => {
    expect(() => calculatePace(5000, { hours: 0, minutes: 0, seconds: 60 })).toThrow(
      'seconds must be between 0 and 59'
    );
  });

  test('rejects negative duration hours', () => {
    expect(() => calculatePace(5000, { hours: -1, minutes: 0, seconds: 0 })).toThrow(
      'hours must not be negative'
    );
  });

  test('accepts a duration object with omitted fields (defaults to 0)', () => {
    const result = calculatePace(5000, { minutes: 20 });
    expect(result.secPerKm).toBe(240);
  });
});

describe('isExtremeValue — Section 13 soft-warning thresholds (500km / 48h)', () => {
  test('flags distance just over 500km', () => {
    expect(isExtremeValue(500001, 1)).toBe(true);
  });

  test('flags duration just over 48h', () => {
    expect(isExtremeValue(1, 48 * 3600 + 1)).toBe(true);
  });

  test('does not flag a marathon in elite time', () => {
    expect(isExtremeValue(42195, 7200)).toBe(false);
  });

  test('does not flag exactly at the thresholds', () => {
    expect(isExtremeValue(500 * 1000, 48 * 3600)).toBe(false);
  });

  test('accepts a duration object, not just plain seconds', () => {
    expect(isExtremeValue(42195, { hours: 2 })).toBe(false);
    expect(isExtremeValue(42195, { hours: 49 })).toBe(true);
  });
});
