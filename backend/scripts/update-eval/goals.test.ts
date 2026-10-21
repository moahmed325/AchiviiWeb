import { describe, expect, it } from 'vitest';
import { goalSetProblems, loadGoals } from './goals.js';

describe('update eval goals', () => {
  it('has every pathway once, two custom goals, and nothing refused', () => {
    expect(goalSetProblems(loadGoals())).toEqual([]);
  });

  it('flags a custom goal that matches a pathway', () => {
    const goals = loadGoals().map((goal) => (goal.id === 'portfolio' ? { ...goal, rawGoal: 'Learn guitar' } : goal));
    expect(goalSetProblems(goals)).toContain('portfolio: matches guitar5songs, expected none.');
  });
});
