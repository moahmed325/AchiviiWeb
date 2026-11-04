/**
 * Method-aware recovery, M1.3b: the profile call (RULE-3, RULE-4, MR-4). One model call adapts the closest of the
 * 13 templates to a custom goal; code checks the answer with `profileFailures` (no weekly targets since 2026-10-30, so
 * the deliverable fact, MR-22, is no longer known and its check is skipped), retries once with the reasons, and otherwise falls back to the template the model picked, unchanged, or
 * the keyword template (MR-14). A half-made profile is never returned. RULE-5's two kinds are added by code.
 * Off unless `CUSTOM_RECOVERY_PROFILES_ENABLED` is exactly 'true' (03-phases section 3, O1); M2.2 scores it.
 */
import { generateWithOneRetry } from '../ai/retry.js';
import { flagOn } from '../flags.js';
import { formatAnswerLines, type Measure, type PlanAnswer, type RoadmapPhase } from '../ai/roadmap.js';
import { pickTemplate } from './pickTemplate.js';
import {
  FIXED_TIME_KIND,
  profileFailures,
  RECOVERY_ACTIONS,
  RESTARTS,
  TEMPLATE_IDS,
  WEEKLY_TEST_KIND,
  withFixedKinds,
  type BreakLength,
  type RecoveryKind,
  type RecoveryProfile,
  type ReturnRule,
  type TemplateId,
} from './profile.js';
import { RECOVERY_TEMPLATES, templateProfile } from './templates.js';

/** O1: the profile call runs only when this is exactly 'true'. Read per request. Never set from code or tests. */
export function customProfilesEnabled(): boolean {
  return flagOn('CUSTOM_RECOVERY_PROFILES_ENABLED');
}

export interface ProfileCallInput {
  goalText: string;
  /** Clarify's free-text domain, when there is one. */
  domain?: string | null;
  answers: PlanAnswer[];
  method: { name: string; summary: string; rules: string[] };
  phases: Array<Pick<RoadmapPhase, 'name' | 'purpose' | 'startWeek' | 'endWeek'>>;
  /** Each week's focus, week 1 first. */
  weeklyFocus: string[];
  /** What the goal is measured in, when it is a number; null for a skill, habit or thing made. */
  measure: Measure | null;
}

export type ProfileCallSource = 'model' | 'picked_template' | 'keyword_template';

export interface ProfileCallResult {
  /** Always a checked profile. */
  profile: RecoveryProfile;
  /** `model` when the call's answer passed; otherwise which fallback was used. */
  source: ProfileCallSource;
  /** The template the model picked, when it named a valid one (for M2.2's scoring). */
  pickedTemplate: TemplateId | null;
}

const SYSTEM = `You describe how a person's practice plan should recover when a day doesn't happen. You do not decide
anything about a single day: you only write the goal's recovery profile, its kinds of step and what each kind does.
Respond with one JSON object that matches the schema.`;

const ADDED_IDS = new Set([WEEKLY_TEST_KIND.id, FIXED_TIME_KIND.id]);
const ADDED_NAMES = new Set([WEEKLY_TEST_KIND.name.toLowerCase(), FIXED_TIME_KIND.name.toLowerCase()]);
const BREAK_LENGTHS: readonly BreakLength[] = ['any', '1-2 weeks', '3+ weeks'];

export const PROFILE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    template: { type: 'string', enum: [...TEMPLATE_IDS] },
    kinds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          action: { type: 'string', enum: [...RECOVERY_ACTIONS] },
          hard: { type: 'boolean' },
          inOrder: { type: 'boolean' },
          highLoad: { type: 'boolean' },
          why: { type: 'string' },
        },
        required: ['id', 'name', 'description', 'action', 'hard', 'inOrder', 'highLoad', 'why'],
      },
    },
    catchAll: { type: 'string' },
    restGapDays: { type: 'integer' },
    returnRule: {
      type: 'object',
      properties: {
        breaks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              length: { type: 'string', enum: [...BREAK_LENGTHS] },
              restart: { type: 'string', enum: [...RESTARTS] },
            },
            required: ['length', 'restart'],
          },
        },
        firstWeekBack: { type: 'string' },
      },
      required: ['breaks', 'firstWeekBack'],
    },
  },
  required: ['template', 'kinds', 'catchAll', 'restGapDays', 'returnRule'],
};

