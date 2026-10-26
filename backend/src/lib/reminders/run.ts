import { prisma } from '../prisma.js';
import { reminderFor, type ReminderCandidate } from './plan.js';
import { buildReminderEmail, sendEmail } from './email.js';

export interface ReminderRun {
  checked: number;
  sent: number;
  failed: number;
}

/**
 * ND-26: one pass over everyone with reminders on and an active goal. Each reminder is claimed first with a
 * conditional write of `lastReminderAt` (still the value loaded), so two overlapping runs never send twice; a failed
 * send puts the old value back, so the next run tries again.
 */
export async function runReminders(now: Date = new Date()): Promise<ReminderRun> {
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
          dailyTasks: {
            select: {
              date: true,
              status: true,
              isRestDay: true,
              notOffered: true,
              title: true,
              durationMinutes: true,
              completedAt: true,
              minimumVersion: true,
            },
          },
        },
      },
    },
  });

  const run: ReminderRun = { checked: users.length, sent: 0, failed: 0 };
  for (const user of users) {
    const candidate: ReminderCandidate = {
      userId: user.id,
      email: user.email,
      timezone: user.timezone,
      remindersEnabled: user.remindersEnabled,
      lastReminderAt: user.lastReminderAt,
      tasks: user.goals.flatMap((goal) => goal.dailyTasks),
    };
    const reminder = reminderFor(candidate, now);
    if (!reminder) continue;

    const { count } = await prisma.user.updateMany({
      where: { id: user.id, remindersEnabled: true, lastReminderAt: user.lastReminderAt },
      data: { lastReminderAt: now },
    });
    if (count !== 1) continue;

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
