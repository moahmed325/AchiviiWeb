import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';
import { enforceBlocks, type WorkBlock } from '../method/blocks.js';

export function restMinutesFor(dailyMins: number): number {
  return dailyMins < 15 ? 10 : 15;
}

/** Always filler, whatever numbers are attached. */
const FILLER = /\b(reflect\w*|journal\w*|recap|overview|mindset|resum\w*|getting started)\b|recovery & reflection/i;

/** Filler only when nothing concrete comes with it. Flashcard review with a count is real work. */
const VAGUE = /\b(review|consolidat\w*|introduc\w*|intro to|practice session|work on)\b/i;

/** Preparing a tool, not a body position ("posture setup" is practice). */
const SETUP = /\b(install|download|sign up|create an account|buy|order)\b|\bset ?up (an? |the |your )?(app|account|software|profile|tool)\b/i;

const MEASURE =
  /\b(test|retest|baseline|measure|time yourself|timed|max\w*|count|record|log|assess\w*|benchmark|score|best of|film|photo\w*)\b/i;

const MAX_FAILURES = 8;
const TEST_MINUTES = 5;
const MIN_INSTRUCTIONS = 25;

export function taskRulesBlock(dailyMins: number): string {
  const restMins = restMinutesFor(dailyMins);
  return `
WHAT EVERY DAY MUST LOOK LIKE (checked in code; a dull week is rejected):
Practice days:
- "title" says what the user will get done today. Good: "Bake a test loaf and compare the crumb",
  "Recall all 26 letters in under 60 seconds". Bad: "Review", "Consolidation", "Introduction to...", "Practice session".
- 3-4 steps whose minutes add up to ${dailyMins}. Each step is a different piece of work, not the same thing repeated.
  Every step has:
  - "title": the action.
  - "instructions": exactly what to do, so a beginner could start without asking a question. Say how much or how
    far when it matters (count, length, difficulty), but the step is defined by the action, not by a number.
  - "output": what the user ends up with: a count, a recording, a photo, a finished piece, a written list,
    a published video.
  - "passMark": the proof the output is good enough. Good: "15 of 20 caught without moving your feet",
    "the crumb has no dense streak", "you recalled 18 of 20 without looking".
  - "focusCue": the one thing to get right. "pitfallToAvoid": the most common mistake at this level.
  - "timing" (optional): only when the step can't happen straight after the previous one, e.g. "4 hours after
    mixing", "before bed", "at your stream time". Leave it out otherwise. "durationMinutes" counts hands-on time only.
- No two practice days have the same steps. Mix the kinds of work across the week.
- Most practice days include doing the real thing at today's level: a full attempt, a whole piece, a run-through,
  a real stream, not only prep for it.
- Warm-up only if the activity needs one, at most 5 minutes. No steps for journaling, reflecting, or reading
  about the method. Setting up a tool is allowed only on the first practice day, at most 5 minutes.
- The first practice day's first step is titled "Baseline test: ..." and captures the user's real current level
  (a count, a timed attempt, a first photo or recording). The last practice day's final step is titled
  "Retest: ..." and repeats it exactly, so the user sees progress within the week.
- Each practice day asks a little more than the one before.
- Use the user's answers: fit the work to their level, equipment, injuries and obstacles.
Rest days:
- ${restMins} minutes, one step: a light task that still moves the goal. Examples: a 5-minute recall pass,
  mobility for the muscles trained, a slow dry run, planning tomorrow's piece.
- The title names that task. Never "Active Recovery & Reflection". Same output and passMark rules apply.
`;
}

function stepText(step: DetailedStep): string {
  return `${step.title} ${step.instructions}`;
}

/** Take minutes from the longest step so the day's total stays the same. Null when no step can spare them. */
function takeMinutes(steps: DetailedStep[], wanted: number): number | null {
  const longest = steps.reduce<DetailedStep | null>((best, step) => (!best || step.durationMinutes > best.durationMinutes ? step : best), null);
  if (!longest || longest.durationMinutes < wanted + 3) return null;
  longest.durationMinutes -= wanted;
  return wanted;
}

