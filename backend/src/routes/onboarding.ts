import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { generateThreeMonthSchedule } from '../lib/scheduler.js';
import { normalizeTimezone } from '../lib/timezone.js';

export const onboardingRouter = Router();
export const userGoalRouter = Router();

const VALID_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
type DayOfWeek = typeof VALID_DAYS[number];

interface AvailabilitySlotInput {
  day_of_week: DayOfWeek;
  start_time: string; // e.g. "09:00"
  end_time: string;   // e.g. "17:00"
  label?: string;
}

// POST /api/onboarding
onboardingRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Please sign in to continue onboarding.' });
      return;
    }

    const { goal_catalog_id, start_date, availability_slots, timezone } = req.body;

    if (timezone) {
      await prisma.user.update({
        where: { id: user.id },
        data: { timezone: normalizeTimezone(timezone) },
      });
    }

    if (!goal_catalog_id) {
      res.status(400).json({ error: 'goal_catalog_id is required.' });
      return;
    }

    // Verify goal exists in catalog
    const catalogGoal = await prisma.goalCatalog.findUnique({
      where: { id: goal_catalog_id },
      include: { phases: true },
    });

    if (!catalogGoal) {
      res.status(404).json({ error: 'Selected goal does not exist in the catalog.' });
      return;
    }

    // Parse and validate start date
    const parsedStartDate = start_date ? new Date(start_date) : new Date();
    if (isNaN(parsedStartDate.getTime())) {
      res.status(400).json({ error: 'Invalid start_date format.' });
      return;
    }
    parsedStartDate.setHours(0, 0, 0, 0);

    // Calculate target end date (12 weeks = 84 days)
    const targetEndDate = new Date(parsedStartDate.getTime() + 12 * 7 * 24 * 60 * 60 * 1000);

    // Validate availability slots
    const slots: AvailabilitySlotInput[] = Array.isArray(availability_slots) ? availability_slots : [];
    for (const slot of slots) {
      if (!VALID_DAYS.includes(slot.day_of_week)) {
        res.status(400).json({
          error: `Invalid day_of_week: "${slot.day_of_week}". Allowed values: ${VALID_DAYS.join(', ')}`,
        });
        return;
      }
      if (!slot.start_time || !slot.end_time) {
        res.status(400).json({ error: 'Each availability slot must have start_time and end_time.' });
        return;
      }
    }

    // Check if user already has an active goal with the same goal catalog ID
    const existingActiveGoal = await prisma.userGoal.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
    });

    const isRoutineAdjustment = Boolean(
      existingActiveGoal && existingActiveGoal.goal_catalog_id === catalogGoal.id
    );

    // Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // Clear old availability slots for user
      await tx.availabilitySlot.deleteMany({
        where: { user_id: user.id },
      });

      // Insert updated availability slots
      if (slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: slots.map((s) => ({
            user_id: user.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            label: s.label || null,
          })),
        });
      }

      const savedSlots = await tx.availabilitySlot.findMany({
        where: { user_id: user.id },
        orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
      });

      if (isRoutineAdjustment && existingActiveGoal) {
        // Routine Adjustment: keep existing goal and preserve progress
        // Only shift target_end_date if start_date changed before any completed sessions
        const doneSessionsCount = await tx.session.count({
          where: { user_goal_id: existingActiveGoal.id, status: 'DONE' },
        });

        let updatedStartDate = existingActiveGoal.start_date;
        let updatedTargetEndDate = existingActiveGoal.target_end_date;

        if (doneSessionsCount === 0 && start_date) {
          updatedStartDate = parsedStartDate;
          updatedTargetEndDate = targetEndDate;
        }

        const updatedGoal = await tx.userGoal.update({
          where: { id: existingActiveGoal.id },
          data: {
            start_date: updatedStartDate,
            target_end_date: updatedTargetEndDate,
          },
          include: {
            goal_catalog: {
              include: {
                phases: {
                  orderBy: { phase_order: 'asc' },
                  include: { task_templates: true },
                },
              },
            },
          },
        });

        return {
          user_goal: updatedGoal,
          availability_slots: savedSlots,
          is_adjustment: true,
        };
      }

      // Fresh Goal or Goal Switch: abandon previous goals and create new UserGoal
      await tx.userGoal.updateMany({
        where: { user_id: user.id, status: 'ACTIVE' },
        data: { status: 'ABANDONED' },
      });

      const newGoal = await tx.userGoal.create({
        data: {
          user_id: user.id,
          goal_catalog_id: catalogGoal.id,
          start_date: parsedStartDate,
          target_end_date: targetEndDate,
          status: 'ACTIVE',
          slippage_days: 0,
        },
        include: {
          goal_catalog: {
            include: {
              phases: {
                orderBy: { phase_order: 'asc' },
                include: { task_templates: true },
              },
            },
          },
        },
      });

      return {
        user_goal: newGoal,
        availability_slots: savedSlots,
        is_adjustment: false,
      };
    });

    // Automatically generate/re-align 12-week schedule upfront (§5)
    let sessionsGenerated = 0;
    try {
      sessionsGenerated = await generateThreeMonthSchedule(result.user_goal.id, {
        preserveCompleted: result.is_adjustment,
      });
    } catch (schedErr) {
      console.warn('Schedule generation/re-alignment warning:', schedErr);
    }

    res.status(result.is_adjustment ? 200 : 201).json({
      message: result.is_adjustment
        ? 'Routine updated successfully. Schedule re-aligned.'
        : 'Onboarding completed successfully. Goal locked in.',
      is_adjustment: result.is_adjustment,
      user_goal: result.user_goal,
      availability_slots: result.availability_slots,
      sessions_generated: sessionsGenerated,
    });
  } catch (error: any) {
    console.error('Onboarding submission error:', error);
    res.status(500).json({ error: 'Internal server error during onboarding.' });
  }
});

// GET /api/user-goal/current
userGoalRouter.get('/current', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.userGoal.findFirst({
      where: {
        user_id: user.id,
        status: 'ACTIVE',
      },
      orderBy: { start_date: 'desc' },
      include: {
        goal_catalog: {
          include: {
            phases: {
              orderBy: { phase_order: 'asc' },
              include: { task_templates: true },
            },
          },
        },
      },
    });

    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    res.status(200).json({
      user_goal: activeGoal,
      availability_slots: availabilitySlots,
    });
  } catch (error: any) {
    console.error('Fetch current user goal error:', error);
    res.status(500).json({ error: 'Failed to retrieve active user goal.' });
  }
});
