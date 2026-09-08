import { prisma } from './prisma.js';
import { SessionTier } from '@prisma/client';

export interface TimeInterval {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

export const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type DayKey = typeof DAY_KEYS[number];

// Helper: Convert "HH:MM" string to minutes from midnight
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

// Helper: Convert minutes from midnight to "HH:MM" string
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper: Subtract busy intervals from an available window
export function subtractIntervals(openings: TimeInterval[], busy: TimeInterval): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const op of openings) {
    // Case 1: No overlap
    if (busy.end <= op.start || busy.start >= op.end) {
      result.push(op);
      continue;
    }

    // Case 2: Busy overlaps left side
    if (busy.start <= op.start && busy.end < op.end) {
      result.push({ start: busy.end, end: op.end });
      continue;
    }

    // Case 3: Busy overlaps right side
    if (busy.start > op.start && busy.end >= op.end) {
      result.push({ start: op.start, end: busy.start });
      continue;
    }

    // Case 4: Busy splits opening in middle
    if (busy.start > op.start && busy.end < op.end) {
      result.push({ start: op.start, end: busy.start });
      result.push({ start: busy.end, end: op.end });
      continue;
    }
  }

  return result.filter((i) => i.end - i.start >= 15); // Discard slivers under 15m
}

// Helper: Get preferred interval window
export function getPreferredWindow(pref?: string | null): TimeInterval {
  switch (pref?.toLowerCase()) {
    case 'morning':
      return { start: 7 * 60, end: 12 * 60 };    // 07:00 – 12:00
    case 'afternoon':
      return { start: 12 * 60, end: 17 * 60 };   // 12:00 – 17:00
    case 'evening':
      return { start: 17 * 60, end: 21.5 * 60 }; // 17:00 – 21:30
    default:
      return { start: 7 * 60, end: 22 * 60 };     // 07:00 – 22:00
  }
}

/**
 * Determine session tier based on plan Section 4.4 / Section 9:
 * Target split: ~40-50% core / ~30% buffer / ~20% reflect.
 */
export function determineSessionTier(
  sessionIndex: number,
  totalSessions: number
): SessionTier {
  if (totalSessions <= 1) {
    return SessionTier.core;
  }
  if (totalSessions === 2) {
    return sessionIndex === 0 ? SessionTier.core : SessionTier.buffer;
  }
  if (totalSessions === 3) {
    if (sessionIndex === 0) return SessionTier.core;
    if (sessionIndex === 1) return SessionTier.buffer;
    return SessionTier.reflect;
  }
  if (totalSessions === 4) {
    if (sessionIndex < 2) return SessionTier.core; // 50% core
    if (sessionIndex === 2) return SessionTier.buffer; // 25% buffer
    return SessionTier.reflect; // 25% reflect
  }
  // For totalSessions >= 5
  const coreCount = Math.max(1, Math.round(totalSessions * 0.45));
  const reflectCount = Math.max(1, Math.round(totalSessions * 0.20));
  if (sessionIndex < coreCount) {
    return SessionTier.core;
  }
  if (sessionIndex >= totalSessions - reflectCount) {
    return SessionTier.reflect;
  }
  return SessionTier.buffer;
}

export interface ScheduleOptions {
  preserveCompleted?: boolean;
}

/**
 * Deterministic Schedule Generation Engine (§5 of Roadmap)
 * Generates all 12 weeks of sessions upfront based on user availability and phase blueprints.
 * Supports preserving completed (DONE) sessions when adjusting routines for active goals.
 */
