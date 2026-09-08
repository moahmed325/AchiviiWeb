import { prisma } from './prisma.js';
import { SessionTier } from '@prisma/client';
import { getZonedDateString, getZonedTimeParts } from './timezone.js';

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
  roadmapId?: string;
}

/**
 * Deterministic Schedule Generation Engine (§5 of Roadmap)
 * Generates all 12 weeks of sessions upfront based on user availability and phase blueprints.
 * Supports preserving completed (DONE) sessions when adjusting routines for active goals.
 * Consumes selected roadmap parameters (days_per_week, daily_minutes_variance, phase_emphasis).
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

  const roadmapIdToUse = options?.roadmapId || (userGoal as any).selected_roadmap_id;
  let selectedRoadmap: any = null;
  if (roadmapIdToUse) {
    try {
      selectedRoadmap = await prisma.roadmap.findUnique({
        where: { id: roadmapIdToUse },
      });
    } catch (_) {
      selectedRoadmap = null;
    }
  }

  const { phases } = userGoal.goal_catalog;
  const availabilitySlots = userGoal.user.availability_slots;
  const userTimezone = (userGoal.user as any)?.timezone || 'UTC';
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
    scheduled_date: Date | null;
    start_time: string | null;
    end_time: string | null;
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
    day_number: number;
    sequence_order: number;
    scheduled_date: Date | null;
    start_time: string | null;
    end_time: string | null;
    status: string;
    tier: SessionTier;
  }[] = [];

  // Generate 12 weeks of sessions
  const TOTAL_WEEKS = 12;

  for (let weekIndex = 0; weekIndex < TOTAL_WEEKS; weekIndex++) {
    const isCurrentRollingWeek = weekIndex === 0;

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
      
      // Determine day key from date in user timezone
      const dayKey = getZonedTimeParts(dayDate, userTimezone).dayKey;

      let intervals = [...baselineFreeByDay[dayKey].map((i) => ({ ...i }))];
      let existingSessionCount = 0;

      // Deduct intervals of any sessions already completed on this day
      if (doneSessions.length > 0) {
        const dStr = getZonedDateString(dayDate, userTimezone);
        const dayDone = doneSessions.filter((s) => {
          if (!s.scheduled_date) return false;
          const sStr = getZonedDateString(s.scheduled_date, userTimezone);
          return sStr === dStr;
        });

        for (const ds of dayDone) {
          if (ds.start_time && ds.end_time) {
            intervals = subtractIntervals(intervals, {
              start: timeToMinutes(ds.start_time),
              end: timeToMinutes(ds.end_time),
            });
            existingSessionCount++;
          }
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
          if (!s.scheduled_date) return false;
          const sTime = new Date(s.scheduled_date).getTime();
          return s.task_template_id === task.id && sTime >= weekStartTime && sTime < weekEndTime;
        }).length;
      }

      let targetSessions = task.sessions_per_week;
      if (selectedRoadmap?.phase_emphasis && typeof selectedRoadmap.phase_emphasis === 'object') {
        const multiplier = (selectedRoadmap.phase_emphasis as any)[activePhase.title];
        if (typeof multiplier === 'number' && multiplier > 0) {
          targetSessions = Math.max(1, Math.round(task.sessions_per_week * multiplier));
        }
      }

      const neededSessions = Math.max(0, targetSessions - doneCountForTaskThisWeek);
      if (neededSessions <= 0) {
        continue;
      }

      const duration = Math.max(
        15,
        task.session_duration_minutes + (selectedRoadmap?.daily_minutes_variance || 0)
      );
      const prefWindow = getPreferredWindow(task.preferred_time_of_day);

      // Prioritize days to spread load evenly across week, honoring roadmap days_per_week
      let placedCount = 0;
      let candidateDayIndices = [0, 2, 4, 1, 3, 5, 6];
      if (selectedRoadmap?.days_per_week === 3) {
        candidateDayIndices = [0, 2, 4, 1, 3, 5, 6]; // Mon, Wed, Fri
      } else if (selectedRoadmap?.days_per_week === 4) {
        candidateDayIndices = [0, 1, 3, 5, 2, 4, 6]; // Mon, Tue, Thu, Sat
      } else if (selectedRoadmap?.days_per_week === 5) {
        candidateDayIndices = [0, 1, 2, 3, 4, 5, 6]; // Mon-Fri
      }

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
            day_number: weekIndex * 7 + day.dayOffsetInWeek,
            sequence_order: 0,
            scheduled_date: isCurrentRollingWeek ? day.date : null,
            start_time: isCurrentRollingWeek ? minutesToTime(chosenSlot.start) : null,
            end_time: isCurrentRollingWeek ? minutesToTime(chosenSlot.end) : null,
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
                day_number: weekIndex * 7 + day.dayOffsetInWeek,
                sequence_order: 0,
                scheduled_date: isCurrentRollingWeek ? day.date : null,
                start_time: isCurrentRollingWeek ? minutesToTime(slot.start) : null,
                end_time: isCurrentRollingWeek ? minutesToTime(slot.end) : null,
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

  // Sort sessions chronologically and assign sequence_order (1-indexed)
  sessionsToCreate.sort((a, b) => {
    if (a.day_number !== b.day_number) {
      return a.day_number - b.day_number;
    }
    const aTime = a.start_time || '';
    const bTime = b.start_time || '';
    return aTime.localeCompare(bTime);
  });
  sessionsToCreate.forEach((session, index) => {
    session.sequence_order = index + 1;
  });

  // Bulk create all sessions in database
  if (sessionsToCreate.length > 0) {
    await prisma.session.createMany({
      data: sessionsToCreate,
    });
  }

  return sessionsToCreate.length + doneSessions.length;
}

/**
 * Materializes sessions for a specific week offset (e.g. week 1, week 2...)
 * into real calendar dates and start/end times based on the user's availability routine
 * and current_plan_day_offset.
 */
