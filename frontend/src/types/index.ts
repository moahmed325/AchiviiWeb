export interface User {
  id: string;
  email: string;
  timezone?: string;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  subtitle: string;
  options: string[];
  allowCustom: boolean;
  /** Shown once if the user skips the question the first time. */
  retry?: { question: string; subtitle: string };
}

export interface EvidencePillar {
  title: string;
  subtitle: string;
  tag: string;
  coreRule: string;
  realWorldApplication: string;
}

export interface EvidenceTriad {
  science: EvidencePillar;
  socialAdherence: EvidencePillar;
  proCoaching: EvidencePillar;
}

export interface GoalClarification {
  clarifiedOutcome: string;
  primaryDomain: string;
  followUpQuestions: FollowUpQuestion[];
  evidenceTriad?: EvidenceTriad;
}

export interface CommitmentItem {
  id: string;
  title: string;
  time?: string;
  category?: 'fitness' | 'education' | 'commute' | 'family' | 'sports' | 'work' | 'other';
  days?: string[];
}

export interface RoutineSettings {
  wakeTime: string; // e.g. "07:00"
  sleepTime: string; // e.g. "23:00"
  busyHours: string; // e.g. "09:00 - 17:00"
  preferredSlot: 'morning' | 'afternoon' | 'evening';
  dailyMinutes: number; // 30, 45, 60, 90
  planVariant?: 'steady' | 'accelerated' | 'minimal';
  commitments?: CommitmentItem[];
}

export type ResourceType =
  | 'youtube_video'
  | 'documentation'
  | 'scientific_study'
  | 'interactive_tool'
  | 'guide'
  | 'video';

export type ChallengeType = 'repetitions' | 'active_recall' | 'checklist' | 'exercise';

export interface RepetitionsChallenge {
  type: 'repetitions';
  drillName: string;
  targetCount: number;
  totalSets: number;
  unit: string; // e.g. "reps", "seconds", "measures", "rounds"
}

export interface ActiveRecallChallenge {
  type: 'active_recall';
  question: string;
  hint?: string;
  keyTakeaway: string;
}

export interface ChecklistChallenge {
  type: 'checklist';
  items: Array<{ id: string; label: string }>;
}

export interface ExerciseChallenge {
  type: 'exercise';
  prompt: string;
  targetDeliverable: string;
  evaluationCriteria: string;
}

export type StepChallenge =
  | RepetitionsChallenge
  | ActiveRecallChallenge
  | ChecklistChallenge
  | ExerciseChallenge;

export type TaskLayerType = 'mechanism' | 'adherence' | 'safety';

export interface DetailedStep {
  stepNumber: number;
  title: string;
  durationMinutes: number;
  instructions: string;
  focusCue: string;
  pitfallToAvoid: string;
  /** The measurable standard that counts the step as done. */
  passMark?: string;
  /** What the user ends up with: a count, a recording, a finished piece. */
  output?: string;
  /** Only when the step can't follow the previous one straight away, e.g. "4 hours after mixing". */
  timing?: string;
  layer?: TaskLayerType;
  layerReasoning?: string;
  challenge?: StepChallenge;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: ResourceType;
  resourceWhy?: string;
  /** Method-aware recovery RULE-10: the step picks up where this missed day stopped. Stored inside `detailedSteps`. */
  continueFrom?: { taskId: string; date: string };
  /** RULE-20: a reorder placed this step here; the day it was written on. Stored inside `detailedSteps`. */
  shiftedFrom?: { taskId: string; date: string; replaced?: unknown[]; stepNumber?: number };
}

/** One day as `POST /api/goal/reconcile` classifies it (missed sessions M1.2/M1.3). Derived, never stored. */
export interface ReconcileDay {
  taskId: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  isKeySession: boolean;
  isTestDay: boolean;
  /** `not_offered` (weekly update WU-33): the day passed before its week was written; shown like a rest day. */
  kind: 'done' | 'missed' | 'rest' | 'planned' | 'not_offered';
}

/** A carry the backend planned or wrote (M2.2). Only the fields the UI reads are typed. */
export interface ReconcileCarry {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string;
  toDate: string;
}

