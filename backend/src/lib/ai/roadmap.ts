import { findPresetForGoal, type CertifiedPresetBlueprint } from './presets/index.js';
import { generateWithOneRetry } from './retry.js';
import { screenQuery } from '../research/safetyFilter.js';
import { DEFAULT_SHAPE, DEFAULT_WEEKS, planShape, type PlanShape } from '../planLength.js';

/**
 * Prompt 2: the roadmap. No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md): the roadmap is the
 * checkable final goal, the method and its rules, the phases, and what each week works on (its focus). Each next week
 * is written from what the person did and how it felt (`lib/ai/weekPlan.ts`'s pace line), never against a target.
 */

/**
 * A number as a target or a measure. Goals made before the weekly tests went store one per week (`RoadmapWeek.target`,
 * no longer read for the plan); a goal now has at most one measure (`Roadmap.measure`), which the safety limits read to
 * know a running, lifting or body-weight goal.
 */
export type TargetDirection = 'higher_is_better' | 'lower_is_better';
export type WeekTarget =
  | { kind: 'number'; metric: string; value: number; unit: string; direction: TargetDirection }
  | { kind: 'deliverable'; description: string };

export interface RoadmapPhase {
  name: string;
  startWeek: number;
  endWeek: number;
  purpose: string;
}

export interface RoadmapWeek {
  weekNumber: number;
  phase: string;
  /** What the week works on, in a few words. */
  focus: string;
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
  /** Today's level in `measure`'s unit; null when the goal is not counted. */
  value: number | null;
  description: string;
}

/** The one number that shows progress, when the goal can be counted ("Longest run", km, higher is better). */
export interface Measure {
  metric: string;
  unit: string;
  direction: TargetDirection;
}

export interface Roadmap {
  finalGoal: string;
  startingPoint: StartingPoint;
  measure: Measure | null;
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
  /** Next plan (NP-3): the level the person gave for the last plan's measure; the starting point must be it (same unit). */
  measuredStart?: { value: number; unit: string } | null;
  /** B-109: the plan's weeks (`planLengthFor`); missing is 12. */
  totalWeeks?: number;
}

/** A 12-week plan's length: the default (`planLength.ts`). A goal's own count is `shapeOf(goal).weeks`. */
export const TOTAL_WEEKS = DEFAULT_WEEKS;
const MIN_RULES = 5;
const MAX_RULES = 8;

const ANSWER_LABELS: Record<string, string> = {
  current_level: 'Where they are now',
  success: 'What success looks like to them',
  equipment: 'Equipment and environment',
  obstacle: 'Biggest obstacle',
};

/** One unit written several ways. Never a conversion: kg and lb stay apart, as do km and miles. */
const SAME_UNIT: readonly (readonly string[])[] = [
  ['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers'],
  ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  ['lb', 'lbs', 'pound', 'pounds'],
  ['mi', 'mile', 'miles'],
  ['m', 'metre', 'metres', 'meter', 'meters'],
  ['min', 'mins', 'minute', 'minutes'],
  ['percent', '%', 'percentage'],
];

/** The same unit, written either way ("km" and "kilometres", "rep" and "reps"). */
export function sameUnit(a: string, b: string): boolean {
  const one = (unit: string) => unit.trim().toLowerCase().replace(/s$/, '');
  const x = one(a);
  const y = one(b);
  if (x === y) return true;
  return SAME_UNIT.some((group) => group.map(one).includes(x) && group.map(one).includes(y));
}

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

const roundValue = (value: number) => Math.round(value * 100) / 100;

/** A number as the app names it, rounded, with its unit. */
export function formatAmount(value: number, unit: string): string {
  return `${roundValue(value)} ${unit}`.trim();
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
  const amount = formatAmount(target.value, target.unit);
  const suffix = target.direction === 'lower_is_better' ? ' or less' : '';
  return metricRepeatsUnit(target.metric, target.unit) ? `${amount}${suffix}` : `${target.metric}: ${amount}${suffix}`;
}

