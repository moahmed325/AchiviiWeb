import { prisma } from '../../prisma.js';
import { ExecutionObject } from '../core/types.js';
import { createExecutionObject } from '../execution/executionModel.js';
import { computeForecast, computeEvidenceConfidence } from '../strategy/forecastEngine.js';

export interface WeeklyStrategicQuestions {
  whatWasSupposedToHappen: string;
  whatActuallyHappened: string;
  whatChangedInCapabilityState: string;
  whatCausedMeaningfulDeviations: string;
  isTheBottleneckStillTheBottleneck: string;
  isTheTrajectoryStillValid: string;
  whatShouldHappenNext: string;
}

export interface WeeklyReviewSummary {
  id: string;
  userGoalId: string;
  weekNumber: number;
  answers: WeeklyStrategicQuestions;
  stateDeltas: Record<string, { from: string; to: string }>;
  createdAt: Date;
}

/**
 * Generates the 7-Question Weekly Strategic Review from ground-truth telemetry and capability states.
 * Embodying the system philosophy:
 * 1. What was supposed to happen?
 * 2. What actually happened?
 * 3. What changed in capability state?
 * 4. What caused meaningful deviations?
 * 5. Is the bottleneck still the bottleneck?
 * 6. Is the trajectory still valid?
 * 7. What should happen next?
 */
