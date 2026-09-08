import { prisma } from './prisma.js';
import { detectAndRescheduleMissed } from './rescheduler.js';
import { getZonedDateString, getZonedDayBounds } from './timezone.js';

export interface PendingRecoveryResponse {
  pending: boolean;
  user_goal_id: string;
  tier?: 'TIER_2_PENDING';
  reason?: 'CONSECUTIVE_DAYS_MISSED' | 'NO_FREE_SLOTS' | 'MANUAL';
  consecutive_missed_days?: number;
  missed_session_count?: number;
  rolling_28_day_events: number;
  circuit_breaker_active: boolean;
  options?: ('shrink_week' | 'shift_timeline' | 'scope_reduction' | 'pause_goal')[];
}

/**
 * Checks the current pending recovery state for an active UserGoal.
 * Detects missed sessions, handles silent Tier 1 reallocation,
 * evaluates offline completions, checks 28-day circuit breaker,
 * and surfaces Tier 2 pending state if user intervention is required.
 */
export async function getPendingRecoveryState(userGoalId: string): Promise<PendingRecoveryResponse> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: { user: true },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id ${userGoalId} not found.`);
  }

  // Count RecoveryEvents in the rolling 28-day window
  const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const rolling28DayEvents = await prisma.recoveryEvent.count({
    where: {
      user_goal_id: userGoalId,
      timestamp: { gte: twentyEightDaysAgo },
    },
  });

  // Circuit breaker triggers on exactly the 3rd event (i.e. rolling count >= 2 prior events)
  const circuitBreakerActive = rolling28DayEvents >= 2;

  // Run detect and reschedule logic (Tier 1 silent reallocation or Tier 2 pending detection)
  const rescheduleResult = await detectAndRescheduleMissed(userGoalId);

  if (rescheduleResult.pendingRecovery && rescheduleResult.pendingRecovery.triggered) {
    return {
      pending: true,
      user_goal_id: userGoalId,
      tier: 'TIER_2_PENDING',
      reason: rescheduleResult.pendingRecovery.reason,
      consecutive_missed_days: rescheduleResult.pendingRecovery.consecutiveMissedDays,
      missed_session_count: rescheduleResult.pendingRecovery.missedSessionIds?.length || 0,
      rolling_28_day_events: rolling28DayEvents,
      circuit_breaker_active: circuitBreakerActive,
      options: circuitBreakerActive
        ? ['scope_reduction', 'pause_goal']
        : ['shrink_week', 'shift_timeline'],
    };
  }

  return {
    pending: false,
    user_goal_id: userGoalId,
    rolling_28_day_events: rolling28DayEvents,
    circuit_breaker_active: false,
  };
}

/**
 * Implements "shrink_week":
 * Drops buffer-tier sessions first, never touches core-tier sessions,
 * respects session-length cap, and attempts to reallocate remaining missed sessions.
 */
export async function shrinkWeekForGoal(
  userGoalId: string,
  customWeekOffset?: number
): Promise<{ droppedSessions: string[]; reallocatedCount: number }> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      user: true,
      sessions: true,
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id ${userGoalId} not found.`);
  }

  const userTimezone = userGoal.user.timezone || 'UTC';
  const goalStart = new Date(userGoal.start_date);
  const now = new Date();
  const diffMs = now.getTime() - goalStart.getTime();
  const defaultWeekOffset = Math.max(0, Math.min(11, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))));
  const weekOffset = customWeekOffset ?? defaultWeekOffset;

  const goalStartDateStr = getZonedDateString(goalStart, userTimezone);
  const { startOfDay: startOfGoal } = getZonedDayBounds(goalStartDateStr, userTimezone);
  const weekStart = new Date(startOfGoal.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Find all uncompleted sessions in the current week
  const weekSessions = await prisma.session.findMany({
    where: {
      user_goal_id: userGoalId,
      scheduled_date: {
        gte: weekStart,
        lt: weekEnd,
      },
      status: { not: 'DONE' },
    },
  });

  const droppedSessions: string[] = [];

  // Drop buffer sessions first
  const bufferSessions = weekSessions.filter((s) => s.tier === 'buffer');
  for (const session of bufferSessions) {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'RESCHEDULED' },
    });
    droppedSessions.push(session.id);
  }

  // If no buffer sessions were found/dropped, drop reflect sessions next (never core!)
  if (droppedSessions.length === 0) {
    const reflectSessions = weekSessions.filter((s) => s.tier === 'reflect');
    for (const session of reflectSessions) {
      await prisma.session.update({
        where: { id: session.id },
        data: { status: 'RESCHEDULED' },
      });
      droppedSessions.push(session.id);
    }
  }

  // Now attempt to silently reallocate remaining missed sessions into the newly freed slots
  let reallocatedCount = 0;
  try {
    const reallocateResult = await detectAndRescheduleMissed(userGoalId);
    reallocatedCount = reallocateResult.rescheduledCount;
  } catch (err) {
    console.warn('[shrinkWeekForGoal] Reallocation attempt notice:', err);
  }

  return { droppedSessions, reallocatedCount };
}

