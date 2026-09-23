import type { CreateGoalPayload, FollowUpQuestion, GoalClarification, RoutineSettings } from '../../types';

/** Written by every pathway launch (landing, auth redirect, galleries); read by onboarding when router state is absent. */
export const DRAFT_GOAL_KEY = 'achivii_draft_goal';

export interface AnswerState {
  answers: Record<string, string>;
  customAnswers: Record<string, string>;
}

/** A typed answer only counts once it says something; otherwise the picked option (if any) stands. */
export function answerFor(q: FollowUpQuestion, { answers, customAnswers }: AnswerState): string | undefined {
  const typed = customAnswers[q.id]?.trim();
  if (typed) return typed.length >= 2 ? typed : undefined;
  return answers[q.id] || undefined;
}

export interface PayloadInput extends AnswerState {
  rawGoal: string;
  editedOutcome: string;
  clarification: GoalClarification | null;
  routine: RoutineSettings;
}

/** The `POST /api/goal/create` body. Field order and values are pinned by the R-4 baseline (`e2e/fixtures/onboarding`). */
export function buildCreatePayload(input: PayloadInput): CreateGoalPayload {
  const { rawGoal, editedOutcome, clarification, routine } = input;
  const questions = clarification?.followUpQuestions || [];
  const answers: Record<string, string> = {};
  questions.forEach((q) => {
    answers[q.question] = answerFor(q, input) || 'Skipped';
  });
  const answerList = questions.map((q) => ({ id: q.id, question: q.question, answer: answerFor(q, input) || 'Skipped' }));

  return {
    rawGoal,
    clarifiedOutcome: editedOutcome || clarification?.clarifiedOutcome || rawGoal,
    answers,
    answerList,
    domain: clarification?.primaryDomain,
    routine,
  };
}
