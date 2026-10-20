/**
 * Plan safety limits M1.2 (RULE-2, RULE-3, PSL-6, PSL-10, PSL-11): what a number target measures (its family), the
 * furthest one week may move it (`nextSafeStep`), and the roadmap's climb lowered to safe steps (`safeTargetClimb`).
 * Pure apart from `logRoadmapTargets`. Every number comes from `limits.ts`.
 */
import type { WeekTarget, LoweredTarget } from '../ai/roadmap.js';
import { logSafetyHit } from '../ai/safetyScan.js';
import { HIGH_LOAD_PRESET_IDS } from '../highLoad.js';
import {
  BODY_FAT_STEP_POINTS,
  BODY_WEIGHT_GAIN_STEP_PERCENT,
  BODY_WEIGHT_LOSS_STEP_PERCENT,
  CALORIE_DEFICIT_MAX,
  LIFT_STEP_MIN_KG,
  LIFT_STEP_PERCENT,
  RUN_DISTANCE_STEP_MIN_KM,
  RUN_DISTANCE_STEP_PERCENT,
  RUN_DURATION_STEP_MIN_MINUTES,
  RUN_TIME_STEP_PERCENT,
} from './limits.js';

export type TargetFamily = 'running_distance' | 'running_time' | 'lift_load' | 'body_weight' | 'body_fat' | 'calorie_deficit';

type NumberTarget = Extract<WeekTarget, { kind: 'number' }>;

/** What the family reading needs to know about the goal. */
export interface FamilyContext {
  /** The goal is on the run10k pathway: a time or minutes target then counts as running (PSL-10 (3)). */
  run10k?: boolean;
}

/** Unit conversions, not limits: the allowances are written in km, kg and minutes. */
const KM_PER_MILE = 1.609344;
const LB_PER_KG = 2.2046226218;

/** Kilometres in one of the unit, or null when it is not a distance. */
function kmPerUnit(unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (/^(km|kms|kilomet(?:er|re)s?)$/.test(u)) return 1;
  if (/^(mi|mile|miles)$/.test(u)) return KM_PER_MILE;
  if (/^(m|metres?|meters?)$/.test(u)) return 0.001;
  return null;
}

/** Minutes in one of the unit, or null when it is not a time. */
function minutesPerUnit(unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (/^(min|mins|minutes?)$/.test(u)) return 1;
  if (/^(s|sec|secs|seconds?)$/.test(u)) return 1 / 60;
  if (/^(h|hr|hrs|hours?)$/.test(u)) return 60;
  return null;
}

/** A pace unit: minutes (or seconds) per km or mile. */
function isPaceUnit(unit: string): boolean {
  return /^(?:min|mins|minutes?|s|sec|secs|seconds?)?\s*(?:\/|per)\s*(?:km|kilomet(?:er|re)|mi|mile)$/.test(unit.toLowerCase().trim());
}

/** Kilograms in one of the unit ("kg for 5" counts), or null when it is not a mass. */
function kgPerUnit(unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (/^(kg|kgs|kilos?|kilograms?)\b/.test(u)) return 1;
  if (/^(lb|lbs|pounds?)\b/.test(u)) return 1 / LB_PER_KG;
  return null;
}

function isPercentUnit(unit: string): boolean {
  const u = unit.toLowerCase().trim();
  return u === '%' || /^percent(age)?s?(\s+points?)?$/.test(u) || /^(percentage\s+)?points?$/.test(u);
}

/** M1.2 review: another endurance sport is never running, distance or not (02-feature.md section 8). */
const OTHER_SPORT_WORDS = /\b(?:cycle|cycles|cycling|cyclist|bike|bikes|biking|ride|rides|riding|swim|swims|swimming|row|rows|rowing|rower)\b/;
const RUN_WORDS = /\b(?:run|runs|running|runner|jog|jogging|race|racing|parkrun|marathon|mileage|\d+(?:\.\d+)?\s*(?:k|km|mi|miles?))\b/;
const LIFT_WORDS = /\b(?:squat|squats|bench|deadlifts?|press|row|lifts?|lifted|clean|snatch|jerk|thrust|pull-?ups?|chin-?ups?|dips?|lunges?|curl)\b/;
const BODY_WEIGHT_WORDS = /\b(?:body\s*weight|bodyweight|weight|weigh|weigh-in|scale|mass)\b/;
const LOST_WORDS = /\b(?:lost|loss|lose|losing|dropped)\b/;
const FAT_WORDS = /\bfat\b/;

/**
 * The family a number target is in, or null (section 3, PSL-10): read from its metric, unit and direction. Pace is
 * running time; continuous running minutes (higher) use the distance rule in minutes; a time, minutes or distance
 * target is running only on run10k or when the metric names a run. Waist, weight lost, % of 1RM and RIR have no family.
 */
