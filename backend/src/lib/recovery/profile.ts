/**
 * Method-aware recovery, M1.2: the recovery profile, its checks (RULE-4), the two kinds code adds (RULE-5), the
 * checked reader (MR-9) and `actionOf` (RULE-7, RULE-18, MR-11).
 * Pure: no database, no clock, no environment, no model call. Nothing calls this yet (M1.3a stores it, M2.1 tags
 * steps with it, M3.1a acts on it).
 * Rules: docs/features/method-aware-recovery/02-feature.md section 4 and reference/domain-templates.md.
 */
import type { DetailedStep } from '../ai/goalDecomposer.js';

/** What a kind does when its day doesn't happen (MR-1). */
export type RecoveryAction = 'move' | 'continue' | 'let_go' | 'fixed';
export const RECOVERY_ACTIONS: readonly RecoveryAction[] = ['move', 'continue', 'let_go', 'fixed'];

export type TemplateId =
  | 'endurance'
  | 'strength'
  | 'language'
  | 'instrument'
  | 'writing'
  | 'product'
  | 'exam'
  | 'speaking'
  | 'creative'
  | 'habit'
  | 'content'
  | 'strategy_games'
  | 'general';

export const TEMPLATE_IDS: readonly TemplateId[] = [
  'endurance',
  'strength',
  'language',
  'instrument',
  'writing',
  'product',
  'exam',
  'speaking',
  'creative',
  'habit',
  'content',
  'strategy_games',
  'general',
];

export interface RecoveryKind {
  /** Stable id, the value a step's `kind` holds (snake_case). */
  id: string;
  name: string;
  /** One plain sentence for the week writer: what a step of this kind looks like. */
  description: string;
  action: RecoveryAction;
  /** Needs the rest gap around it. */
  hard: boolean;
  /** Steps of this kind keep the order they were written in. */
  inOrder: boolean;
  /** Set by the profile call (M1.3b) when the kind is physical strain; such a kind must be hard (RULE-4). */
  highLoad?: boolean;
}

export type BreakLength = 'any' | '1-2 weeks' | '3+ weeks';
export type Restart = 'last level' | 'back 1 week' | 'back 2 weeks';
export const RESTARTS: readonly Restart[] = ['last level', 'back 1 week', 'back 2 weeks'];

/** The return-after-a-break rule (templates file, "Return rule format"). Read later by the weekly update (WU-10). */
export interface ReturnRule {
  /** Either one rule for `any` length, or `1-2 weeks` then `3+ weeks`. */
  breaks: Array<{ length: BreakLength; restart: Restart }>;
  /** A short note for the week writer about the first week back. */
  firstWeekBack: string;
}

export interface RecoveryProfile {
  version: 1;
  /** The template it came from. */
  template: TemplateId;
  /** The certified pathway it belongs to (RULE-2), when it is one. */
  pathway?: string;
  /** Every kind, including the catch-all and the two kinds code adds (RULE-5). */
  kinds: RecoveryKind[];
  /** The id of the catch-all kind. */
  catchAll: string;
  /** Full days between two hard steps, 0 to 2. */
  restGapDays: number;
  returnRule: ReturnRule;
}

// ---------------------------------------------------------------------------------------------------------------
// RULE-5: the two kinds code adds to every profile.

export const WEEKLY_TEST_KIND: RecoveryKind = {
  id: 'weekly_test',
  name: 'Weekly test',
  description: "The week's test, done exactly as written.",
  action: 'fixed',
  hard: false,
  inOrder: false,
};

export const FIXED_TIME_KIND: RecoveryKind = {
  id: 'fixed_time_session',
  name: 'Fixed-time session',
  description: 'Something set for a time by others, such as a class, a group run or a call.',
  action: 'fixed',
  hard: false,
  inOrder: false,
};

const ADDED_KINDS: readonly RecoveryKind[] = [WEEKLY_TEST_KIND, FIXED_TIME_KIND];
const ADDED_IDS = new Set(ADDED_KINDS.map((kind) => kind.id));

/** Returns the profile with Weekly test and Fixed-time session (both fixed) added once, after its own kinds. */
export function withFixedKinds(profile: RecoveryProfile): RecoveryProfile {
  const own = profile.kinds.filter((kind) => !ADDED_IDS.has(kind.id));
  return { ...profile, kinds: [...own, ...ADDED_KINDS.map((kind) => ({ ...kind }))] };
}

// ---------------------------------------------------------------------------------------------------------------
// RULE-4: the checks.

const MIN_KINDS = 2;
const MAX_KINDS = 8;
const MAX_NOTE = 240;
const KIND_ID = /^[a-z][a-z0-9_]*$/;

export interface ProfileCheckFacts {
  /** The goal's week-12 target is a deliverable (MR-21). Unknown (undefined) skips that check. */
  deliverableGoal?: boolean;
}

function returnRuleFailures(rule: ReturnRule | undefined): string[] {
  if (!rule || typeof rule !== 'object' || !Array.isArray(rule.breaks)) return ['the return rule is missing.'];
  const reasons: string[] = [];
  const lengths = rule.breaks.map((item) => item?.length);
  const oneForAny = lengths.length === 1 && lengths[0] === 'any';
  const twoLengths = lengths.length === 2 && lengths[0] === '1-2 weeks' && lengths[1] === '3+ weeks';
  if (!oneForAny && !twoLengths) {
    reasons.push('the return rule needs one rule for "any" break, or "1-2 weeks" then "3+ weeks".');
  }
  for (const item of rule.breaks) {
    if (!item || !RESTARTS.includes(item.restart)) {
      reasons.push(`the return rule's restart must be one of: ${RESTARTS.join(', ')}.`);
      break;
    }
  }
  const note = typeof rule.firstWeekBack === 'string' ? rule.firstWeekBack.trim() : '';
  if (!note) reasons.push('the return rule needs a "first week back" note.');
  else if (note.length > MAX_NOTE) reasons.push(`the "first week back" note must be ${MAX_NOTE} characters or fewer.`);
  return reasons;
}

