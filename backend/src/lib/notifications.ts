import { prisma } from './prisma.js';
import { getZonedDateString } from './timezone.js';
import { evaluateGraduationEligibility } from './graduation.js';
import { getPendingRecoveryState } from './recovery.js';
import { getPendingWeeklyReflection } from './reflection.js';

export type NotificationType =
  | 'daily_reminder'
  | 'recovery_nudge'
  | 'weekly_reflection'
  | 'graduation_milestone';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  cta_url: string;
  cta_text: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
}

export interface FrequencyCapRule {
  maxCount: number;
  windowHours: number;
}

// Strictly enforced frequency cap rules to prevent user notification fatigue
export const FREQUENCY_CAPS: Record<NotificationType, FrequencyCapRule> = {
  daily_reminder: { maxCount: 1, windowHours: 24 },      // 1 per 24 hours
  recovery_nudge: { maxCount: 1, windowHours: 48 },      // 1 per 48 hours (never spam lapsing users)
  weekly_reflection: { maxCount: 1, windowHours: 168 },  // 1 per week (7 days)
  graduation_milestone: { maxCount: 2, windowHours: 720 }, // 2 per month
};

// In-memory persistent history store (with userId + type mapping)
interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  timestamp: Date;
  dismissed: boolean;
}

const notificationHistory: NotificationRecord[] = [];

/**
 * Checks if a notification can be sent to a user under frequency cap rules.
 */
export function checkFrequencyCap(
  userId: string,
  type: NotificationType,
  overrideNow?: Date
): { allowed: boolean; reason?: string } {
  const rule = FREQUENCY_CAPS[type];
  const now = overrideNow || new Date();
  const windowStart = new Date(now.getTime() - rule.windowHours * 60 * 60 * 1000);

  const sentInWindow = notificationHistory.filter(
    (record) =>
      record.userId === userId &&
      record.type === type &&
      record.timestamp >= windowStart
  );

  if (sentInWindow.length >= rule.maxCount) {
    return {
      allowed: false,
      reason: `Frequency cap reached for ${type}: Maximum ${rule.maxCount} per ${rule.windowHours}h window.`,
    };
  }

  return { allowed: true };
}

/**
 * Logs that a notification was sent or surfaced to the user.
 */
export function recordNotificationDelivery(
  userId: string,
  type: NotificationType,
  overrideNow?: Date
): NotificationRecord {
  const record: NotificationRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    type,
    timestamp: overrideNow || new Date(),
    dismissed: false,
  };
  notificationHistory.push(record);
  return record;
}

/**
 * Evaluates in-app notifications for the user respecting frequency caps and role precedence.
 */
export async function getActiveNotifications(
  userId: string,
  overrideNow?: Date
): Promise<NotificationItem[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      user_goals: {
        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
        orderBy: { start_date: 'desc' },
      },
    },
  });

  if (!user || user.user_goals.length === 0) {
    return [];
  }

  const activeGoal = user.user_goals[0];
  const items: NotificationItem[] = [];
  const now = overrideNow || new Date();

  // 1. Recovery Check-in (High Priority) - Frequency cap: 1 per 48h
  try {
    const recoveryState = await getPendingRecoveryState(activeGoal.id);
    if (recoveryState.pending) {
      const cap = checkFrequencyCap(userId, 'recovery_nudge', now);
      if (cap.allowed) {
        items.push({
          id: `rec-${activeGoal.id}`,
          type: 'recovery_nudge',
          title: 'Gentle Pace Calibration Needed',
          body: `We noticed a few sessions were missed on "${activeGoal.id}". Take 30 seconds to calibrate without guilt or stress.`,
          cta_url: '/calendar',
          cta_text: 'Calibrate Schedule',
          priority: 'high',
          created_at: now.toISOString(),
        });
      }
    }
  } catch (_) {}

  // 2. Weekly Reflection (Medium Priority) - Precedence rule: Only if recovery check-in is not pending
  if (items.length === 0) {
    try {
      const reflectionState = await getPendingWeeklyReflection(activeGoal.id);
      if (reflectionState.pending && !reflectionState.deferred) {
        const cap = checkFrequencyCap(userId, 'weekly_reflection', now);
        if (cap.allowed) {
          items.push({
            id: `refl-${activeGoal.id}-${reflectionState.week_number}`,
            type: 'weekly_reflection',
            title: `Week ${reflectionState.week_number} Reflection Ready`,
            body: 'A quick 1-tap check-in on how your week felt and whether your current pacing is sustainable.',
            cta_url: '/calendar',
            cta_text: 'Reflect on Week',
            priority: 'medium',
            created_at: now.toISOString(),
          });
        }
      }
    } catch (_) {}
  }

  // 3. Graduation Milestone (Medium/High Priority) - Frequency cap: 2 per 30d
  try {
    const gradState = await evaluateGraduationEligibility(activeGoal.id, now);
    if (gradState.eligible) {
      const cap = checkFrequencyCap(userId, 'graduation_milestone', now);
      if (cap.allowed) {
        items.push({
          id: `grad-${activeGoal.id}`,
          type: 'graduation_milestone',
          title: `Milestone: Ready to Graduate "${gradState.goal_title}"`,
          body: `You are in your goal's graduation window with ${gradState.remaining_plan_days} days remaining. Choose your next phase.`,
          cta_url: '/calendar',
          cta_text: 'View Graduation Options',
          priority: 'high',
          created_at: now.toISOString(),
        });
      }
    }
  } catch (_) {}

  // 4. Daily Reminder (Low Priority) - Frequency cap: 1 per 24h
  const dailyCap = checkFrequencyCap(userId, 'daily_reminder', now);
  if (dailyCap.allowed && items.length === 0 && activeGoal.status === 'ACTIVE') {
    const todayStr = getZonedDateString(now, user.timezone || 'UTC');
    // Check if session scheduled today
    const todaySession = await prisma.session.findFirst({
      where: {
        user_goal_id: activeGoal.id,
        scheduled_date: new Date(todayStr),
        status: 'UPCOMING',
      },
    });

    if (todaySession) {
      items.push({
        id: `daily-${todaySession.id}`,
        type: 'daily_reminder',
        title: 'Today’s Focus Block Scheduled',
        body: 'Consistency is about steady steps forward. Your upcoming session is ready on your calendar.',
        cta_url: '/calendar',
        cta_text: 'Open Today’s Session',
        priority: 'low',
        created_at: now.toISOString(),
      });
    }
  }

  return items;
}

/**
 * Dismisses a notification for the current user.
 */
export function dismissNotification(userId: string, notificationId: string): boolean {
  const match = notificationHistory.find((n) => n.userId === userId && n.id === notificationId);
  if (match) {
    match.dismissed = true;
    return true;
  }
  return false;
}

/**
 * Helper to reset notification history (primarily for tests).
 */
export function resetNotificationHistory(): void {
  notificationHistory.length = 0;
}
