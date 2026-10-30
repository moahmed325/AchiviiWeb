/**
 * Progression and rendering status across steps, weeks, and phases.
 */
export type JourneyStatus = 'completed' | 'active' | 'upcoming' | 'locked';

/**
 * Step representation within the Journey (Days 1–84, or closing stretch).
 */
export interface JourneyStep {
  dayNumber: number; // 1 to 90
  dayOfWeek?: string;
  title: string;
  durationMinutes?: number;
  status: JourneyStatus;
  isRestDay?: boolean;
  isKeySession?: boolean;
  isTestDay?: boolean;
  whyToday?: string | null;
  taskId?: string;
}

/**
 * Week representation within a Phase (Weeks 1–12).
 * Follows future honesty: only the current week has written tasks in v2.
 */
export interface JourneyWeek {
  weekNumber: number; // 1 to 12
  title: string;
  phaseId: string;
  phaseName: string;
  theme?: string;
  focus?: string;
  keyMilestone?: string;
  status: JourneyStatus;
  executionScore?: number;
  /** Weekly update M1.5b (WU-40 (1)): jumped past the limit; shown muted as "Paused", no score, never a week done. */
  jumped?: boolean;
  days: JourneyStep[];
  isCurrentWeek: boolean;
  hasWrittenTasks: boolean;
}

/**
 * Phase representation within the Journey.
 * v2 goals have 2–4 method-named phases; v1 goals have 3 fixed phases.
 */
export interface JourneyPhase {
  id: string;
  index: number; // 1-based (1..4)
  name: string;
  purpose?: string;
  startWeek: number;
  endWeek: number;
  weeksLabel: string;
  status: JourneyStatus;
  weeks: JourneyWeek[];
}

/**
 * Days 85–90 Closing Stretch (OD-2 Option A).
 * Follows the last week: reflection and arrival at the destination (no final test since 2026-10-30).
 */
export interface JourneyClosingStretch {
  startDay: number; // 85
  endDay: number; // 90
  finalGoal: string;
  status: JourneyStatus;
  isCurrent: boolean;
}

/**
 * High-level metrics for the quick numerical layer (VDS §9 Layer 1).
 */
export interface JourneyProgressMetrics {
  currentDay: number; // 1 to 90
  totalDays: number; // 90
  currentWeek: number; // 1 to 12
  totalWeeks: number; // 12
  currentPhaseIndex: number;
  totalPhases: number;
  completedTasksCount: number;
  percentComplete: number;
}

/**
 * Canonical Journey Model uniting v1 and v2 goal structures.
 * Supports the 3 progress layers (VDS §9):
 * 1. Quick numerical (Day N / 90)
 * 2. Emotional staircase (daily steps, phase landings, destination)
 * 3. Strategic roadmap (honest future week milestones)
 */
export interface JourneyData {
  goalId: string;
  rawGoal: string;
  clarifiedOutcome: string;
  finalGoal: string;
  methodName?: string;
  methodAuthor?: string;
  phases: JourneyPhase[];
  closingStretch: JourneyClosingStretch;
  metrics: JourneyProgressMetrics;
}
