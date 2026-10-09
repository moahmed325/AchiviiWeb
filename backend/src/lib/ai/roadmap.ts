import { findPresetForGoal, type CertifiedPresetBlueprint } from './presets/index.js';
import { generateWithOneRetry } from './retry.js';
import { extractStatedTargets, rowMatchesTarget, type StatedTarget } from '../research/statedTarget.js';
import { screenQuery } from '../research/safetyFilter.js';
import type { VelocityTarget } from '../research/types.js';

export const TEST_TYPES = ['typing_test', 'quiz', 'timer', 'count', 'photo', 'video'] as const;
export type TestType = (typeof TEST_TYPES)[number];
export type TargetDirection = 'higher_is_better' | 'lower_is_better';

export type WeekTarget =
  | { kind: 'number'; metric: string; value: number; unit: string; direction: TargetDirection }
  | { kind: 'deliverable'; description: string };

export interface WeekTest {
  type: TestType;
  instructions: string;
  passIf: string;
}

export interface RoadmapPhase {
  name: string;
  startWeek: number;
  endWeek: number;
  purpose: string;
}

export interface RoadmapWeek {
  weekNumber: number;
  phase: string;
  focus: string;
  target: WeekTarget;
  test: WeekTest;
}

export interface MethodCandidate {
  name: string;
  creator: string;
  summary: string;
  strengths: string;
  weaknesses: string;
}

export interface ChosenMethod {
  name: string;
  creator: string;
  summary: string;
  whyChosen: string;
  runnerUp: { name: string; whyLost: string } | null;
  safety: number;
  rules: string[];
  candidates: MethodCandidate[];
}

export interface StartingPoint {
  /** In the same metric and unit as the weekly targets; null when the targets are deliverables. */
  value: number | null;
  description: string;
}

export interface Roadmap {
  finalGoal: string;
  finalTest: string;
  startingPoint: StartingPoint;
  method: ChosenMethod;
  phases: RoadmapPhase[];
  weeks: RoadmapWeek[];
}

/** One answer from the wizard. Custom goals use the 4 clarify ids; presets use their own. */
export interface PlanAnswer {
  id: string;
  question: string;
  answer: string;
}

export interface RoadmapInput {
  workingTitle: string;
  domain: string;
  rawGoal: string;
  dailyMinutes: number;
  activeDays: number;
  answers: PlanAnswer[];
}

export const TOTAL_WEEKS = 12;
const MIN_RULES = 5;
const MAX_RULES = 8;
/** Week 1 may cover at most this share of the climb from the starting point to week 12. */
const MAX_WEEK1_SHARE = 0.4;

const ANSWER_LABELS: Record<string, string> = {
  current_level: 'Where they are now',
  success: 'What success looks like to them',
  equipment: 'Equipment and environment',
  obstacle: 'Biggest obstacle',
};

export function isSkippedAnswer(answer: string): boolean {
  const value = answer.trim().toLowerCase();
  return !value || value === 'skipped';
}

export function formatAnswerLines(answers: PlanAnswer[]): string {
  if (answers.length === 0) return '- (no answers)';
  return answers
    .map((item) => `- ${ANSWER_LABELS[item.id] ?? item.question}: ${isSkippedAnswer(item.answer) ? '(skipped)' : item.answer}`)
    .join('\n');
}

function roundValue(value: number): number {
  return Math.round(value * 100) / 100;
}

/** "words per minute" as the metric for a "wpm" unit says nothing the number doesn't. */
function metricRepeatsUnit(metric: string, unit: string): boolean {
  const m = metric.toLowerCase().trim();
  const u = unit.toLowerCase().trim();
  const initials = m.split(/\s+/).map((word) => word[0]).join('');
  return !m || m === u || m.includes(u) || u.includes(m) || initials === u.replace(/[^a-z]/g, '');
}

