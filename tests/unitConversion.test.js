// Section 19: unit-conversion tests for js/logic/unitConversion.js.

import {
  METERS_PER_KM,
  METERS_PER_MILE,
  METERS_PER_YARD,
  kmToMeters,
  metersToKm,
  milesToMeters,
  metersToMiles,
  yardsToMeters,
  metersToYards
} from '../js/logic/unitConversion.js';

describe('constants', () => {
  test('METERS_PER_KM is 1000', () => {
    expect(METERS_PER_KM).toBe(1000);
  });

  test('METERS_PER_MILE is the exact international mile', () => {
    expect(METERS_PER_MILE).toBe(1609.344);
  });

  test('METERS_PER_YARD is the exact international yard', () => {
    expect(METERS_PER_YARD).toBe(0.9144);
  });
});

describe('km <-> meters', () => {
  test('kmToMeters converts a 10K to 10000m', () => {
    expect(kmToMeters(10)).toBe(10000);
  });

  test('metersToKm converts 10000m to 10km', () => {
    expect(metersToKm(10000)).toBe(10);
  });

  test('round trip preserves value', () => {
    expect(metersToKm(kmToMeters(21.0975))).toBeCloseTo(21.0975, 10);
  });
});

describe('miles <-> meters', () => {
  test('milesToMeters converts 1 mile to 1609.344m exactly', () => {
    expect(milesToMeters(1)).toBe(1609.344);
  });

  test('metersToMiles converts a marathon (42195m) to ~26.2188 miles', () => {
    expect(metersToMiles(42195)).toBeCloseTo(26.218757456454306, 10);
  });

  test('round trip preserves value', () => {
    expect(metersToMiles(milesToMeters(13.1))).toBeCloseTo(13.1, 10);
  });
});

describe('yards <-> meters', () => {
  test('yardsToMeters converts 100 yards to 91.44m exactly', () => {
    expect(yardsToMeters(100)).toBeCloseTo(91.44, 10);
  });

  test('metersToYards converts a 1500m swim to ~1640.42 yards', () => {
    expect(metersToYards(1500)).toBeCloseTo(1640.4199475065616, 10);
  });

  test('round trip preserves value', () => {
    expect(metersToYards(yardsToMeters(1650))).toBeCloseTo(1650, 10);
  });
});
