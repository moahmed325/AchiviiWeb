export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface User {
  id: string;
  email: string;
  timezone?: string;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  phase_id: string;
  title: string;
  sessions_per_week: number;
  session_duration_minutes: number;
  preferred_time_of_day?: 'morning' | 'afternoon' | 'evening' | string | null;
  phase?: Phase;
}

export interface Phase {
  id: string;
  goal_catalog_id: string;
  phase_order: number;
  title: string;
  duration_weeks: number;
  task_templates: TaskTemplate[];
}

export interface GoalCatalog {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  est_weekly_hours: number;
  created_at: string;
  phases: Phase[];
}

export interface AvailabilitySlot {
  id?: string;
  user_id?: string;
  day_of_week: DayOfWeek;
  start_time: string; // e.g. "09:00"
  end_time: string;   // e.g. "17:00"
  label?: string | null;
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_catalog_id: string;
  start_date: string;
  target_end_date: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  slippage_days: number;
  goal_catalog?: GoalCatalog;
}

export interface Session {
  id: string;
  user_goal_id: string;
  task_template_id: string;
  scheduled_date: string; // ISO string
  start_time: string;     // HH:MM
  end_time: string;       // HH:MM
  status: 'UPCOMING' | 'DONE' | 'MISSED' | 'RESCHEDULED';
  task_template?: TaskTemplate;
}

export interface WeekSessionsResponse {
  weekOffset: number;
  weekNumber: number;
  totalWeeks: number;
  startDate: string;
  endDate: string;
  phase: Phase;
  goal: {
    id: string;
    title: string;
    slippage_days: number;
    start_date: string;
    target_end_date: string;
  };
  sessions: Session[];
  availabilitySlots: AvailabilitySlot[];
  pendingRecovery?: PendingRecoveryState | null;
}

export interface PendingRecoveryState {
  pending: boolean;
  user_goal_id: string;
  tier?: 'TIER_2_PENDING';
  reason?: 'CONSECUTIVE_DAYS_MISSED' | 'NO_FREE_SLOTS' | 'MANUAL';
  consecutive_missed_days?: number;
  missed_session_count?: number;
  rolling_28_day_events: number;
  circuit_breaker_active: boolean;
  options?: ('shrink_week' | 'shift_timeline' | 'scope_reduction' | 'pause_goal')[];
}

export interface OnboardingPayload {
  goal_catalog_id: string;
  start_date: string;
  availability_slots: AvailabilitySlot[];
  timezone?: string;
}

export interface OnboardingResponse {
  message: string;
  user_goal: UserGoal;
  availability_slots: AvailabilitySlot[];
  sessions_generated?: number;
}

export interface CurrentGoalResponse {
  user_goal: UserGoal | null;
  availability_slots: AvailabilitySlot[];
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface CatalogResponse {
  goals: GoalCatalog[];
}

export interface RescheduleAction {
  sessionId: string;
  taskTitle: string;
  originalDate: string;
  originalTime: string;
  newDate: string;
  newTime: string;
  actionType: 'REALLOCATED_SAME_WEEK' | 'SHIFTED_NEXT_WEEK';
  details: string;
}

export interface RescheduleResult {
  missedDetectedCount: number;
  rescheduledCount: number;
  sameWeekReallocatedCount: number;
  planShiftCount: number;
  slippageDaysAdded: number;
  totalSlippageDays: number;
  guardrailTriggered: boolean;
  actions: RescheduleAction[];
}

export interface RescheduleResponse {
  message: string;
  result: RescheduleResult;
}

export type PaceStatus = 'ON_TRACK' | 'BEHIND_PACE' | 'GUARDRAIL_ALERT';

export interface PhaseProgressBreakdown {
  id: string;
  phase_order: number;
  title: string;
  duration_weeks: number;
  totalSessions: number;
  completedSessions: number;
  completionPercentage: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
  taskTemplates: {
    id: string;
    title: string;
    sessions_per_week: number;
    session_duration_minutes: number;
  }[];
}

export interface GoalProgressResponse {
  goal: {
    id: string;
    title: string;
    description: string;
    category: string;
    icon: string;
    startDate: string;
    originalTargetDate: string;
    projectedTargetDate: string;
    slippageDays: number;
    daysElapsed: number;
    daysRemaining: number;
    paceStatus: PaceStatus;
  };
  metrics: {
    totalSessions: number;
    completedSessions: number;
    upcomingSessions: number;
    rescheduledSessions: number;
    missedSessions: number;
    completionPercentage: number;
    completedHours: number;
    totalHours: number;
    currentWeek: number;
    totalWeeks: number;
    currentPhase: PhaseProgressBreakdown | null;
  };
  phaseBreakdown: PhaseProgressBreakdown[];
  recentActivity: {
    id: string;
    taskTitle: string;
    scheduledDate: string;
    startTime: string;
    endTime: string;
    status: string;
  }[];
}
