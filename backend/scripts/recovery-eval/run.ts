/**
 * Method-aware recovery M2.2 (RULE-19, MR-24): the eval of the profile call and the week call's tags.
 * Not run in CI; every command but `score` makes live Gemini calls and needs GEMINI_API_KEY in backend/.env.
 *
 *   npx tsx scripts/recovery-eval/run.ts roadmaps [--only id,id]   live roadmaps -> roadmaps.json
 *   npx tsx scripts/recovery-eval/run.ts profiles --run 1           the real profile call, timed -> profiles.run-1.json
 *   npx tsx scripts/recovery-eval/run.ts weeks                      week 1 for 6 goals -> weeks.json, weeks.model-tags.json
 *   npx tsx scripts/recovery-eval/run.ts score                      no model calls -> score.json
 *
 * Each command saves its raw results as JSON next to this script, so the review can re-score them without new calls.
 * The order is MR-24's: goals and roadmaps, then the hand-written answers (answers.json), then the profile runs.
 */
import dotenv from 'dotenv';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { EVAL_DIR, goalSetProblems, loadGoals, readJson, type EvalGoal } from './goals.js';
import type { Roadmap } from '../../src/lib/ai/roadmap.js';
import type { ProfileCallInput } from '../../src/lib/recovery/profileCall.js';
import type { RecoveryProfile } from '../../src/lib/recovery/index.js';
import { scoreRun, scoreTags, scoreTemplatePicks, THRESHOLDS, type EvalAnswer, type ProfileRunResult, type StepTag, type WeekStep } from './score.js';

dotenv.config({ path: path.join(EVAL_DIR, '../../.env') });

const command = process.argv[2];
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex > 0 ? (process.argv[onlyIndex + 1] ?? '').split(',').filter(Boolean) : [];

const COMMANDS = ['roadmaps', 'profiles', 'weeks', 'score'];
if (!COMMANDS.includes(command)) {
  console.error(`Usage: npx tsx scripts/recovery-eval/run.ts ${COMMANDS.join(' | ')}`);
  process.exit(1);
}
if (command !== 'score' && !process.env.GEMINI_API_KEY) {
  console.error('No GEMINI_API_KEY in backend/.env: this command makes live Gemini calls, so nothing was run.');
  process.exit(1);
}

