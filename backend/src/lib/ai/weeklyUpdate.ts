/**
 * Weekly update M3.1 (docs/features/weekly-update, RULE-1 to RULE-4, RULE-7, WU-11, WU-15, WU-20 (3), WU-45): prompt 4,
 * trimmed. One model call after a week closes by review sets the status and the targets of the weeks left; code checks
 * the answer (RULE-4) and gives one retry with the reasons. No checkpoint offer (WU-2) and no `retestFirst` (WU-45 (5)).
 * Everything here is pure apart from the model call in `askWeeklyUpdate`; reading the goal and keeping the targets safe
 * (RULE-10) is `weekClose/update.ts`'s.
 */
import { generateStructuredContent } from './gemini.js';
import { formatAmount, formatTarget, TOTAL_WEEKS, type WeekTarget } from './roadmap.js';
import { harder } from '../safety/targetSteps.js';

export const UPDATE_STATUSES = ['on_track', 'a_bit_behind', 'far_behind'] as const;
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

export interface UpdateWeekLeft {
  weekNumber: number;
  /** The target as currently planned (`safeGoalTargets`, as `writeNextWeek` reads it). */
  target: WeekTarget;
  /** The stored test is a light test (WU-43): the week shows its next big week's target. */
  light: boolean;
}

export interface UpdateHistoryWeek {
  weekNumber: number;
  target: WeekTarget;
  light: boolean;
  result: string;
  /** From the week's `WeeklyReview` row: "4 of 5", or "not recorded". */
  sessions: string;
  status: string | null;
}

/** WU-11: an in-order kind the person has steps of still to do, from the finished week's handoff. */
export interface UpdateKind {
  /** The kind's profile `name`, in lower case (RULE-7). */
  name: string;
  /** The first step not done yet. */
  position: string;
  stepsBehind: number;
  /** Sessions of the kind in the finished week (days holding a step of the kind, as written; not the test day). */
  sessions: number;
  /** Steps behind at least the kind's sessions and at least 2 (WU-11). */
  weekBehind: boolean;
}

export interface UpdateCounts {
  practiceDone: number;
  practicePlanned: number;
  /** `weekCounts`' detail; null when reconcile could not count the week (then the prompt says "not counted"). */
  detail: {
    keyDone: number;
    keySkipped: number;
    keySkippedNames: string[];
    doneByMinimum: number;
    missed: number;
    dropped: number;
  } | null;
}

export interface WeeklyUpdateInput {
  finalGoal: string;
  method: { name: string; creator?: string | null; rules: string[] };
  weekNumber: number;
  /** This week's target as the week shows it (on a light week, its next big week's target). */
  target: WeekTarget;
  /** This week's test is a light test: its result is done plus a note, never a number (WU-43 (2)). */
  lightTest: boolean;
  /** A goal with light weekly tests: the model sets only the big weeks left (WU-45 (2)). */
  lightTestGoal: boolean;
  /** The result line: logged, light test done, or not logged. */
  result: string;
  testLogged: boolean;
  /** RULE-4: the last usable result (on a light-test goal the last big-test result); null: no bound. Capped at week 12 (WU-46 (2)). */
  lowerBound: number | null;
  counts: UpdateCounts;
  reflection: string;
  /** Up to 3 closed weeks before this one, oldest first. */
  history: UpdateHistoryWeek[];
  /** Every week after this one, in order, with its current target. */
  weeksLeft: UpdateWeekLeft[];
  /** WU-45 (3): the most the first week the model sets may rise to (`nextSafeStep`); null for a target with no family. */
  safeMax: { weekNumber: number; value: number } | null;
  /** WU-11: only with `METHOD_RECOVERY_ENABLED` on, and only kinds with steps still to do. */
  kinds?: UpdateKind[];
}

export interface CheckedUpdate {
  status: UpdateStatus;
  /** One per week left, in order; a light week holds its next big week's target (filled by code). */
  targets: Array<{ weekNumber: number; target: WeekTarget }>;
  messageToUser: string;
  guidanceForNextWeek: string;
}

