import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';
import { generateWithOneRetry } from './retry.js';
import { WEEKLY_TEST_KIND, type RecoveryProfile, type Restart } from '../recovery/profile.js';
import { fitStepMinutes } from './scheduleRepair.js';
import { dayQualityFailures, polishDays } from './taskRules.js';
import { EARLY_WEEKS, SAFETY_LIMIT_TEXT, logSafetyHit, stepSafetyHits, type SafetyLogLine, type SafetyRule } from './safetyScan.js';
import type { FirstWeekBack } from '../weekClose/breaks.js';
import { STEP_LOAD_SCHEMA, loadNeed, missingLoad, parseStepLoad, withMinutes, withoutLoad, type LoadGoal } from '../safety/stepLoad.js';
import {
  CALORIE_DEFICIT_MAX,
  CALORIE_DEFICIT_MIN,
  DAILY_INTAKE_MIN_KCAL,
  EARLY_WEEK_MAX_1RM_PERCENT,
  EARLY_WEEK_MIN_RIR,
  HARD_RUNS_MAX,
  LONGEST_RUN_MAX_PERCENT,
  LONGEST_RUN_MIN_RUNS,
  LONGEST_RUN_NO_BASE_MAX_KM,
  LONGEST_RUN_NO_BASE_MAX_MINUTES,
} from '../safety/limits.js';
import {
  TEST_STEP_TITLE,
  firstWeekBackLimit,
  firstWeekBackSummary,
  noBaseCap,
  runOf,
  runningLimit,
  shareOf,
  testStepOf,
  shown,
  shownLimit,
  stepLoadBreaches,
  weekBreaches,
  weekRunning,
  type BaseWeek,
  type CodeMadeTest,
  type LoadBreach,
  type Run,
} from '../safety/weekLoad.js';
import { isExperiencedLifter } from '../safety/experience.js';
import type { RunLevel } from '../safety/targetSteps.js';
import { DEFAULT_WEEKS, planShape } from '../planLength.js';
import { formatAnswerLines, type ChosenMethod, type PlanAnswer, type RoadmapPhase } from './roadmap.js';

export type PlanVariant = 'steady' | 'accelerated' | 'minimal';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_STEPS = 2;
const MAX_STEPS = 4;
const MINIMUM_VERSION_MINUTES = 10;
const REST_STEP_MAX_MINUTES = 15;

export function activeDaysFor(variant: PlanVariant): number {
  return variant === 'minimal' ? 4 : variant === 'accelerated' ? 6 : 5;
}

/** 0-based days of the week that are rest days, the variant's own: never two in a row. Chosen ones may be (B-108). */
export function restDayIndices(variant: PlanVariant): number[] {
  return variant === 'minimal' ? [2, 4, 6] : variant === 'accelerated' ? [6] : [3, 6];
}

export function slotTimeFor(preferredSlot?: string): string {
  return preferredSlot === 'morning' ? '07:30' : preferredSlot === 'afternoon' ? '14:00' : '19:30';
}

export interface DayLayout {
  dayNumber: number;
  date: string;
  dayOfWeek: string;
  isRestDay: boolean;
  isTestDay: boolean;
}

/** Which days are practice, rest and test is decided here, not by the model. */
/**
 * Edit my schedule (B-108): the rest days the person chose, as weekdays (0 Sunday to 6 Saturday), when they are valid for
 * `variant`: whole numbers 0 to 6, no repeats, exactly `7 - activeDaysFor(variant)` of them. Sorted; null otherwise, so
 * the variant's own positions apply. Two in a row (a weekend off) is allowed.
 */
export function validRestWeekdays(variant: PlanVariant, value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) return null;
  const days = [...new Set(value as number[])].sort((a, b) => a - b);
  return days.length === value.length && days.length === 7 - activeDaysFor(variant) ? days : null;
}

/**
 * The week's seven days from `weekStart`. Rest days: the chosen weekdays (`restWeekdays`, B-108) when valid for the
 * variant, otherwise the variant's fixed positions from the week's first day. No weekly tests (2026-10-30): no day is
 * a test day (`isTestDay` stays on the row, always false for a week written now).
 */
export function weekLayout(variant: PlanVariant, weekStart: Date, restWeekdays?: readonly number[] | null): DayLayout[] {
  const rest = restDayIndices(variant);
  const chosen = validRestWeekdays(variant, restWeekdays);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      dayNumber: index + 1,
      date: date.toISOString().split('T')[0],
      dayOfWeek: DAY_NAMES[date.getUTCDay()],
      isRestDay: chosen ? chosen.includes(date.getUTCDay()) : rest.includes(index),
      isTestDay: false,
    };
  });
  return days;
}

export interface WeekDayPlan extends DailyTaskPlan {
  date: string;
  isKeySession: boolean;
  isTestDay: boolean;
  whyToday: string;
  /** The 10-minute step for days the full session won't happen. Null on rest days. */
  minimumVersion: DetailedStep | null;
  /**
   * The id the day is saved with, given before code places last week's steps so a step it moves keeps the day it was
   * written on (`placeHandoff`). Missing: the database gives one.
   */
  taskId?: string;
}

/** How a done session felt, as the person tapped it (`DailyTask.feel`). */
export type Feel = 'too_easy' | 'just_right' | 'too_hard';
export const FEELS: readonly Feel[] = ['too_easy', 'just_right', 'too_hard'];

/**
 * No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md section 7): what last week was like, read from its
 * days. The next week is written from it: the pace line (`paceOf`), the taps and the notes, word for word.
 */
export interface LastWeekSummary {
  done: number;
  planned: number;
  keySessionsSkipped: string[];
  /** How many done sessions they tapped as each feel. */
  feel: Record<Feel, number>;
  /** Their notes on last week's days, each with its day ("Tuesday: my knee hurt"). */
  notes: string[];
  /** Their reflection in the weekly review, when they wrote one. */
  reflection?: string;
}

export type Pace = 'bigger_step' | 'move_on' | 'smaller_step' | 'repeat';

/** At or above this share of sessions done, the week moves on. */
export const PACE_MOVE_ON_PERCENT = 80;
/** Under this share, last week's level is repeated. */
export const PACE_REPEAT_PERCENT = 50;

/**
 * Section 7's pace rule: most done (80% or more) and mostly "too easy", a bigger step; most done otherwise, move on;
 * half to most done (50% to 79%), or mostly "too hard", the same level with a smaller step; under half, repeat. "Mostly"
 * is more taps of that feel than of the other two together. A week with no practice planned moves on.
 */
export function paceOf(last: Pick<LastWeekSummary, 'done' | 'planned' | 'feel'>): Pace {
  const share = last.planned > 0 ? (last.done / last.planned) * 100 : 100;
  const { too_easy: easy, just_right: right, too_hard: hard } = last.feel;
  if (share < PACE_REPEAT_PERCENT) return 'repeat';
  if (hard > easy + right) return 'smaller_step';
  if (share < PACE_MOVE_ON_PERCENT) return 'smaller_step';
  return easy > right + hard ? 'bigger_step' : 'move_on';
}

const PACE_LINE: Record<Pace, string> = {
  bigger_step: 'They did most of last week and found it too easy: take a bigger step forward than the method usually would this week.',
  move_on: 'They did most of last week: move on to the next step, as the method says.',
  smaller_step: 'Keep the same level as last week and take only a small step forward; make the sessions a little easier to finish.',
  repeat: 'They did under half of last week: repeat last week\'s level, a little lighter, so they can get back into it. Nothing new this week.',
};

