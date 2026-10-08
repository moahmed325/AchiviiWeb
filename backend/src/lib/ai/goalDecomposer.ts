import { clarifyGoalWithAI, type GoalClarification } from './clarify.js';

export { clarifyGoalWithAI, type GoalClarification };

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

export const VALID_TASK_LAYERS: readonly TaskLayerType[] = ['mechanism', 'adherence', 'safety'] as const;

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
  /** v2: 1 = most important step that day, unique within the day. */
  priority?: number;
  /** ND-5: physical strain (running, lifting); such a step is dropped, never carried. */
  highLoad?: boolean;
  layer?: TaskLayerType;
  layerReasoning?: string;
  challenge?: StepChallenge;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: 'youtube_video' | 'documentation' | 'scientific_study' | 'interactive_tool' | 'guide';
  resourceWhy?: string;
}

export interface DailyTaskPlan {
  dayNumber: number;
  dayOfWeek: string;
  title: string;
  isRestDay: boolean;
  durationMinutes: number;
  slotTime: string;
  implementationIntention: string;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: 'documentation' | 'video' | 'interactive_tool' | 'guide';
  resourceWhy?: string;
  detailedSteps: DetailedStep[];
}

export interface CommitmentItem {
  id?: string;
  title: string;
  time?: string;
  category?: string;
  days?: string[];
}

export interface UserRoutineInput {
  wakeTime?: string; // e.g. "07:00"
  sleepTime?: string; // e.g. "23:00"
  busyHours?: string; // e.g. "09:00 - 17:00"
  preferredSlot?: 'morning' | 'afternoon' | 'evening';
  dailyMinutes?: number; // e.g. 30, 45, 60, 90
  planVariant?: 'steady' | 'accelerated' | 'minimal';
  commitments?: Array<CommitmentItem | string>;
}
