import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { flagOn } from '../lib/flags.js';
import { accessFor, TRIAL_ENDED, TRIAL_ENDED_MESSAGE } from '../lib/billing/access.js';
import { isLocked } from '../lib/billing/accessGuard.js';
import { byTokenOrIp, routeLimit } from '../lib/rateLimit.js';
import { getUserTodayDateString, getZonedDayBounds, normalizeTimezone } from '../lib/timezone.js';
import { coachContext, type CoachGoal } from '../lib/coach/context.js';
import { askCoach, type CoachTurn } from '../lib/coach/reply.js';
import { CRISIS_REPLY, isCrisisMessage } from '../lib/coach/crisis.js';
import { COACH_DAILY_MESSAGES, COACH_HISTORY_MESSAGES, COACH_MESSAGE_MAX, COACH_PAGE_MESSAGES } from '../lib/coach/limits.js';

/**
 * ND-40: Achivii Coach.
 * - `GET /api/coach`: whether Coach is on, whether the person can use it now, the conversation for the active plan and
 *   how many messages are left today.
 * - `POST /api/coach/messages` `{ text, firstName? }`: one message and the coach's reply, saved together; nothing is
 *   saved when the reply fails.
 * Off unless `COACH_ENABLED` is exactly `true` (Render only). The trial or Pro is needed, as for everything that moves
 * the plan on (ND-37); messages are counted per the person's own day.
 */
export const coachRouter = Router();

type CoachAccess = 'ok' | 'locked';

const presentMessage = (m: { id: string; role: string; content: string; created_at: Date }) => ({
  id: m.id,
  role: m.role === 'coach' ? 'coach' : 'user',
  content: m.content,
  createdAt: m.created_at.toISOString(),
});

async function sentToday(userId: string, timezone: string): Promise<number> {
  const { startOfDay, endOfDay } = getZonedDayBounds(getUserTodayDateString(timezone), timezone);
  return prisma.coachMessage.count({ where: { userId, role: 'user', created_at: { gte: startOfDay, lte: endOfDay } } });
}

const accessOf = async (user: { id: string; trialStartedAt?: Date | null }): Promise<CoachAccess> => ((await isLocked(user)) ? 'locked' : 'ok');

const activeGoalId = async (userId: string) =>
  (await prisma.goal.findFirst({ where: { userId, status: 'active' }, select: { id: true } }))?.id ?? null;

coachRouter.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (!flagOn('COACH_ENABLED')) {
      res.json({ enabled: false, hasGoal: false, access: 'ok', messages: [], remainingToday: 0, dailyLimit: COACH_DAILY_MESSAGES });
      return;
    }
    const timezone = normalizeTimezone(user.timezone);
    const [goalId, access, sent] = await Promise.all([activeGoalId(user.id), accessOf(user), sentToday(user.id, timezone)]);
    const messages = goalId
      ? await prisma.coachMessage.findMany({ where: { goalId, userId: user.id }, orderBy: { created_at: 'desc' }, take: COACH_PAGE_MESSAGES })
      : [];
    res.json({
      enabled: true,
      hasGoal: Boolean(goalId),
      access,
      messages: messages.reverse().map(presentMessage),
      remainingToday: Math.max(0, COACH_DAILY_MESSAGES - sent),
      dailyLimit: COACH_DAILY_MESSAGES,
    });
  } catch (err) {
    next(err);
  }
});

coachRouter.post(
  '/messages',
  routeLimit({ windowMs: 60_000, max: 8, keyOf: byTokenOrIp }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await getAuthUser(req);
      if (!user) {
        res.status(401).json({ error: 'Unauthorized.' });
        return;
      }
      if (!flagOn('COACH_ENABLED')) {
        res.status(409).json({ error: 'Coach is not available yet.', reason: 'coach_disabled' });
        return;
      }
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (!text) {
        res.status(400).json({ error: 'Write a message first.', reason: 'empty' });
        return;
      }
      if (text.length > COACH_MESSAGE_MAX) {
        res.status(400).json({ error: `Keep it under ${COACH_MESSAGE_MAX} characters.`, reason: 'too_long' });
        return;
      }
      const rawName = typeof req.body?.firstName === 'string' ? req.body.firstName.replace(/\s+/g, ' ').trim().slice(0, 40) : '';

      const goalId = await activeGoalId(user.id);
      if (!goalId) {
        res.status(409).json({ error: 'Coach needs a plan to talk about. Start one first.', reason: 'no_active_goal' });
        return;
      }
      const timezone = normalizeTimezone(user.timezone);
      const sent = await sentToday(user.id, timezone);

      let reply: string | null;
      if (isCrisisMessage(text)) {
        // Help comes first: before the trial and the daily limit, and without the model.
        console.log(`[Coach] user ${user.id} crisis reply`);
        reply = CRISIS_REPLY;
      } else {
        if ((await accessOf(user)) === 'locked') {
          res.status(402).json({ error: TRIAL_ENDED_MESSAGE, code: TRIAL_ENDED });
          return;
        }
        if (sent >= COACH_DAILY_MESSAGES) {
          res.status(429).json({ error: `That's ${COACH_DAILY_MESSAGES} messages today. Coach is back tomorrow.`, reason: 'coach_daily_limit' });
          return;
        }
        const goal = (await prisma.goal.findFirst({
          where: { id: goalId, userId: user.id },
          include: { roadmapWeeks: { orderBy: { weekNumber: 'asc' } }, dailyTasks: { orderBy: { dayNumber: 'asc' } } },
        })) as CoachGoal | null;
        if (!goal) {
          res.status(409).json({ error: 'Coach needs a plan to talk about. Start one first.', reason: 'no_active_goal' });
          return;
        }
        const history = (
          await prisma.coachMessage.findMany({ where: { goalId, userId: user.id }, orderBy: { created_at: 'desc' }, take: COACH_HISTORY_MESSAGES })
        )
          .reverse()
          .map((m): CoachTurn => ({ role: m.role === 'coach' ? 'coach' : 'user', content: m.content }));
        const startedAt = Date.now();
        reply = await askCoach(coachContext(goal, rawName || null, timezone), history, text);
        console.log(`[Coach] user ${user.id} goal ${goalId} ${reply ? 'replied' : 'failed'} ms ${Date.now() - startedAt}`);
      }
      if (!reply) {
        res.status(503).json({ error: "Coach couldn't answer just now. Please try again.", reason: 'coach_unavailable' });
        return;
      }

      // The question and its answer are saved together, the answer a moment after, so they always read in order.
      const now = new Date();
      const [mine, theirs] = await prisma.$transaction([
        prisma.coachMessage.create({ data: { userId: user.id, goalId, role: 'user', content: text, created_at: now } }),
        prisma.coachMessage.create({ data: { userId: user.id, goalId, role: 'coach', content: reply, created_at: new Date(now.getTime() + 1) } }),
      ]);
      res.json({ messages: [presentMessage(mine), presentMessage(theirs)], remainingToday: Math.max(0, COACH_DAILY_MESSAGES - sent - 1) });
    } catch (err) {
      next(err);
    }
  },
);
