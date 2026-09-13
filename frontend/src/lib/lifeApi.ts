const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data as T;
}

export interface RoutineBlock {
  id: string;
  title: string;
  category: string;
  days_of_week: string | string[];
  start_time: string;
  end_time: string;
  is_hard_constraint: boolean;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
}

export interface LifeStructure {
  id: string;
  wake_time: string;
  sleep_time: string;
  schedule_reliability: string;
  buffer_minutes: number;
  routine_blocks: RoutineBlock[];
}

export interface AvailableWindow {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  energy: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DailyScheduleItem {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  item_type: 'ROUTINE' | 'AMBITION_DOSE' | 'BUFFER';
  category?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED_INTENTIONAL';
  allocated_minutes?: number;
  minimum_viable_minutes?: number;
  energy_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  is_locked?: boolean;
  completed_at?: string;
  user_goal?: {
    id: string;
    outcome_statement: string;
  };
}

export interface CapacityAudit {
  total_weekly_free_hours: number;
  committed_ambition_hours: number;
  safe_capacity_limit_hours: number;
  capacity_utilization_pct: number;
  is_overloaded: boolean;
  active_ambitions_count: number;
  recommendations: string[];
}

export async function fetchLifeStructure(token: string): Promise<LifeStructure> {
  const res = await fetch(`${API_BASE_URL}/api/life/structure`, {
    headers: authHeaders(token),
  });
  return handleResponse<LifeStructure>(res, 'Failed to fetch life structure.');
}

export async function updateLifeStructure(
  token: string,
  data: Partial<Omit<LifeStructure, 'routine_blocks'>> & { routine_blocks?: Partial<RoutineBlock>[] }
): Promise<LifeStructure> {
  const res = await fetch(`${API_BASE_URL}/api/life/structure`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<LifeStructure>(res, 'Failed to update life structure.');
}

export async function createRoutineBlock(token: string, data: Partial<RoutineBlock>): Promise<RoutineBlock> {
  const res = await fetch(`${API_BASE_URL}/api/life/routine`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  return handleResponse<RoutineBlock>(res, 'Failed to create routine block.');
}

export async function deleteRoutineBlock(token: string, id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/life/routine/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  return handleResponse<{ success: boolean }>(res, 'Failed to delete routine block.');
}

export async function fetchTodaySchedule(
  token: string,
  date?: string
): Promise<{ date: string; items: DailyScheduleItem[]; open_windows: AvailableWindow[] }> {
  const url = date
    ? `${API_BASE_URL}/api/life/schedule/today?date=${date}`
    : `${API_BASE_URL}/api/life/schedule/today`;
  const res = await fetch(url, {
    headers: authHeaders(token),
  });
  return handleResponse(res, "Failed to fetch today's schedule.");
}

export async function fetchWeekSchedule(
  token: string,
  startDate?: string
): Promise<{ startDate: string; endDate: string; items: DailyScheduleItem[] }> {
  const url = startDate
    ? `${API_BASE_URL}/api/life/schedule/week?startDate=${startDate}`
    : `${API_BASE_URL}/api/life/schedule/week`;
  const res = await fetch(url, {
    headers: authHeaders(token),
  });
  return handleResponse(res, 'Failed to fetch week schedule.');
}

export async function adaptSchedule(
  token: string,
  shiftMinutes: number,
  reason?: string,
  date?: string
): Promise<{ modified: number; updatedItems: DailyScheduleItem[]; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/life/schedule/adapt`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ shiftMinutes, reason, date }),
  });
  return handleResponse(res, 'Failed to adapt schedule.');
}

export async function updateScheduleItemStatus(
  token: string,
  itemId: string,
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED_INTENTIONAL'
): Promise<DailyScheduleItem> {
  const res = await fetch(`${API_BASE_URL}/api/life/schedule/item/${itemId}/status`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
  return handleResponse<DailyScheduleItem>(res, 'Failed to update schedule item status.');
}

export async function fetchCapacityAudit(token: string): Promise<CapacityAudit> {
  const res = await fetch(`${API_BASE_URL}/api/life/capacity`, {
    headers: authHeaders(token),
  });
  return handleResponse<CapacityAudit>(res, 'Failed to fetch capacity audit.');
}

export async function prioritizeAmbitions(token: string, goalIds: string[]) {
  const res = await fetch(`${API_BASE_URL}/api/life/ambitions/prioritize`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ goalIds }),
  });
  return handleResponse(res, 'Failed to prioritize ambitions.');
}
