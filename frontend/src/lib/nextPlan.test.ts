import { describe, it, expect } from 'vitest';
import type { FollowUpQuestion, Goal, JourneyResult } from '../types';
import {
  journeyHeadline,
  journeyOutcome,
  levelQuestion,
  needsLevel,
  nextPlanChoices,
  nextPlanLaunch,
  nextPlanQuestions,
  prefilledAnswers,
} from './nextPlan';

const result = (over: Partial<JourneyResult> = {}): JourneyResult => ({
  kind: 'number',
  start: '3 km',
  startValue: 3,
  reached: '8 km',
  reachedValue: 8,
  reachedWeek: 12,
  goal: '10 km',
  goalValue: 10,
  unit: 'km',
  direction: 'higher_is_better',
  dayNinetyTarget: null,
  reachedDayNinety: false,
  madeIt: false,
  nearGoal: false,
  weeksFinished: 12,
  lastDone: null,
  ...over,
});

describe('day-90 words (NP-1, NP-2)', () => {
  it('leads with where they started and what they reached', () => {
    expect(journeyHeadline(result())).toBe('You went from 3 km to 8 km.');
    expect(journeyHeadline(result({ start: null }))).toBe('You reached 8 km.');
    expect(journeyHeadline(result({ reached: null, reachedValue: null }))).toBeNull();
    expect(journeyHeadline(result({ kind: 'deliverable', weeksFinished: 11 }))).toBe('You finished 11 of 12 weeks.');
    expect(journeyHeadline(null)).toBeNull();
  });

  it('judges against the full goal and names a checkpoint’s day-90 target beside it', () => {
    expect(journeyOutcome(result({ madeIt: true }))).toBe('You reached your goal: 10 km.');
    expect(journeyOutcome(result())).toBe("Your goal: 10 km. That's your next plan.");
    expect(journeyOutcome(result({ dayNinetyTarget: '7.5 km', reachedDayNinety: true }))).toBe(
      "You reached your day-90 target: 7.5 km. Your goal: 10 km. That's your next plan."
    );
    expect(journeyOutcome(result({ dayNinetyTarget: '7.5 km' }))).toBe("Day-90 target: 7.5 km. Your goal: 10 km. That's your next plan.");
  });

  it('never says failed or missed', () => {
    for (const r of [result(), result({ dayNinetyTarget: '7.5 km' }), result({ reached: null })]) {
      expect(`${journeyHeadline(r)} ${journeyOutcome(r)}`).not.toMatch(/fail|miss/i);
    }
  });
});

describe('next plan choices (NP-5 to NP-7)', () => {
  it('none without Pro, whatever the outcome', () => {
    expect(nextPlanChoices(result(), false)).toEqual([]);
    expect(nextPlanChoices(result({ madeIt: true }), false)).toEqual([]);
  });

  it('made it: go further only', () => {
    expect(nextPlanChoices(result({ madeIt: true }), true).map((c) => c.label)).toEqual(['Go further']);
  });

  it('fell short: keep going first; within one safe step: go further first', () => {
    expect(nextPlanChoices(result(), true).map((c) => c.label)).toEqual(['Keep going to 10 km', 'Go further']);
    expect(nextPlanChoices(result({ nearGoal: true }), true).map((c) => c.label)).toEqual(['Go further', 'Keep going to 10 km']);
  });

  it('asks the level after a break or with nothing measured (NP-9, NP-10)', () => {
    expect(needsLevel(result(), 'keep_going')).toBe(false);
    expect(needsLevel(result(), 'fresh')).toBe(true);
    expect(needsLevel(result({ reachedValue: null, reached: null }), 'go_further')).toBe(true);
    expect(needsLevel(result({ kind: 'deliverable' }), 'fresh')).toBe(false);
    expect(levelQuestion(result({ reached: '6 km', reachedWeek: 7 }))).toBe('Your last result was 6 km, in week 7. Where are you now?');
    expect(levelQuestion(result({ reached: null, reachedWeek: null }))).toBe('Where are you now?');
  });
});

describe('what onboarding is opened with (NP-3, NP-4)', () => {
  const goal = {
    id: 'g1',
    rawGoal: 'Run 10 km',
    journeyResult: result(),
    roadmap: { answers: [{ id: 'equipment', question: 'Gear?', answer: 'Road shoes' }] },
  } as unknown as Goal;

  it('keep going carries the goal text and the measured level', () => {
    expect(nextPlanLaunch(goal, 'keep_going')).toEqual({
      request: { fromGoalId: 'g1', mode: 'keep_going' },
      goalText: 'Run 10 km',
      isPreset: false,
      startsFrom: '8 km',
      answers: [{ id: 'equipment', question: 'Gear?', answer: 'Road shoes' }],
    });
  });

  it('go further leaves the goal for them to write; a typed level is sent and shown', () => {
    const launch = nextPlanLaunch(goal, 'go_further', 7.5);
    expect(launch.goalText).toBeUndefined();
    expect(launch.request).toEqual({ fromGoalId: 'g1', mode: 'go_further', level: 7.5 });
    expect(launch.startsFrom).toBe('7.5 km');
  });

  const q = (id: string, options: string[] = []): FollowUpQuestion => ({ id, question: id, subtitle: '', options, allowCustom: true });

  it('drops the level question and fills in the earlier answers', () => {
    expect(nextPlanQuestions([q('current_level'), q('equipment')]).map((x) => x.id)).toEqual(['equipment']);
    const previous = [
      { id: 'equipment', question: '', answer: 'Treadmill' },
      { id: 'obstacle', question: '', answer: 'Long work days' },
      { id: 'success', question: '', answer: 'Run 10 km' },
      { id: 'other', question: '', answer: 'Skipped' },
    ];
    const questions = [q('equipment', ['Treadmill', 'Road']), q('obstacle'), q('success'), q('other')];
    expect(prefilledAnswers(questions, previous, 'keep_going')).toEqual({
      answers: { equipment: 'Treadmill' },
      customAnswers: { obstacle: 'Long work days', success: 'Run 10 km' },
    });
    expect(prefilledAnswers(questions, previous, 'go_further').customAnswers).toEqual({ obstacle: 'Long work days' });
  });
});
