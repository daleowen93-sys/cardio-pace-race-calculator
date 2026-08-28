// Section 19: formula, validation, rounding, and boundary tests for js/logic/cycling.js.

import {
  calculateSpeed,
  calculateTime,
  calculateDistance,
  isExtremeValue,
  formatSpeedKmh,
  formatSpeedMph,
  formatDistanceKm,
  formatDistanceMiles,
  formatTime,
  CYCLING_STANDARD_DISTANCES
} from '../js/logic/cycling.js';

describe('CYCLING_STANDARD_DISTANCES', () => {
  test('has the 3 expected standard distances', () => {
    expect(CYCLING_STANDARD_DISTANCES).toHaveLength(3);
  });

  test('Century is 160934.4m (100 miles)', () => {
    const century = CYCLING_STANDARD_DISTANCES.find((d) => d.label === 'Century');
    expect(century.meters).toBe(160934.4);
  });
});

describe('calculateSpeed — known real-world example (40K Time Trial in 1:00:00)', () => {
  const result = calculateSpeed(40000, { hours: 1, minutes: 0, seconds: 0 });

  test('kmh is exactly 40', () => {
    expect(result.kmh).toBe(40);
  });

  test('mph is correct', () => {
    expect(result.mph).toBeCloseTo(24.854847689493358, 8);
  });

  test('formats to 40.0 km/h', () => {
    expect(formatSpeedKmh(result.kmh)).toBe('40.0');
  });

  test('formats to 24.9 mph', () => {
    expect(formatSpeedMph(result.mph)).toBe('24.9');
  });
});

describe('calculateTime / calculateDistance — inverse of calculateSpeed', () => {
  const distance = 40000;
  const durationSeconds = 3600;
  const speedKmh = calculateSpeed(distance, durationSeconds).kmh;

  test('calculateTime reconstructs the original duration', () => {
    expect(calculateTime(distance, speedKmh)).toBeCloseTo(durationSeconds, 6);
  });

  test('calculateDistance reconstructs the original distance', () => {
    expect(calculateDistance(durationSeconds, speedKmh)).toBeCloseTo(distance, 6);
  });
});

describe('isExtremeValue — Section 13 soft-warning thresholds (2000km / 100h)', () => {
  test('flags distance just over 2000km', () => {
    expect(isExtremeValue(2000001, 1)).toBe(true);
  });

  test('flags duration just over 100 hours', () => {
    expect(isExtremeValue(1, 360001)).toBe(true);
  });

  test('does not flag a normal 40K time trial', () => {
    expect(isExtremeValue(40000, 3600)).toBe(false);
  });

  test('does not flag exactly at the boundary (must be strictly greater than)', () => {
    expect(isExtremeValue(2000 * 1000, 100 * 3600)).toBe(false);
  });

  test('treats malformed duration as not-extreme rather than throwing', () => {
    expect(isExtremeValue(40000, { minutes: 90 })).toBe(false);
  });
});

describe('formatDistanceKm / formatDistanceMiles', () => {
  test('formats a Metric Century as 100.00 km', () => {
    expect(formatDistanceKm(100000)).toBe('100.00');
  });

  test('formats a Century as 100.00 miles', () => {
    expect(formatDistanceMiles(160934.4)).toBe('100.00');
  });
});

describe('formatTime', () => {
  test('formats under an hour as m:ss', () => {
    expect(formatTime(1800)).toBe('30:00');
  });

  test('formats an hour or more as h:mm:ss', () => {
    expect(formatTime(3600)).toBe('1:00:00');
  });
});

describe('validation — Section 13', () => {
  test('rejects zero distance', () => {
    expect(() => calculateSpeed(0, 3600)).toThrow('Distance must be greater than zero');
  });

  test('rejects negative duration components via object form', () => {
    expect(() => calculateSpeed(40000, { hours: 0, minutes: -5, seconds: 0 })).toThrow();
  });

  test('rejects zero speed', () => {
    expect(() => calculateTime(40000, 0)).toThrow('Speed must be greater than zero');
  });

  test('rejects negative speed', () => {
    expect(() => calculateDistance(3600, -10)).toThrow('Speed must be greater than zero');
  });

  test('rejects impossible time format (seconds >= 60)', () => {
    expect(() => calculateSpeed(40000, { hours: 0, minutes: 0, seconds: 61 })).toThrow(
      'seconds must be between 0 and 59'
    );
  });
});
