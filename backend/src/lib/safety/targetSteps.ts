/**
 * Plan safety limits M1.2 (RULE-3, PSL-10): what a goal's number measures (its family), which picks the week load
 * limits (`loadGoalFor`), and the run level a starting point stands for (PSL-19). No weekly tests (2026-10-30): the
 * safe target climb went with the targets; the limits that stay check the sessions themselves (`weekLoad.ts`). Pure.
 */
import type { WeekTarget } from '../ai/roadmap.js';

export type TargetFamily = 'running_distance' | 'running_time' | 'lift_load' | 'body_weight' | 'body_fat' | 'calorie_deficit';


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

/**
 * Plan safety limits M3.1 (PSL-19): what the person already runs in one go, read from the roadmap's starting point (in
 * the targets' metric and unit): a single run's distance or its continuous minutes, higher is better, with a metric
 * that names one run ("longest run", "continuous run") and no week ("weekly mileage", "total"). A race time is never
 * read (the roadmap's cautious guess for a time is a slower, so larger, number, and it isn't time they have run), nor
 * a pace, another family or no starting point. Used only to raise the fixed longest-run cap of a week with no base
 * week, never above what they already do.
 */
/** A metric that names a single run, and one that names a week's running. */
const ONE_RUN_WORDS = /\b(?:longest|long run|continuous|continuously|non-?stop|single|in one go|without stopping|one run)\b/;
const WEEK_WORDS = /\b(?:week|weeks|weekly|per week|a week|mileage|total|volume|cumulative|monthly)\b/;

export interface RunLevel {
  km?: number;
  minutes?: number;
}

export function runLevelOf(target: WeekTarget, startValue: number | null | undefined, context: FamilyContext = {}): RunLevel | null {
  if (target.kind !== 'number' || typeof startValue !== 'number' || !Number.isFinite(startValue) || startValue <= 0) return null;
  if (targetFamily(target, context) !== 'running_distance' || target.direction !== 'higher_is_better' || isPaceUnit(target.unit)) return null;
  const metric = target.metric.toLowerCase();
  if (!ONE_RUN_WORDS.test(metric) || WEEK_WORDS.test(metric)) return null;
  const km = kmPerUnit(target.unit);
  if (km !== null) return { km: startValue * km };
  const minutes = minutesPerUnit(target.unit);
  return minutes !== null ? { minutes: startValue * minutes } : null;
}
