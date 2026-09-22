import { describe, it, expect } from 'vitest';
import { polishWeekTasks, taskQualityFailures } from '../src/lib/ai/taskRules.js';
import { repairWeekSchedule } from '../src/lib/ai/scheduleRepair.js';
import type { DailyTaskPlan, DetailedStep } from '../src/lib/ai/goalDecomposer.js';

function step(overrides: Partial<DetailedStep> = {}): DetailedStep {
  return {
    stepNumber: 1,
    title: 'Two-ball exchange',
    durationMinutes: 30,
    instructions: '5 sets of 20 throws, 30 seconds rest between sets.',
    focusCue: 'Throw to eye height.',
    pitfallToAvoid: 'Chasing the ball forward.',
    passMark: '15 of 20 land without moving your feet.',
    ...overrides,
  };
}

function day(dayNumber: number, overrides: Partial<DailyTaskPlan> = {}): DailyTaskPlan {
  return {
    dayNumber,
    dayOfWeek: 'Monday',
    title: 'Two-ball exchange: 10 clean in a row',
    isRestDay: false,
    durationMinutes: 30,
    slotTime: '19:30',
    implementationIntention: 'When: 19:30 | Where: living room | Action: exchange',
    detailedSteps: [step({ instructions: 'Test: best of 5 tries at consecutive exchanges, log it. Then 5 sets of 20.' })],
    ...overrides,
  };
}

function goodWeek(): DailyTaskPlan[] {
  const rest = (n: number) =>
    day(n, {
      isRestDay: true,
      title: 'Light practice: one-ball arcs',
      durationMinutes: 15,
      detailedSteps: [step({ title: 'Easy one-ball arcs', durationMinutes: 15, instructions: '15 minutes of slow arcs.' })],
    });
  return [day(1), day(2), rest(3), day(4), day(5), rest(6), day(7)];
}

describe('taskQualityFailures', () => {
  it('passes a week of real drills', () => {
    expect(taskQualityFailures(goodWeek())).toEqual([]);
  });

  it('rejects category titles and reflection rest days', () => {
    const week = goodWeek();
    week[1] = day(2, { title: 'Two-Ball Mechanics Review' });
    week[2] = { ...week[2], title: 'Active Recovery & Reflection' };
    const failures = taskQualityFailures(week).join(' ');
    expect(failures).toMatch(/Day 2 title/);
    expect(failures).toMatch(/Day 3 title/);
  });

  it('rejects steps with no dose or no pass mark', () => {
    const week = goodWeek();
    week[3] = day(4, { detailedSteps: [step({ instructions: 'Practice the flash.', passMark: '' })] });
    const failures = taskQualityFailures(week).join(' ');
    expect(failures).toMatch(/no dose/);
    expect(failures).toMatch(/no passMark/);
  });

  it('requires a baseline test on the first and last practice day', () => {
    const week = goodWeek().map((task) =>
      task.isRestDay ? task : { ...task, detailedSteps: [step()] }
    );
    const failures = taskQualityFailures(week).join(' ');
    expect(failures).toMatch(/Day 1 .* baseline/);
    expect(failures).toMatch(/Day 7 .* repeat/);
  });

  it('keeps counted flashcard review and body-position setup as real practice', () => {
    const week = goodWeek();
    week[1] = day(2, {
      title: 'Review 40 Italian words: 90% recall',
      detailedSteps: [step({ title: 'Posture setup and flashcard review', instructions: 'Recall 40 cards out loud in 3 rounds.' })],
    });
    expect(taskQualityFailures(week)).toEqual([]);
  });

  it('allows setup only on the first practice day', () => {
    const week = goodWeek();
    week[3] = day(4, { detailedSteps: [step({ instructions: 'Install the app and set up 3 decks.' })] });
    expect(taskQualityFailures(week).join(' ')).toMatch(/Day 4 .* setup/);
  });
});

describe('polishWeekTasks', () => {
  it('fixes the small misses in code so no retry is needed', () => {
    const plain = (n: number, overrides: Partial<DailyTaskPlan> = {}) =>
      day(n, {
        title: 'Graphite layering',
        detailedSteps: [
          step({ title: 'Warm-up arcs', durationMinutes: 10, instructions: 'Loose arcs across the page.', passMark: '' }),
          step({ title: 'Layer a 5-step value scale', stepNumber: 2, durationMinutes: 20, instructions: '3 scales, light to dark.' }),
        ],
        ...overrides,
      });
    const week = goodWeek().map((task) => (task.isRestDay ? task : plain(task.dayNumber)));
    week[2] = { ...week[2], title: 'Rest & Posture Review' };

    const polished = polishWeekTasks(week);

    expect(taskQualityFailures(polished)).toEqual([]);
    for (const task of polished) {
      expect(task.detailedSteps.reduce((sum, s) => sum + s.durationMinutes, 0)).toBe(task.durationMinutes);
    }
    expect(polished[0].detailedSteps[0].title).toMatch(/^Baseline test:/);
    expect(polished[6].detailedSteps.at(-1)!.title).toMatch(/^Retest:/);
    expect(polished[2].title).toMatch(/^Light practice:/);
  });
});

describe('schedule repair rest days', () => {
  it('turns an extra practice day into a light version of that drill', () => {
    const week = [day(1), day(2), day(3), day(4), day(5), day(6), day(7)];
    const { tasks } = repairWeekSchedule(week, 30, 5);
    const rest = tasks.filter((task) => task.isRestDay);
    expect(rest).toHaveLength(2);
    for (const task of rest) {
      expect(task.title).toMatch(/^Light practice:/);
      expect(task.detailedSteps[0].passMark).toBeTruthy();
    }
  });
});