interface RawTarget {
  weekNumber?: unknown;
  kind?: unknown;
  metric?: unknown;
  value?: unknown;
  unit?: unknown;
  description?: unknown;
}

export interface RawWeeklyUpdate {
  status?: unknown;
  nextTargets?: unknown;
  messageToUser?: unknown;
  guidanceForNextWeek?: unknown;
}

export const WEEKLY_UPDATE_SYSTEM = `You review one week of a person's 90-day plan and set the targets for the weeks that are left. You do not write
daily tasks. Respond with one JSON object that matches the schema.`;

export const WEEKLY_UPDATE_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: [...UPDATE_STATUSES] },
    nextTargets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          weekNumber: { type: 'integer' },
          kind: { type: 'string', enum: ['number', 'deliverable'] },
          metric: { type: 'string' },
          value: { type: 'number' },
          unit: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['weekNumber', 'kind'],
      },
    },
    messageToUser: { type: 'string' },
    guidanceForNextWeek: { type: 'string' },
  },
  required: ['status', 'nextTargets', 'messageToUser', 'guidanceForNextWeek'],
};

/** The weeks the model sets: every week left, or on a light-test goal only the big weeks left (WU-45 (2)). */
export function askedWeeks(input: Pick<WeeklyUpdateInput, 'lightTestGoal' | 'weeksLeft'>): UpdateWeekLeft[] {
  return input.lightTestGoal ? input.weeksLeft.filter((week) => !week.light) : input.weeksLeft;
}

/** The week the next week shows: a light week shows its next big week's target. */
function bigWeekFor(weekNumber: number, weeksLeft: readonly UpdateWeekLeft[]): number {
  return weeksLeft.find((week) => week.weekNumber >= weekNumber && !week.light)?.weekNumber ?? TOTAL_WEEKS;
}

/**
 * WU-47 (amends WU-15): next week shows week 12's target: it is week 12, or a light week whose next check is week 12 (on
 * a light-test goal, the close of week 8). No hold applies then.
 */
function nextWeekIsLast(input: Pick<WeeklyUpdateInput, 'weekNumber' | 'weeksLeft'>): boolean {
  return input.weekNumber + 1 >= TOTAL_WEEKS || bigWeekFor(input.weekNumber + 1, input.weeksLeft) === TOTAL_WEEKS;
}

/** RULE-4 and WU-11: the holds on next week's target, none when next week shows week 12's target (WU-15, WU-47). */
export function holdsOf(input: Pick<WeeklyUpdateInput, 'weekNumber' | 'weeksLeft' | 'testLogged' | 'kinds'>): { notLogged: boolean; weekBehind: UpdateKind[] } {
  if (nextWeekIsLast(input)) return { notLogged: false, weekBehind: [] };
  return { notLogged: !input.testLogged, weekBehind: (input.kinds ?? []).filter((kind) => kind.weekBehind) };
}

const amount = (target: WeekTarget, value: number) => (target.kind === 'number' ? formatAmount(value, target.unit) : String(value));

function targetLine(week: UpdateWeekLeft, weeksLeft: readonly UpdateWeekLeft[]): string {
  if (week.light) return `- Week ${week.weekNumber}: light test week; shows week ${bigWeekFor(week.weekNumber, weeksLeft)}'s target (code fills it in)`;
  return `- Week ${week.weekNumber}: ${formatTarget(week.target)}`;
}

function historyLine(week: UpdateHistoryWeek): string {
  const target = week.light ? `next check ${formatTarget(week.target)}` : `target ${formatTarget(week.target)}`;
  return `- Week ${week.weekNumber}: ${target}; result: ${week.result}; sessions done: ${week.sessions}; status: ${week.status ?? 'none'}`;
}