/** The roadmap call's system text; a shorter plan names its own weeks. */
export function roadmapSystem(weeks: number = DEFAULT_WEEKS): string {
  return `You design the ${weeks}-week roadmap for one person's goal. You do not write daily tasks; another step does that.

Your job, in order:
1. Turn their goal and answers into one specific, checkable ${weeks === DEFAULT_WEEKS ? '90-day' : `${weeks}-week`} goal.
2. Choose the method with the best record of getting people like this person to this outcome.
3. Lay out ${weeks} weeks, each with what it works on, that build from where they are now to the goal.

Respond with one JSON object that matches the schema.`;
}

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

export const ROADMAP_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    finalGoal: { type: 'string' },
    startingPoint: {
      type: 'object',
      properties: { value: { type: 'number' }, description: { type: 'string' } },
      required: ['description'],
    },
    measure: {
      type: 'object',
      properties: {
        metric: { type: 'string' },
        unit: { type: 'string' },
        direction: { type: 'string', enum: ['higher_is_better', 'lower_is_better'] },
      },
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
        properties: { weekNumber: { type: 'integer' }, phase: { type: 'string' }, focus: { type: 'string' } },
        required: ['weekNumber', 'phase', 'focus'],
      },
    },
  },
  required: ['finalGoal', 'startingPoint', 'candidates', 'chosen', 'whyChosen', 'runnerUp', 'safety', 'rules', 'phases', 'weeks'],
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

const openMethodBlock = (weeks: number) => `2. THE METHOD
   List 2 or 3 real, established methods people use to reach this outcome. For each: "name", "creator"
   ("" if none or unsure), "summary", and "strengths" / "weaknesses" for THIS person.
   Choose the one most likely to get THIS person to the goal. What matters, in order:
   - Results: people who follow it actually reach this kind of outcome.
   - Sticking with it: people at their level keep doing it for ${weeks} weeks with their time and days.
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

/** "4, 8 and 12" (or "4, 8 or 12"). */
export function weekList(weeks: readonly (number | string)[], join: 'and' | 'or' = 'and'): string {
  if (weeks.length <= 1) return weeks.join('');
  return `${weeks.slice(0, -1).join(', ')} ${join} ${weeks[weeks.length - 1]}`;
}

export function buildRoadmapPrompt(input: RoadmapInput, fixedMethod?: FixedMethod): string {
  const shape = planShape(input.totalWeeks);
  const n = shape.weeks;
  const end = shape.readyWeek === null ? 'day 90' : `the end of week ${n}`;
  return `Goal as typed: "${input.workingTitle}" (${input.domain})
Time: ${input.dailyMinutes} minutes a day, ${input.activeDays} days a week, for ${n} weeks.${
    shape.readyWeek === null ? '' : `\nTheir date: they have a fixed date (an exam, a race, a talk) right after week ${n}; week ${n} is the easier week before it.`
  }
Their answers:
${formatAnswerLines(input.answers)}
(Skipped answers: assume a beginner, basic equipment, and no target they did not give.)

1. THE GOAL
   "finalGoal": their success answer as one specific outcome that can be checked on ${end}.
   Keep their ambition exactly. If their answer is vague ("get better"), make it concrete at the level they
   described, using a real, recognised marker for this domain when one exists (e.g. "Twitch Affiliate",
   "25 words per minute", "a loaf with an open crumb"). Never raise or lower it. If they named a number, keep it.
   "startingPoint": where they are today: "description" in words, and "value" as a number when the goal is counted
   (see "measure"), from their current-level answer (a cautious beginner value if they skipped it).
   "measure": only when the goal is counted in one number that shows progress (a distance, a time, a weight, a
   score, words per minute): its "metric", "unit" and "direction". Leave it out for goals that are built or made
   (a book, an app, a channel, a loaf).

${fixedMethod ? fixedMethodBlock(fixedMethod) : openMethodBlock(n)}

