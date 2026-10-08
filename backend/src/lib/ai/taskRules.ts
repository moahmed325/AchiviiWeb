import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';

/** Always filler, whatever numbers are attached. */
const FILLER = /\b(reflect\w*|journal\w*|recap|overview|mindset|resum\w*|getting started)\b|recovery & reflection/i;

/** Filler only when nothing concrete comes with it. Flashcard review with a count is real work. */
const VAGUE = /\b(review|consolidat\w*|introduc\w*|intro to|practice session|work on)\b/i;

/** Preparing a tool, not a body position ("posture setup" is practice). */
const SETUP = /\b(install|download|sign up|create an account|buy|order)\b|\bset ?up (an? |the |your )?(app|account|software|profile|tool)\b/i;

const MAX_FAILURES = 8;
const MIN_INSTRUCTIONS = 25;

function stepText(step: DetailedStep): string {
  return `${step.title} ${step.instructions}`;
}

function isVagueTitle(title: string): boolean {
  return FILLER.test(title) || (VAGUE.test(title) && !/\d/.test(title));
}

/** A missing pass mark and a category title, fixed day by day without touching the week's shape. */
export function polishDays<T extends DailyTaskPlan>(tasks: T[]): T[] {
  const out = tasks.map((task) => ({ ...task, detailedSteps: (task.detailedSteps ?? []).map((step) => ({ ...step })) }));

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
  return out;
}

/** Vague titles, filler steps, missing instructions/output/pass mark, and setup after the first practice day. */
export function dayQualityFailures(tasks: DailyTaskPlan[]): string[] {
  const failures: string[] = [];
  const firstPractice = tasks.find((task) => !task.isRestDay);

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

  return [...new Set(failures)].slice(0, MAX_FAILURES);
}
