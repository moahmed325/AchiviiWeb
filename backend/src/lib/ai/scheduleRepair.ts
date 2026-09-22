import type { DailyTaskPlan, DetailedStep } from './goalDecomposer.js';

export interface ScheduleRepairResult {
  tasks: DailyTaskPlan[];
  failures: string[];
}

function fitStepMinutes(steps: DetailedStep[], total: number): DetailedStep[] {
  if (steps.length === 0 || total <= 0) return steps.map((step) => ({ ...step }));
  const next = steps.map((step) => ({ ...step, durationMinutes: Math.max(0, step.durationMinutes || 0) }));
  const sum = next.reduce((totalMinutes, step) => totalMinutes + step.durationMinutes, 0);
  if (sum === total) return next;

  if (sum <= 0) {
    const base = Math.floor(total / next.length);
    let leftover = total - base * next.length;
    return next.map((step) => {
      const extra = leftover > 0 ? 1 : 0;
      leftover -= extra;
      return { ...step, durationMinutes: base + extra };
    });
  }

  let used = 0;
  return next.map((step, index) => {
    if (index === next.length - 1) {
      return { ...step, durationMinutes: Math.max(1, total - used) };
    }
    const room = total - used - (next.length - index - 1);
    const share = Math.min(room, Math.max(1, Math.round((step.durationMinutes / sum) * total)));
    used += share;
    return { ...step, durationMinutes: share };
  });
}

function scheduleFailures(tasks: DailyTaskPlan[], dailyMins: number, activeDaysTarget: number): string[] {
  const failures: string[] = [];
  const active = tasks.filter((task) => !task.isRestDay).length;
  if (active !== activeDaysTarget) {
    failures.push(`Week has ${active} practice days; this track needs ${activeDaysTarget}.`);
  }
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].isRestDay && tasks[i - 1].isRestDay) {
      failures.push(`Two rest days are in a row (days ${tasks[i - 1].dayNumber} and ${tasks[i].dayNumber}).`);
    }
  }
  for (const task of tasks) {
    if (task.isRestDay) continue;
    const sum = (task.detailedSteps ?? []).reduce((total, step) => total + (step.durationMinutes || 0), 0);
    if (sum !== dailyMins) {
      failures.push(`Day ${task.dayNumber} steps add up to ${sum} minutes, not ${dailyMins}.`);
    }
  }
  return failures;
}

function nearestPractice(tasks: DailyTaskPlan[], index: number): DailyTaskPlan | undefined {
  for (let distance = 1; distance < tasks.length; distance++) {
    const earlier = tasks[index - distance];
    if (earlier && !earlier.isRestDay && earlier.detailedSteps?.length) return earlier;
    const later = tasks[index + distance];
    if (later && !later.isRestDay && later.detailedSteps?.length) return later;
  }
  return undefined;
}

function asPractice(tasks: DailyTaskPlan[], index: number, dailyMins: number): DailyTaskPlan {
  const onto = tasks[index];
  const source = nearestPractice(tasks, index);
  const steps = source?.detailedSteps?.length
    ? source.detailedSteps.map((step, stepIndex) => ({ ...step, stepNumber: stepIndex + 1 }))
    : [
        {
          stepNumber: 1,
          title: onto.title || 'Practice',
          durationMinutes: dailyMins,
          instructions: onto.title || 'Repeat the current drill.',
          focusCue: 'Same standard as the earlier session.',
          pitfallToAvoid: 'Do not add extra volume.',
          layer: 'adherence' as const,
          layerReasoning: 'Repeated from an earlier session so a missing practice day still follows the plan.',
        },
      ];
  return {
    ...onto,
    title: source?.title || onto.title,
    isRestDay: false,
    durationMinutes: dailyMins,
    implementationIntention: source?.implementationIntention || onto.implementationIntention,
    detailedSteps: fitStepMinutes(steps, dailyMins),
  };
}

function asRest(task: DailyTaskPlan, dailyMins: number): DailyTaskPlan {
  const minutes = dailyMins < 15 ? 10 : 15;
  return {
    ...task,
    title: 'Active Recovery & Reflection',
    isRestDay: true,
    durationMinutes: minutes,
    detailedSteps: [
      {
        stepNumber: 1,
        title: "Review this week's instructions",
        durationMinutes: minutes,
        instructions: 'Read back over the instructions you practised. Write one line on what felt hardest.',
        focusCue: 'Recall first, then check.',
        pitfallToAvoid: 'Do not turn a rest day into an extra practice session.',
        layer: 'safety',
        layerReasoning: 'Rest days keep the weekly load inside the plan track.',
      },
    ],
  };
}

function restNeighborCount(tasks: DailyTaskPlan[], index: number): number {
  let count = 0;
  if (tasks[index - 1]?.isRestDay) count++;
  if (tasks[index + 1]?.isRestDay) count++;
  return count;
}

/**
 * Counts practice days, consecutive rest days, and step minutes after the model writes the week.
 * A broken week is repaired here. Callers only send it back to the model when this still fails.
 */
export function repairWeekSchedule(
  tasks: DailyTaskPlan[],
  dailyMins: number,
  activeDaysTarget: number
): ScheduleRepairResult {
  let next = tasks.map((task) => ({
    ...task,
    detailedSteps: (task.detailedSteps ?? []).map((step) => ({ ...step })),
  }));

  for (let pass = 0; pass < 8; pass++) {
    const failures = scheduleFailures(next, dailyMins, activeDaysTarget);
    const structural = failures.some((failure) => /practice days|in a row/.test(failure));
    if (!structural) break;

    const active = next.filter((task) => !task.isRestDay).length;
    const pairedRest = next.findIndex((task, index) => index > 0 && task.isRestDay && next[index - 1].isRestDay);

    if (pairedRest >= 0) {
      next[pairedRest] = asPractice(next, pairedRest, dailyMins);
      continue;
    }
    if (active < activeDaysTarget) {
      const restIndex = next.findIndex((task) => task.isRestDay);
      if (restIndex < 0) break;
      next[restIndex] = asPractice(next, restIndex, dailyMins);
      continue;
    }
    if (active > activeDaysTarget) {
      const candidate = next
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => !task.isRestDay)
        .sort((a, b) => restNeighborCount(next, a.index) - restNeighborCount(next, b.index))[0];
      if (!candidate) break;
      next[candidate.index] = asRest(candidate.task, dailyMins);
    }
  }

  next = next.map((task) =>
    task.isRestDay ? task : { ...task, durationMinutes: dailyMins, detailedSteps: fitStepMinutes(task.detailedSteps, dailyMins) }
  );

  return { tasks: next, failures: scheduleFailures(next, dailyMins, activeDaysTarget) };
}
