// Edit my schedule (B-108, docs/features/edit-schedule/plan.md): change the active goal's days, minutes and time of day.
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { TOTAL_WEEKS } from '../../lib/ai/roadmap.js';
import { activeDaysFor, validRestWeekdays, type PlanVariant } from '../../lib/ai/weekPlan.js';
import { DAILY_MINUTES_MAX, DAILY_MINUTES_MIN, PLAN_VARIANTS, PREFERRED_SLOTS, readRoutine, routineRecord, weekStartFor } from '../../lib/planV2.js';
import { weekCloseDue } from '../../lib/weekClose/close.js';
import { weekCloseEnabled } from '../../lib/weekClose/switch.js';
import { actionUser, refuse } from './actions.js';

export const scheduleRoutes = Router();

const VARIANTS = PLAN_VARIANTS;
const SLOTS = PREFERRED_SLOTS;

type Change = { planVariant?: PlanVariant; restWeekdays?: number[] | null; dailyMinutes?: number; preferredSlot?: (typeof SLOTS)[number] };

/**
 * The body's change, each field checked as onboarding checks it, or the 400 message. Every field is optional, but one
 * must be given. `restWeekdays: null` goes back to the variant's own rest days.
 */
export function readScheduleChange(body: unknown): { change: Change } | { error: string } {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const change: Change = {};
  if (raw.planVariant !== undefined) {
    if (!VARIANTS.includes(raw.planVariant as PlanVariant)) return { error: 'Choose how many days a week you can practise.' };
    change.planVariant = raw.planVariant as PlanVariant;
  }
  if (raw.dailyMinutes !== undefined) {
    const minutes = raw.dailyMinutes;
    if (typeof minutes !== 'number' || !Number.isInteger(minutes) || minutes < DAILY_MINUTES_MIN || minutes > DAILY_MINUTES_MAX) {
      return { error: 'Choose how many minutes a day you can practise.' };
    }
    change.dailyMinutes = minutes;
  }
  if (raw.preferredSlot !== undefined) {
    if (!SLOTS.includes(raw.preferredSlot as (typeof SLOTS)[number])) return { error: 'Choose a time of day: morning, afternoon or evening.' };
    change.preferredSlot = raw.preferredSlot as (typeof SLOTS)[number];
  }
  if (raw.restWeekdays !== undefined) {
    if (raw.restWeekdays !== null && !Array.isArray(raw.restWeekdays)) return { error: 'Choose your rest days again: as many as the days a week leave free.' };
    change.restWeekdays = raw.restWeekdays as number[] | null;
  }
  return Object.keys(change).length > 0 ? { change } : { error: 'Nothing to change.' };
}

/**
 * The routine after the change. The rest days: given ones must fit the (new) days a week; not given, the stored ones
 * stay while they still fit, otherwise the variant's own rest days apply. Every other stored field is kept as it is.
 */
export function nextRoutine(stored: Record<string, unknown>, now: ReturnType<typeof readRoutine>, change: Change): { routine: Record<string, unknown> } | { error: string } {
  const planVariant = change.planVariant ?? now.planVariant;
  let restWeekdays: number[] | null;
  if (change.restWeekdays === null) restWeekdays = null;
  else if (change.restWeekdays !== undefined) {
    restWeekdays = validRestWeekdays(planVariant, change.restWeekdays);
    if (!restWeekdays) return { error: 'Choose your rest days again: as many as the days a week leave free.' };
  } else restWeekdays = validRestWeekdays(planVariant, now.restWeekdays);
  const { restWeekdays: _old, ...rest } = stored;
  return {
    routine: {
      ...rest,
      planVariant,
      dailyMinutes: change.dailyMinutes ?? now.dailyMinutes,
      ...(change.preferredSlot ?? now.preferredSlot ? { preferredSlot: change.preferredSlot ?? now.preferredSlot } : {}),
      ...(restWeekdays ? { restWeekdays } : {}),
    },
  };
}

/**
 * PATCH /api/goal/schedule: `{ planVariant?, restWeekdays?, dailyMinutes?, preferredSlot? }`. Saved on the goal's
 * routine with the pending weeks' planned minutes, in one transaction; the next week written follows it (the open week
 * stays as written). Answers the routine and the week it starts in. Refused in week 12 (409 `last_week`).
 */
scheduleRoutes.patch('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    const read = readScheduleChange(req.body);
    if ('error' in read) {
      res.status(400).json({ error: read.error });
      return;
    }
    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      select: {
        id: true,
        planVersion: true,
        routine: true,
        currentWeek: true,
        startDate: true,
        roadmapWeeks: { select: { weekNumber: true, status: true } },
      },
    });
    if (!goal) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }
    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');
    if (goal.currentWeek >= TOTAL_WEEKS) return refuse(res, 'last_week');
    // Code review: once the open week is over, its close (which writes next week from the routine it read) may already
    // be running, and a gap may move the dates; the change waits until that close is saved.
    const weekTasks = await prisma.dailyTask.findMany({ where: { goalId: goal.id, weekNumber: goal.currentWeek }, select: { date: true } });
    if (weekCloseEnabled() && weekCloseDue(goal, weekTasks, new Date(), user.timezone)) return refuse(res, 'week_closing');

    const before = readRoutine(goal);
    const next = nextRoutine(routineRecord(goal), before, read.change);
    if ('error' in next) {
      res.status(400).json({ error: next.error });
      return;
    }
    const routine = JSON.stringify(next.routine);
    const after = readRoutine({ routine });
    await prisma.$transaction(async (tx) => {
      await tx.goal.update({ where: { id: goal.id }, data: { routine } });
      await tx.roadmapWeek.updateMany({
        where: { goalId: goal.id, status: 'pending' },
        data: { plannedMinutes: after.dailyMinutes * activeDaysFor(after.planVariant) },
      });
    });
    const startsWeek = goal.currentWeek + 1;
    const startsOn = weekStartFor(goal.startDate, startsWeek).toISOString().slice(0, 10);
    const shown = (r: ReturnType<typeof readRoutine>) =>
      `${r.planVariant} rest ${r.restWeekdays ? r.restWeekdays.join(',') : 'default'} ${r.dailyMinutes} min ${r.preferredSlot ?? 'default'}`;
    console.log(`[Schedule] goal ${goal.id} from week ${startsWeek}: ${shown(before)} -> ${shown(after)}`);
    res.json({ routine: after, startsWeek, startsOn });
  } catch (err) {
    console.error('[GoalRouter] Schedule error:', err);
    res.status(500).json({ error: "Couldn't save your schedule. Please try again." });
  }
});
