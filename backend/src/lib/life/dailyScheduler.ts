import { prisma } from '../prisma.js';
import { calculateAvailableWindows, timeToMinutes, minutesToTime, getOrCreateLifeStructure } from './lifeStructureEngine.js';

export interface ScheduleDayOptions {
  forceRegenerate?: boolean;
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

  // Fetch active user goals ordered by priority
  const activeGoals = await prisma.userGoal.findMany({
    where: {
      user_id: userId,
      status: 'ACTIVE',
    },
    include: {
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

      // Pick next pending item
      const pendingItem = activeTrajectory.items[0];
      const nominalMinutes = (pendingItem as any).standard_duration_minutes || (pendingItem as any).estimated_minutes || 60;
      const mvdMinutes = (pendingItem as any).mvs_duration_minutes || Math.max(15, Math.round(nominalMinutes * 0.4));
      const reqEnergy = (pendingItem as any).energy_requirement || 'MEDIUM';

      // Find best matching window
      let selectedWindowIdx = -1;
      for (let i = 0; i < mutableWindows.length; i++) {
        const win = mutableWindows[i];
        const capacity = win.endMins - win.startMins;
        if (capacity >= mvdMinutes) {
          const energyMatches =
            reqEnergy === 'LOW' ||
            win.energy === reqEnergy ||
            (reqEnergy === 'MEDIUM' && win.energy === 'HIGH');

          if (energyMatches) {
            selectedWindowIdx = i;
            break;
          }
        }
      }

      // If no perfect energy match, take first window that can fit the dose
      if (selectedWindowIdx === -1) {
        for (let i = 0; i < mutableWindows.length; i++) {
          if (mutableWindows[i].endMins - mutableWindows[i].startMins >= mvdMinutes) {
            selectedWindowIdx = i;
            break;
          }
        }
      }

      if (selectedWindowIdx !== -1) {
        const win = mutableWindows[selectedWindowIdx];
        const availableDuration = win.endMins - win.startMins;
        const allocatedMinutes = Math.min(nominalMinutes, availableDuration);
        const startMins = win.startMins;
        const endMins = startMins + allocatedMinutes;

        // Shrink the window
        win.startMins = endMins;

        // Extract clear why_this_matters description if available
        let doseDescription = (pendingItem as any).why_this_matters || (pendingItem as any).purpose || (pendingItem as any).description || '';
        if (!doseDescription && Array.isArray((pendingItem as any).fallback_options)) {
          const whyEntry = (pendingItem as any).fallback_options.find((f: any) => typeof f === 'string' && f.startsWith('WHY_THIS_MATTERS: '));
          if (whyEntry) {
            doseDescription = whyEntry.replace('WHY_THIS_MATTERS: ', '');
          }
        }

        const doseItem = await prisma.dailyScheduleItem.create({
          data: {
            user_id: userId,
            user_goal_id: goal.id,
            trajectory_item_id: pendingItem.id,
            date: dayStart,
            start_time: minutesToTime(startMins),
            end_time: minutesToTime(endMins),
            item_type: 'AMBITION_DOSE',
            category: (goal as any).category || 'AMBITION',
            title: (pendingItem as any).intervention_name || (pendingItem as any).title || 'Ambition Focus Dose',
            description: doseDescription || 'Core adaptation session focused on this milestone phase.',
            allocated_minutes: allocatedMinutes,
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