export function formatTarget(target: WeekTarget): string {
  if (target.kind === 'deliverable') return target.description;
  const amount = `${roundValue(target.value)} ${target.unit}`.trim();
  const suffix = target.direction === 'lower_is_better' ? ' or less' : '';
  return metricRepeatsUnit(target.metric, target.unit) ? `${amount}${suffix}` : `${target.metric}: ${amount}${suffix}`;
}

const ROADMAP_SYSTEM = `You design the 12-week roadmap for one person's goal. You do not write daily tasks; another step does that.

Your job, in order:
1. Turn their goal and answers into one specific, checkable 90-day goal.
2. Choose the method with the best record of getting people like this person to this outcome.
3. Lay out 12 weeks, each with one target, that climb from where they are now to the goal.

Respond with one JSON object that matches the schema.`;

const candidateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    creator: { type: 'string' },
    summary: { type: 'string' },
    strengths: { type: 'string' },
    weaknesses: { type: 'string' },
  },
  required: ['name', 'creator', 'summary', 'strengths', 'weaknesses'],
};

const targetSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['number', 'deliverable'] },
    metric: { type: 'string' },
    value: { type: 'number' },
    unit: { type: 'string' },
    direction: { type: 'string', enum: ['higher_is_better', 'lower_is_better'] },
    description: { type: 'string' },
  },
  required: ['kind'],
};

const testSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: [...TEST_TYPES] },
    instructions: { type: 'string' },
    passIf: { type: 'string' },
  },
  required: ['type', 'instructions', 'passIf'],
};

export const ROADMAP_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    finalGoal: { type: 'string' },
    finalTest: { type: 'string' },
    startingPoint: {
      type: 'object',
      properties: {
        value: { type: 'number' },
        description: { type: 'string' },
      },
      required: ['description'],
    },
    candidates: { type: 'array', items: candidateSchema },
    chosen: { type: 'string' },
    whyChosen: { type: 'string' },
    runnerUp: {
      type: 'object',
      properties: { name: { type: 'string' }, whyLost: { type: 'string' } },
      required: ['name', 'whyLost'],
    },
    safety: { type: 'integer' },
    rules: { type: 'array', items: { type: 'string' } },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          startWeek: { type: 'integer' },
          endWeek: { type: 'integer' },
          purpose: { type: 'string' },
        },
        required: ['name', 'startWeek', 'endWeek', 'purpose'],
      },
    },
    weeks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          weekNumber: { type: 'integer' },
          phase: { type: 'string' },
          focus: { type: 'string' },
          target: targetSchema,
          test: testSchema,
        },
        required: ['weekNumber', 'phase', 'focus', 'target', 'test'],
      },
    },
  },
  required: [
    'finalGoal',
    'finalTest',
    'startingPoint',
    'candidates',
    'chosen',
    'whyChosen',
    'runnerUp',
    'safety',
    'rules',
    'phases',
    'weeks',
  ],
};

export interface FixedMethod {
  name: string;
  creator: string;
  summary: string;
}

/** The method block for a preset: already chosen, so the model only writes its rules. */
function fixedMethodBlock(method: FixedMethod): string {
  return `2. THE METHOD (already chosen, do not compare methods)
   The method is fixed: ${method.name}${method.creator ? ` by ${method.creator}` : ''}.
   ${method.summary}
   "candidates": exactly one entry for this method, with its "strengths" and "weaknesses" for THIS person.
   "chosen": "${method.name}".
   "whyChosen": one or two sentences on how it fits their answers.
   "runnerUp": { "name": "", "whyLost": "" }.
   "safety": 1 to 5, the risk of injury, burnout, or harm for this person on this method (5 = very safe).
   "rules": 5 to 8 rules of this method that every week must follow. Rules, not tasks. No motivation lines.`;
}

