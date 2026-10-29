import type { GoalClarification, RoutineSettings } from '../../types';
import type { EssentialPage, PageId } from './pages';

/**
 * ND-28: a visitor answers everything before signing up, so the answers are kept in this browser across the sign-up
 * (and a reload, or an email confirmation in another tab). Cleared once the plan is built, or when a new goal is typed.
 */
export const ONBOARDING_SNAPSHOT_KEY = 'achivii_onboarding';

export interface OnboardingSnapshot {
  v: 1;
  /** The goal as first typed; the snapshot belongs to it. */
  typedGoal: string;
  rawGoal: string;
  editedOutcome: string;
  clarification: GoalClarification | null;
  answers: Record<string, string>;
  customAnswers: Record<string, string>;
  skipCounts: Record<string, number>;
  routine: RoutineSettings;
  fixedDate: string;
  focusAfter: EssentialPage | null;
  focusChosen: boolean;
  focusOptions: string[] | null;
  page: PageId;
  /** Set when a visitor taps Start on the summary: the plan is built as soon as they are signed in. */
  buildAfterSignUp?: boolean;
}

export function readSnapshot(): OnboardingSnapshot | null {
  try {
    const stored = JSON.parse(localStorage.getItem(ONBOARDING_SNAPSHOT_KEY) ?? 'null') as Partial<OnboardingSnapshot> | null;
    if (!stored || stored.v !== 1 || typeof stored.typedGoal !== 'string' || typeof stored.rawGoal !== 'string') return null;
    if (!stored.routine || typeof stored.page !== 'string') return null;
    return stored as OnboardingSnapshot;
  } catch {
    return null;
  }
}

export function writeSnapshot(snapshot: OnboardingSnapshot) {
  try {
    localStorage.setItem(ONBOARDING_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Without storage, a reload starts again; the flow itself still works.
  }
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(ONBOARDING_SNAPSHOT_KEY);
  } catch {
    // Nothing to clear.
  }
}