/**
 * Implements "shift_timeline":
 * Performs an O(1) increment on `current_plan_day_offset` and advances target_end_date
 * rather than rewriting session rows.
 */
export async function shiftTimelineForGoal(
  userGoalId: string,
  daysToShift: number = 7
): Promise<{
  newOffset: number;
  newTargetEndDate: Date;
  newSlippageDays: number;
}> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id ${userGoalId} not found.`);
  }

  const newOffset = (userGoal.current_plan_day_offset || 0) + daysToShift;
  const newTargetEndDate = new Date(userGoal.target_end_date.getTime() + daysToShift * 24 * 60 * 60 * 1000);
  const newSlippageDays = userGoal.slippage_days + daysToShift;

  // O(1) write on UserGoal
  await prisma.userGoal.update({
    where: { id: userGoalId },
    data: {
      current_plan_day_offset: newOffset,
      target_end_date: newTargetEndDate,
      slippage_days: newSlippageDays,
    },
  });

  // Mark currently missed sessions as RESCHEDULED so they don't stay in missed state
  await prisma.session.updateMany({
    where: {
      user_goal_id: userGoalId,
      status: 'MISSED',
    },
    data: {
      status: 'RESCHEDULED',
    },
  });

  return {
    newOffset,
    newTargetEndDate,
    newSlippageDays,
  };
}

/**
 * Executes a user's recovery choice and records the corresponding RecoveryEvent.
 */
export async function executeRecoveryAction(
  userGoalId: string,
  choice: 'shrink_week' | 'shift_timeline' | 'scope_reduction' | 'pause_goal',
  details?: any
): Promise<{ success: boolean; choice: string; recoveryEventId: string; resultingAdjustment: any }> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id ${userGoalId} not found.`);
  }

  let triggerCondition = details?.trigger_condition || 'TIER_2_PENDING';
  let resultingAdjustment: any = {};

  if (choice === 'shrink_week') {
    const shrinkResult = await shrinkWeekForGoal(userGoalId, details?.weekOffset);
    resultingAdjustment = {
      action: 'shrink_week',
      dropped_sessions: shrinkResult.droppedSessions,
      reallocated_count: shrinkResult.reallocatedCount,
    };
  } else if (choice === 'shift_timeline') {
    const shiftResult = await shiftTimelineForGoal(userGoalId, details?.daysToShift || 7);
    resultingAdjustment = {
      action: 'shift_timeline',
      offset_increment: details?.daysToShift || 7,
      new_offset: shiftResult.newOffset,
      new_target_end_date: shiftResult.newTargetEndDate.toISOString(),
      new_slippage_days: shiftResult.newSlippageDays,
    };
  } else if (choice === 'scope_reduction') {
    triggerCondition = 'CIRCUIT_BREAKER';
    resultingAdjustment = {
      action: 'scope_reduction',
      mode: details?.mode || 'dial_back_goal',
      notes: 'Reduced goal scope on 3rd recovery event in 28 days',
    };
  } else if (choice === 'pause_goal') {
    triggerCondition = 'CIRCUIT_BREAKER';
    await prisma.userGoal.update({
      where: { id: userGoalId },
      data: { status: 'PAUSED' },
    });
    resultingAdjustment = {
      action: 'pause_goal',
      status: 'PAUSED',
    };
  } else {
    throw new Error(`Unsupported recovery choice: ${choice}`);
  }

  // Create RecoveryEvent record
  const recoveryEvent = await prisma.recoveryEvent.create({
    data: {
      user_goal_id: userGoalId,
      trigger_condition: triggerCondition,
      user_choice: choice,
      resulting_adjustment: resultingAdjustment,
    },
  });

  return {
    success: true,
    choice,
    recoveryEventId: recoveryEvent.id,
    resultingAdjustment,
  };
}