const OPEN_METHOD_BLOCK = `2. THE METHOD
   List 2 or 3 real, established methods people use to reach this outcome. For each: "name", "creator"
   ("" if none or unsure), "summary", and "strengths" / "weaknesses" for THIS person.
   Choose the one most likely to get THIS person to the goal. What matters, in order:
   - Results: people who follow it actually reach this kind of outcome.
   - Sticking with it: people at their level keep doing it for 12 weeks with their time and days.
   - Fit: it matches where they are now, their equipment, and their obstacle.
   When an established, well-known program fits equally well, prefer it; it has a track record.
   A method built for a different starting level does not fit.
   "chosen": the "name" of the chosen candidate, exactly as written.
   "whyChosen": one or two sentences that cite their own answers.
   "runnerUp": the second-best, and in one sentence why it lost.
   "safety": 1 to 5, the risk of injury, burnout, or harm for this person on the chosen method (5 = very safe).
   "rules": 5 to 8 rules of the chosen method that every week must follow, e.g. "Hold 95% accuracy before
   adding speed". Rules, not tasks. No motivation lines.
   Names: name a program or creator only if you are sure it exists. Never invent a person, program, or book.`;

/**
 * A number the user named is checked in week 12 (`statedTargetMet`), so the model hears it up front, not only in a
 * retry: a method's own metric (chord changes per minute for "5 songs") can never reach it.
 */
function statedTargetLines(statedTargets: StatedTarget[]): string {
  if (statedTargets.length === 0) return '';
  const phrases = statedTargets.map((item) => `"${item.phrase}"`).join(', ');
  return `
   They named a number: ${phrases}. Week 12's target must reach it. Count the weekly targets in that unit; if week 1
   can't be counted in it yet, use deliverables for all 12 weeks and name it in week 12's (e.g. "${statedTargets[0].phrase} ...").
   A method's own measure (speed, reps, a score) goes in the weekly tests, not in place of it.`;
}

/** The two ways a roadmap can meet the user's own number, for a retry reason. */
function statedTargetWayOut(statedTargets: StatedTarget[]): string {
  const item = statedTargets[0];
  const reach =
    item.bound === 'at_most'
      ? `${item.value} ${item.unit} or less`
      : `${item.value} ${item.unit} or more, only if week 1 already has a count above 0 in it`;
  const all = statedTargets.map((target) => `"${target.phrase}"`).join(', ');
  return `The user asked for ${all}. Fix it one of two ways, never a mix: (a) number targets in "${item.unit}" for all 12 weeks, week 12 at ${reach}; or (b) deliverable targets for all 12 weeks, with week 12's description naming the number and unit (e.g. "${item.phrase} ..."). Not another unit.`;
}

/** "%" and "percent", "minute" and "minutes": one unit written two ways. */
function unitKey(unit: string): string {
  const lower = unit.toLowerCase().trim();
  if (lower === '%' || /^percent(age)?s?$/.test(lower)) return 'percent';
  return lower.replace(/s$/, '');
}

