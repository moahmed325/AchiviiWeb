import { prisma } from '../prisma.js';
import {
  calculateAvailableWindows,
  timeToMinutes,
  minutesToTime,
  getOrCreateLifeStructure,
  AvailableWindow,
} from './lifeStructureEngine.js';

export interface ScheduleDayOptions {
  forceRegenerate?: boolean;
}

export interface WindowSelectionParams {
  nominalMinutes: number;
  mvdMinutes: number;
  preferredWindow?: 'MORNING' | 'AFTERNOON' | 'EVENING';
  userMemory?: string;
  energyRequirement?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface OptimalWindowResult {
  window: AvailableWindow;
  startMins: number;
  endMins: number;
  allocatedMinutes: number;
}

/**
 * Cleans long robotic prefixes and trims titles to simple, concise names (2 to 5 words max).
 */
export function cleanDoseTitle(rawTitle: string): string {
  if (!rawTitle) return 'Ambition Focus Dose';
  const cleaned = rawTitle
    .replace(/^(Core Adaptation Session|Consolidation Practice|Supportive Continuity|Targeted Focus Scaffolding):\s*/i, '')
    .trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 5) return cleaned;
  return words.slice(0, 4).join(' ');
}

/**
 * Finds the optimal available window strictly avoiding routine blocks and honoring user preferences:
 * 1. Preferred Window (MORNING / AFTERNOON / EVENING)
 * 2. User Persistent Memory (Night owl -> evening, Early bird -> morning, Parent -> after bedtime, ADHD -> morning peak)
 * 3. Energy profile matching
 * 4. Humane 15-minute start time alignment
 */
export function findOptimalAmbitionWindow(
  windows: AvailableWindow[],
  params: WindowSelectionParams
): OptimalWindowResult | null {
  if (!windows || windows.length === 0) return null;

  const mvd = params.mvdMinutes || 20;
  const nominal = params.nominalMinutes || 45;

  const candidates = windows
    .map((w) => {
      const s = timeToMinutes(w.start_time);
      const e = timeToMinutes(w.end_time);
      return {
        ...w,
        startMins: s,
        endMins: e,
        capacity: e - s,
      };
    })
    .filter((w) => w.capacity >= mvd);

  if (candidates.length === 0) return null;

  // Determine user preference from explicit params and userMemory
  let prefWindow = params.preferredWindow;
  const memoryLower = (params.userMemory || '').toLowerCase();

  if (!prefWindow) {
    if (
      memoryLower.includes('night owl') ||
      memoryLower.includes('evening') ||
      memoryLower.includes('after work') ||
      memoryLower.includes('after 8pm') ||
      memoryLower.includes('after 7pm') ||
      memoryLower.includes('kids sleep')
    ) {
      prefWindow = 'EVENING';
    } else if (
      memoryLower.includes('early bird') ||
      memoryLower.includes('morning person') ||
      memoryLower.includes('before work') ||
      memoryLower.includes('at sunrise')
    ) {
      prefWindow = 'MORNING';
    } else if (memoryLower.includes('afternoon') || memoryLower.includes('lunch break')) {
      prefWindow = 'AFTERNOON';
    }
  }

  // Score each candidate window
  const scored = candidates.map((cand) => {
    let score = 100;
    const midpoint = (cand.startMins + cand.endMins) / 2;

    // Window time classification:
    // Morning: midpoint < 720 (before 12:00)
    // Afternoon: 720 <= midpoint < 1080 (12:00 to 18:00)
    // Evening: midpoint >= 1080 (18:00 onwards)
    const windowTime: 'MORNING' | 'AFTERNOON' | 'EVENING' =
      midpoint < 720 ? 'MORNING' : midpoint < 1080 ? 'AFTERNOON' : 'EVENING';

    // 1. Preferred Window Matching
    if (prefWindow) {
      if (windowTime === prefWindow) {
        score += 200;
      } else if (
        (prefWindow === 'MORNING' && windowTime === 'AFTERNOON') ||
        (prefWindow === 'AFTERNOON' && windowTime === 'EVENING') ||
        (prefWindow === 'EVENING' && windowTime === 'AFTERNOON')
      ) {
        score += 30;
      } else {
        score -= 100;
      }
    }

    // 2. Memory context adjustments
    if (memoryLower.includes('night owl') || memoryLower.includes('evening')) {
      if (cand.startMins >= 1080) score += 120; // 18:00+
      if (cand.startMins < 540) score -= 150; // before 09:00
    }
    if (memoryLower.includes('early bird') || memoryLower.includes('morning person')) {
      if (cand.startMins < 600) score += 120; // before 10:00
      if (cand.startMins >= 1200) score -= 100; // after 20:00
    }
    if (memoryLower.includes('parent') || memoryLower.includes('kids')) {
      if (cand.startMins >= 1200 || cand.startMins <= 480) score += 60;
    }

    // 3. Energy match
    if (params.energyRequirement) {
      if (cand.energy === params.energyRequirement) {
        score += 40;
      } else if (params.energyRequirement === 'HIGH' && cand.energy === 'LOW') {
        score -= 30;
      }
    }

    // 4. Capacity comfort (prefer window that fits nominal comfortably)
    if (cand.capacity >= nominal) {
      score += 50;
    } else {
      score += Math.round((cand.capacity / nominal) * 25);
    }

    return { cand, score, windowTime };
  });

  // Sort by score descending; if tied, favor the one with more capacity
  scored.sort((a, b) => b.score - a.score || b.cand.capacity - a.cand.capacity);
  const best = scored[0].cand;

  // Calculate clean start and end minutes within best window
  const allocatedMinutes = Math.min(nominal, best.capacity);
  let chosenStart = best.startMins;

  // If the window is in the evening and preferred is EVENING (or night owl):
  if (prefWindow === 'EVENING' && chosenStart < 1140 && best.endMins >= 1200 + allocatedMinutes) {
    chosenStart = 1200; // 20:00
  } else if (prefWindow === 'EVENING' && chosenStart < 1140 && best.endMins >= 1140 + allocatedMinutes) {
    chosenStart = 1140; // 19:00
  } else {
    // Align to 15-minute boundary if it fits
    const rem15 = chosenStart % 15;
    if (rem15 !== 0 && chosenStart + (15 - rem15) + allocatedMinutes <= best.endMins) {
      chosenStart += (15 - rem15);
    }
  }

  const chosenEnd = chosenStart + allocatedMinutes;

  return {
    window: {
      start_time: best.start_time,
      end_time: best.end_time,
      duration_minutes: best.duration_minutes,
      energy: best.energy,
    },
    startMins: chosenStart,
    endMins: chosenEnd,
    allocatedMinutes,
  };
}

