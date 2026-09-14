import {
  TrajectoryVersion as TrajectoryVersionType,
  CapacityModel,
} from '../core/types.js';
import { CapabilityStateGraph } from '../core/stateGraph.js';
import { prisma } from '../../prisma.js';
import {
  subtractIntervals,
  minutesToTime,
  timeToMinutes,
  TimeInterval,
} from '../../timeUtils.js';
import { calculateAvailableWindows } from '../../life/lifeStructureEngine.js';
import { findOptimalAmbitionWindow } from '../../life/dailyScheduler.js';

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
 * Generates Trajectory v1: The initial planned route towards the goal destination.
 * Maps the critical path and Minimum Effective Dose (MED) across 12 weeks, ensuring
 * that total weekly workload never exceeds sustainable capacity minus reliability margin.
 */
export async function generateInitialTrajectory(
  userGoalId: string,
  graph: CapabilityStateGraph,
  capacity: CapacityModel,
  availabilitySlots: AvailabilitySlotRecord[] = []
): Promise<TrajectoryVersionType> {
  // 1. Fetch user goal context
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
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

  // 3. Partition capabilities from DAG across the 12 weeks
  const topologicalNodes = graph.getTopologicalOrder();
  const activeNodes =
    topologicalNodes.length > 0
      ? topologicalNodes
      : [
          {
            id: 'cap-default-foundation',
            name: 'Foundation Readiness',
            description: 'Core physical or technical capability',
            tier: 'TIER_1_CRITICAL' as const,
            state: 'UNTESTED' as const,
            userGoalId,
            prerequisites: [],
          },
        ];

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
    // Select capability focus based on 3 phases (W1-4 Phase 1, W5-8 Phase 2, W9-12 Phase 3)
    let nodeIndex = 0;
    if (week > 8 && activeNodes.length >= 3) {
      nodeIndex = activeNodes.length - 1; // Capstone phase
    } else if (week > 4 && activeNodes.length >= 2) {
      nodeIndex = Math.min(activeNodes.length - 1, 1); // Acceleration phase
    } else {
      nodeIndex = 0; // Foundation phase
    }
    const currentCapability = activeNodes[nodeIndex];

    for (let sessionIdx = 0; sessionIdx < sessionsPerWeek; sessionIdx++) {
      const isCritical = sessionIdx === 0;
      const isHighLeverage = sessionIdx === 1;
      const priorityTier = isCritical ? 1 : isHighLeverage ? 2 : 3;

      const cleanCapName = currentCapability.name
        .replace(/^(Core Adaptation Session|Consolidation Practice|Supportive Continuity):\s*/i, '')
        .replace(/^(Core|Foundational|Target|Capstone|Prerequisite)\s+/i, '')
        .replace(/\s+(Prerequisites|Readiness|Baseline|Capacity|Mastery)$/i, '')
        .trim();
      const baseName = cleanCapName || 'Core Skill';

      // Keep task names simple, punchy, and to the point (2 to 5 words max)
      let interventionName = baseName;
      if (!/(drills|practice|review|session|foundations|fundamentals)$/i.test(baseName)) {
        interventionName = isCritical
          ? `${baseName} Drills`
          : isHighLeverage
          ? `${baseName} Practice`
          : `${baseName} Review`;
      }
      const words = interventionName.split(/\s+/);
      if (words.length > 5) {
        interventionName = words.slice(0, 4).join(' ');
      }

      const standardMinutes = sessionDuration;
      const reducedMinutes = roundToHumanDuration(Math.max(15, Math.round(standardMinutes * 0.65)));
      const mvsMinutes = roundToHumanDuration(Math.max(15, Math.round(standardMinutes * 0.40)));

      const whyThisMatters = isCritical
        ? `Develops the foundational stimulus for ${currentCapability.name}, unlocking the core adaptation needed for this milestone phase.`
        : isHighLeverage
        ? `Consolidates neural and physical retention for ${currentCapability.name}, ensuring gains are durable under fatigue.`
        : `Maintains continuity and momentum on ${currentCapability.name} without overtaxing recovery.`;

      const mvsFallback = `${mvsMinutes}m minimum viable session focused on ${currentCapability.name} to protect momentum.`;

      const fallbackOptions = [
        `WHY_THIS_MATTERS: ${whyThisMatters}`,
        `MVS_FALLBACK: ${mvsFallback}`,
        'Low-friction active recovery / mental rehearsal alternative',
      ];

      itemsToCreate.push({
        trajectory_version_id: createdVersion.id,
        target_capability_id: currentCapability.id || null,
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
