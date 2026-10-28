// B-102: the week routes (test result, review, close, close line, reflection, daily time, checkpoint), moved out of routes/goal.ts unchanged (a pure move).
import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getAuthUser } from '../auth.js';
import { getUserTodayDateString, normalizeTimezone } from '../../lib/timezone.js';
import { safeGoalTargets } from '../../lib/safety/storedTargets.js';
import { TOTAL_WEEKS } from '../../lib/ai/roadmap.js';
import { readRoutine, routineRecord } from '../../lib/planV2.js';
import { CheckpointAcceptedError, closeAnswer, logFixedDate, logJump, logWeekClose, planWeekMove, reviewInsight, saveWeekClose, weekCloseDue } from '../../lib/weekClose/close.js';
import { autoCloseUpdateInsight, logUpdateLowered, retestOfWeekFor, updateThenWrite } from '../../lib/weekClose/update.js';
import { weekCloseEnabled, weeklyUpdateEnabled } from '../../lib/weekClose/switch.js';
import { CHECKPOINT_WEEKS, acceptedWeeks, answerLogLine, pathwayOf, readCheckpoints } from '../../lib/weekClose/checkpoint.js';
import { checkpointsAtClose } from '../../lib/weekClose/checkpointClose.js';
import { RETEST_LOGGED_KEY, dailyTimeCheckOf } from '../../lib/weekClose/retest.js';
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

export interface WeeklyTestResultInput {
  value: string | number;
  passed: boolean;
  unit?: string;
  note?: string;
}

export function validateWeeklyTestResult(
  input: unknown
): { valid: true; result: WeeklyTestResultInput } | { valid: false; error: string } {
  if (input === null || input === undefined) {
    return { valid: false, error: 'testResult cannot be null or undefined when provided.' };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'testResult must be an object.' };
  }

  const record = input as Record<string, unknown>;

  // value: required, non-empty string | number
  if (record.value === undefined || record.value === null) {
    return { valid: false, error: 'testResult.value is required.' };
  }
  if (typeof record.value === 'string') {
    if (record.value.trim() === '') {
      return { valid: false, error: 'testResult.value must not be empty.' };
    }
  } else if (typeof record.value === 'number') {
    if (Number.isNaN(record.value)) {
      return { valid: false, error: 'testResult.value must be a valid number.' };
    }
  } else {
    return { valid: false, error: 'testResult.value must be a string or number.' };
  }

  // passed: required boolean
  if (typeof record.passed !== 'boolean') {
    return { valid: false, error: 'testResult.passed is required and must be a boolean.' };
  }

  // unit: optional string
  if (record.unit !== undefined && record.unit !== null && typeof record.unit !== 'string') {
    return { valid: false, error: 'testResult.unit must be a string when provided.' };
  }

  // note: optional string
  if (record.note !== undefined && record.note !== null && typeof record.note !== 'string') {
    return { valid: false, error: 'testResult.note must be a string when provided.' };
  }

  return {
    valid: true,
    result: {
      value: typeof record.value === 'string' ? record.value.trim() : record.value,
      passed: record.passed,
      ...(typeof record.unit === 'string' && record.unit.trim() !== '' ? { unit: record.unit.trim() } : {}),
      ...(typeof record.note === 'string' && record.note.trim() !== '' ? { note: record.note.trim() } : {}),
    },
  };
}

/**
 * PUT /api/goal/weeks/:weekNumber/test-result
 * Missed sessions M4.1 (ND-4, RULE-7): logs the week's test result without closing the week. Stores
 * `RoadmapWeek.testResult` and nothing else: no status change, no next week, no model call. The latest call wins.
 * The weekly review keeps this result when it is submitted without one.
 * Weekly update M3.3a (RULE-5, WU-17, WU-56 (2)): a closed week the open week re-tests (`retestOfWeek`) takes the
 * re-test's result as its late result; every other closed week is refused as before.
 */