/**
 * Materializes daily schedule items (both routine blocks and ambition doses) for a date range.
 */
export async function materializeDays(
  userId: string,
  startDateInput: Date | string,
  endDateInput: Date | string,
  options: ScheduleDayOptions = {}
) {
  const start = new Date(startDateInput);
  const end = new Date(endDateInput);
  const life = await getOrCreateLifeStructure(userId);

  // Fetch user memory context for intelligent scheduling
  const userRecord = await prisma.user.findUnique({
    where: { id: userId },
    select: { user_memory: true },
  });

  // Fetch active user goals ordered by priority
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
          items: {
            orderBy: { planned_week: 'asc' },
          },
        },
      },
    },
    orderBy: { priority_rank: 'asc' },
  });

  const allMaterialized: any[] = [];

  // Iterate day by day
  const cur = new Date(start);
  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');
    const dayOfWeek = cur.getDay();

    // Check if items already exist for this date
    const existing = await prisma.dailyScheduleItem.findMany({
      where: {
        user_id: userId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      orderBy: { start_time: 'asc' },
    });

    if (existing.length > 0 && !options.forceRegenerate) {
      allMaterialized.push(...existing);
      cur.setDate(cur.getDate() + 1);
      continue;
    }

    if (options.forceRegenerate && existing.length > 0) {
      // Delete uncompleted non-locked items
      await prisma.dailyScheduleItem.deleteMany({
        where: {
          user_id: userId,
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: { in: ['SCHEDULED', 'SKIPPED_INTENTIONAL'] },
        },
      });
    }

    // 1. Materialize Routine Blocks for this day
    const routineBlocks = (life.routine_blocks || []).filter((block: any) => {
      try {
        const days = JSON.parse(block.days_of_week) as number[];
        return Array.isArray(days) && days.includes(dayOfWeek);
      } catch {
        return false;
      }
    });

    for (const b of routineBlocks) {
      const item = await prisma.dailyScheduleItem.create({
        data: {
          user_id: userId,
          date: dayStart,
          start_time: b.start_time,
          end_time: b.end_time,
          item_type: 'ROUTINE',
          category: b.category,
          title: b.title,
          is_locked: b.is_hard_constraint,
          status: 'SCHEDULED',
        },
      });
      allMaterialized.push(item);
    }

    // 2. Calculate free available windows for placing ambition doses
    const availableWindows = await calculateAvailableWindows(userId, dateStr);

    // Make a mutable copy of windows to allocate into
    const mutableWindows = availableWindows.map((w: any) => ({
      startMins: timeToMinutes(w.start_time),
      endMins: timeToMinutes(w.end_time),
      energy: w.energy,
    }));

    // 3. For each active goal, place pending trajectory doses
    for (const goal of activeGoals) {
      const activeTrajectory = goal.trajectory_versions[0];
      if (!activeTrajectory || activeTrajectory.items.length === 0) continue;

      const goalStart = new Date(goal.start_date);
      const dayOffset = Math.max(0, Math.floor((cur.getTime() - goalStart.getTime()) / (24 * 60 * 60 * 1000)));
      const weekNumber = Math.floor(dayOffset / 7) + 1;
      const weekItems = activeTrajectory.items.filter((i) => i.planned_week === weekNumber);
      const itemsPool = weekItems.length > 0 ? weekItems : activeTrajectory.items;

      // Determine cadence: which days have sessions
      let shouldScheduleToday = false;
      let pendingItem = itemsPool[0];

      if (itemsPool.length === 1 || (start.getTime() === end.getTime() && options.forceRegenerate)) {
        shouldScheduleToday = true;
        pendingItem = itemsPool[0];
      } else if (itemsPool.length >= 7) {
        shouldScheduleToday = true;
        pendingItem = itemsPool[dayOfWeek % itemsPool.length];
      } else if (itemsPool.length >= 3) {
        const sessionDays = itemsPool.length === 4 ? [1, 3, 5, 6] : [1, 3, 5];
        if (sessionDays.includes(dayOfWeek)) {
          shouldScheduleToday = true;
          const sessionIdx = sessionDays.indexOf(dayOfWeek);
          pendingItem = itemsPool[sessionIdx % itemsPool.length];
        }
      } else {
        const sessionDays = [2, 4];
        if (sessionDays.includes(dayOfWeek)) {
          shouldScheduleToday = true;
          const sessionIdx = sessionDays.indexOf(dayOfWeek);
          pendingItem = itemsPool[sessionIdx % itemsPool.length];
        }
      }

      if (!shouldScheduleToday) continue;

      const nominalMinutes = (pendingItem as any).standard_duration_minutes || (pendingItem as any).estimated_minutes || 60;
      const mvdMinutes = (pendingItem as any).mvs_duration_minutes || Math.max(15, Math.round(nominalMinutes * 0.4));
      const reqEnergy = (pendingItem as any).energy_requirement || 'MEDIUM';

      // Determine preferred window from metadata or item
      let prefWindow = (pendingItem as any).preferred_window;
      if (!prefWindow && goal.goal_catalog?.blueprint_metadata) {
        try {
          const meta = typeof goal.goal_catalog.blueprint_metadata === 'string'
            ? JSON.parse(goal.goal_catalog.blueprint_metadata)
            : goal.goal_catalog.blueprint_metadata;
          prefWindow = meta.preferred_window;
        } catch {}
      }

      // Convert mutable windows into AvailableWindow objects
      const currentAvailableWindows: AvailableWindow[] = mutableWindows.map((w) => ({
        start_time: minutesToTime(w.startMins),
        end_time: minutesToTime(w.endMins),
        duration_minutes: w.endMins - w.startMins,
        energy: w.energy,
      }));

      const optimal = findOptimalAmbitionWindow(currentAvailableWindows, {
        nominalMinutes,
        mvdMinutes,
        preferredWindow: prefWindow,
        userMemory: userRecord?.user_memory || undefined,
        energyRequirement: reqEnergy,
      });

      if (optimal) {
        // Adjust mutable windows so no overlapping dose is placed in the same slot
        for (let wIdx = 0; wIdx < mutableWindows.length; wIdx++) {
          const win = mutableWindows[wIdx];
          if (win.startMins <= optimal.startMins && win.endMins >= optimal.endMins) {
            if (win.endMins - optimal.endMins >= 15) {
              win.startMins = optimal.endMins;
            } else {
              mutableWindows.splice(wIdx, 1);
            }
            break;
          }
        }

        // Extract clear detailed description
        let doseDescription = (pendingItem as any).description || (pendingItem as any).why_this_matters || (pendingItem as any).purpose || '';
        if (!doseDescription && Array.isArray((pendingItem as any).fallback_options)) {
          const whyEntry = (pendingItem as any).fallback_options.find((f: any) => typeof f === 'string' && f.startsWith('WHY_THIS_MATTERS: '));
          if (whyEntry) {
            doseDescription = whyEntry.replace('WHY_THIS_MATTERS: ', '');
          }
        }

        const rawTitle = (pendingItem as any).intervention_name || (pendingItem as any).title || 'Ambition Focus Dose';
        const cleanTitle = cleanDoseTitle(rawTitle);

        const doseItem = await prisma.dailyScheduleItem.create({
          data: {
            user_id: userId,
            user_goal_id: goal.id,
            trajectory_item_id: pendingItem.id,
            date: dayStart,
            start_time: minutesToTime(optimal.startMins),
            end_time: minutesToTime(optimal.endMins),
            item_type: 'AMBITION_DOSE',
            category: (goal as any).category || 'AMBITION',
            title: cleanTitle,
            description: doseDescription || 'Core adaptation session focused on this milestone phase.',
            allocated_minutes: optimal.allocatedMinutes,
            minimum_viable_minutes: mvdMinutes,
            energy_level: reqEnergy,
            status: 'SCHEDULED',
          },
        });
        allMaterialized.push(doseItem);
      }
    }

    cur.setDate(cur.getDate() + 1);
  }

  return allMaterialized.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.start_time.localeCompare(b.start_time);
  });
}

