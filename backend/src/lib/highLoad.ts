import type { Goal } from '@prisma/client';
import type { DetailedStep } from './ai/goalDecomposer.js';
import { findPresetForGoal } from './ai/presets/index.js';

/** ND-5: the presets whose every step is physical (`run10k.ts`, `recomp.ts`). */
export const HIGH_LOAD_PRESET_IDS: readonly string[] = ['run10k', 'body_recomposition_90day'];

type GoalText = Pick<Goal, 'rawGoal' | 'clarifiedOutcome'>;

/** True when the goal is a physical preset, identified from its text the same way goal create does. */
export function isHighLoadGoal(goal: GoalText): boolean {
  const preset = findPresetForGoal(goal.rawGoal) || findPresetForGoal(goal.clarifiedOutcome);
  return preset !== null && HIGH_LOAD_PRESET_IDS.includes(preset.id);
}

/**
 * The one answer to "is this step high-load?" (RULE-10). Covers goals written before M2.1: their stored steps carry
 * no flag, so a physical preset goal counts by goal, and a custom goal's unflagged step counts as normal.
 */
export function isHighLoadStep(step: Pick<DetailedStep, 'highLoad'>, goal: GoalText): boolean {
  return isHighLoadGoal(goal) || step.highLoad === true;
}
