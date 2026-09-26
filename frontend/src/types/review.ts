import type { WeekTarget, WeekTest } from './index';

/**
 * ============================================================================
 * Canonical Weekly Review & Adaptation Types (Phase 7 — BP §17–19, §33, OD-1a)
 * ============================================================================
 *
 * Weekly review is the bridge between execution and adaptation. A short weekly
 * moment after which next week visibly reflects what really happened.
 *
 * Core Principles:
 * - "Adapt the journey, don't punish the person" (BP §18): Non-punitive copy,
 *   encouraging guidance, zero shame language regardless of completion rate.
 * - "Honest Results" (BP §17, §33, OD-1a Option A): Store actual user-entered test
 *   outcomes without modifying adaptation AI algorithms.
 * - "Future Honesty" (BP §43): No fake proof judging, no media uploads, no retargeting.
 */

/**
 * Canonical test outcome entered by the user during their weekly review.
 * Captures whether the benchmark was met and optional quantitative values or notes.
 * Formally enabled under Decision OD-1a (Option A).
 */
export interface WeeklyTestResult {
  /** Numerical value or qualitative output recorded by the user (e.g., 55, "Completed brief") */
  value: string | number;
  /** Optional unit corresponding to the metric (e.g., "wpm", "km", "pages") */
  unit?: string;
  /** Whether the user achieved the pass criteria defined in WeekTest.passIf */
  passed: boolean;
  /** Optional personal observation or context regarding the benchmark */
  note?: string;
}

/**
 * Request payload for POST /api/goal/weeks/:weekNumber/review.
 * Backward compatible: `testResult` is optional (OD-1a Option A).
 */
export interface WeeklyReviewSubmission {
  /** User's qualitative reflection on the week's execution */
  reflection: string;
  /** Optional weekly test outcome when a benchmark was evaluated */
  testResult?: WeeklyTestResult | null;
}

/**
 * Phase-gate transition details evaluated at macro-phase boundaries (e.g. Weeks 4, 8, 12).
 * Strictly phrased in encouraging, non-punitive language (BP §18).
 */
export interface WeeklyReviewPhaseGate {
  title: string;
  completedPhase: string;
  nextPhase: string;
  benchmarkMet: boolean;
  /**
   * Encouraging, non-punitive message (e.g., "Your current results suggest we should reinforce this phase.")
   */
  encouragingMessage: string;
}

/**
 * Target vs actual comparison model for honest review presentation (BP §17, §33).
 */
export interface WeeklyTargetComparison {
  targetDescription: string;
  actualDescription: string;
  matchedOrExceeded: boolean;
}

/**
 * Aggregated model for weekly review presentation and summary views.
 * Combines planned vs actual sessions, execution score, target comparisons,
 * reflection notes, AI adaptation insights, and phase-gate evaluation.
 */
export interface WeeklyReviewSummary {
  weekNumber: number;
  phaseName: string;
  theme: string;
  objective: string;
  tasksPlanned: number;
  tasksCompleted: number;
  scorePercentage: number;
  target?: WeekTarget | null;
  test?: WeekTest | null;
  testResult?: WeeklyTestResult | null;
  targetComparison?: WeeklyTargetComparison | null;
  reflection?: string;
  aiAdaptationInsight?: string;
  nextWeekNumber?: number | null;
  nextWeekFocus?: string;
  isMilestoneCheckpoint?: boolean;
  phaseGateOutcome?: WeeklyReviewPhaseGate | null;
}

/**
 * UI state machine for the Weekly Review experience across M7.2–M7.4.
 * - 'due': Review is ready and pending user engagement on Today (/)
 * - 'in_progress': User is stepping through completion, test, or reflection
 * - 'submitting': Review network request is in flight
 * - 'adapting': Server is generating the next week's plan from completions
 * - 'complete': Review processed, week advanced, next week tasks rendered
 * - 'error_503': Adaptation failed/timed out; week unchanged, retry enabled with reflection preserved
 */
export type WeeklyReviewState =
  | 'due'
  | 'in_progress'
  | 'submitting'
  | 'adapting'
  | 'complete'
  | 'error_503';

/**
 * Steps within the multi-stage weekly review modal flow (M7.2).
 */
export type WeeklyReviewStep =
  | 'overview'
  | 'test_entry'
  | 'reflection'
  | 'adaptation_reveal'
  | 'milestone_gate';
