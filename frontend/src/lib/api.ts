import { User, AuthResponse } from '../types';

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

/** An error response from the API. `status` lets screens tell apart, say, a duplicate email (409) from a server fault. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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

export async function signupUser(email: string, password: string, timezone?: string): Promise<AuthResponse> {
  const resolvedTimezone = timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') || 'UTC';
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, timezone: resolvedTimezone }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(data.error || 'Registration failed', response.status);
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
    throw new ApiError(data.error || 'Login failed', response.status);
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

export async function clarifyGoal(rawGoal: string): Promise<import('../types').GoalClarification> {
  const response = await fetch(`${API_BASE_URL}/api/goal/clarify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawGoal }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to clarify goal');
  }

  return data;
}

export interface PlanProgressEvent {
  type: 'step';
  id: 'search' | 'method' | 'plan';
  label: string;
  detail?: string;
  elapsedMs: number;
  slow: boolean;
}

export async function createGoalPlan(
  payload: import('../types').CreateGoalPayload,
  token: string,
  onStep?: (event: PlanProgressEvent) => void
): Promise<import('../types').CreateGoalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/goal/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to generate 90-day plan');
    return data;
  }

  if (!response.body) throw new Error('Plan stream did not start.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: import('../types').CreateGoalResponse | null = null;

  const take = (block: string) => {
    const line = block.split('\n').find((entry) => entry.startsWith('data: '));
    if (!line) return;
    const event = JSON.parse(line.slice(6));
    if (event.type === 'step') onStep?.(event as PlanProgressEvent);
    if (event.type === 'error') throw new Error(event.error || 'Failed to generate 90-day plan');
    if (event.type === 'done') {
      result = { goal: event.goal, roadmapWeeks: event.roadmapWeeks, dailyTasks: event.dailyTasks };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) take(block);
  }
  if (buffer.trim()) take(buffer);

  if (!result) throw new Error('Plan stream ended before a plan was ready.');
  return result;
}

export async function fetchActiveGoal(token: string): Promise<import('../types').Goal | null> {
  const response = await fetch(`${API_BASE_URL}/api/goal/active`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch active goal');
  }

  return data.activeGoal;
}

export async function updateDailyTask(
  taskId: string,
  updates: { status?: 'pending' | 'completed' | 'skipped'; notes?: string; slotTime?: string },
  token: string
): Promise<import('../types').DailyTask> {
  const response = await fetch(`${API_BASE_URL}/api/goal/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update task');
  }

  return data.task;
}

export async function submitWeeklyReview(
  weekNumber: number,
  reflection: string,
  token: string
): Promise<import('../types').WeeklyReviewResponse> {
  const response = await fetch(`${API_BASE_URL}/api/goal/weeks/${weekNumber}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ reflection }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit weekly review');
  }

  return data;
}

export async function resetActiveGoal(token: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/api/goal/active`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to reset goal');
  }

  return data.success;
}
