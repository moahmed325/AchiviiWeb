/**
 * Method-aware recovery M2.1 (MR-16): measures how often the week call fails the kind check, with the real models.
 * For each of the 10 pathways and 4 custom goals on different templates: one live roadmap, then week 1 with the
 * goal's saved profile shape (pathway profile, or the keyword template as goal create saves it while the profile call
 * is off). It repeats the week call's two attempts itself, so it can see each one:
 * - "kind failed": any practice-day step whose kind is missing or not one of the profile's ids (the test step is
 *   exempt: code tags it), counted from the raw answer, so other reasons cannot hide it;
 * - "checked": what `checkWeekAnswer` said (accepted, or its first reason).
 * Not run in CI. Needs GEMINI_API_KEY in backend/.env.
 *
 *   npx tsx scripts/tag-failure-rate.ts [--only run10k,exam] [--no-profile]
 * --no-profile writes the same weeks without a profile (today's week call): a baseline for the other reasons.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.GEMINI_API_KEY) {
  console.error('No GEMINI_API_KEY in backend/.env: nothing measured.');
  process.exit(1);
}

const { generateStructuredContent } = await import('../src/lib/ai/gemini.js');
const { generateRoadmap } = await import('../src/lib/ai/roadmap.js');
const { CERTIFIED_PRESETS } = await import('../src/lib/ai/presets/index.js');
const { activeDaysFor, buildWeekPrompt, checkWeekAnswer, resolveKind, weekLayout, weekResponseSchema, WEEK_SYSTEM } = await import(
  '../src/lib/ai/weekPlan.js'
);
const { pickTemplate, profileForPathway, templateProfile } = await import('../src/lib/recovery/index.js');

type RecoveryProfile = NonNullable<ReturnType<typeof profileForPathway>>;

interface Sample {
  label: string;
  rawGoal: string;
  workingTitle: string;
  domain: string;
  answers: Array<{ id: string; question: string; answer: string }>;
  profile: (methodName: string) => RecoveryProfile;
}

const CUSTOM: Array<Omit<Sample, 'profile'>> = [
  { label: 'custom: exam', rawGoal: 'Pass the AWS Solutions Architect Associate exam', workingTitle: 'Pass the AWS Solutions Architect exam', domain: 'Exam preparation' },
  { label: 'custom: creative', rawGoal: 'Learn to draw realistic portraits', workingTitle: 'Draw realistic portraits', domain: 'Drawing' },
  { label: 'custom: content', rawGoal: 'Start a podcast and publish 10 episodes', workingTitle: 'Start a podcast', domain: 'Podcasting' },
  { label: 'custom: general', rawGoal: 'Bake sourdough bread at home', workingTitle: 'Bake sourdough bread at home', domain: 'Bread baking' },
].map((goal) => ({
  ...goal,
  answers: [
    { id: 'current_level', question: 'Where are you now?', answer: 'A complete beginner' },
    { id: 'success', question: 'In 90 days, what would make you say this worked?', answer: 'Doing it confidently on my own' },
    { id: 'equipment', question: 'What do you have?', answer: 'The basics' },
    { id: 'obstacle', question: 'What could stop you?', answer: 'Finding time on weekdays' },
  ],
}));

const SAMPLES: Sample[] = [
  ...CERTIFIED_PRESETS.map((preset) => ({
    label: `pathway: ${preset.id}`,
    rawGoal: preset.title,
    workingTitle: preset.clarifiedOutcome,
    domain: preset.primaryDomain,
    answers: preset.diagnosticQuestions.map((q) => ({ id: q.id, question: q.question, answer: q.options[1] ?? q.options[0] })),
    profile: () => profileForPathway(preset.id)!,
  })),
  ...CUSTOM.map((goal) => ({
    ...goal,
    profile: (methodName: string) => templateProfile(pickTemplate({ domain: goal.domain, goalText: `${goal.rawGoal} ${goal.workingTitle}`, methodName })),
  })),
];

const onlyIndex = process.argv.indexOf('--only');
const only = onlyIndex > 0 ? (process.argv[onlyIndex + 1] ?? '').split(',').filter(Boolean) : [];
const samples = only.length ? SAMPLES.filter((sample) => only.some((word) => sample.label.includes(word))) : SAMPLES;

const TEST_STEP = /^weekly test\b/i;
const noProfile = process.argv.includes('--no-profile');

/** Practice-day steps whose kind is missing or unknown, from the raw answer. */
function kindProblems(data: any, profile: RecoveryProfile, restDays: Set<number>): string[] {
  const problems: string[] = [];
  const days = Array.isArray(data?.days) ? data.days : [];
  for (const day of days) {
    if (restDays.has(Number(day?.dayNumber))) continue;
    for (const step of Array.isArray(day?.steps) ? day.steps : []) {
      const title = typeof step?.title === 'string' ? step.title : '';
      if (!title || TEST_STEP.test(title.trim())) continue;
      if (!resolveKind(step?.kind, profile)) problems.push(`day ${day?.dayNumber} "${title}": ${step?.kind === undefined ? 'no kind' : JSON.stringify(step.kind)}`);
    }
  }
  return problems;
}