export function buildRoadmapPrompt(input: RoadmapInput, fixedMethod?: FixedMethod, statedTargets: StatedTarget[] = []): string {
  return `Goal as typed: "${input.workingTitle}" (${input.domain})
Time: ${input.dailyMinutes} minutes a day, ${input.activeDays} days a week, for 12 weeks.
Their answers:
${formatAnswerLines(input.answers)}
(Skipped answers: assume a beginner, basic equipment, and no target they did not give.)

1. THE GOAL
   "finalGoal": their success answer as one specific outcome that can be checked on day 90.
   Keep their ambition exactly. If their answer is vague ("get better"), make it concrete at the level they
   described, using a real, recognised marker for this domain when one exists (e.g. "Twitch Affiliate",
   "25 words per minute", "a loaf with an open crumb"). Never raise or lower it.
   If the weekly targets are numbers, "finalGoal" states week 12's number.${statedTargetLines(statedTargets)}
   "finalTest": how they prove it on day 90, in one sentence.
   "startingPoint": where they are today. When the targets are numbers, "value" is today's level in the same
   metric and unit as the targets (from their current-level answer; a cautious beginner value if they skipped it)
   and "description" says it in words. If their answer uses another measure (a 5K time for a 10K goal), convert it
   to the targets' metric. When the targets are deliverables, leave "value" out.

${fixedMethod ? fixedMethodBlock(fixedMethod) : OPEN_METHOD_BLOCK}

3. THE 12 WEEKS
   "phases": 2 to 4 phases in the order the method uses them. Each has "name", "startWeek", "endWeek",
   and "purpose" (one sentence). Together they cover weeks 1 to 12 with no gaps.
   "weeks": exactly 12. Each has:
   - "weekNumber", "phase" (a phase name from above).
   - "focus": what this week works on, in a few words.
   - "target": what they must reach by the end of the week. Either
       { "kind": "number", "metric", "value", "unit", "direction": "higher_is_better" | "lower_is_better" }
     or
       { "kind": "deliverable", "description" }, e.g. "one loaf with an even, open crumb".
     Use numbers whenever the goal can be counted and every week, week 1 included, has a count above 0 in that
     unit. Otherwise use deliverables for all 12 weeks. Never mix number weeks and deliverable weeks.
     Keep the same metric and unit every week, week 12 included, even when the final test reports on another scale.
     Counts that stay at 0 until late (sales, users, subscribers, customers, orders) can't be counted in week 1: use
     deliverables for all 12 weeks (what gets built, launched or sent each week), and make week 12's the number,
     e.g. "50 sales of the template".
     Exams: one measure every week, e.g. metric "Practice test score", unit "percent"; topic quizzes and full mock
     exams both report that same percent. Never switch to questions, topics or hours.${
       statedTargets.length
         ? `\n     They named ${statedTargets.map((item) => `"${item.phrase}"`).join(', ')}: count every week in that unit, or use deliverables. Never another unit.`
         : ''
     }
     "metric" names what is measured ("Typing speed", "5K time"); "unit" is its unit ("words per minute", "minutes").
   - "test": { "type": "typing_test" | "quiz" | "timer" | "count" | "photo" | "video", "instructions", "passIf" }.
     Prefer tests the app runs itself, then proof (photo, video), then a count. Use the same type every week.
   How the targets climb:
   - Week 1 starts just above where they are now: an early win, not a leap.
   - Steps are small in weeks 1 to 3, larger in the middle, and smaller again before the final test.
   - Never go backwards: each week's target is at least as good as the week before. A lighter week (a taper, a
     deload, a review week) or a harder test (a full mock exam after topic quizzes) keeps the previous week's target;
     it never lowers it. Week 12's target is the finalGoal.
   - A target is what they can do on that week's test (the longest distance in one go, the best time, the score),
     not how much they train that week. For distance and endurance goals, a taper or recovery week trains less but
     its target stays at the previous week's distance or time.
   - Realistic for ${input.dailyMinutes} minutes a day and ${input.activeDays} days a week.`;
}

interface RawTarget {
  kind?: unknown;
  metric?: unknown;
  value?: unknown;
  unit?: unknown;
  direction?: unknown;
  description?: unknown;
}

interface RawWeek {
  weekNumber?: unknown;
  phase?: unknown;
  focus?: unknown;
  target?: RawTarget | null;
  test?: { type?: unknown; instructions?: unknown; passIf?: unknown } | null;
}

export interface RawRoadmapAnswer {
  finalGoal?: unknown;
  finalTest?: unknown;
  startingPoint?: { value?: unknown; description?: unknown } | null;
  candidates?: unknown;
  chosen?: unknown;
  whyChosen?: unknown;
  runnerUp?: { name?: unknown; whyLost?: unknown } | null;
  safety?: unknown;
  rules?: unknown;
  phases?: unknown;
  weeks?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function cleanRules(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const rules: string[] = [];
  for (const item of value) {
    const rule = text(item);
    const key = rule.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!rule || seen.has(key)) continue;
    seen.add(key);
    rules.push(rule);
  }
  return rules;
}

