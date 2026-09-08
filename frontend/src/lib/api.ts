import { User, GoalCatalog, AuthResponse } from '../types';

const rawApiUrl = ((import.meta as any).env?.VITE_API_BASE_URL) || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

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
