import type { FollowUpQuestion } from '../../types';

export type FlowStep = 'goal' | 'starting' | 'success' | 'schedule' | 'review';
export type WizardStep = FlowStep | 'generation';

/** A certified pathway gets preset questions at once; a custom goal waits about 17s for clarify. */
export type GoalKind = 'pathway' | 'custom';

/**
 * ND-13: a pathway follows the spec order. A custom goal asks for the schedule first, so the user has
 * something to do while clarify runs. There is one step list either way; only Schedule moves.
 */
export const STEP_ORDER: Record<GoalKind, readonly FlowStep[]> = {
  pathway: ['goal', 'starting', 'success', 'schedule', 'review'],
  custom: ['goal', 'schedule', 'starting', 'success', 'review'],
};

export const STEP_LABEL: Record<FlowStep, string> = {
  goal: 'Direction',
  starting: 'Starting point',
  success: 'Success',
  schedule: 'Schedule',
  review: 'Review',
};

export const isFlowStep = (value: unknown): value is FlowStep =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(STEP_LABEL, value);

export const nextStep = (kind: GoalKind, step: FlowStep): FlowStep | undefined => {
  const order = STEP_ORDER[kind];
  return order[order.indexOf(step) + 1];
};

export const previousStep = (kind: GoalKind, step: FlowStep): FlowStep | undefined => {
  const order = STEP_ORDER[kind];
  return order[order.indexOf(step) - 1];
};

/** ND-14: the success step asks these questions next to the editable outcome; the rest describe the starting point. */
const SUCCESS_QUESTION_IDS = new Set(['success']);

export const isSuccessQuestion = (q: FollowUpQuestion) => SUCCESS_QUESTION_IDS.has(q.id);

/** Splits the clarify questions by step. Each group keeps clarify's order, and the payload still uses the full list. */
export const splitQuestions = (questions: FollowUpQuestion[]) => ({
  starting: questions.filter((q) => !isSuccessQuestion(q)),
  success: questions.filter(isSuccessQuestion),
});
