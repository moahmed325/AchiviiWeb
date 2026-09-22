import { describe, it, expect } from 'vitest';
import { repairWeekSchedule } from '../src/lib/ai/scheduleRepair.js';
import type { DailyTaskPlan } from '../src/lib/ai/goalDecomposer.js';

function day(index: number, rest: boolean, minutes: number[] = [30]): DailyTaskPlan {
  return {
    dayNumber: index + 1,
    dayOfWeek: 'Monday',
    title: rest ? 'Active Recovery & Reflection' : `Drill ${index + 1}`,
    isRestDay: rest,
    durationMinutes: rest ? 15 : 30,
    slotTime: '19:30',
    implementationIntention: 'When: 19:30 | Where: desk | Action: practice',
    detailedSteps: minutes.map((durationMinutes, stepIndex) => ({
      stepNumber: stepIndex + 1,
      title: `Step ${stepIndex + 1}`,
      durationMinutes,
      instructions: `Do step ${stepIndex + 1}.`,
      focusCue: 'Stay with it.',
      pitfallToAvoid: 'Rushing.',
      layer: 'adherence',
      layerReasoning: 'How this skill is practised.',
    })),
  };
}

describe('schedule repair', () => {
  it('turns extra rest days into practice so a 4-day week becomes 5, without a double rest', () => {
    const tasks = [0, 1, 2, 3, 4, 5, 6].map((index) => day(index, index === 0 || index === 1 || index === 4));
    const result = repairWeekSchedule(tasks, 30, 5);

    expect(result.failures).toEqual([]);
    expect(result.tasks.filter((task) => !task.isRestDay)).toHaveLength(5);
    for (let i = 1; i < result.tasks.length; i++) {
      expect(result.tasks[i].isRestDay && result.tasks[i - 1].isRestDay).toBe(false);
    }
    const promoted = result.tasks[1];
    expect(promoted.isRestDay).toBe(false);
    expect(promoted.detailedSteps[0].instructions).toBe('Do step 1.');
    expect(promoted.detailedSteps.reduce((sum, step) => sum + step.durationMinutes, 0)).toBe(30);
  });

  it('leaves a valid 5-day week where it is', () => {
    const tasks = [0, 1, 2, 3, 4, 5, 6].map((index) => day(index, index === 3 || index === 6));
    const result = repairWeekSchedule(tasks, 30, 5);
    expect(result.failures).toEqual([]);
    expect(result.tasks.map((task) => task.isRestDay)).toEqual([false, false, false, true, false, false, true]);
  });

  it('makes step minutes add up to the daily time', () => {
    const tasks = [0, 1, 2, 3, 4, 5, 6].map((index) => day(index, index === 3 || index === 6, [10, 10]));
    const result = repairWeekSchedule(tasks, 30, 5);
    expect(result.failures).toEqual([]);
    for (const task of result.tasks.filter((item) => !item.isRestDay)) {
      expect(task.detailedSteps.reduce((sum, step) => sum + step.durationMinutes, 0)).toBe(30);
    }
  });
});