/**
 * Adapts today's schedule when a delay or friction occurs.
 * Implements the NO-DEBT INVARIANT:
 * 1. Shifts uncompleted items to remaining open windows.
 * 2. Compresses to minimum_viable_minutes (MVS) if time is constrained.
 * 3. Skips intentionally if zero windows remain without rolling backlog debt into tomorrow.
 */
export async function adaptTodaySchedule(
  userId: string,
  targetDateInput: Date | string,
  shiftMinutes: number = 30,
  reason: string = 'Intraday Schedule Shift'
) {
  const dateStr = typeof targetDateInput === 'string'
    ? targetDateInput
    : targetDateInput.toISOString().split('T')[0];

  const dayStart = new Date(dateStr + 'T00:00:00.000Z');
  const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Fetch today's schedule items
  const todayItems = await prisma.dailyScheduleItem.findMany({
    where: {
      user_id: userId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
    },
    orderBy: { start_time: 'asc' },
  });

  const uncompletedDoses = todayItems.filter(
    (item: any) => item.item_type === 'AMBITION_DOSE' && item.status === 'SCHEDULED'
  );

  if (uncompletedDoses.length === 0) {
    return { modified: 0, items: todayItems, message: 'No uncompleted ambition doses to adapt today.' };
  }

  // Recalculate remaining windows from current time forward
  const openWindows = await calculateAvailableWindows(userId, dateStr, 15);
  const remainingWindows = openWindows
    .map((w: any) => ({
      startMins: Math.max(currentMins + shiftMinutes, timeToMinutes(w.start_time)),
      endMins: timeToMinutes(w.end_time),
      energy: w.energy,
    }))
    .filter((w: any) => w.endMins - w.startMins >= 15);

  let modifiedCount = 0;
  const updatedItems: any[] = [];

  for (const dose of uncompletedDoses) {
    const mvd = dose.minimum_viable_minutes || 20;
    const nominal = dose.allocated_minutes || 45;

    // Try to find a remaining window
    let assigned = false;
    for (const win of remainingWindows) {
      const capacity = win.endMins - win.startMins;
      if (capacity >= mvd) {
        const allocated = Math.min(nominal, capacity);
        const newStart = win.startMins;
        const newEnd = newStart + allocated;
        win.startMins = newEnd;

        const updated = await prisma.dailyScheduleItem.update({
          where: { id: dose.id },
          data: {
            start_time: minutesToTime(newStart),
            end_time: minutesToTime(newEnd),
            allocated_minutes: allocated,
            minimum_viable_minutes: mvd,
          },
        });
        updatedItems.push(updated);
        modifiedCount++;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // No space remaining today! Apply No-Debt Invariant:
      // Mark as SKIPPED_INTENTIONAL without carrying backlog debt
      const skipped = await prisma.dailyScheduleItem.update({
        where: { id: dose.id },
        data: {
          status: 'SKIPPED_INTENTIONAL',
        },
      });
      updatedItems.push(skipped);
      modifiedCount++;
    }
  }

  return {
    modified: modifiedCount,
    updatedItems,
    message: `Adapted ${modifiedCount} schedule items with zero backlog debt.`,
  };
}
