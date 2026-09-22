import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { generate12WeekPlanWithAI, adaptUpcomingWeekTasksWithAI } from '../src/lib/ai/goalDecomposer.js';
import { parseModelJson } from '../src/lib/ai/modelJson.js';
import { spineTargetsForWeek } from '../src/lib/ai/spineFallbackPlan.js';
import { PLAN_RESPONSE_SCHEMA } from '../src/lib/ai/planSchema.js';
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

function validPlan() {
  const step = {
    stepNumber: 1,
    title: 'Feed starter',
    durationMinutes: 30,
    instructions: 'Feed it.',
    focusCue: 'Watch the rise.',
    pitfallToAvoid: 'Cold kitchen.',
    layer: 'adherence',
    layerReasoning: 'Home bakers do this.',
  };
  return {
    clarifiedOutcome: GOAL,
    methodologyNotes: 'Notes.',
    weeks: Array.from({ length: 12 }, (_, i) => ({
      weekNumber: i + 1,
      phase: i < 4 ? 'Foundation' : i < 8 ? 'Acceleration' : 'Mastery',
      theme: 't',
      objective: 'o',
      keyMilestone: 'm',
      targetIntensity: 70,
      plannedMinutes: 30,
    })),
    initialTasks: Array.from({ length: 7 }, (_, i) => ({
      dayNumber: i + 1,
      dayOfWeek: 'Monday',
      title: 'Day',
      isRestDay: false,
      durationMinutes: 30,
      slotTime: '19:30',
      implementationIntention: 'When: 19:30 | Where: kitchen | Action: bake',
      detailedSteps: [step],
    })),
  };
}

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

  it('sends the plan schema to the model', async () => {
    mockLlm.mockResolvedValueOnce({ success: true, data: validPlan(), isFallback: false, provider: 'gemini' });
    await generate12WeekPlanWithAI(GOAL, GOAL, {}, routine, new Date('2026-10-05'), { grounding });
    expect(mockLlm.mock.calls[0][3]).toMatchObject({ responseSchema: PLAN_RESPONSE_SCHEMA, temperature: 0 });
  });

  it('retries once with the rejection reason and keeps the model plan', async () => {
    const short = validPlan();
    short.weeks = short.weeks.slice(0, 11);
    mockLlm
      .mockResolvedValueOnce({ success: true, data: short, isFallback: false, provider: 'gemini' })
      .mockResolvedValueOnce({ success: true, data: validPlan(), isFallback: false, provider: 'gemini' });

    const plan = await generate12WeekPlanWithAI(GOAL, GOAL, {}, routine, new Date('2026-10-05'), { grounding });

    expect(mockLlm).toHaveBeenCalledTimes(2);
    expect(mockLlm.mock.calls[1][0]).toMatch(/PREVIOUS ANSWER WAS REJECTED: "weeks" must have exactly 12 entries, got 11/);
    expect(mockLlm.mock.calls[1][3].temperature).toBeGreaterThan(0);
    expect(plan.planSource).toBe('ai');
  });

  it('builds a sourced plan from the spine when both attempts fail', async () => {
    mockLlm.mockResolvedValue(fail);

    const plan = await generate12WeekPlanWithAI(GOAL, GOAL, {}, routine, new Date('2026-10-05'), { grounding });

    expect(plan.planSource).toBe('spine_fallback');
    expect(plan.weeks).toHaveLength(12);
    expect(plan.weeks[3].keyMilestone).toMatch(/Phase 1 Foundation Milestone Gate/);
    expect(plan.weeks[11].objective).toMatch(/loaves baked 12 loaves/);
    expect(plan.initialTasks).toHaveLength(7);

    const rest = plan.initialTasks.map((task) => task.isRestDay);
    expect(rest.filter(Boolean)).toHaveLength(2);
    for (let i = 1; i < rest.length; i++) expect(rest[i] && rest[i - 1]).toBe(false);

    const active = plan.initialTasks.filter((task) => !task.isRestDay);
    for (const task of active) {
      expect(task.detailedSteps.reduce((sum, step) => sum + step.durationMinutes, 0)).toBe(30);
      for (const step of task.detailedSteps) {
        expect(grounding.teachings.some((teaching) => step.instructions.startsWith(teaching))).toBe(true);
        if (step.resourceUrl) expect(grounding.allowedUrls).toContain(step.resourceUrl);
      }
    }
    expect(plan.methodologyNotes).not.toMatch(/Anchored/);
  });

  it('still fails honestly with no preset and no spine', async () => {
    mockLlm.mockResolvedValue(fail);
    await expect(
      generate12WeekPlanWithAI('Invent a hobby nobody has', 'Invent a hobby nobody has', {}, routine, new Date('2026-10-05'))
    ).rejects.toThrow(/Unable to generate/);
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