function cleanCandidates(value: unknown): MethodCandidate[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      name: text(item?.name),
      creator: text(item?.creator),
      summary: text(item?.summary),
      strengths: text(item?.strengths),
      weaknesses: text(item?.weaknesses),
    }))
    .filter((item) => item.name);
}

function sameName(a: string, b: string): boolean {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right) && (left === right || left.includes(right) || right.includes(left));
}

function cleanTarget(raw: RawTarget | null | undefined): WeekTarget | null {
  if (!raw) return null;
  const value = num(raw.value);
  const unit = text(raw.unit);
  const metric = text(raw.metric);
  if (text(raw.kind) === 'number' || (text(raw.kind) !== 'deliverable' && value !== null && unit)) {
    if (value === null || !unit) return null;
    return {
      kind: 'number',
      metric: metric || unit,
      value,
      unit,
      direction: text(raw.direction) === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better',
    };
  }
  const description = text(raw.description);
  return description ? { kind: 'deliverable', description } : null;
}

function cleanTest(raw: RawWeek['test']): WeekTest | null {
  const type = text(raw?.type) as TestType;
  const instructions = text(raw?.instructions);
  const passIf = text(raw?.passIf);
  if (!TEST_TYPES.includes(type) || !instructions || !passIf) return null;
  return { type, instructions, passIf };
}

function phaseFailures(phases: RoadmapPhase[]): string | null {
  if (phases.length < 2 || phases.length > 4) return `"phases" must have 2 to 4 phases; got ${phases.length}.`;
  let expected = 1;
  for (const phase of phases) {
    if (!phase.name) return 'Every phase needs a "name".';
    if (phase.startWeek !== expected || phase.endWeek < phase.startWeek) {
      return `Phases must cover weeks 1 to 12 in order with no gaps or overlaps; "${phase.name}" covers weeks ${phase.startWeek}-${phase.endWeek}.`;
    }
    expected = phase.endWeek + 1;
  }
  if (expected !== TOTAL_WEEKS + 1) return `Phases end at week ${expected - 1}; they must end at week 12.`;
  return null;
}

function isBetterOrEqual(next: number, prev: number, direction: TargetDirection): boolean {
  return direction === 'higher_is_better' ? next >= prev : next <= prev;
}

function numberMentioned(textValue: string, value: number): boolean {
  const rounded = roundValue(value);
  const plain = String(rounded).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withComma = rounded >= 1000 ? rounded.toLocaleString('en-US').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : plain;
  return new RegExp(`(?:^|[^0-9.])(?:${plain}|${withComma})(?:[^0-9]|$)`).test(textValue);
}

function statedTargetMet(week12: WeekTarget, item: StatedTarget): boolean {
  if (week12.kind === 'deliverable') {
    return numberMentioned(week12.description, item.value) && item.aliases.some((alias) => week12.description.toLowerCase().includes(alias));
  }
  const row = { metric: week12.metric, unit: week12.unit, value: week12.value } as VelocityTarget;
  if (!rowMatchesTarget(row, item)) return false;
  return item.bound === 'at_most' ? week12.value <= item.value : week12.value >= item.value;
}

/**
 * Number targets: one unit and direction all 12 weeks, never backwards, week 1 a small step from the
 * starting point. Returns the first problem, or null.
 */
interface ClimbProblem {
  reason: string;
  /** Refused even on the last attempt: a roadmap with it can't be tracked week to week. */
  hard: boolean;
  /** A unit or kind problem, where the user's own number (if they named one) is the way out. */
  unitProblem: boolean;
}

