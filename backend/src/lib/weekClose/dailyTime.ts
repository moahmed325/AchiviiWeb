import type { RoadmapWeek } from '@prisma/client';
import { DEFAULT_WEEKS } from '../planLength.js';

/**
 * RULE-6 (WU-7, WU-20 (1)), without weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md): the daily-time
 * question, worked out from the stored weeks only. A hard week is a closed week (not jumped) with under half its
 * practice sessions done (`executionScore`, stored by the close).
 */

/** The daily-time options the schedule step offers (`DAILY_MINUTES` in the frontend's `StepSchedule.tsx`). */
export const DAILY_MINUTES_OPTIONS = [30, 45, 60, 90] as const;

/** A week under this share of its sessions done is a hard week. */
export const HARD_WEEK_PERCENT = 50;

export interface DailyTimeCheck {
  minutes: number;
  shorter: number[];
}

export type DailyTimeWeek = Pick<RoadmapWeek, 'weekNumber' | 'status' | 'executionScore' | 'dailyTimeAskedAt'> & { jumped?: boolean | null };

const openWeekOf = (weeks: readonly DailyTimeWeek[]) => weeks.find((week) => week.status === 'active');

/** A closed week, not jumped, with under half its sessions done. A week with no score (no day offered) is not hard. */
const isHard = (week: DailyTimeWeek | undefined): boolean =>
  Boolean(week && week.status === 'completed' && !week.jumped && typeof week.executionScore === 'number' && week.executionScore < HARD_WEEK_PERCENT);

/**
 * Asked once per run of hard weeks and only when a shorter option exists: when the two weeks before the open week were
 * both hard, the open week is not the plan's last (no week is written after it) and was not asked yet, and no earlier
 * week of the same run was followed by a week that was asked.
 */
export function dailyTimeCheckOf(weeks: readonly DailyTimeWeek[], dailyMinutes: number, totalWeeks: number = DEFAULT_WEEKS): DailyTimeCheck | null {
  const open = openWeekOf(weeks);
  if (!open || open.weekNumber >= totalWeeks || open.dailyTimeAskedAt) return null;
  const byNumber = (n: number) => weeks.find((week) => week.weekNumber === n);
  if (!isHard(byNumber(open.weekNumber - 1)) || !isHard(byNumber(open.weekNumber - 2))) return null;
  for (let n = open.weekNumber - 2; isHard(byNumber(n)); n -= 1) {
    if (byNumber(n + 1)?.dailyTimeAskedAt) return null;
  }
  const shorter = DAILY_MINUTES_OPTIONS.filter((option) => option < dailyMinutes);
  return shorter.length > 0 ? { minutes: dailyMinutes, shorter } : null;
}