export function targetFamily(target: WeekTarget, context: FamilyContext = {}): TargetFamily | null {
  if (target.kind !== 'number') return null;
  const metric = target.metric.toLowerCase();
  const text = `${metric} ${target.unit.toLowerCase()}`;
  const higher = target.direction === 'higher_is_better';

  if (/deficit/.test(text) && /kcal|cal/.test(text)) return higher ? 'calorie_deficit' : null;
  if (isPercentUnit(target.unit)) return FAT_WORDS.test(metric) && !/\b1\s*rm\b|rep max|\brir\b/.test(metric) ? 'body_fat' : null;
  if (kgPerUnit(target.unit) !== null) {
    if (LOST_WORDS.test(metric)) return null;
    if (LIFT_WORDS.test(metric)) return higher ? 'lift_load' : null;
    if (BODY_WEIGHT_WORDS.test(metric)) return 'body_weight';
    return null;
  }
  if (OTHER_SPORT_WORDS.test(metric)) return null;
  if (isPaceUnit(target.unit)) return higher ? null : 'running_time';
  const running = context.run10k === true || RUN_WORDS.test(metric);
  if (!running) return null;
  if (kmPerUnit(target.unit) !== null) return higher ? 'running_distance' : null;
  if (minutesPerUnit(target.unit) !== null) return higher ? 'running_distance' : 'running_time';
  return null;
}

/** A target outside every family that still looks physical, for the `unknown_family` log line (never refused). */
export function looksPhysical(target: WeekTarget, context: { highLoad?: boolean } = {}): boolean {
  if (target.kind !== 'number') return false;
  if (context.highLoad) return true;
  const text = `${target.metric} ${target.unit}`.toLowerCase();
  return (
    kgPerUnit(target.unit) !== null ||
    kmPerUnit(target.unit) !== null ||
    isPaceUnit(target.unit) ||
    /\b(?:run|running|jog|swim|swimming|cycl\w*|ride|row|weight|fat|waist|hips?|calories?|kcal|1\s*rm|rir|squat|bench|deadlift|lift|press|pace|plank|push-?ups?|pull-?ups?)\b/.test(text)
  );
}

/** Rounded to 0.1 toward the easier side, so a rounded value never breaks a limit. A deficit's 600 is already whole. */
function roundEasier(value: number, direction: NumberTarget['direction']): number {
  const rounded = direction === 'higher_is_better' ? Math.floor(value * 10 + 1e-9) / 10 : Math.ceil(value * 10 - 1e-9) / 10;
  return Math.max(0, rounded);
}

/**
 * The furthest value the limits allow one week on from `previousValue` (RULE-2, AC-11): what the weekly update may
 * raise a target to. Null when the target has no family. A deficit is a range, not a step: its furthest is 600 (PSL-6).
 * An allowance written in km or kg is converted to the target's unit (miles, metres, lb).
 */
export function nextSafeStep(target: WeekTarget, previousValue: number, context: FamilyContext = {}): number | null {
  const family = targetFamily(target, context);
  if (!family || target.kind !== 'number') return null;
  const prev = Math.max(0, previousValue);
  const direction = target.direction;
  switch (family) {
    case 'running_distance': {
      const minutes = minutesPerUnit(target.unit);
      const allowance = minutes !== null ? RUN_DURATION_STEP_MIN_MINUTES / minutes : RUN_DISTANCE_STEP_MIN_KM / (kmPerUnit(target.unit) ?? 1);
      return roundEasier(prev + Math.max((prev * RUN_DISTANCE_STEP_PERCENT) / 100, allowance), direction);
    }
    case 'running_time':
      return roundEasier(prev * (1 - RUN_TIME_STEP_PERCENT / 100), direction);
    case 'lift_load': {
      const allowance = LIFT_STEP_MIN_KG / (kgPerUnit(target.unit) ?? 1);
      return roundEasier(prev + Math.max((prev * LIFT_STEP_PERCENT) / 100, allowance), direction);
    }
    case 'body_weight':
      return direction === 'lower_is_better'
        ? roundEasier(prev * (1 - BODY_WEIGHT_LOSS_STEP_PERCENT / 100), direction)
        : roundEasier(prev * (1 + BODY_WEIGHT_GAIN_STEP_PERCENT / 100), direction);
    case 'body_fat':
      return roundEasier(direction === 'lower_is_better' ? prev - BODY_FAT_STEP_POINTS : prev + BODY_FAT_STEP_POINTS, direction);
    case 'calorie_deficit':
      return CALORIE_DEFICIT_MAX;
  }
}

function harder(value: number, limit: number, direction: NumberTarget['direction']): boolean {
  return direction === 'higher_is_better' ? value > limit + 1e-9 : value < limit - 1e-9;
}

/**
 * M1.2 review: what the roadmap check decided about the targets, carried to goal create's log so the log and the check
 * can never disagree. Never stored: `generateRoadmap` returns it next to the roadmap, not in it.
 */