function countLines(counts: UpdateCounts): string[] {
  const detail = counts.detail;
  if (!detail) {
    return [`Sessions done: ${counts.practiceDone} of ${counts.practicePlanned}. Key sessions, 10-minute versions, missed and dropped days: not counted.`];
  }
  return [
    `Sessions done: ${counts.practiceDone} of ${counts.practicePlanned}. Key sessions: ${detail.keyDone} done, ${detail.keySkipped} skipped${
      detail.keySkippedNames.length ? ` (${detail.keySkippedNames.join('; ')})` : ''
    }. A key session done only as the 10-minute version counts as skipped.`,
    `10-minute versions used: ${detail.doneByMinimum}. Missed days: ${detail.missed}. Dropped days: ${detail.dropped}.`,
  ];
}

/**
 * WU-46 (2): the lower bound never goes above week 12's current target; null without a result or without a number
 * week 12. WU-46 (1) is `checkWeeklyUpdate`'s: a held next week may be below it.
 */
export function boundOf(input: Pick<WeeklyUpdateInput, 'lowerBound' | 'weeksLeft' | 'target'>): number | null {
  const week12 = input.weeksLeft.find((week) => week.weekNumber === TOTAL_WEEKS)?.target;
  if (input.lowerBound === null || input.target.kind !== 'number' || week12?.kind !== 'number') return input.lowerBound;
  return harder(input.lowerBound, week12.value, input.target.direction) ? week12.value : input.lowerBound;
}

/** WU-46 (1): a hold on next week (none before week 12, WU-15). */
function nextWeekHeld(input: WeeklyUpdateInput, status: string | undefined): boolean {
  const holds = holdsOf(input);
  return (status === 'far_behind' && !nextWeekIsLast(input)) || holds.notLogged || holds.weekBehind.length > 0;
}

function kindLine(kind: UpdateKind): string {
  const behind = kind.weekBehind ? '; a week behind' : '';
  return `- ${kind.name}: at "${kind.position}", ${kind.stepsBehind} step${kind.stepsBehind === 1 ? '' : 's'} still to do (${kind.sessions} session${kind.sessions === 1 ? '' : 's'} of it this week)${behind}`;
}

