import { User, GoalCatalog, AuthResponse } from '../types';

export function resolveApiBaseUrl(): string {
  // Default to localhost:5000 when in Vite dev mode or connected via localhost / 127.0.0.1
  const isDev = Boolean((import.meta as any).env?.DEV);
  const isLocalHost = typeof window !== 'undefined' && (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1');

  if (isDev || isLocalHost) {
    const devEnvUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
    if (devEnvUrl && typeof devEnvUrl === 'string' && devEnvUrl.trim() !== '') {
      return devEnvUrl.replace(/\/+$/, '');
    }
    return 'http://localhost:5000';
  }

  // In cloud production deployment (non-localhost), target configured URL or Render fallback
  const prodEnvUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
  if (prodEnvUrl && typeof prodEnvUrl === 'string' && prodEnvUrl.trim() !== '') {
    return prodEnvUrl.replace(/\/+$/, '');
  }

  return 'https://achivii-api.onrender.com';
}

const API_BASE_URL = resolveApiBaseUrl();

export interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
}

export async function fetchHealthCheck(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }

  return response.json();
}

export async function fetchCatalog(): Promise<GoalCatalog[]> {
  const response = await fetch(`${API_BASE_URL}/api/catalog`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load goal catalog (${response.status})`);
  }

  const data = await response.json();
  return data.goals || [];
}

export async function fetchGoalById(id: string): Promise<GoalCatalog> {
  const response = await fetch(`${API_BASE_URL}/api/catalog/${id}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load goal details (${response.status})`);
  }

  const data = await response.json();
  return data.goal;
}

export async function signupUser(email: string, password: string, timezone?: string): Promise<AuthResponse> {
  const resolvedTimezone = timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') || 'UTC';
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, timezone: resolvedTimezone }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data;
}

export async function fetchCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to authenticate');
  }

  return data.user;
}

/**
 * @deprecated Phase 15: Replace with `commitGoal()` from `lib/adaptiveApi.ts`.
 * The adaptive system replaces static schedule generation with Adaptive Trajectory v1.
 */
export async function submitOnboarding(token: string, payload: import('../types').OnboardingPayload): Promise<import('../types').OnboardingResponse> {
  const resolvedPayload = {
    ...payload,
    timezone: payload.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') || 'UTC',
  };
  const response = await fetch(`${API_BASE_URL}/api/onboarding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(resolvedPayload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to save onboarding configuration');
  }

  return data;
}

export async function fetchCurrentUserGoal(token: string): Promise<import('../types').CurrentGoalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/user-goal/current`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load active goal');
  }

  return data;
}

/**
 * @deprecated Phase 16: Replace with `fetchAdaptiveDashboard()` from `lib/adaptiveApi.ts`.
 * The adaptive system replaces static week sessions with trajectory-derived execution objects.
 */
export async function fetchWeekSessions(token: string, weekOffset?: number): Promise<import('../types').WeekSessionsResponse> {
  const query = typeof weekOffset === 'number' ? `?weekOffset=${weekOffset}` : '';
  const response = await fetch(`${API_BASE_URL}/api/sessions/week${query}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load week sessions');
  }

  return data;
}

/**
 * @deprecated Phase 18: Eliminated entirely. The adaptive system uses continuous trajectories;
 * there is no discrete "regenerate schedule" action.
 */
export async function regenerateSchedule(token: string): Promise<{ message: string; sessionCount: number }> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate schedule');
  }

  return data;
}

/**
 * @deprecated Phase 17: Replace with `recordSessionTelemetry()` from `lib/adaptiveApi.ts`.
 * The adaptive system records execution truth (COMPLETED, REDUCED, MVS, MISSED) via telemetry,
 * not by patching session status fields.
 */
export async function updateSession(
  token: string,
  sessionId: string,
  updates: {
    status?: 'UPCOMING' | 'DONE' | 'MISSED' | 'RESCHEDULED';
    scheduled_date?: string;
    start_time?: string;
    end_time?: string;
  }
): Promise<{ message: string; session: import('../types').Session }> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update session');
  }

  return data;
}

/**
 * @deprecated Phase 17: Replace with `fetchAdaptiveDashboard()` + trajectory projection from `lib/adaptiveApi.ts`.
 * The adaptive system derives daily execution objects from the active trajectory, not static session rows.
 */
export async function fetchDaySessions(
  token: string,
  dateStr: string
): Promise<{
  date: string;
  dayKey: string;
  sessions: import('../types').Session[];
  availabilitySlots: import('../types').AvailabilitySlot[];
}> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/day?date=${dateStr}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load day schedule');
  }

  return data;
}

/**
 * @deprecated Phase 17: Eliminated. Rescheduling is now auto-triggered by the telemetry/diagnosis pipeline.
 * Use `recordSessionTelemetry()` + `submitDiagnosis()` from `lib/adaptiveApi.ts` instead.
 */