export async function generateThreeMonthSchedule(
  userGoalId: string,
  options?: ScheduleOptions
): Promise<number> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      goal_catalog: {
        include: {
          phases: {
            orderBy: { phase_order: 'asc' },
            include: {
              task_templates: true,
            },
          },
        },
      },
      user: {
        include: {
          availability_slots: true,
        },
      },
    },
  });

  if (!userGoal || !userGoal.goal_catalog) {
    throw new Error('UserGoal or GoalCatalog not found.');
  }

  const { phases } = userGoal.goal_catalog;
  const availabilitySlots = userGoal.user.availability_slots;
  const startDate = new Date(userGoal.start_date);

  // Map busy blocks by day of week
  const busyByDay: Record<string, TimeInterval[]> = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
    SAT: [],
    SUN: [], // Sunday is always empty of user busy blocks
  };

  for (const slot of availabilitySlots) {
    if (busyByDay[slot.day_of_week]) {
      busyByDay[slot.day_of_week].push({
        start: timeToMinutes(slot.start_time),
        end: timeToMinutes(slot.end_time),
      });
    }
  }

  // Pre-calculate baseline daily free openings (07:00–22:00 on weekdays, 08:00–21:00 on Sun)
  const baselineFreeByDay: Record<string, TimeInterval[]> = {};
  for (const day of DAY_KEYS) {
    let openWindow: TimeInterval = { start: 7 * 60, end: 22 * 60 }; // 07:00 - 22:00
    if (day === 'SUN') {
      openWindow = { start: 8 * 60, end: 21 * 60 }; // 08:00 - 21:00
    } else if (day === 'SAT') {
      openWindow = { start: 8 * 60, end: 21.5 * 60 }; // 08:00 - 21:30
    }

    let free = [openWindow];
    for (const b of busyByDay[day] || []) {
      free = subtractIntervals(free, b);
    }
    baselineFreeByDay[day] = free;
  }

  // Fetch existing completed sessions if preserving completed work
  let doneSessions: Array<{
    id: string;
    task_template_id: string;
    scheduled_date: Date;
    start_time: string;
    end_time: string;
  }> = [];

  if (options?.preserveCompleted) {
    doneSessions = await prisma.session.findMany({
      where: {
        user_goal_id: userGoalId,
        status: 'DONE',
      },
      select: {
        id: true,
        task_template_id: true,
        scheduled_date: true,
        start_time: true,
        end_time: true,
      },
    });
  }

  const doneSessionIds = new Set(doneSessions.map((s) => s.id));

  // Clean existing non-completed sessions to avoid duplicates
  if (doneSessionIds.size > 0) {
    await prisma.session.deleteMany({
      where: {
        user_goal_id: userGoalId,
        id: { notIn: Array.from(doneSessionIds) },
      },
    });
  } else {
    await prisma.session.deleteMany({
      where: { user_goal_id: userGoalId },
    });
  }

  const sessionsToCreate: {
    user_goal_id: string;
    task_template_id: string;
    scheduled_date: Date;
    start_time: string;
    end_time: string;
    status: string;
    tier: SessionTier;
  }[] = [];

  // Generate 12 weeks of sessions
  const TOTAL_WEEKS = 12;

  for (let weekIndex = 0; weekIndex < TOTAL_WEEKS; weekIndex++) {
    // Determine active phase for this week
    let activePhase = phases[0];
    if (weekIndex >= 4 && weekIndex < 8 && phases.length > 1) {
      activePhase = phases[1];
    } else if (weekIndex >= 8 && phases.length > 2) {
      activePhase = phases[2];
    }

    // Weekly day tracker: 7 days per week
    // Each day has an exact Date, day of week key, and dynamic remaining free intervals
    const weekDays = Array.from({ length: 7 }).map((_, dayOffsetInWeek) => {
      const dayDate = new Date(startDate.getTime() + (weekIndex * 7 + dayOffsetInWeek) * 24 * 60 * 60 * 1000);
      
      // Determine day key from JavaScript date (0 = Sun, 1 = Mon...)
      const jsDay = dayDate.getDay();
      const dayKeyMap: Record<number, DayKey> = {
        0: 'SUN',
        1: 'MON',
        2: 'TUE',
        3: 'WED',
        4: 'THU',
        5: 'FRI',
        6: 'SAT',
      };
      const dayKey = dayKeyMap[jsDay];

      let intervals = [...baselineFreeByDay[dayKey].map((i) => ({ ...i }))];
      let existingSessionCount = 0;

      // Deduct intervals of any sessions already completed on this day
      if (doneSessions.length > 0) {
        const dStr = dayDate.toISOString().split('T')[0];
        const dayDone = doneSessions.filter((s) => {
          const sStr = new Date(s.scheduled_date).toISOString().split('T')[0];
          return sStr === dStr;
        });

        for (const ds of dayDone) {
          intervals = subtractIntervals(intervals, {
            start: timeToMinutes(ds.start_time),
            end: timeToMinutes(ds.end_time),
          });
          existingSessionCount++;
        }
      }

      return {
        date: dayDate,
        dayKey,
        dayOffsetInWeek,
        sessionCount: existingSessionCount,
        availableIntervals: intervals,
      };
    });

    // Schedule each task template for this week
    for (const task of activePhase.task_templates) {
      // Check how many sessions for this task were already done in this week
      let doneCountForTaskThisWeek = 0;
      if (doneSessions.length > 0) {
        const weekStartTime = startDate.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000;
        const weekEndTime = weekStartTime + 7 * 24 * 60 * 60 * 1000;
        doneCountForTaskThisWeek = doneSessions.filter((s) => {
          const sTime = new Date(s.scheduled_date).getTime();
          return s.task_template_id === task.id && sTime >= weekStartTime && sTime < weekEndTime;
        }).length;
      }

      const neededSessions = Math.max(0, task.sessions_per_week - doneCountForTaskThisWeek);
      if (neededSessions <= 0) {
        continue;
      }

      const duration = task.session_duration_minutes;
      const prefWindow = getPreferredWindow(task.preferred_time_of_day);

      // Prioritize days to spread load evenly across week
      let placedCount = 0;

      // Sort candidate days by fewest scheduled sessions, spreading across week
      const candidateDayIndices = [0, 2, 4, 1, 3, 5, 6]; // Staggered: Mon, Wed, Fri, Tue, Thu, Sat, Sun

      for (const dayIdx of candidateDayIndices) {
        if (placedCount >= neededSessions) break;

        const day = weekDays[dayIdx];
        if (!day) continue;

        // Try to find a slot matching preferred time of day first
        let chosenSlot: TimeInterval | null = null;

        for (const interval of day.availableIntervals) {
          if (interval.end - interval.start >= duration) {
            // Check overlap with preferred window
            const prefStart = Math.max(interval.start, prefWindow.start);
            const prefEnd = Math.min(interval.end, prefWindow.end);

            if (prefEnd - prefStart >= duration) {
              chosenSlot = { start: prefStart, end: prefStart + duration };
              break;
            }
          }
        }

        // Fallback: take first opening that fits duration if preferred window not open
        if (!chosenSlot) {
          for (const interval of day.availableIntervals) {
            if (interval.end - interval.start >= duration) {
              chosenSlot = { start: interval.start, end: interval.start + duration };
              break;
            }
          }
        }

        if (chosenSlot) {
          // Reserve this slot
          const sessionTier = determineSessionTier(placedCount, task.sessions_per_week);
          day.availableIntervals = subtractIntervals(day.availableIntervals, chosenSlot);
          day.sessionCount++;
          placedCount++;

          sessionsToCreate.push({
            user_goal_id: userGoalId,
            task_template_id: task.id,
            scheduled_date: day.date,
            start_time: minutesToTime(chosenSlot.start),
            end_time: minutesToTime(chosenSlot.end),
            status: 'UPCOMING',
            tier: sessionTier,
          });
        }
      }

      // If any sessions couldn't fit in primary days, greedy fill any remaining day
      while (placedCount < neededSessions) {
        let placedGreedy = false;
        for (const day of weekDays) {
          for (const interval of day.availableIntervals) {
            if (interval.end - interval.start >= duration) {
              const sessionTier = determineSessionTier(placedCount, task.sessions_per_week);
              const slot = { start: interval.start, end: interval.start + duration };
              day.availableIntervals = subtractIntervals(day.availableIntervals, slot);
              day.sessionCount++;
              placedCount++;
              placedGreedy = true;

              sessionsToCreate.push({
                user_goal_id: userGoalId,
                task_template_id: task.id,
                scheduled_date: day.date,
                start_time: minutesToTime(slot.start),
                end_time: minutesToTime(slot.end),
                status: 'UPCOMING',
                tier: sessionTier,
              });
              break;
            }
          }
          if (placedGreedy || placedCount >= neededSessions) break;
        }
        if (!placedGreedy) break; // Day capacity reached
      }
    }
  }

  // Bulk create all sessions in database
  if (sessionsToCreate.length > 0) {
    await prisma.session.createMany({
      data: sessionsToCreate,
    });
  }

  return sessionsToCreate.length + doneSessions.length;
}
