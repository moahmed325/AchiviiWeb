import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';
import { enforceDrills, type Drill } from '../method/drills.js';

export function restMinutesFor(dailyMins: number): number {
  return dailyMins < 15 ? 10 : 15;
}

/** Always filler, whatever numbers are attached. */
const FILLER = /\b(reflect\w*|journal\w*|recap|overview|mindset|resum\w*|getting started)\b|recovery & reflection/i;

/** Filler only when nothing concrete comes with it. Flashcard review with a count is real practice. */
const VAGUE = /\b(review|consolidat\w*|introduc\w*|intro to)\b/i;

/** Preparing a tool, not a body position ("posture setup" is practice). */
const SETUP = /\b(install|download|sign up|create an account|buy|order)\b|\bset ?up (an? |the |your )?(app|account|software|profile|tool)\b/i;

const MEASURE =
  /\b(test|retest|baseline|measure|time yourself|timed|max\w*|count|record|log|assess\w*|benchmark|score|best of|film|photo\w*)\b/i;

const MAX_FAILURES = 8;

export function taskRulesBlock(dailyMins: number): string {
  const restMins = restMinutesFor(dailyMins);
  return `
WHAT EVERY DAY MUST LOOK LIKE (checked in code; a dull week is rejected):
Practice days:
- "title" is the action plus today's target, with a number. Good: "Two-ball exchange: 10 clean in a row".
  Bad: "Two-Ball Mechanics", "Review", "Consolidation", "Introduction to...", "Resuming practice".
- 3-4 steps whose minutes add up to ${dailyMins}. Every step has:
  - "title": the drill itself.
  - "instructions": exactly what to do, with a dose: sets, reps, seconds, words, pages, or minutes.
    Good: "5 sets of 20 throws, 30 seconds rest between sets."
  - "passMark": the measurable standard that counts as done. Good: "15 of 20 land without moving your feet."
  - "focusCue": one cue for doing it right. "pitfallToAvoid": the most common mistake at this level.
- Warm-up only if the activity needs one, at most 5 minutes. No steps for journaling, reflecting, or reading
  about the method. Setting up a tool is allowed only on the first practice day, at most 5 minutes.
- The first practice day's first step is titled "Baseline test: ..." and measures the user's real current level
  (e.g. max clean catches in 5 tries, max push-ups with good form). The last practice day's final step is titled
  "Retest: ..." and repeats exactly the same test, so the user sees progress within the week.
- Targets climb: each practice day asks for a little more than the one before, starting from this week's numbers.
- Use the user's answers: fit drills to their level, equipment, injuries and obstacles.
Rest days:
- ${restMins} minutes, one step: a light task that still moves the goal. Examples: a 5-minute flashcard pass,
  mobility for the muscles trained, copying one detail from a demonstration slowly, a slow dry run of the grip.
- The title names that task. Never "Active Recovery & Reflection". Same instructions and passMark rules apply.
`;
}

function hasNumber(text: string | undefined): boolean {
  return /\d/.test(text ?? '');
}

function stepText(step: DetailedStep): string {
  return `${step.title} ${step.instructions}`;
}

const TEST_MINUTES = 5;

/** Take minutes from the longest step so the day's total stays the same. Null when no step can spare them. */
function takeMinutes(steps: DetailedStep[], wanted: number): number | null {
  const longest = steps.reduce<DetailedStep | null>((best, step) => (!best || step.durationMinutes > best.durationMinutes ? step : best), null);
  if (!longest || longest.durationMinutes < wanted + 3) return null;
  longest.durationMinutes -= wanted;
  if (/^\d+ minutes: /.test(longest.instructions)) {
    longest.instructions = longest.instructions.replace(/^\d+ minutes: /, `${longest.durationMinutes} minutes: `);
  }
  return wanted;
}

function renumber(steps: DetailedStep[]): DetailedStep[] {
  return steps.map((step, index) => ({ ...step, stepNumber: index + 1 }));
}

/**
 * Fix the misses that don't need the model: a title without a number, a step without a dose or pass mark,
 * a missing baseline or retest. What's left after this (filler drills, setup on later days) goes back to the model.
 */
