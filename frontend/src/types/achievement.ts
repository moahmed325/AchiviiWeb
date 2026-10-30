export type GoalLifecycleStatus = 'active' | 'completed' | 'archived';

export interface GoalCompletionPayload {
  finalReflection?: string;
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
  completedAt: string; // ISO string
}

export interface AchievementCelebrationState {
  hasViewedCelebration: boolean;
  activeTab: 'achievement' | 'results' | 'journey';
}