export interface TargetCheck {
  family: TargetFamily | null;
  noStart: boolean;
  /** The pathway the check used (`RoadmapCheckContext.pathwayId`); decides `unknown_family`'s high-load test too. */
  pathwayId?: string;
}

export interface TargetClimb {
  /** The 12 targets with every breaching week lowered (new objects; the input is not changed). */
  targets: WeekTarget[];
  /** One entry per lowered week: the model's value and the safe value it now holds. */
  lowered: LoweredTarget[];
  family: TargetFamily | null;
  /** No starting point: week 1 was not checked (PSL-11 Q14). Only for a family that climbs by steps. */
  noStart: boolean;
}

/**
 * RULE-2: week 1 against the starting point, then each week against the one before. A breaching target is lowered to
 * the safe step and the following weeks are checked from the lowered value; a target that gets easier is never
 * changed. A deficit above 600 is lowered to 600, below 250 left alone (PSL-6), in every week. With no starting point,
 * week 1 is not checked and the check runs from week 2 (PSL-11 Q14). Targets with no family come back unchanged.
 */
export function safeTargetClimb(targets: WeekTarget[], startValue: number | null, context: FamilyContext = {}): TargetClimb {
  return climbBySteps(targets, targets.map((_, index) => index + 1), startValue, context, 1);
}

/** PSL-11 Q1: weeks 4, 8 and 12 are four weeks apart, so four safe steps apart. Not a limit: the weeks between them. */
const STEPS_BETWEEN_CHECKS = 4;

/**
 * Plan safety limits M1.3 (RULE-2, PSL-11 Q1): a stored split-pathway goal, checked on its big-test weeks only
 * (`weeks`, in order, normally 4, 8 and 12), each at most four safe steps beyond the one before and the first against
 * the starting point. The same rules as `safeTargetClimb`, so a goal it already checked is never lowered again.
 */
export function safeCheckWeekClimb(targets: WeekTarget[], weeks: number[], startValue: number | null, context: FamilyContext = {}): TargetClimb {
  return climbBySteps(targets, weeks, startValue, context, STEPS_BETWEEN_CHECKS);
}

function climbBySteps(targets: WeekTarget[], weeks: number[], startValue: number | null, context: FamilyContext, steps: number): TargetClimb {
  const first = targets[0];
  const family = first ? targetFamily(first, context) : null;
  const out = targets.map((target) => ({ ...target }));
  if (!family || first.kind !== 'number') return { targets: out, lowered: [], family: null, noStart: false };

  const lowered: LoweredTarget[] = [];
  const range = family === 'calorie_deficit';
  const noStart = startValue === null && !range;
  let prev: number | null = startValue;
  out.forEach((target, index) => {
    if (target.kind !== 'number') return;
    const week = weeks[index];
    if (prev === null && !range) {
      prev = target.value;
      return;
    }
    let limit: number | null = prev ?? target.value;
    for (let step = 0; step < steps && limit !== null; step += 1) limit = nextSafeStep(target, limit, context);
    if (limit !== null && harder(target.value, limit, target.direction)) {
      lowered.push({ week, model: target.value, safe: limit });
      target.value = limit;
    }
    prev = target.value;
  });
  return { targets: out, lowered, family, noStart };
}

/**
 * RULE-10, AC-10: after goal create saved the goal, one `[Safety]` line per lowered target, one `unknown_family` line
 * when a physical-looking number target has no family (once per goal), and one `no_start` line. Only the accepted
 * roadmap is logged, so a retried attempt never logs.
 */
export function logRoadmapTargets(
  goalId: string,
  roadmap: { weeks: Array<{ target: WeekTarget }>; loweredTargets?: LoweredTarget[] },
  /** From `generateRoadmap`; when missing (never on the real path), only the lowered targets are logged. */
  check: TargetCheck | undefined
): void {
  const first = roadmap.weeks[0]?.target;
  if (!first || first.kind !== 'number') return;
  const { family, noStart } = check ?? { family: 'unchecked' as const, noStart: false };
  for (const item of roadmap.loweredTargets ?? []) {
    logSafetyHit({
      goalId,
      week: item.week,
      rule: 'target_step',
      step: `Week ${item.week} target`,
      matched: `${first.metric}: ${item.model} ${first.unit} lowered to ${item.safe} ${first.unit}`,
      model: item.model,
      safe: item.safe,
      outcome: 'lowered',
    });
  }
  const highLoad = check?.pathwayId !== undefined && HIGH_LOAD_PRESET_IDS.includes(check.pathwayId);
  if (family === null && looksPhysical(first, { highLoad })) {
    logSafetyHit({ goalId, week: 1, rule: 'unknown_family', step: 'Roadmap targets', matched: `${first.metric} (${first.unit})`, outcome: 'logged' });
  }
  if (noStart) {
    logSafetyHit({ goalId, week: 1, rule: 'no_start', step: 'Week 1 target', matched: 'no starting point; week 1 not checked', outcome: 'logged' });
  }
}
