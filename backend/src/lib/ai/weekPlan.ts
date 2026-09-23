import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';
import { generateWithOneRetry } from './retry.js';
import { fitStepMinutes } from './scheduleRepair.js';
import { dayQualityFailures, polishDays } from './taskRules.js';
import {
  formatAnswerLines,
  formatTarget,
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
    date.setDate(date.getDate() + index);
    return {
      dayNumber: index + 1,
      date: date.toISOString().split('T')[0],
      dayOfWeek: DAY_NAMES[date.getDay()],
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
  result: string;
  done: number;
  planned: number;
  keySessionsSkipped: string[];
  /** Prompt 4's guidance for next week (phase 4). */
  note?: string;
}

export interface WeekCallInput {
  finalGoal: string;
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
  retestFirst?: boolean;
}

const WEEK_SYSTEM = `You write one week of daily practice for a person following a 90-day plan. The goal, the method and this week's
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
              properties: { ...stepProperties, priority: { type: 'integer' }, timing: { type: 'string' } },
              required: ['title', 'instructions', 'minutes', 'output', 'doneWhen', 'focusCue', 'pitfall', 'priority'],
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
    `Target: ${formatTarget(last.target)}. Result: ${last.result}. Sessions done: ${last.done} of ${last.planned}.`,
    `Key sessions skipped: ${last.keySessionsSkipped.length ? last.keySessionsSkipped.join('; ') : 'none'}.`,
  ];
  if (last.note) lines.push(`Coach's note: ${last.note}`);
  if (input.retestFirst) {
    lines.push(
      'Their last two weeks were weak. Make the first practice day a re-test using the weekly test, so the plan resets',
      'to their real level. Title that step "Re-test: ...".'
    );
  }
  return lines.join('\n');
}

