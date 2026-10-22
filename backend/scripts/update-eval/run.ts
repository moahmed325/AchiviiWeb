/**
 * Weekly update M3.2 (WU-21 (2)): the eval of the update call on hand-made closing weeks.
 * Not run in CI; every command but `score` makes live Gemini calls and needs GEMINI_API_KEY in backend/.env.
 *
 *   npx tsx scripts/update-eval/run.ts roadmaps [--only id,id]   live roadmaps -> roadmaps.json
 *   npx tsx scripts/update-eval/run.ts weeks [--only id,id]      each case's closing week, written live -> weeks.json
 *   npx tsx scripts/update-eval/run.ts update --run 1 [--only id,id]   the real planWeeklyUpdate -> run-1.json
 *   npx tsx scripts/update-eval/run.ts update --dry                 same path, no model call (key blanked) -> run-dry.json
 *   npx tsx scripts/update-eval/run.ts score                     no model calls -> score.json
 *
 * The order is the milestone's: goals and roadmaps, the cases and their weeks, the expected answers (expected.json),
 * then the runs. The script never sets WEEK_CLOSE_ENABLED or WEEKLY_UPDATE_ENABLED: `update` refuses to run unless the
 * shell that runs it set both to `true`. It sets METHOD_RECOVERY_ENABLED per case, only inside its own process.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { EVAL_DIR, goalSetProblems, loadGoals, readJson, writeJson, type EvalGoal } from './goals.js';
import {
  closeNow,
  dayRows,
  goalRow,
  reviewRows,
  roadmapRows,
  ROUTINE,
  standIn,
  TIMEZONE,
  USER_ID,
  type EvalCase,
  type RoadmapEntry,
  type StandInCall,
  type WeekEntry,
} from './cases.js';

dotenv.config({ path: path.join(EVAL_DIR, '../../.env') });

const command = process.argv[2];
const flag = (name: string) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? (process.argv[index + 1] ?? '') : '';
};
const only = flag('--only').split(',').filter(Boolean);

const COMMANDS = ['roadmaps', 'weeks', 'update', 'score'];
if (!COMMANDS.includes(command)) {
  console.error(`Usage: npx tsx scripts/update-eval/run.ts ${COMMANDS.join(' | ')}`);
  process.exit(1);
}
// `update --dry`: the same path with the key blanked inside this process, so every model call misses and the update
// falls back; it checks the stand-in and the recording without spending a call (written to run-dry.json).
const dry = command === 'update' && process.argv.includes('--dry');
if (dry) delete process.env.GEMINI_API_KEY;
if (command !== 'score' && !dry && !process.env.GEMINI_API_KEY) {
  console.error('No GEMINI_API_KEY in backend/.env: this command makes live Gemini calls, so nothing was run.');
  process.exit(1);
}

function readOr<T>(name: string, fallback: T): T {
  try {
    return readJson<T>(name);
  } catch {
    return fallback;
  }
}

export const DAILY_MINUTES = 45;
export const PLAN_VARIANT = 'steady' as const;
/** One call, then up to 3 retries. */
const ROADMAP_CALLS = 4;

async function roadmaps(goals: EvalGoal[]): Promise<void> {
  const { generateRoadmap } = await import('../../src/lib/ai/roadmap.js');
  const { activeDaysFor } = await import('../../src/lib/ai/weekPlan.js');
  const { storedRoadmap } = await import('../../src/lib/planV2.js');
  const { makeGoalProfile } = await import('../../src/lib/recovery/forGoal.js');
  const { findPresetForGoal } = await import('../../src/lib/ai/presets/index.js');
  const saved = readOr<RoadmapEntry[]>('roadmaps.json', []);
  for (const goal of goals) {
    if (only.length && !only.includes(goal.id)) continue;
    const failures: string[] = [];
    let entry: RoadmapEntry | null = null;
    for (let call = 1; call <= ROADMAP_CALLS && !entry; call++) {
      const result = await generateRoadmap({
        workingTitle: goal.workingTitle,
        domain: goal.domain,
        rawGoal: goal.rawGoal,
        dailyMinutes: DAILY_MINUTES,
        activeDays: activeDaysFor(PLAN_VARIANT),
        answers: goal.answers,
      });
      if (!result.ok) {
        failures.push(result.reason);
        continue;
      }
      const { roadmap } = result;
      // As goal create's `recoveryProfileAtCreate` with CUSTOM_RECOVERY_PROFILES_ENABLED off: the pathway's profile,
      // or the keyword template for a custom goal.
      const preset = findPresetForGoal(goal.rawGoal) || findPresetForGoal(goal.workingTitle);
      const made = makeGoalProfile({
        presetId: preset?.id,
        domain: goal.domain,
        goalText: `${goal.rawGoal} ${goal.workingTitle}`,
        methodName: roadmap.method?.name,
      });
      const recovery = 'profile' in made ? made.profile : null;
      entry = {
        goalId: goal.id,
        calls: call,
        failures,
        roadmap,
        stored: storedRoadmap(roadmap, goal.answers, recovery),
        weeks: roadmap.weeks.map((week) => ({ weekNumber: week.weekNumber, target: week.target, test: week.test, light: week.test?.light === true })),
        loweredAtCreate: roadmap.loweredTargets ?? [],
      };
    }
    if (!entry) {
      console.error(`${goal.id}: no roadmap after ${ROADMAP_CALLS} calls: ${failures.join(' | ')}. Swap this goal.`);
      continue;
    }
    const index = saved.findIndex((item) => item.goalId === goal.id);
    if (index >= 0) saved[index] = entry;
    else saved.push(entry);
    writeJson('roadmaps.json', saved);
    console.log(`${goal.id}: roadmap in ${entry.calls} call(s); ${entry.roadmap.method.name}; week 12 ${JSON.stringify(entry.weeks[11]?.target)}`);
  }
}

