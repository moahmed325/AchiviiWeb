import { prisma } from './prisma.js';
import { getZonedDateString, getZonedTimeParts } from './timezone.js';

export interface RescheduleAction {
  sessionId: string;
  taskTitle: string;
  originalDate: string;
  originalTime: string;
  newDate: string;
  newTime: string;
  actionType: 'REALLOCATED_SAME_WEEK' | 'SHIFTED_NEXT_WEEK';
  details: string;
}

export interface PendingRecoveryState {
  triggered: boolean;
  tier: 'TIER_1_SILENT' | 'TIER_2_PENDING' | 'NONE';
  reason?: 'CONSECUTIVE_DAYS_MISSED' | 'NO_FREE_SLOTS' | 'MANUAL';
  consecutiveMissedDays: number;
  missedSessionIds: string[];
  suggestedAction?: 'shrink_week' | 'shift_timeline';
}

export interface RescheduleResult {
  missedDetectedCount: number;
  rescheduledCount: number;
  sameWeekReallocatedCount: number;
  planShiftCount: number;
  slippageDaysAdded: number;
  totalSlippageDays: number;
  guardrailTriggered: boolean;
  actions: RescheduleAction[];
  pendingRecovery?: PendingRecoveryState;
}

export interface TimeInterval {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

export type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function formatDateYYYYMMDD(date: Date, timezone?: string): string {
  if (timezone) {
    return getZonedDateString(date, timezone);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDayKey(date: Date, timezone?: string): DayKey {
  if (timezone) {
    return getZonedTimeParts(date, timezone).dayKey as DayKey;
  }
  const jsDay = date.getDay();
  const dayKeyMap: Record<number, DayKey> = {
    0: 'SUN',
    1: 'MON',
    2: 'TUE',
    3: 'WED',
    4: 'THU',
    5: 'FRI',
    6: 'SAT',
  };
  return dayKeyMap[jsDay] || 'MON';
}

export function subtractIntervals(openings: TimeInterval[], busy: TimeInterval): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const op of openings) {
    if (busy.end <= op.start || busy.start >= op.end) {
      result.push(op);
      continue;
    }
    if (busy.start <= op.start && busy.end < op.end) {
      result.push({ start: busy.end, end: op.end });
      continue;
    }
    if (busy.start > op.start && busy.end >= op.end) {
      result.push({ start: op.start, end: busy.start });
      continue;
    }
    if (busy.start > op.start && busy.end < op.end) {
      result.push({ start: op.start, end: busy.start });
      result.push({ start: busy.end, end: op.end });
      continue;
    }
  }

  return result.filter((i) => i.end - i.start >= 15);
}

export function getPreferredWindow(pref?: string | null): TimeInterval {
  switch (pref?.toLowerCase()) {
    case 'morning':
      return { start: 7 * 60, end: 12 * 60 };
    case 'afternoon':
      return { start: 12 * 60, end: 17 * 60 };
    case 'evening':
      return { start: 17 * 60, end: 21.5 * 60 };
    default:
      return { start: 7 * 60, end: 22 * 60 };
  }
}

export function getBaselineDayOpenings(dayKey: DayKey): TimeInterval[] {
  if (dayKey === 'SUN') {
    return [{ start: 8 * 60, end: 21 * 60 }]; // 08:00 - 21:00
  }
  if (dayKey === 'SAT') {
    return [{ start: 8 * 60, end: 21.5 * 60 }]; // 08:00 - 21:30
  }
  return [{ start: 7 * 60, end: 22 * 60 }]; // 07:00 - 22:00
}

/**
 * Calculates consecutive missed days with scheduled sessions up to today/now.
 * If a day has multiple sessions and at least one was completed (DONE),
 * that day is not considered missed.
 * A streak breaks as soon as a completed day is encountered looking backwards.
 */
export function calculateConsecutiveMissedDays(
  allSessions: Array<{
    scheduled_date: Date | string | null;
    status: string;
    end_time?: string | null;
  }>,
  todayStr: string,
  nowMinutes: number,
  timezone: string = 'UTC'
): number {
  const sessionsByDate: Record<string, Array<{ status: string; isPast: boolean }>> = {};

  for (const s of allSessions) {
    if (!s.scheduled_date) continue;
    const dateStr = formatDateYYYYMMDD(new Date(s.scheduled_date), timezone);
    if (dateStr > todayStr) continue;

    let isPast = false;
    if (dateStr < todayStr) {
      isPast = true;
    } else if (dateStr === todayStr) {
      isPast = s.end_time ? timeToMinutes(s.end_time) <= nowMinutes : false;
    }

    if (!sessionsByDate[dateStr]) {
      sessionsByDate[dateStr] = [];
    }
    sessionsByDate[dateStr].push({ status: s.status, isPast });
  }

  const sortedDates = Object.keys(sessionsByDate).sort();
  if (sortedDates.length === 0) return 0;

  const isDateMissed = (dStr: string) => {
    const list = sessionsByDate[dStr] || [];
    const pastSessions = list.filter((item) => item.isPast);
    if (pastSessions.length === 0) return false;
    const hasCompleted = pastSessions.some((item) => item.status === 'DONE');
    return !hasCompleted;
  };

  let consecutiveCount = 0;
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    const dStr = sortedDates[i];
    const list = sessionsByDate[dStr] || [];
    const hasPast = list.some((item) => item.isPast);
    if (!hasPast) continue;

    if (isDateMissed(dStr)) {
      consecutiveCount++;
    } else {
      break;
    }
  }