export interface WeekCallInput {
  finalGoal: string;
  answers: PlanAnswer[];
  dailyMinutes: number;
  planVariant: PlanVariant;
  /** Edit my schedule (B-108): the chosen rest weekdays (0 Sunday to 6 Saturday); absent keeps the variant's positions. */
  restWeekdays?: number[];
  slotTime: string;
  method: Pick<ChosenMethod, 'name' | 'creator' | 'rules'>;
  weekNumber: number;
  totalWeeks: number;
  phase: Pick<RoadmapPhase, 'name' | 'purpose'>;
  focus: string;
  weekStart: Date;
  /** What last week was like; missing for week 1. */
  lastWeek?: LastWeekSummary;
  /** ND-5: a physical preset goal (`isHighLoadGoal`); every practice step is then high-load, unless the goal has a profile. */
  highLoadGoal?: boolean;
  /**
   * Method-aware recovery (M2.1, RULE-6): the goal's checked recovery profile. With one, every practice-day step must
   * carry one of its kind ids, or the week is not saved. Without one, the week call is exactly as before.
   */
  recovery?: RecoveryProfile | null;
  /**
   * Method-aware recovery M3.1d (RULE-20, MR-32): where the person is, from last week (`handoffBrief` in
   * `recovery/handoff.ts`). Given only when `METHOD_RECOVERY_ENABLED` is on and there is something to say; told, never
   * checked. Without it the prompt is exactly as before.
   */
  whereTheyAre?: string[];
  /**
   * Weekly update M1.5a (WU-25 (3), WU-29 (1)): the first week back after a break, given only with `WEEK_CLOSE_ENABLED`
   * on. Told, never checked. Without it the prompt is exactly as before. M1.5b (WU-41): with `highLoad` the week is
   * scanned as a light week (`ScanOptions.light`): the weeks 1 to 3 rules and the time-trial rule.
   */
  firstWeekBack?: Pick<FirstWeekBack, 'awayDays' | 'note' | 'highLoad'> & { restart?: Restart | null };
  /** B-63: only for the `[Safety]` log line; logged as null when not given. */
  goalId?: string;
  /** B-91: when given, `[Safety]` lines are added here instead of logged, so goal create can log them with the new goal id. */
  heldSafetyLines?: SafetyLogLine[];
  /**
   * Plan safety limits M2.1 (RULE-4, PSL-8): given only on a load goal (`loadGoalFor`). The schema and the prompt then
   * ask the steps PSL-8 names for their `load`, and a missing one is a soft retry reason. Without it the call is exactly
   * as before.
   */
  loadGoal?: LoadGoal;
  /**
   * Plan safety limits M2.2a (RULE-5, B-64, PSL-15 (1)): the base week the running total is held to, given only on a
   * load goal for a week that has one (`baseWeekOf` over the closing week). `known: false` is no base: the running total
   * is not checked and `no_base` is logged once. Not given (week 1): no base, nothing logged. Every other limit applies.
   * M2.2b: on a first week back it is `firstWeekBackBaseOf`'s (`firstWeekBack` set), logged once as `first_week_back_base`.
   */
  baseWeek?: BaseWeek;
}

/** The week call's system text; B-109: a shorter plan names its weeks (`weekSystem(12)` is exactly as before). */
export function weekSystem(totalWeeks: number = DEFAULT_WEEKS): string {
  const plan = planShape(totalWeeks).weeks === DEFAULT_WEEKS ? '90-day' : `${planShape(totalWeeks).weeks}-week`;
  return `You write one week of daily practice for a person following a ${plan} plan. The goal, the method and this week's
focus are already decided. Do not change them. Every day must move the person forward on this week's focus, at the pace
last week calls for.
Respond with one JSON object that matches the schema.`;
}

/** A 12-week plan's system text. */
export const WEEK_SYSTEM = weekSystem();

const stepProperties = {
  title: { type: 'string' },
  instructions: { type: 'string' },
  minutes: { type: 'integer' },
  output: { type: 'string' },
  doneWhen: { type: 'string' },
  focusCue: { type: 'string' },
  pitfall: { type: 'string' },
};

export const WEEK_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayNumber: { type: 'integer' },
          isKeySession: { type: 'boolean' },
          title: { type: 'string' },
          whyToday: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: { ...stepProperties, priority: { type: 'integer' }, timing: { type: 'string' }, highLoad: { type: 'boolean' }, dueDate: { type: 'string' } },
              required: ['title', 'instructions', 'minutes', 'output', 'doneWhen', 'focusCue', 'pitfall', 'priority', 'highLoad'],
            },
          },
          minimumVersion: {
            type: 'object',
            properties: stepProperties,
            required: ['title', 'instructions', 'minutes', 'output', 'doneWhen'],
          },
        },
        required: ['dayNumber', 'isKeySession', 'title', 'whyToday', 'steps'],
      },
    },
  },
  required: ['days'],
};

/**
 * The response schema for one week call (RULE-6). Without a profile and a load goal it is `WEEK_RESPONSE_SCHEMA`,
 * unchanged. With a profile, every step requires `kind`, a fixed menu of the profile's kind ids. Gemini may drop the
 * schema, so `checkWeekAnswer` checks every kind too. On a load goal (plan safety limits M2.1), the step and the
 * 10-minute version each get an optional `load`, never required: only some steps carry one.
 */
export function weekResponseSchema(recovery?: RecoveryProfile | null, loadGoal?: LoadGoal): typeof WEEK_RESPONSE_SCHEMA {
  if (!recovery && !loadGoal) return WEEK_RESPONSE_SCHEMA;
  const schema = structuredClone(WEEK_RESPONSE_SCHEMA);
  const dayProperties = schema.properties.days.items.properties;
  const stepItems = dayProperties.steps.items as {
    properties: Record<string, unknown>;
    required: string[];
  };
  if (recovery) {
    stepItems.properties.kind = { type: 'string', enum: writableKinds(recovery).map((kind) => kind.id) };
    stepItems.required = [...stepItems.required, 'kind'];
  }
  if (loadGoal) {
    stepItems.properties.load = STEP_LOAD_SCHEMA;
    (dayProperties.minimumVersion.properties as Record<string, unknown>).load = STEP_LOAD_SCHEMA;
  }
  return schema;
}

function dayLines(layout: DayLayout[]): string {
  return layout
    .map((day) => `- Day ${day.dayNumber} (${day.dayOfWeek}): ${day.isRestDay ? 'rest' : 'practice'}`)
    .join('\n');
}

/** Section 7: last week as the writer reads it: sessions done, how they felt, their notes, and the pace that follows. */
function lastWeekBlock(input: WeekCallInput): string {
  if (!input.lastWeek) return '';
  const last = input.lastWeek;
  const taps = FEELS.filter((feel) => last.feel[feel] > 0).map((feel) => `${last.feel[feel]} ${FEEL_WORDS[feel]}`);
  const lines = [
    '',
    'LAST WEEK',
    `Sessions done: ${last.done} of ${last.planned}.`,
    `Key sessions skipped: ${last.keySessionsSkipped.length ? last.keySessionsSkipped.join('; ') : 'none'}.`,
    `How the done sessions felt: ${taps.length ? taps.join(', ') : 'not told'}.`,
  ];
  if (last.notes.length) lines.push('Their notes (take them into account, e.g. an injury, a busy day or something they enjoyed):', ...last.notes.map((note) => `- ${note}`));
  if (last.reflection) lines.push(`Their weekly review: "${last.reflection}"`);
  lines.push(`Pace this week: ${PACE_LINE[paceOf(last)]}`);
  return lines.join('\n');
}

const FEEL_WORDS: Record<Feel, string> = { too_easy: 'too easy', just_right: 'just right', too_hard: 'too hard' };

const NL = '\n';

const HIGH_LOAD_LINE =
  '  - highLoad: true when the step puts real physical strain on the body (running, lifting, high-intensity or impact work); otherwise false';

/**
 * RULE-6, RULE-8, MR-20: the kinds as the week writer sees them: id, name and description, never the action. Steps
 * of a move kind carry their own warm-up; work that only makes sense together is one step.
 */
const orList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : items[0] ?? '');

/**
 * The kinds the week writer may give a step. No weekly tests (2026-10-30): the Weekly test kind stays on the profile
 * for steps stored before then (the carry still reads it), but is never offered or taken from a new answer.
 */
function writableKinds(recovery: RecoveryProfile): RecoveryProfile['kinds'] {
  return recovery.kinds.filter((kind) => kind.id !== WEEKLY_TEST_KIND.id);
}

