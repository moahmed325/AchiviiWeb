/**
 * Plan safety limits M2.2a (RULE-5, PSL-11 Q8 and Q9, PSL-15): a week's running counted from its steps' load, the base
 * week a later week is held to, and the week limits. Pure: no model call, no database. Every limit number comes from
 * `limits.ts`.
 */
import type { DetailedStep, StepLoad } from '../ai/goalDecomposer.js';
import type { ScanRule } from '../ai/safetyScan.js';
import type { CarriedStep } from '../carryForward.js';
import { originOf, stepKey } from '../recovery/inOrder.js';
import { RUN_KINDS } from './stepLoad.js';
import type { RunLevel } from './targetSteps.js';
import { codeMadeRetestStep } from '../ai/retestStep.js';
import {
  BASE_WEEK_DONE_PERCENT,
  CALORIE_DEFICIT_MAX,
  DAILY_INTAKE_MIN_KCAL,
  EARLY_WEEK_MAX_1RM_PERCENT,
  EARLY_WEEK_MIN_RIR,
  EARLY_WEEKS,
  FIRST_WEEK_BACK_MIN_KM,
  FIRST_WEEK_BACK_MIN_MINUTES,
  HARD_RUNS_MAX,
  LONGEST_RUN_MAX_PERCENT,
  LONGEST_RUN_MIN_RUNS,
  LONGEST_RUN_NO_BASE_MAX_KM,
  LONGEST_RUN_NO_BASE_MAX_MINUTES,
  RUNNING_TOTAL_STEP_MIN_KM,
  RUNNING_TOTAL_STEP_MIN_MINUTES,
  RUNNING_TOTAL_STEP_PERCENT,
} from './limits.js';

/** The test day's main step (`checkWeekAnswer` titles it so). The colon keeps "Weekly test warm-up" out (B-30). */
export const TEST_STEP_TITLE = /^weekly test\s*:/i;

export type RunUnit = 'minutes' | 'km';

/** A test step code wrote: `testStepFor`'s measured step, or the light step. Null for any other step. */
export type CodeMadeTest = 'measured' | 'light' | null;

/**
 * How one step is read: on a running goal, whether it is the test day's test step, and whether the week's test is
 * measured (not a light week); only the test step's hardness reads `measured`.
 */
export interface StepContext {
  running: boolean;
  testStep: boolean;
  codeMade: CodeMadeTest;
  measured: boolean;
}

/**
 * One run as counted. `minutes`: `runMinutes` when above 0, else the step's minutes (PSL-15 (3)); `km`: `runKm` when
 * above 0, never scaled (PSL-14). `noLoad`: a run only by its kind, with no running number given.
 */
export interface Run {
  name: string;
  minutes: number;
  km?: number;
  hard: boolean;
  noLoad: boolean;
}

const above0 = (value: number | undefined): value is number => typeof value === 'number' && value > 0;

/**
 * PSL-11 Q9, PSL-15 (1), (6): the run a step holds, or null. A load with `runMinutes` or `runKm` above 0 is a run and its
 * `hardRun` decides; a code-made test step on a running goal counts its minutes (hard when measured); a run kind, or
 * the model's test step on a running goal, with no running number counts its minutes (a `quality_session` is hard, and
 * so is the model's test step in a measured week, as code's measured test is: M2.2a review).
 */
export function runOf(step: Pick<DetailedStep, 'durationMinutes' | 'kind' | 'load'>, name: string, context: StepContext): Run | null {
  const load = step.load;
  const minutes = Math.max(0, step.durationMinutes || 0);
  if (above0(load?.runMinutes) || above0(load?.runKm)) {
    return { name, minutes: above0(load?.runMinutes) ? load.runMinutes : minutes, ...(above0(load?.runKm) ? { km: load.runKm } : {}), hard: load?.hardRun === true, noLoad: false };
  }
  if (context.testStep && context.running && context.codeMade) return { name, minutes, hard: context.codeMade === 'measured', noLoad: false };
  const givesRunning = load?.runMinutes !== undefined || load?.runKm !== undefined;
  const runKind = typeof step.kind === 'string' && RUN_KINDS.includes(step.kind);
  const modelTest = context.testStep && context.running;
  if (!givesRunning && (runKind || modelTest)) return { name, minutes, hard: step.kind === 'quality_session' || (modelTest && context.measured), noLoad: true };
  return null;
}

