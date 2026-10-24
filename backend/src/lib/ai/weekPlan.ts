import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';
import { generateWithOneRetry } from './retry.js';
import { WEEKLY_TEST_KIND, type RecoveryProfile } from '../recovery/profile.js';
import { fitStepMinutes } from './scheduleRepair.js';
import { codeMadeRetestStep, easyRetestStep, retestDayOf, retestStepFor, type Retest } from './retestStep.js';
import { dayQualityFailures, polishDays } from './taskRules.js';
import { EARLY_WEEKS, SAFETY_LIMIT_TEXT, logSafetyHit, stepSafetyHits, textSafetyHits, type SafetyRule } from './safetyScan.js';
import type { FirstWeekBack } from '../weekClose/breaks.js';
import { dayNinetyPromptLine, type DayNinetyLine } from './dayNinety.js';
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
  runOf,
  runningLimit,
  runningLimitMinutes,
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
import {
  formatAnswerLines,
  formatTarget,
  nextCheckWeek,
  type ChosenMethod,
  type PlanAnswer,
  type RoadmapPhase,
  type WeekTarget,
  type WeekTest,
} from './roadmap.js';

export type PlanVariant = 'steady' | 'accelerated' | 'minimal';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MIN_STEPS = 2;
const MAX_STEPS = 4;
const MINIMUM_VERSION_MINUTES = 10;
const REST_STEP_MAX_MINUTES = 15;

export function activeDaysFor(variant: PlanVariant): number {
  return variant === 'minimal' ? 4 : variant === 'accelerated' ? 6 : 5;
}

/** 0-based days of the week that are rest days. Never two in a row. */
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
export function weekLayout(variant: PlanVariant, weekStart: Date): DayLayout[] {
  const rest = restDayIndices(variant);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      dayNumber: index + 1,
      date: date.toISOString().split('T')[0],
      dayOfWeek: DAY_NAMES[date.getUTCDay()],
      isRestDay: rest.includes(index),
      isTestDay: false,
    };
  });
  const lastPractice = [...days].reverse().find((day) => !day.isRestDay);
  if (lastPractice) lastPractice.isTestDay = true;
  return days;
}

export interface WeekDayPlan extends DailyTaskPlan {
  date: string;
  isKeySession: boolean;
  isTestDay: boolean;
  whyToday: string;
  /** The 10-minute step for days the full session won't happen. Null on rest days. */
  minimumVersion: DetailedStep | null;
}

export interface LastWeekSummary {
  target: WeekTarget;
  /** M2.1 (WU-43 (2)): last week's test was a light test, so its result is not a result against the target. */
  lightTest?: boolean;
  result: string;
  done: number;
  planned: number;
  keySessionsSkipped: string[];
  /** Prompt 4's guidance for next week (phase 4). */
  note?: string;
}

export interface WeekCallInput {
  finalGoal: string;
  /** Checkpoints (RULE-12): only while the goal response sends `dayNinetyLine`; without it the prompt is exactly as before. */
  dayNinety?: DayNinetyLine;
  answers: PlanAnswer[];
  dailyMinutes: number;
  planVariant: PlanVariant;
  slotTime: string;
  method: Pick<ChosenMethod, 'name' | 'creator' | 'rules'>;
  weekNumber: number;
  totalWeeks: number;
  phase: Pick<RoadmapPhase, 'name' | 'purpose'>;
  focus: string;
  target: WeekTarget;
  test: WeekTest;
  weekStart: Date;
  lastWeek?: LastWeekSummary;
  /**
   * Weekly update M3.3a (RULE-5, RULE-6, WU-55, WU-56): the closing week's test to re-test. Code puts the re-test step
   * first on the first offered practice day before the test day (`retestDayOf`); none when there is no such day.
   * Without it the call is exactly as before.
   */
  retest?: Retest;
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
   * on. Told, never checked; never a target or a restart level. Without it the prompt is exactly as before.
   * M1.5b (WU-41): with `highLoad`, the week's test is a light version, and the week is scanned as a light week
   * (`ScanOptions.light`): the weeks 1 to 3 rules and the time-trial rule, a sentence copied from the stored test refused.
   */
  firstWeekBack?: Pick<FirstWeekBack, 'awayDays' | 'note' | 'highLoad'>;
  /**
   * Weekly update M2.1 (WU-43 (5)): in a light week (`test.light`), the session the pathway's light test belongs to
   * ("the long run"), which goes on the test day. Told, never checked.
   */
  testSession?: string;
  /** B-63: only for the `[Safety]` log line; logged as null when not given. */
  goalId?: string;
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

export const WEEK_SYSTEM = `You write one week of daily practice for a person following a 90-day plan. The goal, the method and this week's
target are already decided. Do not change them. Every day must move the person toward this week's target.
Respond with one JSON object that matches the schema.`;

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
              properties: { ...stepProperties, priority: { type: 'integer' }, timing: { type: 'string' }, highLoad: { type: 'boolean' } },
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
    stepItems.properties.kind = { type: 'string', enum: recovery.kinds.map((kind) => kind.id) };
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
    .map((day) => `- Day ${day.dayNumber} (${day.dayOfWeek}): ${day.isRestDay ? 'rest' : day.isTestDay ? 'practice, TEST DAY' : 'practice'}`)
    .join('\n');
}

