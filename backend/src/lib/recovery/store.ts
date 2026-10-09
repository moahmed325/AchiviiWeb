/**
 * Method-aware recovery, M1.3a: a goal created before this feature gets its profile at its next weekly review,
 * just before the week call (RULE-1, MR-14). Never throws: any failure is logged and the review carries on as today.
 */
import type { Goal, RoadmapWeek } from '@prisma/client';
import { prisma } from '../prisma.js';
import { findPresetForGoal } from '../ai/presets/index.js';
import { readStoredRoadmap } from '../planV2.js';
import { isDeliverableTarget, makeGoalProfile } from './forGoal.js';
import { readRecoveryProfile } from './profile.js';

type ReviewGoal = Pick<Goal, 'id' | 'planVersion' | 'rawGoal' | 'clarifiedOutcome' | 'roadmap'> & {
  roadmapWeeks: Array<Pick<RoadmapWeek, 'weekNumber' | 'target'>>;
};

/**
 * Saves a profile into `Goal.roadmap.recovery` when a plan v2 goal with a stored roadmap has no readable one,
 * keeping every other roadmap field. Returns true only when one was written. No domain is stored for older goals,
 * so the keyword table uses the goal text and the method name.
 */
export async function ensureRecoveryProfile(goal: ReviewGoal): Promise<boolean> {
  try {
    if (goal.planVersion !== 2) return false;
    const stored = readStoredRoadmap(goal);
    if (!stored || readRecoveryProfile(goal.roadmap)) return false;

    const preset = findPresetForGoal(goal.rawGoal) || findPresetForGoal(goal.clarifiedOutcome);
    const result = makeGoalProfile({
      presetId: preset?.id,
      goalText: `${goal.rawGoal} ${goal.clarifiedOutcome}`,
      methodName: stored.method?.name,
      deliverableGoal: isDeliverableTarget(goal.roadmapWeeks.find((week) => week.weekNumber === 12)?.target),
    });
    if ('reasons' in result) {
      console.warn('[Recovery] No profile saved for goal', goal.id, result.reasons);
      return false;
    }

    const roadmap = JSON.parse(JSON.stringify({ ...(goal.roadmap as Record<string, unknown>), recovery: result.profile }));
    await prisma.goal.update({ where: { id: goal.id }, data: { roadmap } });
    return true;
  } catch (err) {
    console.warn('[Recovery] Could not save a profile for goal', goal.id, err);
    return false;
  }
}
