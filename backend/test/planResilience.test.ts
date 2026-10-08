import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { adaptUpcomingWeekTasksWithAI } from '../src/lib/ai/goalDecomposer.js';
import { parseModelJson } from '../src/lib/ai/modelJson.js';
import { spineTargetsForWeek } from '../src/lib/ai/spineFallbackPlan.js';
import {
  DEFAULT_GROQ_MODEL,
  GROQ_BACKUP_MODEL,
  groqModelsToTry,
  markGroqUnavailable,
  resetGroqAvailability,
} from '../src/lib/ai/groq.js';
import type { PlanGrounding } from '../src/lib/research/planGrounding.js';

const mockLlm = generateStructuredContent as unknown as ReturnType<typeof vi.fn>;

const grounding: PlanGrounding = {
  methodKind: 'shared_pattern',
  methodConfidence: 'medium_consensus',
  methodName: 'Home sourdough',
  sourceUrl: 'https://example.org/sourdough',
  teachings: [
    'Feed the starter until it doubles within 4 to 8 hours.',
    'Mix flour and water and rest for 30 minutes before adding salt.',
    'Do four sets of stretch and folds 30 minutes apart.',
    'Bake covered at 250 C for 20 minutes, then uncovered.',
  ],
  assumptions: 'a home baker with a standard oven',
  allowedUrls: ['https://example.org/sourdough', 'https://example.org/folds'],
  velocityTable: {
    week1Targets: [{ metric: 'loaves baked', value: 1, unit: 'loaves', direction: 'higher_is_harder' }],
    week12Targets: [{ metric: 'loaves baked', value: 12, unit: 'loaves', direction: 'higher_is_harder' }],
    progressionFormula: 'One more loaf each week.',
    assumptions: 'a home baker',
  },
};

const routine = { dailyMinutes: 30, preferredSlot: 'evening' as const, planVariant: 'steady' as const };
const GOAL = 'Bake a good loaf of sourdough bread at home';

const fail = { success: false, data: null, isFallback: true, provider: 'deterministic', error: 'Invalid JSON from model' };

describe('Plan writer never leaves the user with nothing', () => {
  beforeEach(() => {
    mockLlm.mockReset();
  });

  it('repairs the sourdough-style broken token instead of throwing', () => {
    const broken = '{"steps":[{"title":"Fold","instructions":ing}]}';
    const { data, repaired } = parseModelJson<{ steps: Array<{ title: string }> }>(broken);
    expect(repaired).toBe(true);
    expect(data.steps[0].title).toBe('Fold');
  });

  it('parses fenced JSON without calling it repaired', () => {
    const { data, repaired } = parseModelJson<{ ok: boolean }>('```json\n{"ok": true}\n```');
    expect(data.ok).toBe(true);
    expect(repaired).toBe(false);
  });

  it('builds a later week from the spine with continuing day numbers', async () => {
    mockLlm.mockResolvedValue(fail);
    const tasks = await adaptUpcomingWeekTasksWithAI(
      GOAL,
      2,
      'Foundation',
      'Keep going',
      90,
      '',
      routine,
      new Date('2026-10-12'),
      [],
      grounding
    );
    expect(tasks.map((task) => task.dayNumber)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(tasks[0].detailedSteps[0].instructions).toMatch(/loaves baked 2 loaves/);
  });

  it('interpolates targets without inventing new metrics', () => {
    expect(spineTargetsForWeek(grounding.velocityTable, 1)).toBe('loaves baked 1 loaves');
    expect(spineTargetsForWeek(grounding.velocityTable, 12)).toBe('loaves baked 12 loaves');
    expect(spineTargetsForWeek(null, 5)).toBe('');
  });
});

describe('Groq backup model', () => {
  beforeEach(() => resetGroqAvailability());

  it('moves to the backup model when the main one hits its daily limit', () => {
    expect(groqModelsToTry()).toEqual([DEFAULT_GROQ_MODEL, GROQ_BACKUP_MODEL]);
    markGroqUnavailable(60_000, DEFAULT_GROQ_MODEL);
    expect(groqModelsToTry()).toEqual([GROQ_BACKUP_MODEL]);
    markGroqUnavailable(60_000, GROQ_BACKUP_MODEL);
    expect(groqModelsToTry()).toEqual([]);
  });
});