function renumber(steps: DetailedStep[]): DetailedStep[] {
  return steps.map((step, index) => ({ ...step, stepNumber: index + 1 }));
}

function isVagueTitle(title: string): boolean {
  return FILLER.test(title) || (VAGUE.test(title) && !/\d/.test(title));
}

/**
 * Fix what doesn't need the model: steps off the work-block library, a day that repeats another,
 * a missing output or pass mark, a category title, a missing baseline or retest.
 * What's left after this (filler steps, setup on later days) goes back to the model.
 */
export function polishWeekTasks(tasks: DailyTaskPlan[], library?: { blocks?: WorkBlock[]; week: number }): DailyTaskPlan[] {
  const onLibrary = library?.blocks?.length ? enforceBlocks(tasks, library.blocks, library.week) : tasks;
  const out = onLibrary.map((task) => ({ ...task, detailedSteps: (task.detailedSteps ?? []).map((step) => ({ ...step })) }));

  for (const task of out) {
    const steps = task.detailedSteps;
    for (const step of steps) {
      if (!step.passMark || step.passMark.trim().length < 8) {
        step.passMark = 'Every part of the instructions done, checked against the cue.';
      }
      if (!step.output?.trim() && /^(baseline test|retest):/i.test(step.title)) {
        step.output = 'Your result, written down.';
      }
    }

    const lead = steps.find((step) => !FILLER.test(step.title) && !/^(baseline test|retest|warm)/i.test(step.title)) ?? steps[0];
    if (isVagueTitle(task.title) && lead && !isVagueTitle(lead.title)) {
      task.title = task.isRestDay ? `Light practice: ${lead.title}` : lead.title;
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
      const work = (first.detailedSteps.find((step) => !/warm[- ]?up/i.test(step.title)) ?? first.detailedSteps[0]).title;
      baseline = {
        stepNumber: 0,
        title: `Baseline test: ${work}`,
        durationMinutes: TEST_MINUTES,
        instructions: `Do "${work}" once at your honest best, with no warm-up tricks, and write down or save the result.`,
        output: 'Your starting result, written down or saved.',
        focusCue: 'Honest effort. This is your starting point, not a performance.',
        pitfallToAvoid: 'Skipping it because you expect a low result.',
        passMark: 'The result is written down or saved where you can find it on the last practice day.',
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
          instructions: `Repeat Day ${first.dayNumber}'s baseline test exactly the same way and put the two results side by side.`,
          output: 'Both results side by side.',
          passMark: `You beat or match your Day ${first.dayNumber} result.`,
        },
      ]);
    }
  }

  return out;
}

/** Everything that makes a day filler rather than real work. Empty when the week is actionable. */
export function taskQualityFailures(tasks: DailyTaskPlan[]): string[] {
  const failures: string[] = [];
  const practice = tasks.filter((task) => !task.isRestDay);
  const firstPractice = practice[0];

  for (const task of tasks) {
    const day = `Day ${task.dayNumber}`;
    const steps = task.detailedSteps ?? [];

    if (isVagueTitle(task.title)) failures.push(`${day} title "${task.title}" names a category, not an action.`);
    if (task.isRestDay && (task.durationMinutes > 20 || steps.length > 2)) {
      failures.push(`${day} is a rest day and should be one short task, not a full session.`);
    }

    for (const step of steps) {
      const label = `${day} step "${step.title}"`;
      if (FILLER.test(step.title)) failures.push(`${label} is filler. Replace it with real work.`);
      if ((step.instructions ?? '').trim().length < MIN_INSTRUCTIONS) failures.push(`${label} does not say exactly what to do.`);
      if (!step.output || step.output.trim().length < 4) failures.push(`${label} has no output.`);
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
