// Section 19: formula, validation, rounding, and boundary tests for js/logic/swimming.js.

import {
  calculatePace,
  calculateTime,
  calculateDistance,
  isExtremeValue,
  formatPacePer100m,
  formatPacePer100yd,
  formatPacePer500m,
  formatDistanceMeters,
  formatDistanceYards,
  formatTime,
  SWIMMING_STANDARD_DISTANCES
} from '../js/logic/swimming.js';

describe('SWIMMING_STANDARD_DISTANCES', () => {
  test('has the 5 expected standard distances', () => {
    expect(SWIMMING_STANDARD_DISTANCES).toHaveLength(5);
  });

  test('1500m is present', () => {
    expect(SWIMMING_STANDARD_DISTANCES.find((d) => d.label === '1500m').meters).toBe(1500);
  });
});

describe('calculatePace — known real-world example (1500m swim in 18:00)', () => {
  const result = calculatePace(1500, { minutes: 18 });

  test('secPer100m is exactly 72 (1:12/100m)', () => {
    expect(result.secPer100m).toBe(72);
    expect(formatPacePer100m(result.secPer100m)).toBe('1:12');
  });

  test('secPer500m is exactly 360 (6:00/500m)', () => {
    expect(result.secPer500m).toBe(360);
    expect(formatPacePer500m(result.secPer500m)).toBe('6:00');
  });

  test('secPer100yd is correct and formats to 1:06/100yd', () => {
    expect(result.secPer100yd).toBeCloseTo(65.8368, 8);
    expect(formatPacePer100yd(result.secPer100yd)).toBe('1:06');
  });
});

describe('calculateTime / calculateDistance — inverse of calculatePace', () => {
  const distance = 1500;
  const durationSeconds = 1080;
  const pace = calculatePace(distance, durationSeconds).secPer100m;

  test('calculateTime reconstructs the original duration', () => {
    expect(calculateTime(distance, pace)).toBeCloseTo(durationSeconds, 6);
  });

  test('calculateDistance reconstructs the original distance', () => {
    expect(calculateDistance(durationSeconds, pace)).toBeCloseTo(distance, 6);
  });
});

describe('isExtremeValue — Section 13 soft-warning thresholds (50km / 24h)', () => {
  test('flags distance just over 50km', () => {
    expect(isExtremeValue(50001, 1)).toBe(true);
  });

  test('flags duration just over 24 hours', () => {
    expect(isExtremeValue(1, 86401)).toBe(true);
  });

  test('does not flag a normal 1500m swim', () => {
    expect(isExtremeValue(1500, 1080)).toBe(false);
  });

  test('does not flag exactly at the boundary (must be strictly greater than)', () => {
    expect(isExtremeValue(50 * 1000, 24 * 3600)).toBe(false);
  });
});

describe('formatDistanceMeters / formatDistanceYards', () => {
  test('formats 1500m as whole metres with no decimals', () => {
    expect(formatDistanceMeters(1500)).toBe('1500');
  });

  test('formats 1500m as ~1640 yards, whole number', () => {
    expect(formatDistanceYards(1500)).toBe('1640');
  });
});

describe('formatTime', () => {
  test('formats under an hour as m:ss', () => {
    expect(formatTime(1080)).toBe('18:00');
  });
});

describe('validation — Section 13', () => {
  test('rejects zero distance', () => {
    expect(() => calculatePace(0, 1080)).toThrow('Distance must be greater than zero');
  });

  test('rejects negative duration', () => {
    expect(() => calculatePace(1500, -100)).toThrow('Duration must be greater than zero');
  });

  test('rejects zero pace', () => {
    expect(() => calculateTime(1500, 0)).toThrow('Pace must be greater than zero');
  });

  test('rejects impossible time format (minutes > 59)', () => {
    expect(() => calculatePace(1500, { hours: 0, minutes: 60, seconds: 0 })).toThrow(
      'minutes must be between 0 and 59'
    );
  });
});