function lastWeekBlock(input: WeekCallInput): string {
  if (!input.lastWeek) return '';
  const last = input.lastWeek;
  const lines = [
    '',
    'LAST WEEK',
    last.lightTest
      ? `Next check: ${formatTarget(last.target)}. Light test (not a check of the target): ${last.result}. Sessions done: ${last.done} of ${last.planned}.`
      : `Target: ${formatTarget(last.target)}. Result: ${last.result}. Sessions done: ${last.done} of ${last.planned}.`,
    `Key sessions skipped: ${last.keySessionsSkipped.length ? last.keySessionsSkipped.join('; ') : 'none'}.`,
  ];
  if (last.note) lines.push(`Coach's note: ${last.note}`);
  return lines.join('\n');
}

const NL = '\n';

const HIGH_LOAD_LINE =
  '  - highLoad: true when the step puts real physical strain on the body (running, lifting, high-intensity or impact work); otherwise false';

/**
 * RULE-6, RULE-8, MR-20: the kinds as the week writer sees them: id, name and description, never the action. Steps
 * of a move kind carry their own warm-up; work that only makes sense together is one step.
 */
const orList = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}` : items[0] ?? '');

function kindsBlock(recovery: RecoveryProfile): string {
  const lines = recovery.kinds.map((kind) => `- ${kind.id}: ${kind.name}. ${kind.description}`);
  const standalone = recovery.kinds.filter((kind) => kind.action === 'move' && kind.id !== WEEKLY_TEST_KIND.id).map((kind) => kind.id);
  const rules = [
    standalone.length
      ? `- A step whose kind is ${orList(standalone)} starts with its own short warm-up (5 minutes or less) inside its instructions, so it can be done on another day on its own.`
      : '',
    '- Work that only makes sense together, such as a game and its review, is written as one step.',
    "- A warm-up, cool-down or log of a session is written inside that session's step (in its instructions), never as a step of its own. The test day keeps its short warm-up and result steps as described above.",
    `- Every step on the test day, including its warm-up and the step after the test, has kind ${WEEKLY_TEST_KIND.id}. Use fixed_time_session only for something set for a time by others, such as a class, a group run or a call.`,
  ].filter(Boolean);
  return ['', '', 'KINDS OF STEP (every practice-day step has exactly one "kind": one of these ids, written exactly)', ...lines, ...rules].join(NL);
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
    ...runningLines(input.baseWeek),
    `- At most ${HARD_RUNS_MAX} hard runs this week (intervals, tempo, race pace; a hard weekly test counts as one).`,
    `- Calorie deficit: ${CALORIE_DEFICIT_MIN} to ${CALORIE_DEFICIT_MAX} kcal a day, never more.`,
    `- Daily intake: never below ${DAILY_INTAKE_MIN_KCAL} kcal a day.`,
  ];
  if (input.weekNumber <= EARLY_WEEKS) {
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
export function runningLines(base: BaseWeek | undefined): string[] {
  const longest = `- Longest run: at most ${LONGEST_RUN_MAX_PERCENT}% of the week's running when there are ${LONGEST_RUN_MIN_RUNS} or more runs.`;
  const cap = `${LONGEST_RUN_NO_BASE_MAX_MINUTES} minutes (${LONGEST_RUN_NO_BASE_MAX_KM} km when every run is given in km)`;
  const zeroLines = ['- Running: last week had no running; keep it at their level.', longest, `- No run longer than ${cap}.`];
  if (!base?.known) {
    // M2.2b review: held like a 0-run base, told as not known.
    if (base?.firstWeekBack) return ["- Running: last week's running isn't known; keep it at their level.", ...zeroLines.slice(1)];
    return ['- Running: there is no last week to count from; keep it at their level.', longest, `- With fewer than ${LONGEST_RUN_MIN_RUNS} runs, no run longer than ${cap}.`];
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

/**
 * Plan safety limits M2.1 (RULE-4, PSL-8): the step-fields line on a load goal, worded from `loadNeed`. The weekly
 * test step is named only on a running goal.
 */
export function loadLine(loadGoal: LoadGoal): string {
  const which = loadGoal.running
    ? 'a running step, a cardio step, a lifting step, the weekly test step and any step with highLoad true'
    : 'a running step, a cardio step, a lifting step and any step with highLoad true';
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

/**
 * M1.5a (WU-25 (3), WU-29 (1)): the days away and the return rule's note; for a high-load goal, the "at or below" line.
 * Nothing about a target or a restart level (M3.4).
 */
export function firstWeekBackBlock(input: Pick<WeekCallInput, 'firstWeekBack'>): string {
  const back = input.firstWeekBack;
  if (!back) return '';
  const heading = back.highLoad ? 'FIRST WEEK BACK (after a break; only the light test is checked)' : 'FIRST WEEK BACK (after a break; nothing here is checked)';
  const lines = ['', '', heading, `- They have been away ${back.awayDays} days. This is their first week back.`];
  if (back.note) lines.push(`- For the first week back, the method says: ${back.note}`);
  if (back.highLoad) {
    lines.push(
      '- Keep every session at or below what they last completed.',
      // M1.5b (WU-41): the stored test and target stay; only how this week runs the test is lighter.
      `- This week's weekly test is a light version of the test above: no time trial or all-out effort, no max or 1RM test, nothing to failure, no lift above ${EARLY_WEEK_MAX_1RM_PERCENT}% of 1RM, at least ${EARLY_WEEK_MIN_RIR} reps in reserve. A week that breaks this is not saved.`
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
 * M2.1 (WU-43 (1), (5)): a light week names the next check's target as something to build toward, not to test; any
 * other week (every goal created before M2.1 included) reads exactly as before.
 */
function thisWeekTestLines(input: WeekCallInput): string {
  if (!input.test.light) {
    return `Target: ${formatTarget(input.target)}${NL}Weekly test: ${input.test.instructions.trim().replace(/\.+$/, '')}. Pass if: ${input.test.passIf}`;
  }
  return [
    `Next check (week ${nextCheckWeek(input.weekNumber)}): ${formatTarget(input.target)}. Build toward it; it is not tested this week.`,
    `Weekly test (the light test, done as written; no number against the target): ${input.test.instructions}`,
  ].join(NL);
}

/** M3.3a (WU-56): the half of the day the re-test takes, as `testStepFor`'s step takes half of the test day. */
const retestMinutes = (dailyMinutes: number) => Math.round(dailyMinutes / 2);

/** M3.3a: the re-test day, told in WRITE THE WEEK; code adds the step after the answer. Empty without one. */
function retestLine(input: WeekCallInput, layout: DayLayout[]): string {
  const dayNumber = input.retest ? retestDayOf(layout, input.retest.notOfferedBefore) : null;
  const day = layout.find((item) => item.dayNumber === dayNumber);
  if (!input.retest || !day) return '';
  const half = retestMinutes(input.dailyMinutes);
  if (input.retest.easy) {
    // M3.4 (WU-59 (4)): after weeks off on a high-load goal, an easy version only; no time trial.
    return `${NL}- Day ${day.dayNumber} (${day.dayOfWeek}) starts with an easy version of week ${input.retest.ofWeek}'s test (an easy, comfortable effort,
  never all-out), which code adds as its first step (${half} minutes). Plan the rest of that day around it, shorter: steps
  adding up to ${input.dailyMinutes - half} minutes, and none that repeats the test.`;
  }
  const hard = input.loadGoal?.running ? ' The re-test counts as a hard run.' : '';
  return `${NL}- Day ${day.dayNumber} (${day.dayOfWeek}) starts with a re-test of week ${input.retest.ofWeek}'s test (${input.retest.test.instructions}), which
  code adds as its first step (${half} minutes). Plan the rest of that day around it, shorter: steps adding up to
  ${input.dailyMinutes - half} minutes, and none that repeats the test.${hard}`;
}

function buildBaseWeekPrompt(input: WeekCallInput, layout: DayLayout[]): string {
  const method = input.method.creator ? `${input.method.name} by ${input.method.creator}` : input.method.name;
  const activeNames = layout.filter((day) => !day.isRestDay).map((day) => day.dayOfWeek).join(', ');
  return `THE PERSON
Goal: ${input.finalGoal}${input.dayNinety ? NL + dayNinetyPromptLine(input.dayNinety) : ''}
Their answers:
${formatAnswerLines(input.answers)}
Time: ${input.dailyMinutes} minutes a day on ${activeNames}

THE METHOD
${method}
Rules (follow every one):
${input.method.rules.map((rule) => `- ${rule}`).join('\n')}

THIS WEEK
Week ${input.weekNumber} of ${input.totalWeeks}, phase "${input.phase.name}": ${input.phase.purpose}
Focus: ${input.focus}
${thisWeekTestLines(input)}
${lastWeekBlock(input)}

THE DAYS (already decided; keep them)
${dayLines(layout)}

WRITE THE WEEK
- 7 days, dayNumber 1-7, exactly as listed above.
- The test day's main step is ${input.firstWeekBack?.highLoad ? 'a light version of the weekly test above (see FIRST WEEK BACK)' : 'the weekly test exactly as written above'}, titled "Weekly test: ...", with a
  short warm-up before it (5 minutes or less) and a short step after it (5 minutes or less) that ${
    input.test.light ? 'notes how it went; it does not compare anything with the target' : `compares the${NL}  result with the target`
  }. The test day may be shorter than ${input.dailyMinutes} minutes; do not pad it.${
    input.test.light && input.testSession ? `${NL}- The light test belongs to ${input.testSession}: the test day is that session, with the test as its main step.` : ''
  }${retestLine(input, layout)}
- Mark 1-2 practice days (not the test day) as key sessions ("isKeySession": true): the hardest sessions that
  matter most for the target. Put them mid-week.
- Each practice day has:
  - title: what they get done, e.g. "Hold a 3-minute conversation about your weekend", not "Speaking practice"
  - whyToday: one sentence on how this day moves them toward the target
  - 2-4 steps that each do something different, with minutes adding up to ${input.dailyMinutes}
  - minimumVersion: one 10-minute step for days they can't do the full session. It must still move them
    toward the target.
- Each step has:
  - title and instructions: specific enough to start without looking anything up
  - minutes
  - output: what they end up with
  - doneWhen: the check that it's good enough
  - focusCue and pitfall
  - priority: 1 = most important today, no ties
  - timing (optional): only when the step can't follow the previous one straight away
  - highLoad: true when the step puts real physical strain on the body (running, lifting, high-intensity or impact work); otherwise false
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
 * its id. Null when it matches neither.
 */
export function resolveKind(value: unknown, recovery: RecoveryProfile): string | null {
  const written = text(value);
  if (!written) return null;
  const byId = recovery.kinds.find((kind) => kind.id === written);
  if (byId) return byId.id;
  const byName = recovery.kinds.find((kind) => kind.name.toLowerCase() === written.toLowerCase());
  return byName ? byName.id : null;
}

function toStep(raw: RawStep, stepNumber: number, recovery?: RecoveryProfile | null, withLoad = false): ParsedStep {
  const timing = text(raw.timing);
  const kind = recovery ? resolveKind(raw.kind, recovery) : null;
  // Plan safety limits M2.1: read only on a load goal, so any other goal's steps are exactly as before.
  const load = withLoad ? parseStepLoad(raw.load) : undefined;
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
  };
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

/** M3.3a: the re-test (first) keeps half the day; the other steps fit into the rest. */
function withRetestMinutes(steps: DetailedStep[], dailyMinutes: number): DetailedStep[] {
  const [retest, ...others] = steps;
  const rest = Math.max(0, dailyMinutes - retest.durationMinutes);
  return [retest, ...(rest > 0 ? fitStepMinutes(others, rest) : others)];
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

function lightTestStep(minutes: number): DetailedStep & { priority: number } {
  return {
    stepNumber: 0,
    title: LIGHT_TEST_STEP.title,
    durationMinutes: minutes,
    instructions: LIGHT_TEST_STEP.instructions,
    focusCue: 'Easy and comfortable all the way through.',
    pitfallToAvoid: 'Turning it into a hard effort.',
    passMark: LIGHT_TEST_STEP.passMark,
    output: 'What you did and how it felt.',
    priority: 0,
    highLoad: false,
  };
}

/**
 * Plan safety limits M2.2a: `codeMadeTestStep` recognises the code-made test step, stored ones included, by this exact
 * text (the base week reads stored weeks). Never change it, or stored test steps stop being recognised.
 */
const CODE_TEST_FOCUS = 'Your honest best, done exactly as written.';
const CODE_TEST_PITFALL = 'Changing the test to make it easier.';

function testStepFor(test: WeekTest, minutes: number, light = false): DetailedStep & { priority: number } {
  if (light) return lightTestStep(minutes);
  return {
    stepNumber: 0,
    title: `Weekly test: ${test.instructions.split(/[.;]/)[0].slice(0, 80)}`,
    durationMinutes: minutes,
    instructions: test.instructions,
    focusCue: CODE_TEST_FOCUS,
    pitfallToAvoid: CODE_TEST_PITFALL,
    passMark: test.passIf,
    output: 'Your test result.',
    priority: 0,
    highLoad: false,
  };
}

/**
 * Plan safety limits M2.2a (PSL-15 (1)): a test step code wrote, read from its fixed text: the light step, or
 * `testStepFor`'s measured step. Null for the model's own test step and any other step. Stored steps are read the same.
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
  const layout = weekLayout(input.planVariant, input.weekStart);
  const rawDays = Array.isArray(data.days) ? (data.days as RawDay[]) : [];
  const soft: string[] = [];
  const days: WeekDayPlan[] = [];
  const recovery = input.recovery ?? null;
  /** RULE-6: hard reasons; they never give way on the last attempt (MR-5, MR-16). */
  const kindFailures: string[] = [];
  const loadGoal = input.loadGoal;
  const retestDay = input.retest ? retestDayOf(layout, input.retest.notOfferedBefore) : null;
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
      .filter((step) => step.title);
    const work = steps.filter((step) => !BREAK_STEP.test(step.title));
    if (!slot.isRestDay && work.length > 0) steps = work;

    if (slot.isRestDay) {
      const light = keepTopSteps(steps, 1).map((step) =>
        withMinutes(cleanStep(step, false) as ParsedStep, Math.min(REST_STEP_MAX_MINUTES, step.durationMinutes || REST_STEP_MAX_MINUTES))
      );
      // Checked as ranked, so each miss holds the step number the day returns.
      if (loadGoal) loadMisses.push(...stepLoadMisses(slot.dayNumber, rankSteps(light), false, loadGoal));
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

    // PSL-11 Q9: only the model's own test step carries a load; a code-made one (`testStepFor`) never needs one.
    const hasTest = slot.isTestDay && steps.some((step) => TEST_STEP.test(step.title));
    if (slot.isTestDay) {
      if (!hasTest && !lastAttempt) {
        const stop = dayExit(`${label} is the test day; its main step must be titled "Weekly test: ..." and run the weekly test as written.`, slot, raw, steps);
        if (stop) return stop;
        continue;
      }
      if (!hasTest) steps = [testStepFor(input.test, Math.round(input.dailyMinutes / 2), isLightWeek(input)), ...keepTopSteps(steps, MAX_STEPS - 1)];
      // RULE-7: the test step is always Weekly test, whatever the model tagged; with a profile, so is every other step
      // on the test day, such as its warm-up and its review (MR-25). Without a profile, only the test step changes.
      steps = steps.map((step) => {
        const tagged = recovery ? { ...(cleanStep(step) as ParsedStep), kind: WEEKLY_TEST_KIND.id } : step;
        // M1.5b: the fixed light step keeps its own pass mark.
        const passMark = step.title === LIGHT_TEST_STEP.title && isLightWeek(input) ? LIGHT_TEST_STEP.passMark : input.test.passIf;
        return TEST_STEP.test(step.title) ? { ...tagged, priority: 0, passMark } : tagged;
      });
    }
    // M3.3a (WU-56): the re-test goes first on its day, the day's other steps trimmed as the test day's are. It ranks right
    // after the day's own lead (priority 2), so the day's priority-1 step, its 10-minute version and what a missed day
    // carries stay the model's (M3.3a review). Tagged as the test step is, so the carry planner and the handoff treat it
    // as fixed.
    const retestHere = input.retest !== undefined && slot.dayNumber === retestDay;
    if (retestHere) {
      const own = keepTopSteps(steps, MAX_STEPS - 1);
      const lead = own.length ? Math.min(...own.map((step) => step.priority)) : -1;
      // M3.4 (WU-59 (4)): a high-load first week back gets the easy re-test from the start, which stores nothing.
      const minutes = retestMinutes(input.dailyMinutes);
      const retest = { ...(input.retest!.easy ? easyRetestStep(minutes) : retestStepFor(input.retest!.test, minutes)), priority: lead + 0.5 };
      steps = [recovery ? { ...retest, kind: WEEKLY_TEST_KIND.id } : retest, ...own];
    }

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
        kindFailures.push(`${label} step "${step.title}" has ${wrote}; use one of: ${recovery.kinds.map((kind) => kind.id).join(', ')}.`);
      }
      steps = steps.map((step) => cleanStep(step) as ParsedStep);
      // RULE-8, MR-25: a warm-up, cool-down or log belongs inside its session's step. Soft: gives way on the last attempt.
      if (!slot.isTestDay) {
        for (const step of steps) {
          if (isSideStepTitle(step.title) && !codeMadeRetestStep(step)) {
            soft.push(`${label} step "${step.title}" is a warm-up, cool-down or log on its own; write it inside the instructions of the step it belongs to.`);
          }
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

    const written = steps.reduce((sum, step) => sum + step.durationMinutes, 0);
    const minutes = slot.isTestDay && written > 0 && written < input.dailyMinutes ? written : input.dailyMinutes;
    const detailedSteps = retestHere ? withRetestMinutes(rankSteps(steps), input.dailyMinutes) : fitStepMinutes(rankSteps(steps), minutes);
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
      isKeySession: raw.isKeySession === true && !slot.isTestDay,
      isTestDay: slot.isTestDay,
      whyToday: whyToday || input.focus,
      minimumVersion,
    });
  }

  if (dayReason !== null) return { reason: dayLevelReason(dayReason, days, input, lastAttempt, log) };

  // B-63 (PSL-1): a safety breach is a hard reason too; a second breach fails the week. M1.5b (WU-41): in a light week a
  // last attempt refused only on its test step gets the fixed light step instead.
  const safetyFailures = safetyBreachList(days, input, lastAttempt, log);
  if (safetyFailures.length > 0 || kindFailures.length > 0) {
    const reason = [...safetyFailures.map((item) => item.reason), ...kindFailures].slice(0, 8).join(' ');
    return kindFailures.length === 0 ? { reason, safetyRule: safetyFailures[0].rule } : { reason };
  }

  const candidates = days.filter((day) => !day.isRestDay && !day.isTestDay);
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
  /** M3.3a: on the re-test step; counts for the easy re-test swap. */
  retestStep?: boolean;
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
  const scan = { light: isLightWeek(input) };
  // The test step runs the roadmap's test as written (a goal stored before B-63 was never checked): what the test itself
  // says is logged, never refused, or that week could never be written.
  const testText = scan.light ? [] : textSafetyHits([input.test.instructions, input.test.passIf].join(NL), input.weekNumber);
  /** On the test step a rule the test itself breaks is allowed; elsewhere only a sentence copied from the test. */
  const fromTest = (rule: SafetyRule, matched: string | null, testStep: boolean) =>
    testText.some((item) => item.rule === rule && (testStep || (matched !== null && (matched.includes(item.matched) || item.matched.includes(matched)))));
  // M3.3a (WU-55): the re-test step runs the re-tested week's stored test, read as the test step reads its own.
  const retestText = scan.light || !input.retest ? [] : textSafetyHits([input.retest.test.instructions, input.retest.test.passIf].join(NL), input.weekNumber);
  for (const day of days) {
    const steps = [...day.detailedSteps, ...(day.minimumVersion ? [day.minimumVersion] : [])];
    for (const step of steps) {
      const name = step === day.minimumVersion ? `Day ${day.dayNumber} 10-minute version "${step.title}"` : `Day ${day.dayNumber} step "${step.title}"`;
      const testStep = step !== day.minimumVersion && TEST_STEP.test(step.title);
      const retestStep = step !== day.minimumVersion && codeMadeRetestStep(step) !== null;
      if (scan.light || input.highLoadGoal || step.highLoad === true) {
        for (const hit of stepSafetyHits(step, input.weekNumber, scan)) {
          hits.push({
            day,
            step,
            name,
            rule: hit.rule,
            matched: hit.matched,
            reason: `SAFETY: ${name} says "${hit.matched}". The limit is ${SAFETY_LIMIT_TEXT[hit.rule]}; rewrite it within the limit.`,
            testStep,
            retestStep,
            allowed: retestStep ? retestText.some((item) => item.rule === hit.rule) : fromTest(hit.rule, hit.matched, testStep),
          });
        }
      }
      if (!input.loadGoal) continue;
      for (const breach of stepLoadBreaches(step.load, input.weekNumber)) {
        hits.push({
          day,
          step,
          name,
          rule: breach.rule,
          matched: breach.matched,
          reason: `SAFETY: ${name}: ${breach.text} Rewrite it within the limit.`,
          testStep,
          retestStep,
          // A number is no sentence: only on the test step itself is a rule of the test let through.
          allowed: testStep && fromTest(breach.rule, null, true),
          value: breach.value,
          limit: breach.limit,
        });
      }
    }
  }
  const refused = hits.filter((item) => !item.allowed);
  let week = input.loadGoal ? weekLoadBreaches(days, input) : [];
  // M1.5b (WU-41): the last attempt of a light week refused only on test steps keeps the week, with the fixed light step.
  // M2.2a review: decided after counting the swapped week again (the light step's minutes are running too); only a
  // swapped week that passes is kept, otherwise the week fails.
  const candidate = lastAttempt && scan.light && refused.length > 0 && refused.every((item) => item.testStep) && week.length === 0;
  // M3.3a (WU-55): likewise a last attempt refused only on the re-test step (or with the test step under M1.5b's rule), or
  // for a week limit with a re-test in the week (its hard run), swaps in the easy re-test; kept only when the swapped
  // week passes the week checks again.
  const hasRetest = days.some((day) => day.detailedSteps.some((step) => codeMadeRetestStep(step) === 'measured'));
  const retestCandidate =
    lastAttempt && hasRetest && refused.every((item) => item.retestStep || (scan.light && item.testStep)) && (refused.some((item) => item.retestStep) || week.length > 0);
  const lightSteps = refused.filter((item) => item.testStep);
  const swapped = retestCandidate
    ? withEasyRetests(lightSteps.length ? withLightSteps(days, lightSteps, input) : days.map((day) => ({ original: day, day })))
    : candidate
      ? withLightSteps(days, refused, input)
      : null;
  const weekBefore = week;
  if (swapped) week = input.loadGoal ? weekLoadBreaches(swapped.map((item) => item.day), input) : [];
  const swap = swapped !== null && week.length === 0;
  const swapOutcome = (hit: Breach) => (hit.retestStep ? 'light_retest' : 'light_test');
  if (log) for (const hit of hits) logBreach(hit, input, lastAttempt, hit.allowed ? 'test_text' : swap ? swapOutcome(hit) : lastAttempt ? 'failed' : 'retry');
  // A week limit the easy re-test cleared is logged once, as the swap.
  if (log && swap && retestCandidate) for (const breach of weekBefore) logBreach(breach, input, lastAttempt, 'light_retest');
  if (swap) {
    for (const { original, day } of swapped) {
      original.detailedSteps = day.detailedSteps;
      original.durationMinutes = day.durationMinutes;
    }
    return [];
  }
  if (log) for (const breach of week) logBreach(breach, input, lastAttempt, lastAttempt ? 'failed' : 'retry');
  return [...refused, ...week];
}

/**
 * M1.5b: the days with each refused test step replaced by the fixed light step, as copies; the days are not changed.
 * M2.2b review: on a running goal with a running-total limit the light step (counted as running by its minutes) takes at
 * most the whole minutes left under the limit, never more than its own; with less room than a 10-minute version it is
 * not shortened, and the swapped week fails its check as before. A shortened step shortens its day.
 */
function withLightSteps(days: WeekDayPlan[], refused: Breach[], input: WeekCallInput): Array<{ original: WeekDayPlan; day: WeekDayPlan }> {
  const swapped = swapLightSteps(days, refused);
  const limit = input.loadGoal?.running ? runningLimitMinutes(input.baseWeek) : null;
  if (limit === null) return swapped;
  const isLight = (step: DetailedStep) => step.title === LIGHT_TEST_STEP.title && codeMadeTestStep(step) === 'light';
  const lights = swapped.flatMap(({ day }) => (day.isTestDay ? day.detailedSteps.filter(isLight) : []));
  const lightMinutes = lights.reduce((sum, step) => sum + step.durationMinutes, 0);
  const measured = input.test.light !== true && !isLightWeek(input);
  const rest = weekRunning(weekRuns(swapped.map(({ day }) => day), true, measured)).totalMinutes - lightMinutes;
  let room = Math.floor(limit - rest + 1e-9);
  if (lightMinutes <= room || room < MINIMUM_VERSION_MINUTES) return swapped;
  return swapped.map(({ original, day }) => {
    if (!day.isTestDay || !day.detailedSteps.some(isLight)) return { original, day };
    let cut = 0;
    const detailedSteps = day.detailedSteps.map((step) => {
      if (!isLight(step) || room < MINIMUM_VERSION_MINUTES) return step;
      const minutes = Math.min(step.durationMinutes, room);
      room -= minutes;
      cut += step.durationMinutes - minutes;
      return { ...step, durationMinutes: minutes };
    });
    return { original, day: { ...day, detailedSteps, durationMinutes: Math.max(0, day.durationMinutes - cut) } };
  });
}

/** M3.3a (WU-55): each measured re-test step replaced by the fixed easy one, same place and minutes; copies only. */
function withEasyRetests(pairs: Array<{ original: WeekDayPlan; day: WeekDayPlan }>): Array<{ original: WeekDayPlan; day: WeekDayPlan }> {
  return pairs.map(({ original, day }) => {
    if (!day.detailedSteps.some((step) => codeMadeRetestStep(step) === 'measured')) return { original, day };
    const detailedSteps = day.detailedSteps.map((step) =>
      codeMadeRetestStep(step) === 'measured'
        ? { ...easyRetestStep(step.durationMinutes), stepNumber: step.stepNumber, priority: step.priority, ...(step.kind ? { kind: step.kind } : {}) }
        : step
    );
    return { original, day: { ...day, detailedSteps } };
  });
}

function swapLightSteps(days: WeekDayPlan[], refused: Breach[]): Array<{ original: WeekDayPlan; day: WeekDayPlan }> {
  return days.map((original) => {
    let detailedSteps = original.detailedSteps;
    for (const { day, step } of refused) {
      if (day !== original || !step) continue;
      const at = detailedSteps.indexOf(step);
      if (at < 0) continue;
      // Plan safety limits M2.1: the refused step's load is not the light step's.
      const light = { ...withoutLoad(step), ...lightTestStep(step.durationMinutes), stepNumber: step.stepNumber, priority: step.priority, ...(step.kind ? { kind: step.kind } : {}) };
      detailedSteps = detailedSteps.map((item, index) => (index === at ? light : item));
    }
    return { original, day: { ...original, detailedSteps } };
  });
}

function logBreach(breach: Breach, input: WeekCallInput, lastAttempt: boolean, outcome: 'retry' | 'failed' | 'test_text' | 'light_test' | 'light_retest'): void {
  logSafetyHit({
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
  // M2.2a review: a measured week's test is hard; a light week's (a light test, or a high-load first week back) is not.
  const measured = input.test.light !== true && !isLightWeek(input);
  const week = weekRunning(weekRuns(days, input.loadGoal?.running === true, measured));
  return weekBreaches(week, input.baseWeek).map((breach: LoadBreach & { run?: Run }) => ({
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
      logSafetyHit({
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
function stepLoadMisses(day: number, steps: DetailedStep[], hasTest: boolean, loadGoal: LoadGoal): LoadMiss[] {
  return steps.flatMap((step) => {
    const missing = missingLoad(step.load, loadNeed(step, hasTest && TEST_STEP.test(step.title), loadGoal));
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
    logSafetyHit({
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
export async function generateWeekPlan(input: WeekCallInput): Promise<WeekDayPlan[] | null> {
  const layout = weekLayout(input.planVariant, input.weekStart);
  // M2.2a (PSL-15 (1)): a base week whose running isn't known is no base; said once per week call.
  // M2.2a review: only where running is expected, or a run step of the base week had no load.
  if (input.loadGoal && input.baseWeek && !input.baseWeek.known && (input.loadGoal.running || input.baseWeek.runWithoutLoad)) {
    logSafetyHit({ goalId: input.goalId ?? null, week: input.weekNumber, rule: 'no_base', step: 'This week', matched: 'last week running not known', outcome: 'logged' });
  }
  // M2.2b (RULE-10): a first week back's base, once per week call.
  const back = input.loadGoal ? input.baseWeek : undefined;
  if (back?.firstWeekBack) {
    logSafetyHit({ goalId: input.goalId ?? null, week: input.weekNumber, rule: 'first_week_back_base', step: 'This week', ...firstWeekBackSummary({ ...back, firstWeekBack: back.firstWeekBack }), outcome: 'logged' });
  }
  // M2.2a follow-up: attempt 1's answer, for the first-answer fallback.
  let first: RawWeekAnswer | null = null;
  return generateWithOneRetry<RawWeekAnswer, WeekDayPlan[]>(
    buildWeekPrompt(input, layout),
    WEEK_SYSTEM,
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
  logSafetyHit({
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
