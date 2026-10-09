/**
 * Method-aware recovery, M1.3a: the profile a goal is saved with, with no model call (RULE-2, RULE-3, RULE-4).
 * Pure. A certified pathway gets its hand-written profile; any other goal gets the keyword table's template
 * unchanged (MR-13, MR-14). The profile is returned only when it passes the checks, with the deliverable fact
 * from the goal's week-12 target (MR-21); otherwise the reasons, and the goal is saved without one (RULE-18).
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
  /** The goal's week-12 target is a deliverable. */
  deliverableGoal: boolean;
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
  const reasons = profileFailures(profile, { deliverableGoal: input.deliverableGoal });
  return reasons.length > 0 ? { reasons } : { profile };
}
