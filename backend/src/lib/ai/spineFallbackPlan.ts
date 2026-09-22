import type {
  DailyTaskPlan,
  DetailedStep,
  PlanGenerationResult,
  RoadmapWeekPlan,
} from './goalDecomposer.js';
import { formatMethodologyNotes, type PlanGrounding } from '../research/planGrounding.js';
import type { VelocityTable } from '../research/types.js';
import { asBlockStep, blocksForWeek, type WorkBlock } from '../method/blocks.js';
import { polishWeekTasks } from './taskRules.js';

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

function blankStep(stepNumber: number, durationMinutes: number): DetailedStep {
  return { stepNumber, title: '', durationMinutes, instructions: '', focusCue: '', pitfallToAvoid: '' };
}

/**
 * A varied week from the work blocks: the two top practice blocks alternate as the lead, the middle step
 * rotates through the rest, and a real-thing block closes each day.
 */
function buildBlockWeek(input: SpineWeekTasksInput, weekNumber: number): DailyTaskPlan[] {
  const { grounding, dailyMins, slotTime, weekStartDate, planVariant } = input;
  const ranked = blocksForWeek(grounding.blocks!, weekNumber);
  const real = ranked.filter((block) => block.realThing);
  const practice = ranked.filter((block) => !block.realThing);
  const restDays = spineRestDayIndices(planVariant);
  const restMins = dailyMins < 15 ? 10 : 15;
  const wantSteps = dailyMins >= 20 ? 3 : 2;
  const tasks: DailyTaskPlan[] = [];
  let active = 0;

  for (let d = 0; d < 7; d++) {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + d);
    const dayOfWeek = DAY_NAMES[date.getDay()];
    const dayNumber = (weekNumber - 1) * 7 + d + 1;

    if (restDays.includes(d)) {
      const block = practice[active % Math.max(1, practice.length)] ?? ranked[0];
      tasks.push({
        dayNumber,
        dayOfWeek,
        title: `Light practice: ${block.name}`,
        isRestDay: true,
        durationMinutes: restMins,
        slotTime,
        implementationIntention: `When: ${slotTime} | Where: your usual spot | Action: an easy round of ${block.name}`,
        detailedSteps: [
          {
            ...asBlockStep(blankStep(1, restMins), block),
            title: `Easy ${block.name}`,
            instructions: `Slowly and at half effort: ${block.action}`,
            passMark: 'Done slowly without a single mistake.',
          },
        ],
      });
      continue;
    }

    const picks: WorkBlock[] = [];
    const lead = practice.length ? practice[active % Math.min(2, practice.length)] : ranked[0];
    picks.push(lead);
    if (wantSteps === 3) {
      const middle =
        practice.length > 2 ? practice[2 + (active % (practice.length - 2))] : ranked.find((block) => !picks.includes(block));
      if (middle && !picks.includes(middle)) picks.push(middle);
    }
    const closer = real.length ? real[active % real.length] : ranked.find((block) => !picks.includes(block));
    if (closer && !picks.includes(closer)) picks.push(closer);

    const minutes = splitMinutes(dailyMins, picks.length);
    const steps = picks.map((block, i) => asBlockStep(blankStep(i + 1, minutes[i]), block));
    tasks.push({
      dayNumber,
      dayOfWeek,
      title: closer && closer !== lead ? `${lead.name}, then ${closer.name}` : lead.name,
      isRestDay: false,
      durationMinutes: dailyMins,
      slotTime,
      implementationIntention: `When: ${slotTime} | Where: your usual spot | Action: ${lead.name}`,
      detailedSteps: steps,
    });
    active++;
  }

  return tasks;
}

/**
 * A week of tasks built only from the researched teachings. Used when every model call failed,
 * so the user still gets a sourced week instead of an error.
 */
export function buildSpineWeekTasks(input: SpineWeekTasksInput): DailyTaskPlan[] {
  const { grounding, dailyMins, slotTime, weekStartDate, planVariant } = input;
  const weekNumber = input.weekNumber ?? 1;
  if (grounding.blocks?.length) {
    return polishWeekTasks(buildBlockWeek(input, weekNumber), { blocks: grounding.blocks, week: weekNumber });
  }
  const teachings = grounding.teachings;
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
            output: 'One slow, clean practice round.',
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
      const teaching = teachings[(activeIndex * stepsPerDay + s) % teachings.length];
      const withTarget = s === 0 && targets ? `${teaching} This week's target: ${targets}.` : teaching;
      const test = s === 0 && testDay ? ' Start with a 2-minute test of your current level and log the result.' : '';
      const step: DetailedStep = {
        stepNumber: s + 1,
        title: shortTitle(teaching),
        durationMinutes: stepMins,
        instructions: `${stepMins} minutes: ${withTarget}${test}`,
        output: s === 0 && testDay ? 'Your test result, written down.' : 'The steps above done as written.',
        focusCue: 'Follow the instruction as written. Slow and correct beats fast.',
        pitfallToAvoid: 'Do not add extra volume or skip ahead of this week.',
        passMark: targets && s === 0 ? `Reach this week's target: ${targets}.` : 'Every repetition matches the instruction exactly.',
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
