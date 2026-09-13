import { prisma } from '../prisma.js';
import { calculateAvailableWindows } from './lifeStructureEngine.js';

export interface CapacityAudit {
  total_weekly_free_hours: number;
  committed_ambition_hours: number;
  safe_capacity_limit_hours: number; // 80% of total free hours
  capacity_utilization_pct: number;
  is_overloaded: boolean;
  active_ambitions_count: number;
  recommendations: string[];
}

/**
 * Computes weekly available capacity and verifies whether active ambitions
 * fit comfortably within the user's life structure.
 */
export async function auditUserCapacity(userId: string): Promise<CapacityAudit> {
  // 1. Calculate free hours across a representative 7-day week
  const today = new Date();
  let totalWeeklyFreeHours = 0;

  for (let d = 0; d < 7; d++) {
    const checkDate = new Date(today.getTime() + d * 24 * 60 * 60 * 1000);
    const dateStr = checkDate.toISOString().split('T')[0];
    const windows = await calculateAvailableWindows(userId, dateStr);
    const dayFreeMins = windows.reduce((acc, w) => acc + w.duration_minutes, 0);
    totalWeeklyFreeHours += dayFreeMins / 60;
  }

  totalWeeklyFreeHours = Math.round(totalWeeklyFreeHours * 10) / 10;
  const safeCapacityLimitHours = Math.round(totalWeeklyFreeHours * 0.8 * 10) / 10;

  // 2. Tally total committed hours across all active ambitions
  const activeGoals = await prisma.userGoal.findMany({
    where: {
      user_id: userId,
      status: 'ACTIVE',
    },
    include: {
      goal_catalog: true,
      trajectory_versions: {
        where: { is_active: true },
        include: {
          items: true,
        },
      },
    },
    orderBy: { priority_rank: 'asc' },
  });

  let committedHours = 0;
  for (const g of activeGoals) {
    // Determine weekly hours either from catalog goal or estimated items
    if (g.goal_catalog?.est_weekly_hours) {
      committedHours += g.goal_catalog.est_weekly_hours;
    } else {
      // Approximate from active trajectory items (sum of estimated minutes for week 1 / 60)
      const week1Items = (g.trajectory_versions[0]?.items || []).filter(
        (i: any) => i.week_number === 1 || i.week_number === undefined
      );
      const mins = week1Items.reduce((acc: number, i: any) => acc + (i.estimated_minutes || 60), 0);
      committedHours += mins > 0 ? mins / 60 : 5;
    }
  }

  committedHours = Math.round(committedHours * 10) / 10;
  const utilizationPct = totalWeeklyFreeHours > 0
    ? Math.round((committedHours / totalWeeklyFreeHours) * 100)
    : 100;
  const isOverloaded = committedHours > safeCapacityLimitHours;

  const recommendations: string[] = [];
  if (isOverloaded) {
    recommendations.push(
      `Warning: You have committed ${committedHours}h/wk across ${activeGoals.length} ambitions, exceeding your safe weekly capacity (${safeCapacityLimitHours}h/wk).`
    );
    recommendations.push('Consider pausing a secondary ambition or switching to Minimum Viable Doses to protect your recovery.');
  } else if (utilizationPct > 65) {
    recommendations.push('High ambition load: Your schedule is well-utilized. Maintain buffer times between deep work blocks.');
  } else {
    recommendations.push('Healthy capacity balance: You have sufficient cognitive margin for unexpected life interruptions.');
  }

  return {
    total_weekly_free_hours: totalWeeklyFreeHours,
    committed_ambition_hours: committedHours,
    safe_capacity_limit_hours: safeCapacityLimitHours,
    capacity_utilization_pct: utilizationPct,
    is_overloaded: isOverloaded,
    active_ambitions_count: activeGoals.length,
    recommendations,
  };
}

/**
 * Re-prioritizes active ambitions for a user.
 */
export async function updateAmbitionPriorities(
  userId: string,
  orderedGoalIds: string[]
) {
  const updates = orderedGoalIds.map((goalId, index) =>
    prisma.userGoal.updateMany({
      where: {
        id: goalId,
        user_id: userId,
      },
      data: {
        priority_rank: index + 1,
      },
    })
  );

  await prisma.$transaction(updates);
  return prisma.userGoal.findMany({
    where: { user_id: userId, status: 'ACTIVE' },
    orderBy: { priority_rank: 'asc' },
  });
}
