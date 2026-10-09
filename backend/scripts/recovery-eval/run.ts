/**
 * Method-aware recovery M2.2 (RULE-19, MR-24): the eval of the profile call and the week call's tags.
 * Not run in CI; every command but `score` makes live Gemini calls and needs GEMINI_API_KEY in backend/.env.
 *
 *   npx tsx scripts/recovery-eval/run.ts roadmaps [--only id,id]   live roadmaps -> roadmaps.json
 *
 * Each command saves its raw results as JSON next to this script, so the review can re-score them without new calls.
 * The order is MR-24's: goals and roadmaps, then the hand-written answers (answers.json), then the profile runs.
 */
import dotenv from 'dotenv';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { EVAL_DIR, goalSetProblems, loadGoals, readJson, type EvalGoal } from './goals.js';
import type { Roadmap } from '../../src/lib/ai/roadmap.js';
import type { ProfileCallInput } from '../../src/lib/recovery/profileCall.js';

dotenv.config({ path: path.join(EVAL_DIR, '../../.env') });

const command = process.argv[2];
const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex > 0 ? (process.argv[onlyIndex + 1] ?? '').split(',').filter(Boolean) : [];

const COMMANDS = ['roadmaps'];
if (!COMMANDS.includes(command)) {
  console.error(`Usage: npx tsx scripts/recovery-eval/run.ts ${COMMANDS.join(' | ')}`);
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
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

const goals = loadGoals();
const problems = goalSetProblems(goals);
if (problems.length) {
  console.error(`goals.json is not a valid eval set:\n${problems.join('\n')}`);
  process.exit(1);
}

if (command === 'roadmaps') await roadmaps(goals);