const ACTION_WORDS: Record<string, string> = {
  move: 'move (goes to the first later day that fits)',
  continue: 'continue (the next session of that kind picks up where this one stopped)',
  let_go: 'let_go (not made up)',
  fixed: 'fixed (never moved or swapped)',
  restart: 'restart (a timed process: the next session of that kind starts it again from its first step)',
};

/** One template as the model sees it: its kinds with action and flags, rest gap and return rule. */
export function describeTemplate(id: TemplateId): string {
  const template = RECOVERY_TEMPLATES[id];
  const kinds = template.kinds
    .filter((kind) => !ADDED_IDS.has(kind.id))
    .map((kind) => {
      const flags = [kind.hard ? 'hard' : '', kind.inOrder ? 'in order' : '', kind.id === template.catchAll ? 'catch-all' : '']
        .filter(Boolean)
        .join(', ');
      return `  - ${kind.id} "${kind.name}": ${kind.action}${flags ? ` (${flags})` : ''}. ${kind.description}`;
    })
    .join('\n');
  const breaks = template.returnRule.breaks.map((item) => `${item.length}: ${item.restart}`).join('; ');
  return `${id}\n${kinds}\n  Rest gap: ${template.restGapDays} day(s). Return: ${breaks}. First week back: ${template.returnRule.firstWeekBack}`;
}

export function buildProfilePrompt(input: ProfileCallInput): string {
  const phases = input.phases.map((phase) => `- ${phase.name} (weeks ${phase.startWeek}-${phase.endWeek}): ${phase.purpose}`).join('\n');
  const weeks = input.weeklyFocus.map((focus, index) => `- Week ${index + 1}: ${focus}`).join('\n');
  const measure = input.measure ? `${input.measure.metric} (${input.measure.unit})` : 'not a number (a skill, habit or thing made)';
  return `THE GOAL
${input.goalText}${input.domain ? `\nDomain: ${input.domain}` : ''}
Their answers:
${formatAnswerLines(input.answers)}

THE METHOD
${input.method.name}: ${input.method.summary}
Rules:
${input.method.rules.map((rule) => `- ${rule}`).join('\n')}

Phases:
${phases || '- (none)'}

Each week's focus:
${weeks || '- (none)'}

The goal is measured in: ${measure}

THE ACTIONS
${Object.values(ACTION_WORDS).map((line) => `- ${line}`).join('\n')}
A "hard" kind needs a rest gap around it (the rest gap is the number of full days, 0 to 2, between two hard steps).
An "in order" kind's steps must stay in the order they were written.

THE 13 TEMPLATES
${TEMPLATE_IDS.map(describeTemplate).join('\n\n')}

WRITE THE PROFILE
1. "template": the id of the template closest to this goal and method. Use "general" only when none fits.
2. Start from that template and adjust it so it matches what this method really does when a day doesn't happen.
   You may add or remove kinds, and change actions, flags, the rest gap and the return rule.
   Keep the template's kind ids: a kind that does the same job as one of the template's kinds keeps that kind's
   "id" exactly (its "name" and "description" may be adjusted to this goal). Only a new kind, whose job none of the
   template's kinds does, gets a new id. A template kind this method does not need is simply left out.
3. Rules every profile must follow:
   - "kinds": 2 to 8 kinds plus one catch-all kind. Each has a snake_case "id", a short "name", a one-sentence
     "description" of what the step looks like, one "action" (move, continue, let_go, fixed or restart), and "hard",
     "inOrder" and "highLoad" true or false.
   - Each kind's "why": one short sentence naming the method rule or reason behind its action, from THE METHOD above
     where it says (e.g. "The method makes the long run the week's key session, so a missed one is made up."). Write
     the reason for this goal; never copy a template's reason without checking it holds for this method.
   - "highLoad" is true only for physical strain (running, lifting, high-intensity or impact work); a highLoad kind
     must be hard.
   - A hard kind never continues or restarts.
   - "catchAll": the id of the catch-all kind, for work that fits no other kind. When the goal is to make or finish one
     thing (a portfolio, an app, a draft), the catch-all's action should be continue.
   - "restGapDays": 0, 1 or 2.
   - "returnRule": either one break for "any" length, or "1-2 weeks" then "3+ weeks"; each restarts at "last level",
     "back 1 week" or "back 2 weeks"; "firstWeekBack" is one short sentence for the first week after a break.
   - Do not write a "Weekly test" or "Fixed-time session" kind: they are added for you.`;
}