export function polishWeekTasks(tasks: DailyTaskPlan[], library?: { drills?: Drill[]; week: number }): DailyTaskPlan[] {
  const onLibrary = library?.drills?.length ? enforceDrills(tasks, library.drills, library.week) : tasks;
  const out = onLibrary.map((task) => ({ ...task, detailedSteps: (task.detailedSteps ?? []).map((step) => ({ ...step })) }));

  for (const task of out) {
    const steps = task.detailedSteps;
    for (const step of steps) {
      if (!hasNumber(step.instructions)) step.instructions = `${step.durationMinutes} minutes: ${step.instructions}`;
      if (!step.passMark || step.passMark.trim().length < 8) {
        step.passMark = `All ${step.durationMinutes} minutes done, every repetition matching the instructions.`;
      }
    }

    const vagueTitle = FILLER.test(task.title) || (VAGUE.test(task.title) && !hasNumber(task.title));
    const lead = steps.find((step) => !FILLER.test(step.title));
    if (vagueTitle && lead) task.title = task.isRestDay ? `Light practice: ${lead.title}` : lead.title;
    if (task.isRestDay && VAGUE.test(task.title) && !hasNumber(task.title)) {
      task.title = `${task.title} (${task.durationMinutes} min)`;
    }
    if (!task.isRestDay && !hasNumber(task.title)) {
      const target = steps.map((step) => step.passMark).find((mark) => hasNumber(mark) && mark!.length <= 60);
      task.title = target ? `${task.title}: ${target.replace(/\.$/, '')}` : `${task.title} (${task.durationMinutes} min)`;
    }
  }

  const practice = out.filter((task) => !task.isRestDay && task.detailedSteps.length > 0);
  const first = practice[0];
  const last = practice[practice.length - 1];
  if (!first) return out;

  let baseline = first.detailedSteps.find((step) => step.title.startsWith('Baseline test:'));
  if (!baseline) {
    const measured = first.detailedSteps.find((step) => MEASURE.test(stepText(step)));
    if (measured) {
      measured.title = `Baseline test: ${measured.title}`;
      baseline = measured;
    } else if (takeMinutes(first.detailedSteps, TEST_MINUTES)) {
      const drill = (first.detailedSteps.find((step) => !/warm[- ]?up/i.test(step.title)) ?? first.detailedSteps[0]).title;
      baseline = {
        stepNumber: 0,
        title: `Baseline test: ${drill}`,
        durationMinutes: TEST_MINUTES,
        instructions: `${TEST_MINUTES} minutes: do ${drill} at your best and write down how many clean repetitions you got.`,
        focusCue: 'Honest effort, clean form. This number is your starting point.',
        pitfallToAvoid: 'Do not warm up for so long that the test is rushed.',
        passMark: 'Your best count is written down.',
      };
      first.detailedSteps = renumber([baseline, ...first.detailedSteps]);
    }
  }

  if (baseline && last && last !== first && !last.detailedSteps.some((step) => step.title.startsWith('Retest:'))) {
    const minutes = Math.min(baseline.durationMinutes, TEST_MINUTES);
    if (takeMinutes(last.detailedSteps, minutes)) {
      const test = baseline.title.replace(/^Baseline test:\s*/, '');
      last.detailedSteps = renumber([
        ...last.detailedSteps,
        {
          ...baseline,
          title: `Retest: ${test}`,
          durationMinutes: minutes,
          instructions: `${minutes} minutes: repeat Day ${first.dayNumber}'s baseline test exactly the same way and compare the numbers.`,
          passMark: `You beat or match your Day ${first.dayNumber} result.`,
        },
      ]);
    }
  }

  return out;
}

/** Everything that makes a day filler rather than practice. Empty when the week is actionable. */
export function taskQualityFailures(tasks: DailyTaskPlan[]): string[] {
  const failures: string[] = [];
  const practice = tasks.filter((task) => !task.isRestDay);
  const firstPractice = practice[0];

  for (const task of tasks) {
    const day = `Day ${task.dayNumber}`;
    const steps = task.detailedSteps ?? [];

    if (FILLER.test(task.title) || (VAGUE.test(task.title) && !hasNumber(task.title))) {
      failures.push(`${day} title "${task.title}" names a category, not an action.`);
    }
    if (!task.isRestDay && !hasNumber(task.title)) failures.push(`${day} title "${task.title}" has no target number.`);
    if (task.isRestDay && (task.durationMinutes > 20 || steps.length > 2)) {
      failures.push(`${day} is a rest day and should be one short task, not a full session.`);
    }

    for (const step of steps) {
      const label = `${day} step "${step.title}"`;
      if (FILLER.test(step.title)) failures.push(`${label} is filler. Replace it with a drill.`);
      if (!hasNumber(step.instructions)) failures.push(`${label} has no dose (sets, reps, seconds, or minutes).`);
      if (!step.passMark || step.passMark.trim().length < 8) failures.push(`${label} has no passMark.`);
      if (task !== firstPractice && SETUP.test(stepText(step))) {
        failures.push(`${label} is setup work. Setup belongs on the first practice day only.`);
      }
    }
  }

  const last = practice[practice.length - 1];
  if (firstPractice && !(firstPractice.detailedSteps ?? []).some((step) => MEASURE.test(stepText(step)))) {
    failures.push(`Day ${firstPractice.dayNumber} (first practice day) needs a baseline test.`);
  }
  if (last && last !== firstPractice && !(last.detailedSteps ?? []).some((step) => MEASURE.test(stepText(step)))) {
    failures.push(`Day ${last.dayNumber} (last practice day) needs to repeat the baseline test.`);
  }

  return [...new Set(failures)].slice(0, MAX_FAILURES);
}