3. THE ${n} WEEKS
   "phases": 2 to 4 phases in the order the method uses them. Each has "name", "startWeek", "endWeek",
   and "purpose" (one sentence). Together they cover weeks 1 to ${n} with no gaps.
   "weeks": exactly ${n}. Each has "weekNumber", "phase" (a phase name from above) and "focus": what this week works
   on, in a few words, building from where they are now toward the goal in the method's order. Week 1 starts just
   above where they are now: an early win, not a leap. Realistic for ${input.dailyMinutes} minutes a day and
   ${input.activeDays} days a week.${
     shape.readyWeek === null ? '' : `\n   Week ${n} is the easier week before their date: lighter, nothing new, so they arrive rested and ready.`
   }`;
}

interface RawWeek {
  weekNumber?: unknown;
  phase?: unknown;
  focus?: unknown;
}

export interface RawRoadmapAnswer {
  finalGoal?: unknown;
  startingPoint?: { value?: unknown; description?: unknown } | null;
  measure?: { metric?: unknown; unit?: unknown; direction?: unknown } | null;
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

function cleanMeasure(raw: RawRoadmapAnswer['measure']): Measure | null {
  const metric = text(raw?.metric);
  const unit = text(raw?.unit);
  if (!metric || !unit) return null;
  return { metric, unit, direction: text(raw?.direction) === 'lower_is_better' ? 'lower_is_better' : 'higher_is_better' };
}

function phaseFailures(phases: RoadmapPhase[], weeks: number): string | null {
  if (phases.length < 2 || phases.length > 4) return `"phases" must have 2 to 4 phases; got ${phases.length}.`;
  let expected = 1;
  for (const phase of phases) {
    if (!phase.name) return 'Every phase needs a "name".';
    if (phase.startWeek !== expected || phase.endWeek < phase.startWeek) {
      return `Phases must cover weeks 1 to ${weeks} in order with no gaps or overlaps; "${phase.name}" covers weeks ${phase.startWeek}-${phase.endWeek}.`;
    }
    expected = phase.endWeek + 1;
  }
  if (expected !== weeks + 1) return `Phases end at week ${expected - 1}; they must end at week ${weeks}.`;
  return null;
}

export interface RoadmapCheckContext {
  fixedMethod?: FixedMethod;
  /** Next plan (NP-3): `RoadmapInput.measuredStart`. */
  measuredStart?: { value: number; unit: string } | null;
  /** B-109: the plan's length; missing is a 12-week plan. */
  shape?: PlanShape;
}

/**
 * Fixes what code can fix (order, rules, each week's phase from the ranges, the chosen method's details) and rejects
 * what it can't. Soft checks give way on the last attempt so the user still gets a plan.
 */
export function checkRoadmapAnswer(data: RawRoadmapAnswer, context: RoadmapCheckContext, lastAttempt = false): { value: Roadmap } | { reason: string } {
  const shape = context.shape ?? DEFAULT_SHAPE;
  const finalGoal = text(data.finalGoal);
  if (!finalGoal) return { reason: '"finalGoal" is empty.' };

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
  if (!context.fixedMethod && candidates.length < 2) return { reason: `List 2 or 3 methods in "candidates"; got ${candidates.length}.` };
  if (!context.fixedMethod && !chosen) return { reason: `"chosen" ("${chosenName}") must be the name of one of the candidates.` };

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
  const phaseProblem = phaseFailures(phases, shape.weeks);
  if (phaseProblem) return { reason: phaseProblem };

  const rawWeeks = Array.isArray(data.weeks) ? (data.weeks as RawWeek[]) : [];
  if (rawWeeks.length !== shape.weeks) return { reason: `"weeks" must have exactly ${shape.weeks} weeks; got ${rawWeeks.length}.` };
  const ordered = [...rawWeeks].sort((a, b) => (num(a.weekNumber) ?? 0) - (num(b.weekNumber) ?? 0));
  const weeks: RoadmapWeek[] = ordered.map((raw, index) => {
    const weekNumber = index + 1;
    const phase = phases.find((item) => weekNumber >= item.startWeek && weekNumber <= item.endWeek)!;
    return { weekNumber, phase: phase.name, focus: text(raw.focus) || phase.purpose };
  });

  const measure = cleanMeasure(data.measure);
  const startingPoint: StartingPoint = {
    value: measure ? num(data.startingPoint?.value) : null,
    description: text(data.startingPoint?.description),
  };
  // Next plan (NP-3): the starting point is the level they gave, when the measure is in its unit. The model's own value
  // is sent back once; on the last attempt it is replaced.
  const measured = context.measuredStart;
  if (
    measured &&
    measure &&
    sameUnit(measure.unit, measured.unit) &&
    (startingPoint.value === null || Math.abs(startingPoint.value - measured.value) > 1e-9)
  ) {
    if (!lastAttempt) return { reason: `"startingPoint.value" must be ${measured.value} ${measured.unit}: their level at the end of their last plan.` };
    startingPoint.value = measured.value;
  }

  const method: ChosenMethod = {
    name: context.fixedMethod?.name ?? chosen!.name,
    creator: context.fixedMethod?.creator ?? chosen!.creator,
    summary: context.fixedMethod?.summary ?? chosen!.summary,
    whyChosen: text(data.whyChosen),
    runnerUp: !context.fixedMethod && text(data.runnerUp?.name) ? { name: text(data.runnerUp?.name), whyLost: text(data.runnerUp?.whyLost) } : null,
    safety,
    rules: rules.slice(0, MAX_RULES),
    candidates,
  };

  return { value: { finalGoal, startingPoint, measure, method, phases, weeks } };
}

/** The pathway a goal is on, as the roadmap call finds it (the raw goal first, then the clarified one). */
export function pathwayFor(rawGoal: string, workingTitle: string | null | undefined): CertifiedPresetBlueprint | null {
  return findPresetForGoal(rawGoal) || findPresetForGoal(workingTitle ?? '');
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

/** B-32: the roadmap call's attempts (the last one lets soft checks give way). */
export const ROADMAP_ATTEMPTS = 3;

export async function generateRoadmap(input: RoadmapInput): Promise<RoadmapResult> {
  const successAnswer = input.answers.find((item) => item.id === 'success')?.answer ?? '';
  if (screenQuery(`${input.rawGoal} ${input.workingTitle} ${successAnswer}`).blocked) {
    return { ok: false, reason: 'This goal is outside what Achivii can plan safely.', unsafe: true };
  }

  const preset = pathwayFor(input.rawGoal, input.workingTitle);
  const fixedMethod = preset ? presetMethod(preset) : undefined;
  const shape = planShape(input.totalWeeks);
  // The preset's method text was written for a 12-week plan with weekly tests: the model keeps its order, not its tests.
  const presetNote = preset
    ? `\n\nThe method detail below names weekly tests and gates; this plan has none (each week is written from what the person did). Keep the method's order and phases${
        shape.readyWeek === null ? '' : `, shrunk to fit ${shape.weeks} weeks, with week ${shape.weeks} the easier week before their date`
      }.`
    : '';
  const prompt = buildRoadmapPrompt(input, fixedMethod) + (preset ? `${presetNote}\n\nMETHOD DETAIL\n${preset.expertPromptContext}` : '');
  let lowSafety = false;
  const roadmap = await generateWithOneRetry<RawRoadmapAnswer, Roadmap>(
    prompt,
    roadmapSystem(shape.weeks),
    ROADMAP_RESPONSE_SCHEMA,
    (data, lastAttempt) => {
      const verdict = checkRoadmapAnswer(data, { fixedMethod, shape, measuredStart: input.measuredStart ?? null }, lastAttempt);
      lowSafety = 'reason' in verdict && verdict.reason.startsWith('"safety" is');
      return verdict;
    },
    'Roadmap',
    // B-32: a third call keeps a second, different miss from becoming a 503.
    ROADMAP_ATTEMPTS
  );
  if (roadmap) return { ok: true, roadmap };
  if (lowSafety) {
    return { ok: false, reason: `We could not find a safe way to plan this goal in ${shape.weeks} weeks. Try a smaller goal.`, lowSafety: true };
  }
  return { ok: false, reason: "Couldn't design your roadmap right now. Please try again." };
}