interface RawKind {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  action?: unknown;
  hard?: unknown;
  inOrder?: unknown;
  highLoad?: unknown;
  why?: unknown;
}

/** The longest "why" kept; a longer one is dropped rather than cut mid-sentence. */
export const MAX_WHY = 240;

export interface RawProfileAnswer {
  template?: unknown;
  kinds?: unknown;
  catchAll?: unknown;
  restGapDays?: unknown;
  returnRule?: { breaks?: unknown; firstWeekBack?: unknown } | null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && (TEMPLATE_IDS as readonly string[]).includes(value);
}

/** A kind the model wrote that code adds itself (RULE-5), by id or by name. */
function isAddedKind(raw: RawKind): boolean {
  return ADDED_IDS.has(text(raw.id)) || ADDED_NAMES.has(text(raw.name).toLowerCase());
}

/**
 * RULE-3, MR-25 (soft): a reason when none of the answer's kind ids is one of the chosen template's own kind ids,
 * which means the model renamed every kind. Null when at least one id is kept. The catch-all is left out of the
 * comparison: every template has `catch_all`, so keeping it says nothing about the template's own kinds.
 */
export function templateIdReason(template: TemplateId, kinds: Array<Pick<RecoveryKind, 'id'>>): string | null {
  const own = RECOVERY_TEMPLATES[template];
  const templateIds = own.kinds.map((kind) => kind.id).filter((id) => !ADDED_IDS.has(id) && id !== own.catchAll);
  if (kinds.some((kind) => templateIds.includes(kind.id))) return null;
  return `No kind keeps an id of the "${template}" template (${templateIds.join(', ')}). A kind that does the same job as a template kind keeps that kind's id; only a new kind gets a new id.`;
}

/**
 * Turns the model's answer into a profile and checks it (RULE-4, with the deliverable fact, MR-22). Kinds the
 * model wrote for Weekly test or Fixed-time session are dropped; code adds both (RULE-5). The template-id reason
 * (RULE-3) is soft: it gives way on the last attempt; the RULE-4 reasons never do.
 */
export function checkProfileAnswer(
  data: RawProfileAnswer,
  facts: { deliverableGoal?: boolean } = {},
  lastAttempt = false
): { value: RecoveryProfile } | { reason: string } {
  if (!isTemplateId(data.template)) return { reason: `"template" must be one of: ${TEMPLATE_IDS.join(', ')}.` };
  const rawKinds = Array.isArray(data.kinds) ? (data.kinds as RawKind[]) : [];
  const kinds: RecoveryKind[] = rawKinds
    .filter((raw) => raw && typeof raw === 'object' && !isAddedKind(raw))
    .map((raw) => ({
      id: text(raw.id),
      name: text(raw.name),
      description: text(raw.description),
      action: text(raw.action) as RecoveryKind['action'],
      hard: raw.hard === true,
      inOrder: raw.inOrder === true,
      ...(raw.highLoad === true ? { highLoad: true } : {}),
      // Soft: a missing or too long "why" never fails the profile; it is just not kept.
      ...(text(raw.why) && text(raw.why).length <= MAX_WHY ? { why: text(raw.why) } : {}),
    }));
  const rawRule = data.returnRule && typeof data.returnRule === 'object' ? data.returnRule : {};
  const breaks = Array.isArray(rawRule.breaks) ? (rawRule.breaks as Array<{ length?: unknown; restart?: unknown }>) : [];
  const returnRule: ReturnRule = {
    breaks: breaks.map((item) => ({ length: text(item?.length) as BreakLength, restart: text(item?.restart) as ReturnRule['breaks'][number]['restart'] })),
    firstWeekBack: text(rawRule.firstWeekBack),
  };
  const restGap = typeof data.restGapDays === 'string' ? Number(data.restGapDays) : data.restGapDays;
  const profile = withFixedKinds({
    version: 1,
    template: data.template,
    kinds,
    catchAll: text(data.catchAll),
    restGapDays: typeof restGap === 'number' ? restGap : NaN,
    returnRule,
  });
  const reasons = profileFailures(profile, { deliverableGoal: facts.deliverableGoal });
  const idReason = lastAttempt ? null : templateIdReason(data.template, kinds);
  if (idReason) reasons.push(idReason);
  return reasons.length > 0 ? { reason: reasons.slice(0, 8).join(' ') } : { value: profile };
}