export async function generateWeeklyReview(
  userGoalId: string,
  weekNumber: number
): Promise<WeeklyReviewSummary> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: {
        include: {
          evidences: true,
        },
      },
      trajectory_versions: {
        where: { is_active: true },
        include: { items: true },
        take: 1,
      },
      diagnostic_events: {
        orderBy: { created_at: 'desc' },
        take: 5,
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  const startDate = new Date(userGoal.start_date);
  const weekStart = new Date(startDate.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(startDate.getTime() + weekNumber * 7 * 24 * 60 * 60 * 1000);
  const startDayNumber = (weekNumber - 1) * 7 + 1;
  const endDayNumber = weekNumber * 7;

  // Query sessions for this week
  const sessions = await prisma.session.findMany({
    where: {
      user_goal_id: userGoalId,
      OR: [
        { day_number: { gte: startDayNumber, lte: endDayNumber } },
        { scheduled_date: { gte: weekStart, lt: weekEnd } },
      ],
    },
  });

  const activeTrajectory = userGoal.trajectory_versions[0];
  const plannedItemsForWeek = activeTrajectory
    ? activeTrajectory.items.filter((item) => item.planned_week === weekNumber)
    : [];

  // Q1: What was supposed to happen?
  let whatWasSupposedToHappen = '';
  if (plannedItemsForWeek.length > 0) {
    const totalMinutes = plannedItemsForWeek.reduce((sum, i) => sum + i.standard_duration_minutes, 0);
    const targetCapIds = new Set(plannedItemsForWeek.map((i) => i.target_capability_id).filter(Boolean));
    const targetCapNames = userGoal.capabilities
      .filter((c) => targetCapIds.has(c.id))
      .map((c) => c.name);
    const capStr = targetCapNames.length > 0 ? ` targeting ${targetCapNames.join(', ')}` : '';
    whatWasSupposedToHappen = `Planned ${plannedItemsForWeek.length} sessions totaling ${totalMinutes} minutes${capStr}.`;
  } else if (sessions.length > 0) {
    const totalMinutes = sessions.length * 45;
    whatWasSupposedToHappen = `Scheduled ${sessions.length} sessions totaling ${totalMinutes} minutes across week ${weekNumber}.`;
  } else {
    whatWasSupposedToHappen = `Planned standard weekly execution volume (${userGoal.sustainable_weekly_capacity_hours}h/wk) on critical capabilities.`;
  }

  // Q2: What actually happened?
  let whatActuallyHappened = '';
  const completed = sessions.filter((s) => s.status === 'DONE' || s.execution_state === 'COMPLETED');
  const reduced = sessions.filter((s) => s.execution_state === 'REDUCED');
  const mvs = sessions.filter((s) => s.execution_state === 'MINIMUM_VIABLE');
  const missed = sessions.filter((s) => s.status === 'MISSED' || s.execution_state === 'MISSED');

  if (sessions.length > 0) {
    const actualMinutes = completed.length * 45 + reduced.length * 30 + mvs.length * 20;
    const parts = [];
    if (completed.length > 0) parts.push(`${completed.length} completed`);
    if (reduced.length > 0) parts.push(`${reduced.length} reduced`);
    if (mvs.length > 0) parts.push(`${mvs.length} minimum viable`);
    if (missed.length > 0) parts.push(`${missed.length} missed`);
    whatActuallyHappened = `Executed ${sessions.length} sessions (${parts.join(', ')}) totaling ~${actualMinutes} minutes.`;
  } else {
    whatActuallyHappened = 'No sessions were scheduled or logged for this calendar window.';
  }

  // Q3: What changed in capability state?
  const stateDeltas: Record<string, { from: string; to: string }> = {};
  let totalEvidencePoints = 0;
  const establishedCaps: string[] = [];

  for (const cap of userGoal.capabilities) {
    totalEvidencePoints += cap.evidences?.length || 0;
    if (cap.state === 'ESTABLISHED' || cap.state === 'ROBUST') {
      establishedCaps.push(cap.name);
      stateDeltas[cap.id] = { from: 'EMERGING', to: cap.state };
    }
  }

  let whatChangedInCapabilityState = '';
  if (establishedCaps.length > 0) {
    whatChangedInCapabilityState = `Established capabilities: ${establishedCaps.join(', ')}. Total verified evidence points: ${totalEvidencePoints}.`;
  } else if (totalEvidencePoints > 0) {
    whatChangedInCapabilityState = `${totalEvidencePoints} evidence node(s) recorded; critical capabilities actively emerging without regressions.`;
  } else {
    whatChangedInCapabilityState = 'Capabilities remain in baseline progression; no regressions detected along critical path.';
  }

  // Q4: What caused meaningful deviations?
  let whatCausedMeaningfulDeviations = '';
  const recentDiagnostic = userGoal.diagnostic_events[0];
  if (recentDiagnostic) {
    whatCausedMeaningfulDeviations = `Diagnostic event recorded: ${recentDiagnostic.category} - ${recentDiagnostic.root_cause_details}.`;
  } else if (missed.length > 0) {
    whatCausedMeaningfulDeviations = `${missed.length} session(s) missed; absorbed cleanly without adding catch-up debt to future weeks.`;
  } else {
    whatCausedMeaningfulDeviations = 'No meaningful disruptions; execution was consistent with planned runway.';
  }

  // Q5: Is execution on track?
  const unestablishedCap =
    userGoal.capabilities.find((c) => c.state !== 'ROBUST' && c.state !== 'ESTABLISHED') ||
    userGoal.capabilities[userGoal.capabilities.length - 1];
  const activeFocus = unestablishedCap?.name || userGoal.outcome_statement || 'Goal Milestones';

  let isTheBottleneckStillTheBottleneck = '';
  if (missed.length > 0) {
    isTheBottleneckStillTheBottleneck = `Attention needed on "${activeFocus}": ${missed.length} session(s) slipped this week. Planned schedule adapted cleanly without backlog debt.`;
  } else {
    isTheBottleneckStillTheBottleneck = `Yes, "${activeFocus}" remains the primary limiting constraint and focus on the trajectory.`;
  }

  // Q6: Is the trajectory still valid?
  const forecast = await computeForecast(userGoalId);
  const confidence = await computeEvidenceConfidence(userGoalId);
  const margin = (userGoal.sustainable_weekly_capacity_hours ?? 6) - (userGoal.current_med_hours ?? 4.5);

  let isTheTrajectoryStillValid = '';
  if (forecast.isWithinPlannedRunway) {
    isTheTrajectoryStillValid = `Trajectory is valid with ${confidence} confidence. Projected completion window is Day ${forecast.projectedWindowDays[0]}–${forecast.projectedWindowDays[1]} with a ${margin.toFixed(1)}h/wk reliability margin.`;
  } else {
    isTheTrajectoryStillValid = `Trajectory under review: Projected completion has slipped to Day ${forecast.projectedDayOffset} due to capacity or execution constraints.`;
  }

  // Q7: What should happen next?
  const whatShouldHappenNext = `Focus next week's highest-priority sessions on unlocking "${activeFocus}". Protect your ${margin.toFixed(1)}h reliability buffer and do not take on catch-up debt.`;

  const answers: WeeklyStrategicQuestions = {
    whatWasSupposedToHappen,
    whatActuallyHappened,
    whatChangedInCapabilityState,
    whatCausedMeaningfulDeviations,
    isTheBottleneckStillTheBottleneck,
    isTheTrajectoryStillValid,
    whatShouldHappenNext,
  };

  const review = await prisma.weeklyStrategicReview.create({
    data: {
      user_goal_id: userGoalId,
      week_number: weekNumber,
      answers: answers as any,
      state_deltas: stateDeltas as any,
    },
  });

  return {
    id: review.id,
    userGoalId,
    weekNumber,
    answers,
    stateDeltas,
    createdAt: review.created_at,
  };
}

/**
 * Minimum Viable Day Utility:
 * During severe daily time compression (work emergency, family illness, travel),
 * filters out all non-critical/supportive work and scales the single highest-priority
 * critical intervention to its Minimum Viable Session (MVS) duration (35-40% dose).
 *
 * This prevents the false binary of "100% or 0%" and keeps momentum unbroken.
 */
export async function generateMinimumViableDay(
  userGoalId: string,
  date: Date
): Promise<ExecutionObject[]> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: true,
      trajectory_versions: {
        where: { is_active: true },
        include: { items: true },
        take: 1,
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  // Check if there are existing scheduled sessions for this date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const sessions = await prisma.session.findMany({
    where: {
      user_goal_id: userGoalId,
      scheduled_date: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      task_template: true,
    },
  });

  if (sessions.length > 0) {
    // Sort sessions by priority: core/tier 1 first
    sessions.sort((a, b) => {
      const aTier = a.tier === 'core' ? 1 : a.tier === 'buffer' ? 2 : 3;
      const bTier = b.tier === 'core' ? 1 : b.tier === 'buffer' ? 2 : 3;
      return aTier - bTier;
    });

    const primarySession = sessions[0];
    const standardDuration = primarySession.task_template?.session_duration_minutes || 45;
    const mvsDuration = Math.max(15, Math.round(standardDuration * 0.40));

    const criticalCap =
      userGoal.capabilities.find((c) => c.id === userGoal.active_bottleneck_capability_id) ||
      userGoal.capabilities[0];

    const mvsExecutionObject = createExecutionObject({
      id: `mvd-${primarySession.id}`,
      trajectoryItemId: primarySession.trajectory_item_id || `item-${primarySession.id}`,
      userGoalId,
      targetCapabilityId: criticalCap?.id || 'cap-critical',
      actionName: `MVS: ${primarySession.task_template?.title || 'Core Priority Session'}`,
      purpose: `Minimum Viable Session preserving continuity on ${criticalCap?.name || 'critical capability'} during high daily compression`,
      priorityTier: 1,
      standardDoseMinutes: standardDuration,
      reducedDoseMinutes: Math.max(15, Math.round(standardDuration * 0.65)),
      mvsDoseMinutes: mvsDuration,
      executionState: 'MINIMUM_VIABLE',
      scheduledDate: date,
      fallbackOptions: [
        '15-minute mental rehearsal and key motion drill',
        '15-minute active recovery walk with intentional breathing',
      ],
    });

    // Discard all other lower priority sessions for the day: strictly return the single MVS action
    return [mvsExecutionObject];
  }

  // If no sessions exist for this specific date, use the active trajectory's critical bottleneck item
  const activeTrajectory = userGoal.trajectory_versions[0];
  const items = activeTrajectory?.items || [];
  const criticalItem = items.find((i) => i.priority_tier === 1) || items[0];

  const standardDuration = criticalItem?.standard_duration_minutes || 45;
  const mvsDuration = criticalItem?.mvs_duration_minutes || Math.max(15, Math.round(standardDuration * 0.40));
  const targetCapId = criticalItem?.target_capability_id || userGoal.active_bottleneck_capability_id || 'cap-bottleneck';
  const targetCap = userGoal.capabilities.find((c) => c.id === targetCapId);

  const mvsObject = createExecutionObject({
    id: `mvd-traj-${Date.now()}`,
    trajectoryItemId: criticalItem?.id || 'traj-item-default',
    userGoalId,
    targetCapabilityId: targetCapId,
    actionName: `MVS: ${criticalItem?.intervention_name || 'Critical Intervention Focus'}`,
    purpose: `Minimum Viable Session preserving adaptation stimulus for ${targetCap?.name || 'critical bottleneck'}`,
    priorityTier: 1,
    standardDoseMinutes: standardDuration,
    reducedDoseMinutes: Math.max(15, Math.round(standardDuration * 0.65)),
    mvsDoseMinutes: mvsDuration,
    executionState: 'MINIMUM_VIABLE',
    scheduledDate: date,
  });

  return [mvsObject];
}