function writeJson(name: string, value: unknown): void {
  writeFileSync(path.join(EVAL_DIR, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export interface RoadmapEntry {
  goalId: string;
  /** Roadmap calls made, including the one that passed. */
  calls: number;
  /** The reasons earlier calls failed. */
  failures: string[];
  /** What `generateRecoveryProfile` gets, built the way goal create builds it. */
  profileInput: ProfileCallInput;
  roadmap: Roadmap;
}

const DAILY_MINUTES = 30;
/** One call, then up to 3 retries (B-21). */
const ROADMAP_CALLS = 4;

async function roadmaps(goals: EvalGoal[]): Promise<void> {
  const { generateRoadmap } = await import('../../src/lib/ai/roadmap.js');
  const { activeDaysFor } = await import('../../src/lib/ai/weekPlan.js');
  let saved: RoadmapEntry[] = [];
  try {
    saved = readJson<RoadmapEntry[]>('roadmaps.json');
  } catch {
    saved = [];
  }
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
        activeDays: activeDaysFor('steady'),
        answers: goal.answers,
      });
      if (!result.ok) {
        failures.push(result.reason);
        continue;
      }
      const { roadmap } = result;
      const { method, phases, weeks } = roadmap;
      entry = {
        goalId: goal.id,
        calls: call,
        failures,
        profileInput: {
          goalText: `${goal.rawGoal} ${goal.workingTitle}`,
          domain: goal.domain,
          answers: goal.answers,
          method: { name: method.name, summary: method.summary, rules: method.rules },
          phases: phases.map(({ name, purpose, startWeek, endWeek }) => ({ name, purpose, startWeek, endWeek })),
          weeklyTargets: [...weeks].sort((a, b) => a.weekNumber - b.weekNumber).map((week) => week.target),
        },
        roadmap,
      };
    }
    console.log(`${goal.id}: ${entry ? `roadmap after ${entry.calls} call(s) (${entry.profileInput.method.name})` : `FAILED ${ROADMAP_CALLS} times: ${failures.join(' / ')}`}`);
    saved = saved.filter((item) => item.goalId !== goal.id);
    if (entry) saved.push(entry);
    const order = new Map(goals.map((item, index) => [item.id, index]));
    saved.sort((a, b) => (order.get(a.goalId) ?? 99) - (order.get(b.goalId) ?? 99));
    writeJson('roadmaps.json', saved);
  }
  const missing = goals.filter((goal) => !saved.some((item) => item.goalId === goal.id)).map((goal) => goal.id);
  console.log(`\nroadmaps.json: ${saved.length} of ${goals.length}${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
}

// ---------------------------------------------------------------------------------------------------------------
// profiles: the real profile call on each goal, timed (MR-24 points 1, 2, 7).

function answersCommitted(): boolean {
  try {
    const file = path.join(EVAL_DIR, 'answers.json');
    execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd: EVAL_DIR, stdio: 'ignore' });
    execFileSync('git', ['diff', '--quiet', 'HEAD', '--', file], { cwd: EVAL_DIR, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function profiles(goals: EvalGoal[]): Promise<void> {
  const runIndex = process.argv.indexOf('--run');
  const run = runIndex > 0 ? Number(process.argv[runIndex + 1]) : NaN;
  if (!Number.isInteger(run) || run < 1) {
    console.error('Name the run: profiles --run 1 (or 2).');
    process.exit(1);
  }
  if (!answersCommitted()) {
    console.error('answers.json must be committed, unchanged, before any profile call runs (MR-24).');
    process.exit(1);
  }
  const { generateRecoveryProfile } = await import('../../src/lib/recovery/profileCall.js');
  const { isDeliverableTarget, profileFailures } = await import('../../src/lib/recovery/index.js');
  const roadmapList = readJson<RoadmapEntry[]>('roadmaps.json');
  const results: Array<ProfileRunResult & { error?: string }> = [];
  for (const goal of goals) {
    const entry = roadmapList.find((item) => item.goalId === goal.id);
    if (!entry) throw new Error(`No roadmap for ${goal.id}: run "roadmaps" first.`);
    const started = performance.now();
    try {
      const result = await generateRecoveryProfile(entry.profileInput);
      const ms = Math.round(performance.now() - started);
      // MR-22: only a model-made profile is checked with the deliverable fact.
      const deliverableGoal = result.source === 'model' ? isDeliverableTarget(entry.profileInput.weeklyTargets[11]) : undefined;
      const failures = profileFailures(result.profile, { deliverableGoal });
      results.push({ goalId: goal.id, source: result.source, pickedTemplate: result.pickedTemplate, profile: result.profile, ms, failures });
      console.log(`${goal.id}: ${result.source} ${result.profile.template} in ${(ms / 1000).toFixed(1)} s${failures.length ? ` FAILS CHECKS: ${failures.join(' ')}` : ''}`);
    } catch (err) {
      const ms = Math.round(performance.now() - started);
      console.log(`${goal.id}: THREW after ${(ms / 1000).toFixed(1)} s: ${String(err)}`);
      results.push({ goalId: goal.id, source: 'keyword_template', pickedTemplate: null, profile: null as never, ms, failures: [], error: String(err) });
    }
    writeJson(`profiles.run-${run}.json`, results);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// weeks: week 1 for 6 goals with their answer profile; steps and the model's kinds in separate files (MR-24 point 1).

/** Six goals on six templates: strength-1 has a high-load kind, strategy_games-1 a game-and-review step. */
export const WEEK_GOALS = ['endurance-1', 'strength-1', 'language-3', 'exam-3', 'content-1', 'strategy_games-1'];
const WEEK_CALLS = 3;
/** A fixed Monday, so the week's layout is the same on every run. */
const WEEK_START = new Date('2026-10-12T00:00:00Z');

/** The answer profile as the week call gets it: aliases are only for scoring. */
function asProfile(answer: EvalAnswer): RecoveryProfile {
  return { ...answer.profile, kinds: answer.profile.kinds.map(({ aliases: _aliases, ...kind }) => kind) };
}

async function weeks(): Promise<void> {
  if (!answersCommitted()) {
    console.error('answers.json must be committed, unchanged, before the weeks are written (MR-24).');
    process.exit(1);
  }
  const { generateWeekPlan } = await import('../../src/lib/ai/weekPlan.js');
  const roadmapList = readJson<RoadmapEntry[]>('roadmaps.json');
  const answers = readJson<EvalAnswer[]>('answers.json');
  const steps: WeekStep[] = [];
  const tags: StepTag[] = [];
  for (const goalId of WEEK_GOALS) {
    const entry = roadmapList.find((item) => item.goalId === goalId);
    const answer = answers.find((item) => item.goalId === goalId);
    if (!entry || !answer) throw new Error(`No roadmap or answer for ${goalId}.`);
    const goal = loadGoals().find((item) => item.id === goalId)!;
    const { roadmap } = entry;
    const first = [...roadmap.weeks].sort((a, b) => a.weekNumber - b.weekNumber)[0];
    let week = null;
    for (let call = 1; call <= WEEK_CALLS && !week; call++) {
      week = await generateWeekPlan({
        finalGoal: roadmap.finalGoal,
        answers: goal.answers,
        dailyMinutes: DAILY_MINUTES,
        planVariant: 'steady',
        slotTime: '19:30',
        method: roadmap.method,
        weekNumber: 1,
        totalWeeks: 12,
        phase: roadmap.phases[0],
        focus: first.focus,
        target: first.target,
        test: first.test,
        weekStart: WEEK_START,
        recovery: asProfile(answer),
      });
      if (!week) console.log(`${goalId}: week call ${call} not saved`);
    }
    if (!week) throw new Error(`${goalId}: no week after ${WEEK_CALLS} calls.`);
    let count = 0;
    for (const day of week) {
      if (day.isRestDay) continue;
      for (const step of day.detailedSteps) {
        steps.push({
          goalId,
          dayNumber: day.dayNumber,
          stepNumber: step.stepNumber,
          title: step.title,
          instructions: step.instructions,
          durationMinutes: step.durationMinutes,
          ...(step.highLoad ? { highLoad: true } : {}),
        });
        tags.push({ goalId, dayNumber: day.dayNumber, stepNumber: step.stepNumber, kind: step.kind ?? null });
        count++;
      }
    }
    // Only counts are printed, never kinds: the gold tags are written from weeks.json alone.
    console.log(`${goalId}: ${count} practice-day steps`);
  }
  writeJson('weeks.json', steps);
  writeJson('weeks.model-tags.json', tags);
}

// ---------------------------------------------------------------------------------------------------------------
// score: no model calls.

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function score(goals: EvalGoal[]): Promise<void> {
  const { pickTemplate } = await import('../../src/lib/recovery/index.js');
  const answers = readJson<EvalAnswer[]>('answers.json');
  const roadmapList = readJson<RoadmapEntry[]>('roadmaps.json');
  const picks = Object.fromEntries(
    roadmapList.map((entry) => [entry.goalId, pickTemplate({ domain: entry.profileInput.domain, goalText: entry.profileInput.goalText, methodName: entry.profileInput.method.name })])
  );
  const keywordTable = scoreTemplatePicks(answers, picks);
  const out: Record<string, unknown> = { keywordTable };
  console.log(`Keyword table alone: right template ${keywordTable.right} of ${keywordTable.total}`);
  for (const miss of keywordTable.misses) console.log(`    ${miss.goalId}: answer ${miss.answer}, picked ${miss.picked}`);

  for (const run of [1, 2]) {
    let results: Array<ProfileRunResult & { error?: string }>;
    try {
      results = readJson(`profiles.run-${run}.json`);
    } catch {
      continue;
    }
    if (results.length !== goals.length) console.log(`\nRun ${run} is incomplete (${results.length} of ${goals.length}).`);
    const scored = scoreRun(answers.filter((answer) => results.some((item) => item.goalId === answer.goalId && item.profile)), results.filter((item) => item.profile));
    const times = results.map((item) => item.ms);
    const slowest = results.reduce((a, b) => (b.ms > a.ms ? b : a));
    out[`run${run}`] = { ...scored, timing: { medianMs: median(times), slowestMs: slowest.ms, slowestGoal: slowest.goalId }, threw: results.filter((item) => item.error).map((item) => item.goalId), failedChecks: results.filter((item) => item.failures.length).map((item) => ({ goalId: item.goalId, failures: item.failures })) };
    const pct = scored.kindsTotal ? ((100 * scored.kindsAgree) / scored.kindsTotal).toFixed(1) : '-';
    console.log(`\n== Run ${run}`);
    console.log(`Right template: ${scored.templatesRight} of ${scored.goals} (needs ${THRESHOLDS.templates})`);
    console.log(`Actions agree: ${scored.kindsAgree} of ${scored.kindsTotal} (${pct}%, needs 90%)`);
    console.log(`Matched kinds only (context, not RULE-19): ${scored.kindsMatched} matched, ${scored.kindsAgree} of them agree`);
    console.log(`Unsafe: ${scored.unsafe.length} (needs 0)`);
    console.log(`Sources: ${JSON.stringify(scored.sources)}`);
    console.log(`Time: median ${(median(times) / 1000).toFixed(1)} s, slowest ${(slowest.ms / 1000).toFixed(1)} s (${slowest.goalId})`);
    for (const goal of scored.perGoal) {
      const source = results.find((item) => item.goalId === goal.goalId)?.source;
      const off = goal.kinds.filter((kind) => !kind.agrees).map((kind) => `${kind.answerKind} ${kind.answerAction} -> ${kind.returnedKind ? `${kind.returnedKind} ${kind.returnedAction}` : 'none'}`);
      if (goal.templateRight && !off.length && !goal.unsafe.length) continue;
      console.log(`  ${goal.goalId} [${source}] template ${goal.answerTemplate} -> ${goal.returnedTemplate}${off.length ? `; differs: ${off.join(', ')}` : ''}${goal.extraKinds.length ? `; extra: ${goal.extraKinds.join(', ')}` : ''}${goal.unsafe.length ? `; UNSAFE: ${goal.unsafe.join(' ')}` : ''}`);
    }
  }

  try {
    const steps = readJson<WeekStep[]>('weeks.json');
    const gold = readJson<StepTag[]>('weeks.gold-tags.json');
    const model = readJson<StepTag[]>('weeks.model-tags.json');
    const tags = scoreTags(steps, gold, model);
    out.tags = tags;
    console.log(`\n== Tags\nAgree: ${tags.agree} of ${tags.total} (${((100 * tags.agree) / tags.total).toFixed(1)}%, needs 90%)`);
    for (const miss of tags.misses) console.log(`  ${miss.goalId} day ${miss.dayNumber} step ${miss.stepNumber} "${miss.title}": gold ${miss.gold}, model ${miss.model}`);
  } catch (err) {
    console.log(`\nTags not scored: ${String(err)}`);
  }
  writeJson('score.json', out);
}

const goals = loadGoals();
const problems = goalSetProblems(goals);
if (problems.length) {
  console.error(`goals.json is not a valid eval set:\n${problems.join('\n')}`);
  process.exit(1);
}

if (command === 'roadmaps') await roadmaps(goals);
if (command === 'profiles') await profiles(goals);
if (command === 'weeks') await weeks();
if (command === 'score') await score(goals);
