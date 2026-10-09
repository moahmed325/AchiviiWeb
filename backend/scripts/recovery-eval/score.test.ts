import { describe, expect, it } from 'vitest';
import { templateProfile, type RecoveryProfile } from '../../src/lib/recovery/index.js';
import { matchKind, scoreProfile, scoreRun, scoreTags, scoreTemplatePicks, unsafeReasons, type EvalAnswer, type StepTag, type WeekStep } from './score.js';

const endurance = () => templateProfile('endurance');
const answer = (overrides: Partial<EvalAnswer> = {}): EvalAnswer => ({ goalId: 'g1', template: 'endurance', profile: endurance(), changes: [], ...overrides });
const kind = (profile: RecoveryProfile, id: string) => profile.kinds.find((item) => item.id === id)!;

describe('matchKind', () => {
  const returned = endurance().kinds;

  it('matches by id', () => {
    expect(matchKind({ ...kind(endurance(), 'long_session') }, returned)?.id).toBe('long_session');
  });

  it('matches by name, ignoring case', () => {
    const want = { ...kind(endurance(), 'long_session'), id: 'long_ride', name: kind(endurance(), 'long_session').name.toUpperCase() };
    expect(matchKind(want, returned)?.id).toBe('long_session');
  });

  it('matches by an alias of an id or a name', () => {
    const want = { ...kind(endurance(), 'long_session'), id: 'long_ride', name: 'Long ride', aliases: ['long_session'] };
    expect(matchKind(want, returned)?.id).toBe('long_session');
    const byName = { ...want, aliases: [kind(endurance(), 'easy_session').name.toLowerCase()] };
    expect(matchKind(byName, returned)?.id).toBe('easy_session');
  });

  it('finds nothing when no id, name or alias fits', () => {
    expect(matchKind({ ...kind(endurance(), 'long_session'), id: 'brick', name: 'Brick workout', aliases: ['bike then run'] }, returned)).toBeNull();
  });
});

describe('scoreProfile', () => {
  it('agrees fully with the template it was written from, leaving out the two added kinds', () => {
    const score = scoreProfile(answer(), endurance());
    expect(score.templateRight).toBe(true);
    expect(score.kinds.every((item) => item.agrees)).toBe(true);
    expect(score.kinds.map((item) => item.answerKind)).not.toContain('weekly_test');
    expect(score.kinds.map((item) => item.answerKind)).not.toContain('fixed_time_session');
    expect(score.unsafe).toEqual([]);
  });

  it('counts a missing kind and a different action as disagreements, and lists extra kinds', () => {
    const returned = endurance();
    returned.kinds = returned.kinds.filter((item) => item.id !== 'strength_and_mobility');
    kind(returned, 'easy_session').action = 'move';
    returned.kinds.push({ id: 'brick', name: 'Brick', description: 'Bike then run.', action: 'move', hard: true, inOrder: false });
    const score = scoreProfile(answer(), returned);
    const byId = Object.fromEntries(score.kinds.map((item) => [item.answerKind, item]));
    expect(byId.strength_and_mobility).toMatchObject({ returnedKind: null, agrees: false });
    expect(byId.easy_session).toMatchObject({ returnedAction: 'move', agrees: false });
    expect(score.extraKinds).toEqual(['brick']);
  });

  it('marks the wrong template', () => {
    expect(scoreProfile(answer(), templateProfile('general')).templateRight).toBe(false);
  });
});

