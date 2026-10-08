import { describe, it, expect } from 'vitest';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';

describe('stated targets in the goal text', () => {
  it('reads a rate, a ceiling, and a count, including a number word', () => {
    expect(extractStatedTargets('Learn touch typing to 40 words per minute').map((item) => item.phrase)).toEqual([
      '40 words per minute',
    ]);
    expect(extractStatedTargets('Run a 10K in under 50 minutes')[0]).toMatchObject({
      value: 50,
      unit: 'minutes',
      bound: 'at_most',
      direction: 'lower_is_harder',
    });
    expect(extractStatedTargets('Learn 200 common Italian words')[0]).toMatchObject({ value: 200, unit: 'words' });
    expect(extractStatedTargets('Do 20 push-ups in a row')[0]).toMatchObject({ value: 20, unit: 'push-ups' });
    expect(extractStatedTargets('Play five songs on the piano')[0]).toMatchObject({ value: 5, unit: 'songs' });
    expect(extractStatedTargets('Learn to whistle with two fingers')).toEqual([]);
  });

  it('does not treat a race name or a plan length as the target', () => {
    expect(extractStatedTargets('Run a 10K')).toEqual([]);
    expect(extractStatedTargets('Build a 12 week meditation practice')).toEqual([]);
    expect(extractStatedTargets('Build a mindfulness meditation practice to reduce stress')).toEqual([]);
  });
});
