import { prisma } from './prisma.js';
import { aggregateUserProfile } from './profile.js';

export interface GraduationState {
  eligible: boolean;
  user_goal_id: string;
  goal_title: string;
  status: string;
  elapsed_days: number;
  remaining_plan_days: number;
  total_plan_days: number;
  completed_sessions: number;
  total_sessions: number;
  completion_rate: number;
  options: ('start_new_goal' | 'maintenance_mode' | 'pause')[];
  graduation_message?: string;
}

export type GraduationChoice = 'start_new_goal' | 'maintenance_mode' | 'pause';

/**
 * Evaluates whether an active goal has reached the graduation window.
 * Guardrail 1: Relative to remaining plan length (not hardcoded calendar dates).
 * Trigger when remaining plan days <= 15 (or elapsed days >= 75 for active goals).
 * Only evaluates for ACTIVE goals; recomputed lazily upon resume from pause.
 */
export async function evaluateGraduationEligibility(
  userGoalId: string,
  overrideNow?: Date
): Promise<GraduationState> {
  const goal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      goal_catalog: true,
      sessions: true,
    },
  });

  if (!goal) {
    throw new Error(`UserGoal ${userGoalId} not found.`);
  }

  const completedSessions = goal.sessions.filter((s) => s.status === 'DONE').length;
  const totalSessions = goal.sessions.length;
  const completionRate = totalSessions > 0 ? completedSessions / totalSessions : 0;

  // Non-active goals are not eligible for active graduation prompts
  if (goal.status !== 'ACTIVE') {
    return {
      eligible: false,
      user_goal_id: goal.id,
      goal_title: goal.goal_catalog.title,
      status: goal.status,
      elapsed_days: 0,
      remaining_plan_days: 0,
      total_plan_days: 84,
      completed_sessions: completedSessions,
      total_sessions: totalSessions,
      completion_rate: completionRate,
      options: [],
    };
  }

  const now = overrideNow || new Date();
  const startDate = new Date(goal.start_date);

  // Calculate elapsed calendar days
  const elapsedDays = Math.max(
    0,
    Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Standard 12-week blueprint is 84 days.
  // Effective total plan days accounts for slippage and timeline offsets
  const totalPlanDays = 84 + (goal.slippage_days || 0) + (goal.current_plan_day_offset || 0);
  const remainingPlanDays = Math.max(0, totalPlanDays - elapsedDays);

  // Guardrail 1 trigger condition: remaining plan days <= 15 OR elapsed days >= 75
  const eligible = remainingPlanDays <= 15 || elapsedDays >= 75;

  let graduationMessage: string | undefined;
  if (eligible) {
    if (remainingPlanDays <= 0) {
      graduationMessage = `Congratulations! You have completed the 12-week journey for "${goal.goal_catalog.title}". How would you like to build on this momentum?`;
    } else {
      graduationMessage = `You are in the home stretch for "${goal.goal_catalog.title}" with only ${remainingPlanDays} days left. Time to consider your next chapter!`;
    }
  }

  return {
    eligible,
    user_goal_id: goal.id,
    goal_title: goal.goal_catalog.title,
    status: goal.status,
    elapsed_days: elapsedDays,
    remaining_plan_days: remainingPlanDays,
    total_plan_days: totalPlanDays,
    completed_sessions: completedSessions,
    total_sessions: totalSessions,
    completion_rate: Math.round(completionRate * 100) / 100,
    options: eligible ? ['start_new_goal', 'maintenance_mode', 'pause'] : [],
    graduation_message: graduationMessage,
  };
}

/**
 * Handles a user's graduation decision.
 * 1. start_new_goal: Completes current goal, triggers profile aggregation, and primes onboarding.
 * 2. maintenance_mode: Converts goal to lighter maintenance cadence.
 * 3. pause: Sets status to PAUSED and records paused_at timestamp.
 */
