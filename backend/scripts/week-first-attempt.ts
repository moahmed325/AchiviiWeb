/**
 * B-92: how often the week call's first answer is refused, and why. Runs the real week call (live Gemini, needs a key
 * in backend/.env) for the run10k week 1 input a few times and counts attempt 1's refusal reasons.
 *
 *   npx tsx scripts/week-first-attempt.ts [runs]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { generateWeekPlan } = await import('../src/lib/ai/weekPlan.js');
const { RUN10K_WEEK1 } = await import('../test/run10kWeekInput.js');

const runs = Number(process.argv[2] ?? '6');
const firstRefusals: string[] = [];
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  const line = args.map(String).join(' ');
  const match = /\[AI\] Week \d+ attempt 1 rejected: (.*)/.exec(line);
  if (match) firstRefusals.push(match[1].slice(0, 160));
};

let written = 0;
for (let run = 1; run <= runs; run += 1) {
  const before = firstRefusals.length;
  const days = await generateWeekPlan({ ...RUN10K_WEEK1, weekStart: new Date('2026-11-02T12:00:00Z') });
  if (days) written += 1;
  process.stdout.write(`run ${run}: ${days ? 'written' : 'failed'}, attempt 1 ${firstRefusals.length > before ? 'refused' : 'accepted'}\n`);
}
console.warn = warn;

const oneStep = firstRefusals.filter((reason) => /needs 2 to 4 steps; got 1/.test(reason)).length;
console.log(`\n${runs} runs: ${written} written; attempt 1 refused ${firstRefusals.length} times, ${oneStep} for a one-step practice day.`);
for (const reason of firstRefusals) console.log(`- ${reason}`);
