import { useNavigate } from 'react-router-dom';
import type { CertifiedPathway } from '../../lib/certifiedPresets';
import { DRAFT_GOAL_KEY } from '../onboarding/payload';

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

export const CUSTOM_GOAL_LAUNCH: GoalLaunch = { to: '/onboarding', state: { isPreset: false, customGoal: true } };

/** What a screen does once the user has chosen. The pathway components only report the choice. */
export function usePathwayLaunch() {
  const navigate = useNavigate();
  const go = ({ to, state, draftGoal }: GoalLaunch) => {
    if (draftGoal) localStorage.setItem(DRAFT_GOAL_KEY, draftGoal);
    else localStorage.removeItem(DRAFT_GOAL_KEY);
    navigate(to, { state });
  };
  return {
    startPathway: (pathway: CertifiedPathway) => go(pathwayLaunch(pathway)),
    startCustomGoal: () => go(CUSTOM_GOAL_LAUNCH),
  };
}
