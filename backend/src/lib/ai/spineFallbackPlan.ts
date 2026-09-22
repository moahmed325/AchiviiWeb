import type {
  DailyTaskPlan,
  DetailedStep,
  PlanGenerationResult,
  RoadmapWeekPlan,
} from './goalDecomposer.js';
import { formatMethodologyNotes, type PlanGrounding } from '../research/planGrounding.js';
import type { VelocityTable } from '../research/types.js';
import { drillsForWeek } from '../method/drills.js';

type PlanVariant = 'minimal' | 'steady' | 'accelerated';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MILESTONE_GATES: Record<number, string> = {
  4: 'Phase 1 Foundation Milestone Gate: Mechanics & Posture Diagnostic',
  8: 'Phase 2 Acceleration Milestone Gate: Tempo & Fluency Benchmark',
  12: 'Phase 3 Mastery Capstone Verification & Final Proof of Achievement',
};

const INTENSITY = [60, 63, 66, 70, 75, 78, 81, 85, 90, 93, 96, 100];

/** Same rest pattern as the certified presets: never two rest days in a row. */
export function spineRestDayIndices(variant: PlanVariant): number[] {
  return variant === 'minimal' ? [2, 4, 6] : variant === 'accelerated' ? [6] : [3, 6];
}

function phaseFor(week: number): RoadmapWeekPlan['phase'] {
  return week <= 4 ? 'Foundation' : week <= 8 ? 'Acceleration' : 'Mastery';
}

function shortTitle(text: string): string {
  const sentence = text.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '').trim();
  const words = sentence.split(/\s+/);
  return words.length <= 8 ? sentence : `${words.slice(0, 8).join(' ')}…`;
}

function roundLike(value: number, a: number, b: number): number {
  return Number.isInteger(a) && Number.isInteger(b) ? Math.round(value) : Math.round(value * 10) / 10;
}

/** Linear interpolation of the researched week-1 → week-12 targets. No new numbers are introduced. */
export function spineTargetsForWeek(table: VelocityTable | null, week: number): string {
  if (!table) return '';
  const end = new Map(table.week12Targets.map((target) => [target.metric, target]));
  return table.week1Targets
    .map((start) => {
      const finish = end.get(start.metric);
      if (!finish) return week === 1 ? `${start.metric} ${start.value} ${start.unit}` : '';
      const value = start.value + ((finish.value - start.value) * (week - 1)) / 11;
      return `${start.metric} ${roundLike(value, start.value, finish.value)} ${start.unit}`;
    })
    .filter(Boolean)
    .join('; ');
}

function mainSourceUrl(grounding: PlanGrounding): string | undefined {
  if (grounding.sourceUrl && grounding.allowedUrls.includes(grounding.sourceUrl)) return grounding.sourceUrl;
  return grounding.allowedUrls[0];
}

export function buildSpineWeeks(grounding: PlanGrounding, dailyMins: number): RoadmapWeekPlan[] {
  const teachings = grounding.teachings;
  return Array.from({ length: 12 }, (_, index) => {
    const week = index + 1;
    const teaching = teachings[index % teachings.length];
    const targets = spineTargetsForWeek(grounding.velocityTable, week);
    return {
      weekNumber: week,
      phase: phaseFor(week),
      theme: `${phaseFor(week)}: ${shortTitle(teaching)}`,
      objective: targets ? `${teaching} Target this week: ${targets}.` : teaching,
      keyMilestone:
        MILESTONE_GATES[week] ?? (targets ? `Hit this week's target: ${targets}.` : `Complete every session of: ${shortTitle(teaching)}.`),
      targetIntensity: INTENSITY[index],
      plannedMinutes: dailyMins,
    };
  });
}

function splitMinutes(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  return Array.from({ length: parts }, (_, i) => (i === parts - 1 ? total - base * (parts - 1) : base));
}

export interface SpineWeekTasksInput {
  grounding: PlanGrounding;
  dailyMins: number;
  slotTime: string;
  weekStartDate: Date;
  planVariant: PlanVariant;
  weekNumber?: number;
}

/**
 * A week of tasks built only from the researched teachings. Used when every model call failed,
 * so the user still gets a sourced week instead of an error.
 */