/** One HTTP call to the Gemini API: the prompt sent, the raw answer text, and the HTTP status. */
export interface ModelCall {
  prompt: string;
  answer: string | null;
  status: number;
  ms: number;
}

/**
 * Records every Gemini API call this process makes, by wrapping `fetch` (the SDK's transport); nothing under src/
 * changes. `take()` hands over the calls made since the last take.
 */
function recordModelCalls(): { take: () => ModelCall[]; total: () => number } {
  const original = globalThis.fetch;
  let calls: ModelCall[] = [];
  let total = 0;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes('generativelanguage')) return original(input, init);
    const started = Date.now();
    let prompt = '';
    try {
      const body = JSON.parse(String(init?.body ?? '{}'));
      prompt = (body.contents ?? []).flatMap((item: { parts?: Array<{ text?: string }> }) => (item.parts ?? []).map((part) => part.text ?? '')).join('\n');
    } catch {
      prompt = '(unreadable request body)';
    }
    const response = await original(input, init);
    let answer: string | null = null;
    try {
      const json = await response.clone().json();
      answer = json?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? null;
    } catch {
      answer = null;
    }
    total++;
    calls.push({ prompt, answer, status: response.status, ms: Date.now() - started });
    return response;
  }) as typeof fetch;
  return {
    take: () => {
      const taken = calls;
      calls = [];
      return taken;
    },
    total: () => total,
  };
}

const setMethodRecovery = (on: boolean) => {
  // Only inside this process, per case (the milestone allows this one switch, never the update's two).
  process.env.METHOD_RECOVERY_ENABLED = on ? 'true' : 'false';
};

function loadCases(): EvalCase[] {
  return readJson<EvalCase[]>('cases.json');
}

const entryFor = (entries: RoadmapEntry[], goalId: string) => {
  const entry = entries.find((item) => item.goalId === goalId);
  if (!entry) throw new Error(`No roadmap for ${goalId}: run the roadmaps step first.`);
  return entry;
};

/** Week calls per case: one, then up to 2 retries (the milestone's 3 tries). */
const WEEK_TRIES = 3;

async function weeks(goals: EvalGoal[]): Promise<void> {
  const recorder = recordModelCalls();
  const { writeNextWeek } = await import('../../src/lib/planV2.js');
  const { slotTimeFor } = await import('../../src/lib/ai/weekPlan.js');
  const entries = readJson<RoadmapEntry[]>('roadmaps.json');
  const saved = readOr<WeekEntry[]>('weeks.json', []);
  for (const c of loadCases()) {
    if (only.length && !only.includes(c.id)) continue;
    const entry = entryFor(entries, c.goalId);
    const rawGoal = goals.find((goal) => goal.id === c.goalId)!.rawGoal;
    setMethodRecovery(c.methodRecovery);
    // The closing week as the week writer writes it once the week before has closed; no rows of that week are passed.
    const goal = goalRow(entry, c, rawGoal, roadmapRows(entry, c), []);
    const started = Date.now();
    let days = null;
    let calls = 0;
    while (calls < WEEK_TRIES && !days) {
      calls++;
      days = await writeNextWeek(goal, c.week - 1, [], slotTimeFor(ROUTINE.preferredSlot), entry.stored.recovery ?? null);
    }
    recorder.take();
    if (!days) {
      console.error(`STOP: ${c.id}: week ${c.week} could not be written after ${WEEK_TRIES} tries.`);
      process.exit(2);
    }
    const item: WeekEntry = { caseId: c.id, calls, ms: Date.now() - started, days };
    const index = saved.findIndex((row) => row.caseId === c.id);
    if (index >= 0) saved[index] = item;
    else saved.push(item);
    writeJson('weeks.json', saved);
    const practice = days.filter((day) => !day.isRestDay).length;
    console.log(`${c.id}: week ${c.week} in ${calls} call(s), ${practice} practice days, test day ${days.find((day) => day.isTestDay)?.dayOfWeek ?? 'none'}`);
  }
  console.log(`Model calls this step: ${recorder.total()}`);
}

