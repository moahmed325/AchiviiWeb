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
  goal: 'Run 10 km without stopping',
  unit: 'km',
  direction: 'higher_is_better',
  weeksFinished: 11,
  sessionsDone: 52,
  sessionsPlanned: 60,
  ...over,
});

// No weekly tests (2026-10-30): the end screen says what they did; a goal measured in a number always asks the level.
describe('end-of-plan words (NP-1, NP-2)', () => {
  it('leads with weeks and sessions done', () => {
    expect(journeyHeadline(result())).toBe('You finished 11 of 12 weeks: 52 of 60 sessions.');
    expect(journeyHeadline(result({ totalWeeks: 7, weeksFinished: 7 }))).toBe('You finished 7 of 7 weeks: 52 of 60 sessions.');
    expect(journeyHeadline(result({ sessionsPlanned: 0, sessionsDone: 0 }))).toBe('You finished 11 of 12 weeks.');
    expect(journeyHeadline(null)).toBeNull();
  });

  it('names where they started and the goal', () => {
    expect(journeyOutcome(result())).toBe('You started at 3 km. Your goal: Run 10 km without stopping.');
    expect(journeyOutcome(result({ kind: 'other', start: null }))).toBe('Your goal: Run 10 km without stopping.');
    expect(journeyOutcome(result({ goal: null }))).toBeNull();
  });

  it('never says failed or missed', () => {
    for (const r of [result(), result({ weeksFinished: 2, sessionsDone: 3 })]) {
      expect(`${journeyHeadline(r)} ${journeyOutcome(r)}`).not.toMatch(/fail|miss/i);
    }
  });
});

describe('next plan choices (NP-6, NP-7)', () => {
  it('none without Pro', () => {
    expect(nextPlanChoices(result(), false)).toEqual([]);
  });

  it('keep going first, then go further', () => {
    expect(nextPlanChoices(result(), true).map((c) => c.label)).toEqual(['Keep going', 'Go further']);
  });

  it('a goal measured in a number always asks the level (NP-9, NP-10); any other goal never', () => {
    expect(needsLevel(result())).toBe(true);
    expect(needsLevel(result({ kind: 'other', unit: null }))).toBe(false);
    expect(levelQuestion(result())).toBe('You started this plan at 3 km. Where are you now?');
    expect(levelQuestion(result({ start: null }))).toBe('Where are you now?');
  });
});

describe('what onboarding is opened with (NP-3, NP-4)', () => {
  const goal = {
    id: 'g1',
    rawGoal: 'Run 10 km',
    journeyResult: result(),
    roadmap: { answers: [{ id: 'equipment', question: 'Gear?', answer: 'Road shoes' }] },
  } as unknown as Goal;

  it('keep going carries the goal text and the level they typed', () => {
    expect(nextPlanLaunch(goal, 'keep_going', 8)).toEqual({
      request: { fromGoalId: 'g1', mode: 'keep_going', level: 8 },
      goalText: 'Run 10 km',
      isPreset: false,
      startsFrom: '8 km',
      answers: [{ id: 'equipment', question: 'Gear?', answer: 'Road shoes' }],
    });
  });

  it('keep going and a fresh plan carry the fixed date to fill in; go further does not (B-106)', () => {
    const dated = { ...goal, fixedDate: '2027-05-10T00:00:00.000Z' } as Goal;
    expect(nextPlanLaunch(dated, 'fresh').fixedDate).toBe('2027-05-10');
    expect(nextPlanLaunch(dated, 'keep_going').fixedDate).toBe('2027-05-10');
    expect(nextPlanLaunch(dated, 'go_further').fixedDate).toBeUndefined();
    expect(nextPlanLaunch(goal, 'fresh').fixedDate).toBeUndefined();
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