export function buildWeeklyUpdatePrompt(input: WeeklyUpdateInput): string {
  const method = input.method.creator ? `${input.method.name} by ${input.method.creator}` : input.method.name;
  const asked = askedWeeks(input);
  const askedList = asked.map((week) => week.weekNumber).join(', ');
  const week12 = input.weeksLeft.find((week) => week.weekNumber === TOTAL_WEEKS)?.target;
  const counts = input.counts;
  const holds = holdsOf(input);
  const nextWeek = input.weekNumber + 1;
  const lines: string[] = [
    'THE PLAN',
    `Goal: ${input.finalGoal}`,
    `Method: ${method}. Rules: ${input.method.rules.join('; ')}`,
    'Weeks left, as currently planned:',
    ...input.weeksLeft.map((week) => targetLine(week, input.weeksLeft)),
  ];
  if (input.lightTestGoal) {
    lines.push(`Only weeks ${askedList} have the big test that measures the target. Each other week shows its next big week's target; code fills those in.`);
  }
  lines.push(
    '',
    `THIS WEEK (week ${input.weekNumber})`,
    input.lightTest ? `Next check: ${formatTarget(input.target)}. This week's test was the light test, not a check of the target.` : `Target: ${formatTarget(input.target)}`,
    `Test result: ${input.result}`,
    ...countLines(counts),
    `Their note: ${input.reflection.trim() ? `"${input.reflection.trim()}"` : 'none'}`
  );
  if (input.kinds?.length) {
    lines.push('', 'WHERE THEY ARE in each in-order kind of step (the first step not done yet):', ...input.kinds.map(kindLine));
  }
  lines.push('', 'LAST 3 WEEKS', ...(input.history.length ? input.history.map(historyLine) : ['none: this is their first week']));
  if (input.safeMax) {
    lines.push('', 'SAFETY', `- The most week ${input.safeMax.weekNumber} may be: ${amount(input.target, input.safeMax.value)} (one safe step). Code lowers anything past it.`);
  }

  const targetRules = [
    '   - on_track: keep the plan. Raise it only if they clearly beat the target, never above week 12\'s target before week 12.',
    '   - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.',
  ];
  if (nextWeekIsLast(input)) {
    targetRules.push(`   - Week ${nextWeek} shows week 12's target: it keeps the goal whatever the status, and the message says the final week aims at the goal.`);
  } else {
    targetRules.push(`   - far_behind: week ${nextWeek}'s target equals this week's target.`);
    if (holds.notLogged) targetRules.push(`   - The test was not logged: week ${nextWeek}'s target must not be higher than this week's.`);
    if (holds.weekBehind.length) {
      targetRules.push(
        `   - They are a week behind in ${holds.weekBehind.map((kind) => kind.name).join(', ')}: week ${nextWeek}'s target must not be higher than this week's, and the message says so, naming it ("...so you can catch up on ${holds.weekBehind[0].name}").`
      );
    }
  }
  const bound = boundOf(input);
  // WU-46 (1): the bound is said only for the weeks it binds; a held next week may stay at this week's target.
  const heldBelow = bound !== null && input.target.kind === 'number' && !nextWeekIsLast(input) && harder(bound, input.target.value, input.target.direction);
  targetRules.push(
    bound === null
      ? '   - No target goes backwards: each week is at least as hard as the week before it.'
      : `   - Never set a target easier than what they last achieved (${amount(input.target, bound)}), and no week easier than the week before it.${
          heldBelow ? ` A held week ${nextWeek} may stay at this week's target instead.` : ''
        }`,
    `   - Week 12 stays exactly ${week12 ? formatTarget(week12) : 'the goal'}.`,
    '   - Keep each week\'s kind, metric and unit as planned.'
  );
  lines.push(
    '',
    'DECIDE',
    '1. status:',
    '   - on_track: they hit the target',
    '   - a_bit_behind: they missed it but did 50%+ of sessions',
    '   - far_behind: they did under 50%, or skipped the key sessions',
    '   Weigh the trend. One bad week after good ones is not the same as three weeks declining.',
    `2. nextTargets: one target for each of weeks ${askedList}, in order: { weekNumber, kind: "number", metric, value, unit } or { weekNumber, kind: "deliverable", description }.`,
    ...targetRules,
    '3. messageToUser: one sentence, neutral and encouraging. Say what happens next, and say plainly if next week\'s',
    '   target is held or lowered. Never ask a question. Never use the words "missed", "behind", "failed" or "fail".',
    '4. guidanceForNextWeek: 1-2 sentences for the person writing next week\'s tasks.'
  );
  return lines.join('\n');
}

/** Section 6's copy rules (RULE-7, WU-45 (6)): one line, no forbidden word, never a question. */
const FORBIDDEN_WORDS = /\b(?:miss(?:ed|es|ing)?|behind|fail(?:ed|s|ing|ure|ures)?)\b/i;

export function sentenceReason(sentence: string): string | null {
  if (!sentence) return '"messageToUser" is empty.';
  if (sentence.includes('?')) return '"messageToUser" asks a question; say what happens next instead.';
  const word = sentence.match(FORBIDDEN_WORDS)?.[0];
  if (word) return `"messageToUser" uses the word "${word}"; never "missed", "behind", "failed" or "fail".`;
  return null;
}

const EPSILON = 1e-9;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** The model's target for a week, read against the week's current target; a reason when the kind, metric or unit changed. */
function readTarget(raw: RawTarget, current: WeekTarget): { target: WeekTarget } | { reason: string } {
  const week = Number(raw.weekNumber);
  if (raw.kind !== current.kind) return { reason: `week ${week}'s kind changed to "${String(raw.kind)}"; keep "${current.kind}".` };
  if (current.kind === 'deliverable') {
    const description = text(raw.description);
    return description ? { target: { kind: 'deliverable', description } } : { reason: `week ${week}'s description is empty.` };
  }
  if (!same(text(raw.metric), current.metric)) return { reason: `week ${week}'s metric changed to "${text(raw.metric)}"; keep "${current.metric}".` };
  if (!same(text(raw.unit), current.unit)) return { reason: `week ${week}'s unit changed to "${text(raw.unit)}"; keep "${current.unit}".` };
  const value = typeof raw.value === 'number' ? raw.value : NaN;
  if (!Number.isFinite(value) || value < 0) return { reason: `week ${week}'s value is not a number.` };
  return { target: { ...current, value } };
}

