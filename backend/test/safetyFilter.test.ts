import { describe, it, expect } from 'vitest';
import { screenQuery } from '../src/lib/research/safetyFilter.js';

describe('unsafe-goal screen', () => {
  it('blocks unsafe framings', () => {
    expect(screenQuery('lose 30 pounds in 2 weeks').blocked).toBe(true);
    expect(screenQuery('best 50x leverage crypto strategy').blocked).toBe(true);
    expect(screenQuery('SARMs cycle for cutting').blocked).toBe(true);
    expect(screenQuery('21 day water fast protocol').blocked).toBe(true);
  });

  it('leaves legitimate goals in the same topics alone', () => {
    // The filter must target unsafe framing, not the subject matter. Blocking these
    // would refuse the majority of real fitness and finance goals.
    expect(screenQuery('sustainable fat loss nutrition guidelines').blocked).toBe(false);
    expect(screenQuery('how to lose weight safely').blocked).toBe(false);
    expect(screenQuery('index fund investing for beginners').blocked).toBe(false);
    expect(screenQuery('intermittent fasting 16:8 evidence').blocked).toBe(false);
    expect(screenQuery('couch to 5k beginner running plan').blocked).toBe(false);
  });

  it('reports which category triggered the block', () => {
    const verdict = screenQuery('crash diet to drop weight fast');
    expect(verdict.blocked).toBe(true);
    expect(verdict.categories).toContain('crash_diet');
  });
});
