/**
 * I-30: does missed-session recovery work? Reads every plan v2 goal and prints `recoveryReport` (moved steps against
 * ordinary days, coming back after a miss, the first week back after a break, still practising at weeks 2, 4, 8 and
 * 12), split into pathway and custom goals. Read only: it runs `findMany` and nothing else. Not run in CI.
 * Needs DATABASE_URL in backend/.env (production: the Supabase session pooler string).
 *
 *   npm run report:recovery [-- --json]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  console.error('No DATABASE_URL in backend/.env: nothing read.');
  process.exit(1);
}

const { prisma } = await import('../src/lib/prisma.js');
const { formatRecoveryReport, recoveryReport } = await import('../src/lib/insights/recoveryReport.js');

try {
  const goals = await prisma.goal.findMany({
    where: { planVersion: 2 },
    select: {
      id: true,
      isGoldenRail: true,
      status: true,
      startDate: true,
      totalWeeks: true,
      routine: true,
      user: { select: { timezone: true } },
      dailyTasks: {
        select: {
          id: true,
          date: true,
          weekNumber: true,
          dayNumber: true,
          status: true,
          isRestDay: true,
          isKeySession: true,
          isTestDay: true,
          notOffered: true,
          usedMinimumVersion: true,
          detailedSteps: true,
        },
      },
      roadmapWeeks: { select: { weekNumber: true, breakDays: true, jumped: true } },
    },
  });
  const report = recoveryReport(goals, new Date());
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatRecoveryReport(report));
} finally {
  await prisma.$disconnect();
}