/**
 * RULE-4, WU-11, WU-15, WU-20 (3), WU-45 (2), (4), (6). On a light-test goal code fills each light week with its next big
 * week's target before the checks. Every reason is returned, so the one retry can fix them all.
 */
export function checkWeeklyUpdate(raw: RawWeeklyUpdate, input: WeeklyUpdateInput): { value: CheckedUpdate } | { reasons: string[] } {
  const reasons: string[] = [];
  const status = UPDATE_STATUSES.find((item) => item === raw.status);
  if (!status) reasons.push(`"status" must be one of ${UPDATE_STATUSES.join(', ')}.`);

  const asked = askedWeeks(input);
  const list = Array.isArray(raw.nextTargets) ? (raw.nextTargets as RawTarget[]) : [];
  const numbers = list.map((item) => Number(item?.weekNumber));
  const expected = asked.map((week) => week.weekNumber);
  if (numbers.length !== expected.length || numbers.some((week, index) => week !== expected[index])) {
    reasons.push(`"nextTargets" must have exactly one target for each of weeks ${expected.join(', ')}, in order; got weeks ${numbers.join(', ') || 'none'}.`);
  }

  const set = new Map<number, WeekTarget>();
  list.forEach((item, index) => {
    const week = asked[index];
    if (!week || Number(item?.weekNumber) !== week.weekNumber) return;
    const read = readTarget(item, week.target);
    if ('reason' in read) reasons.push(read.reason);
    else set.set(week.weekNumber, read.target);
  });
  const message = text(raw.messageToUser);
  const sentence = sentenceReason(message);
  if (sentence) reasons.push(sentence);
  if (reasons.length > 0 || set.size !== asked.length) return { reasons: reasons.length ? reasons : ['"nextTargets" could not be read.'] };

  // WU-45 (2): each light week left holds its next big week's target.
  const targets = input.weeksLeft.map((week) => ({
    weekNumber: week.weekNumber,
    target: set.get(week.weekNumber) ?? set.get(bigWeekFor(week.weekNumber, input.weeksLeft)) ?? week.target,
  }));
  const week12Now = input.weeksLeft.find((week) => week.weekNumber === TOTAL_WEEKS)?.target;
  const week12 = targets.find((item) => item.weekNumber === TOTAL_WEEKS)?.target;
  const next = targets[0]?.target;
  const holds = holdsOf(input);
  const heldBy = [
    ...(status === 'far_behind' && !nextWeekIsLast(input) ? ['the status is far_behind'] : []),
    ...(holds.notLogged ? ['the test was not logged'] : []),
    ...(holds.weekBehind.length ? [`they are a week behind in ${holds.weekBehind.map((kind) => kind.name).join(', ')}`] : []),
  ];

  if (week12Now?.kind === 'deliverable' || input.target.kind === 'deliverable') {
    // WU-20 (3): words can't be compared for "lower" or "backwards"; a held week repeats this week's text exactly.
    if (week12Now?.kind === 'deliverable' && week12?.kind === 'deliverable' && week12.description !== week12Now.description) {
      reasons.push(`week 12 must stay exactly "${week12Now.description}".`);
    }
    if (heldBy.length && next?.kind === 'deliverable' && input.target.kind === 'deliverable' && next.description !== input.target.description) {
      reasons.push(`week ${input.weekNumber + 1} must repeat this week's target exactly ("${input.target.description}") because ${heldBy.join(' and ')}.`);
    }
  } else if (input.target.kind === 'number' && week12Now?.kind === 'number' && week12?.kind === 'number') {
    const direction = input.target.direction;
    const label = (value: number) => formatAmount(value, input.target.kind === 'number' ? input.target.unit : '');
    if (Math.abs(week12.value - week12Now.value) > EPSILON) reasons.push(`week 12 must stay exactly ${label(week12Now.value)}.`);
    const bound = boundOf(input);
    const held = nextWeekHeld(input, status);
    let before: number | null = null;
    for (const item of targets) {
      if (item.target.kind !== 'number') continue;
      const value = item.target.value;
      // WU-46 (1): a hold wins over the bound; a held next week may go as low as this week's target.
      const floor = bound !== null && held && item.weekNumber === input.weekNumber + 1 && harder(bound, input.target.value, direction) ? input.target.value : bound;
      if (floor !== null && harder(floor, value, direction)) {
        reasons.push(`week ${item.weekNumber}'s ${label(value)} is easier than what they last achieved (${label(floor)}).`);
      }
      if (before !== null && harder(before, value, direction)) reasons.push(`week ${item.weekNumber}'s ${label(value)} is easier than the week before it (${label(before)}).`);
      if (item.weekNumber < TOTAL_WEEKS && harder(value, week12Now.value, direction)) {
        reasons.push(`week ${item.weekNumber}'s ${label(value)} is harder than week 12's ${label(week12Now.value)}.`);
      }
      before = value;
    }
    if (next?.kind === 'number' && !nextWeekIsLast(input)) {
      const now = input.target.value;
      if (status === 'far_behind' && Math.abs(next.value - now) > EPSILON) {
        reasons.push(`the status is far_behind, so week ${input.weekNumber + 1}'s target must equal this week's (${label(now)}).`);
      }
      const raiseHolds = heldBy.filter((reason) => reason !== 'the status is far_behind');
      if (raiseHolds.length && harder(next.value, now, direction)) {
        reasons.push(`week ${input.weekNumber + 1}'s target must not be higher than this week's (${label(now)}) because ${raiseHolds.join(' and ')}.`);
      }
    }
  }
  if (reasons.length > 0 || !status) return { reasons };
  return { value: { status, targets, messageToUser: message, guidanceForNextWeek: text(raw.guidanceForNextWeek) } };
}

