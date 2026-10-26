import { prisma } from '../prisma.js';
import { addDays } from '../missedSessions.js';
import { reminderFor, type ReminderCandidate } from './plan.js';
import { buildReminderEmail, sendEmail } from './email.js';

export interface ReminderRun {
  checked: number;
  sent: number;
  failed: number;
}

/** Resend allows 2 requests a second by default; one every 600 ms stays under it. */
export const SEND_SPACING_MS = 600;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ND-26: one pass over everyone with reminders on and an active goal. Only the days around today are loaded (every
 * zone's yesterday and today fall within two days of UTC's today); the last completion is loaded only for someone who
 * had a reminder before and would get one now. Each reminder is claimed first with a conditional write of
 * `lastReminderAt` (still the value loaded), so overlapping runs never send twice; a failed send puts the old value
 * back, so the next run tries again (the email's idempotency key stops a double delivery when only the answer was lost).
 */
export async function runReminders(now: Date = new Date(), spacingMs = SEND_SPACING_MS): Promise<ReminderRun> {
  const utcToday = now.toISOString().slice(0, 10);
  const users = await prisma.user.findMany({
    where: { remindersEnabled: true, goals: { some: { status: 'active' } } },
    select: {
      id: true,
      email: true,
      timezone: true,
      remindersEnabled: true,
      lastReminderAt: true,
      goals: {
        where: { status: 'active' },
        select: {
          id: true,
          dailyTasks: {
            where: { date: { gte: addDays(utcToday, -2), lte: addDays(utcToday, 1) } },
            select: { date: true, status: true, isRestDay: true, notOffered: true, minimumVersion: true },
          },
        },
      },
    },
  });

  const run: ReminderRun = { checked: users.length, sent: 0, failed: 0 };
  let sentBefore = false;
  for (const user of users) {
    const candidate: ReminderCandidate = {
      userId: user.id,
      email: user.email,
      timezone: user.timezone,
      remindersEnabled: user.remindersEnabled,
      lastReminderAt: user.lastReminderAt,
      lastCompletedAt: null,
      tasks: user.goals.flatMap((goal) => goal.dailyTasks),
    };
    if (!reminderFor(candidate, now, true)) continue;
    if (user.lastReminderAt) {
      const latest = await prisma.dailyTask.findFirst({
        where: { goalId: { in: user.goals.map((goal) => goal.id) }, status: 'completed', completedAt: { not: null } },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      candidate.lastCompletedAt = latest?.completedAt ?? null;
    }
    const reminder = reminderFor(candidate, now);
    if (!reminder) continue;

    const { count } = await prisma.user.updateMany({
      where: { id: user.id, remindersEnabled: true, lastReminderAt: user.lastReminderAt },
      data: { lastReminderAt: now },
    });
    if (count !== 1) continue;

    if (sentBefore && spacingMs > 0) await wait(spacingMs);
    sentBefore = true;
    try {
      await sendEmail(buildReminderEmail(reminder));
      run.sent += 1;
    } catch (err) {
      run.failed += 1;
      console.error(`[Reminders] user ${user.id} send failed:`, err instanceof Error ? err.message : err);
      await prisma.user.updateMany({ where: { id: user.id, lastReminderAt: now }, data: { lastReminderAt: user.lastReminderAt } });
    }
  }
  console.log(`[Reminders] checked ${run.checked} sent ${run.sent} failed ${run.failed}`);
  return run;
}
