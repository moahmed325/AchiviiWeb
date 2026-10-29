import type { FollowUpQuestion, Goal, JourneyResult, NextPlanMode, NextPlanRequest, PlanAnswer } from '../types';
import { fixedDateKey } from './fixedDate';
import { findPathwayByTitle } from './certifiedPresets';

/**
 * Next plan (docs/features/next-plan): the day-90 screen's words (NP-1, NP-2, NP-5), the choices it offers (NP-6,
 * NP-7) and what onboarding carries when a next plan starts (NP-3, NP-4). The numbers are the server's
 * (`goal.journeyResult`); nothing here works one out.
 */

/** NP-1: the line the day-90 screen leads with; null when there is nothing measured to show. */
export function journeyHeadline(result: JourneyResult | null | undefined): string | null {
  if (!result) return null;
  if (result.kind === 'deliverable') return `You finished ${result.weeksFinished} of ${result.totalWeeks ?? 12} weeks.`;
  if (!result.reached) return null;
  return result.start ? `You went from ${result.start} to ${result.reached}.` : `You reached ${result.reached}.`;
}

/**
 * NP-2: what they reached against their full goal, never a lowered target. A checkpoint's day-90 target is named
 * beside the goal. Never "failed" or "missed".
 */
export function journeyOutcome(result: JourneyResult | null | undefined): string | null {
  if (!result?.goal) return null;
  if (result.madeIt) return `You reached your goal: ${result.goal}.`;
  if (result.dayNinetyTarget) {
    // B-109: a shorter plan has no day 90; its checkpoint target is the final target.
    const name = result.totalWeeks === undefined ? 'day-90 target' : 'final target';
    const lead = result.reachedDayNinety ? `You reached your ${name}: ${result.dayNinetyTarget}.` : `${name.charAt(0).toUpperCase()}${name.slice(1)}: ${result.dayNinetyTarget}.`;
    return `${lead} Your goal: ${result.goal}. That's your next plan.`;
  }
  return `Your goal: ${result.goal}. That's your next plan.`;
}

export interface NextPlanChoice {
  mode: Extract<NextPlanMode, 'keep_going' | 'go_further'>;
  label: string;
}

/**
 * NP-5, NP-6, NP-7: Pro only, and never a reason shown to someone who is not. Made it: "Go further". Fell short:
 * "Keep going" first, unless within one safe step of the goal, where "Go further" leads.
 */
export function nextPlanChoices(result: JourneyResult | null | undefined, isPro: boolean): NextPlanChoice[] {
  if (!isPro || !result) return [];
  const further: NextPlanChoice = { mode: 'go_further', label: 'Go further' };
  if (result.madeIt) return [further];
  const keep: NextPlanChoice = { mode: 'keep_going', label: result.goal && result.kind === 'number' ? `Keep going to ${result.goal}` : 'Keep going' };
  return result.nearGoal ? [further, keep] : [keep, further];
}

/** NP-9, NP-10: a number goal asks for the level now after a break, or when nothing was measured. */
export function needsLevel(result: JourneyResult | null | undefined, mode: NextPlanMode): boolean {
  return result?.kind === 'number' && (mode === 'fresh' || result.reachedValue === null);
}

/** NP-9: the level question, with the last result named when there is one. */
export function levelQuestion(result: JourneyResult): string {
  return result.reached && result.reachedWeek
    ? `Your last result was ${result.reached}, in week ${result.reachedWeek}. Where are you now?`
    : 'Where are you now?';
}

/** What onboarding is opened with for a next plan (router state `nextPlan`). */
export interface NextPlanLaunch {
  request: NextPlanRequest;
  /** Keep going and a fresh plan: the goal's text. Go further: none; they write the next goal (NP-4). */
  goalText?: string;
  isPreset: boolean;
  /** The level the plan starts from, as shown ("8 km"), for the banner; null for a deliverable goal. */
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
  const startsFrom =
    level !== undefined ? amount(level, result?.unit ?? null) : result?.kind === 'number' ? result.reached : null;
  return {
    request: { fromGoalId: goal.id, mode, ...(level !== undefined ? { level } : {}) },
    ...(mode === 'go_further' ? {} : { goalText: goal.rawGoal }),
    isPreset: mode !== 'go_further' && Boolean(findPathwayByTitle(goal.rawGoal)),
    startsFrom,
    answers: goal.roadmap?.answers ?? [],
    ...(mode !== 'go_further' && fixedDateKey(goal) ? { fixedDate: fixedDateKey(goal) } : {}),
  };
}

/** NP-3: the question a next plan does not ask again (the server adds the measured level in its place). */
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
