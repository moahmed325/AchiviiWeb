import {
  TrajectoryVersion as TrajectoryVersionType,
  CapacityModel,
} from '../core/types.js';
import { prisma } from '../../prisma.js';
import {
  subtractIntervals,
  minutesToTime,
  timeToMinutes,
  TimeInterval,
} from '../../timeUtils.js';
import { calculateAvailableWindows } from '../../life/lifeStructureEngine.js';
import { findOptimalAmbitionWindow } from '../../life/dailyScheduler.js';
import { generateDeterministicFieldManual } from '../../life/fieldManualEngine.js';

export interface AvailabilitySlotRecord {
  day_of_week: string; // 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
  start_time: string;  // "09:00"
  end_time: string;    // "17:00"
  label?: string | null;
}

/**
 * Snaps raw minute durations to standard human intervals (20m, 30m, 45m, 60m, 75m).
 */
export function roundToHumanDuration(mins: number): number {
  if (mins < 25) return 20;
  if (mins < 38) return 30;
  if (mins < 53) return 45;
  if (mins < 68) return 60;
  if (mins < 83) return 75;
  return Math.round(mins / 15) * 15;
}

/**
 * Generates progressive, distinct session titles across 12 weeks to avoid repetitive naming.
 */
function getProgressiveSessionName(baseName: string, week: number, sessionIdx: number): string {
  if (week === 1) {
    if (sessionIdx === 0) return `${baseName} Setup & Setup Drills`;
    if (sessionIdx === 1) return `${baseName} Foundations`;
    return `${baseName} Baseline Check`;
  }
  if (week === 2) {
    if (sessionIdx === 0) return `${baseName} Core Patterns`;
    if (sessionIdx === 1) return `${baseName} Guided Practice`;
    return `${baseName} Retention Check`;
  }
  if (week === 3) {
    if (sessionIdx === 0) return `${baseName} First Increment`;
    if (sessionIdx === 1) return `${baseName} Technique Sprint`;
    return `${baseName} Error Handling`;
  }
  if (week === 4) {
    if (sessionIdx === 0) return `${baseName} Milestone Integration`;
    if (sessionIdx === 1) return `${baseName} Sprint Trial`;
    return `${baseName} Phase 1 Audit`;
  }
  if (week === 5) {
    if (sessionIdx === 0) return `${baseName} Feature Sprint`;
    if (sessionIdx === 1) return `${baseName} Deep Work Block`;
    return `${baseName} Gap Analysis`;
  }
  if (week === 6) {
    if (sessionIdx === 0) return `${baseName} Progressive Overload`;
    if (sessionIdx === 1) return `${baseName} Volume Ramp`;
    return `${baseName} Quality Check`;
  }
  if (week === 7) {
    if (sessionIdx === 0) return `${baseName} Complex Integration`;
    if (sessionIdx === 1) return `${baseName} Endurance Block`;
    return `${baseName} Refactoring Sprint`;
  }
  if (week === 8) {
    if (sessionIdx === 0) return `${baseName} Midway Benchmark`;
    if (sessionIdx === 1) return `${baseName} Diagnostic Trial`;
    return `${baseName} Phase 2 Audit`;
  }
  if (week === 9) {
    if (sessionIdx === 0) return `${baseName} Polish & Hardening`;
    if (sessionIdx === 1) return `${baseName} Edge Cases`;
    return `${baseName} Performance Optimization`;
  }
  if (week === 10) {
    if (sessionIdx === 0) return `${baseName} User Flow Drill`;
    if (sessionIdx === 1) return `${baseName} Staging Test`;
    return `${baseName} Friction Hunt`;
  }
  if (week === 11) {
    if (sessionIdx === 0) return `${baseName} Production Rehearsal`;
    if (sessionIdx === 1) return `${baseName} Pre-Launch Verification`;
    return `${baseName} Readiness Audit`;
  }
  // Week 12
  if (sessionIdx === 0) return `${baseName} Capstone Demonstration`;
  if (sessionIdx === 1) return `${baseName} Final Delivery`;
  return `${baseName} Graduation Review`;
}

/**
 * Generates Trajectory v1: The initial planned route towards the goal destination.
 * Maps sessions across 12 weeks, ensuring that total weekly workload never
 * exceeds sustainable capacity minus reliability margin.
 */