interface Row {
  label: string;
  template: string;
  attempts: Array<{ provider: string; kindFailed: boolean; problems: string[]; checked: string }>;
  saved: boolean;
  note?: string;
}

const rows: Row[] = [];
const started = Date.now();

for (const sample of samples) {
  const roadmapResult = await generateRoadmap({
    workingTitle: sample.workingTitle,
    domain: sample.domain,
    rawGoal: sample.rawGoal,
    dailyMinutes: 30,
    activeDays: activeDaysFor('steady'),
    answers: sample.answers,
  });
  if (!roadmapResult.ok || !('roadmap' in roadmapResult)) {
    const reason = 'reason' in roadmapResult ? roadmapResult.reason : 'unknown';
    rows.push({ label: sample.label, template: '-', attempts: [], saved: false, note: `roadmap failed: ${reason}` });
    console.log(`${sample.label}: roadmap failed (${reason})`);
    continue;
  }
  const { roadmap } = roadmapResult;
  const profile = sample.profile(roadmap.method.name);
  const first = roadmap.weeks[0];
  const input = {
    finalGoal: roadmap.finalGoal,
    answers: sample.answers,
    dailyMinutes: 30,
    planVariant: 'steady' as const,
    slotTime: '19:30',
    method: roadmap.method,
    weekNumber: 1,
    totalWeeks: 12,
    phase: roadmap.phases[0],
    focus: first.focus,
    target: first.target,
    test: first.test,
    weekStart: new Date(),
    recovery: noProfile ? null : profile,
  };
  const layout = weekLayout('steady', input.weekStart);
  const restDays = new Set(layout.filter((day) => day.isRestDay).map((day) => day.dayNumber));
  const prompt = buildWeekPrompt(input, layout);
  const row: Row = { label: sample.label, template: profile.template, attempts: [], saved: false };

  let rejection = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt =
      attempt === 0 ? prompt : `${prompt}\n\nYOUR PREVIOUS ANSWER WAS REJECTED: ${rejection}\nReturn the complete JSON again with that problem fixed.`;
    const result = await generateStructuredContent<any>(attemptPrompt, WEEK_SYSTEM, undefined, {
      responseSchema: weekResponseSchema(input.recovery),
      temperature: attempt === 0 ? 0 : 0.4,
    });
    if (!result.success || !result.data) {
      rejection = result.error || 'no answer';
      row.attempts.push({ provider: result.provider ?? '?', kindFailed: false, problems: [], checked: `no answer: ${rejection}` });
      continue;
    }
    const problems = noProfile ? [] : kindProblems(result.data, profile, restDays);
    const verdict = checkWeekAnswer(result.data, input, attempt === 1);
    const accepted = 'value' in verdict;
    row.attempts.push({
      provider: result.provider ?? '?',
      kindFailed: problems.length > 0,
      problems,
      checked: accepted ? 'accepted' : verdict.reason.slice(0, 160),
    });
    if (accepted) {
      row.saved = true;
      break;
    }
    rejection = verdict.reason;
  }
  rows.push(row);
  const summary = row.attempts.map((a, i) => `#${i + 1} ${a.provider} kind ${a.kindFailed ? `FAILED (${a.problems.length})` : 'ok'} / ${a.checked}`).join(' | ');
  console.log(`${sample.label} [${row.template}]: ${row.saved ? 'saved' : 'NOT saved'} :: ${summary}`);
  for (const attempt of row.attempts) for (const problem of attempt.problems.slice(0, 5)) console.log(`    ${problem}`);
}

const measured = rows.filter((row) => row.attempts.length > 0 && row.attempts[0].checked !== undefined && !row.attempts[0].checked.startsWith('no answer'));
const firstFailed = measured.filter((row) => row.attempts[0].kindFailed);
const bothFailed = measured.filter((row) => row.attempts[0].kindFailed && row.attempts[1]?.kindFailed);
const notSaved = rows.filter((row) => !row.saved);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');

console.log('\n== Summary');
console.log(`Weeks measured: ${measured.length} of ${rows.length} (${Math.round((Date.now() - started) / 1000)} s)`);
console.log(`First attempt failed the kind check: ${firstFailed.length} (${pct(firstFailed.length, measured.length)})`);
console.log(`Both attempts failed the kind check (MR-16 limit 2%): ${bothFailed.length} (${pct(bothFailed.length, measured.length)})`);
console.log(`Weeks not saved for any reason: ${notSaved.length} (${notSaved.map((row) => row.label).join(', ') || 'none'})`);
console.log(`Providers: ${[...new Set(rows.flatMap((row) => row.attempts.map((a) => a.provider)))].join(', ')}`);