/** Why a missed day's step was not carried (M2.2). Data, never shown to the user. */
export type ReconcileDropReason =
  | 'no_receiving_day'
  | 'receiving_day_closed'
  | 'receiving_day_done'
  | 'receiving_day_taken'
  | 'lost_to_later_miss'
  | 'in_gap'
  | 'high_load'
  | 'does_not_fit'
  | 'swap_unanswered'
  | 'no_priority_step';

/** The carry-forward plan in a plan v2 reconcile response (backend `ReconcileBody['carry']`). */
export interface ReconcileCarryPlan {
  /** Whether MISSED_SESSIONS_CARRY_ENABLED is on (ND-15). */
  enabled: boolean;
  carries: ReconcileCarry[];
  drops: { taskId: string; date: string; reason: ReconcileDropReason }[];
  held: { taskId: string; date: string; receivingTaskId: string; offerUntil: string }[];
  alreadyCarried: ReconcileCarry[];
  /** Carries this request actually stored. */
  written: ReconcileCarry[];
  /*
   * Method-aware recovery: the fields below are present only when METHOD_RECOVERY_ENABLED is on (backend
   * `RecoveryPlan`, `WrittenRecovery`, `PlanChoices`). Only what the UI reads is typed in detail. The week counts
   * (RULE-17) are never shown (AC-9).
   */
  outcomes?: ReconcileDayOutcome[];
  continues?: ReconcileContinue[];
  alreadyContinued?: ReconcileContinue[];
  writtenContinues?: ReconcileContinue[];
  reorders?: unknown[];
  writtenReorders?: unknown[];
  easyStart?: unknown;
  writtenEasyStart?: unknown;
  /** RULE-16 (M3.2): what the person may do. With the carry switch off it is `{ today: null, held: [] }`. */
  choices?: ReconcileChoices;
}

/** What happened to a missed day (backend `RecoveryOutcome`, RULE-15). */
export type RecoveryOutcome = 'moved' | 'continued' | 'let_go' | 'fixed' | 'no_room' | 'held' | 'in_gap' | 'next_week' | 'left_out';

export interface ReconcileDayOutcome {
  taskId: string;
  date: string;
  rules: 'method' | 'missed_sessions';
  outcome: RecoveryOutcome;
  topStep: RecoveryOutcome;
}

/** A continue marker planned, stored earlier, or written (RULE-10). */
export interface ReconcileContinue {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string;
  toDate: string;
  stepTitle: string;
}

export interface ReconcileChoices {
  /** Today's open practice day, or null. */
  today: { taskId: string; setAside: boolean; swapWith: string[] } | null;
  /** Each key session held for its swap offer; `moveNowTaskId` is null when "move now" would not move it. */
  held: { taskId: string; receivingTaskId: string; moveNowTaskId: string | null }[];
}

/**
 * The miss line's day and what happened to it (backend `LineSignal`, M3.3). `carried` and `dropped` are a day under
 * missed sessions' rules; the others follow its method outcome. `toDate` names the receiving day, when there is one.
 */
export type ReconcileLineKind = 'carried' | 'dropped' | 'moved' | 'moved_in_order' | 'continued' | 'let_go' | 'fixed' | 'no_room' | 'next_week' | 'left_out';

export interface ReconcileLine {
  kind: ReconcileLineKind;
  taskId: string;
  date: string;
  toTaskId: string | null;
  toDate: string | null;
}

/** Mirrors backend `MissedSignals` (lib/missedSignals.ts, M2.3). Derived on every call, never stored (ND-16). */
export interface MissedSignals {
  carried: { fromDate: string; fromTaskId: string; toDate: string; toTaskId: string; stepTitle: string }[];
  dropped: { date: string; taskId: string; reason: ReconcileDropReason }[];
  swapOffer: { missedTaskId: string; missedDate: string; receivingTaskId: string; receivingDate: string; offerUntil: string } | null;
  shortOnTime: boolean;
  gentleReturn: { gapLength: number; firstDate: string; lastDate: string } | null;
  /** The one line to show, or null. `method` (M3.3) only with METHOD_RECOVERY_ENABLED on. */
  notice: 'gentle_return' | 'swap_offer' | 'carried' | 'dropped' | 'method' | null;
  /** M3.3: present only with METHOD_RECOVERY_ENABLED on; the line's day when `notice` is carried, dropped or method. */
  line?: ReconcileLine | null;
}

