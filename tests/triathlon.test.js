// Section 19: formula, validation, and boundary tests for js/logic/triathlon.js.

import { calculateTotalTime, formatTime, TRIATHLON_STANDARD_DISTANCES } from '../js/logic/triathlon.js';

describe('TRIATHLON_STANDARD_DISTANCES', () => {
  test('has the 5 expected standard distances', () => {
    expect(TRIATHLON_STANDARD_DISTANCES).toHaveLength(5);
  });

  test('Olympic distance legs are correct', () => {
    const olympic = TRIATHLON_STANDARD_DISTANCES.find((d) => d.label === 'Olympic');
    expect(olympic.swimMeters).toBe(1500);
    expect(olympic.bikeMeters).toBe(40000);
    expect(olympic.runMeters).toBe(10000);
  });

  test('Full Distance run leg is a marathon (42195m)', () => {
    const full = TRIATHLON_STANDARD_DISTANCES.find((d) => d.label === 'Full Distance');
    expect(full.runMeters).toBe(42195);
  });
});

describe('calculateTotalTime — known real-world example (Olympic distance)', () => {
  // Swim 1500m in 22:00, T1 2:00, Bike 40K in 1:10:00, T2 1:30, Run 10K in 45:00.
  test('sums all legs and transitions to 2:20:30', () => {
    const total = calculateTotalTime({
      swimTime: 1320,
      t1Time: 120,
      bikeTime: 4200,
      t2Time: 90,
      runTime: 2700
    });
    expect(total).toBe(8430);
    expect(formatTime(total)).toBe('2:20:30');
  });

  test('accepts { hours, minutes, seconds } object form for legs, with omitted transitions defaulting to 0', () => {
    const total = calculateTotalTime({
      swimTime: { minutes: 22 },
      bikeTime: { hours: 1, minutes: 10 },
      runTime: { minutes: 45 }
    });
    expect(total).toBe(8220);
    expect(formatTime(total)).toBe('2:17:00');
  });

  test('T1/T2 may be exactly zero (a genuinely instant transition)', () => {
    const total = calculateTotalTime({
      swimTime: 1320,
      t1Time: 0,
      bikeTime: 4200,
      t2Time: 0,
      runTime: 2700
    });
    expect(total).toBe(8220);
  });
});

describe('validation — Section 13', () => {
  test('rejects zero swim time (a leg cannot take zero time)', () => {
    expect(() =>
      calculateTotalTime({ swimTime: 0, bikeTime: 4200, runTime: 2700 })
    ).toThrow('Swim time must be greater than zero');
  });

  test('rejects negative bike time', () => {
    expect(() =>
      calculateTotalTime({ swimTime: 1320, bikeTime: -4200, runTime: 2700 })
    ).toThrow('Bike time must be greater than zero');
  });

  test('rejects zero run time', () => {
    expect(() =>
      calculateTotalTime({ swimTime: 1320, bikeTime: 4200, runTime: 0 })
    ).toThrow('Run time must be greater than zero');
  });

  test('rejects negative T1 (transitions may be zero but not negative)', () => {
    expect(() =>
      calculateTotalTime({ swimTime: 1320, t1Time: -1, bikeTime: 4200, runTime: 2700 })
    ).toThrow('T1 must not be negative');
  });

  test('rejects negative T2', () => {
    expect(() =>
      calculateTotalTime({ swimTime: 1320, bikeTime: 4200, t2Time: -1, runTime: 2700 })
    ).toThrow('T2 must not be negative');
  });

  test('rejects impossible time format in a leg (seconds >= 60)', () => {
    expect(() =>
      calculateTotalTime({
        swimTime: { minutes: 22, seconds: 60 },
        bikeTime: 4200,
        runTime: 2700
      })
    ).toThrow('seconds must be between 0 and 59');
  });
});