export async function generateInitialTrajectory(
  userGoalId: string,
  capacity: CapacityModel,
  availabilitySlots: AvailabilitySlotRecord[] = []
): Promise<TrajectoryVersionType> {
  // 1. Fetch user goal context
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: { goal_catalog: true },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" does not exist.`);
  }

  const startDate = new Date(userGoal.start_date);
  const targetEndDate = new Date(userGoal.target_end_date || startDate.getTime() + 84 * 24 * 60 * 60 * 1000);

  // 2. Compute weekly workload budget:
  // Invariant: Total planned work <= Sustainable Capacity - Reliability Margin (= MED)
  const maxWeeklyHours = Math.max(
    1.5,
    capacity.sustainableWeeklyHours - capacity.reliabilityMarginHours
  );
  const maxWeeklyMinutes = Math.round(maxWeeklyHours * 60);

  // Determine sessions per week (3 or 4) and duration
  const sessionsPerWeek = maxWeeklyMinutes >= 240 ? 4 : 3;
  const rawDuration = Math.max(20, Math.floor(maxWeeklyMinutes / sessionsPerWeek));
  const sessionDuration = roundToHumanDuration(rawDuration);

  // 3. Goal theme base name for session synthesis
  const baseGoalTitle = (userGoal.outcome_statement || userGoal.goal_catalog?.title || 'Core Skill')
    .replace(/^(Launch|Run|Build|Learn|Complete|Achieve)\s+/i, '')
    .trim();

  // 4. Create TrajectoryVersion record in DB
  const createdVersion = await prisma.trajectoryVersion.create({
    data: {
      user_goal_id: userGoalId,
      version_number: 1,
      trigger_type: 'INITIAL_TRAJECTORY',
      projected_completion: targetEndDate,
      confidence_score: 0.85,
      is_active: true,
    },
  });

  // 5. Generate Trajectory Items across 12 weeks
  const itemsToCreate: Array<{
    trajectory_version_id: string;
    target_capability_id: string | null;
    intervention_name: string;
    planned_week: number;
    priority_tier: number;
    standard_duration_minutes: number;
    reduced_duration_minutes: number;
    mvs_duration_minutes: number;
    fallback_options: string[];
  }> = [];

  for (let week = 1; week <= 12; week++) {
    // 3 phases: W1-4 Phase 1 Foundation, W5-8 Phase 2 Core Acceleration, W9-12 Phase 3 Capstone Mastery
    const phaseName = week > 8
      ? `${baseGoalTitle} Capstone`
      : week > 4
      ? `${baseGoalTitle} Acceleration`
      : `${baseGoalTitle} Foundation`;

    for (let sessionIdx = 0; sessionIdx < sessionsPerWeek; sessionIdx++) {
      const isCritical = sessionIdx === 0;
      const isHighLeverage = sessionIdx === 1;
      const priorityTier = isCritical ? 1 : isHighLeverage ? 2 : 3;

      const baseWords = (baseGoalTitle || 'Core Skill').split(/\s+/);
      const shortBase = baseWords.slice(0, 2).join(' ');
      let interventionName = getProgressiveSessionName(shortBase, week, sessionIdx);

      const standardMinutes = sessionDuration;
      const reducedMinutes = roundToHumanDuration(Math.max(15, Math.round(standardMinutes * 0.65)));
      const mvsMinutes = roundToHumanDuration(Math.max(15, Math.round(standardMinutes * 0.40)));

      const whyThisMatters = isCritical
        ? `Develops the foundational stimulus for ${phaseName}, unlocking the core adaptation needed for this milestone phase.`
        : isHighLeverage
        ? `Consolidates retention for ${phaseName}, ensuring gains are durable under fatigue.`
        : `Maintains continuity and momentum on ${phaseName} without overtaxing recovery.`;

      const mvsFallback = `${mvsMinutes}m minimum viable session focused on ${phaseName} to protect momentum.`;

      // Pre-calculate structured field manual
      const fieldManual = generateDeterministicFieldManual(
        interventionName,
        (userGoal as any).category,
        standardMinutes,
        userGoal.outcome_statement || undefined
      );

      const fallbackOptions = [
        `WHY_THIS_MATTERS: ${whyThisMatters}`,
        `MVS_FALLBACK: ${mvsFallback}`,
        `FIELD_MANUAL: ${JSON.stringify(fieldManual)}`,
        'Low-friction active recovery / mental rehearsal alternative',
      ];

      itemsToCreate.push({
        trajectory_version_id: createdVersion.id,
        target_capability_id: null,
        intervention_name: interventionName,
        planned_week: week,
        priority_tier: priorityTier,
        standard_duration_minutes: standardMinutes,
        reduced_duration_minutes: reducedMinutes,
        mvs_duration_minutes: mvsMinutes,
        fallback_options: fallbackOptions,
      });
    }
  }

  // Bulk insert items into database
  for (const item of itemsToCreate) {
    await prisma.trajectoryItem.create({
      data: {
        trajectory_version_id: item.trajectory_version_id,
        target_capability_id: item.target_capability_id,
        intervention_name: item.intervention_name,
        planned_week: item.planned_week,
        priority_tier: item.priority_tier,
        standard_duration_minutes: item.standard_duration_minutes,
        reduced_duration_minutes: item.reduced_duration_minutes,
        mvs_duration_minutes: item.mvs_duration_minutes,
        fallback_options: item.fallback_options,
      },
    });
  }

  // 6. Materialize Week 1 sessions into concrete sessions table if availabilitySlots provided
  const week1Items = await prisma.trajectoryItem.findMany({
    where: {
      trajectory_version_id: createdVersion.id,
      planned_week: 1,
    },
    orderBy: { priority_tier: 'asc' },
  });

  const dayKeyMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Match each session to available user slots
  for (let i = 0; i < week1Items.length; i++) {
    const item = week1Items[i];
    const sessionDayOffset = i * 2; // e.g. Day 0, Day 2, Day 4
    const sessionDate = new Date(startDate.getTime() + sessionDayOffset * 24 * 60 * 60 * 1000);
    const dayName = dayKeyMap[sessionDate.getDay()];

    const dateStr = sessionDate.toISOString().split('T')[0];
    const jsDay = sessionDate.getDay();

    let startTime = jsDay === 0 || jsDay === 6 ? '10:00' : '17:15';
    let endTime = jsDay === 0 || jsDay === 6 ? '10:45' : '18:00';

    try {
      const openWindows = await calculateAvailableWindows(userGoal.user_id, dateStr);
      const optimal = findOptimalAmbitionWindow(openWindows, {
        nominalMinutes: item.standard_duration_minutes || 45,
        mvdMinutes: item.mvs_duration_minutes || 20,
        preferredWindow: (item as any).preferred_window,
        energyRequirement: item.priority_tier === 1 ? 'HIGH' : 'MEDIUM',
      });

      if (optimal) {
        startTime = minutesToTime(optimal.startMins);
        endTime = minutesToTime(optimal.endMins);
      } else {
        const [sh, sm] = startTime.split(':').map(Number);
        const totalMinutes = (sh || 17) * 60 + (sm || 15) + (item.standard_duration_minutes || 45);
        const eh = Math.floor(totalMinutes / 60);
        const em = totalMinutes % 60;
        endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      }
    } catch {
      // Safe fallback timing outside standard work hours
    }

    // Link or create TaskTemplate placeholder if needed for DB schema constraint
    let taskTemplateId: string | null = userGoal.selected_roadmap_id;
    if (!taskTemplateId) {
      const firstTemplate = await prisma.taskTemplate.findFirst();
      taskTemplateId = firstTemplate?.id || null;
    }

    if (taskTemplateId) {
      await prisma.session.create({
        data: {
          user_goal_id: userGoalId,
          task_template_id: taskTemplateId,
          day_number: sessionDayOffset + 1,
          sequence_order: i + 1,
          scheduled_date: sessionDate,
          start_time: startTime,
          end_time: endTime,
          status: 'UPCOMING',
          execution_state: 'PLANNED',
          tier: item.priority_tier === 1 ? 'core' : item.priority_tier === 2 ? 'buffer' : 'reflect',
          trajectory_item_id: item.id,
        },
      });
    }
  }

  // 7. Return complete TrajectoryVersion
  const persistedWithItems = await prisma.trajectoryVersion.findUnique({
    where: { id: createdVersion.id },
    include: { items: true },
  });

  return {
    id: createdVersion.id,
    userGoalId,
    versionNumber: createdVersion.version_number,
    trigger: createdVersion.trigger_type,
    items: persistedWithItems?.items || [],
    projectedCompletionDate: createdVersion.projected_completion,
    confidence: 'HIGH',
  };
}