/** Response of `POST /api/goal/reconcile`. Only active plan v2 goals are classified. */
export type ReconcileResult =
  | { applies: false; reason: 'no_active_goal' | 'not_plan_v2' }
  | {
      applies: true;
      goalId: string;
      asOf: string;
      timezone: string;
      days: ReconcileDay[];
      gap: { firstDate: string; lastDate: string; length: number; taskIds: string[] } | null;
      carry: ReconcileCarryPlan;
      signals: MissedSignals;
    };

/** A plan v2 reconcile body (`applies: true`), as GoalContext keeps it. */
export type Reconciliation = Extract<ReconcileResult, { applies: true }>;

export interface DailyTask {
  id: string;
  goalId: string;
  weekNumber: number;
  dayNumber: number;
  date: string;
  dayOfWeek: string;
  title: string;
  detailedSteps: string; // JSON string of DetailedStep[]
  implementationIntention: string;
  durationMinutes: number;
  slotTime?: string;
  isRestDay: boolean;
  /** Weekly update WU-13: the day passed before its week was written. Never missed; shown like a rest day. */
  notOffered?: boolean;
  status: 'pending' | 'completed';
  completedAt?: string;
  notes?: string;
  /** v2: a 10-minute minimum version for low-time/low-energy days. */
  minimumVersion?: DetailedStep | null;
  /** ND-3: true when the completion was the 10-minute version only. */
  usedMinimumVersion?: boolean;
  isKeySession?: boolean;
  isTestDay?: boolean;
  whyToday?: string | null;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: ResourceType;
  resourceWhy?: string;
  created_at: string;
}

export type WeekTarget =
  | { kind: 'number'; metric: string; value: number; unit: string; direction: 'higher_is_better' | 'lower_is_better' }
  | { kind: 'deliverable'; description: string };

export interface WeekTest {
  type: 'typing_test' | 'quiz' | 'timer' | 'count' | 'photo' | 'video';
  instructions: string;
  passIf: string;
  /**
   * Weekly update M2.1 (RULE-19, WU-43): a light test, logged as done plus a note, never against the target; the week's
   * target is then the next check's (`lib/lightTest.ts`). Missing means false (goals created before M2.1, custom goals).
   */
  light?: boolean;
}

export interface RoadmapWeek {
  id: string;
  goalId: string;
  weekNumber: number;
  /** v1 goals: Foundation / Acceleration / Mastery. v2 goals: the method's own phase names. */
  phase: string;
  theme: string;
  objective: string;
  keyMilestone: string;
  targetIntensity: number;
  plannedMinutes: number;
  status: 'active' | 'pending' | 'completed' | 'adapted';
  executionScore?: number;
  reviewNotes?: string;
  target?: WeekTarget | null;
  test?: WeekTest | null;
  testResult?: import('./review').WeeklyTestResult | null;
  /** Weekly update (WU-21, M1.2a): who closed the week and when; null while it is open. */
  closedBy?: 'review' | 'auto' | 'jumped' | null;
  closedAt?: string | null;
  /** Weekly update M1.5b (WU-19, WU-40 (1)): skipped by "Keep going" past the limit; shown as "Paused", never scored. */
  jumped?: boolean;
  /** WU-28: when the automatic close's line was dismissed; it never shows again once set. */
  closeLineSeenAt?: string | null;
  created_at: string;
}

export interface RoadmapPhase {
  name: string;
  startWeek: number;
  endWeek: number;
  purpose: string;
}

export interface GoalRoadmap {
  finalGoal: string;
  finalTest: string;
  startingPoint: { value: number | null; description: string };
  method: {
    name: string;
    creator: string;
    summary: string;
    whyChosen: string;
    runnerUp: { name: string; whyLost: string } | null;
    safety: number;
    rules: string[];
  };
  phases: RoadmapPhase[];
}

export interface PlanAnswer {
  id: string;
  question: string;
  answer: string;
}

export interface WeeklyReview {
  id: string;
  goalId: string;
  weekNumber: number;
  tasksPlanned: number;
  tasksCompleted: number;
  scorePercentage: number;
  reflection?: string;
  aiAdaptationInsight?: string;
  created_at: string;
}

