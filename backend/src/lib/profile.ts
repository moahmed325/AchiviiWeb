import { prisma } from './prisma.js';
import { getZonedTimeParts } from './timezone.js';

export interface BestWorkingHours {
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'flexible';
  peak_hour_window: { start: string; end: string };
  days_distribution: Record<string, number>;
  average_session_duration_minutes: number;
  total_completed_sessions: number;
  last_updated: string;
}

export interface LapsePatternSummary {
  total_recovery_events: number;
  frequent_trigger: string;
  preferred_recovery_choice: string;
  circuit_breaker_count: number;
  recovery_choices_breakdown: Record<string, number>;
  last_updated: string;
}

export interface OnboardingLearnedDefaults {
  has_historical_data: boolean;
  preferred_time_of_day: 'morning' | 'afternoon' | 'evening' | 'flexible';
  recommended_days_per_week: number;
  suggested_session_duration_minutes: number;
  high_completion_days: string[];
  coaching_insight?: string;
}

/**
 * Aggregates a user's completion timestamps and recovery events into learned profile patterns.
 * §4.10: Derives best_working_hours from completion timestamps and lapse patterns from RecoveryEvents.
 */
export async function aggregateUserProfile(userId: string): Promise<{
  best_working_hours: BestWorkingHours;
  lapse_pattern_summary: LapsePatternSummary;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      user_goals: {
        include: {
          sessions: {
            where: { status: 'DONE' },
            include: { task_template: true },
          },
          recovery_events: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`User ${userId} not found.`);
  }

  const userTimezone = user.timezone || 'UTC';
  const allCompletedSessions = user.user_goals.flatMap((g) => g.sessions);
  const allRecoveryEvents = user.user_goals.flatMap((g) => g.recovery_events);

  // 1. Compute best_working_hours
  const hourHistogram: Record<number, number> = {};
  const dayHistogram: Record<string, number> = {
    MON: 0,
    TUE: 0,
    WED: 0,
    THU: 0,
    FRI: 0,
    SAT: 0,
    SUN: 0,
  };

  let totalDurationMinutes = 0;
  const dayKeys = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  for (const session of allCompletedSessions) {
    // Determine completion timestamp or scheduled time
    const timestamp = session.completed_at_utc || (session.scheduled_date ? new Date(session.scheduled_date) : null);
    if (timestamp) {
      const parts = getZonedTimeParts(new Date(timestamp), userTimezone);
      const hour = parts.hours;
      hourHistogram[hour] = (hourHistogram[hour] || 0) + 1;

      const dayKey = parts.dayKey;
      dayHistogram[dayKey] = (dayHistogram[dayKey] || 0) + 1;
    }

    // Duration
    const duration = session.task_template?.session_duration_minutes || 45;
    totalDurationMinutes += duration;
  }

  // Determine preferred time of day
  // Morning: 05:00 - 12:00, Afternoon: 12:00 - 17:00, Evening: 17:00 - 23:00
  let morningCount = 0;
  let afternoonCount = 0;
  let eveningCount = 0;

  for (const [hourStr, count] of Object.entries(hourHistogram)) {
    const h = parseInt(hourStr, 10);
    if (h >= 5 && h < 12) morningCount += count;
    else if (h >= 12 && h < 17) afternoonCount += count;
    else eveningCount += count;
  }

  let preferredTime: 'morning' | 'afternoon' | 'evening' | 'flexible' = 'flexible';
  const totalWithTime = morningCount + afternoonCount + eveningCount;
  if (totalWithTime > 0) {
    if (morningCount >= afternoonCount && morningCount >= eveningCount) {
      preferredTime = 'morning';
    } else if (afternoonCount >= morningCount && afternoonCount >= eveningCount) {
      preferredTime = 'afternoon';
    } else {
      preferredTime = 'evening';
    }
  }

  // Peak 3-hour window
  let peakHour = 9;
  let maxWindowCount = 0;
  for (let h = 5; h <= 20; h++) {
    const windowSum = (hourHistogram[h] || 0) + (hourHistogram[h + 1] || 0) + (hourHistogram[h + 2] || 0);
    if (windowSum > maxWindowCount) {
      maxWindowCount = windowSum;
      peakHour = h;
    }
  }

  const peakWindow = {
    start: `${peakHour.toString().padStart(2, '0')}:00`,
    end: `${Math.min(23, peakHour + 3).toString().padStart(2, '0')}:00`,
  };

  const avgDuration =
    allCompletedSessions.length > 0
      ? Math.round(totalDurationMinutes / allCompletedSessions.length)
      : 45;

  const bestWorkingHours: BestWorkingHours = {
    preferred_time_of_day: preferredTime,
    peak_hour_window: peakWindow,
    days_distribution: dayHistogram,
    average_session_duration_minutes: avgDuration,
    total_completed_sessions: allCompletedSessions.length,
    last_updated: new Date().toISOString(),
  };

  // 2. Compute lapse_pattern_summary
  const triggerHistogram: Record<string, number> = {};
  const choiceHistogram: Record<string, number> = {};
  let circuitBreakerCount = 0;

  for (const event of allRecoveryEvents) {
    triggerHistogram[event.trigger_condition] = (triggerHistogram[event.trigger_condition] || 0) + 1;
    choiceHistogram[event.user_choice] = (choiceHistogram[event.user_choice] || 0) + 1;
    if (event.user_choice === 'scope_reduction' || (event.resulting_adjustment as any)?.circuit_breaker) {
      circuitBreakerCount++;
    }
  }

  let frequentTrigger = 'none';
  let maxTriggerCount = 0;
  for (const [trig, cnt] of Object.entries(triggerHistogram)) {
    if (cnt > maxTriggerCount) {
      maxTriggerCount = cnt;
      frequentTrigger = trig;
    }
  }

  let preferredChoice = 'shrink_week';
  let maxChoiceCount = 0;
  for (const [choice, cnt] of Object.entries(choiceHistogram)) {
    if (cnt > maxChoiceCount) {
      maxChoiceCount = cnt;
      preferredChoice = choice;
    }
  }

  const lapsePatternSummary: LapsePatternSummary = {
    total_recovery_events: allRecoveryEvents.length,
    frequent_trigger: frequentTrigger,
    preferred_recovery_choice: preferredChoice,
    circuit_breaker_count: circuitBreakerCount,
    recovery_choices_breakdown: choiceHistogram,
    last_updated: new Date().toISOString(),
  };

  // Persist aggregated profile additively
  await prisma.user.update({
    where: { id: userId },
    data: {
      best_working_hours: bestWorkingHours as any,
      lapse_pattern_summary: lapsePatternSummary as any,
    },
  });

  return {
    best_working_hours: bestWorkingHours,
    lapse_pattern_summary: lapsePatternSummary,
  };
}