/**
 * How many rules of `profile` differ from `template`, the one it started from: each kind added or left out (by id),
 * each changed action, hard, in-order or high-load flag on a kind both have (the catch-all included), the rest gap, and
 * each break length whose restart changed or that only one of them has. Names, descriptions, "why" lines and the
 * "first week back" note are wording, not rules, and don't count. The two kinds code adds are left out. 0 means the
 * template was copied. Pure.
 */
export function templateChanges(profile: RecoveryProfile, template: RecoveryProfile): number {
  const own = (p: RecoveryProfile) => new Map(p.kinds.filter((kind) => !ADDED_IDS.has(kind.id)).map((kind) => [kind.id, kind]));
  const mine = own(profile);
  const theirs = own(template);
  let changes = 0;
  for (const [id, kind] of mine) {
    const was = theirs.get(id);
    if (!was) {
      changes++;
      continue;
    }
    if (kind.action !== was.action) changes++;
    if (kind.hard !== was.hard) changes++;
    if (kind.inOrder !== was.inOrder) changes++;
    if ((kind.highLoad === true) !== (was.highLoad === true)) changes++;
  }
  for (const id of theirs.keys()) if (!mine.has(id)) changes++;
  if (profile.restGapDays !== template.restGapDays) changes++;
  const restarts = (p: RecoveryProfile) => new Map((p.returnRule?.breaks ?? []).map((item) => [item.length, item.restart]));
  const myBreaks = restarts(profile);
  const theirBreaks = restarts(template);
  for (const length of new Set([...myBreaks.keys(), ...theirBreaks.keys()])) {
    if (myBreaks.get(length) !== theirBreaks.get(length)) changes++;
  }
  return changes;
}

/** The profile call. Never throws; always returns a checked profile and where it came from. */
export async function generateRecoveryProfile(input: ProfileCallInput): Promise<ProfileCallResult> {
  let pickedTemplate: TemplateId | null = null;
  try {
    const profile = await generateWithOneRetry<RawProfileAnswer, RecoveryProfile>(
      buildProfilePrompt(input),
      SYSTEM,
      PROFILE_RESPONSE_SCHEMA,
      (data, lastAttempt) => {
        if (isTemplateId(data?.template)) pickedTemplate = data.template;
        return checkProfileAnswer(data ?? {}, {}, lastAttempt);
      },
      'Recovery profile'
    );
    if (profile) {
      const changes = templateChanges(profile, RECOVERY_TEMPLATES[profile.template]);
      return { profile: { ...profile, templateChanges: changes }, source: 'model', pickedTemplate };
    }
  } catch (err) {
    console.warn('[Recovery] Profile call failed:', err);
  }
  // Fallbacks are templates unchanged, checked by hand (MR-22).
  if (pickedTemplate) return { profile: templateProfile(pickedTemplate), source: 'picked_template', pickedTemplate };
  const keyword = pickTemplate({ domain: input.domain, goalText: input.goalText, methodName: input.method.name });
  return { profile: templateProfile(keyword), source: 'keyword_template', pickedTemplate: null };
}