export async function materializeWeekForGoal(
  userGoalId: string,
  weekOffset: number
): Promise<number> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      user: {
        include: { availability_slots: true },
      },
    },
  });

  if (!userGoal) return 0;

  const weekStartDay = weekOffset * 7;
  const weekEndDay = weekStartDay + 7;

  // Find unmaterialized sessions for this week
  const unmaterialized = await prisma.session.findMany({
    where: {
      user_goal_id: userGoalId,
      day_number: { gte: weekStartDay, lt: weekEndDay },
      scheduled_date: null,
    },
    include: {
      task_template: true,
    },
    orderBy: { sequence_order: 'asc' },
  });

  if (unmaterialized.length === 0) return 0;

  const startDate = new Date(userGoal.start_date);
  const planOffset = userGoal.current_plan_day_offset || 0;
  const userTimezone = (userGoal.user as any)?.timezone || 'UTC';

  // Build baseline free intervals for each day of week
  const busyByDay: Record<string, TimeInterval[]> = {
    MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [],
  };
  for (const slot of userGoal.user.availability_slots) {
    if (busyByDay[slot.day_of_week]) {
      busyByDay[slot.day_of_week].push({
        start: timeToMinutes(slot.start_time),
        end: timeToMinutes(slot.end_time),
      });
    }
  }

  const baselineFreeByDay: Record<string, TimeInterval[]> = {};
  for (const day of DAY_KEYS) {
    let openWindow: TimeInterval = { start: 7 * 60, end: 22 * 60 };
    if (day === 'SUN') openWindow = { start: 8 * 60, end: 21 * 60 };
    else if (day === 'SAT') openWindow = { start: 8 * 60, end: 21.5 * 60 };

    let free = [openWindow];
    for (const b of busyByDay[day] || []) {
      free = subtractIntervals(free, b);
    }
    baselineFreeByDay[day] = free;
  }

  // Already materialized sessions in this week to avoid time collisions
  const existingMaterialized = await prisma.session.findMany({
    where: {
      user_goal_id: userGoalId,
      day_number: { gte: weekStartDay, lt: weekEndDay },
      scheduled_date: { not: null },
    },
  });

  const intervalsByDayNumber: Record<number, TimeInterval[]> = {};

  for (let d = weekStartDay; d < weekEndDay; d++) {
    const effectiveDay = d + planOffset;
    const dayDate = new Date(startDate.getTime() + effectiveDay * 24 * 60 * 60 * 1000);
    const dayKey = getZonedTimeParts(dayDate, userTimezone).dayKey;
    let intervals = [...baselineFreeByDay[dayKey].map((i) => ({ ...i }))];

    // Subtract already materialized sessions on this day
    const daySessions = existingMaterialized.filter((s) => s.day_number === d);
    for (const ds of daySessions) {
      if (ds.start_time && ds.end_time) {
        intervals = subtractIntervals(intervals, {
          start: timeToMinutes(ds.start_time),
          end: timeToMinutes(ds.end_time),
        });
      }
    }
    intervalsByDayNumber[d] = intervals;
  }

  let materializedCount = 0;

  for (const session of unmaterialized) {
    if (session.day_number === null || session.day_number === undefined) continue;

    const d = session.day_number;
    const effectiveDay = d + planOffset;
    const sessionDate = new Date(startDate.getTime() + effectiveDay * 24 * 60 * 60 * 1000);
    const duration = session.task_template?.session_duration_minutes || 45;
    const prefWindow = getPreferredWindow(session.task_template?.preferred_time_of_day);

    let chosenSlot: TimeInterval | null = null;
    const available = intervalsByDayNumber[d] || [];

    for (const interval of available) {
      if (interval.end - interval.start >= duration) {
        const prefStart = Math.max(interval.start, prefWindow.start);
        const prefEnd = Math.min(interval.end, prefWindow.end);
        if (prefEnd - prefStart >= duration) {
          chosenSlot = { start: prefStart, end: prefStart + duration };
          break;
        }
      }
    }

    if (!chosenSlot) {
      for (const interval of available) {
        if (interval.end - interval.start >= duration) {
          chosenSlot = { start: interval.start, end: interval.start + duration };
          break;
        }
      }
    }

    // Default fallback if day is packed
    if (!chosenSlot) {
      chosenSlot = { start: 9 * 60, end: 9 * 60 + duration };
    } else {
      intervalsByDayNumber[d] = subtractIntervals(intervalsByDayNumber[d], chosenSlot);
    }

    await prisma.session.update({
      where: { id: session.id },
      data: {
        scheduled_date: sessionDate,
        start_time: minutesToTime(chosenSlot.start),
        end_time: minutesToTime(chosenSlot.end),
      },
    });
    materializedCount++;
  }

  return materializedCount;
}
