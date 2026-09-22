import { describe, it, expect } from 'vitest';
import {
  blockLibraryFailures,
  blocksForWeek,
  blockWeekFailures,
  cleanBlocks,
  enforceBlocks,
  matchBlock,
  type WorkBlock,
} from '../src/lib/method/blocks.js';
import { buildSpineWeekTasks } from '../src/lib/ai/spineFallbackPlan.js';
import { taskQualityFailures } from '../src/lib/ai/taskRules.js';
import type { DailyTaskPlan, DetailedStep } from '../src/lib/ai/goalDecomposer.js';

const block = (
  name: string,
  stage: WorkBlock['stage'],
  impact: number,
  kind: WorkBlock['kind'],
  realThing = false
): WorkBlock => ({
  name,
  kind,
  action: `Do ${name.toLowerCase()} exactly as the method describes, at today's level.`,
  output: `A finished round of ${name.toLowerCase()}`,
  doneWhen: 'Checked against the reference and it matches',
  realThing,
  stage,
  impact,
  cue: 'One thing at a time.',
  pitfall: 'Rushing the check.',
});

/** Sourdough: making, comparing, and the real thing is a whole loaf. */
const SOURDOUGH = [
  block('Feed the starter and mark the jar', 'foundation', 4, 'make'),
  block('Float test the starter', 'foundation', 3, 'make'),
  block('Mix and autolyse one dough', 'foundation', 5, 'make'),
  block('Four sets of stretch and folds', 'foundation', 4, 'make'),
  block('Bake one test loaf', 'foundation', 5, 'make', true),
  block('Photograph and compare the crumb', 'foundation', 4, 'solve'),
  block('Shape a tight boule', 'build', 4, 'motor_skill'),
  block('Bake a loaf with a higher hydration', 'peak', 5, 'make', true),
];

function step(title: string, durationMinutes: number): DetailedStep {
  return {
    stepNumber: 1,
    title,
    durationMinutes,
    instructions: `Do ${title} carefully and completely.`,
    output: 'Done',
    focusCue: 'x',
    pitfallToAvoid: 'y',
    passMark: 'Checked and correct',
  };
}

function practiceDay(dayNumber: number, steps: DetailedStep[]): DailyTaskPlan {
  return {
    dayNumber,
    dayOfWeek: 'Monday',
    title: 'Bread day',
    isRestDay: false,
    durationMinutes: steps.reduce((sum, s) => sum + s.durationMinutes, 0),
    slotTime: '19:00',
    implementationIntention: 'When: 19:00',
    detailedSteps: steps,
  };
}

describe('work block library', () => {
  it('drops warm-ups and blocks with no output or proof, and ranks by impact', () => {
    const cleaned = cleanBlocks([
      ...SOURDOUGH,
      block('Warm-up stretches', 'foundation', 5, 'train_body'),
      { ...block('Think about bread', 'foundation', 4, 'make'), output: '' },
    ]);
    const names = cleaned.map((item) => item.name);
    expect(names).not.toContain('Warm-up stretches');
    expect(names).not.toContain('Think about bread');
    expect(cleaned[0].impact).toBe(5);
  });

  it('demands a real thing and more than one kind of work', () => {
    const noReal = SOURDOUGH.map((item) => ({ ...item, realThing: false, kind: 'make' as const }));
    const failures = blockLibraryFailures(noReal, ['make', 'solve']).join(' ');
    expect(failures).toMatch(/realThing/);
    expect(failures).toMatch(/more than one/);
    expect(blockLibraryFailures(SOURDOUGH, ['make', 'solve'])).toEqual([]);
  });

  it('puts the current stage first', () => {
    expect(blocksForWeek(SOURDOUGH, 1)[0].stage).toBe('foundation');
    expect(blocksForWeek(SOURDOUGH, 10)[0].name).toBe('Bake a loaf with a higher hydration');
  });

  it('matches steps that name a block, with or without a test prefix', () => {
    expect(matchBlock('Bake one test loaf: 70% hydration', SOURDOUGH)?.name).toBe('Bake one test loaf');
    expect(matchBlock('Baseline test: photograph and compare crumb', SOURDOUGH)?.name).toBe('Photograph and compare the crumb');
    expect(matchBlock('Read about gluten', SOURDOUGH)).toBeNull();
  });
});

describe('enforceBlocks', () => {
  it('swaps off-library steps, breaks up identical days, and adds the real thing', () => {
    const same = () => practiceDay(0, [step('Mix and autolyse one dough', 15), step('Read about gluten', 15)]);
    const week = [1, 2, 4, 5, 7].map((n) => ({ ...same(), dayNumber: n }));

    const fixed = enforceBlocks(week, SOURDOUGH, 1);

    expect(blockWeekFailures(fixed, SOURDOUGH)).toEqual([]);
    for (const task of fixed) {
      expect(task.detailedSteps.map((s) => s.durationMinutes)).toEqual([15, 15]);
      expect(task.detailedSteps.every((s) => matchBlock(s.title, SOURDOUGH))).toBe(true);
    }
    const signatures = fixed.map((task) => task.detailedSteps.map((s) => s.title).sort().join('|'));
    expect(new Set(signatures).size).toBeGreaterThan(1);
  });
});

describe('fallback week from blocks', () => {
  it('builds a varied, actionable week with the real thing in it', () => {
    const tasks = buildSpineWeekTasks({
      grounding: {
        methodConfidence: 'first_principles',
        methodKind: 'model_recommended',
        teachings: ['Keep the starter warm.'],
        allowedUrls: [],
        velocityTable: null,
        workKinds: ['make', 'solve'],
        blocks: SOURDOUGH,
      },
      dailyMins: 30,
      slotTime: '19:00',
      weekStartDate: new Date('2026-10-05'),
      planVariant: 'steady',
    });

    expect(tasks).toHaveLength(7);
    expect(taskQualityFailures(tasks)).toEqual([]);
    expect(blockWeekFailures(tasks, SOURDOUGH)).toEqual([]);
    for (const task of tasks.filter((t) => !t.isRestDay)) {
      expect(task.detailedSteps.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(30);
      expect(task.detailedSteps.every((s) => s.output)).toBe(true);
    }
  });
});
