import { describe, it, expect } from 'vitest';
import { dayQualityFailures, polishDays } from '../src/lib/ai/taskRules.js';
import type { DailyTaskPlan, DetailedStep } from '../src/lib/ai/goalDecomposer.js';

function step(overrides: Partial<DetailedStep> = {}): DetailedStep {
  return {
    stepNumber: 1,
    title: 'Two-ball exchange',
    durationMinutes: 30,
    instructions: '5 sets of 20 throws, 30 seconds rest between sets.',
    output: 'Your best count of clean exchanges',
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
      detailedSteps: [step({ title: 'Easy one-ball arcs', durationMinutes: 15, instructions: '15 minutes of slow arcs at eye height.' })],
    });
  return [day(1), day(2), rest(3), day(4), day(5), rest(6), day(7)];
}

describe('dayQualityFailures', () => {
  it('passes a week of real work', () => {
    expect(dayQualityFailures(goodWeek())).toEqual([]);
  });

  it('rejects category titles and reflection rest days', () => {
    const week = goodWeek();
    week[1] = day(2, { title: 'Two-Ball Mechanics Review' });
    week[2] = { ...week[2], title: 'Active Recovery & Reflection' };
    const failures = dayQualityFailures(week).join(' ');
    expect(failures).toMatch(/Day 2 title/);
    expect(failures).toMatch(/Day 3 title/);
  });

  it('accepts actions without a number, like baking or streaming', () => {
    const week = goodWeek();
    week[1] = day(2, {
      title: 'Bake a test loaf and compare the crumb',
      detailedSteps: [
        step({
          title: 'Shape and bake one loaf',
          instructions: 'Pre-shape, rest, then final shape and bake in a covered pot.',
          output: 'One baked loaf, cut in half',
          passMark: 'The crumb has no dense streak along the bottom.',
          timing: '4 hours after mixing',
        }),
      ],
    });
    expect(dayQualityFailures(week)).toEqual([]);
  });

  it('rejects steps with no clear action, no output, or no pass mark', () => {
    const week = goodWeek();
    week[3] = day(4, { detailedSteps: [step({ instructions: 'Practice.', output: '', passMark: '' })] });
    const failures = dayQualityFailures(week).join(' ');
    expect(failures).toMatch(/does not say exactly what to do/);
    expect(failures).toMatch(/no output/);
    expect(failures).toMatch(/no passMark/);
  });

  it('keeps counted flashcard review and body-position setup as real work', () => {
    const week = goodWeek();
    week[1] = day(2, {
      title: 'Review 40 Italian words: 90% recall',
      detailedSteps: [step({ title: 'Posture setup and flashcard review', instructions: 'Recall 40 cards out loud in 3 rounds.' })],
    });
    expect(dayQualityFailures(week)).toEqual([]);
  });

  it('allows setup only on the first practice day', () => {
    const week = goodWeek();
    week[3] = day(4, { detailedSteps: [step({ instructions: 'Install the app and set up 3 decks.' })] });
    expect(dayQualityFailures(week).join(' ')).toMatch(/Day 4 .* setup/);
  });
});

describe('polishDays', () => {
  it('fills a missing pass mark and swaps a category title for the lead step', () => {
    const week = goodWeek();
    week[1] = day(2, {
      title: 'Practice session',
      detailedSteps: [step({ title: 'Layer a 5-step value scale', instructions: '3 scales, light to dark, pencil held far back.', passMark: '' })],
    });
    week[2] = { ...week[2], title: 'Rest & Posture Review' };

    const polished = polishDays(week);

    expect(dayQualityFailures(polished)).toEqual([]);
    expect(polished[1].title).toBe('Layer a 5-step value scale');
    expect(polished[1].detailedSteps[0].passMark).toBeTruthy();
    expect(polished[2].title).toMatch(/^Light practice:/);
  });
});
