import { useNavigate } from 'react-router-dom';
import type { CertifiedPathway } from '../../lib/certifiedPresets';
import type { RoutineSettings } from '../../types';
import { DRAFT_GOAL_KEY } from '../onboarding/payload';
import { clearSnapshot } from '../onboarding/snapshot';

export interface GoalLaunch {
  to: '/onboarding';
  state: Record<string, unknown>;
  /** Written to the draft key before navigating; a custom launch clears it instead. */
  draftGoal?: string;
}

/**
 * The launch every in-app pathway entry uses (R-3, R-15): the title is the preset and the draft goal, and
 * `switchGoal` lets onboarding admit a user who already has a goal. That goal is only replaced once the new one is
 * created.
 */
export const pathwayLaunch = (pathway: CertifiedPathway, routine?: RoutineSettings | null): GoalLaunch => ({
  to: '/onboarding',
  // ND-40: a skill started after a plan carries that plan's routine, so the routine pages only need confirming.
  state: { presetGoal: pathway.title, isPreset: true, switchGoal: true, ...(routine ? { routine } : {}) },
  draftGoal: pathway.title,
});

/** A goal's stored routine (a JSON string), or null when it can't be read. */
export function storedRoutine(goal: { routine?: unknown }): RoutineSettings | null {
  try {
    const value = typeof goal.routine === 'string' ? JSON.parse(goal.routine) : goal.routine;
    if (!value || typeof value !== 'object') return null;
    const routine = value as Partial<RoutineSettings>;
    if (typeof routine.dailyMinutes !== 'number' || !routine.planVariant) return null;
    return {
      wakeTime: routine.wakeTime ?? '07:00',
      sleepTime: routine.sleepTime ?? '23:00',
      busyHours: routine.busyHours ?? '09:00 - 17:00',
      preferredSlot: routine.preferredSlot ?? 'evening',
      dailyMinutes: routine.dailyMinutes,
      planVariant: routine.planVariant,
      ...(Array.isArray(routine.restWeekdays) ? { restWeekdays: routine.restWeekdays } : {}),
      commitments: Array.isArray(routine.commitments) ? routine.commitments : [],
    };
  } catch {
    return null;
  }
}

/** ND-36: a goal typed on the landing page or Home; onboarding opens on its first question with clarify under way. */
export const typedGoalLaunch = (goal: string): GoalLaunch => ({
  to: '/onboarding',
  state: { draftGoal: goal, switchGoal: true },
  draftGoal: goal,
});

export const CUSTOM_GOAL_LAUNCH: GoalLaunch = { to: '/onboarding', state: { isPreset: false, customGoal: true } };

/** What a screen does once the user has chosen. The pathway components only report the choice. */
export function usePathwayLaunch() {
  const navigate = useNavigate();
  const go = ({ to, state, draftGoal }: GoalLaunch) => {
    // Every launch starts afresh: answers kept from an earlier, unfinished onboarding belong to that goal.
    clearSnapshot();
    if (draftGoal) localStorage.setItem(DRAFT_GOAL_KEY, draftGoal);
    else localStorage.removeItem(DRAFT_GOAL_KEY);
    navigate(to, { state });
  };
  return {
    startPathway: (pathway: CertifiedPathway, routine?: RoutineSettings | null) => go(pathwayLaunch(pathway, routine)),
    startCustomGoal: () => go(CUSTOM_GOAL_LAUNCH),
    startTypedGoal: (goal: string) => go(typedGoalLaunch(goal)),
  };
}
