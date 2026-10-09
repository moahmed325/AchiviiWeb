/**
 * Method-aware recovery M2.2: the eval's scoring, as MR-24 says. Pure: no files, no model calls.
 * RULE-19's thresholds: right template for at least 24 of 26, at least 90% of answer kinds agreeing on the action,
 * zero unsafe results, and at least 90% of tags agreeing.
 */
import { FIXED_TIME_KIND, WEEKLY_TEST_KIND, type RecoveryKind, type RecoveryProfile, type TemplateId } from '../../src/lib/recovery/index.js';
import type { ProfileCallSource } from '../../src/lib/recovery/profileCall.js';

export const THRESHOLDS = { templates: 24, actions: 0.9, unsafe: 0, tags: 0.9 } as const;

/** Kinds code adds (RULE-5); they are left out of action agreement (MR-24 point 4). */
const ADDED_IDS = new Set([WEEKLY_TEST_KIND.id, FIXED_TIME_KIND.id]);
/** The same title check code uses to tag the test step. */
export const TEST_STEP = /^weekly test\b/i;

export type AnswerKind = RecoveryKind & { aliases?: string[] };
export type AnswerProfile = Omit<RecoveryProfile, 'kinds'> & { kinds: AnswerKind[] };

/** One hand-written answer (answers.json). */
export interface EvalAnswer {
  goalId: string;
  template: TemplateId;
  profile: AnswerProfile;
  /** One line per change from the template, with why. Empty when the template is used unchanged. */
  changes: Array<{ change: string; why: string }>;
}

const norm = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** The returned kind that means the same as the answer kind: by id, then name (ignoring case), then an alias. */
export function matchKind(answer: AnswerKind, returned: RecoveryKind[]): RecoveryKind | null {
  const byId = returned.find((kind) => kind.id === answer.id);
  if (byId) return byId;
  const byName = returned.find((kind) => norm(kind.name) && norm(kind.name) === norm(answer.name));
  if (byName) return byName;
  const aliases = new Set((answer.aliases ?? []).map(norm).filter(Boolean));
  return returned.find((kind) => aliases.has(norm(kind.id)) || aliases.has(norm(kind.name))) ?? null;
}

const isHardOrHighLoad = (kind: Pick<RecoveryKind, 'hard' | 'highLoad'>) => kind.hard === true || kind.highLoad === true;

/** MR-24 point 5: every unsafe thing in the returned profile, against the answer. */
export function unsafeReasons(returned: RecoveryProfile, answer: AnswerProfile): string[] {
  const reasons: string[] = [];
  const kinds = Array.isArray(returned?.kinds) ? returned.kinds : [];
  for (const kind of kinds) {
    if (isHardOrHighLoad(kind) && kind.action === 'continue') reasons.push(`"${kind.id}" is hard or high-load and continues.`);
    if (kind.highLoad === true && kind.hard !== true) reasons.push(`"${kind.id}" is high-load but not hard.`);
  }
  const test = kinds.find((kind) => kind.id === WEEKLY_TEST_KIND.id);
  if (!test || test.action !== 'fixed') reasons.push('the weekly test is not fixed.');
  for (const want of answer.kinds) {
    if (ADDED_IDS.has(want.id) || !isHardOrHighLoad(want)) continue;
    const got = matchKind(want, kinds);
    if (!got) continue;
    if (got.action === 'continue') reasons.push(`"${got.id}" continues, but the answer's "${want.id}" is hard or high-load.`);
    if (got.hard !== true) reasons.push(`"${got.id}" is not hard, but the answer's "${want.id}" is hard or high-load.`);
  }
  return [...new Set(reasons)];
}

export interface KindScore {
  answerKind: string;
  answerAction: RecoveryKind['action'];
  /** The returned kind it matched, or null (a disagreement). */
  returnedKind: string | null;
  returnedAction: RecoveryKind['action'] | null;
  agrees: boolean;
}

export interface ProfileScore {
  goalId: string;
  templateRight: boolean;
  answerTemplate: TemplateId;
  returnedTemplate: TemplateId;
  kinds: KindScore[];
  /** Returned kinds no answer kind matched (listed, not counted). */
  extraKinds: string[];
  unsafe: string[];
}

export function scoreProfile(answer: EvalAnswer, returned: RecoveryProfile): ProfileScore {
  const returnedKinds = Array.isArray(returned?.kinds) ? returned.kinds : [];
  const matched = new Set<string>();
  const kinds = answer.profile.kinds
    .filter((kind) => !ADDED_IDS.has(kind.id))
    .map((want): KindScore => {
      const got = matchKind(want, returnedKinds);
      if (got) matched.add(got.id);
      return {
        answerKind: want.id,
        answerAction: want.action,
        returnedKind: got?.id ?? null,
        returnedAction: got?.action ?? null,
        agrees: !!got && got.action === want.action,
      };
    });
  return {
    goalId: answer.goalId,
    templateRight: returned?.template === answer.template,
    answerTemplate: answer.template,
    returnedTemplate: returned?.template,
    kinds,
    extraKinds: returnedKinds.filter((kind) => !ADDED_IDS.has(kind.id) && !matched.has(kind.id)).map((kind) => kind.id),
    unsafe: unsafeReasons(returned, answer.profile),
  };
}

