import { describe, expect, it } from 'vitest';
import { readRoutine, routineRecord, startingPointValue } from '../src/lib/planV2.js';

// B-103: stored JSON is read in one place per field, and checked field by field.

describe('routineRecord and readRoutine', () => {
  it('reads a stored routine and keeps unknown fields in the record', () => {
    const goal = { routine: JSON.stringify({ dailyMinutes: 45, planVariant: 'accelerated', sleepTime: '22:30', extra: 1 }) };
    expect(routineRecord(goal)).toMatchObject({ extra: 1 });
    expect(readRoutine(goal)).toEqual({ dailyMinutes: 45, planVariant: 'accelerated', sleepTime: '22:30' });
  });

  it('falls back to the defaults for missing, broken or wrongly typed fields', () => {
    expect(readRoutine({ routine: '' })).toEqual({ dailyMinutes: 30, planVariant: 'steady' });
    expect(readRoutine({ routine: 'not json' })).toEqual({ dailyMinutes: 30, planVariant: 'steady' });
    expect(routineRecord({ routine: '[1,2]' })).toEqual({});
    expect(readRoutine({ routine: JSON.stringify({ planVariant: 'turbo', sleepTime: 2300, preferredSlot: '' }) })).toEqual({ dailyMinutes: 30, planVariant: 'steady' });
  });
});

describe('startingPointValue', () => {
  it('is the number, or null', () => {
    expect(startingPointValue({ roadmap: { startingPoint: { value: 5 } } })).toBe(5);
    expect(startingPointValue({ roadmap: { startingPoint: { value: 'five' } } })).toBeNull();
    expect(startingPointValue({ roadmap: null })).toBeNull();
  });
});
