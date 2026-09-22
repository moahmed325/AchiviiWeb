/**
 * Run the custom-goal set through method choice + week-1 plan generation.
 * Exits 1 when any goal fails its checks.
 *
 *   npx tsx scripts/eval-goals.ts            all goals
 *   npx tsx scripts/eval-goals.ts typing     only goals containing "typing"
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pickMethod } from '../src/lib/method/pickMethod.js';
import { formatBasisBadge } from '../src/lib/research/planGrounding.js';
import { applySafetyClamps } from '../src/lib/research/safetyClamps.js';
import { generate12WeekPlanWithAI } from '../src/lib/ai/goalDecomposer.js';
import { repairWeekSchedule } from '../src/lib/ai/scheduleRepair.js';
import { findPresetForGoal } from '../src/lib/ai/presets/index.js';
import { extractStatedTargets, week12MeetsTarget } from '../src/lib/research/statedTarget.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const OUT = path.resolve(__dirname, '../test/fixtures/eval-goals.json');
const DAILY_MINUTES = 30;
const ACTIVE_DAYS = 5;

const DEFAULT_ANSWERS = {
  'What is your current level?': 'Complete beginner, never tried it',
  'What gets in your way?': 'I lose motivation after a long workday',
};

const GOALS: Array<{ goal: string; expect: RegExp; mustStayCustom?: boolean; answers?: Record<string, string> }> = [
  { goal: 'Get good at competitive stone skipping', expect: /stone|spin|angle|degree|throw/i },
  { goal: 'Build a mindfulness meditation practice to reduce stress', expect: /sit|breath|mindful|present/i },
  { goal: 'Learn to juggle three balls', expect: /ball|throw|cascade|juggle/i },
  { goal: 'Bake a good loaf of sourdough bread at home', expect: /starter|dough|ferment|fold|bake/i },
  {
    goal: 'Learn touch typing to 40 words per minute',
    expect: /home row|typ|wpm|accuracy|keyboard/i,
    answers: { 'Current speed?': 'About 20 WPM, I look at the keys', 'What gets in your way?': 'Only evenings are free' },
  },
  { goal: 'Learn to swim freestyle for 25 meters', expect: /swim|freestyle|breath|water|stroke/i },
  { goal: 'Hold a plank for 60 seconds', expect: /plank|core|hold|second/i },
  { goal: 'Learn to whistle with two fingers', expect: /whistle|finger|lip|blow/i },
  { goal: 'Draw a realistic eye in pencil', expect: /draw|eye|pencil|sketch|shade/i },
  { goal: 'Learn adult CPR well enough to follow a class checklist', expect: /chest|compress|breath|aed|cpr/i },
  { goal: 'Knit a simple scarf', expect: /knit|stitch|yarn|needle|cast/i },
  { goal: 'Learn to solve a Rubik cube', expect: /cube|layer|algorithm|turn|solve/i },
  {
    goal: 'Do 20 push-ups in a row',
    expect: /push|plank|rep|chest|form/i,
    answers: { 'How many can you do now?': '5 with good form', 'Any injuries?': 'Sore left wrist sometimes' },
  },
  { goal: 'Learn to moonwalk', expect: /moonwalk|slide|toe|heel|glide/i },
  { goal: 'Brew a decent cup of pour-over coffee', expect: /coffee|pour|grind|bloom|filter/i },
  { goal: 'Learn the NATO phonetic alphabet', expect: /alpha|phonetic|letter|nato|bravo/i },
  { goal: 'Improve my handwriting so other people can read it', expect: /letter|stroke|posture|slow|pen/i },
  { goal: 'Learn 200 common Italian words', expect: /italian|word|vocab|recall|speak/i },
  {
    goal: 'Run a faster 5K this season',
    expect: /run|easy|pace|week|mile|km/i,
    mustStayCustom: true,
    answers: { 'Current 5K time?': 'About 32 minutes', 'Days you can run?': '3 or 4 a week' },
  },
  { goal: 'Play five songs on the piano', expect: /piano|key|chord|song|practice/i, mustStayCustom: true },
];

function taskText(plan: { initialTasks: Array<{ title: string; detailedSteps?: Array<{ title: string; instructions?: string }> }> }): string {
  return plan.initialTasks
    .map((task) => [task.title, ...(task.detailedSteps ?? []).map((step) => `${step.title} ${step.instructions ?? ''}`)].join(' '))
    .join('\n');
}

/** The reason must point at something this person said, not a generic "it is popular". */
function reasonIsPersonal(why: string | undefined, answers: Record<string, string>): boolean {
  if (!why) return false;
  const lower = why.toLowerCase();
  const words = Object.values(answers)
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 || /^\d+$/.test(word));
  return lower.includes(String(DAILY_MINUTES)) || words.some((word) => lower.includes(word));
}

