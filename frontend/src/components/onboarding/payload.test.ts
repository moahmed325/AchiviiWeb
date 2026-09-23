import { describe, expect, it } from 'vitest';
import type { CreateGoalPayload, GoalClarification } from '../../types';
import { answerFor, buildCreatePayload } from './payload';
import presetClarify from '../../../e2e/fixtures/onboarding/clarify-run10k.json';
import presetCreate from '../../../e2e/fixtures/onboarding/create-run10k.json';
import customClarify from '../../../e2e/fixtures/onboarding/clarify-custom-sourdough.json';
import customCreate from '../../../e2e/fixtures/onboarding/create-custom-sourdough.json';

const preset = presetClarify as GoalClarification;
const custom = customClarify as GoalClarification;

describe('buildCreatePayload', () => {
  it('reproduces the recorded preset body (first option of every question)', () => {
    const baseline = presetCreate.body as CreateGoalPayload;
    const payload = buildCreatePayload({
      rawGoal: 'Run a 10K Under 50 Minutes',
      editedOutcome: preset.clarifiedOutcome,
      clarification: preset,
      routine: baseline.routine,
      answers: Object.fromEntries(preset.followUpQuestions.map((q) => [q.id, q.options[0]])),
      customAnswers: {},
    });
    expect(payload).toEqual(baseline);
  });

  it('reproduces the recorded custom body (option, typed answer, skipped, option)', () => {
    const baseline = customCreate.body as CreateGoalPayload;
    const [level, success, , obstacle] = custom.followUpQuestions;
    const payload = buildCreatePayload({
      rawGoal: 'Bake sourdough bread at home',
      editedOutcome: custom.clarifiedOutcome,
      clarification: custom,
      routine: baseline.routine,
      answers: { [level.id]: level.options[0], [obstacle.id]: obstacle.options[0] },
      customAnswers: { [success.id]: 'Bake a loaf with an open crumb every weekend' },
    });
    expect(payload).toEqual(baseline);
  });

  it('falls back from the edited outcome to the clarified outcome, then to the raw goal', () => {
    const base = { rawGoal: 'Raw', routine: (customCreate.body as CreateGoalPayload).routine, answers: {}, customAnswers: {} };
    expect(buildCreatePayload({ ...base, editedOutcome: '', clarification: custom }).clarifiedOutcome).toBe(custom.clarifiedOutcome);
    expect(buildCreatePayload({ ...base, editedOutcome: '', clarification: null })).toMatchObject({
      clarifiedOutcome: 'Raw',
      answers: {},
      answerList: [],
      domain: undefined,
    });
  });
});

describe('answerFor', () => {
  const q = custom.followUpQuestions[0];

  it('prefers a typed answer over a picked option', () => {
    expect(answerFor(q, { answers: { [q.id]: q.options[0] }, customAnswers: { [q.id]: '  Some notes ' } })).toBe('Some notes');
  });

  it('treats a one-character typed answer as no answer, even with an option picked', () => {
    expect(answerFor(q, { answers: { [q.id]: q.options[0] }, customAnswers: { [q.id]: 'x' } })).toBeUndefined();
  });

  it('uses the picked option when nothing is typed', () => {
    expect(answerFor(q, { answers: { [q.id]: q.options[1] }, customAnswers: { [q.id]: '   ' } })).toBe(q.options[1]);
  });
});