/**
 * Plan safety limits M1.3 (PSL-12): sent by the server when week 12's target was lowered to a safe step. `safe` is week
 * 12's value and `goal` the number the person named that it no longer meets (null when they named none), each as
 * amount and unit.
 */
export interface Week12Line {
  safe: string;
  goal: string | null;
}

export interface Goal {
  id: string;
  userId: string;
  rawGoal: string;
  clarifiedOutcome: string;
  methodologyNotes: string;
  methodKind?: string | null;
  methodConfidence?: string | null;
  canonicalMethodName?: string | null;
  canonicalAuthority?: string | null;
  basis?: { label: string; anchored: boolean } | null;
  status: 'active' | 'completed' | 'paused' | 'archived';
  startDate: string;
  targetDate: string;
  currentWeek: number;
  answers: string; // JSON string
  routine: string; // JSON string
  planVersion?: number;
  roadmap?: GoalRoadmap | null;
  created_at: string;
  updated_at: string;
  completedAt?: string | null;
  roadmapWeeks?: RoadmapWeek[];
  dailyTasks?: DailyTask[];
  weeklyReviews?: WeeklyReview[];
  /** M1.3 (PSL-12): the honest week 12 line's numbers; null or missing when week 12 was not lowered. */
  week12Line?: Week12Line | null;
  /** Weekly update M3.3b (WU-58 (1)): the open week's re-test, worked out on the server; null or missing when none. */
  retest?: Retest | null;
  /** Weekly update M3.3b (RULE-6, WU-58 (1)): the daily-time question after two hard weeks; null or missing when none. */
  dailyTimeCheck?: DailyTimeCheck | null;
}

export interface Retest {
  /** The closed week whose test the open week re-tests; its result is stored on that week (WU-17). */
  ofWeek: number;
  reason: 'not_logged' | 'two_hard_weeks';
  /** The re-test's result was logged in the open week. */
  logged: boolean;
}

export interface DailyTimeCheck {
  /** The current daily time. */
  minutes: number;
  /** The shorter daily-time options, ascending. */
  shorter: number[];
}

export interface CreateGoalPayload {
  rawGoal: string;
  clarifiedOutcome: string;
  answers: Record<string, string>;
  /** Answers by question id, so the roadmap prompt knows which is which. */
  answerList?: PlanAnswer[];
  domain?: string;
  routine: RoutineSettings;
  startDate?: string;
}

export interface CreateGoalResponse {
  goal: Goal;
  roadmapWeeks: RoadmapWeek[];
  dailyTasks: DailyTask[];
}

/**
 * Weekly update M1.2a/M1.2b: what `POST /api/goal/close-week` answers. Not due (switch off, nothing due, or a lost
 * race); due in check mode; or a close, which also carries the review's answer fields.
 */
/** Weekly update M1.5b (WU-37, WU-38): the choice a break past the limit waits for, next to "Start a fresh plan". */
export type PastLimitChoice = 'keep_going' | 'final_week';

export type CloseWeekAnswer =
  | { due: false; alreadyClosed?: boolean; weekNumber?: number }
  | {
      due: true;
      weekNumber: number;
      testLogged: boolean;
      /** M1.5b (WU-39): the close is a break (a gap of 7 days or more), so no test card is shown. */
      break?: boolean;
      /** M1.5b (WU-38): the choice the close waits for; null when none is needed. */
      choice?: PastLimitChoice | null;
      closedBy?: undefined;
    }
  | ({ due: true; closedBy: 'auto' } & WeeklyReviewResponse);

export interface WeeklyReviewResponse {
  review: WeeklyReview;
  scorePercentage: number;
  nextWeekNumber: number | null;
  nextWeekTasks: DailyTask[];
  isMilestoneCheckpoint?: boolean;
  milestoneGateTransition?: {
    title: string;
    completedPhase: string;
    nextPhase: string;
    /** WU-33 (3): null for a week with no score (every day not offered): no benchmark. */
    benchmarkMet: boolean | null;
  } | null;
  testResult?: import('./review').WeeklyTestResult | null;
}

export * from './journey';
export * from './review';
export * from './achievement';

