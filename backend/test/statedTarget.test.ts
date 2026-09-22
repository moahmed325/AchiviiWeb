import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { deriveVelocityTable } from '../src/lib/research/velocityTable.js';
import { extractStatedTargets } from '../src/lib/research/statedTarget.js';
import type { VelocityTable } from '../src/lib/research/types.js';

const mockLlm = generateStructuredContent as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockLlm.mockReset();
});

function practiceOnly(): VelocityTable {
  return {
    week1Targets: [{ metric: 'Daily practice time', value: 30, unit: 'minutes', direction: 'higher_is_harder' }],
    week12Targets: [{ metric: 'Daily practice time', value: 30, unit: 'minutes', direction: 'higher_is_harder' }],
    progressionFormula: 'Keep the same session length.',
    assumptions: 'A beginner.',
  };
}

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

  it('retries once when week 12 misses the named target, then keeps research rows and sets week 12', async () => {
    const prompts: string[] = [];
    mockLlm.mockImplementation(async (prompt: string) => {
      prompts.push(prompt);
      return {
        success: true,
        data: {
          hasNumericDimension: true,
          ...practiceOnly(),
        },
      };
    });

    const result = await deriveVelocityTable('Learn touch typing to 40 words per minute', null, []);

    expect(prompts).toHaveLength(2);
    expect(prompts[0]).toMatch(/40 words per minute/);
    expect(prompts[1]).toMatch(/previous answer was rejected/);
    expect(prompts[1]).toMatch(/user's target \(40 words per minute\)/);
    expect(result.failureReason).toBeUndefined();
    expect(result.table?.week12Targets.some((row) => row.value === 40 && /words per minute|wpm/i.test(`${row.metric} ${row.unit}`))).toBe(
      true
    );
    expect(result.table?.week12Targets.some((row) => row.metric === 'Daily practice time')).toBe(false);
  });

  it('keeps a progressing practice line and still writes the missing target', async () => {
    const progressing: VelocityTable = {
      week1Targets: [{ metric: 'Daily practice time', value: 15, unit: 'minutes', direction: 'higher_is_harder' }],
      week12Targets: [{ metric: 'Daily practice time', value: 30, unit: 'minutes', direction: 'higher_is_harder' }],
      progressionFormula: 'Add a few minutes each week.',
      assumptions: 'A beginner.',
    };
    mockLlm.mockResolvedValue({
      success: true,
      data: { hasNumericDimension: true, ...progressing },
    });

    const result = await deriveVelocityTable('Learn touch typing to 40 words per minute', null, []);

    const week12 = result.table?.week12Targets ?? [];
    expect(week12.some((row) => row.metric === 'Daily practice time' && row.value === 30)).toBe(true);
    expect(week12.some((row) => row.value === 40)).toBe(true);
  });
});