  return consecutiveCount;
}

/**
 * Adaptive Rescheduling Engine (Phase 2 Real Recovery UX)
 * - Tier 1 (1–2 consecutive missed days): Silently reallocates within the current week
 *   if free slots exist. No RecoveryEvent is logged and no user prompt is raised.
 * - Tier 2 (3+ consecutive missed days OR no free slots left this week):
 *   Does NOT auto-shift or cascade the schedule in the background. Instead flags a
 *   pending recovery state (Tier 2) for the user to resolve via RecoveryCheckIn.
 */
export async function detectAndRescheduleMissed(
  userGoalId: string,
  forceRescheduleSessionId?: string
): Promise<RescheduleResult> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      user: {
        include: {
          availability_slots: true,
        },
      },
      goal_catalog: {
        include: {
          phases: {
            include: { task_templates: true },
          },
        },
      },
    },
  });

  if (!userGoal) {
    throw new Error('Active user goal not found.');
  }

  const userTimezone = (userGoal.user as any)?.timezone || 'UTC';
  const now = new Date();
  const zonedNow = getZonedTimeParts(now, userTimezone);
  const todayYYYYMMDD = zonedNow.dateStr;
  const nowMinutes = zonedNow.minutesFromMidnight;
  const toDateStr = (d: Date) => formatDateYYYYMMDD(d, userTimezone);
  const toDayKey = (d: Date) => getDayKey(d, userTimezone);

  // Load all sessions for this goal
  const allSessions = await prisma.session.findMany({
    where: { user_goal_id: userGoalId },
    include: {
      task_template: true,
    },
    orderBy: [
      { scheduled_date: 'asc' },
      { start_time: 'asc' },
    ],
  });

  // Pre-index user busy slots by day key
  const busyByDay: Record<DayKey, TimeInterval[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [],
  };
  for (const slot of userGoal.user.availability_slots) {
    const key = slot.day_of_week as DayKey;
    if (busyByDay[key]) {
      busyByDay[key].push({
        start: timeToMinutes(slot.start_time),
        end: timeToMinutes(slot.end_time),
      });
    }
  }

  // Identify sessions that need rescheduling
  // A session needs rescheduling if:
  // 1. Explicitly forced by ID, OR
  // 2. Status is 'MISSED', OR
  // 3. Status is 'UPCOMING' and scheduled_date is strictly before today, OR
  // 4. Status is 'UPCOMING' and scheduled_date is today but end_time <= nowMinutes
  const sessionsToReschedule = allSessions.filter((s) => {
    if (forceRescheduleSessionId && s.id === forceRescheduleSessionId) {
      return true;
    }
    if (s.status === 'DONE' || !s.scheduled_date) {
      return false;
    }
    if (s.status === 'MISSED') {
      return true;
    }
    const sessionDateStr = toDateStr(new Date(s.scheduled_date));
    if (sessionDateStr < todayYYYYMMDD && (s.status === 'UPCOMING' || s.status === 'RESCHEDULED')) {
      return true;
    }
    if (sessionDateStr === todayYYYYMMDD && (s.status === 'UPCOMING' || s.status === 'RESCHEDULED')) {
      return s.end_time ? timeToMinutes(s.end_time) <= nowMinutes : false;
    }
    return false;
  });

  // Calculate consecutive missed days
  const consecutiveMissedDays = calculateConsecutiveMissedDays(
    allSessions,
    todayYYYYMMDD,
    nowMinutes,
    userTimezone
  );

  // If no sessions need rescheduling
  if (sessionsToReschedule.length === 0) {
    return {
      missedDetectedCount: 0,
      rescheduledCount: 0,
      sameWeekReallocatedCount: 0,
      planShiftCount: 0,
      slippageDaysAdded: 0,
      totalSlippageDays: userGoal.slippage_days,
      guardrailTriggered: userGoal.slippage_days >= 14,
      actions: [],
      pendingRecovery: {
        triggered: false,
        tier: 'NONE',
        consecutiveMissedDays: 0,
        missedSessionIds: [],
      },
    };
  }

  // Tier 2 Trigger: 3+ consecutive missed days
  // (unless user is explicitly force-rescheduling a specific single session)
  if (!forceRescheduleSessionId && consecutiveMissedDays >= 3) {
    return {
      missedDetectedCount: sessionsToReschedule.length,
      rescheduledCount: 0,
      sameWeekReallocatedCount: 0,
      planShiftCount: 0,
      slippageDaysAdded: 0,
      totalSlippageDays: userGoal.slippage_days,
      guardrailTriggered: userGoal.slippage_days >= 14,
      actions: [],
      pendingRecovery: {
        triggered: true,
        tier: 'TIER_2_PENDING',
        reason: 'CONSECUTIVE_DAYS_MISSED',
        consecutiveMissedDays,
        missedSessionIds: sessionsToReschedule.map((s) => s.id),
        suggestedAction: 'shrink_week',
      },
    };
  }

  // Track currently booked intervals per YYYY-MM-DD
  const bookedIntervalsByDate: Record<string, TimeInterval[]> = {};
  for (const s of allSessions) {
    // Only count active sessions not in our reschedule candidate queue
    const isCandidate = sessionsToReschedule.some((c) => c.id === s.id);
    if (!isCandidate && s.status !== 'MISSED' && s.scheduled_date && s.start_time && s.end_time) {
      const dStr = toDateStr(new Date(s.scheduled_date));
      if (!bookedIntervalsByDate[dStr]) {
        bookedIntervalsByDate[dStr] = [];
      }
      bookedIntervalsByDate[dStr].push({
        start: timeToMinutes(s.start_time),
        end: timeToMinutes(s.end_time),
      });
    }
  }

  // Stage potential same-week reallocations
  interface StagedUpdate {
    session: (typeof allSessions)[0];
    foundSlot: { date: Date; start: number; end: number };
    origDateStr: string;
    origTimeStr: string;
  }
  const stagedUpdates: StagedUpdate[] = [];
  let slotExhausted = false;

  const simulatedBooked: Record<string, TimeInterval[]> = {};
  for (const [k, v] of Object.entries(bookedIntervalsByDate)) {
    simulatedBooked[k] = [...v];
  }

  for (const session of sessionsToReschedule) {
    if (!session.scheduled_date) continue;
    const sessionDate = new Date(session.scheduled_date);
    const duration = session.task_template.session_duration_minutes;
    const prefWindow = getPreferredWindow(session.task_template.preferred_time_of_day);
    const origDateStr = toDateStr(sessionDate);
    const origTimeStr = session.start_time && session.end_time ? `${session.start_time} - ${session.end_time}` : '';

    // Determine the week bounds for this session
    // Monday is start of week (day 1), Sunday is end of week (day 0)
    const sessionJsDay = sessionDate.getDay();
    const distFromMonday = (sessionJsDay + 6) % 7;
    const weekMonday = new Date(sessionDate.getTime() - distFromMonday * 86400000);
    weekMonday.setHours(0, 0, 0, 0);

    let foundSlot: { date: Date; start: number; end: number } | null = null;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const candidateDate = new Date(weekMonday.getTime() + dayOffset * 86400000);
      const candidateDateStr = toDateStr(candidateDate);

      // Must be after or equal to today, and strictly after original scheduled date (or today if session was today)
      if (candidateDateStr < todayYYYYMMDD) continue;
      if (candidateDateStr <= origDateStr && candidateDateStr !== todayYYYYMMDD) continue;

      const dayKey = toDayKey(candidateDate);
      let openings = getBaselineDayOpenings(dayKey);

      // Subtract user fixed busy blocks
      for (const busy of busyByDay[dayKey]) {
        openings = subtractIntervals(openings, busy);
      }

      // Subtract already scheduled sessions on this date
      for (const occupied of simulatedBooked[candidateDateStr] || []) {
        openings = subtractIntervals(openings, occupied);
      }

      // If candidate is today, subtract past time (+ 15 min margin)
      if (candidateDateStr === todayYYYYMMDD) {
        const pastMargin = Math.min(22 * 60, nowMinutes + 15);
        openings = subtractIntervals(openings, { start: 0, end: pastMargin });
      }

      // Look for interval fitting duration, prioritizing preferred window
      let chosenInterval: TimeInterval | null = null;

      for (const op of openings) {
        if (op.end - op.start >= duration) {
          const prefStart = Math.max(op.start, prefWindow.start);
          const prefEnd = Math.min(op.end, prefWindow.end);
          if (prefEnd - prefStart >= duration) {
            chosenInterval = { start: prefStart, end: prefStart + duration };
            break;
          }
        }
      }

      if (!chosenInterval) {
        for (const op of openings) {
          if (op.end - op.start >= duration) {
            chosenInterval = { start: op.start, end: op.start + duration };
            break;
          }
        }
      }

      if (chosenInterval) {
        foundSlot = {
          date: new Date(candidateDate.getFullYear(), candidateDate.getMonth(), candidateDate.getDate(), 12, 0, 0, 0),
          start: chosenInterval.start,
          end: chosenInterval.end,
        };
        break;
      }
    }

    if (foundSlot) {
      const newDateStr = toDateStr(foundSlot.date);
      if (!simulatedBooked[newDateStr]) {
        simulatedBooked[newDateStr] = [];
      }
      simulatedBooked[newDateStr].push({
        start: foundSlot.start,
        end: foundSlot.end,
      });

      stagedUpdates.push({
        session,
        foundSlot,
        origDateStr,
        origTimeStr,
      });
    } else {
      // Slot exhausted in current week!
      slotExhausted = true;
      break;
    }
  }

  // If any session cannot find a slot in current week:
  // Tier 2 Trigger: NO_FREE_SLOTS.
  // Under Phase 2 Guardrail 2: Do NOT auto-shift or cascade the schedule.
  // Instead, surface a pending recovery state for the user to resolve.
  if (slotExhausted) {
    return {
      missedDetectedCount: sessionsToReschedule.length,
      rescheduledCount: 0,
      sameWeekReallocatedCount: 0,
      planShiftCount: 0,
      slippageDaysAdded: 0,
      totalSlippageDays: userGoal.slippage_days,
      guardrailTriggered: userGoal.slippage_days >= 14,
      actions: [],
      pendingRecovery: {
        triggered: true,
        tier: 'TIER_2_PENDING',
        reason: 'NO_FREE_SLOTS',
        consecutiveMissedDays,
        missedSessionIds: sessionsToReschedule.map((s) => s.id),
        suggestedAction: 'shift_timeline',
      },
    };
  }

  // Tier 1 Silent Recovery: All sessions reallocated within same week
  const actions: RescheduleAction[] = [];
  for (const update of stagedUpdates) {
    const newDateStr = toDateStr(update.foundSlot.date);
    const newStartTime = minutesToTime(update.foundSlot.start);
    const newEndTime = minutesToTime(update.foundSlot.end);

    await prisma.session.update({
      where: { id: update.session.id },
      data: {
        scheduled_date: update.foundSlot.date,
        start_time: newStartTime,
        end_time: newEndTime,
        status: 'RESCHEDULED',
      },
    });

    actions.push({
      sessionId: update.session.id,
      taskTitle: update.session.task_template.title,
      originalDate: update.origDateStr,
      originalTime: update.origTimeStr,
      newDate: newDateStr,
      newTime: `${newStartTime} - ${newEndTime}`,
      actionType: 'REALLOCATED_SAME_WEEK',
      details: `Reallocated within the same week to ${toDayKey(update.foundSlot.date)} ${newDateStr} at ${newStartTime}.`,
    });
  }

  return {
    missedDetectedCount: sessionsToReschedule.length,
    rescheduledCount: actions.length,
    sameWeekReallocatedCount: actions.length,
    planShiftCount: 0,
    slippageDaysAdded: 0,
    totalSlippageDays: userGoal.slippage_days,
    guardrailTriggered: userGoal.slippage_days >= 14,
    actions,
    pendingRecovery: {
      triggered: false,
      tier: 'TIER_1_SILENT',
      consecutiveMissedDays,
      missedSessionIds: [],
    },
  };
}
