import { describe, expect, it } from 'vitest';
import { loadGoals, readJson } from './goals.js';
import type { EvalCase } from './cases.js';

const cases = readJson<EvalCase[]>('cases.json');

describe('update eval cases', () => {
  it('has 24 cases with unique ids, a known goal, a why and a week 1 to 11', () => {
    const goals = new Set(loadGoals().map((goal) => goal.id));
    expect(cases).toHaveLength(24);
    expect(new Set(cases.map((c) => c.id)).size).toBe(24);
    for (const c of cases) {
      expect(goals.has(c.goalId), c.id).toBe(true);
      expect(c.why.trim(), c.id).not.toBe('');
      expect(c.week >= 1 && c.week <= 11, c.id).toBe(true);
    }
  });

  it('gives at most 3 history weeks, all before the closing week', () => {
    for (const c of cases) {
      expect(c.history.length, c.id).toBeLessThanOrEqual(3);
      expect(c.history.every((week) => week.week < c.week), c.id).toBe(true);
    }
  });

  it('covers every goal and has a first week with no history and two far_behind weeks in one history', () => {
    expect(new Set(cases.map((c) => c.goalId)).size).toBe(loadGoals().length);
    expect(cases.some((c) => c.week === 1 && c.history.length === 0)).toBe(true);
    expect(cases.some((c) => c.history.filter((week) => week.status === 'far_behind').length >= 2)).toBe(true);
  });
});
