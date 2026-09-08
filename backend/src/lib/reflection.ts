import { prisma } from './prisma.js';
import { getPendingRecoveryState } from './recovery.js';
import { getZonedDateString, getZonedDayBounds } from './timezone.js';

export const DEFAULT_COMPLETION_THRESHOLD = 0.70;

export interface PendingReflectionResponse {
  pending: boolean;
  deferred?: boolean;
  defer_reason?: string;
  user_goal_id: string;
  week_number?: number;
  completion_rate?: number;
  reflection_type?: 'single_tap' | 'full';
  questions?: {
    id: string;
    question: string;
    type: 'text' | 'choice';
    options?: string[];
  }[];
  prompt_copy?: {
    headline: string;
    subheadline: string;
    confirm_button: string;
  };
}

export const FULL_REFLECTION_QUESTIONS = [
  {
    id: 'what_went_well',
    question: 'What went well this week?',
    type: 'text' as const,
  },
  {
    id: 'what_got_in_way',
    question: 'What got in the way of completing your sessions?',
    type: 'text' as const,
  },
  {
    id: 'difficulty',
    question: 'How did the pacing and difficulty feel?',
    type: 'choice' as const,
    options: ['Too Easy', 'Just Right', 'Too Challenging'],
  },
  {
    id: 'schedule_changes',
    question: 'Do you need any adjustments to your weekly routine?',
    type: 'text' as const,
  },
];

/**
 * Calculates the session completion rate for a specific week of a goal.
 */
export async function calculateWeekCompletionRate(
  userGoalId: string,
  weekOffset: number
): Promise<{ total: number; completed: number; rate: number }> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: { user: true },
  });

  if (!userGoal) {
    throw new Error(`UserGoal ${userGoalId} not found`);
  }

  const userTimezone = userGoal.user.timezone || 'UTC';
  const goalStart = new Date(userGoal.start_date);
  const goalStartDateStr = getZonedDateString(goalStart, userTimezone);
  const { startOfDay: startOfGoal } = getZonedDayBounds(goalStartDateStr, userTimezone);

  const weekStart = new Date(startOfGoal.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.session.findMany({
    where: {
      user_goal_id: userGoalId,
      scheduled_date: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
  });

  if (sessions.length === 0) {
    return { total: 0, completed: 0, rate: 1.0 };
  }

  const completed = sessions.filter((s) => s.status === 'DONE').length;
  const rate = Math.round((completed / sessions.length) * 100) / 100;

  return { total: sessions.length, completed, rate };
}

/**
 * Evaluates pending weekly reflections lazily on app-wake / request.
 * - Enforces Phase 2 recovery precedence: if recovery is pending, defer reflection.
 * - Enforces Week 1 baseline rule: always defaults to 'single_tap'.
 * - Enforces configurable completion rate threshold (>= 70% single-tap, < 70% full).
 */
export async function getPendingWeeklyReflection(
  userGoalId: string,
  customThreshold: number = DEFAULT_COMPLETION_THRESHOLD
): Promise<PendingReflectionResponse> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      user: true,
      weekly_reviews: true,
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal ${userGoalId} not found`);
  }

  // 1. Check Phase 2 Recovery Precedence (Guardrail 3)
  // If Tier 2 recovery check-in is pending, recovery takes absolute priority!
  const recoveryState = await getPendingRecoveryState(userGoalId);
  if (recoveryState.pending) {
    return {
      pending: false,
      deferred: true,
      defer_reason: 'RECOVERY_CHECKIN_PENDING',
      user_goal_id: userGoalId,
    };
  }

  // 2. Evaluate time elapsed in user's timezone
  const userTimezone = userGoal.user.timezone || 'UTC';
  const goalStart = new Date(userGoal.start_date);
  const goalStartDateStr = getZonedDateString(goalStart, userTimezone);
  const { startOfDay: startOfGoal } = getZonedDayBounds(goalStartDateStr, userTimezone);

  const now = new Date();
  const diffMs = now.getTime() - startOfGoal.getTime();
  const currentWeekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));

  // If we haven't even completed Week 1 (still in week 0, e.g. days 0-6), no past week is ready for review
  if (currentWeekIndex < 1) {
    return {
      pending: false,
      user_goal_id: userGoalId,
    };
  }

  // Check the most recently completed week(s) up to currentWeekIndex
  // week_number is 1-indexed (weekOffset 0 -> week_number 1)
  const existingReviewedWeeks = new Set(userGoal.weekly_reviews.map((r) => r.week_number));

  // Find the earliest unreviewed completed week
  let targetWeekNumber: number | null = null;
  for (let w = 1; w <= currentWeekIndex; w++) {
    if (!existingReviewedWeeks.has(w)) {
      targetWeekNumber = w;
      break;
    }
  }

  if (targetWeekNumber === null) {
    return {
      pending: false,
      user_goal_id: userGoalId,
    };
  }

  const weekOffset = targetWeekNumber - 1;
  const { rate: completionRate } = await calculateWeekCompletionRate(userGoalId, weekOffset);

  // 3. Determine reflection type:
  // Week 1 always defaults to single_tap regardless of completion rate (Guardrail 4)
  let reflectionType: 'single_tap' | 'full' = 'single_tap';
  if (targetWeekNumber === 1) {
    reflectionType = 'single_tap';
  } else {
    reflectionType = completionRate >= customThreshold ? 'single_tap' : 'full';
  }

  if (reflectionType === 'single_tap') {
    return {
      pending: true,
      user_goal_id: userGoalId,
      week_number: targetWeekNumber,
      completion_rate: completionRate,
      reflection_type: 'single_tap',
      prompt_copy: {
        headline: `Week ${targetWeekNumber} Check-in`,
        subheadline: 'Good week — same plan next week?',
        confirm_button: 'Keep Same Plan',
      },
    };
  }

  return {
    pending: true,
    user_goal_id: userGoalId,
    week_number: targetWeekNumber,
    completion_rate: completionRate,
    reflection_type: 'full',
    questions: FULL_REFLECTION_QUESTIONS,
    prompt_copy: {
      headline: `Week ${targetWeekNumber} Reflection`,
      subheadline: `You completed ${Math.round(completionRate * 100)}% of your scheduled sessions this week. Let's take a quick moment to reflect so we can optimize next week.`,
      confirm_button: 'Submit Weekly Reflection',
    },
  };
}

/**
 * Persists a user's weekly review response into WeeklyReview table.
 */
export async function submitWeeklyReflection(
  userGoalId: string,
  weekNumber: number,
  reflectionType: 'single_tap' | 'full',
  responses?: any
): Promise<{ success: boolean; weeklyReview: any }> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
  });

  if (!userGoal) {
    throw new Error(`UserGoal ${userGoalId} not found`);
  }

  const { rate } = await calculateWeekCompletionRate(userGoalId, weekNumber - 1);

  const weeklyReview = await prisma.weeklyReview.upsert({
    where: {
      user_goal_id_week_number: {
        user_goal_id: userGoalId,
        week_number: weekNumber,
      },
    },
    update: {
      completion_rate: rate,
      reflection_type: reflectionType,
      reflection_responses: responses || null,
    },
    create: {
      user_goal_id: userGoalId,
      week_number: weekNumber,
      completion_rate: rate,
      reflection_type: reflectionType,
      reflection_responses: responses || null,
    },
  });

  return {
    success: true,
    weeklyReview,
  };
}
