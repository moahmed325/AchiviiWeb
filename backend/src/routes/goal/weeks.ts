// B-102: the week routes (review, close, close line, reflection, daily time), moved out of routes/goal.ts.
// No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md): the test-result and checkpoint routes are gone,
// and the next week is written from what the person did (`writeWeekAfter`), with no weekly update.
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { getAuthUser } from '../auth.js';
import { getUserTodayDateString, normalizeTimezone } from '../../lib/timezone.js';
import { TOTAL_WEEKS } from '../../lib/ai/roadmap.js';
import { readRoutine, routineRecord } from '../../lib/planV2.js';
import {
  autoCloseInsight,
  closeAnswer,
  logFixedDate,
  logJump,
  logWeekClose,
  planWeekMove,
  reviewInsight,
  saveWeekClose,
  weekCloseDue,
  writeWeekAfter,
} from '../../lib/weekClose/close.js';
import { weekCloseEnabled } from '../../lib/weekClose/switch.js';
import { shapeOf } from '../../lib/planLength.js';
import { dailyTimeCheckOf } from '../../lib/weekClose/dailyTime.js';
import { refuse, refuseChoice, isChoice, actionUser } from './actions.js';

export const weekRoutes = Router();

/** B-67: a week number from the path, a whole number from 1 to 12 written as digits; null for anything else. */
export function parseWeekNumber(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d{1,2}$/.test(raw)) return null;
  const week = Number(raw);
  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

/** B-67: answers 400 and returns null for a bad week number, before any goal is read. */
export function weekNumberOr400(req: Request, res: Response): number | null {
  const week = parseWeekNumber(req.params.weekNumber);
  if (week === null) res.status(400).json({ error: `Week number must be 1 to ${TOTAL_WEEKS}.` });
  return week;
}

/**
 * POST /api/goal/weeks/:weekNumber/review
 * Submits weekly review, computes adherence score against 85% target,
 * persists optional benchmark test results (OD-1a Option A),
 * and writes the next week's tasks. A goal that is not plan v2 is refused (ND-21).
 */
weekRoutes.post('/weeks/:weekNumber/review', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const weekNum = weekNumberOr400(req, res);
    if (weekNum === null) return;
    const reflection = typeof req.body?.reflection === 'string' ? req.body.reflection : '';

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      include: {
        roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
        dailyTasks: { where: { weekNumber: weekNum } }
      }
    });

    if (!goal) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }

    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');

    // B-59, WU-27 (every switch state): only the open week can be reviewed, and before any model call.
    const week = goal.roadmapWeeks.find((w) => w.weekNumber === weekNum);
    if (weekNum !== goal.currentWeek || week?.status !== 'active') return refuse(res, 'week_closed');
    // The review opens on the week's last day in the person's time zone, so a week cannot be crammed and closed early.
    const lastDay = goal.dailyTasks.reduce((last, t) => (t.date > last ? t.date : last), '');
    if (lastDay > getUserTodayDateString(normalizeTimezone(user.timezone))) return refuse(res, 'week_not_over');

    const startedAt = Date.now();
    const now = new Date();
    // The next week is written from this one: what they did, how it felt, their notes and this reflection.
    const next = await writeWeekAfter({ ...goal, dailyTasks: goal.dailyTasks }, weekNum, { now, timezone: user.timezone, reflection });
    // M1.5b (WU-38 (1)): a break past the limit is answered on Today's card, never by the review; nothing was called.
    if (next?.choiceNeeded) return refuseChoice(res, next.choiceNeeded);
    if (!next) {
      res.status(503).json({ error: "Couldn't write next week right now. This week is unchanged; please try again." });
      return;
    }

    const saved = await saveWeekClose({
      goal,
      weekNumber: weekNum,
      by: 'review',
      written: next.written,
      reflection,
      // M1.4 (section 6): a late review that moves the plan keeps its own insight and answer.
      insight: reviewInsight(goal.dailyTasks),
      move: next.move,
      now,
    });
    // Another close won inside the save (WU-27): nothing of this request was saved.
    if (!saved) return refuse(res, 'week_closed');
    logWeekClose(goal, weekNum, 'review', now, user.timezone, startedAt);
    logFixedDate(goal, weekNum, next.move);
    res.json(closeAnswer(goal, weekNum, saved, next.move));
  } catch (err: any) {
    console.error('[GoalRouter] Weekly review error:', err);
    res.status(500).json({ error: 'Failed to process weekly review.' });
  }
});

/**
 * POST /api/goal/close-week (weekly update M1.2a, RULE-8, RULE-9, behind WEEK_CLOSE_ENABLED)
 * Closes the open week once its last day has closed, exactly as the review would but with no reflection. Safe to
 * repeat: who closes the week is decided inside the save (WU-27). `{ mode: 'check' }` only says whether a close is due.
 */
