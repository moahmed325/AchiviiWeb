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
}

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
  status: 'pending' | 'completed' | 'skipped';
  completedAt?: string;
  notes?: string;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: ResourceType;
  resourceWhy?: string;
  /** v2 goals only. */
  isKeySession?: boolean;
  isTestDay?: boolean;
  whyToday?: string | null;
  minimumVersion?: DetailedStep | null;
  created_at: string;
}

export type WeekTarget =
  | { kind: 'number'; metric: string; value: number; unit: string; direction: 'higher_is_better' | 'lower_is_better' }
  | { kind: 'deliverable'; description: string };

export interface WeekTest {
  type: 'typing_test' | 'quiz' | 'timer' | 'count' | 'photo' | 'video';
  instructions: string;
  passIf: string;
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
  roadmapWeeks?: RoadmapWeek[];
  dailyTasks?: DailyTask[];
  weeklyReviews?: WeeklyReview[];
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
    benchmarkMet: boolean;
  } | null;
}

export * from './journey';

