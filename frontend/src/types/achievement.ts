import type { WeeklyTestResult } from './review';

export type GoalLifecycleStatus = 'active' | 'completed' | 'archived';

export interface FinalTestEvaluation {
  testType: string;
  targetDeliverable?: string;
  instructions: string;
  passCriteria?: string;
  result?: WeeklyTestResult | null;
}

export interface GoalCompletionPayload {
  finalReflection?: string;
  finalTestResult?: WeeklyTestResult | null;
}

export interface AchievementSummary {
  goalId: string;
  rawGoal: string;
  clarifiedOutcome?: string | null;
  totalDays: number; // Clamped to 90 per OD-2
  completedSessions: number;
  totalPlannedSessions: number;
  adherenceRate: number; // 0-100%
  completedWeeks: number;
  totalWeeks: number;
  benchmarksAchieved: number;
  totalBenchmarks: number;
  completedAt: string; // ISO string
}

export interface AchievementCelebrationState {
  hasViewedCelebration: boolean;
  activeTab: 'achievement' | 'results' | 'journey';
}
