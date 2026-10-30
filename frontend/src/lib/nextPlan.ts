import type { FollowUpQuestion, Goal, JourneyResult, NextPlanMode, NextPlanRequest, PlanAnswer } from '../types';
import { fixedDateKey } from './fixedDate';
import { findPathwayByTitle } from './certifiedPresets';

/**
 * Next plan (docs/features/next-plan): the end screen's words (NP-1), the choices it offers (NP-6, NP-7) and what
 * onboarding carries when a next plan starts (NP-3, NP-4). The numbers are the server's (`goal.journeyResult`). No weekly
 * tests (2026-10-30): the end screen says what they did, and a goal measured in a number always asks the level now.
 */

/** NP-1: the line the end screen leads with: "You finished 11 of 12 weeks: 52 of 60 sessions." */
export function journeyHeadline(result: JourneyResult | null | undefined): string | null {
  if (!result) return null;
  const weeks = `You finished ${result.weeksFinished} of ${result.totalWeeks ?? 12} weeks`;
  return result.sessionsPlanned > 0 ? `${weeks}: ${result.sessionsDone} of ${result.sessionsPlanned} sessions.` : `${weeks}.`;
}

/** NP-2: the goal they worked toward, and that a next plan picks it up. Never "failed" or "missed". */
export function journeyOutcome(result: JourneyResult | null | undefined): string | null {
  if (!result?.goal) return null;
  return result.start ? `You started at ${result.start}. Your goal: ${result.goal}.` : `Your goal: ${result.goal}.`;
}

export interface NextPlanChoice {
  mode: Extract<NextPlanMode, 'keep_going' | 'go_further'>;
  label: string;
}

/** NP-6, NP-7: Pro only, and never a reason shown to someone who is not. "Keep going" with this goal, or a new one. */
export function nextPlanChoices(result: JourneyResult | null | undefined, isPro: boolean): NextPlanChoice[] {
  if (!isPro || !result) return [];
  return [
    { mode: 'keep_going', label: 'Keep going' },
    { mode: 'go_further', label: 'Go further' },
  ];
}

/** NP-9, NP-10: a goal measured in a number asks for the level now (nothing is measured by the plan any more). */
export function needsLevel(result: JourneyResult | null | undefined, _mode?: NextPlanMode): boolean {
  return result?.kind === 'number' && Boolean(result.unit);
}

/** NP-9: the level question, with where the plan started when there is one. */
export function levelQuestion(result: JourneyResult): string {
  return result.start ? `You started this plan at ${result.start}. Where are you now?` : 'Where are you now?';
}

/** What onboarding is opened with for a next plan (router state `nextPlan`). */
export interface NextPlanLaunch {
  request: NextPlanRequest;
  /** Keep going and a fresh plan: the goal's text. Go further: none; they write the next goal (NP-4). */
  goalText?: string;
  isPreset: boolean;
  /** The level the plan starts from, as shown ("8 km"), for the banner; null when none was given. */
  startsFrom: string | null;
  /** The old plan's answers, filled in again (NP-3). */
  answers: PlanAnswer[];
  /** B-106: the old plan's fixed date (`YYYY-MM-DD`) to fill in; none for go further. Onboarding keeps it only while ahead. */
  fixedDate?: string;
}

/** Formats a level the person typed as the server will show it. */
const amount = (value: number, unit: string | null) => `${Math.round(value * 100) / 100}${unit ? ` ${unit}` : ''}`;

export function nextPlanLaunch(goal: Goal, mode: NextPlanMode, level?: number): NextPlanLaunch {
  const result = goal.journeyResult ?? null;
  const startsFrom = level !== undefined ? amount(level, result?.unit ?? null) : null;
  return {
    request: { fromGoalId: goal.id, mode, ...(level !== undefined ? { level } : {}) },
    ...(mode === 'go_further' ? {} : { goalText: goal.rawGoal }),
    isPreset: mode !== 'go_further' && Boolean(findPathwayByTitle(goal.rawGoal)),
    startsFrom,
    answers: goal.roadmap?.answers ?? [],
    ...(mode !== 'go_further' && fixedDateKey(goal) ? { fixedDate: fixedDateKey(goal) } : {}),
  };
}

/** NP-3: the question a next plan does not ask again (the server adds the level they gave, or what they did, in its place). */
const LEVEL_QUESTION_ID = 'current_level';

export function nextPlanQuestions(questions: FollowUpQuestion[]): FollowUpQuestion[] {
  return questions.filter((q) => q.id !== LEVEL_QUESTION_ID);
}

/**
 * NP-3: the old plan's answers, by question id, so the person only changes what changed. A picked option goes back as
 * that option, anything else as typed text. "Go further" leaves the success answer for the new goal (NP-4).
 */
export function prefilledAnswers(
  questions: FollowUpQuestion[],
  previous: PlanAnswer[],
  mode: NextPlanMode
): { answers: Record<string, string>; customAnswers: Record<string, string> } {
  const answers: Record<string, string> = {};
  const customAnswers: Record<string, string> = {};
  for (const q of questions) {
    if (mode === 'go_further' && q.id === 'success') continue;
    const before = previous.find((item) => item.id === q.id)?.answer?.trim();
    if (!before || before.toLowerCase() === 'skipped') continue;
    if (q.options.includes(before)) answers[q.id] = before;
    else if (q.allowCustom) customAnswers[q.id] = before;
  }
  return { answers, customAnswers };
}
