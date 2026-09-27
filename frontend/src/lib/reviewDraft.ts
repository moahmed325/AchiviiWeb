import type { WeeklyTestResult } from '../types/review';

/**
 * Review draft persistence helpers (Phase 7 — BP §17, §33, M7.4-R1, M7.5).
 * Stores unsubmitted reflection drafts and benchmark test results in browser localStorage
 * keyed by goal and week.
 */

export function getReviewDraftStorageKey(goalId: string, weekNumber: number): string {
  return `achivii_review_draft_${goalId}_w${weekNumber}`;
}

export function loadReviewDraft(goalId: string, weekNumber: number): string {
  try {
    return localStorage.getItem(getReviewDraftStorageKey(goalId, weekNumber)) || '';
  } catch {
    return '';
  }
}

export function saveReviewDraft(goalId: string, weekNumber: number, draft: string): void {
  try {
    const key = getReviewDraftStorageKey(goalId, weekNumber);
    if (draft.trim()) {
      localStorage.setItem(key, draft);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota or disabled storage errors (e.g. private browsing)
  }
}

export function getTestResultDraftStorageKey(goalId: string, weekNumber: number): string {
  return `achivii_test_result_draft_${goalId}_w${weekNumber}`;
}

export function loadTestResultDraft(goalId: string, weekNumber: number): WeeklyTestResult | null {
  try {
    const raw = localStorage.getItem(getTestResultDraftStorageKey(goalId, weekNumber));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveTestResultDraft(
  goalId: string,
  weekNumber: number,
  result: WeeklyTestResult | null
): void {
  try {
    const key = getTestResultDraftStorageKey(goalId, weekNumber);
    if (result && result.value !== '' && result.value !== undefined) {
      localStorage.setItem(key, JSON.stringify(result));
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}

export function clearReviewDraft(goalId: string, weekNumber: number): void {
  try {
    localStorage.removeItem(getReviewDraftStorageKey(goalId, weekNumber));
    localStorage.removeItem(getTestResultDraftStorageKey(goalId, weekNumber));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}