weekRoutes.post('/close-week', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    // RULE-18: off means nothing closes a week automatically; nothing is read or written.
    if (!weekCloseEnabled()) {
      res.json({ due: false });
      return;
    }

    const found = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { roadmapWeeks: { orderBy: { weekNumber: 'asc' } } },
    });
    if (!found) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }
    if (found.planVersion !== 2) return refuse(res, 'not_plan_v2');

    const weekNum = found.currentWeek;
    const week = found.roadmapWeeks.find((w) => w.weekNumber === weekNum);
    if (week?.status !== 'active') {
      res.json({ due: false });
      return;
    }
    const weekTasks = await prisma.dailyTask.findMany({ where: { goalId: found.id, weekNumber: weekNum }, orderBy: { dayNumber: 'asc' } });
    const now = new Date();
    if (!weekCloseDue(found, weekTasks, now, user.timezone)) {
      res.json({ due: false });
      return;
    }
    const goal = { ...found, dailyTasks: weekTasks };

    // RULE-9: the first open that tried to close this week, kept across failed tries and racing requests.
    if (found.closeTriedWeek !== weekNum || !found.closeTriedAt) {
      await prisma.goal.updateMany({
        where: { id: goal.id, OR: [{ closeTriedWeek: null }, { closeTriedWeek: { not: weekNum } }, { closeTriedAt: null }] },
        data: { closeTriedAt: now, closeTriedWeek: weekNum },
      });
    }

    if (req.body?.mode === 'check') {
      // M1.5b: `break` and `choice` (WU-38: the card past the limit, else null).
      const move = planWeekMove(found, weekNum, now, user.timezone, weekTasks);
      res.json({
        due: true,
        weekNumber: weekNum,
        break: move !== null && move.breakDays !== null,
        choice: move?.choiceNeeded ?? null,
      });
      return;
    }

    const startedAt = Date.now();
    const lastWeek = weekNum >= shapeOf(found).weeks;
    const choice = isChoice(req.body?.choice) ? req.body.choice : null;
    // The same next week as the review would write, with no reflection.
    const next = await writeWeekAfter(goal, weekNum, { now, timezone: user.timezone, choice });
    // M1.5b (WU-38): past the limit, a close without the person's choice saves nothing and calls no model.
    if (next?.choiceNeeded) return refuseChoice(res, next.choiceNeeded);
    if (!next) {
      res.status(503).json({ error: "Couldn't get your next week ready. Please try again." });
      return;
    }
    const saved = await saveWeekClose({
      goal,
      weekNumber: weekNum,
      by: 'auto',
      written: next.written,
      // RULE-11: the last week closes with no review row. M1.4 (section 6): a close that moved the plan says so.
      ...(lastWeek ? {} : { insight: autoCloseInsight(next.move) }),
      move: next.move,
      now,
    });
    // Lost the race (WU-27): another close saved this week; nothing of this request was saved.
    if (!saved) {
      res.json({ due: false, alreadyClosed: true, weekNumber: weekNum });
      return;
    }
    logWeekClose(goal, weekNum, 'auto', now, user.timezone, startedAt);
    logJump(goal, weekNum, next.move);
    logFixedDate(goal, weekNum, next.move);
    res.json({ due: true, closedBy: 'auto', ...closeAnswer(goal, weekNum, saved, next.move) });
  } catch (err: any) {
    console.error('[GoalRouter] Week close error:', err);
    res.status(500).json({ error: 'Failed to close the week.' });
  }
});

/** The active goal's week `weekNumber`, for the two endpoints below. Null when answered (401, 409, 404). */
export async function closedWeekOf(req: Request, res: Response, weekNumber: number) {
  const user = await actionUser(req, res);
  if (!user) return null;
  // RULE-18: off means nothing is read or written.
  if (!weekCloseEnabled()) {
    refuse(res, 'week_close_disabled');
    return null;
  }
  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, status: 'active' },
    select: { id: true, planVersion: true, roadmapWeeks: { where: { weekNumber } } },
  });
  const week = goal?.roadmapWeeks[0];
  if (!goal || !week) {
    res.status(404).json({ error: 'Week not found.' });
    return null;
  }
  if (goal.planVersion !== 2) {
    refuse(res, 'not_plan_v2');
    return null;
  }
  return { goal, week };
}

/**
 * POST /api/goal/weeks/:weekNumber/close-line-seen (weekly update M1.2b, WU-28, behind WEEK_CLOSE_ENABLED)
 * Records that the automatic close's line was shown, so no device shows it again. Only a week closed automatically;
 * safe to repeat (the first time is kept).
 */