async function runOne(goal: string, expect: RegExp, mustStayCustom = false, answers: Record<string, string> = DEFAULT_ANSWERS) {
  if (findPresetForGoal(goal)) {
    return {
      goal,
      skipped: 'matched a certified preset',
      pass: !mustStayCustom,
      checks: [{ name: 'stays custom', pass: !mustStayCustom, detail: 'matched a certified preset' }],
    };
  }

  const picked = await pickMethod({
    rawGoal: goal,
    clarifiedOutcome: goal,
    answers,
    dailyMinutes: DAILY_MINUTES,
    activeDaysPerWeek: ACTIVE_DAYS,
  });
  if (!picked.ok) {
    return { goal, pass: false, checks: [{ name: 'method chosen', pass: false, detail: picked.reason }] };
  }

  let grounding = picked.grounding;
  if (grounding.velocityTable) {
    grounding = { ...grounding, velocityTable: applySafetyClamps(grounding.velocityTable, { source: 'fresh' }).table };
  }
  const badge = formatBasisBadge(grounding);

  const plan = await generate12WeekPlanWithAI(
    goal,
    goal,
    answers,
    { dailyMinutes: DAILY_MINUTES, preferredSlot: 'evening', planVariant: 'steady' },
    new Date('2026-10-05'),
    { grounding }
  );

  const urls: string[] = [];
  for (const task of plan.initialTasks) {
    if (task.resourceUrl) urls.push(task.resourceUrl);
    for (const step of task.detailedSteps ?? []) {
      if (step.resourceUrl) urls.push(step.resourceUrl);
    }
  }
  const weekText = taskText(plan);
  const schedule = repairWeekSchedule(plan.initialTasks, DAILY_MINUTES, ACTIVE_DAYS);
  const stated = extractStatedTargets(goal);
  const targetOk =
    stated.length === 0 ||
    (Boolean(grounding.velocityTable) && stated.every((item) => week12MeetsTarget(grounding.velocityTable!, item)));
  const badgeHonest = Boolean(badge) && badge!.anchored === false && !/anchored|certified/i.test(badge!.label);

  const checks = [
    { name: 'method chosen', pass: true },
    { name: 'plan exists', pass: plan.weeks.length === 12 && plan.initialTasks.length === 7 },
    { name: 'follows teachings', pass: expect.test(weekText) },
    { name: 'no links', pass: urls.length === 0 },
    { name: 'badge is honest', pass: badgeHonest },
    { name: 'reason cites the user', pass: reasonIsPersonal(grounding.whyChosen, answers) },
    { name: 'target is in the numbers', pass: targetOk },
    { name: 'schedule rules hold', pass: schedule.failures.length === 0 },
    { name: 'stays custom', pass: true },
  ];

  return {
    goal,
    attempts: picked.attempts,
    planSource: plan.planSource ?? 'ai',
    methodName: grounding.methodName,
    authority: grounding.authority ?? null,
    badge,
    whyChosen: grounding.whyChosen,
    runnerUp: grounding.runnerUp ?? null,
    teachings: grounding.teachings,
    assumptions: grounding.assumptions ?? null,
    velocity: grounding.velocityTable,
    week1: plan.initialTasks.map((task) => ({ day: task.dayNumber, rest: task.isRestDay, title: task.title })),
    checks,
    pass: checks.every((check) => check.pass),
  };
}

async function main() {
  const filter = process.argv[2]?.toLowerCase();
  const reports = [];
  for (const item of GOALS.filter((entry) => !filter || entry.goal.toLowerCase().includes(filter))) {
    console.log(`\n[eval] START ${item.goal}`);
    try {
      const report = await runOne(item.goal, item.expect, item.mustStayCustom, item.answers);
      reports.push(report);
      const failed = report.checks.filter((check) => !check.pass).map((check) => check.name);
      console.log(
        `[eval] DONE ${item.goal} pass=${report.pass} method=${(report as any).methodName ?? '?'} source=${(report as any).planSource ?? '?'} failed=${failed.join(', ') || 'none'}`
      );
    } catch (err: any) {
      reports.push({ goal: item.goal, error: err?.message || String(err) });
      console.error(`[eval] FAIL ${item.goal}: ${err?.message || err}`);
    }
  }

  await fs.writeFile(OUT, JSON.stringify(reports, null, 2));
  console.log(`\n[eval] WROTE ${OUT}`);
  const failed = reports.filter((report) => (report as any).pass === false || (report as any).error);
  console.log(`[eval] ${reports.length - failed.length}/${reports.length} passed`);
  console.log('EVAL COMPLETE');
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
