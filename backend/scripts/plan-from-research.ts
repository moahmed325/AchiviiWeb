/**
 * Closest thing to "create a custom goal" without the HTTP layer:
 * replay recorded research, then generate Week 1 from that spine.
 *
 *   npm run plan:from-research -- "Get good at competitive stone skipping"
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { researchGoal, researchToGrounding, hasUsableSpine } from '../src/lib/research/index.js';
import { generate12WeekPlanWithAI } from '../src/lib/ai/goalDecomposer.js';
import { findPresetForGoal } from '../src/lib/ai/presets/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FIXTURE_DIR = path.resolve(__dirname, '../test/fixtures/research');

function fixturePath(goal: string): string {
  const slug = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return path.join(FIXTURE_DIR, `${slug}.json`);
}

function replayClient(fixture: any) {
  return {
    async search(query: string) {
      const match = fixture.searches.find((entry: any) => entry.query === query);
      return match?.response ?? { query, results: [], response_time: 0 };
    },
    async extract(urls: string | string[]) {
      const list = Array.isArray(urls) ? urls : [urls];
      const recorded = new Map<string, any>();
      for (const entry of fixture.extracts) {
        for (const item of entry.response.results ?? []) recorded.set(item.url, item);
      }
      return {
        results: list.map((url) => recorded.get(url)).filter(Boolean),
        failed_results: [],
        response_time: 0,
      };
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const forceResearch = flags.has('--force-research');
  const reuseGrounding = flags.has('--reuse-grounding');
  const goal = args.filter((arg) => !arg.startsWith('--')).join(' ').trim();
  if (!goal) {
    console.error('Usage: plan-from-research.ts "<goal>" [--force-research] [--reuse-grounding]');
    process.exit(1);
  }

  if (!forceResearch && findPresetForGoal(goal)) {
    console.log(`[plan] "${goal}" matches a certified preset — that path is unchanged.`);
    console.log('[plan] Pass --force-research to generate from the research fixture instead.');
    process.exit(0);
  }

  const groundingPath = fixturePath(goal).replace(/\.json$/, '.grounding.json');
  let grounding;
  if (reuseGrounding) {
    grounding = JSON.parse(await fs.readFile(groundingPath, 'utf8'));
    console.log(`[plan] Reusing spine from ${path.basename(groundingPath)}`);
  } else {
    const fixture = JSON.parse(await fs.readFile(fixturePath(goal), 'utf8'));
    const research = await researchGoal(goal, {
      tavily: replayClient(fixture) as any,
      presetQueries: fixture.queries,
    });
    grounding = researchToGrounding(research);
    await fs.writeFile(groundingPath, JSON.stringify(grounding, null, 2));
  }

  if (!hasUsableSpine(grounding)) {
    console.error('[plan] No usable spine from the fixture.');
    process.exit(1);
  }

  console.log(`[plan] Kind=${grounding.methodKind} teachings=${grounding.teachings.length}`);
  grounding.teachings.forEach((t) => console.log(`  - ${t}`));

  const plan = await generate12WeekPlanWithAI(
    goal,
    goal,
    {},
    { dailyMinutes: 30, preferredSlot: 'evening', planVariant: 'steady' },
    new Date('2026-10-05'),
    { grounding }
  );

  console.log('\nWeek 1 tasks:');
  for (const task of plan.initialTasks) {
    console.log(`  D${task.dayNumber} ${task.isRestDay ? '(rest)' : ''} ${task.title}`);
    for (const step of task.detailedSteps ?? []) {
      const url = step.resourceUrl ? ` → ${step.resourceUrl}` : '';
      console.log(`      step: ${step.title}${url}`);
    }
  }

  const urls: string[] = [];
  for (const task of plan.initialTasks) {
    if (task.resourceUrl) urls.push(task.resourceUrl);
    for (const step of task.detailedSteps ?? []) {
      if (step.resourceUrl) urls.push(step.resourceUrl);
    }
  }
  const illegal = urls.filter((url) => !grounding.allowedUrls.includes(url));
  console.log(`\nLinks on tasks: ${urls.length}. Illegal: ${illegal.length}`);
  if (illegal.length) {
    illegal.forEach((url) => console.log(`  BAD ${url}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