export async function triggerReschedule(
  token: string,
  sessionId?: string
): Promise<import('../types').RescheduleResponse> {
  const response = await fetch(`${API_BASE_URL}/api/sessions/reschedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(sessionId ? { sessionId } : {}),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to trigger adaptive rescheduling');
  }

  return data;
}

/**
 * @deprecated Phase 16: Replace with `fetchAdaptiveDashboard()` from `lib/adaptiveApi.ts`.
 * The adaptive dashboard provides capability-state-based progress, not checklist completion rates.
 */
export async function fetchGoalProgress(token: string): Promise<import('../types').GoalProgressResponse> {
  const response = await fetch(`${API_BASE_URL}/api/progress`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load goal progress');
  }

  return data;
}

/**
 * @deprecated Phase 17: Replace with `fetchPendingDiagnosis()` from `lib/adaptiveApi.ts`.
 * The adaptive system replaces binary recovery with 6-category diagnostic root-cause analysis.
 */
export async function fetchPendingRecovery(token: string): Promise<import('../types').PendingRecoveryState> {
  const response = await fetch(`${API_BASE_URL}/api/recovery/pending`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load recovery state');
  }

  return data;
}

/**
 * @deprecated Phase 17: Replace with `submitDiagnosis()` from `lib/adaptiveApi.ts`.
 * The adaptive system replaces fixed recovery choices with evidence-based diagnostic submission
 * that triggers the Adaptive Rescheduler's No-Debt replan.
 */
export async function submitRecoveryAction(
  token: string,
  payload: {
    user_goal_id: string;
    choice: 'shrink_week' | 'shift_timeline' | 'scope_reduction' | 'pause_goal';
    details?: any;
  }
): Promise<{ success: boolean; choice: string; recoveryEventId: string; resultingAdjustment: any }> {
  const response = await fetch(`${API_BASE_URL}/api/recovery/action`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit recovery choice');
  }

  return data;
}

/**
 * @deprecated Phase 18: Replace with `fetchWeeklyReview()` from `lib/adaptiveApi.ts`.
 * The adaptive system replaces subjective reflection with the 7-question Weekly Strategic Review.
 */
export async function fetchPendingWeeklyReflection(
  token: string,
  threshold?: number
): Promise<import('../types').PendingReflectionState> {
  const url = threshold
    ? `${API_BASE_URL}/api/reflection/pending?threshold=${threshold}`
    : `${API_BASE_URL}/api/reflection/pending`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load weekly reflection');
  }

  return data;
}

/**
 * @deprecated Phase 18: Replace with `fetchWeeklyReview()` from `lib/adaptiveApi.ts`.
 * The adaptive Weekly Strategic Review is auto-generated from ground-truth telemetry.
 */
export async function submitWeeklyReflection(
  token: string,
  payload: {
    user_goal_id: string;
    week_number: number;
    reflection_type: 'single_tap' | 'full';
    responses?: any;
  }
): Promise<{ success: boolean; weeklyReview: any }> {
  const response = await fetch(`${API_BASE_URL}/api/reflection/response`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit weekly reflection');
  }

  return data;
}


/**
 * @deprecated Phase 18: Replace with `verifyOutcomeGate()` from `lib/adaptiveApi.ts`.
 * The adaptive system uses evidence-verified Outcome Gate instead of checklist-based graduation.
 */
export async function fetchGraduationStatus(
  token: string,
  userGoalId?: string
): Promise<import('../types').GraduationState> {
  const url = userGoalId
    ? `${API_BASE_URL}/api/graduation/status?user_goal_id=${userGoalId}`
    : `${API_BASE_URL}/api/graduation/status`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to check graduation status');
  }

  return data;
}

/**
 * @deprecated Phase 18: Replace with `verifyOutcomeGate()` from `lib/adaptiveApi.ts`.
 * Goal completion is now determined by objective evidence, not graduation choices.
 */
export async function submitGraduationChoice(
  token: string,
  userGoalId: string,
  choice: 'start_new_goal' | 'maintenance_mode' | 'pause'
): Promise<{
  success: boolean;
  choice: string;
  status: string;
  message: string;
  user_goal: any;
}> {
  const response = await fetch(`${API_BASE_URL}/api/graduation/choice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_goal_id: userGoalId, choice }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit graduation choice');
  }

  return data;
}

export async function resumeGoal(
  token: string,
  userGoalId: string
): Promise<{
  success: boolean;
  user_goal: any;
  days_paused: number;
  new_target_end_date: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/graduation/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_goal_id: userGoalId }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to resume goal');
  }

  return data;
}

export async function fetchLearnedDefaults(
  token: string
): Promise<import('../types').OnboardingLearnedDefaults> {
  const response = await fetch(`${API_BASE_URL}/api/profile/learned-defaults`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load learned defaults');
  }

  return data;
}

export async function fetchAggregatedProfile(
  token: string
): Promise<{
  best_working_hours: {
    preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'flexible';
    peak_hour_window: { start: string; end: string };
    days_distribution: Record<string, number>;
    average_session_duration_minutes: number;
    total_completed_sessions: number;
    last_updated: string;
  };
  lapse_pattern_summary: {
    total_recovery_events: number;
    frequent_trigger: string;
    preferred_recovery_choice: string;
    circuit_breaker_count: number;
    recovery_choices_breakdown: Record<string, number>;
    last_updated: string;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/api/profile/aggregate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load aggregated profile telemetry');
  }

  return data;
}

export async function discardGoal(
  token: string,
  goalId?: string
): Promise<{ success: boolean; message: string; discarded_goal_id?: string }> {
  const endpoint = goalId ? `${API_BASE_URL}/api/goals/${goalId}` : `${API_BASE_URL}/api/goals/current`;
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to discard goal');
  }

  return data;
}


