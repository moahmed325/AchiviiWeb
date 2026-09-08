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

export interface RescheduleResult {
  missedDetectedCount: number;
  rescheduledCount: number;
  sameWeekReallocatedCount: number;
  planShiftCount: number;
  slippageDaysAdded: number;
  totalSlippageDays: number;
  guardrailTriggered: boolean;
  actions: RescheduleAction[];
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
 * Adaptive Rescheduling Engine (§6 of Roadmap)
 * Detects missed or passed uncompleted sessions, reallocates within the current week,
 * or shifts the remaining plan by +7 days and accumulates slippage_days.
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

  const actions: RescheduleAction[] = [];
  let sameWeekReallocatedCount = 0;
  let planShiftCount = 0;
  let cumulativeSlippageAdded = 0;

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

  // Process each missed session chronologically
  for (const session of sessionsToReschedule) {
    if (!session.scheduled_date) continue;
    const sessionDate = new Date(session.scheduled_date);
    const duration = session.task_template.session_duration_minutes;
    const prefWindow = getPreferredWindow(session.task_template.preferred_time_of_day);
    const origDateStr = toDateStr(sessionDate);
    const origTimeStr = session.start_time && session.end_time ? `${session.start_time} - ${session.end_time}` : '';

    // Determine the week bounds for this session
    // Monday is start of week (day 1), Sunday is end of week (day 0)
    const sessionJsDay = sessionDate.getDay(); // 0 is Sun, 1 is Mon...
    const distFromMonday = (sessionJsDay + 6) % 7; // 0 for Mon, 6 for Sun
    const weekMonday = new Date(sessionDate.getTime() - distFromMonday * 86400000);
    weekMonday.setHours(0, 0, 0, 0);

    // Rule 1 & 2: Search for next available free slot later in the same week
    // Candidate dates are from max(sessionDate + 1 day, today) through Sunday of that week
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
      for (const occupied of bookedIntervalsByDate[candidateDateStr] || []) {
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
      // Reallocate within same week
      const newDateStr = toDateStr(foundSlot.date);
      const newStartTime = minutesToTime(foundSlot.start);
      const newEndTime = minutesToTime(foundSlot.end);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          scheduled_date: foundSlot.date,
          start_time: newStartTime,
          end_time: newEndTime,
          status: 'RESCHEDULED',
        },
      });

      // Update in-memory booking
      if (!bookedIntervalsByDate[newDateStr]) {
        bookedIntervalsByDate[newDateStr] = [];
      }
      bookedIntervalsByDate[newDateStr].push({
        start: foundSlot.start,
        end: foundSlot.end,
      });

      sameWeekReallocatedCount++;
      actions.push({
        sessionId: session.id,
        taskTitle: session.task_template.title,
        originalDate: origDateStr,
        originalTime: origTimeStr,
        newDate: newDateStr,
        newTime: `${newStartTime} - ${newEndTime}`,
        actionType: 'REALLOCATED_SAME_WEEK',
        details: `Reallocated within the same week to ${toDayKey(foundSlot.date)} ${newDateStr} at ${newStartTime}.`,
      });
    } else {
      // Rule 3 & 4: Push into NEXT week and shift the entire remaining plan by 7 days (+1 week extension)
      const shiftDays = 7;
      cumulativeSlippageAdded += shiftDays;
      planShiftCount++;

      // Shift subsequent future uncompleted sessions by +7 days
      const futureSessions = allSessions.filter(
        (s) =>
          s.id !== session.id &&
          s.status !== 'DONE' &&
          s.scheduled_date &&
          toDateStr(new Date(s.scheduled_date)) >= origDateStr
      );

      for (const fut of futureSessions) {
        if (!fut.scheduled_date) continue;
        const shiftedDate = new Date(new Date(fut.scheduled_date).getTime() + shiftDays * 86400000);
        await prisma.session.update({
          where: { id: fut.id },
          data: { scheduled_date: shiftedDate },
        });
      }

      // Shift the missed session by +7 days into next week's corresponding slot
      const nextWeekDate = new Date(sessionDate.getTime() + shiftDays * 86400000);
      const nextWeekDateStr = toDateStr(nextWeekDate);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          scheduled_date: nextWeekDate,
          status: 'RESCHEDULED',
        },
      });

      actions.push({
        sessionId: session.id,
        taskTitle: session.task_template.title,
        originalDate: origDateStr,
        originalTime: origTimeStr,
        newDate: nextWeekDateStr,
        newTime: session.start_time && session.end_time ? `${session.start_time} - ${session.end_time}` : '',
        actionType: 'SHIFTED_NEXT_WEEK',
        details: `No slot available in current week. Extended plan by 7 days and shifted session to next week.`,
      });
    }
  }

  // Update UserGoal slippage_days and target_end_date if plan shifted
  let totalSlippage = userGoal.slippage_days;
  if (cumulativeSlippageAdded > 0) {
    totalSlippage += cumulativeSlippageAdded;
    const newTargetEndDate = new Date(
      new Date(userGoal.target_end_date).getTime() + cumulativeSlippageAdded * 86400000
    );

    await prisma.userGoal.update({
      where: { id: userGoalId },
      data: {
        slippage_days: totalSlippage,
        target_end_date: newTargetEndDate,
      },
    });
  }

  const guardrailTriggered = totalSlippage >= 14;

  return {
    missedDetectedCount: sessionsToReschedule.length,
    rescheduledCount: actions.length,
    sameWeekReallocatedCount,
    planShiftCount,
    slippageDaysAdded: cumulativeSlippageAdded,
    totalSlippageDays: totalSlippage,
    guardrailTriggered,
    actions,
  };
}