function kindsBlock(recovery: RecoveryProfile): string {
  const offered = writableKinds(recovery);
  const lines = offered.map((kind) => `- ${kind.id}: ${kind.name}. ${kind.description}`);
  const standalone = offered.filter((kind) => kind.action === 'move').map((kind) => kind.id);
  const rules = [
    standalone.length
      ? `- A step whose kind is ${orList(standalone)} starts with its own short warm-up (5 minutes or less) inside its instructions, so it can be done on another day on its own.`
      : '',
    '- Work that only makes sense together, such as a game and its review, is written as one step.',
    "- A warm-up, cool-down or log of a session is written inside that session's step (in its instructions), never as a step of its own.",
    // B-92: the rules above read as "one session, one step"; without this line a run day came back as one step.
    '- A practice day still has 2 to 4 steps: a day built around one session, such as a run, adds a second step of another kind, such as drills, strides, mobility or technique work.',
    '- Use fixed_time_session only for something set for a time by others, such as a class, a group run or a call.',
  ].filter(Boolean);
  return ['', '', 'KINDS OF STEP (every practice-day step has exactly one "kind": one of these ids, written exactly)', ...lines, ...rules].join(NL);
}

/**
 * M3.1 (PSL-20): the one place that decides whether weeks 1 to 3 drop the % of 1RM and reps-in-reserve caps, read by
 * the prompt and the checks alike: someone who already lifts (`isExperiencedLifter`), on a goal that isn't a running
 * goal, outside a light week (a high-load first week back keeps every cap).
 */
export function liftCapsRelaxed(input: Pick<WeekCallInput, 'answers' | 'loadGoal' | 'firstWeekBack'>): boolean {
  return input.loadGoal?.running !== true && !isLightWeek(input) && isExperiencedLifter(input.answers);
}

/**
 * B-63 (PSL-1, PSL-2): the limits. In weeks 1 to 3 it says plainly that it overrides the method's reps-in-reserve
 * range. Plan safety limits M2.2a (RULE-5, PSL-11 Q17): told on every load goal, with the running line naming the number
 * from the base week, the longest-run rule and the intake floor; every number is from the limits module. Without a load
 * goal the prompt is unchanged.
 */
function safetyLimitsBlock(input: WeekCallInput): string {
  // M2.2a review: every high-load preset is a load goal (`loadGoalFor`), so the load goal alone decides.
  if (!input.loadGoal) return '';
  const lines = [
    '',
    '',
    'SAFETY LIMITS (these override the method and the target; a week whose steps break any of them is not saved)',
    ...runningLines(input.baseWeek, input.loadGoal?.runLevel),
    `- At most ${HARD_RUNS_MAX} hard runs this week (intervals, tempo, race pace).`,
    `- Calorie deficit: ${CALORIE_DEFICIT_MIN} to ${CALORIE_DEFICIT_MAX} kcal a day, never more.`,
    `- Daily intake: never below ${DAILY_INTAKE_MIN_KCAL} kcal a day.`,
  ];
  // M3.1 (PSL-20): an experienced lifter keeps the method's % of 1RM and reps in reserve; failure and max tests still wait.
  if (input.weekNumber <= EARLY_WEEKS && liftCapsRelaxed(input)) {
    lines.push(`- Weeks 1 to 3: nothing to failure, no max or 1RM test; loads and reps in reserve follow the method (they already lift).`);
  } else if (input.weekNumber <= EARLY_WEEKS) {
    lines.push(
      `- Weeks 1 to 3: no lift above ${EARLY_WEEK_MAX_1RM_PERCENT}% of 1RM, at least ${EARLY_WEEK_MIN_RIR} reps in reserve, nothing to failure, no max or 1RM test.`,
      `- In weeks 1 to 3 this overrides the method's RIR range: at least ${EARLY_WEEK_MIN_RIR} reps in reserve.`
    );
  }
  return lines.join(NL);
}

/**
 * M2.2a (PSL-11 Q17, PSL-15 (3), (7)): the running total's limit in the unit it is compared in (a km base week is
 * compared in minutes when any run of this week is not in km), and the longest-run rule. No base: the fixed cap.
 * PSL-16: after a base of 0 runs, no running total, and every run held to the fixed cap.
 * M2.2b (PSL-18): a first week back names its limit (no allowance, the floor, half after a long break); its unknown base
 * gets the 0-run base's longest-run and cap lines, with its running line saying it isn't known.
 */
export function runningLines(base: BaseWeek | undefined, level?: RunLevel | null): string[] {
  const longest = `- Longest run: at most ${LONGEST_RUN_MAX_PERCENT}% of the week's running when there are ${LONGEST_RUN_MIN_RUNS} or more runs.`;
  const cap = `${LONGEST_RUN_NO_BASE_MAX_MINUTES} minutes (${LONGEST_RUN_NO_BASE_MAX_KM} km when every run is given in km)`;
  // M3.1 (PSL-19): with no last week, the cap is never below what they already run in one go (their starting point).
  // Rounded down as the check reads it (`shownLimit`), so the prompt never names more than the check allows.
  const noBase = `${shownLimit(noBaseCap('minutes', level), 'minutes')} minutes (${shownLimit(noBaseCap('km', level), 'km')} km when every run is given in km)`;
  const zeroLines = ['- Running: last week had no running; keep it at their level.', longest, `- No run longer than ${cap}.`];
  if (!base?.known) {
    // M2.2b review: held like a 0-run base, told as not known.
    if (base?.firstWeekBack) return ["- Running: last week's running isn't known; keep it at their level.", ...zeroLines.slice(1)];
    return ['- Running: there is no last week to count from; keep it at their level.', longest, `- With fewer than ${LONGEST_RUN_MIN_RUNS} runs, no run longer than ${noBase}.`];
  }
  if (base.runs === 0) return zeroLines;
  if (base.firstWeekBack) return [...firstWeekBackLines({ ...base, firstWeekBack: base.firstWeekBack }), longest];
  const minutes = runningLimit(base, 'minutes');
  if (base.unit === 'minutes') {
    const most = shownLimit(minutes.limit, 'minutes');
    return [
      `- Running: at most ${most} minutes this week in all (last week ${shown(base.totalMinutes)} minutes). Add up the runMinutes of every run before you answer; the total must be at most ${most} minutes.`,
      longest,
    ];
  }
  const km = runningLimit(base, 'km');
  return [
    `- Running: at most ${shownLimit(km.limit, 'km')} km this week in all when every run is given in km, otherwise at most ${shownLimit(minutes.limit, 'minutes')} minutes (last week ${shown(base.total)} km, ${shown(base.totalMinutes)} minutes). Add up the runKm of every run before you answer; the total must be at most ${shownLimit(km.limit, 'km')} km (or the runMinutes, at most ${shownLimit(minutes.limit, 'minutes')} minutes, when any run is not given in km).`,
    longest,
  ];
}

/**
 * M2.2b (RULE-7, PSL-11 Q17, PSL-18): a first week back's running line, in the base's unit, then the add-up line M2.2a's
 * running line ends with (a km base also gives the limit in minutes, for a week with a run not given in km).
 */
function firstWeekBackLines(base: Parameters<typeof firstWeekBackLimit>[0]): string[] {
  const back = base.firstWeekBack;
  const limit = firstWeekBackLimit(base, base.unit);
  const most = shownLimit(limit.limit, base.unit);
  const long = back.percent < 100;
  const what = long ? `, ${shareOf(back.percent)} of what they last completed (week ${back.fromWeek})` : `, what they last completed (week ${back.fromWeek})`;
  const head = `- Running: first week back${long ? ' after a long break' : ''}; at most ${most} ${base.unit} in total${limit.byFloor ? '' : what}.`;
  if (base.unit === 'minutes') return [head, `- Add up the runMinutes of every run before you answer; the total must be at most ${most} minutes.`];
  const minutes = shownLimit(firstWeekBackLimit(base, 'minutes').limit, 'minutes');
  return [head, `- Add up the runKm of every run before you answer; the total must be at most ${most} km (or the runMinutes, at most ${minutes} minutes, when any run is not given in km).`];
}