weekRoutes.post('/weeks/:weekNumber/close-line-seen', async (req: Request, res: Response): Promise<void> => {
  try {
    const weekNumber = weekNumberOr400(req, res);
    if (weekNumber === null) return;
    const found = await closedWeekOf(req, res, weekNumber);
    if (!found) return;
    const { week } = found;
    if (week.closedBy !== 'auto') return refuse(res, 'not_auto_closed');

    const seenAt = new Date();
    await prisma.roadmapWeek.updateMany({ where: { id: week.id, closedBy: 'auto', closeLineSeenAt: null }, data: { closeLineSeenAt: seenAt } });
    res.json({ closeLineSeenAt: week.closeLineSeenAt ?? seenAt });
  } catch (err: any) {
    console.error('[GoalRouter] Close line seen error:', err);
    res.status(500).json({ error: 'Failed to save.' });
  }
});

/**
 * POST /api/goal/weeks/:weekNumber/reflection (weekly update M1.2b, WU-31, behind WEEK_CLOSE_ENABLED)
 * A review that lost to an automatic close keeps its typed reflection: saved onto the week (and its review row) only
 * when the week closed automatically with no reflection yet. Safe to repeat with the same text.
 */
weekRoutes.post('/weeks/:weekNumber/reflection', async (req: Request, res: Response): Promise<void> => {
  try {
    const weekNumber = weekNumberOr400(req, res);
    if (weekNumber === null) return;
    const reflection = typeof req.body?.reflection === 'string' ? req.body.reflection : '';
    if (!reflection.trim()) {
      res.status(400).json({ error: 'A reflection is required.' });
      return;
    }
    const found = await closedWeekOf(req, res, weekNumber);
    if (!found) return;
    const { goal, week } = found;
    if (week.closedBy !== 'auto') return refuse(res, 'not_auto_closed');
    if (week.reviewNotes === reflection) {
      res.json({ reflection });
      return;
    }

    const empty = [{ reviewNotes: null }, { reviewNotes: '' }];
    const saved = await prisma.$transaction(async (tx) => {
      const won = await tx.roadmapWeek.updateMany({ where: { id: week.id, closedBy: 'auto', OR: empty }, data: { reviewNotes: reflection } });
      if (won.count === 0) return false;
      await tx.weeklyReview.updateMany({
        where: { goalId: goal.id, weekNumber, OR: [{ reflection: null }, { reflection: '' }] },
        data: { reflection },
      });
      return true;
    });
    if (!saved) return refuse(res, 'reflection_saved');
    res.json({ reflection });
  } catch (err: any) {
    console.error('[GoalRouter] Late reflection error:', err);
    res.status(500).json({ error: 'Failed to save the reflection.' });
  }
});

/**
 * POST /api/goal/daily-time (weekly update M3.3b, RULE-6, WU-7, WU-20 (1), WU-58 (4), behind WEEK_CLOSE_ENABLED)
 * The answer to the daily-time question after two hard weeks (each under half its sessions done, `dailyTime.ts`): `{ minutes }`, the current daily time (keep) or one of
 * the shorter options. Sets the open week's `dailyTimeAskedAt` and, when shorter, `routine.dailyMinutes`, in one
 * transaction. A shorter time is read when the next week is written; the current week's tasks don't change.
 */
weekRoutes.post('/daily-time', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    // RULE-18: off means nothing is read or written.
    if (!weekCloseEnabled()) return refuse(res, 'week_close_disabled');

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      select: {
        id: true,
        planVersion: true,
        routine: true,
        totalWeeks: true,
        roadmapWeeks: {
          orderBy: { weekNumber: 'asc' },
          select: {
            id: true,
            weekNumber: true,
            status: true,
            executionScore: true,
            dailyTimeAskedAt: true,
            jumped: true,
          },
        },
      },
    });
    if (!goal) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }
    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');

    const check = dailyTimeCheckOf(goal.roadmapWeeks, readRoutine(goal).dailyMinutes, shapeOf(goal).weeks);
    const openWeek = goal.roadmapWeeks.find((w) => w.status === 'active');
    if (!check || !openWeek) return refuse(res, 'no_daily_time_check');
    const minutes = req.body?.minutes;
    if (minutes !== check.minutes && !check.shorter.includes(minutes)) {
      res.status(400).json({ error: `minutes must be ${[...check.shorter, check.minutes].join(', ')}.` });
      return;
    }

    const askedAt = new Date();
    const shorter = minutes !== check.minutes;
    const routine = routineRecord(goal);
    const saved = await prisma.$transaction(async (tx) => {
      // Asked once (WU-20 (1)): a second answer racing this one saves nothing.
      const won = await tx.roadmapWeek.updateMany({ where: { id: openWeek.id, dailyTimeAskedAt: null }, data: { dailyTimeAskedAt: askedAt } });
      if (won.count === 0) return false;
      if (shorter) await tx.goal.update({ where: { id: goal.id }, data: { routine: JSON.stringify({ ...routine, dailyMinutes: minutes }) } });
      return true;
    });
    if (!saved) return refuse(res, 'no_daily_time_check');
    res.json({ dailyMinutes: minutes, dailyTimeAskedAt: askedAt });
  } catch (err: any) {
    console.error('[GoalRouter] Daily time error:', err);
    res.status(500).json({ error: 'Failed to save the daily time.' });
  }
});