export function buildWeekPrompt(input: WeekCallInput, layout: DayLayout[]): string {
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
Focus: ${input.focus}
Target: ${formatTarget(input.target)}
Weekly test: ${input.test.instructions}. Pass if: ${input.test.passIf}
${lastWeekBlock(input)}

THE DAYS (already decided; keep them)
${dayLines(layout)}

WRITE THE WEEK
- 7 days, dayNumber 1-7, exactly as listed above.
- The test day's main step is the weekly test exactly as written above, titled "Weekly test: ...", with a
  short warm-up before it (5 minutes or less) and a short step after it (5 minutes or less) that compares the
  result with the target. The test day may be shorter than ${input.dailyMinutes} minutes; do not pad it.
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

function toStep(raw: RawStep, stepNumber: number): DetailedStep & { priority: number } {
  const timing = text(raw.timing);
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
  };
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

const TEST_STEP = /^weekly test\b/i;
/** A pause is part of a step's instructions, not a step of its own. */
const BREAK_STEP = /\b(break|breather)\b|^rest\b/i;

function testStepFor(test: WeekTest, minutes: number): DetailedStep & { priority: number } {
  return {
    stepNumber: 0,
    title: `Weekly test: ${test.instructions.split(/[.;]/)[0].slice(0, 80)}`,
    durationMinutes: minutes,
    instructions: test.instructions,
    focusCue: 'Your honest best, done exactly as written.',
    pitfallToAvoid: 'Changing the test to make it easier.',
    passMark: test.passIf,
    output: 'Your test result.',
    priority: 0,
  };
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
 */
export function checkWeekAnswer(
  data: RawWeekAnswer,
  input: WeekCallInput,
  lastAttempt = false
): { value: WeekDayPlan[] } | { reason: string } {
  const layout = weekLayout(input.planVariant, input.weekStart);
  const rawDays = Array.isArray(data.days) ? (data.days as RawDay[]) : [];
  const soft: string[] = [];
  const days: WeekDayPlan[] = [];

  for (const slot of layout) {
    const numbered = rawDays.some((day) => int(day?.dayNumber) !== null);
    const found = numbered ? rawDays.find((day) => int(day?.dayNumber) === slot.dayNumber) : rawDays[slot.dayNumber - 1];
    const raw: RawDay | undefined = found ?? (slot.isRestDay ? { title: 'Rest day', steps: [] } : undefined);
    if (!raw) return { reason: `Day ${slot.dayNumber} is missing. Return all 7 days.` };
    const label = `Day ${slot.dayNumber}`;
    let steps = (Array.isArray(raw.steps) ? (raw.steps as RawStep[]) : [])
      .map((step, index) => toStep(step ?? {}, index + 1))
      .filter((step) => step.title);
    const work = steps.filter((step) => !BREAK_STEP.test(step.title));
    if (!slot.isRestDay && work.length > 0) steps = work;

    if (slot.isRestDay) {
      const light = keepTopSteps(steps, 1).map((step) => ({
        ...step,
        durationMinutes: Math.min(REST_STEP_MAX_MINUTES, step.durationMinutes || REST_STEP_MAX_MINUTES),
      }));
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

    if (slot.isTestDay) {
      const hasTest = steps.some((step) => TEST_STEP.test(step.title));
      if (!hasTest && !lastAttempt) {
        return { reason: `${label} is the test day; its main step must be titled "Weekly test: ..." and run the weekly test as written.` };
      }
      if (!hasTest) steps = [testStepFor(input.test, Math.round(input.dailyMinutes / 2)), ...keepTopSteps(steps, MAX_STEPS - 1)];
      steps = steps.map((step) =>
        TEST_STEP.test(step.title) ? { ...step, priority: 0, passMark: input.test.passIf } : step
      );
    }

    if (steps.length === 0 || (steps.length < MIN_STEPS && !lastAttempt)) {
      return { reason: `${label} is a practice day and needs 2 to 4 steps; got ${steps.length}.` };
    }
    steps = keepTopSteps(steps, MAX_STEPS);

    const title = text(raw.title);
    if (!title) return { reason: `${label} has no title.` };
    const whyToday = text(raw.whyToday);
    if (!whyToday) soft.push(`${label} has no "whyToday".`);

    const rawMinimum = raw.minimumVersion;
    let minimumVersion: DetailedStep | null = rawMinimum && text(rawMinimum.title) ? toStep(rawMinimum, 1) : null;
    if (!minimumVersion) {
      soft.push(`${label} has no "minimumVersion".`);
      const lead = rankSteps(steps).find((step) => step.priority === 1)!;
      minimumVersion = { ...lead, stepNumber: 1, title: `Short version: ${lead.title}` };
    }
    const minMinutes = minimumVersion.durationMinutes;
    minimumVersion = {
      ...minimumVersion,
      durationMinutes: minMinutes > 0 && minMinutes <= MINIMUM_VERSION_MINUTES ? minMinutes : MINIMUM_VERSION_MINUTES,
    };
    delete (minimumVersion as { priority?: number }).priority;

    const written = steps.reduce((sum, step) => sum + step.durationMinutes, 0);
    const minutes = slot.isTestDay && written > 0 && written < input.dailyMinutes ? written : input.dailyMinutes;

    days.push({
      dayNumber: slot.dayNumber,
      date: slot.date,
      dayOfWeek: slot.dayOfWeek,
      title,
      isRestDay: false,
      durationMinutes: minutes,
      slotTime: input.slotTime,
      implementationIntention: `At ${input.slotTime}: ${title}.`,
      detailedSteps: fitStepMinutes(rankSteps(steps), minutes),
      isKeySession: raw.isKeySession === true && !slot.isTestDay,
      isTestDay: slot.isTestDay,
      whyToday: whyToday || input.focus,
      minimumVersion,
    });
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

  if (input.retestFirst && practice[0] && !practice[0].detailedSteps.some((step) => /^re-?test\b/i.test(step.title))) {
    soft.push(`Day ${practice[0].dayNumber} must start with a step titled "Re-test: ..." that runs the weekly test.`);
  }

  const polished = polishDays(days);
  soft.push(...dayQualityFailures(polished));
  if (soft.length > 0 && !lastAttempt) return { reason: soft.slice(0, 8).join(' ') };
  return { value: polished };
}

/** Prompt 3: one week of days that move the person toward this week's target. Null when both attempts fail. */
export async function generateWeekPlan(input: WeekCallInput): Promise<WeekDayPlan[] | null> {
  const layout = weekLayout(input.planVariant, input.weekStart);
  return generateWithOneRetry<RawWeekAnswer, WeekDayPlan[]>(
    buildWeekPrompt(input, layout),
    WEEK_SYSTEM,
    WEEK_RESPONSE_SCHEMA,
    (data, lastAttempt) => checkWeekAnswer(data, input, lastAttempt),
    `Week ${input.weekNumber}`
  );
}
