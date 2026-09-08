import { PrismaClient, SessionTier } from '@prisma/client';
import { determineSessionTier } from '../src/lib/scheduler.js';

export async function backfillLegacySessions(prisma: PrismaClient) {
  console.log('🔄 Starting Phase 1 Session backfill...');

  const userGoals = await prisma.userGoal.findMany({
    include: {
      sessions: {
        include: {
          task_template: true,
        },
        orderBy: [
          { scheduled_date: 'asc' },
          { start_time: 'asc' },
        ],
      },
    },
  });

  console.log(`Found ${userGoals.length} user goals to process.`);

  let totalUpdated = 0;

  for (const goal of userGoals) {
    if (goal.current_plan_day_offset === null || goal.current_plan_day_offset === undefined) {
      await prisma.userGoal.update({
        where: { id: goal.id },
        data: { current_plan_day_offset: 0 },
      });
    }

    const startDate = new Date(goal.start_date);
    const sessions = goal.sessions;

    // Track sessions by (task_template_id, weekIndex) to assign appropriate tier
    const taskCountInWeek: Record<string, number> = {};

    for (let index = 0; index < sessions.length; index++) {
      const session = sessions[index];

      let dayNumber = session.day_number;
      if (dayNumber === null || dayNumber === undefined) {
        if (session.scheduled_date) {
          const diffMs = new Date(session.scheduled_date).getTime() - startDate.getTime();
          dayNumber = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
        } else {
          dayNumber = Math.floor(index / 3) * 2; // sensible fallback
        }
      }

      const sequenceOrder = index + 1;

      const weekIndex = Math.floor(dayNumber / 7);
      const taskKey = `${session.task_template_id}_w${weekIndex}`;
      const countSoFar = taskCountInWeek[taskKey] || 0;
      taskCountInWeek[taskKey] = countSoFar + 1;

      const totalForTask = session.task_template?.sessions_per_week || 3;
      const tier = determineSessionTier(countSoFar, totalForTask);

      await prisma.session.update({
        where: { id: session.id },
        data: {
          day_number: dayNumber,
          sequence_order: sequenceOrder,
          tier: tier,
        },
      });
      totalUpdated++;
    }
  }

  console.log(`✅ Successfully backfilled ${totalUpdated} sessions across ${userGoals.length} goals.`);
  return { goalsProcessed: userGoals.length, sessionsUpdated: totalUpdated };
}

// Standalone execution
if (process.argv[1]?.endsWith('backfill-phase1-sessions.ts')) {
  const prisma = new PrismaClient();
  backfillLegacySessions(prisma)
    .catch((err) => {
      console.error('❌ Backfill failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