function numberClimbFailure(weeks: RoadmapWeek[], start: StartingPoint): ClimbProblem | null {
  const hard = (reason: string, unitProblem = false): ClimbProblem => ({ reason, hard: true, unitProblem });
  const soft = (reason: string): ClimbProblem => ({ reason, hard: false, unitProblem: false });
  const targets = weeks.map((week) => week.target);
  const numbers = targets.filter((target): target is Extract<WeekTarget, { kind: 'number' }> => target.kind === 'number');
  if (numbers.length === 0) return null;
  if (numbers.length !== targets.length) {
    const deliverableWeeks = targets.flatMap((target, index) => (target.kind === 'deliverable' ? [index + 1] : []));
    return hard(
      `Some weeks have a number target and some a deliverable (weeks ${deliverableWeeks.join(', ')}). Use one kind for all 12 weeks, never a mix: numbers only if week 1 already has a count above 0 in that unit; otherwise deliverables for all 12 weeks, with week 12's description naming the final number (e.g. "50 sales").`,
      true
    );
  }
  const first = numbers[0];
  const unit = unitKey(first.unit);
  for (let i = 0; i < numbers.length; i++) {
    const target = numbers[i];
    if (target.direction === 'higher_is_better' && target.value <= 0) {
      return hard(
        `Week ${i + 1}'s target is ${target.value} ${target.unit}, which is nothing to reach. If the early weeks can't be counted in "${target.unit}" (no sales or users yet), use deliverable targets for all 12 weeks, with week 12's description naming the final number.`,
        true
      );
    }
    if (unitKey(target.unit) !== unit || target.direction !== first.direction) {
      return hard(
        `Week ${i + 1} uses "${target.unit}" (${target.direction}); every week must use "${first.unit}" (${first.direction}). Keep one metric and unit for all 12 weeks and restate week ${i + 1}'s target in "${first.unit}" (an exam keeps the same practice-test score every week).`,
        true
      );
    }
    if (i > 0 && !isBetterOrEqual(target.value, numbers[i - 1].value, first.direction)) {
      const previous = numbers[i - 1].value;
      const bound = first.direction === 'higher_is_better' ? 'at least' : 'at most';
      return hard(
        `Week ${i + 1}'s target (${target.value}) goes backwards from week ${i} (${previous}). A target is what they can do on the weekly test, not how much they train that week, so it never goes down: a lighter, taper or harder-test week keeps the previous week's target. Set week ${i + 1} to ${bound} ${previous} ${first.unit} and keep every later week ${bound} the week before. Keep "${first.unit}" for all 12 weeks.`
      );
    }
  }
  const end = numbers[numbers.length - 1].value;
  if (end === first.value && numbers.length > 1) {
    return soft('The targets never move from week 1 to week 12. They must climb from where the person is to the goal.');
  }
  if (start.value === null) {
    return soft('"startingPoint.value" is missing. Give today\'s level in the same metric and unit as the targets.');
  }
  if (!isBetterOrEqual(first.value, start.value, first.direction)) {
    return soft(`Week 1's target (${first.value}) is below the starting point (${start.value}). Week 1 starts just above where they are now.`);
  }
  const climb = Math.abs(end - start.value);
  if (climb > 0 && Math.abs(first.value - start.value) > climb * MAX_WEEK1_SHARE) {
    return soft(`Week 1 (${first.value}) jumps too far from the starting point (${start.value}) toward week 12 (${end}). Week 1 is an early win, not a leap.`);
  }
  return null;
}

export interface RoadmapCheckContext {
  statedTargets: StatedTarget[];
  fixedMethod?: FixedMethod;
}

/**
 * Fixes what code can fix (order, rules, each week's phase from the ranges, the chosen method's details)
 * and rejects what it can't. Soft checks give way on the last attempt so the user still gets a plan.
 */