weekRoutes.put('/weeks/:weekNumber/test-result', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;

    const weekNumber = weekNumberOr400(req, res);
    if (weekNumber === null) return;

    const validation = validateWeeklyTestResult(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      select: {
        planVersion: true,
        roadmapWeeks: { where: { OR: [{ weekNumber }, { status: 'active' }] }, select: { id: true, weekNumber: true, status: true, retestOfWeek: true } },
      },
    });
    const week = goal?.roadmapWeeks.find((w) => w.weekNumber === weekNumber);
    const retested = goal?.roadmapWeeks.some((w) => w.status === 'active' && w.retestOfWeek === weekNumber) === true;
    if (!goal || !week) {
      res.status(404).json({ error: 'Week not found.' });
      return;
    }
    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');
    if (week.status === 'completed' && !retested) return refuse(res, 'week_closed');
    // B-68: only the open week takes a result (a late test is logged while its week is still active).
    if (week.status !== 'active' && !retested) return refuse(res, 'week_not_open');

    // M3.3b (WU-58 (3)): a result stored through the re-test path names the open week it was logged in. The whole
    // result is replaced on every write, so a result stored any other way carries no key.
    const openWeek = goal.roadmapWeeks.find((w) => w.status === 'active');
    const stored =
      week.status !== 'active' && retested && openWeek ? { ...validation.result, [RETEST_LOGGED_KEY]: openWeek.weekNumber } : validation.result;
    await prisma.roadmapWeek.update({
      where: { id: week.id },
      data: { testResult: stored as unknown as Prisma.InputJsonObject },
    });
    // M3.3b review: the key is stored, never sent back.
    res.json({ testResult: validation.result });
  } catch (err: any) {
    console.error('[GoalRouter] Log test result error:', err);
    res.status(500).json({ error: 'Failed to save the test result.' });
  }
});

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
    const { reflection, testResult } = req.body;

    let sanitizedTestResult: WeeklyTestResultInput | null = null;
    if (testResult !== undefined && testResult !== null) {
      const validation = validateWeeklyTestResult(testResult);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      sanitizedTestResult = validation.result;
    }

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

    // B-3: an explicit null clears a result logged earlier (the review's "Clear benchmark entry"); a missing one keeps it.
    const clearTestResult = testResult === null && week.testResult !== null;
    // B-61: the week writer is told the result sent with this review, which is saved only after the call.
    const writerGoal =
      sanitizedTestResult || clearTestResult
        ? { ...goal, roadmapWeeks: goal.roadmapWeeks.map((w) => (w.weekNumber === weekNum ? { ...w, testResult: sanitizedTestResult as unknown as Prisma.JsonValue } : w)) }
        : goal;
    const now = new Date();
    // Weekly update M3.1 (RULE-1, WU-45 (1)): with both switches on and weeks 1 to 11 (M3.4: a break too, never before a
    // choice past the limit), the update runs first and the week after is written from its targets; otherwise null and
    // the review is exactly as before.
    const { update, next } = await updateThenWrite(writerGoal, weekNum, {
      userId: user.id,
      reflection: typeof reflection === 'string' ? reflection : '',
      now,
      timezone: user.timezone,
    });
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
      testResult: sanitizedTestResult as unknown as Prisma.InputJsonObject | null,
      clearTestResult,
      // M1.4 (section 6): a late review that moves the plan keeps its own insight and answer. M3.1 (RULE-7): after an
      // update, its sentence (or the neutral line on the fallback).
      insight: update ? update.insight : reviewInsight(goal.dailyTasks),
      move: next.move,
      now,
      update,
      retestOfWeek: retestOfWeekFor(update, next.written),
      // Checkpoints (RULE-2): after the update decided the targets, from the result this close stores.
      checkpoints: checkpointsAtClose(goal, weekNum, { testResult: clearTestResult ? null : (sanitizedTestResult ?? week.testResult), move: next.move, update }),
    });
    // Another close won inside the save (WU-27): nothing of this request was saved.
    if (!saved) return refuse(res, 'week_closed');
    logWeekClose(goal, weekNum, 'review', now, user.timezone, startedAt);
    logFixedDate(goal, weekNum, next.move);
    logUpdateLowered(goal.id, update);
    // B-61: the answer shows the result the week writer was told: the one sent, else the stored (late) one, which the save keeps.
    res.json(closeAnswer(goal, weekNum, saved, clearTestResult ? null : (sanitizedTestResult ?? week.testResult ?? null)));
  } catch (err: any) {
    // Checkpoints (RULE-9 review): the open offer was accepted during this review's close; nothing was saved.
    if (err instanceof CheckpointAcceptedError) {
      console.log(err.message);
      res.status(503).json({ error: "Couldn't write next week right now. This week is unchanged; please try again." });
      return;
    }
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
      // M1.5b: `break` (WU-39: no test card after a break) and `choice` (WU-38: the card past the limit, else null).
      const move = planWeekMove(found, weekNum, now, user.timezone, weekTasks);
      res.json({
        due: true,
        weekNumber: weekNum,
        testLogged: week.testResult !== null && week.testResult !== undefined,
        break: move !== null && move.breakDays !== null,
        choice: move?.choiceNeeded ?? null,
      });
      return;
    }

    const startedAt = Date.now();
    const lastWeek = weekNum >= TOTAL_WEEKS;
    const choice = isChoice(req.body?.choice) ? req.body.choice : null;
    // M3.3a (RULE-1, RULE-18, WU-52): the same update as the review, with no reflection; none for week 12, before a
    // choice past the limit or with either switch off, and then the close is exactly as before. M3.4: a break runs it.
    const { update, next } = await updateThenWrite(goal, weekNum, { userId: user.id, reflection: '', now, timezone: user.timezone, choice });
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
      // RULE-11: week 12 closes with no review row. M1.4 (section 6): a close that moved the plan says so. M3.3a
      // (WU-56 (4)): with an update, its sentence, after the move line when the plan moved.
      ...(lastWeek ? {} : { insight: autoCloseUpdateInsight(next.move, update) }),
      move: next.move,
      now,
      update,
      retestOfWeek: retestOfWeekFor(update, next.written),
      // Checkpoints (RULE-2): as the review, from the result logged this week.
      checkpoints: checkpointsAtClose(goal, weekNum, { testResult: week.testResult, move: next.move, update }),
    });
    // Lost the race (WU-27): another close saved this week; nothing of this request was saved.
    if (!saved) {
      res.json({ due: false, alreadyClosed: true, weekNumber: weekNum });
      return;
    }
    logWeekClose(goal, weekNum, 'auto', now, user.timezone, startedAt);
    logJump(goal, weekNum, next.move);
    logFixedDate(goal, weekNum, next.move);
    logUpdateLowered(goal.id, update);
    res.json({ due: true, closedBy: 'auto', ...closeAnswer(goal, weekNum, saved, week.testResult ?? null, next.move) });
  } catch (err: any) {
    // Checkpoints (RULE-9 review): the open offer was accepted during this close; nothing was saved.
    if (err instanceof CheckpointAcceptedError) {
      console.log(err.message);
      res.status(503).json({ error: "Couldn't get your next week ready. Please try again." });
      return;
    }
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
 * POST /api/goal/daily-time (weekly update M3.3b, RULE-6, WU-7, WU-20 (1), WU-58 (4), behind both switches)
 * The answer to the daily-time question after two hard weeks: `{ minutes }`, the current daily time (keep) or one of
 * the shorter options. Sets the open week's `dailyTimeAskedAt` and, when shorter, `routine.dailyMinutes`, in one
 * transaction. A shorter time is read when the next week is written; the current week's tasks don't change.
 */
weekRoutes.post('/daily-time', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    // RULE-18: off means nothing is read or written.
    if (!weeklyUpdateEnabled()) return refuse(res, 'weekly_update_disabled');

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      select: {
        id: true,
        planVersion: true,
        routine: true,
        roadmapWeeks: {
          orderBy: { weekNumber: 'asc' },
          select: {
            id: true,
            weekNumber: true,
            status: true,
            retestOfWeek: true,
            updateStatus: true,
            testResult: true,
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

    const check = dailyTimeCheckOf(goal.roadmapWeeks, readRoutine(goal).dailyMinutes);
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

/**
 * POST /api/goal/checkpoint (checkpoints RULE-8, RULE-9, section 7, behind both switches)
 * The answer to the open checkpoint offer: `{ week, answer }`, `keep` or `accept`. Keep stores the answer and changes
 * nothing. Accept sets week 12 to the offered target and spreads the weeks between (`acceptedWeeks`); the answer and the
 * targets are saved in one transaction. The first answer wins: the transaction first holds the open week's row (as a
 * close of that week does, which expires the offer), then reads the offer again.
 */
weekRoutes.post('/checkpoint', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    // RULE-1: off means nothing is read or written.
    if (!weeklyUpdateEnabled()) return refuse(res, 'weekly_update_disabled');
    const week = req.body?.week;
    const answer = req.body?.answer;
    if (!CHECKPOINT_WEEKS.includes(week) || (answer !== 'keep' && answer !== 'accept')) {
      res.status(400).json({ error: 'week must be 4 or 8 and answer keep or accept.' });
      return;
    }

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      select: { id: true, planVersion: true, roadmapWeeks: { where: { status: 'active' }, select: { weekNumber: true } }, roadmap: true },
    });
    if (!goal) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }
    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');
    const openWeek = goal.roadmapWeeks[0]?.weekNumber;
    const offerOf = (roadmap: unknown) => readCheckpoints(roadmap).find((item) => item.week === week && (item.answer === null || item.answer === undefined));
    const offer = offerOf(goal.roadmap);
    if (openWeek === undefined || !offer || (answer === 'accept' && (offer.kind === 'line_only' || offer.offered === null))) return refuse(res, 'no_checkpoint');

    const answeredAt = new Date();
    const saved = await prisma.$transaction(async (tx) => {
      // Holds the open week's row until this commits; a close of that week, or a second answer, waits and then sees it.
      const held = await tx.roadmapWeek.updateMany({ where: { goalId: goal.id, weekNumber: openWeek, status: 'active' }, data: { status: 'active' } });
      if (held.count === 0) return false;
      const row = await tx.goal.findFirst({ where: { id: goal.id }, include: { roadmapWeeks: { orderBy: { weekNumber: 'asc' } } } });
      if (!row || !offerOf(row.roadmap)) return false;
      const roadmap = { ...((row.roadmap ?? {}) as Record<string, unknown>) };
      roadmap.checkpoints = readCheckpoints(row.roadmap).map((item) =>
        item.week === week && (item.answer === null || item.answer === undefined) ? { ...item, answer, by: 'person', answeredAt: answeredAt.toISOString() } : item
      );
      if (answer === 'accept') {
        // RULE-9: the weeks as the app reads them (an older goal's targets lowered on read), spread from the open week.
        const rows = safeGoalTargets(row)?.weeks ?? row.roadmapWeeks;
        const kind = offer.kind === 'raise' ? 'raise' : 'lower';
        const spread = acceptedWeeks(rows, openWeek, offer.offered as number, kind, pathwayOf(row));
        if (!spread) return false;
        for (const changed of spread.weeks) {
          await tx.roadmapWeek.update({
            where: { goalId_weekNumber: { goalId: goal.id, weekNumber: changed.weekNumber } },
            data: {
              target: changed.target as unknown as Prisma.InputJsonObject,
              objective: changed.objective,
              keyMilestone: changed.keyMilestone,
              test: changed.test as Prisma.InputJsonObject,
            },
          });
        }
        if (spread.finalTest !== null) roadmap.finalTest = spread.finalTest;
      }
      await tx.goal.update({ where: { id: goal.id }, data: { roadmap: roadmap as unknown as Prisma.InputJsonObject } });
      return true;
    });
    if (!saved) return refuse(res, 'no_checkpoint');
    console.log(answerLogLine(goal.id, { week, answer, by: 'person' }));
    res.json({ week, answer, by: 'person', answeredAt });
  } catch (err: any) {
    console.error('[GoalRouter] Checkpoint answer error:', err);
    res.status(500).json({ error: "Couldn't save your choice." });
  }
});
