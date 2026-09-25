import type { DailyTask, DetailedStep, Goal, RoadmapWeek } from '../types';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Today's date key, in the calendar the task dates are written in.
 * The backend writes `DailyTask.date` as a UTC date (`toISOString().split('T')[0]` in `routes/goal.ts` and
 * `lib/ai/weekPlan.ts`); the user's timezone is stored but not used for task dates. So "today" is the UTC date.
 */
export function todayKey(now: Date): string {
  return now.toISOString().split('T')[0];
}

export function isToday(task: Pick<DailyTask, 'date'>, now: Date): boolean {
  return task.date === todayKey(now);
}

/** The current week's tasks, in day order. */
export function currentWeekTasks(goal: Pick<Goal, 'currentWeek' | 'dailyTasks'>): DailyTask[] {
  const week = goal.currentWeek || 1;
  return [...(goal.dailyTasks || [])].filter((t) => t.weekNumber === week).sort((a, b) => a.dayNumber - b.dayNumber);
}

/** The chosen task if it is in this week, else today's, else the first pending, else the first. */
export function selectTodayTask(tasks: DailyTask[], now: Date, selectedId?: string): DailyTask | null {
  if (tasks.length === 0) return null;
  if (selectedId) {
    const selected = tasks.find((t) => t.id === selectedId);
    if (selected) return selected;
  }
  return tasks.find((t) => isToday(t, now)) ?? tasks.find((t) => t.status === 'pending') ?? tasks[0];
}

/** Calendar days until `targetDate`, counted down from 90, clamped to 1–90. */
export function dayNumber(goal: Pick<Goal, 'targetDate'>, now: Date): number {
  const daysRemaining = Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - now.getTime()) / DAY_MS));
  return Math.min(90, Math.max(1, 91 - daysRemaining));
}

/** The stored steps. Bad or missing JSON gives no steps rather than an error. */
export function parseSteps(detailedSteps?: string | null): DetailedStep[] {
  if (!detailedSteps) return [];
  try {
    const parsed: unknown = JSON.parse(detailedSteps);
    return Array.isArray(parsed) ? (parsed as DetailedStep[]) : [];
  } catch {
    return [];
  }
}

export type ParsedIntention = { raw: string } | { when: string; where: string; action: string };

/** "When: … | Where: … | Action: …", or the raw text when it has none of those parts. */
export function parseIntention(intention?: string | null): ParsedIntention | null {
  if (!intention) return null;
  let when = '';
  let where = '';
  let action = '';
  for (const part of intention.split('|').map((p) => p.trim())) {
    const lower = part.toLowerCase();
    if (lower.startsWith('when:')) when = part.replace(/^when:\s*/i, '');
    else if (lower.startsWith('where:')) where = part.replace(/^where:\s*/i, '');
    else if (lower.startsWith('action:')) action = part.replace(/^action:\s*/i, '');
  }
  if (!when && !where && !action) return { raw: intention };
  return { when, where, action };
}

/** The roadmap week for `currentWeek`, else the first week. */
export function currentRoadmapWeek(goal: Pick<Goal, 'currentWeek' | 'roadmapWeeks'>): RoadmapWeek | undefined {
  const weeks = goal.roadmapWeeks || [];
  return weeks.find((w) => w.weekNumber === (goal.currentWeek || 1)) ?? weeks[0];
}

/** Practice days only: rest days are part of the plan, not something to complete. */
export function weekProgress(tasks: DailyTask[]): { practiceDays: number; practiceDone: number } {
  const practice = tasks.filter((t) => !t.isRestDay);
  return { practiceDays: practice.length, practiceDone: practice.filter((t) => t.status === 'completed').length };
}

export interface ParsedTaskNotes {
  freeformNotes: string;
  focusWins: string[];
}

/** Parses stored task notes, separating structured focus wins ("• Focus win: ...") from free-form practice notes. */
export function parseTaskNotes(notes?: string | null): ParsedTaskNotes {
  if (!notes || !notes.trim()) {
    return { freeformNotes: '', focusWins: [] };
  }
  const lines = notes.split('\n');
  const focusWins: string[] = [];
  const freeformLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*•\s*Focus win:\s*(.*)$/i);
    if (match) {
      const win = match[1].trim();
      if (win) {
        focusWins.push(win);
      }
    } else {
      freeformLines.push(line);
    }
  }

  return {
    freeformNotes: freeformLines.join('\n').trim(),
    focusWins,
  };
}

/** Recombines free-form notes and focus wins into a canonical stored notes string. */
export function serializeTaskNotes(freeformNotes: string, focusWins: string[]): string {
  const parts: string[] = [];
  const trimmedFreeform = freeformNotes.trim();
  if (trimmedFreeform) {
    parts.push(trimmedFreeform);
  }
  for (const win of focusWins) {
    const trimmedWin = win.trim();
    if (trimmedWin) {
      parts.push(`• Focus win: ${trimmedWin}`);
    }
  }
  return parts.join('\n');
}

/** Finds the next chronological practice task in the week after currentTaskId, or null if this is the last practice task. */
export function findNextTask(tasks: DailyTask[], currentTaskId: string): DailyTask | null {
  const currentIndex = tasks.findIndex((t) => t.id === currentTaskId);
  if (currentIndex === -1) return null;
  const subsequent = tasks.slice(currentIndex + 1);
  return subsequent.find((t) => !t.isRestDay) ?? null;
}

/** Finds the task scheduled for yesterday (1 calendar day before now in UTC). */
export function findYesterdayTask(tasks: DailyTask[], now: Date): DailyTask | null {
  const yesterday = new Date(now.getTime() - DAY_MS);
  const yesterdayKey = todayKey(yesterday);
  return tasks.find((t) => t.date === yesterdayKey) ?? null;
}

/**
 * Checks whether yesterday's scheduled practice task was left uncompleted (status === 'pending').
 * Rest days are not considered uncompleted practice.
 */
export function isYesterdayPending(tasks: DailyTask[], now: Date): boolean {
  const yesterday = findYesterdayTask(tasks, now);
  return Boolean(yesterday && !yesterday.isRestDay && yesterday.status === 'pending');
}

/**
 * Checks if all tasks in the current week have dates strictly before today's UTC date.
 * When true, all scheduled days have passed and the weekly review is due.
 */
export function isWeekReviewDue(tasks: DailyTask[], now: Date): boolean {
  if (tasks.length === 0) return false;
  const today = todayKey(now);
  return tasks.every((t) => t.date < today);
}