/** Plan safety limits M2.1 (RULE-4, PSL-8): the step-fields line on a load goal, worded from `loadNeed`. */
export function loadLine(_loadGoal: LoadGoal): string {
  const which = 'a running step, a cardio step, a lifting step and any step with highLoad true';
  return [
    `  - load: only on ${which},`,
    "    and on the minimumVersion when the day's priority-1 step has one: the step's numbers, leaving out any that don't",
    '    apply. A step with any running in it gives runMinutes or runKm. Running: runMinutes (minutes of running) or runKm',
    '    (km run), and hardRun (true for intervals, tempo or race pace, otherwise false). Lifting: percent1RM (the heaviest',
    '    set as a % of 1-rep max) or rir (the fewest reps in reserve), toFailure (true if any set goes to failure) and',
    '    maxTest (true for a max or 1RM test). Food: kcalDeficit (kcal a day below maintenance) and kcalIntake (kcal eaten',
    '    a day).',
  ].join(NL);
}

export function buildWeekPrompt(input: WeekCallInput, layout: DayLayout[]): string {
  const base = buildBaseWeekPrompt(input, layout) + safetyLimitsBlock(input);
  const fieldLines = [
    HIGH_LOAD_LINE,
    ...(input.recovery ? ['  - kind: the id of the kind of step it is, from KINDS OF STEP below'] : []),
    ...(input.loadGoal ? [loadLine(input.loadGoal)] : []),
  ];
  const prompt = fieldLines.length > 1 ? base.replace(HIGH_LOAD_LINE, fieldLines.join(NL)) : base;
  if (!input.recovery) return prompt + firstWeekBackBlock(input);
  return prompt + kindsBlock(input.recovery) + whereTheyAreBlock(input) + firstWeekBackBlock(input);
}

/** The return rule's restart, as the writer reads it (no weekly tests, 2026-10-30: the level, not a target). */
const RESTART_WORDS: Record<Restart, string> = {
  'last level': 'pick up at the level of the last week they trained.',
  'back 1 week': 'go back one week: the level of the week before their last one.',
  'back 2 weeks': 'go back two weeks: the level of two weeks before their last one.',
};

/**
 * M1.5a (WU-25 (3), WU-29 (1)): the days away, the restart level and the return rule's note; for a high-load goal,
 * the "at or below" line and the load limits.
 */
export function firstWeekBackBlock(input: Pick<WeekCallInput, 'firstWeekBack'>): string {
  const back = input.firstWeekBack;
  if (!back) return '';
  const heading = back.highLoad ? 'FIRST WEEK BACK (after a break; the limits below are checked)' : 'FIRST WEEK BACK (after a break; nothing here is checked)';
  const lines = ['', '', heading, `- They have been away ${back.awayDays} days. This is their first week back.`];
  if (back.restart) lines.push(`- Restart level: ${RESTART_WORDS[back.restart]}`);
  if (back.note) lines.push(`- For the first week back, the method says: ${back.note}`);
  if (back.highLoad) {
    lines.push(
      '- Keep every session at or below what they last completed.',
      `- No time trial or all-out effort, no max or 1RM test, nothing to failure, no lift above ${EARLY_WEEK_MAX_1RM_PERCENT}% of 1RM, at least ${EARLY_WEEK_MIN_RIR} reps in reserve. A week that breaks this is not saved.`
    );
  }
  return lines.join(NL);
}

/** M3.1d: what last week hands on. Code places the carried steps after the answer; nothing here is checked. */
function whereTheyAreBlock(input: WeekCallInput): string {
  if (!input.whereTheyAre?.length) return '';
  return ['', '', 'WHERE THEY ARE (from last week; code acts on this after you answer, nothing here is checked)', ...input.whereTheyAre].join(NL);
}

/**
 * B-109: a shorter plan's last week is the ready week before their date; the line says so. Empty in any other week, so
 * every 12-week plan's prompt is exactly as before.
 */
function readyWeekLine(input: WeekCallInput): string {
  if (planShape(input.totalWeeks).readyWeek !== input.weekNumber) return '';
  return `${NL}Ready week: their date (an exam, a race, a talk) is right after this week. Make this week lighter than last week:
shorter, easier sessions and nothing new, only sharpening what they already do, so they arrive rested and confident.
No hard or all-out effort, and no max or test.`;
}

function buildBaseWeekPrompt(input: WeekCallInput, layout: DayLayout[]): string {
  const method = input.method.creator ? `${input.method.name} by ${input.method.creator}` : input.method.name;
  const activeNames = layout.filter((day) => !day.isRestDay).map((day) => day.dayOfWeek).join(', ');
  return `THE PERSON
Goal: ${input.finalGoal}
Their answers:
${formatAnswerLines(input.answers)}
Time: ${input.dailyMinutes} minutes a day on ${activeNames}

THE METHOD
${method}
Rules (follow every one):
${input.method.rules.map((rule) => `- ${rule}`).join('\n')}

THIS WEEK
Week ${input.weekNumber} of ${input.totalWeeks}, phase "${input.phase.name}": ${input.phase.purpose}
Focus: ${input.focus}${readyWeekLine(input)}
${lastWeekBlock(input)}

THE DAYS (already decided; keep them)
${dayLines(layout)}

WRITE THE WEEK
- 7 days, dayNumber 1-7, exactly as listed above.
- No tests: no "weekly test", time trial or measuring session. The plan is adjusted from what they do and how it feels.
- Mark 1-2 practice days as key sessions ("isKeySession": true): the hardest sessions that matter most for the goal.
  Put them mid-week.
- Each practice day has:
  - title: what they get done, e.g. "Hold a 3-minute conversation about your weekend", not "Speaking practice"
  - whyToday: one sentence on how this day moves them forward on this week's focus
  - 2-4 steps that each do something different, with minutes adding up to ${input.dailyMinutes}
  - minimumVersion: one 10-minute step for days they can't do the full session. It must still move them
    forward.
- Each step has:
  - title and instructions: specific enough to start without looking anything up
  - minutes
  - output: what they end up with
  - doneWhen: the check that it's good enough
  - focusCue and pitfall
  - priority: 1 = most important today, no ties
  - timing (optional): only when the step can't follow the previous one straight away
  - highLoad: true when the step puts real physical strain on the body (running, lifting, high-intensity or impact work); otherwise false
  - dueDate (optional, YYYY-MM-DD): only when an outside deadline sets the step's date, such as an application or entry due that day
- No two practice days are the same. Most practice days include doing the real thing, not only preparing for it.
- Only use equipment they have. Match their level. Never assign loads beyond what is safe for their level.
- No steps for journaling, reflecting, or reading about the method. Breaks go inside a step's instructions,
  never as their own step.
- Rest days: "steps" is empty, or one light step of 15 minutes at most. "isKeySession": false.`;
}

interface RawStep {
  title?: unknown;
  instructions?: unknown;
  minutes?: unknown;
  output?: unknown;
  doneWhen?: unknown;
  focusCue?: unknown;
  pitfall?: unknown;
  priority?: unknown;
  timing?: unknown;
  highLoad?: unknown;
  kind?: unknown;
  load?: unknown;
  dueDate?: unknown;
}

interface RawDay {
  dayNumber?: unknown;
  isKeySession?: unknown;
  title?: unknown;
  whyToday?: unknown;
  steps?: unknown;
  minimumVersion?: RawStep | null;
}