export interface WeeklyUpdateAnswer {
  outcome: 'accepted' | 'retry_accepted' | 'fallback';
  update: CheckedUpdate | null;
  /** Every reason an attempt was rejected for, or why it gave no answer. */
  reasons: string[];
}

/** One call, one retry with the reasons (RULE-4); a second rejection, or no answer, is the fallback. */
export async function askWeeklyUpdate(input: WeeklyUpdateInput): Promise<WeeklyUpdateAnswer> {
  const prompt = buildWeeklyUpdatePrompt(input);
  const reasons: string[] = [];
  let rejection = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt =
      attempt === 0 ? prompt : `${prompt}\n\nYOUR PREVIOUS ANSWER WAS REJECTED: ${rejection}\nReturn the complete JSON again with that problem fixed.`;
    const result = await generateStructuredContent<RawWeeklyUpdate>(attemptPrompt, WEEKLY_UPDATE_SYSTEM, undefined, {
      responseSchema: WEEKLY_UPDATE_SCHEMA,
      temperature: attempt === 0 ? 0 : 0.4,
    });
    if (!result.success || !result.data) {
      rejection = result.error || 'no answer';
      reasons.push('no_answer');
      continue;
    }
    const verdict = checkWeeklyUpdate(result.data, input);
    if ('value' in verdict) return { outcome: attempt === 0 ? 'accepted' : 'retry_accepted', update: verdict.value, reasons };
    rejection = verdict.reasons.join(' ');
    reasons.push(...verdict.reasons);
  }
  return { outcome: 'fallback', update: null, reasons };
}
