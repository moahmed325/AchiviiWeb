/**
 * Runs prompts 1-3 live for one goal: clarify, roadmap, week 1.
 * Answers each question with its second option (a middle answer), or "Skipped" with --skip.
 *
 *   bun scripts/plan-v2-live.ts "learn to touch type" [--minutes 30] [--variant steady] [--skip current_level]
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const { clarifyGoalWithAI } = await import('../src/lib/ai/clarify.js');
const { generateRoadmap, formatTarget, TOTAL_WEEKS } = await import('../src/lib/ai/roadmap.js');
const { activeDaysFor, generateWeekPlan, slotTimeFor } = await import('../src/lib/ai/weekPlan.js');

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const goal = process.argv[2];
if (!goal || goal.startsWith('--')) {
  console.error('Usage: bun scripts/plan-v2-live.ts "<goal>" [--minutes 30] [--variant steady] [--skip id]');
  process.exit(1);
}
const dailyMinutes = Number(flag('minutes', '30'));
const planVariant = flag('variant', 'steady') as 'steady' | 'accelerated' | 'minimal';
const skipped = new Set(flag('skip', '').split(',').filter(Boolean));

const started = Date.now();
const clarification = await clarifyGoalWithAI(goal);
console.log(`\n== Clarify: "${clarification.clarifiedOutcome}" (${clarification.primaryDomain})`);
const answers = clarification.followUpQuestions.map((q) => {
  const answer = skipped.has(q.id) ? 'Skipped' : q.options[1] ?? q.options[0];
  console.log(`  ${q.id}: ${q.question} -> ${answer}`);
  return { id: q.id, question: q.question, answer };
});

const result = await generateRoadmap({
  workingTitle: clarification.clarifiedOutcome,
  domain: clarification.primaryDomain,
  rawGoal: goal,
  dailyMinutes,
  activeDays: activeDaysFor(planVariant),
  answers,
});
if (!result.ok) {
  console.error(`\nRoadmap failed: ${result.reason}`);
  process.exit(1);
}
const { roadmap } = result;
console.log(`\n== Roadmap`);
console.log(`  Final goal: ${roadmap.finalGoal}`);
console.log(`  Final test: ${roadmap.finalTest}`);
console.log(`  Start: ${roadmap.startingPoint.value ?? '-'} (${roadmap.startingPoint.description})`);
console.log(`  Method: ${roadmap.method.name}${roadmap.method.creator ? ` by ${roadmap.method.creator}` : ''} (safety ${roadmap.method.safety})`);
console.log(`  Why: ${roadmap.method.whyChosen}`);
if (roadmap.method.runnerUp) console.log(`  Runner-up: ${roadmap.method.runnerUp.name}: ${roadmap.method.runnerUp.whyLost}`);
roadmap.method.rules.forEach((rule) => console.log(`  - ${rule}`));
roadmap.phases.forEach((phase) => console.log(`  Phase ${phase.startWeek}-${phase.endWeek} ${phase.name}: ${phase.purpose}`));
roadmap.weeks.forEach((week) =>
  console.log(`  W${String(week.weekNumber).padStart(2)} [${week.test.type}] ${formatTarget(week.target)}  | ${week.focus}`)
);

const first = roadmap.weeks[0];
const days = await generateWeekPlan({
  finalGoal: roadmap.finalGoal,
  answers,
  dailyMinutes,
  planVariant,
  slotTime: slotTimeFor('evening'),
  method: roadmap.method,
  weekNumber: 1,
  totalWeeks: TOTAL_WEEKS,
  phase: roadmap.phases[0],
  focus: first.focus,
  target: first.target,
  test: first.test,
  weekStart: new Date(),
});
if (!days) {
  console.error('\nWeek 1 failed.');
  process.exit(1);
}
console.log(`\n== Week 1: ${formatTarget(first.target)}`);
for (const day of days) {
  const tags = [day.isRestDay ? 'rest' : '', day.isKeySession ? 'KEY' : '', day.isTestDay ? 'TEST' : ''].filter(Boolean).join(' ');
  console.log(`  Day ${day.dayNumber} ${day.dayOfWeek} ${tags ? `[${tags}] ` : ''}${day.title} (${day.durationMinutes} min)`);
  if (day.whyToday) console.log(`      why: ${day.whyToday}`);
  for (const step of day.detailedSteps) {
    console.log(`      p${step.priority} ${step.durationMinutes}m ${step.title} | done when: ${step.passMark}`);
  }
  if (day.minimumVersion) console.log(`      10-min: ${day.minimumVersion.title} (${day.minimumVersion.durationMinutes}m)`);
}
console.log(`\nTook ${Math.round((Date.now() - started) / 1000)}s`);