export interface WeekRunning {
  runs: Run[];
  /** PSL-15 (3): km only when every run gives km; otherwise minutes. A week with no run is in minutes. */
  unit: RunUnit;
  /** In `unit`. */
  total: number;
  /** Every run in minutes, for comparing two weeks counted in different units. */
  totalMinutes: number;
  hardRuns: number;
}

export function amountOf(run: Pick<Run, 'minutes' | 'km'>, unit: RunUnit): number {
  return unit === 'km' ? (run.km ?? 0) : run.minutes;
}

export function weekRunning(runs: Run[]): WeekRunning {
  const unit: RunUnit = runs.length > 0 && runs.every((run) => run.km !== undefined) ? 'km' : 'minutes';
  return {
    runs,
    unit,
    total: runs.reduce((sum, run) => sum + amountOf(run, unit), 0),
    totalMinutes: runs.reduce((sum, run) => sum + run.minutes, 0),
    hardRuns: runs.filter((run) => run.hard).length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The base week (B-64, PSL-11 Q8, PSL-15 (1)).

/**
 * What a later week's running total is held to. `known: false`: some run of the base week, planned or done, has no
 * running number (`runWithoutLoad`), or the week was written before M2.1, so there is no base: never 0 (PSL-15 (1)).
 * A known base of 0 runs is held like week 1 (PSL-16). `firstWeekBack` (M2.2b): the base of a first week back
 * (`firstWeekBackBaseOf`); a known one holds the total with no allowance, an unknown one is held like a 0-run base.
 */
export type BaseWeek =
  | { known: true; unit: RunUnit; total: number; totalMinutes: number; runs: number; firstWeekBack?: FirstWeekBackBase }
  | { known: false; runWithoutLoad: boolean; firstWeekBack?: FirstWeekBackBase };

/**
 * M2.2b (RULE-7, PSL-18): the week a first week back was counted from (null: no week with done running) and the share of
 * its done total allowed (100, or `FIRST_WEEK_BACK_LONG_BREAK_PERCENT` after a long break).
 */
export interface FirstWeekBackBase {
  fromWeek: number | null;
  percent: number;
}

/** The stored fields of one day of the base week that its count reads. */
export interface BaseTask {
  id: string;
  date: string;
  status: string;
  isTestDay: boolean;
  notOffered: boolean;
  usedMinimumVersion: boolean;
  steps: readonly CarriedStep[];
  minimumVersion: DetailedStep | null;
}

interface BaseCount {
  running: WeekRunning;
  unknown: boolean;
}

/**
 * Planned counts the steps of every offered day (a rest day only for the runs on it); done counts completed, offered
 * days, their 10-minute version when it was used. A `carriedFrom` / `shiftedFrom` copy counts once: steps are counted
 * by the day they were written on and their title (`stepKey`, `isDoneCopy`'s rule). Base is planned, or done when done
 * is under `BASE_WEEK_DONE_PERCENT` of planned; two counts in different units are compared in minutes.
 */
export function baseWeekOf(tasks: readonly BaseTask[], running: boolean, codeMade: (step: DetailedStep) => CodeMadeTest): BaseWeek {
  const offered = tasks.filter((task) => !task.notOffered);
  // A week written before M2.1 carries no load on any step: its running is not known.
  if (!offered.some((task) => task.steps.some((step) => step.load) || task.minimumVersion?.load)) {
    return { known: false, runWithoutLoad: countDays(offered, false, running, codeMade).unknown };
  }
  const planned = countDays(offered, false, running, codeMade);
  const done = countDays(
    offered.filter((task) => task.status === 'completed'),
    true,
    running,
    codeMade
  );
  if (planned.unknown || done.unknown) return { known: false, runWithoutLoad: true };
  const sameUnit = planned.running.unit === done.running.unit;
  const plannedAmount = sameUnit ? planned.running.total : planned.running.totalMinutes;
  const doneAmount = sameUnit ? done.running.total : done.running.totalMinutes;
  const base = doneAmount < (plannedAmount * BASE_WEEK_DONE_PERCENT) / 100 ? done.running : planned.running;
  return { known: true, unit: base.unit, total: base.total, totalMinutes: base.totalMinutes, runs: base.runs.length };
}

/** One week's stored days, for the first-week-back walk. */
export interface DoneWeek {
  weekNumber: number;
  tasks: readonly BaseTask[];
}

/**
 * M2.2b (PSL-18 (3)): a week's done running only (completed, offered days, M2.2a's done rules; no 70% rule). `unknown`:
 * a done run with no running number, or done days in a week written before M2.1 (no load on any step, PSL-16 (3)).
 */
export function doneRunningOf(tasks: readonly BaseTask[], running: boolean, codeMade: (step: DetailedStep) => CodeMadeTest): BaseCount & { runWithoutLoad: boolean } {
  const offered = tasks.filter((task) => !task.notOffered);
  const done = offered.filter((task) => task.status === 'completed');
  const count = countDays(done, true, running, codeMade);
  const beforeLoad = done.length > 0 && !offered.some((task) => task.steps.some((step) => step.load) || task.minimumVersion?.load);
  return { ...count, unknown: count.unknown || beforeLoad, runWithoutLoad: count.unknown };
}

/**
 * M2.2b (RULE-7, PSL-18 (3), (5)): the base of a first week back. `weeks` newest first, from the closing week back to
 * week 1: a week with no done running is passed over (a jumped week has no rows); the first week with an unknown done
 * run stops the walk at an unknown base; the first with done running above 0 is the base; none is a known 0-run base.
 */
export function firstWeekBackBaseOf(weeks: readonly DoneWeek[], running: boolean, codeMade: (step: DetailedStep) => CodeMadeTest, percent: number): BaseWeek {
  for (const week of weeks) {
    const done = doneRunningOf(week.tasks, running, codeMade);
    const firstWeekBack = { fromWeek: week.weekNumber, percent };
    if (done.unknown) return { known: false, runWithoutLoad: done.runWithoutLoad, firstWeekBack };
    const { unit, total, totalMinutes, runs } = done.running;
    if (total > 0 || totalMinutes > 0) return { known: true, unit, total, totalMinutes, runs: runs.length, firstWeekBack };
  }
  return { known: true, unit: 'minutes', total: 0, totalMinutes: 0, runs: 0, firstWeekBack: { fromWeek: null, percent } };
}

function countDays(tasks: readonly BaseTask[], asDone: boolean, running: boolean, codeMade: (step: DetailedStep) => CodeMadeTest): BaseCount {
  const seen = new Set<string>();
  const runs: Run[] = [];
  let unknown = false;
  for (const task of tasks) {
    const day = { taskId: task.id, date: task.date };
    if (asDone && task.usedMinimumVersion) {
      const run = minimumRun(task, running, codeMade);
      if (run === 'unknown') unknown = true;
      else if (run) runs.push(run);
      continue;
    }
    for (const step of task.steps) {
      const key = stepKey(originOf(step, day), step.title);
      if (seen.has(key)) continue;
      seen.add(key);
      const run = runOf(step, `${task.date} "${step.title}"`, contextOf(step, task, running, codeMade));
      if (!run) continue;
      if (run.noLoad) unknown = true;
      runs.push(run);
    }
  }
  return { running: weekRunning(runs), unknown };
}

function contextOf(step: DetailedStep, task: Pick<BaseTask, 'isTestDay'>, running: boolean, codeMade: (step: DetailedStep) => CodeMadeTest): StepContext {
  // The base week's hard runs are never compared, so `measured` doesn't matter here.
  return { running, ...testStepOf(step, task.isTestDay, codeMade), measured: false };
}

/**
 * The test day's test step (the model's, or code-made through `codeMade`), or a re-test step (weekly update M3.3a,
 * WU-55), which counts as the code-made test step of its kind: the measured re-test is hard on a running goal, the easy
 * one is not. Any other step is no test step.
 */
export function testStepOf(step: Pick<DetailedStep, 'title' | 'focusCue' | 'pitfallToAvoid'>, isTestDay: boolean, codeMade: (step: DetailedStep) => CodeMadeTest): Pick<StepContext, 'testStep' | 'codeMade'> {
  const retest = codeMadeRetestStep(step);
  if (retest) return { testStep: true, codeMade: retest };
  const testStep = isTestDay && TEST_STEP_TITLE.test(step.title);
  return { testStep, codeMade: testStep ? codeMade(step as DetailedStep) : null };
}

/**
 * PSL-15 (1): a day done through its 10-minute version counts that version's running load, or, when the day's
 * priority-1 step is a run and the version gives no running number, its minutes (the version is at most 10 minutes).
 */
function minimumRun(task: BaseTask, running: boolean, codeMade: (step: DetailedStep) => CodeMadeTest): Run | null | 'unknown' {
  const lead = task.steps.find((step) => step.priority === 1) ?? task.steps[0];
  const leadRun = lead ? runOf(lead, '', contextOf(lead, task, running, codeMade)) : null;
  const minimum = task.minimumVersion;
  const name = `${task.date} 10-minute version`;
  if (minimum && (above0(minimum.load?.runMinutes) || above0(minimum.load?.runKm))) return runOf(minimum, name, { running, testStep: false, codeMade: null, measured: false });
  if (!leadRun) return null;
  if (!minimum) return 'unknown';
  return { name, minutes: Math.max(0, minimum.durationMinutes || 0), hard: false, noLoad: false };
}

// ---------------------------------------------------------------------------------------------------------------
// The week limits (RULE-5).

/** The week-level rules and the intake floor; the other per-step rules are the text scan's rules, read from a number. */
export type WeekLoadRule = 'running_total_over_limit' | 'longest_run_over_limit' | 'hard_runs_over_2' | 'intake_below_1200';

export interface LoadBreach {
  rule: ScanRule | WeekLoadRule;
  /** The number the step or week has, and the limit it passed. */
  value: number;
  limit: number;
  /** The breach in words, without the step's name (for the log's `matched`). */
  matched: string;
  /** The retry reason's text after the step's name ("This week's running ..." for a week breach). */
  text: string;
}

/** Numbers as told, to one decimal. Shared with the week prompt (`runningLines`). */
export const shown = (value: number) => String(Math.round(value * 10) / 10);
/** A limit as told (whole minutes, km to one decimal) never says more than the check allows. */
export const shownLimit = (value: number, unit: RunUnit) => String(unit === 'km' ? Math.floor(value * 10 + 1e-9) / 10 : Math.floor(value + 1e-9));
const withUnit = (value: string, unit: RunUnit) => `${value} ${unit}`;
/** At the limit passes; floating point must not refuse it. */
const over = (value: number, limit: number) => value > limit + 1e-9;

/** The running total's limit against a known base, in the unit the two weeks are compared in (PSL-15 (3)). */
export function runningLimit(base: Extract<BaseWeek, { known: true }>, unit: RunUnit): { base: number; allowance: number; byPercent: boolean; limit: number } {
  const baseAmount = base.runs === 0 ? 0 : unit === base.unit ? base.total : base.totalMinutes;
  const percent = (baseAmount * RUNNING_TOTAL_STEP_PERCENT) / 100;
  const least = unit === 'km' ? RUNNING_TOTAL_STEP_MIN_KM : RUNNING_TOTAL_STEP_MIN_MINUTES;
  const allowance = Math.max(percent, least);
  return { base: baseAmount, allowance, byPercent: percent > least, limit: baseAmount + allowance };
}

/**
 * M2.2b (RULE-7, PSL-18 (1), (2), (6)): a first week back's running-total limit in the compared unit: the base's done
 * total times its share, with no allowance, and never below the floor.
 */
export function firstWeekBackLimit(
  base: Extract<BaseWeek, { known: true }> & { firstWeekBack: FirstWeekBackBase },
  unit: RunUnit
): { base: number; share: number; floor: number; byFloor: boolean; limit: number } {
  const baseAmount = unit === base.unit ? base.total : base.totalMinutes;
  const share = (baseAmount * base.firstWeekBack.percent) / 100;
  const floor = unit === 'km' ? FIRST_WEEK_BACK_MIN_KM : FIRST_WEEK_BACK_MIN_MINUTES;
  return { base: baseAmount, share, floor, byFloor: floor > share, limit: Math.max(share, floor) };
}

/**
 * M2.2b review: the running total's limit in minutes, or null where none holds (no base, an unknown base, or a 0-run
 * base). A week holding a run with no km is compared in minutes, as a week holding the code-made light step is.
 */
export function runningLimitMinutes(base: BaseWeek | undefined): number | null {
  if (!base?.known || base.runs === 0) return null;
  return base.firstWeekBack ? firstWeekBackLimit({ ...base, firstWeekBack: base.firstWeekBack }, 'minutes').limit : runningLimit(base, 'minutes').limit;
}

/** "half" for 50%, else the percent: how a first week back's share is told. */
export const shareOf = (percent: number) => (percent === 50 ? 'half' : `${percent}%`);

/**
 * M2.2b (RULE-10): the `first_week_back_base` log line's words and numbers: the week read and its total (or `none` /
 * `unknown`), the share used and the limit in the base's unit (`none` when it is held like a 0-run base).
 */
export function firstWeekBackSummary(base: BaseWeek & { firstWeekBack: FirstWeekBackBase }): { matched: string; value?: number; limit?: number } {
  const { fromWeek, percent } = base.firstWeekBack;
  if (!base.known) return { matched: `week ${fromWeek} total unknown, share ${percent}, limit none (held like no running)` };
  if (base.runs === 0) return { matched: `week none, share ${percent}, limit none (held like no running)` };
  const limit = firstWeekBackLimit({ ...base, firstWeekBack: base.firstWeekBack }, base.unit);
  return {
    matched: `week ${fromWeek} total ${withUnit(shown(base.total), base.unit)}, share ${percent}, limit ${withUnit(shownLimit(limit.limit, base.unit), base.unit)}`,
    value: base.total,
    limit: limit.limit,
  };
}

/** The unit two weeks are compared in: the same unit, or minutes; a base of 0 runs takes this week's unit. */
export function comparedUnit(base: Extract<BaseWeek, { known: true }>, week: Pick<WeekRunning, 'unit'>): RunUnit {
  return base.runs === 0 || base.unit === week.unit ? week.unit : 'minutes';
}

/**
 * Running total, longest run and hard runs. `base` undefined or not known: no running-total check. PSL-16: a known base
 * of 0 runs is held like week 1 (no running-total check), and every run is held to the fixed cap whatever their number.
 * M2.2b (PSL-18): a first week back's known base holds the total to `firstWeekBackLimit`; its unknown base is held like a
 * 0-run base (PSL-18 (5)).
 */
export function weekBreaches(week: WeekRunning, base: BaseWeek | undefined, level?: RunLevel | null): Array<LoadBreach & { run?: Run }> {
  const breaches: Array<LoadBreach & { run?: Run }> = [];
  const known = base?.known ? base : null;
  const unknownBack = base?.known === false && base.firstWeekBack !== undefined;
  const zeroBase = (known !== null && known.runs === 0) || unknownBack;
  if (known?.firstWeekBack && !zeroBase) {
    const back = known.firstWeekBack;
    const unit = comparedUnit(known, week);
    const amount = unit === week.unit ? week.total : week.totalMinutes;
    const limit = firstWeekBackLimit({ ...known, firstWeekBack: back }, unit);
    if (over(amount, limit.limit)) {
      const most = shownLimit(limit.limit, unit);
      const what = back.percent < 100 ? `${shareOf(back.percent)} of what they last did, week ${back.fromWeek}` : `what they last did, week ${back.fromWeek}`;
      const why = back.percent < 100 ? `${what}: ${shown(limit.base)}` : what;
      const floored = back.percent < 100 ? `${what}: ${shown(limit.base)}, is ${shown(limit.share)}; never below ${withUnit(most, unit)}` : `${what}, was ${shown(limit.base)}; never below ${withUnit(most, unit)}`;
      breaches.push({
        rule: 'running_total_over_limit',
        value: amount,
        limit: limit.limit,
        matched: `running ${withUnit(shown(amount), unit)}, limit ${withUnit(most, unit)}`,
        text: `This week's running is ${withUnit(shown(amount), unit)}; the most allowed is ${withUnit(most, unit)} (${limit.byFloor ? floored : why}).`,
      });
    }
  } else if (known && !zeroBase) {
    const unit = comparedUnit(known, week);
    const amount = unit === week.unit ? week.total : week.totalMinutes;
    const limit = runningLimit(known, unit);
    if (over(amount, limit.limit)) {
      const plus = limit.byPercent ? `${RUNNING_TOTAL_STEP_PERCENT}%` : withUnit(shown(limit.allowance), unit);
      breaches.push({
        rule: 'running_total_over_limit',
        value: amount,
        limit: limit.limit,
        matched: `running ${withUnit(shown(amount), unit)}, limit ${withUnit(shownLimit(limit.limit, unit), unit)}`,
        text: `This week's running is ${withUnit(shown(amount), unit)}; the most allowed is ${withUnit(shownLimit(limit.limit, unit), unit)} (last week ${shown(limit.base)}, plus ${plus}).`,
      });
    }
  }
  const longest = longestRunBreach(week, unknownBack ? 'unknown' : zeroBase ? 'zero' : known ? 'base' : 'none', level);
  if (longest) breaches.push(longest);
  if (week.hardRuns > HARD_RUNS_MAX) {
    breaches.push({
      rule: 'hard_runs_over_2',
      value: week.hardRuns,
      limit: HARD_RUNS_MAX,
      matched: `${week.hardRuns} hard runs`,
      text: `This week has ${week.hardRuns} hard runs (intervals, tempo, race pace or a hard test); the most allowed is ${HARD_RUNS_MAX}.`,
    });
  }
  return breaches;
}

/**
 * M3.1 (PSL-19): the longest-run cap of a week with no base week and fewer than 3 runs, in `unit`: the fixed cap, or
 * what they already run in one go when that is more (`RunLevel`, only in its own unit). A break or a 0-run base keeps
 * the fixed cap.
 */
export function noBaseCap(unit: RunUnit, level?: RunLevel | null): number {
  const cap = unit === 'km' ? LONGEST_RUN_NO_BASE_MAX_KM : LONGEST_RUN_NO_BASE_MAX_MINUTES;
  const already = unit === 'km' ? level?.km : level?.minutes;
  return typeof already === 'number' && Number.isFinite(already) ? Math.max(cap, already) : cap;
}

/**
 * PSL-15 (7): 50% of the week with 3 or more runs; with fewer and no base, the fixed cap; with fewer and a base, none.
 * PSL-16: after a base of 0 runs, the fixed cap whatever the number of runs, and also 50% with 3 or more. M2.2b: an
 * unknown first-week-back base (`unknown`) is held the same way.
 */
function longestRunBreach(week: WeekRunning, base: 'base' | 'none' | 'zero' | 'unknown', level?: RunLevel | null): (LoadBreach & { run: Run }) | null {
  if (week.runs.length === 0) return null;
  const unit = week.unit;
  const run = week.runs.reduce((best, item) => (amountOf(item, unit) > amountOf(best, unit) ? item : best));
  const amount = amountOf(run, unit);
  const limits: Array<{ limit: number; why: string }> = [];
  if (week.runs.length >= LONGEST_RUN_MIN_RUNS) {
    limits.push({ limit: (week.total * LONGEST_RUN_MAX_PERCENT) / 100, why: `${LONGEST_RUN_MAX_PERCENT}% of this week's ${withUnit(shown(week.total), unit)} of running` });
  }
  const cap = unit === 'km' ? LONGEST_RUN_NO_BASE_MAX_KM : LONGEST_RUN_NO_BASE_MAX_MINUTES;
  if (base === 'zero') limits.push({ limit: cap, why: 'last week had no running' });
  // M2.2b review: a first week back whose base isn't known is held as `zero`, and says so.
  else if (base === 'unknown') limits.push({ limit: cap, why: "last week's running isn't known" });
  else if (base === 'none' && week.runs.length < LONGEST_RUN_MIN_RUNS) {
    // M3.1 (PSL-19): never below what they already run in one go, from their starting point.
    const already = noBaseCap(unit, level);
    limits.push(
      already > cap
        ? { limit: already, why: `what they already run, from their starting point, with no last week to build from` }
        : { limit: cap, why: `with no last week to build from and fewer than ${LONGEST_RUN_MIN_RUNS} runs` }
    );
  }
  const held = limits.reduce<{ limit: number; why: string } | null>((least, item) => (least === null || item.limit < least.limit ? item : least), null);
  if (!held || !over(amount, held.limit)) return null;
  return {
    rule: 'longest_run_over_limit',
    run,
    value: amount,
    limit: held.limit,
    matched: `run ${withUnit(shown(amount), unit)}, limit ${withUnit(shownLimit(held.limit, unit), unit)}`,
    text: `the run is ${withUnit(shown(amount), unit)}; the most allowed is ${withUnit(shownLimit(held.limit, unit), unit)} (${held.why}).`,
  };
}

/**
 * RULE-5, PSL-2: one step's (or 10-minute version's) load against the per-step limits: the deficit and the intake floor
 * in every week, and in weeks 1 to `EARLY_WEEKS` the % of 1RM, reps in reserve, failure and max test. A lower deficit is
 * never refused. M3.1 (PSL-20): for an experienced lifter (`isExperiencedLifter`) weeks 1 to 3 keep only failure and
 * the max test; the % of 1RM and reps in reserve follow the method, as from week 4.
 */
export function stepLoadBreaches(load: StepLoad | undefined, weekNumber: number, options: { experiencedLifter?: boolean } = {}): LoadBreach[] {
  if (!load) return [];
  const breaches: LoadBreach[] = [];
  const add = (rule: LoadBreach['rule'], value: number, limit: number, field: string, text: string) =>
    breaches.push({ rule, value, limit, matched: `${field} ${rule === 'to_failure' || rule === 'max_test' ? 'true' : value}`, text });
  if (load.kcalDeficit !== undefined && over(load.kcalDeficit, CALORIE_DEFICIT_MAX)) {
    add('deficit_over_600', load.kcalDeficit, CALORIE_DEFICIT_MAX, 'kcalDeficit', `kcalDeficit is ${load.kcalDeficit}; the most allowed is ${CALORIE_DEFICIT_MAX} kcal a day.`);
  }
  if (load.kcalIntake !== undefined && load.kcalIntake < DAILY_INTAKE_MIN_KCAL) {
    add('intake_below_1200', load.kcalIntake, DAILY_INTAKE_MIN_KCAL, 'kcalIntake', `kcalIntake is ${load.kcalIntake}; the least allowed is ${DAILY_INTAKE_MIN_KCAL} kcal a day.`);
  }
  if (weekNumber <= EARLY_WEEKS) {
    if (!options.experiencedLifter && load.percent1RM !== undefined && over(load.percent1RM, EARLY_WEEK_MAX_1RM_PERCENT)) {
      add('over_80_percent_1rm', load.percent1RM, EARLY_WEEK_MAX_1RM_PERCENT, 'percent1RM', `percent1RM is ${load.percent1RM}; in weeks 1 to ${EARLY_WEEKS} the most allowed is ${EARLY_WEEK_MAX_1RM_PERCENT}.`);
    }
    if (!options.experiencedLifter && load.rir !== undefined && load.rir < EARLY_WEEK_MIN_RIR) {
      add('rir_below_3', load.rir, EARLY_WEEK_MIN_RIR, 'rir', `rir is ${load.rir}; in weeks 1 to ${EARLY_WEEKS} the least allowed is ${EARLY_WEEK_MIN_RIR} reps in reserve.`);
    }
    if (load.toFailure === true) add('to_failure', 1, 0, 'toFailure', `toFailure is true; in weeks 1 to ${EARLY_WEEKS} nothing goes to failure.`);
    if (load.maxTest === true) add('max_test', 1, 0, 'maxTest', `maxTest is true; in weeks 1 to ${EARLY_WEEKS} there is no max or 1RM test.`);
  }
  return breaches;
}
