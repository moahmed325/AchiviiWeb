import { useNavigate } from 'react-router-dom';
import type { CertifiedPathway } from '../../lib/certifiedPresets';
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
export const pathwayLaunch = (pathway: CertifiedPathway): GoalLaunch => ({
  to: '/onboarding',
  state: { presetGoal: pathway.title, isPreset: true, switchGoal: true },
  draftGoal: pathway.title,
});

/** ND-28: a goal typed on the landing page or Home; onboarding opens on its first question with clarify under way. */
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
    startPathway: (pathway: CertifiedPathway) => go(pathwayLaunch(pathway)),
    startCustomGoal: () => go(CUSTOM_GOAL_LAUNCH),
    startTypedGoal: (goal: string) => go(typedGoalLaunch(goal)),
  };
}
