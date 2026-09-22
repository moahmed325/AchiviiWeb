import { describe, it, expect } from 'vitest';
import { cleanDrills, drillsForWeek, enforceDrills, matchDrill, offLibrarySteps, type Drill } from '../src/lib/method/drills.js';
import type { DailyTaskPlan, DetailedStep } from '../src/lib/ai/goalDecomposer.js';

const drill = (name: string, stage: Drill['stage'], impact: number): Drill => ({
  name,
  moves: 'clean catches',
  impact,
  stage,
  dose: '5 sets of 20 throws',
  passMark: '15 of 20 caught without moving your feet',
  cue: 'Throw to eye height.',
  pitfall: 'Chasing the ball forward.',
});

const LIBRARY = [
  drill('One-ball arcs', 'foundation', 3),
  drill('Two-ball exchange', 'foundation', 5),
  drill('Two-in-one-hand', 'foundation', 2),
  drill('Three-ball flash', 'build', 5),
  drill('Cascade runs', 'peak', 5),
];

function step(title: string, durationMinutes: number): DetailedStep {
  return {
    stepNumber: 1,
    title,
    durationMinutes,
    instructions: `${durationMinutes} minutes of ${title}`,
    focusCue: 'x',
    pitfallToAvoid: 'y',
    passMark: 'Done cleanly 10 times',
  };
}

function practiceDay(steps: DetailedStep[]): DailyTaskPlan {
  return {
    dayNumber: 1,
    dayOfWeek: 'Monday',
    title: 'Juggling: 10 clean',
    isRestDay: false,
    durationMinutes: steps.reduce((sum, s) => sum + s.durationMinutes, 0),
    slotTime: '19:00',
    implementationIntention: 'When: 19:00',
    detailedSteps: steps,
  };
}

describe('drill library', () => {
  it('drops warm-ups and dose-less drills and ranks by impact', () => {
    const cleaned = cleanDrills([
      ...LIBRARY,
      { ...drill('Warm-up shoulder rolls', 'foundation', 5) },
      { ...drill('Watch juggling', 'foundation', 4), dose: 'watch a bit' },
    ]);
    expect(cleaned.map((d) => d.name)).not.toContain('Warm-up shoulder rolls');
    expect(cleaned.map((d) => d.name)).not.toContain('Watch juggling');
    expect(cleaned[0].impact).toBe(5);
  });

  it('puts the current stage first', () => {
    expect(drillsForWeek(LIBRARY, 1)[0].name).toBe('Two-ball exchange');
    expect(drillsForWeek(LIBRARY, 6)[0].name).toBe('Three-ball flash');
    expect(drillsForWeek(LIBRARY, 10)[0].name).toBe('Cascade runs');
  });

  it('matches steps that name a drill, with or without a test prefix', () => {
    expect(matchDrill('Two-ball exchange: 10 in a row', LIBRARY)?.name).toBe('Two-ball exchange');
    expect(matchDrill('Baseline test: two ball exchanges', LIBRARY)?.name).toBe('Two-ball exchange');
    expect(matchDrill('Mindful breathing', LIBRARY)).toBeNull();
  });

  it('swaps off-library steps for the best unused drill and keeps the minutes', () => {
    const day = practiceDay([step('Warm-up wrists', 5), step('Two-ball exchange', 15), step('Juggling theory', 10)]);
    const [fixed] = enforceDrills([day], LIBRARY, 1);
    const titles = fixed.detailedSteps.map((s) => s.title);

    expect(titles).toEqual(['Warm-up wrists', 'Two-ball exchange', 'One-ball arcs']);
    expect(fixed.detailedSteps[2].durationMinutes).toBe(10);
    expect(fixed.detailedSteps[2].instructions).toMatch(/^10 minutes: 5 sets/);
    expect(offLibrarySteps([fixed], LIBRARY)).toEqual([]);
  });
});