export interface RawWeekAnswer {
  days?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function int(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/** A step whose kind could not be matched to the profile, with what the model wrote (for the reason). */
type ParsedStep = DetailedStep & { priority: number; badKind?: string };

/**
 * RULE-6: the profile's kind id for what the model wrote: an exact id, or an exact name (case-insensitive) mapped to
 * its id, among the kinds it may write (`writableKinds`). Null when it matches neither.
 */
export function resolveKind(value: unknown, recovery: RecoveryProfile): string | null {
  const written = text(value);
  if (!written) return null;
  const kinds = writableKinds(recovery);
  const byId = kinds.find((kind) => kind.id === written);
  if (byId) return byId.id;
  const byName = kinds.find((kind) => kind.name.toLowerCase() === written.toLowerCase());
  return byName ? byName.id : null;
}

function toStep(raw: RawStep, stepNumber: number, recovery?: RecoveryProfile | null, withLoad = false): ParsedStep {
  const timing = text(raw.timing);
  const kind = recovery ? resolveKind(raw.kind, recovery) : null;
  // Plan safety limits M2.1: read only on a load goal, so any other goal's steps are exactly as before.
  const load = withLoad ? parseStepLoad(raw.load) : undefined;
  const dueDate = dueDateOf(raw.dueDate);
  return {
    stepNumber,
    title: text(raw.title),
    durationMinutes: Math.max(0, int(raw.minutes) ?? 0),
    instructions: text(raw.instructions),
    focusCue: text(raw.focusCue),
    pitfallToAvoid: text(raw.pitfall),
    passMark: text(raw.doneWhen),
    output: text(raw.output),
    ...(timing ? { timing } : {}),
    priority: int(raw.priority) ?? Number.MAX_SAFE_INTEGER,
    // ND-5: only a real boolean counts; a missing or odd value is never a reason to retry.
    highLoad: raw.highLoad === true,
    ...(kind ? { kind } : recovery ? { badKind: text(raw.kind) } : {}),
    ...(load ? { load } : {}),
    ...(dueDate ? { dueDate } : {}),
  };
}

/** B-39: a real calendar date written YYYY-MM-DD, or nothing. */
export function dueDateOf(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

/** Removes the parsing-only field, and on rest days the kind too (MR-15). */
function cleanStep<T extends ParsedStep | DetailedStep>(step: T, keepKind = true): DetailedStep {
  const { badKind: _bad, ...clean } = step as ParsedStep;
  if (!keepKind) delete clean.kind;
  return clean;
}

/** Keeps the model's order, and turns its priorities into 1..n with no ties. */
function rankSteps(steps: Array<DetailedStep & { priority: number }>): DetailedStep[] {
  const ranked = steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.priority - b.step.priority || a.index - b.index);
  const rankOf = new Map(ranked.map((item, rank) => [item.index, rank + 1]));
  return steps.map((step, index) => ({ ...step, stepNumber: index + 1, priority: rankOf.get(index)! }));
}

function keepTopSteps(steps: Array<DetailedStep & { priority: number }>, max: number) {
  if (steps.length <= max) return steps;
  const keep = new Set(
    steps
      .map((step, index) => ({ step, index }))
      .sort((a, b) => a.step.priority - b.step.priority || a.index - b.index)
      .slice(0, max)
      .map((item) => item.index)
  );
  return steps.filter((_, index) => keep.has(index));
}

function signature(task: DailyTaskPlan): string {
  return task.detailedSteps
    .map((step) => step.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
    .sort()
    .join('|');
}

const TEST_STEP = TEST_STEP_TITLE;

/**
 * RULE-8, MR-25: a practice-day step that is only a warm-up, cool-down or log, judged by the title's first or last
 * words ("Warm-up tsumego", "Easy indoor warm-up", "Log workout metrics", "Workout metrics logging"). A title that
 * names one inside real work ("Dynamic warm-up and ramp-up pulls", "Send the messages and log them") is not one.
 */
const SIDE_STEP_START = /^(?:warm(?:ing)?[\s-]?ups?|cool(?:ing)?[\s-]?downs?|log(?:s|ging)?)\b/i;
const SIDE_STEP_END = /\b(?:warm[\s-]?ups?|cool[\s-]?downs?|log(?:s|ging)?)[.!]?$/i;

export function isSideStepTitle(title: string): boolean {
  const trimmed = title.trim();
  return SIDE_STEP_START.test(trimmed) || SIDE_STEP_END.test(trimmed);
}
/** A pause is part of a step's instructions, not a step of its own. */
const BREAK_STEP = /\b(break|breather)\b|^rest\b/i;

/**
 * M1.5b (WU-41): the test step of a light week when the model's own can't be used (left out, or refused on the last
 * attempt). Fixed text, so a light week can always be written; the stored test and target never change.
 */
export const LIGHT_TEST_STEP = {
  title: 'Weekly test: an easy version',
  instructions: "First week back: do this week's test at an easy, comfortable effort, never all-out. Note what you did and how it felt.",
  passMark: 'No pass mark this week; just log what you did.',
} as const;

/**
 * Plan safety limits M2.2a: `codeMadeTestStep` recognises the code-made test step, stored ones included, by this exact
 * text (the base week reads stored weeks). Never change it, or stored test steps stop being recognised.
 */
const CODE_TEST_FOCUS = 'Your honest best, done exactly as written.';
const CODE_TEST_PITFALL = 'Changing the test to make it easier.';

/**
 * Plan safety limits M2.2a (PSL-15 (1)): a test step code wrote (before the weekly tests went), read from its fixed text:
 * the light step, or the measured step. Only stored weeks have one; the base week reads them. Null for the model's own test step and any other step. Stored steps are read the same.
 */
export function codeMadeTestStep(step: Pick<DetailedStep, 'title' | 'focusCue' | 'pitfallToAvoid'>): CodeMadeTest {
  if (step.title === LIGHT_TEST_STEP.title) return 'light';
  return TEST_STEP.test(step.title) && step.focusCue === CODE_TEST_FOCUS && step.pitfallToAvoid === CODE_TEST_PITFALL ? 'measured' : null;
}

/** Middle-out order, so the key sessions land mid-week. */
function byClosenessToMiddle(days: WeekDayPlan[]): WeekDayPlan[] {
  const middle = (days.length - 1) / 2;
  return days
    .map((day, index) => ({ day, distance: Math.abs(index - middle) }))
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.day);
}

/**
 * Code owns the week's shape (which days rest, which day tests, minutes, priorities, key sessions).
 * The model's content is rejected only for what code can't write for it.
 * M2.2a follow-up: a refusal whose every hard reason is a safety breach names the first one's rule (`safetyRule`), for
 * the first-answer fallback in `generateWeekPlan`. `quiet` writes no `[Safety]` line (that fallback's dry run).
 */
export function checkWeekAnswer(
  data: RawWeekAnswer,
  input: WeekCallInput,
  lastAttempt = false,
  options: { quiet?: boolean } = {}
): { value: WeekDayPlan[] } | { reason: string; safetyRule?: SafetyRule } {
  const log = options.quiet !== true;
  const layout = weekLayout(input.planVariant, input.weekStart, input.restWeekdays);
  const rawDays = Array.isArray(data.days) ? (data.days as RawDay[]) : [];
  const soft: string[] = [];
  const days: WeekDayPlan[] = [];
  const recovery = input.recovery ?? null;
  /** RULE-6: hard reasons; they never give way on the last attempt (MR-5, MR-16). */
  const kindFailures: string[] = [];
  // B-89: a profile kind marked highLoad (one the profile call made up, a `tempo_run`) needs a load too.
  const loadGoal = input.loadGoal && { ...input.loadGoal, highLoadKinds: (recovery?.kinds ?? []).filter((kind) => kind.highLoad === true).map((kind) => kind.id) };
  /** Plan safety limits M2.1 (RULE-4): steps PSL-8 names that came without their load; soft, kept on the last attempt. */
  const loadMisses: LoadMiss[] = [];
  /**
   * M2.2a follow-up: the first day-level reason. A goal that is not a load goal returns on it at once, as before; a load
   * goal parses the other days on, so the load checks are told with it (`dayLevelReason`).
   */
  let dayReason: string | null = null;
  /**
   * M2.2a follow-up: the four day-level exits. Not a load goal: the refusal, returned at once. A load goal: the first
   * reason is kept, the day as far as it parsed (`steps`, when given) is kept for the safety checks, and parsing goes on.
   */
  const dayExit = (reason: string, slot: DayLayout, raw: RawDay | null, steps: ParsedStep[] | null): { reason: string } | null => {
    if (!loadGoal) return { reason };
    dayReason ??= reason;
    if (raw && steps) days.push(partialDay(slot, raw, steps, input));
    return null;
  };

  for (const slot of layout) {
    const numbered = rawDays.some((day) => int(day?.dayNumber) !== null);
    const found = numbered ? rawDays.find((day) => int(day?.dayNumber) === slot.dayNumber) : rawDays[slot.dayNumber - 1];
    const raw: RawDay | undefined = found ?? (slot.isRestDay ? { title: 'Rest day', steps: [] } : undefined);
    if (!raw) {
      const stop = dayExit(`Day ${slot.dayNumber} is missing. Return all 7 days.`, slot, null, null);
      if (stop) return stop;
      continue;
    }
    const label = `Day ${slot.dayNumber}`;
    let steps = (Array.isArray(raw.steps) ? (raw.steps as RawStep[]) : [])
      .map((step, index) => toStep(step ?? {}, index + 1, recovery, loadGoal !== undefined))
      // B-39 review: a due date on or before the step's own day is no outside deadline (a miss could never move), so it goes.
      .map(({ dueDate, ...step }) => (dueDate && dueDate > slot.date ? { ...step, dueDate } : step))
      .filter((step) => step.title);
    const work = steps.filter((step) => !BREAK_STEP.test(step.title));
    if (!slot.isRestDay && work.length > 0) steps = work;

    if (slot.isRestDay) {
      const light = keepTopSteps(steps, 1).map((step) =>
        withMinutes(cleanStep(step, false) as ParsedStep, Math.min(REST_STEP_MAX_MINUTES, step.durationMinutes || REST_STEP_MAX_MINUTES))
      );
      // Checked as ranked, so each miss holds the step number the day returns.
      if (loadGoal) loadMisses.push(...stepLoadMisses(slot.dayNumber, rankSteps(light), false, loadGoal, true));
      days.push({
        dayNumber: slot.dayNumber,
        date: slot.date,
        dayOfWeek: slot.dayOfWeek,
        title: light.length ? text(raw.title) || light[0].title : 'Rest day',
        isRestDay: true,
        durationMinutes: light[0]?.durationMinutes ?? 0,
        slotTime: input.slotTime,
        implementationIntention: light.length ? `At ${input.slotTime}: ${light[0].title}.` : 'No practice today.',
        detailedSteps: rankSteps(light),
        isKeySession: false,
        isTestDay: false,
        whyToday: text(raw.whyToday),
        minimumVersion: null,
      });
      continue;
    }

    // No weekly tests (2026-10-30): no step is the week's test, so none is let through as one.
    const hasTest = false;
    if (steps.length === 0 || (steps.length < MIN_STEPS && !lastAttempt)) {
      const stop = dayExit(`${label} is a practice day and needs 2 to 4 steps; got ${steps.length}.`, slot, raw, steps);
      if (stop) return stop;
      continue;
    }
    steps = keepTopSteps(steps, MAX_STEPS);

    if (recovery) {
      for (const step of steps) {
        if (step.kind) continue;
        const wrote = step.badKind ? `kind "${step.badKind}"` : 'no kind';
        kindFailures.push(`${label} step "${step.title}" has ${wrote}; use one of: ${writableKinds(recovery).map((kind) => kind.id).join(', ')}.`);
      }
      steps = steps.map((step) => cleanStep(step) as ParsedStep);
      // RULE-8, MR-25: a warm-up, cool-down or log belongs inside its session's step. Soft: gives way on the last attempt.
      for (const step of steps) {
        if (isSideStepTitle(step.title)) {
          soft.push(`${label} step "${step.title}" is a warm-up, cool-down or log on its own; write it inside the instructions of the step it belongs to.`);
        }
      }
    }

    const title = text(raw.title);
    if (!title) {
      const stop = dayExit(`${label} has no title.`, slot, raw, steps);
      if (stop) return stop;
      continue;
    }
    const whyToday = text(raw.whyToday);
    if (!whyToday) soft.push(`${label} has no "whyToday".`);

    const rawMinimum = raw.minimumVersion;
    let minimumVersion: DetailedStep | null = rawMinimum && text(rawMinimum.title) ? toStep(rawMinimum, 1, null, loadGoal !== undefined) : null;
    const modelMinimum = minimumVersion !== null;
    if (!minimumVersion) {
      soft.push(`${label} has no "minimumVersion".`);
      // Plan safety limits M2.1 (M1.1 section 3): the full step's load is not the 10-minute version's.
      const lead = withoutLoad(rankSteps(steps).find((step) => step.priority === 1)!);
      minimumVersion = { ...lead, stepNumber: 1, title: `Short version: ${lead.title}` };
    }
    const minMinutes = minimumVersion.durationMinutes;
    minimumVersion = withMinutes(minimumVersion, minMinutes > 0 && minMinutes <= MINIMUM_VERSION_MINUTES ? minMinutes : MINIMUM_VERSION_MINUTES);
    delete (minimumVersion as { priority?: number }).priority;

    const minutes = input.dailyMinutes;
    const detailedSteps = fitStepMinutes(rankSteps(steps), minutes);
    if (loadGoal) {
      const misses = stepLoadMisses(slot.dayNumber, detailedSteps, hasTest, loadGoal);
      // The 10-minute version needs a load exactly when the day's priority-1 step does; the fallback is code-made.
      const minimumMissing = modelMinimum ? missingLoad(minimumVersion.load, leadLoadNeed(detailedSteps, hasTest, loadGoal)) : null;
      if (minimumMissing) {
        misses.push({ day: slot.dayNumber, name: `${label} 10-minute version "${minimumVersion.title}"`, stepNumber: null, title: minimumVersion.title, missing: minimumMissing });
      }
      loadMisses.push(...misses);
    }
    // MR-15: the 10-minute version takes the kind of the day's priority-1 step.
    const leadKind = recovery ? detailedSteps.find((step) => step.priority === 1)?.kind : undefined;
    if (recovery) {
      const { kind: _ignored, ...rest } = minimumVersion;
      minimumVersion = leadKind ? { ...rest, kind: leadKind } : rest;
    }

    days.push({
      dayNumber: slot.dayNumber,
      date: slot.date,
      dayOfWeek: slot.dayOfWeek,
      title,
      isRestDay: false,
      durationMinutes: minutes,
      slotTime: input.slotTime,
      implementationIntention: `At ${input.slotTime}: ${title}.`,
      detailedSteps,
      isKeySession: raw.isKeySession === true,
      isTestDay: false,
      whyToday: whyToday || input.focus,
      minimumVersion,
    });
  }

  if (dayReason !== null) return { reason: dayLevelReason(dayReason, days, input, lastAttempt, log) };

  // B-63 (PSL-1): a safety breach is a hard reason too; a second breach fails the week.
  const safetyFailures = safetyBreachList(days, input, lastAttempt, log);
  if (safetyFailures.length > 0 || kindFailures.length > 0) {
    const reason = [...safetyFailures.map((item) => item.reason), ...kindFailures].slice(0, 8).join(' ');
    return kindFailures.length === 0 ? { reason, safetyRule: safetyFailures[0].rule } : { reason };
  }

  const candidates = days.filter((day) => !day.isRestDay);
  const marked = candidates.filter((day) => day.isKeySession);
  const keep = marked.length === 0 ? byClosenessToMiddle(candidates).slice(0, 1) : byClosenessToMiddle(marked).slice(0, 2);
  for (const day of days) day.isKeySession = keep.includes(day);

  const practice = days.filter((day) => !day.isRestDay);
  const seen = new Map<string, number>();
  for (const day of practice) {
    const key = signature(day);
    const earlier = seen.get(key);
    if (earlier !== undefined) soft.push(`Day ${day.dayNumber} has the same steps as day ${earlier}. Make every practice day different.`);
    else seen.set(key, day.dayNumber);
  }

  // M2.1 review: the load misses go first, so the cut to 8 reasons never drops them all.
  soft.unshift(...loadMisses.map((miss) => `${miss.name} needs its load: ${miss.missing}.`));
  const polished = polishDays(days);
  soft.push(...dayQualityFailures(polished));
  if (soft.length > 0 && !lastAttempt) return { reason: soft.slice(0, 8).join(' ') };
  if (lastAttempt && log) logKeptWithoutLoad(loadMisses, polished, input);
  if (loadGoal && log) logRunMinutesOver(polished, input, lastAttempt);
  // RULE-7: with a profile the kinds decide; the goal-level marking is only for goals without one.
  return { value: input.highLoadGoal && !recovery ? polished.map(markHighLoad) : polished };
}

/**
 * M2.2a follow-up: a load goal's answer refused for a day-level reason is still checked against the safety limits on
 * every day that could be parsed, and those reasons go first (the day-level reason always fits in the 8). Each breach
 * is logged once, `retry` (`failed` on the last attempt, which the day-level reason fails); never the light-step swap.
 */
function dayLevelReason(dayReason: string, days: WeekDayPlan[], input: WeekCallInput, lastAttempt: boolean, log: boolean): string {
  const told = safetyBreachList(days, input, false, false);
  if (log) for (const breach of told) logBreach(breach, input, lastAttempt, lastAttempt ? 'failed' : 'retry');
  return [...told.slice(0, 7).map((item) => item.reason), dayReason].join(' ');
}

/** M2.2a follow-up: a practice day refused for a day-level reason, as far as it parsed, only for the safety checks. */
function partialDay(slot: DayLayout, raw: RawDay, steps: ParsedStep[], input: WeekCallInput): WeekDayPlan {
  const rawMinimum = raw.minimumVersion;
  const minimumVersion = rawMinimum && text(rawMinimum.title) ? cleanStep(toStep(rawMinimum, 1, null, input.loadGoal !== undefined)) : null;
  return {
    dayNumber: slot.dayNumber,
    date: slot.date,
    dayOfWeek: slot.dayOfWeek,
    title: text(raw.title),
    isRestDay: false,
    durationMinutes: 0,
    slotTime: input.slotTime,
    implementationIntention: '',
    detailedSteps: rankSteps(steps.map((step) => cleanStep(step) as ParsedStep)),
    isKeySession: false,
    isTestDay: slot.isTestDay,
    whyToday: '',
    minimumVersion,
  };
}

/** One breach of a step, a 10-minute version or the week, as the retry reason and the `[Safety]` line read it. */
interface Breach {
  name: string;
  rule: SafetyRule;
  matched: string;
  reason: string;
  /** PSL-3: a rule the stored test itself breaks, on the test step (or a sentence copied from it): logged, not refused. */
  allowed: boolean;
  testStep: boolean;
  day?: WeekDayPlan;
  step?: DetailedStep;
  value?: number;
  limit?: number;
}

/**
 * B-63: the breaches in the high-load steps (a step of a high-load goal, or any step flagged highLoad), the
 * 10-minute version included, as retry reasons. Each hit is logged once as a `[Safety]` line.
 * Plan safety limits M2.2a (RULE-5, RULE-6): on a load goal, also every step's and 10-minute version's load numbers
 * (`stepLoadBreaches`), and the week's running total, longest run and hard runs (`weekBreaches`). A load breach of a rule
 * the stored test's own text breaks is allowed on the test step (PSL-3), never in a light week; one on the test step
 * counts for M1.5b's light-step swap, and a week breach never lets the swap happen.
 */
export function safetyBreaches(days: WeekDayPlan[], input: WeekCallInput, lastAttempt = false, log = true): string[] {
  return safetyBreachList(days, input, lastAttempt, log).map((item) => item.reason);
}

/** `safetyBreaches` as breaches: the refused ones, step breaches first, then the week's. */
function safetyBreachList(days: WeekDayPlan[], input: WeekCallInput, lastAttempt: boolean, log: boolean): Breach[] {
  const hits: Breach[] = [];
  // M1.5b (WU-41): a first week back of a high-load goal runs a light test, so nothing from the stored test is let through,
  // and every step is scanned, not only the high-load ones.
  // M3.1 (PSL-20): an experienced lifter's weeks 1 to 3 skip the % of 1RM and reps-in-reserve rules.
  const experiencedLifter = liftCapsRelaxed(input);
  const scan = { light: isLightWeek(input), experiencedLifter };
  const profileHighLoad = (input.recovery?.kinds ?? []).some((kind) => kind.highLoad === true);
  // The test step runs the roadmap's test as written (a goal stored before B-63 was never checked): what the test itself
  // says is logged, never refused, or that week could never be written.
  // No weekly tests (2026-10-30): no stored test's own text is let through any more.
  const testText: Array<{ rule: SafetyRule; matched: string }> = [];
  /** On the test step a rule the test itself breaks is allowed; elsewhere only a sentence copied from the test. */
  const fromTest = (rule: SafetyRule, matched: string | null, testStep: boolean) =>
    testText.some((item) => item.rule === rule && (testStep || (matched !== null && (matched.includes(item.matched) || item.matched.includes(matched)))));
  for (const day of days) {
    const steps = [...day.detailedSteps, ...(day.minimumVersion ? [day.minimumVersion] : [])];
    for (const step of steps) {
      const name = step === day.minimumVersion ? `Day ${day.dayNumber} 10-minute version "${step.title}"` : `Day ${day.dayNumber} step "${step.title}"`;
      const testStep = step !== day.minimumVersion && TEST_STEP.test(step.title);
      // B-78: a goal that is high-load only through its profile has its test step scanned too.
      if (scan.light || input.highLoadGoal || step.highLoad === true || (testStep && profileHighLoad)) {
        for (const hit of stepSafetyHits(step, input.weekNumber, scan)) {
          hits.push({
            day,
            step,
            name,
            rule: hit.rule,
            matched: hit.matched,
            reason: `SAFETY: ${name} says "${hit.matched}". The limit is ${SAFETY_LIMIT_TEXT[hit.rule]}; rewrite it within the limit.`,
            testStep,
            allowed: fromTest(hit.rule, hit.matched, testStep),
          });
        }
      }
      if (!input.loadGoal) continue;
      for (const breach of stepLoadBreaches(step.load, input.weekNumber, { experiencedLifter })) {
        hits.push({
          day,
          step,
          name,
          rule: breach.rule,
          matched: breach.matched,
          reason: `SAFETY: ${name}: ${breach.text} Rewrite it within the limit.`,
          testStep,
          // A number is no sentence: only on the test step itself is a rule of the test let through.
          allowed: testStep && fromTest(breach.rule, null, true),
          value: breach.value,
          limit: breach.limit,
        });
      }
    }
  }
  const refused = hits.filter((item) => !item.allowed);
  const week = input.loadGoal ? weekLoadBreaches(days, input) : [];
  if (log) for (const hit of hits) logBreach(hit, input, lastAttempt, hit.allowed ? 'test_text' : lastAttempt ? 'failed' : 'retry');
  if (log) for (const breach of week) logBreach(breach, input, lastAttempt, lastAttempt ? 'failed' : 'retry');
  return [...refused, ...week];
}

function logBreach(breach: Breach, input: WeekCallInput, lastAttempt: boolean, outcome: 'retry' | 'failed' | 'test_text' | 'light_test' | 'light_retest'): void {
  safetyLog(input, {
    goalId: input.goalId ?? null,
    week: input.weekNumber,
    attempt: lastAttempt ? 2 : 1,
    rule: breach.rule,
    step: breach.name,
    matched: breach.matched,
    ...(breach.value !== undefined ? { value: breach.value, limit: breach.limit } : {}),
    outcome,
  });
}

/**
 * M2.2a (PSL-15 (1), (4)): the runs of the days as checked, rest days included; the 10-minute versions are not added.
 * The test day's test step is the model's, or code-made (`codeMadeTestStep`).
 */
function weekRuns(days: WeekDayPlan[], running: boolean, measured: boolean): Run[] {
  return days.flatMap((day) =>
    day.detailedSteps.flatMap((step) => {
      // M3.3a (WU-55): a re-test step counts as the code-made test step of its kind.
      const run = runOf(step, `Day ${day.dayNumber} step "${step.title}"`, { running, ...testStepOf(step, day.isTestDay, codeMadeTestStep), measured });
      return run ? [run] : [];
    })
  );
}

/** RULE-5: the running total against the base week, the longest run and the hard runs, as breaches of the week. */
function weekLoadBreaches(days: WeekDayPlan[], input: WeekCallInput): Breach[] {
  // M2.2a review: a measured test is hard; a light week's (a high-load first week back) is not. Only stored weeks hold one.
  const measured = !isLightWeek(input);
  const week = weekRunning(weekRuns(days, input.loadGoal?.running === true, measured));
  return weekBreaches(week, input.baseWeek, input.loadGoal?.runLevel).map((breach: LoadBreach & { run?: Run }) => ({
    name: breach.run ? breach.run.name : 'This week',
    rule: breach.rule,
    matched: breach.matched,
    reason: breach.run ? `SAFETY: ${breach.run.name}: ${breach.text} Rewrite the week within the limit.` : `SAFETY: ${breach.text} Rewrite the week within the limit.`,
    allowed: false,
    testStep: false,
    value: breach.value,
    limit: breach.limit,
  }));
}

/**
 * M2.2a (PSL-15 (2)): a step whose `runMinutes` is above its minutes is counted as written; one line per step, on the
 * accepted answer only.
 */
function logRunMinutesOver(days: WeekDayPlan[], input: WeekCallInput, lastAttempt: boolean): void {
  for (const day of days) {
    for (const step of day.detailedSteps) {
      const runMinutes = step.load?.runMinutes;
      if (runMinutes === undefined || runMinutes <= step.durationMinutes) continue;
      safetyLog(input, {
        goalId: input.goalId ?? null,
        week: input.weekNumber,
        attempt: lastAttempt ? 2 : 1,
        rule: 'run_minutes_over_step',
        step: `Day ${day.dayNumber} step "${step.title}"`,
        matched: `runMinutes ${runMinutes} in a ${step.durationMinutes}-minute step`,
        value: runMinutes,
        limit: step.durationMinutes,
        outcome: 'counted',
      });
    }
  }
}

/**
 * Plan safety limits M2.1: one step that needed its load and came without it. `stepNumber` is its place in the day as
 * returned (`rankSteps` sets it; nothing after changes it), null for the 10-minute version; `title` as checked.
 */
/** B-90: words that name running in a rest-day step. "Walk" is not running. */
const RUNNING_WORDS = /\b(?:run|runs|running|jog|jogs|jogging|stride|strides)\b/i;

interface LoadMiss {
  day: number;
  name: string;
  stepNumber: number | null;
  title: string;
  missing: string;
}

/**
 * RULE-4, PSL-8: the steps of one day (ranked, as returned) that need a load and lack it, plus any step whose load
 * names running without `hardRun`. `hasTest`: the model wrote the day's test step.
 */
function stepLoadMisses(day: number, steps: DetailedStep[], hasTest: boolean, loadGoal: LoadGoal, restDay = false): LoadMiss[] {
  return steps.flatMap((step) => {
    // B-90: a rest-day step has lost its kind (MR-15), so on a running goal one that names running is asked for a run load.
    const restRun = restDay && loadGoal.running && RUNNING_WORDS.test(`${step.title} ${step.instructions ?? ''}`);
    const missing = missingLoad(step.load, restRun ? 'run' : loadNeed(step, hasTest && TEST_STEP.test(step.title), loadGoal));
    return missing ? [{ day, name: `Day ${day} step "${step.title}"`, stepNumber: step.stepNumber, title: step.title, missing }] : [];
  });
}

function leadLoadNeed(steps: DetailedStep[], hasTest: boolean, loadGoal: LoadGoal) {
  const lead = steps.find((step) => step.priority === 1);
  return lead ? loadNeed(lead, hasTest && TEST_STEP.test(lead.title), loadGoal) : null;
}

/**
 * RULE-4, AC-4: on the last attempt a step without its load is kept, and B-63's scan has already decided. One
 * `[Safety]` line per kept step, found by its place in the day (`polishDays` changes no step's number or title). A test
 * step the light swap replaced keeps its place but has the light step's title: it is code-made now, so not logged.
 */
function logKeptWithoutLoad(misses: LoadMiss[], days: WeekDayPlan[], input: WeekCallInput): void {
  for (const miss of misses) {
    const day = days.find((item) => item.dayNumber === miss.day);
    const kept = miss.stepNumber === null ? day?.minimumVersion : day?.detailedSteps.find((step) => step.stepNumber === miss.stepNumber);
    if (!kept || kept.title !== miss.title) continue;
    safetyLog(input, {
      goalId: input.goalId ?? null,
      week: input.weekNumber,
      attempt: 2,
      rule: 'load_missing',
      step: miss.name,
      matched: miss.missing,
      outcome: 'kept',
    });
  }
}

/** M1.5b (WU-41): a first week back of a high-load goal: its test is a light version, and the week is scanned as light. */
function isLightWeek(input: Pick<WeekCallInput, 'firstWeekBack'>): boolean {
  return input.firstWeekBack?.highLoad === true;
}

/** ND-5: on a physical preset goal every practice step and the 10-minute version are high-load, whatever the model said. */
function markHighLoad(day: WeekDayPlan): WeekDayPlan {
  if (day.isRestDay) return day;
  return {
    ...day,
    detailedSteps: day.detailedSteps.map((step) => ({ ...step, highLoad: true })),
    minimumVersion: day.minimumVersion ? { ...day.minimumVersion, highLoad: true } : null,
  };
}

/** Prompt 3: one week of days that move the person toward this week's target. Null when both attempts fail. */
/** B-91: a `[Safety]` line, logged now or held for the caller. */
function safetyLog(input: Pick<WeekCallInput, 'heldSafetyLines'>, line: SafetyLogLine): void {
  if (input.heldSafetyLines) input.heldSafetyLines.push(line);
  else logSafetyHit(line);
}

export async function generateWeekPlan(input: WeekCallInput): Promise<WeekDayPlan[] | null> {
  const layout = weekLayout(input.planVariant, input.weekStart, input.restWeekdays);
  // M2.2a (PSL-15 (1)): a base week whose running isn't known is no base; said once per week call.
  // M2.2a review: only where running is expected, or a run step of the base week had no load.
  if (input.loadGoal && input.baseWeek && !input.baseWeek.known && (input.loadGoal.running || input.baseWeek.runWithoutLoad)) {
    safetyLog(input, { goalId: input.goalId ?? null, week: input.weekNumber, rule: 'no_base', step: 'This week', matched: 'last week running not known', outcome: 'logged' });
  }
  // M2.2b (RULE-10): a first week back's base, once per week call.
  const back = input.loadGoal ? input.baseWeek : undefined;
  if (back?.firstWeekBack) {
    safetyLog(input, { goalId: input.goalId ?? null, week: input.weekNumber, rule: 'first_week_back_base', step: 'This week', ...firstWeekBackSummary({ ...back, firstWeekBack: back.firstWeekBack }), outcome: 'logged' });
  }
  // M2.2a follow-up: attempt 1's answer, for the first-answer fallback.
  let first: RawWeekAnswer | null = null;
  return generateWithOneRetry<RawWeekAnswer, WeekDayPlan[]>(
    buildWeekPrompt(input, layout),
    weekSystem(input.totalWeeks),
    weekResponseSchema(input.recovery, input.loadGoal),
    (data, lastAttempt) => {
      if (!lastAttempt) {
        first = data;
        return checkWeekAnswer(data, input, false);
      }
      const verdict = checkWeekAnswer(data, input, true);
      if ('value' in verdict || !verdict.safetyRule || !first) return verdict;
      return firstAnswer(first, input, verdict.safetyRule) ?? verdict;
    },
    `Week ${input.weekNumber}`
  );
}

/**
 * M2.2a follow-up (RULE-6): the last answer was refused only for safety breaches. Attempt 1's answer is checked again
 * as a last attempt (a one-step day kept, a missing test step added); when it passes every check, safety included, it
 * is the week, with one `[Safety]` line naming the last answer's breach. A dry run first, so an answer that fails again
 * logs nothing twice. No model call; nothing unsafe is ever returned.
 */
function firstAnswer(data: RawWeekAnswer, input: WeekCallInput, rule: SafetyRule): { value: WeekDayPlan[] } | null {
  if (!('value' in checkWeekAnswer(data, input, true, { quiet: true }))) return null;
  const kept = checkWeekAnswer(data, input, true);
  if (!('value' in kept)) return null;
  safetyLog(input, {
    goalId: input.goalId ?? null,
    week: input.weekNumber,
    attempt: 2,
    rule,
    step: 'This week',
    matched: 'the last answer broke a limit; the first answer, checked again, is within every limit',
    outcome: 'first_answer',
  });
  return kept;
}