/** Every reason the profile fails RULE-4 (with RULE-5's two kinds expected); empty when it passes. */
export function profileFailures(profile: RecoveryProfile, facts: ProfileCheckFacts = {}): string[] {
  const reasons: string[] = [];
  const kinds = Array.isArray(profile?.kinds) ? profile.kinds : [];

  const seen = new Set<string>();
  for (const kind of kinds) {
    const id = typeof kind?.id === 'string' ? kind.id : '';
    if (!KIND_ID.test(id)) reasons.push(`kind id "${id}" must be snake_case.`);
    if (seen.has(id)) reasons.push(`kind id "${id}" is used twice.`);
    seen.add(id);
    if (typeof kind?.name !== 'string' || !kind.name.trim()) reasons.push(`kind "${id}" has no name.`);
    if (typeof kind?.description !== 'string' || !kind.description.trim()) reasons.push(`kind "${id}" has no description.`);
    if (!RECOVERY_ACTIONS.includes(kind?.action)) reasons.push(`kind "${id}" needs one action: ${RECOVERY_ACTIONS.join(', ')}.`);
    if (kind?.hard && kind.action === 'continue') reasons.push(`kind "${id}" is hard, so it cannot continue.`);
    if (kind?.highLoad === true && kind.hard !== true) reasons.push(`kind "${id}" is high-load, so it must be hard.`);
  }

  const catchAll = kinds.find((kind) => kind?.id === profile?.catchAll);
  if (!catchAll) reasons.push('the catch-all kind is missing.');
  else if (ADDED_IDS.has(catchAll.id)) reasons.push('the catch-all cannot be one of the kinds code adds.');

  const own = kinds.filter((kind) => kind && !ADDED_IDS.has(kind.id) && kind.id !== profile?.catchAll);
  if (own.length < MIN_KINDS || own.length > MAX_KINDS) {
    reasons.push(`a profile needs ${MIN_KINDS} to ${MAX_KINDS} kinds plus the catch-all; got ${own.length}.`);
  }

  for (const added of ADDED_KINDS) {
    const found = kinds.find((kind) => kind?.id === added.id);
    if (!found) reasons.push(`the "${added.name}" kind is missing.`);
    else if (found.action !== 'fixed') reasons.push(`the "${added.name}" kind must be fixed.`);
  }

  const gap = profile?.restGapDays;
  if (typeof gap !== 'number' || !Number.isInteger(gap) || gap < 0 || gap > 2) reasons.push('the rest gap must be 0, 1 or 2 days.');

  if (facts.deliverableGoal === true && catchAll && catchAll.action !== 'continue') {
    reasons.push('the week-12 target is a deliverable, so the catch-all must continue.');
  }

  reasons.push(...returnRuleFailures(profile?.returnRule));
  return reasons;
}

// ---------------------------------------------------------------------------------------------------------------
// MR-9: the checked reader.

/**
 * The profile stored under `recovery` in a goal's stored roadmap (`Goal.roadmap`), or null when it is missing,
 * malformed or fails the checks. Never throws. Null means RULE-18 for the whole goal (RULE-1).
 */
export function readRecoveryProfile(roadmap: unknown, facts: ProfileCheckFacts = {}): RecoveryProfile | null {
  try {
    if (!roadmap || typeof roadmap !== 'object') return null;
    const value = (roadmap as { recovery?: unknown }).recovery;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const profile = value as RecoveryProfile;
    if (profile.version !== 1 || !TEMPLATE_IDS.includes(profile.template)) return null;
    if (!Array.isArray(profile.kinds) || profile.kinds.some((kind) => !kind || typeof kind !== 'object')) return null;
    if (profileFailures(profile, facts).length > 0) return null;
    return profile;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// RULE-7, RULE-18, MR-11: a step's action.

/** The same test-step check `carryForward.ts` uses today: a stored test step is recognized by its title. */
const TEST_STEP = /^weekly test\b/i;

export type StepRecovery = { action: RecoveryAction; hard: boolean };

/**
 * The action of a step and whether it is hard, or null (RULE-18: today's rules) when there is no profile, the step
 * has no kind, or its kind is not in the profile. The test step is always fixed. A `highLoad` step is always hard,
 * and one whose action would be continue moves instead (MR-11).
 */
export function actionOf(
  step: Pick<DetailedStep, 'title' | 'highLoad' | 'kind'> | null | undefined,
  profile: RecoveryProfile | null | undefined
): StepRecovery | null {
  if (!step || !profile || !Array.isArray(profile.kinds)) return null;
  const highLoad = step.highLoad === true;
  const isTest = step.kind === WEEKLY_TEST_KIND.id || TEST_STEP.test(typeof step.title === 'string' ? step.title : '');
  if (isTest) return { action: 'fixed', hard: highLoad };
  if (typeof step.kind !== 'string' || !step.kind) return null;
  const kind = profile.kinds.find((item) => item.id === step.kind);
  if (!kind) return null;
  const hard = kind.hard === true || highLoad;
  const action: RecoveryAction = highLoad && kind.action === 'continue' ? 'move' : kind.action;
  return { action, hard };
}