export async function handleGraduationChoice(params: {
  userId: string;
  userGoalId: string;
  choice: GraduationChoice;
}): Promise<{
  success: boolean;
  choice: GraduationChoice;
  status: string;
  message: string;
  user_goal: any;
}> {
  const { userId, userGoalId, choice } = params;

  const goal = await prisma.userGoal.findFirst({
    where: { id: userGoalId, user_id: userId },
    include: { goal_catalog: true },
  });

  if (!goal) {
    throw new Error(`UserGoal ${userGoalId} not found or does not belong to user.`);
  }

  if (choice === 'start_new_goal') {
    // Mark goal as COMPLETED
    const updated = await prisma.userGoal.update({
      where: { id: userGoalId },
      data: { status: 'COMPLETED' },
    });

    // Continuously learn from this completed goal's history
    try {
      await aggregateUserProfile(userId);
    } catch (e) {
      console.warn('[Graduation] Profile aggregation notice:', e);
    }

    return {
      success: true,
      choice,
      status: 'COMPLETED',
      message: `"${goal.goal_catalog.title}" marked as successfully completed! Your profile has recorded your learned peak hours and consistency habits.`,
      user_goal: updated,
    };
  }

  if (choice === 'maintenance_mode') {
    // Keep goal active under maintenance pacing
    // Drop buffer/reflect sessions in upcoming weeks to maintain a sustainable 1-2 session/week habit
    await prisma.session.deleteMany({
      where: {
        user_goal_id: userGoalId,
        status: 'UPCOMING',
        tier: { in: ['buffer', 'reflect'] },
      },
    });

    // Continuously learn from current progress
    try {
      await aggregateUserProfile(userId);
    } catch (e) {
      console.warn('[Graduation] Profile aggregation notice:', e);
    }

    return {
      success: true,
      choice,
      status: 'ACTIVE',
      message: `"${goal.goal_catalog.title}" transitioned to Maintenance Mode. Non-core sessions pruned to preserve sustainable weekly consistency.`,
      user_goal: goal,
    };
  }

  if (choice === 'pause') {
    // Pause goal and track paused_at
    const updated = await prisma.userGoal.update({
      where: { id: userGoalId },
      data: {
        status: 'PAUSED',
        paused_at: new Date(),
      },
    });

    return {
      success: true,
      choice,
      status: 'PAUSED',
      message: `"${goal.goal_catalog.title}" paused. All your progress is safely preserved and will resume whenever you are ready.`,
      user_goal: updated,
    };
  }

  throw new Error(`Unknown graduation choice: ${choice}`);
}

/**
 * Resumes a paused goal, shifting timeline by the exact pause duration.
 * Guardrail 1: Recomputes remaining plan length and graduation triggers lazily upon resume.
 */
export async function resumePausedGoal(
  userId: string,
  userGoalId: string
): Promise<{
  success: boolean;
  user_goal: any;
  days_paused: number;
  new_target_end_date: Date;
}> {
  const goal = await prisma.userGoal.findFirst({
    where: { id: userGoalId, user_id: userId },
  });

  if (!goal) {
    throw new Error(`UserGoal ${userGoalId} not found.`);
  }

  if (goal.status !== 'PAUSED') {
    return {
      success: true,
      user_goal: goal,
      days_paused: 0,
      new_target_end_date: goal.target_end_date,
    };
  }

  const now = new Date();
  const pausedAt = goal.paused_at ? new Date(goal.paused_at) : now;
  const daysPaused = Math.max(
    0,
    Math.ceil((now.getTime() - pausedAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Extend target_end_date and current_plan_day_offset by days paused
  const newTargetDate = new Date(
    new Date(goal.target_end_date).getTime() + daysPaused * 24 * 60 * 60 * 1000
  );

  const updated = await prisma.userGoal.update({
    where: { id: userGoalId },
    data: {
      status: 'ACTIVE',
      paused_at: null,
      current_plan_day_offset: (goal.current_plan_day_offset || 0) + daysPaused,
      target_end_date: newTargetDate,
    },
  });

  return {
    success: true,
    user_goal: updated,
    days_paused: daysPaused,
    new_target_end_date: newTargetDate,
  };
}
