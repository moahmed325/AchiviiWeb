// =============================================================================
// Adaptive 90-Day Execution System — Frontend API Client SDK
// =============================================================================
// Typed client functions for every /api/adaptive/* endpoint.
// Follows the same pattern as the existing api.ts (fetch, Bearer token auth).
// This is the canonical SDK for all adaptive frontend surfaces (Phases 15–18).
// =============================================================================

import { resolveApiBaseUrl } from './api';
import type {
  FormalizeGoalParams,
  FormalizeGoalResponse,
  CommitGoalParams,
  CommitGoalResponse,
  AdaptiveDashboardResponse,
  RecordSessionTelemetryParams,
  TelemetrySessionResponse,
  DiagnosisPendingResponse,
  SubmitDiagnosisParams,
  DiagnosisSubmitResponse,
  WeeklyReviewResponse,
  VerifyOutcomeGateParams,
  OutcomeGateResponse,
} from '../types/adaptive';

const API_BASE_URL = resolveApiBaseUrl();

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function authHeaders(token: string): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function readHeaders(token: string): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// 1. Goal Formalization & Feasibility Gate
// ---------------------------------------------------------------------------

/**
 * POST /api/adaptive/goal/formalize
 *
 * Parse user goal into a concrete outcome statement, generate baseline
 * verification questions, and evaluate 90-day feasibility (RED/YELLOW/GREEN).
 */
export async function formalizeGoal(
  token: string,
  params: FormalizeGoalParams
): Promise<FormalizeGoalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/adaptive/goal/formalize`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });

  return handleResponse<FormalizeGoalResponse>(
    response,
    'Failed to formalize goal.'
  );
}

// ---------------------------------------------------------------------------
// 2. Goal Commitment (Capability DAG + Trajectory v1)
// ---------------------------------------------------------------------------

/**
 * POST /api/adaptive/goal/commit
 *
 * Commit formalized goal: creates UserGoal, constructs Capability DAG,
 * generates Trajectory v1, and materializes Week 1 Execution Objects.
 */
export async function commitGoal(
  token: string,
  params: CommitGoalParams
): Promise<CommitGoalResponse> {
  const response = await fetch(`${API_BASE_URL}/api/adaptive/goal/commit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });

  return handleResponse<CommitGoalResponse>(
    response,
    'Failed to commit goal.'
  );
}

// ---------------------------------------------------------------------------
// 3. Adaptive Dashboard (Strategic Workbench)
// ---------------------------------------------------------------------------

/**
 * GET /api/adaptive/dashboard
 *
 * Fetch the canonical adaptive dashboard state: outcome statement,
 * goal integrity, confidence level, projected completion, active bottleneck,
 * today's MVS action, latest plan update, and reliability margin.
 */
export async function fetchAdaptiveDashboard(
  token: string,
  goalId?: string
): Promise<AdaptiveDashboardResponse> {
  const query = goalId ? `?goalId=${encodeURIComponent(goalId)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/adaptive/dashboard${query}`, {
    headers: readHeaders(token),
  });

  return handleResponse<AdaptiveDashboardResponse>(
    response,
    'Failed to load adaptive dashboard.'
  );
}

// ---------------------------------------------------------------------------
// 4. Execution Telemetry
// ---------------------------------------------------------------------------

/**
 * POST /api/adaptive/telemetry/session
 *
 * Record execution telemetry for a session: execution state (COMPLETED,
 * REDUCED, MINIMUM_VIABLE, MISSED, etc.), proof-of-work text, RPE rating,
 * duration, and notes. Returns the telemetry result and a deviation report.
 */
export async function recordSessionTelemetry(
  token: string,
  params: RecordSessionTelemetryParams
): Promise<TelemetrySessionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/adaptive/telemetry/session`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });

  return handleResponse<TelemetrySessionResponse>(
    response,
    'Failed to record session telemetry.'
  );
}

// ---------------------------------------------------------------------------
// 5. Pending Diagnosis
// ---------------------------------------------------------------------------

/**
 * GET /api/adaptive/diagnosis/pending
 *
 * Check whether a diagnostic intervention is required. If deviation severity
 * is MATERIAL_DISRUPTION, returns the structured diagnostic prompt with
 * root-cause questions across 6 categories.
 */
export async function fetchPendingDiagnosis(
  token: string,
  goalId?: string
): Promise<DiagnosisPendingResponse> {
  const query = goalId ? `?goalId=${encodeURIComponent(goalId)}` : '';
  const response = await fetch(`${API_BASE_URL}/api/adaptive/diagnosis/pending${query}`, {
    headers: readHeaders(token),
  });

  return handleResponse<DiagnosisPendingResponse>(
    response,
    'Failed to load pending diagnosis.'
  );
}

// ---------------------------------------------------------------------------
// 6. Submit Diagnosis & Trigger Replan
// ---------------------------------------------------------------------------

/**
 * POST /api/adaptive/diagnosis/submit
 *
 * Submit the user's root-cause diagnosis response. Triggers the Adaptive
 * Rescheduler to replan from the current state (No-Debt Principle), generates
 * a new trajectory version, and returns a user-facing explanation.
 */
export async function submitDiagnosis(
  token: string,
  params: SubmitDiagnosisParams
): Promise<DiagnosisSubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/api/adaptive/diagnosis/submit`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });

  return handleResponse<DiagnosisSubmitResponse>(
    response,
    'Failed to submit diagnosis.'
  );
}

// ---------------------------------------------------------------------------
// 7. Weekly Strategic Review
// ---------------------------------------------------------------------------

/**
 * GET /api/adaptive/weekly-review/:weekNumber
 *
 * Fetch the 7-question Weekly Strategic Review for a given week. Answers
 * are generated from ground-truth telemetry and capability state transitions.
 */
export async function fetchWeeklyReview(
  token: string,
  weekNumber: number,
  goalId?: string
): Promise<WeeklyReviewResponse> {
  const query = goalId ? `?goalId=${encodeURIComponent(goalId)}` : '';
  const response = await fetch(
    `${API_BASE_URL}/api/adaptive/weekly-review/${weekNumber}${query}`,
    { headers: readHeaders(token) }
  );

  return handleResponse<WeeklyReviewResponse>(
    response,
    'Failed to load weekly review.'
  );
}

// ---------------------------------------------------------------------------
// 8. Outcome Gate Verification
// ---------------------------------------------------------------------------

/**
 * POST /api/adaptive/outcome-gate/verify
 *
 * Verify whether the goal's objective verification criteria are satisfied
 * by recorded evidence. Optionally submits new evidence (capabilityId,
 * proofType, confidenceWeight, payload) before evaluating the gate.
 */
export async function verifyOutcomeGate(
  token: string,
  params: VerifyOutcomeGateParams
): Promise<OutcomeGateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/adaptive/outcome-gate/verify`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });

  return handleResponse<OutcomeGateResponse>(
    response,
    'Failed to verify outcome gate.'
  );
}
