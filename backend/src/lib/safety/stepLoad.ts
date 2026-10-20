/**
 * Plan safety limits M2.1 (RULE-4, PSL-4, PSL-8): the load a high-load step carries as numbers. The week call asks a
 * load goal for it, `parseStepLoad` reads it, and a step PSL-8 names that has none is a soft retry reason. Nothing here
 * checks a number against the limits (M2.2).
 */
import type { Goal } from '@prisma/client';
import type { DetailedStep, StepLoad } from '../ai/goalDecomposer.js';
import type { WeekTarget } from '../ai/roadmap.js';
import { findPresetForGoal } from '../ai/presets/index.js';
import { isHighLoadGoal } from '../highLoad.js';
import { targetFamily } from './targetSteps.js';

/** The week call's input on a load goal: present means the goal is asked for load. */
export interface LoadGoal {
  /** run10k, or a running-distance or running-time target: the model's own test step carries a run load (PSL-11 Q9). */
  running: boolean;
}

/**
 * RULE-4: a goal is asked for load when it is a physical preset (`isHighLoadGoal`) or the week's target has a family.
 * Undefined for any other goal, whose week call stays exactly as before.
 */
export function loadGoalFor(goal: Pick<Goal, 'rawGoal' | 'clarifiedOutcome'>, target: WeekTarget): LoadGoal | undefined {
  const preset = findPresetForGoal(goal.rawGoal) || findPresetForGoal(goal.clarifiedOutcome);
  const run10k = preset?.id === 'run10k';
  const family = targetFamily(target, { run10k });
  if (!isHighLoadGoal(goal) && !family) return undefined;
  return { running: run10k || family === 'running_distance' || family === 'running_time' };
}

/** The week call input's `loadGoal`, spread in by both callers: `{}` for a goal that is not a load goal. */
export function loadGoalInput(goal: Pick<Goal, 'rawGoal' | 'clarifiedOutcome'>, target: WeekTarget): { loadGoal?: LoadGoal } {
  const loadGoal = loadGoalFor(goal, target);
  return loadGoal ? { loadGoal } : {};
}

const NUMBER_FIELDS = ['runMinutes', 'runKm', 'kcalDeficit', 'kcalIntake', 'percent1RM', 'rir'] as const;
const BOOLEAN_FIELDS = ['hardRun', 'toFailure', 'maxTest'] as const;

/** PSL-4: keeps a number only when finite and 0 or more (`percent1RM` at most 100), a yes/no only when a real boolean. */
export function parseStepLoad(value: unknown): StepLoad | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const load: StepLoad = {};
  for (const key of NUMBER_FIELDS) {
    const number = raw[key];
    if (typeof number === 'number' && Number.isFinite(number) && number >= 0 && (key !== 'percent1RM' || number <= 100)) load[key] = number;
  }
  for (const key of BOOLEAN_FIELDS) {
    const flag = raw[key];
    if (typeof flag === 'boolean') load[key] = flag;
  }
  return Object.keys(load).length > 0 ? load : undefined;
}

/** The schema of one step's `load`; never required, because only some steps carry it. */
export const STEP_LOAD_SCHEMA = {
  type: 'object',
  properties: {
    runMinutes: { type: 'number' },
    runKm: { type: 'number' },
    hardRun: { type: 'boolean' },
    kcalDeficit: { type: 'number' },
    kcalIntake: { type: 'number' },
    percent1RM: { type: 'number' },
    rir: { type: 'number' },
    toFailure: { type: 'boolean' },
    maxTest: { type: 'boolean' },
  },
};

/** The endurance template's run kinds and the strength template's lift kind (`recovery/templates.ts`). */
export const RUN_KINDS: readonly string[] = ['easy_session', 'quality_session', 'long_session'];
export const LIFT_KIND = 'strength_workout';

/** What a step must carry: a run load, a lift load, or any field at all. */
export type LoadNeed = 'run' | 'lift' | 'any';

/**
 * PSL-8: on a load goal, a run or lift kind, the model's own test step on a running goal (whatever its flag), or a step
 * the model flagged `highLoad`. Null for any other step. Code-made steps are never passed here.
 */
export function loadNeed(step: Pick<DetailedStep, 'kind' | 'highLoad'>, modelTestStep: boolean, goal: LoadGoal): LoadNeed | null {
  if (modelTestStep && goal.running) return 'run';
  if (step.kind && RUN_KINDS.includes(step.kind)) return 'run';
  if (step.kind === LIFT_KIND) return 'lift';
  return step.highLoad === true ? 'any' : null;
}

/** What the step is missing for its need, worded for the retry reason; null when it has it. */
export function missingLoad(load: StepLoad | undefined, need: LoadNeed): string | null {
  if (need === 'run') {
    const ran = load?.runMinutes !== undefined || load?.runKm !== undefined;
    return ran && load?.hardRun !== undefined ? null : 'runMinutes or runKm, and hardRun';
  }
  if (need === 'lift') return load?.rir !== undefined || load?.percent1RM !== undefined ? null : 'rir or percent1RM';
  return load ? null : 'the numbers that apply';
}

/**
 * PSL-11 Q10: the step at new minutes. When code changes a step's minutes, `load.runMinutes` scales by the same ratio,
 * rounded to a whole minute. `runKm` is never scaled: the step's text names the distance, and keeping it over-counts
 * the planned distance, the safe side for the running total. A step written with 0 minutes keeps its load as written.
 */
export function withMinutes<T extends DetailedStep>(step: T, minutes: number): T {
  const before = step.durationMinutes;
  const runMinutes = step.load?.runMinutes;
  if (runMinutes === undefined || before <= 0 || minutes === before) return { ...step, durationMinutes: minutes };
  return { ...step, durationMinutes: minutes, load: { ...step.load, runMinutes: Math.round((runMinutes * minutes) / before) } };
}
