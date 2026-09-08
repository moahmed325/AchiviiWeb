import { prisma } from './prisma.js';

export interface ProductSuccessMetrics {
  day_90_engagement: {
    cohort_total: number;
    engaged_count: number;
    rate_percentage: number;
    description: string;
  };
  lapse_recovery_reengagement: {
    lapsed_total: number;
    recovered_count: number;
    rate_percentage: number;
    description: string;
  };
  graduation_reenrollment: {
    graduated_total: number;
    reenrolled_count: number;
    rate_percentage: number;
    description: string;
  };
  calculated_at: string;
}

export interface TelemetryEvent {
  id: string;
  userId?: string;
  eventName: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// In-memory telemetry log
const telemetryBuffer: TelemetryEvent[] = [];

/**
 * Records a client or server-side telemetry event.
 */
export function trackProductEvent(
  eventName: string,
  userId?: string,
  metadata?: Record<string, any>
): TelemetryEvent {
  const event: TelemetryEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    eventName,
    metadata,
    timestamp: new Date().toISOString(),
  };

  telemetryBuffer.push(event);
  if (telemetryBuffer.length > 2000) {
    telemetryBuffer.shift();
  }

  return event;
}

/**
 * Computes the 3 core product success metrics defined in Section 2 of project_plan.md:
 * 1. Day-90 engagement rate (share of users who start a plan and reach the end still engaged)
 * 2. 3+ day lapse recovery re-engagement rate (users who lapse and re-engage via recovery check-in)
 * 3. Graduation re-enrollment rate (share of users who complete/graduate a goal and start a second goal)
 */
export async function calculateProductSuccessMetrics(overrideNow?: Date): Promise<ProductSuccessMetrics> {
  const now = overrideNow || new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // 1. Metric 1: Day-90 Engagement Rate
  // Goals started at least 90 days ago OR goals with elapsed days >= 75
  const allGoals = await prisma.userGoal.findMany({
    include: {
      sessions: true,
      recovery_events: true,
    },
  });

  const day90Cohort = allGoals.filter((g) => {
    const start = new Date(g.start_date);
    const elapsedDays = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return start <= ninetyDaysAgo || elapsedDays >= 75;
  });

  let engagedCount = 0;
  for (const goal of day90Cohort) {
    // Engaged if: status is COMPLETED or has completed sessions in the last 14 days or resolved recovery
    if (goal.status === 'COMPLETED') {
      engagedCount++;
    } else if (goal.status === 'ACTIVE') {
      const recentDone = goal.sessions.some((s) => {
        if (s.status !== 'DONE') return false;
        const ts = s.completed_at_utc ? new Date(s.completed_at_utc) : s.scheduled_date ? new Date(s.scheduled_date) : null;
        if (!ts) return false;
        return (now.getTime() - ts.getTime()) / (1000 * 60 * 60 * 24) <= 14;
      });
      if (recentDone) engagedCount++;
    }
  }

  const day90Rate =
    day90Cohort.length > 0 ? Math.round((engagedCount / day90Cohort.length) * 1000) / 10 : 100.0;

  // 2. Metric 2: 3+ Day Lapse Recovery Re-engagement Rate
  // Users who experienced at least one RecoveryEvent
  const allRecoveryEvents = await prisma.recoveryEvent.findMany({
    include: {
      user_goal: {
        include: { sessions: true },
      },
    },
  });

  // Group by unique user goal
  const goalsWithLapse = new Set(allRecoveryEvents.map((e) => e.user_goal_id));
  let recoveredGoalCount = 0;

  for (const goalId of goalsWithLapse) {
    const goalEvents = allRecoveryEvents.filter((e) => e.user_goal_id === goalId);
    const goal = goalEvents[0]?.user_goal;
    if (!goal) continue;

    // A lapse is successfully recovered if user completed at least 1 session after the earliest recovery event
    const earliestEventTime = Math.min(...goalEvents.map((e) => new Date(e.timestamp).getTime()));
    const subsequentDone = goal.sessions.some((s) => {
      if (s.status !== 'DONE') return false;
      const doneTime = s.completed_at_utc ? new Date(s.completed_at_utc).getTime() : 0;
      return doneTime >= earliestEventTime;
    });

    if (subsequentDone) {
      recoveredGoalCount++;
    }
  }

  const lapseRecoveryRate =
    goalsWithLapse.size > 0
      ? Math.round((recoveredGoalCount / goalsWithLapse.size) * 1000) / 10
      : 100.0;

  // 3. Metric 3: Graduation Re-enrollment Rate
  // Users with at least one COMPLETED goal
  const completedGoals = await prisma.userGoal.findMany({
    where: { status: 'COMPLETED' },
    select: { user_id: true, id: true },
  });

  const graduatedUserIds = Array.from(new Set(completedGoals.map((g) => g.user_id)));
  let reenrolledUserCount = 0;

  for (const userId of graduatedUserIds) {
    const userGoalCount = await prisma.userGoal.count({
      where: { user_id: userId },
    });
    // If user has 2 or more goals, they re-enrolled
    if (userGoalCount >= 2) {
      reenrolledUserCount++;
    }
  }

  const reenrollmentRate =
    graduatedUserIds.length > 0
      ? Math.round((reenrolledUserCount / graduatedUserIds.length) * 1000) / 10
      : 100.0;

  return {
    day_90_engagement: {
      cohort_total: day90Cohort.length,
      engaged_count: engagedCount,
      rate_percentage: day90Rate,
      description: 'Percentage of users reaching the 12-week graduation window who remain active or completed.',
    },
    lapse_recovery_reengagement: {
      lapsed_total: goalsWithLapse.size,
      recovered_count: recoveredGoalCount,
      rate_percentage: lapseRecoveryRate,
      description: 'Percentage of users experiencing a 3+ day lapse who re-engage and complete a subsequent session.',
    },
    graduation_reenrollment: {
      graduated_total: graduatedUserIds.length,
      reenrolled_count: reenrolledUserCount,
      rate_percentage: reenrollmentRate,
      description: 'Percentage of users graduating a first goal who start a subsequent goal.',
    },
    calculated_at: now.toISOString(),
  };
}

/**
 * Resets in-memory telemetry buffer for test environments.
 */
export function resetTelemetryBuffer(): void {
  telemetryBuffer.length = 0;
}
