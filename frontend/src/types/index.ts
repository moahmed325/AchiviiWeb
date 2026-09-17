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

export interface ScientificFramework {
  name: string;
  description: string;
  application: string;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  subtitle: string;
  options: string[];
  allowCustom: boolean;
}

export interface GoalClarification {
  clarifiedOutcome: string;
  primaryDomain: string;
  capabilities?: string[];
  scientificFrameworks: ScientificFramework[];
  verificationCriteria: string;
  followUpQuestions: FollowUpQuestion[];
}

export interface RoutineSettings {
  wakeTime: string; // e.g. "07:00"
  sleepTime: string; // e.g. "23:00"
  busyHours: string; // e.g. "09:00 - 17:00"
  preferredSlot: 'morning' | 'afternoon' | 'evening';
  dailyMinutes: number; // 30, 45, 60, 90
  planVariant?: 'steady' | 'accelerated' | 'minimal';
}

export type ResourceType =
  | 'youtube_video'
  | 'documentation'
  | 'scientific_study'
  | 'interactive_tool'
  | 'guide'
  | 'video';

export interface DetailedStep {
  stepNumber: number;
  title: string;
  durationMinutes: number;
  instructions: string;
  focusCue: string;
  pitfallToAvoid: string;
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
  created_at: string;
}

export interface RoadmapWeek {
  id: string;
  goalId: string;
  weekNumber: number;
  phase: 'Foundation' | 'Acceleration' | 'Mastery';
  theme: string;
  objective: string;
  keyMilestone: string;
  targetIntensity: number;
  plannedMinutes: number;
  status: 'active' | 'pending' | 'completed' | 'adapted';
  executionScore?: number;
  reviewNotes?: string;
  created_at: string;
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
  status: 'active' | 'completed' | 'paused' | 'archived';
  startDate: string;
  targetDate: string;
  currentWeek: number;
  answers: string; // JSON string
  routine: string; // JSON string
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
}