describe('unsafeReasons', () => {
  it('flags a hard kind that continues', () => {
    const returned = endurance();
    Object.assign(kind(returned, 'long_session'), { action: 'continue' });
    expect(unsafeReasons(returned, answer().profile).join(' ')).toMatch(/long_session.*hard or high-load and continues/);
  });

  it('flags a high-load kind that is not hard', () => {
    const returned = endurance();
    Object.assign(kind(returned, 'strength_and_mobility'), { highLoad: true, hard: false });
    expect(unsafeReasons(returned, answer().profile).join(' ')).toMatch(/strength_and_mobility.*high-load but not hard/);
  });

  it('flags a test that is not fixed, or missing', () => {
    const moved = endurance();
    kind(moved, 'weekly_test').action = 'move';
    expect(unsafeReasons(moved, answer().profile)).toContain('the weekly test is not fixed.');
    const missing = endurance();
    missing.kinds = missing.kinds.filter((item) => item.id !== 'weekly_test');
    expect(unsafeReasons(missing, answer().profile)).toContain('the weekly test is not fixed.');
  });

  it('flags a matched kind that is soft or continues where the answer kind is hard', () => {
    const soft = endurance();
    Object.assign(kind(soft, 'quality_session'), { hard: false });
    expect(unsafeReasons(soft, answer().profile).join(' ')).toMatch(/quality_session.*not hard/);
    const continues = endurance();
    Object.assign(kind(continues, 'quality_session'), { hard: false, action: 'continue' });
    expect(unsafeReasons(continues, answer().profile).join(' ')).toMatch(/quality_session.*continues, but the answer/);
  });

  it('flags a soft match where the answer kind is high-load', () => {
    const want = answer();
    Object.assign(kind(want.profile as RecoveryProfile, 'strength_and_mobility'), { highLoad: true, hard: true });
    expect(unsafeReasons(endurance(), want.profile).join(' ')).toMatch(/strength_and_mobility.*not hard/);
  });

  it('finds nothing unsafe in a template against itself', () => {
    expect(unsafeReasons(endurance(), answer().profile)).toEqual([]);
  });
});

describe('scoreRun and scoreTemplatePicks', () => {
  it('counts templates, agreeing kinds, unsafe results and sources', () => {
    const answers = [answer({ goalId: 'a' }), answer({ goalId: 'b' })];
    const bad = endurance();
    Object.assign(kind(bad, 'long_session'), { action: 'continue' });
    const run = scoreRun(answers, [
      { goalId: 'a', source: 'model', profile: endurance() },
      { goalId: 'b', source: 'picked_template', profile: { ...bad, template: 'general' } },
    ]);
    expect(run.templatesRight).toBe(1);
    expect(run.kindsTotal).toBe(10);
    expect(run.kindsAgree).toBe(9);
    expect(new Set(run.unsafe.map((item) => item.goalId))).toEqual(new Set(['b']));
    expect(run.sources).toEqual({ model: 1, picked_template: 1, keyword_template: 0 });
    expect(run.pass).toEqual({ templates: false, actions: true, unsafe: false });
  });

  it('scores the keyword table alone', () => {
    const answers = [answer({ goalId: 'a' }), answer({ goalId: 'b' })];
    expect(scoreTemplatePicks(answers, { a: 'endurance', b: 'general' })).toEqual({
      right: 1,
      total: 2,
      misses: [{ goalId: 'b', answer: 'endurance', picked: 'general' }],
    });
  });
});

describe('scoreTags', () => {
  const step = (dayNumber: number, stepNumber: number, title: string): WeekStep => ({ goalId: 'g', dayNumber, stepNumber, title, instructions: '', durationMinutes: 10 });
  const tag = (dayNumber: number, stepNumber: number, kind: string | null): StepTag => ({ goalId: 'g', dayNumber, stepNumber, kind });
  const steps = [step(1, 1, 'Easy run'), step(1, 2, 'Strides'), step(3, 1, 'Weekly test: 5 km'), step(4, 1, 'Long run')];
  const gold = [tag(1, 1, 'easy_session'), tag(1, 2, 'easy_session'), tag(4, 1, 'long_session')];

  it('counts agreeing tags and leaves out the test step', () => {
    const score = scoreTags(steps, gold, [tag(1, 1, 'easy_session'), tag(1, 2, 'quality_session'), tag(3, 1, 'weekly_test'), tag(4, 1, 'long_session')]);
    expect(score).toMatchObject({ agree: 2, total: 3, pass: false });
    expect(score.misses).toEqual([{ goalId: 'g', dayNumber: 1, stepNumber: 2, title: 'Strides', gold: 'easy_session', model: 'quality_session' }]);
  });

  it('counts a missing model tag as a disagreement', () => {
    const score = scoreTags(steps, gold, [tag(1, 1, 'easy_session'), tag(4, 1, 'long_session')]);
    expect(score).toMatchObject({ agree: 2, total: 3 });
    expect(score.misses[0]).toMatchObject({ stepNumber: 2, model: null });
  });

  it('passes at 90% and refuses a step with no gold tag', () => {
    expect(scoreTags(steps, gold, gold).pass).toBe(true);
    expect(() => scoreTags(steps, gold.slice(1), gold)).toThrow(/No gold tag/);
  });
});
