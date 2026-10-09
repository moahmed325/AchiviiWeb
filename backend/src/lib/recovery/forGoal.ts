/**
 * Method-aware recovery, M1.3a: the profile a goal is saved with, with no model call (RULE-2, RULE-3, RULE-4).
 * Pure. A certified pathway gets its hand-written profile; any other goal gets the keyword table's template
 * unchanged (MR-13, MR-14). Both were checked by hand, so they are checked without the deliverable fact (MR-22);
 * only a profile the profile call makes gets that check (`profileCall.ts`).
 */
import { profileFailures, type RecoveryProfile } from './profile.js';
import { profileForPathway } from './pathways.js';
import { pickTemplate } from './pickTemplate.js';
import { templateProfile } from './templates.js';

export interface GoalProfileInput {
  /** The matched certified preset's id, when there is one. */
  presetId?: string | null;
  /** Clarify's free-text domain (only at creation; never stored). */
  domain?: string | null;
  goalText: string;
  methodName?: string | null;
}

export type GoalProfileResult = { profile: RecoveryProfile } | { reasons: string[] };

/** A stored or generated `WeekTarget` that is a deliverable (`{ kind: 'deliverable', ... }`). */
export function isDeliverableTarget(target: unknown): boolean {
  return !!target && typeof target === 'object' && (target as { kind?: unknown }).kind === 'deliverable';
}

export function makeGoalProfile(input: GoalProfileInput): GoalProfileResult {
  const profile =
    (input.presetId ? profileForPathway(input.presetId) : null) ??
    templateProfile(pickTemplate({ domain: input.domain, goalText: input.goalText, methodName: input.methodName }));
  const reasons = profileFailures(profile);
  return reasons.length > 0 ? { reasons } : { profile };
}
