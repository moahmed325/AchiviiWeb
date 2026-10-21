import { describe, it, expect } from 'vitest';
import { resultNumber } from '../src/lib/weekClose/update.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Weekly update M3.1 review (fix 4): a logged result is read in the target's unit with the stated-target unit reading.

const minutes: WeekTarget = { kind: 'number', metric: 'Continuous run', value: 20, unit: 'minutes', direction: 'higher_is_better' };
const km: WeekTarget = { kind: 'number', metric: 'Weekly running distance', value: 12, unit: 'km', direction: 'higher_is_better' };

describe('resultNumber', () => {
  it('"min" is "minutes", either way round', () => {
    expect(resultNumber({ value: 18, unit: 'min', passed: false }, minutes)).toBe(18);
    expect(resultNumber({ value: '18', unit: 'minutes', passed: false }, { ...minutes, unit: 'min' })).toBe(18);
  });

  it('"kilometres" is "km"; no unit counts; another unit does not', () => {
    expect(resultNumber({ value: 11.5, unit: 'kilometres', passed: false }, km)).toBe(11.5);
    expect(resultNumber({ value: 11.5, passed: false }, km)).toBe(11.5);
    expect(resultNumber({ value: 7, unit: 'miles', passed: false }, km)).toBeNull();
    expect(resultNumber({ value: 'about 11', unit: 'km', passed: false }, km)).toBeNull();
  });
});