export function checkRoadmapAnswer(
  data: RawRoadmapAnswer,
  context: RoadmapCheckContext,
  lastAttempt = false
): { value: Roadmap } | { reason: string } {
  const finalGoal = text(data.finalGoal);
  const finalTest = text(data.finalTest);
  if (!finalGoal) return { reason: '"finalGoal" is empty.' };
  if (!finalTest) return { reason: '"finalTest" is empty.' };

  const safety = num(data.safety);
  if (safety === null || safety < 1 || safety > 5) return { reason: '"safety" must be a number from 1 to 5.' };
  if (safety < 3) {
    return {
      reason: `"safety" is ${safety}: the chosen method is too risky for this person. Choose a safer method or a gentler climb, then rate it again.`,
    };
  }

  const candidates = cleanCandidates(data.candidates);
  const chosenName = text(data.chosen) || context.fixedMethod?.name || '';
  const chosen = candidates.find((item) => sameName(item.name, chosenName));
  if (!context.fixedMethod && candidates.length < 2) {
    return { reason: `List 2 or 3 methods in "candidates"; got ${candidates.length}.` };
  }
  if (!context.fixedMethod && !chosen) {
    return { reason: `"chosen" ("${chosenName}") must be the name of one of the candidates.` };
  }

  const rules = cleanRules(data.rules);
  if (rules.length < MIN_RULES && !(lastAttempt && rules.length >= 3)) {
    return { reason: `"rules" needs ${MIN_RULES} to ${MAX_RULES} different rules; got ${rules.length}.` };
  }

  const rawPhases = Array.isArray(data.phases) ? data.phases : [];
  const phases: RoadmapPhase[] = rawPhases
    .map((item) => ({
      name: text(item?.name),
      startWeek: num(item?.startWeek) ?? 0,
      endWeek: num(item?.endWeek) ?? 0,
      purpose: text(item?.purpose),
    }))
    .sort((a, b) => a.startWeek - b.startWeek);
  const phaseProblem = phaseFailures(phases);
  if (phaseProblem) return { reason: phaseProblem };

  const rawWeeks = Array.isArray(data.weeks) ? (data.weeks as RawWeek[]) : [];
  if (rawWeeks.length !== TOTAL_WEEKS) return { reason: `"weeks" must have exactly 12 weeks; got ${rawWeeks.length}.` };
  const ordered = [...rawWeeks].sort((a, b) => (num(a.weekNumber) ?? 0) - (num(b.weekNumber) ?? 0));
  const weeks: RoadmapWeek[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const weekNumber = i + 1;
    const raw = ordered[i];
    const target = cleanTarget(raw.target);
    if (!target) return { reason: `Week ${weekNumber} has no usable "target". A number needs "value" and "unit"; a deliverable needs "description".` };
    const test = cleanTest(raw.test);
    if (!test) return { reason: `Week ${weekNumber} has no usable "test" (type, instructions, passIf).` };
    const phase = phases.find((item) => weekNumber >= item.startWeek && weekNumber <= item.endWeek)!;
    weeks.push({ weekNumber, phase: phase.name, focus: text(raw.focus) || phase.purpose, target, test });
  }

  const startingPoint: StartingPoint = {
    value: num(data.startingPoint?.value),
    description: text(data.startingPoint?.description),
  };
  if (weeks[0].target.kind === 'deliverable') startingPoint.value = null;

  const climbProblem = numberClimbFailure(weeks, startingPoint);
  if (climbProblem && (climbProblem.hard || !lastAttempt)) {
    // A unit change or a mix that drifts toward the user's own number: name that unit, not week 1's, as the way out.
    const wayOut = climbProblem.unitProblem && context.statedTargets.length > 0 ? ` ${statedTargetWayOut(context.statedTargets)}` : '';
    return { reason: `${climbProblem.reason}${wayOut}` };
  }

  // One unit written two ways ("%" and "percent") is stored as week 1 wrote it.
  const firstTarget = weeks[0].target;
  if (firstTarget.kind === 'number') {
    for (const week of weeks) if (week.target.kind === 'number') week.target.unit = firstTarget.unit;
  }

  const week12 = weeks[TOTAL_WEEKS - 1].target;
  // Before the finalGoal check: its retry reason would otherwise anchor the model on the wrong unit.
  const missed = context.statedTargets.filter((item) => !statedTargetMet(week12, item));
  if (missed.length > 0) {
    return {
      reason: `Week 12 must reach the number the user asked for: ${missed.map((item) => item.phrase).join(', ')}. ${statedTargetWayOut(missed)}`,
    };
  }
  if (!lastAttempt && week12.kind === 'number' && !numberMentioned(finalGoal, week12.value)) {
    return { reason: `"finalGoal" must state week 12's target (${formatTarget(week12)}).` };
  }

  const testTypes = new Set(weeks.map((week) => week.test.type));
  if (testTypes.size > 1 && !lastAttempt) {
    return { reason: `Weekly tests use ${[...testTypes].join(', ')}. Use the same test type every week.` };
  }

  const method: ChosenMethod = {
    name: context.fixedMethod?.name ?? chosen!.name,
    creator: context.fixedMethod?.creator ?? chosen!.creator,
    summary: context.fixedMethod?.summary ?? chosen!.summary,
    whyChosen: text(data.whyChosen),
    runnerUp:
      !context.fixedMethod && text(data.runnerUp?.name)
        ? { name: text(data.runnerUp?.name), whyLost: text(data.runnerUp?.whyLost) }
        : null,
    safety,
    rules: rules.slice(0, MAX_RULES),
    candidates,
  };

  return { value: { finalGoal, finalTest, startingPoint, method, phases, weeks } };
}

