import { prisma } from '../prisma.js';

export interface AvailableWindow {
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
  duration_minutes: number;
  energy: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface RoutineBlockInput {
  title: string;
  category: string;
  days_of_week: number[] | string[]; // 0=Sun, 1=Mon, ..., 6=Sat or ['MON', 'TUE', ...]
  start_time: string;     // "HH:mm"
  end_time: string;       // "HH:mm"
  is_hard_constraint?: boolean;
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
}

const DAY_NAME_TO_INT: Record<string, number> = {
  SUN: 0, SUNDAY: 0,
  MON: 1, MONDAY: 1,
  TUE: 2, TUESDAY: 2,
  WED: 3, WEDNESDAY: 3,
  THU: 4, THURSDAY: 4,
  FRI: 5, FRIDAY: 5,
  SAT: 6, SATURDAY: 6,
};

/**
 * Normalizes any format of days of week (numbers 0-6, string abbreviations like 'MON', 'TUE',
 * JSON arrays, or comma-separated strings) into a sorted array of unique integers (0=Sun..6=Sat).
 */
export function normalizeDaysOfWeek(rawDays: any): number[] {
  if (!rawDays) return [1, 2, 3, 4, 5];
  let parsed = rawDays;
  if (typeof rawDays === 'string') {
    try {
      parsed = JSON.parse(rawDays);
    } catch {
      parsed = rawDays.split(',').map((s: string) => s.trim());
    }
  }
  if (!Array.isArray(parsed)) return [1, 2, 3, 4, 5];

  const result: number[] = [];
  for (const item of parsed) {
    if (typeof item === 'number' && item >= 0 && item <= 6) {
      if (!result.includes(item)) result.push(item);
    } else if (typeof item === 'string') {
      const upper = item.trim().toUpperCase();
      if (DAY_NAME_TO_INT[upper] !== undefined) {
        const d = DAY_NAME_TO_INT[upper];
        if (!result.includes(d)) result.push(d);
      } else {
        const n = parseInt(upper, 10);
        if (!isNaN(n) && n >= 0 && n <= 6 && !result.includes(n)) {
          result.push(n);
        }
      }
    }
  }
  return result.length > 0 ? result.sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

/**
 * Parses "HH:mm" string into minutes from midnight (0 to 1439).
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Formats minutes from midnight into "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Gets or creates the default LifeStructure and core routine blocks for a user.
 */
export async function getOrCreateLifeStructure(userId: string) {
  let life = await prisma.lifeStructure.findUnique({
    where: { user_id: userId },
    include: {
      routine_blocks: {
        orderBy: { start_time: 'asc' },
      },
    },
  });

  if (!life) {
    life = await prisma.lifeStructure.create({
      data: {
        user_id: userId,
        wake_time: '07:00',
        sleep_time: '23:00',
        buffer_minutes: 30,
        schedule_reliability: 'HIGH',
        energy_profile: JSON.stringify({
          morning_peak: true,
          afternoon_dip: true,
          evening_wind_down: true,
        }),
        routine_blocks: {
          create: [
            {
              title: 'Work / Professional Focus',
              category: 'WORK',
              days_of_week: JSON.stringify([1, 2, 3, 4, 5]),
              start_time: '09:00',
              end_time: '17:00',
              is_hard_constraint: true,
              buffer_before_minutes: 15,
              buffer_after_minutes: 15,
            },
            {
              title: 'Lunch & Reset',
              category: 'MEAL',
              days_of_week: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
              start_time: '12:30',
              end_time: '13:30',
              is_hard_constraint: false,
              buffer_before_minutes: 0,
              buffer_after_minutes: 0,
            },
            {
              title: 'Dinner & Family Time',
              category: 'FAMILY',
              days_of_week: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
              start_time: '19:00',
              end_time: '20:00',
              is_hard_constraint: false,
              buffer_before_minutes: 0,
              buffer_after_minutes: 0,
            },
          ],
        },
      },
      include: {
        routine_blocks: {
          orderBy: { start_time: 'asc' },
        },
      },
    });
  }

  return life;
}

/**
 * Updates a user's LifeStructure settings.
 */
export async function updateLifeStructure(
  userId: string,
  data: Partial<{
    wake_time: string;
    sleep_time: string;
    buffer_minutes: number;
    schedule_reliability: string;
    energy_profile: any;
    routine_blocks?: any[];
  }>
) {
  const { routine_blocks, ...rawUpdate } = data as any;
  const updateData: any = { ...rawUpdate };
  if (data.energy_profile !== undefined && typeof data.energy_profile !== 'string') {
    updateData.energy_profile = JSON.stringify(data.energy_profile);
  }

  const life = await prisma.lifeStructure.upsert({
    where: { user_id: userId },
    create: {
      user_id: userId,
      wake_time: data.wake_time || '07:00',
      sleep_time: data.sleep_time || '23:00',
      buffer_minutes: data.buffer_minutes ?? 30,
      schedule_reliability: data.schedule_reliability || 'HIGH',
      energy_profile: updateData.energy_profile || '{}',
    },
    update: updateData,
    include: {
      routine_blocks: true,
    },
  });

  if (Array.isArray(routine_blocks)) {
    // Sync routine blocks
    await prisma.routineBlock.deleteMany({
      where: { life_structure_id: life.id },
    });

    for (const rb of routine_blocks) {
      const normalizedDays = normalizeDaysOfWeek(rb.days_of_week);
      await prisma.routineBlock.create({
        data: {
          life_structure_id: life.id,
          title: rb.title,
          category: rb.category || 'WORK',
          days_of_week: JSON.stringify(normalizedDays),
          start_time: rb.start_time,
          end_time: rb.end_time,
          is_hard_constraint: rb.is_hard_constraint ?? true,
          buffer_before_minutes: rb.buffer_before_minutes ?? 0,
          buffer_after_minutes: rb.buffer_after_minutes ?? 0,
        },
      });
    }

    return prisma.lifeStructure.findUniqueOrThrow({
      where: { id: life.id },
      include: { routine_blocks: true },
    });
  }

  return life;
}

/**
 * Adds a routine block to a user's life structure.
 */
export async function createRoutineBlock(userId: string, data: RoutineBlockInput) {
  const life = await getOrCreateLifeStructure(userId);
  return prisma.routineBlock.create({
    data: {
      life_structure_id: life.id,
      title: data.title,
      category: data.category,
      days_of_week: JSON.stringify(normalizeDaysOfWeek(data.days_of_week)),
      start_time: data.start_time,
      end_time: data.end_time,
      is_hard_constraint: data.is_hard_constraint ?? true,
      buffer_before_minutes: data.buffer_before_minutes ?? 0,
      buffer_after_minutes: data.buffer_after_minutes ?? 0,
    },
  });
}

/**
 * Updates an existing routine block.
 */
export async function updateRoutineBlock(
  blockId: string,
  data: Partial<RoutineBlockInput>
) {
  const updateData: any = { ...data };
  if (data.days_of_week) {
    updateData.days_of_week = JSON.stringify(normalizeDaysOfWeek(data.days_of_week));
  }
  return prisma.routineBlock.update({
    where: { id: blockId },
    data: updateData,
  });
}

/**
 * Deletes a routine block.
 */
export async function deleteRoutineBlock(blockId: string) {
  return prisma.routineBlock.delete({
    where: { id: blockId },
  });
}

/**
 * Calculates open available time windows for a user on a given date,
 * strictly bounded between wake_time and sleep_time and avoiding all active routine blocks.
 */
export async function calculateAvailableWindows(
  userId: string,
  targetDate: Date | string,
  minDurationMinutes: number = 20
): Promise<AvailableWindow[]> {
  const life = await getOrCreateLifeStructure(userId);
  const dateObj = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const wakeMins = timeToMinutes(life.wake_time);
  const sleepMins = timeToMinutes(life.sleep_time);

  // If sleep time is on or before wake time (e.g. night shift), adjust sleep to 1440
  const effectiveSleepMins = sleepMins <= wakeMins ? 1440 : sleepMins;

  // Filter routine blocks for this day of week using robust normalization
  const activeBlocks = (life.routine_blocks || []).filter((block: any) => {
    try {
      const days = normalizeDaysOfWeek(block.days_of_week);
      return days.includes(dayOfWeek);
    } catch {
      return false;
    }
  });

  // Convert blocks into occupied intervals with their buffer times included
  interface Interval {
    start: number;
    end: number;
  }

  const occupiedIntervals: Interval[] = [];

  for (const b of activeBlocks) {
    const rawStart = timeToMinutes(b.start_time);
    const rawEnd = timeToMinutes(b.end_time);
    const start = Math.max(wakeMins, rawStart - (b.buffer_before_minutes || 0));
    const end = Math.min(effectiveSleepMins, rawEnd + (b.buffer_after_minutes || 0));
    if (start < end) {
      occupiedIntervals.push({ start, end });
    }
  }

  // Sort occupied intervals by start time
  occupiedIntervals.sort((a, b) => a.start - b.start);

  // Merge overlapping occupied intervals
  const mergedOccupied: Interval[] = [];
  for (const interval of occupiedIntervals) {
    if (mergedOccupied.length === 0) {
      mergedOccupied.push({ ...interval });
    } else {
      const last = mergedOccupied[mergedOccupied.length - 1];
      if (interval.start <= last.end) {
        last.end = Math.max(last.end, interval.end);
      } else {
        mergedOccupied.push({ ...interval });
      }
    }
  }

  // Determine free intervals between wakeMins and effectiveSleepMins
  const freeIntervals: Interval[] = [];
  let currentPointer = wakeMins;

  for (const occ of mergedOccupied) {
    if (occ.start > currentPointer) {
      freeIntervals.push({ start: currentPointer, end: occ.start });
    }
    currentPointer = Math.max(currentPointer, occ.end);
  }

  if (currentPointer < effectiveSleepMins) {
    freeIntervals.push({ start: currentPointer, end: effectiveSleepMins });
  }

  // Determine energy level for each window based on position relative to wake time
  // Morning (wake to wake + 4 hours): HIGH
  // Midday / Afternoon (wake + 4h to wake + 9h): MEDIUM
  // Evening (wake + 9h onwards): LOW
  const morningThreshold = wakeMins + 240;
  const afternoonThreshold = wakeMins + 540;

  const windows: AvailableWindow[] = [];

  for (const free of freeIntervals) {
    const duration = free.end - free.start;
    if (duration >= minDurationMinutes) {
      const midpoint = (free.start + free.end) / 2;
      let energy: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (midpoint < morningThreshold) {
        energy = 'HIGH';
      } else if (midpoint > afternoonThreshold) {
        energy = 'LOW';
      } else {
        energy = 'MEDIUM';
      }

      windows.push({
        start_time: minutesToTime(free.start),
        end_time: minutesToTime(free.end),
        duration_minutes: duration,
        energy,
      });
    }
  }

  return windows;
}