export function buildSpineWeekTasks(input: SpineWeekTasksInput): DailyTaskPlan[] {
  const { grounding, dailyMins, slotTime, weekStartDate, planVariant } = input;
  const weekNumber = input.weekNumber ?? 1;
  // Only the top drills of the stage: the week's time goes to what moves the goal most.
  const drills = grounding.drills?.length ? drillsForWeek(grounding.drills, weekNumber).slice(0, 4) : [];
  const teachings = drills.length ? drills.map((drill) => `${drill.name}. ${drill.dose}.`) : grounding.teachings;
  const restDays = spineRestDayIndices(planVariant);
  const activePerWeek = 7 - restDays.length;
  const stepsPerDay = Math.max(1, Math.min(3, teachings.length));
  const sourceUrl = mainSourceUrl(grounding);
  const targets = spineTargetsForWeek(grounding.velocityTable, weekNumber);
  const restMins = dailyMins < 15 ? 10 : 15;

  const activeDays = Array.from({ length: 7 }, (_, d) => d).filter((d) => !restDays.includes(d));
  const firstActiveDay = activeDays[0];
  const lastActiveDay = activeDays[activeDays.length - 1];
  let activeIndex = (weekNumber - 1) * activePerWeek;
  const tasks: DailyTaskPlan[] = [];

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + d);
    const dayOfWeek = DAY_NAMES[date.getDay()];
    const dayNumber = (weekNumber - 1) * 7 + d + 1;

    if (restDays.includes(d)) {
      const teaching = teachings[Math.max(0, activeIndex * stepsPerDay - 1) % teachings.length];
      const drill = shortTitle(teaching);
      tasks.push({
        dayNumber,
        dayOfWeek,
        title: `Light practice: ${drill} (${restMins} min)`,
        isRestDay: true,
        durationMinutes: restMins,
        slotTime,
        implementationIntention: `When: ${slotTime} | Where: your usual practice spot | Action: ${restMins} easy minutes of ${drill}`,
        detailedSteps: [
          {
            stepNumber: 1,
            title: `Easy ${drill}`,
            durationMinutes: restMins,
            instructions: `${restMins} minutes, slowly and at half effort: ${teaching}`,
            focusCue: 'Slow and clean. This is practice, not a test.',
            pitfallToAvoid: 'Do not turn a rest day into a full session.',
            passMark: 'You can do it slowly without a single mistake.',
          },
        ],
      });
      continue;
    }

    const minutes = splitMinutes(dailyMins, stepsPerDay);
    const testDay = d === firstActiveDay || d === lastActiveDay;
    const steps: DetailedStep[] = minutes.map((stepMins, s) => {
      const index = (activeIndex * stepsPerDay + s) % teachings.length;
      const teaching = teachings[index];
      const drill = drills[index];
      const withTarget = s === 0 && targets ? `${teaching} This week's target: ${targets}.` : teaching;
      const test = s === 0 && testDay ? ' Start with a 2-minute test of your current level and log the result.' : '';
      const step: DetailedStep = {
        stepNumber: s + 1,
        title: drill?.name ?? shortTitle(teaching),
        durationMinutes: stepMins,
        instructions: `${stepMins} minutes: ${withTarget}${test}`,
        focusCue: drill?.cue ?? 'Follow the instruction as written. Slow and correct beats fast.',
        pitfallToAvoid: drill?.pitfall ?? 'Do not add extra volume or skip ahead of this week.',
        passMark:
          targets && s === 0
            ? `Reach this week's target: ${targets}.`
            : drill?.passMark ?? 'Every repetition matches the instruction exactly.',
        challenge: {
          type: 'checklist',
          items: [{ id: 'c1', label: shortTitle(teaching) }],
        },
      };
      if (s === 0 && sourceUrl) {
        step.resourceTitle = 'Main source this plan was built from';
        step.resourceUrl = sourceUrl;
        step.resourceType = 'guide';
        step.resourceWhy = 'The page these instructions were taken from.';
      }
      return step;
    });
    activeIndex++;

    tasks.push({
      dayNumber,
      dayOfWeek,
      title: `${steps[0].title}: ${dailyMins} min`,
      isRestDay: false,
      durationMinutes: dailyMins,
      slotTime,
      implementationIntention: `When: ${slotTime} | Where: your usual practice spot | Action: ${steps[0].title}`,
      detailedSteps: steps,
    });
  }

  return tasks;
}

export function buildSpineFallbackPlan(input: {
  grounding: PlanGrounding;
  clarifiedOutcome: string;
  dailyMins: number;
  slotTime: string;
  startDate: Date;
  planVariant: PlanVariant;
}): PlanGenerationResult {
  return {
    clarifiedOutcome: input.clarifiedOutcome,
    methodologyNotes: `${formatMethodologyNotes(input.grounding)} Built directly from the sourced instructions.`.trim(),
    weeks: buildSpineWeeks(input.grounding, input.dailyMins),
    initialTasks: buildSpineWeekTasks({
      grounding: input.grounding,
      dailyMins: input.dailyMins,
      slotTime: input.slotTime,
      weekStartDate: input.startDate,
      planVariant: input.planVariant,
    }),
    planSource: 'spine_fallback',
  };
}