export interface CaseRun {
  caseId: string;
  ms: number;
  /** The `PlannedUpdate` as returned (without `weekBefore`, which is the stand-in's empty read). */
  update: Record<string, unknown> | null;
  /** Every Gemini call of this case, in order (a busy retry inside one attempt shows as its own call). */
  modelCalls: ModelCall[];
  /** The `[WeeklyUpdate]` line and the `[Safety]` lines, as printed. */
  logs: string[];
  standIn: StandInCall[];
  methodRecovery: boolean;
}

async function update(goals: EvalGoal[]): Promise<void> {
  if (process.env.WEEK_CLOSE_ENABLED !== 'true' || process.env.WEEKLY_UPDATE_ENABLED !== 'true') {
    console.error('The update step needs WEEK_CLOSE_ENABLED=true and WEEKLY_UPDATE_ENABLED=true set in the shell that runs it; this script never sets them. Nothing was run.');
    process.exit(1);
  }
  const run = Number(flag('--run'));
  if (!dry && (!Number.isInteger(run) || run < 1)) {
    console.error('Give the run number: update --run 1');
    process.exit(1);
  }
  // Before any src/ module loads: `lib/prisma.ts` takes `global.prisma` when it is set. One dispatcher, pointed at the
  // current case's stand-in.
  let current: { client: unknown; calls: StandInCall[] } | null = null;
  const dispatcher = new Proxy(
    {},
    {
      get(_target, model: string) {
        if (!current) throw new Error(`stand-in: prisma.${model} used outside a case`);
        return (current.client as Record<string, unknown>)[model];
      },
    }
  );
  (global as unknown as { prisma: unknown }).prisma = dispatcher;
  const recorder = recordModelCalls();
  const { planWeeklyUpdate, logUpdateLowered } = await import('../../src/lib/weekClose/update.js');

  const logs: string[] = [];
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const line = args.map((arg) => (typeof arg === 'string' ? arg : arg instanceof Error ? (arg.stack ?? arg.message) : JSON.stringify(arg))).join(' ');
      if (/^\[(WeeklyUpdate|Safety)\]/.test(line)) logs.push(line);
      original(...args);
    };
  }

  const entries = readJson<RoadmapEntry[]>('roadmaps.json');
  const weekEntries = readJson<WeekEntry[]>('weeks.json');
  const name = dry ? 'run-dry.json' : `run-${run}.json`;
  const results = readOr<CaseRun[]>(name, []);
  for (const c of loadCases()) {
    if (only.length && !only.includes(c.id)) continue;
    const entry = entryFor(entries, c.goalId);
    const week = weekEntries.find((item) => item.caseId === c.id);
    if (!week) throw new Error(`No week for ${c.id}: run the weeks step first.`);
    const rawGoal = goals.find((goal) => goal.id === c.goalId)!.rawGoal;
    setMethodRecovery(c.methodRecovery);
    const goal = goalRow(entry, c, rawGoal, roadmapRows(entry, c), dayRows(c, week.days));
    // The week before was not written for the eval: the stand-in answers its read with no rows.
    const caseStandIn = standIn(goal, reviewRows(c), []);
    current = caseStandIn;
    logs.length = 0;
    recorder.take();
    const started = Date.now();
    const planned = await planWeeklyUpdate(goal, c.week, { userId: USER_ID, reflection: c.reflection, now: closeNow(c.week), timezone: TIMEZONE });
    const ms = Date.now() - started;
    // As the review route does once the close is saved: the `[Safety]` `lowered_on_update` lines.
    logUpdateLowered(goal.id, planned);
    current = null;
    let kept: Record<string, unknown> | null = null;
    if (planned) {
      const { weekBefore: _weekBefore, ...rest } = planned;
      kept = rest;
    }
    const result: CaseRun = { caseId: c.id, ms, update: kept, modelCalls: recorder.take(), logs: [...logs], standIn: caseStandIn.calls, methodRecovery: c.methodRecovery };
    const index = results.findIndex((row) => row.caseId === c.id);
    if (index >= 0) results[index] = result;
    else results.push(result);
    writeJson(name, results);
    console.log(`${c.id}: ${planned?.outcome ?? 'did not run'} ${planned?.status ?? ''} in ${ms} ms`);
  }
  console.log(`Model calls this run: ${recorder.total()}`);
}