/**
 * Returns learned onboarding defaults derived from profile aggregation.
 * Section 4.10: Used to pre-fill subsequent goal onboarding routines as editable suggestions.
 */
export async function getOnboardingLearnedDefaults(userId: string): Promise<OnboardingLearnedDefaults> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      best_working_hours: true,
      lapse_pattern_summary: true,
    },
  });

  if (!user || !user.best_working_hours) {
    return {
      has_historical_data: false,
      preferred_time_of_day: 'flexible',
      recommended_days_per_week: 4,
      suggested_session_duration_minutes: 45,
      high_completion_days: ['MON', 'TUE', 'WED', 'THU'],
    };
  }

  const bwh = user.best_working_hours as unknown as BestWorkingHours;
  const lps = (user.lapse_pattern_summary as unknown as LapsePatternSummary) || null;

  // High completion days (sorted by completion count)
  const highDays = Object.entries(bwh.days_distribution || {})
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([day]) => day);

  const fallbackDays = highDays.length >= 3 ? highDays.slice(0, 4) : ['MON', 'TUE', 'WED', 'THU'];

  // Adjust recommended days based on lapse patterns:
  // If user experienced many recovery events, recommend 3 days/week instead of 5
  let recommendedDays = 4;
  if (lps && lps.total_recovery_events >= 3) {
    recommendedDays = 3;
  } else if (bwh.total_completed_sessions >= 20) {
    recommendedDays = Math.min(5, Math.max(3, highDays.length));
  }

  let insight = '';
  if (bwh.preferred_time_of_day !== 'flexible') {
    insight = `Based on your past momentum, you complete the most sessions in the ${bwh.preferred_time_of_day} (peak window ${bwh.peak_hour_window.start}–${bwh.peak_hour_window.end}).`;
  }

  return {
    has_historical_data: bwh.total_completed_sessions > 0,
    preferred_time_of_day: bwh.preferred_time_of_day,
    recommended_days_per_week: recommendedDays,
    suggested_session_duration_minutes: bwh.average_session_duration_minutes || 45,
    high_completion_days: fallbackDays,
    coaching_insight: insight || undefined,
  };
}
