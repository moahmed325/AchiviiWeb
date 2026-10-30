/**
 * Review draft persistence helpers (Phase 7 — BP §17, §33, M7.4-R1, M7.5).
 * Stores unsubmitted reflection drafts in browser localStorage, keyed by goal and week.
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

/** A test result draft from before the weekly tests went (2026-10-30); only ever cleared now. */
const oldTestResultDraftKey = (goalId: string, weekNumber: number) => `achivii_test_result_draft_${goalId}_w${weekNumber}`;

export function clearReviewDraft(goalId: string, weekNumber: number): void {
  try {
    localStorage.removeItem(getReviewDraftStorageKey(goalId, weekNumber));
    localStorage.removeItem(oldTestResultDraftKey(goalId, weekNumber));
  } catch {
    // Ignore storage quota or disabled storage errors
  }
}