const RUNS = [1, 2];

async function score(goals: EvalGoal[]): Promise<void> {
  const { factsOf } = await import('./facts.js');
  const { scoreRun } = await import('./score.js');
  const { sentenceReason } = await import('../../src/lib/ai/weeklyUpdate.js');
  type Facts = Awaited<ReturnType<typeof factsOf>>;
  const entries = readJson<RoadmapEntry[]>('roadmaps.json');
  const weekEntries = readJson<WeekEntry[]>('weeks.json');
  const cases = loadCases();
  const expected = readJson<import('./score.js').Expected[]>('expected.json');
  const tags = readOr<import('./score.js').WordingTag[]>('wording-tags.json', []);
  const byRun = new Map<number, Facts[]>();
  for (const run of RUNS) {
    const recorded = readOr<import('./facts.js').RecordedCase[]>(`run-${run}.json`, []);
    byRun.set(
      run,
      recorded.map((item) => {
        const c = cases.find((row) => row.id === item.caseId)!;
        return factsOf(item, c, entryFor(entries, c.goalId), weekEntries.find((row) => row.caseId === c.id)!, goals.find((goal) => goal.id === c.goalId)!.rawGoal);
      })
    );
  }
  const scores: Record<string, unknown> = {};
  for (const run of RUNS) scores[`run-${run}`] = scoreRun(byRun.get(run)!, expected, tags.filter((tag) => tag.run === run), sentenceReason);
  scores.both = scoreRun([...byRun.values()].flat(), expected, tags, sentenceReason);
  writeJson('score.json', { scores, facts: Object.fromEntries([...byRun.entries()].map(([run, list]) => [`run-${run}`, list])) });

  for (const [name, value] of Object.entries(scores)) {
    const s = value as ReturnType<typeof scoreRun>;
    console.log(`\n== ${name} (${s.cases} cases)`);
    console.log(`outcomes: ${JSON.stringify(s.outcomes)}`);
    console.log(`reasons, first attempts: ${s.reasons.first.map((r) => `${r.key} ${r.count}`).join(', ') || 'none'}`);
    console.log(`reasons, retries: ${s.reasons.retry.map((r) => `${r.key} ${r.count}`).join(', ') || 'none'}`);
    console.log(`lowered: ${s.safety.loweredCases.map((r) => `${r.caseId} [${r.weeks.join(',')}]`).join('; ') || 'none'}`);
    console.log(`above safeMax: ${s.safety.aboveSafeMax.above} of ${s.safety.aboveSafeMax.answers} answers; climb breaks: ${JSON.stringify(s.safety.climbBreaks)}; week 12 not kept: ${s.safety.week12NotKept.join(', ') || 'none'}`);
    console.log(`sentence fails: ${JSON.stringify(s.wording.sentenceFails)}; status words: ${JSON.stringify(s.wording.statusWords)}`);
    console.log(`wording tags: ${s.wording.matchesTarget} of ${s.wording.tagged} match the target; week-behind holds ${s.wording.weekBehindHolds}, names the kind ${s.wording.namesKind}`);
    const a = s.agreement;
    console.log(`agreement of ${a.of}: status ${a.status}, direction ${a.direction}, holds ${a.holds}, lowering ${a.lowering}, week 12 ${a.week12}`);
    console.log(`disagreements: ${a.disagreements.map((d) => `${d.caseId} (${d.fields.join(',')})`).join('; ') || 'none'}`);
    console.log(`stand-in: detail null ${s.standIn.detailNull.length} ${s.standIn.detailNull.join(',')}; unanswered calls ${s.standIn.misses}`);
    console.log(`time: median ${s.time.medianMs} ms, slowest ${s.time.slowestMs} ms (${s.time.slowestCase}); retried ${s.time.retryCases}; retry share of time ${(100 * s.time.retryTimeShare).toFixed(1)}%`);
  }
}

async function main(): Promise<void> {
  const goals = loadGoals();
  const problems = goalSetProblems(goals);
  if (problems.length) {
    console.error(`The goal set is not right:\n${problems.join('\n')}`);
    process.exit(1);
  }
  if (command === 'roadmaps') await roadmaps(goals);
  if (command === 'weeks') await weeks(goals);
  if (command === 'update') await update(goals);
  if (command === 'score') await score(goals);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
