import { describe, expect, it } from 'vitest';
import { goalSetProblems, loadGoals } from './goals.js';

describe('recovery eval goals (M2.2)', () => {
  it('has 26 custom goals, two per template, none a pathway or refused', () => {
    const goals = loadGoals();
    expect(goals).toHaveLength(26);
    expect(goalSetProblems(goals)).toEqual([]);
  });

  it('flags a goal that matches a pathway or is refused', () => {
    const [first] = loadGoals();
    const problems = goalSetProblems([
      { ...first, id: 'a', rawGoal: 'Learn to play guitar' },
      { ...first, id: 'b', rawGoal: 'Lose 10 kg in 2 weeks by starving myself' },
    ]);
    expect(problems.some((p) => p.startsWith('a: matches the pathway'))).toBe(true);
    expect(problems.some((p) => p.startsWith('b: refused'))).toBe(true);
  });
});