export interface ProfileRunResult {
  goalId: string;
  source: ProfileCallSource;
  pickedTemplate: TemplateId | null;
  profile: RecoveryProfile;
  /** Start to result, including the retry. */
  ms: number;
  /** `profileFailures` on the saved profile with the goal's deliverable fact (a non-empty list is an M1.3b bug). */
  failures: string[];
}

export interface RunScore {
  goals: number;
  templatesRight: number;
  kindsAgree: number;
  kindsTotal: number;
  /** Answer kinds that found a returned kind (context only: RULE-19 counts an unmatched kind as a disagreement). */
  kindsMatched: number;
  unsafe: Array<{ goalId: string; reason: string }>;
  sources: Record<ProfileCallSource, number>;
  perGoal: ProfileScore[];
  pass: { templates: boolean; actions: boolean; unsafe: boolean };
}

export function scoreRun(answers: EvalAnswer[], results: Array<Pick<ProfileRunResult, 'goalId' | 'source' | 'profile'>>): RunScore {
  const sources: Record<ProfileCallSource, number> = { model: 0, picked_template: 0, keyword_template: 0 };
  const perGoal: ProfileScore[] = [];
  for (const answer of answers) {
    const result = results.find((item) => item.goalId === answer.goalId);
    if (!result) throw new Error(`No profile result for ${answer.goalId}.`);
    sources[result.source] += 1;
    perGoal.push(scoreProfile(answer, result.profile));
  }
  const kinds = perGoal.flatMap((goal) => goal.kinds);
  const templatesRight = perGoal.filter((goal) => goal.templateRight).length;
  const kindsAgree = kinds.filter((kind) => kind.agrees).length;
  const unsafe = perGoal.flatMap((goal) => goal.unsafe.map((reason) => ({ goalId: goal.goalId, reason })));
  return {
    goals: answers.length,
    templatesRight,
    kindsAgree,
    kindsTotal: kinds.length,
    kindsMatched: kinds.filter((kind) => kind.returnedKind !== null).length,
    unsafe,
    sources,
    perGoal,
    pass: {
      templates: templatesRight >= THRESHOLDS.templates,
      actions: kinds.length > 0 && kindsAgree / kinds.length >= THRESHOLDS.actions,
      unsafe: unsafe.length <= THRESHOLDS.unsafe,
    },
  };
}

/** The keyword table alone: how many of its picks equal the answer's template. */
export function scoreTemplatePicks(answers: EvalAnswer[], picks: Record<string, TemplateId>): { right: number; total: number; misses: Array<{ goalId: string; answer: TemplateId; picked: TemplateId }> } {
  const misses = answers
    .filter((answer) => picks[answer.goalId] !== answer.template)
    .map((answer) => ({ goalId: answer.goalId, answer: answer.template, picked: picks[answer.goalId] }));
  return { right: answers.length - misses.length, total: answers.length, misses };
}

// ---------------------------------------------------------------------------------------------------------------
// Tags (MR-24 point 6).

/** One written step, without its kind (weeks.json). */
export interface WeekStep {
  goalId: string;
  dayNumber: number;
  stepNumber: number;
  title: string;
  instructions: string;
  durationMinutes: number;
  highLoad?: boolean;
}

/** A step's kind, by goal, day and step (weeks.model-tags.json, weeks.gold-tags.json). */
export interface StepTag {
  goalId: string;
  dayNumber: number;
  stepNumber: number;
  kind: string | null;
}

/** The steps that are scored: every practice-day step except the test step, which code tags. */
export function scoredSteps(steps: WeekStep[]): WeekStep[] {
  return steps.filter((step) => !TEST_STEP.test(step.title.trim()));
}

const tagKey = (tag: Pick<StepTag, 'goalId' | 'dayNumber' | 'stepNumber'>) => `${tag.goalId}#${tag.dayNumber}#${tag.stepNumber}`;

export interface TagScore {
  agree: number;
  total: number;
  misses: Array<{ goalId: string; dayNumber: number; stepNumber: number; title: string; gold: string | null; model: string | null }>;
  pass: boolean;
}

/** Agreement of the model's tags with the hand-written ones, over the scored steps. A missing tag disagrees. */
export function scoreTags(steps: WeekStep[], gold: StepTag[], model: StepTag[]): TagScore {
  const goldByKey = new Map(gold.map((tag) => [tagKey(tag), tag.kind]));
  const modelByKey = new Map(model.map((tag) => [tagKey(tag), tag.kind]));
  const scored = scoredSteps(steps);
  const misses: TagScore['misses'] = [];
  for (const step of scored) {
    const key = tagKey(step);
    if (!goldByKey.has(key)) throw new Error(`No gold tag for ${key}.`);
    const want = goldByKey.get(key) ?? null;
    const got = modelByKey.get(key) ?? null;
    if (!want || want !== got) misses.push({ goalId: step.goalId, dayNumber: step.dayNumber, stepNumber: step.stepNumber, title: step.title, gold: want, model: got });
  }
  const total = scored.length;
  const agree = total - misses.length;
  return { agree, total, misses, pass: total > 0 && agree / total >= THRESHOLDS.tags };
}