/** The method a preset already follows: its badge names it, its frameworks describe it. */
export function presetMethod(preset: CertifiedPresetBlueprint): FixedMethod {
  const name = preset.badge.split('·').pop()?.trim() || preset.title;
  return {
    name,
    creator: '',
    summary: preset.scientificFrameworks.map((item) => `${item.name}: ${item.description}`).join(' '),
  };
}

export type RoadmapResult =
  | { ok: true; roadmap: Roadmap }
  /** `unsafe`: the goal itself is blocked. `lowSafety`: the model rated its own method under 3 twice. */
  | { ok: false; reason: string; unsafe?: boolean; lowSafety?: boolean };

/** Prompt 2: the checkable 90-day goal, the method, its phases, and 12 weekly targets. */
export async function generateRoadmap(input: RoadmapInput): Promise<RoadmapResult> {
  const successAnswer = input.answers.find((item) => item.id === 'success')?.answer ?? '';
  const goalText = `${input.rawGoal} ${input.workingTitle} ${successAnswer}`;
  if (screenQuery(goalText).blocked) {
    return { ok: false, reason: 'This goal is outside what Achivii can plan safely.', unsafe: true };
  }

  const preset = findPresetForGoal(input.rawGoal) || findPresetForGoal(input.workingTitle);
  const fixedMethod = preset ? presetMethod(preset) : undefined;
  const statedTargets = extractStatedTargets(
    `${input.rawGoal}. ${isSkippedAnswer(successAnswer) ? '' : successAnswer}`
  );

  const prompt = buildRoadmapPrompt(input, fixedMethod, statedTargets) + (preset ? `\n\nMETHOD DETAIL\n${preset.expertPromptContext}` : '');
  let lowSafety = false;
  const roadmap = await generateWithOneRetry<RawRoadmapAnswer, Roadmap>(
    prompt,
    ROADMAP_SYSTEM,
    ROADMAP_RESPONSE_SCHEMA,
    (data, lastAttempt) => {
      const verdict = checkRoadmapAnswer(data, { statedTargets, fixedMethod }, lastAttempt);
      lowSafety = 'reason' in verdict && verdict.reason.startsWith('"safety" is');
      return verdict;
    },
    'Roadmap'
  );
  if (roadmap) return { ok: true, roadmap };
  if (lowSafety) {
    return {
      ok: false,
      reason: 'We could not find a safe way to plan this goal in 12 weeks. Try a smaller goal.',
      lowSafety: true,
    };
  }
  return { ok: false, reason: "Couldn't design your roadmap right now. Please try again." };
}
