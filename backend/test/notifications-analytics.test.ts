import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkFrequencyCap,
  recordNotificationDelivery,
  getActiveNotifications,
  resetNotificationHistory,
} from '../src/lib/notifications.js';
import {
  calculateProductSuccessMetrics,
  trackProductEvent,
  resetTelemetryBuffer,
} from '../src/lib/analytics.js';
import { prisma } from '../src/lib/prisma.js';

// Mock prisma
vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      userGoal: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      recoveryEvent: {
        findMany: vi.fn(),
      },
      session: {
        findFirst: vi.fn(),
      },
    },
  };
});

describe('Phase 6 Notification Scaffolding & Product Success Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNotificationHistory();
    resetTelemetryBuffer();
  });

  describe('Notification Frequency Caps (§11 & Guardrail 3)', () => {
    const userId = 'user-cap-test';

    it('allows 1 daily reminder per 24 hours and blocks subsequent triggers within window', () => {
      const now = new Date('2026-03-01T10:00:00.000Z');

      // First check: allowed
      const firstCheck = checkFrequencyCap(userId, 'daily_reminder', now);
      expect(firstCheck.allowed).toBe(true);

      // Record delivery
      recordNotificationDelivery(userId, 'daily_reminder', now);

      // Second check 4 hours later: blocked
      const fourHoursLater = new Date('2026-03-01T14:00:00.000Z');
      const secondCheck = checkFrequencyCap(userId, 'daily_reminder', fourHoursLater);
      expect(secondCheck.allowed).toBe(false);
      expect(secondCheck.reason).toContain('Frequency cap reached');

      // Third check 25 hours later: allowed
      const nextDay = new Date('2026-03-02T11:05:00.000Z');
      const thirdCheck = checkFrequencyCap(userId, 'daily_reminder', nextDay);
      expect(thirdCheck.allowed).toBe(true);
    });

    it('enforces strict 48-hour cooldown on recovery check-in nudges to prevent alert fatigue', () => {
      const now = new Date('2026-03-01T10:00:00.000Z');

      recordNotificationDelivery(userId, 'recovery_nudge', now);

      // 36 hours later: still blocked under 48h cap
      const thirtySixHoursLater = new Date('2026-03-02T22:00:00.000Z');
      const checkBlocked = checkFrequencyCap(userId, 'recovery_nudge', thirtySixHoursLater);
      expect(checkBlocked.allowed).toBe(false);

      // 49 hours later: allowed
      const fortyNineHoursLater = new Date('2026-03-03T11:00:00.000Z');
      const checkAllowed = checkFrequencyCap(userId, 'recovery_nudge', fortyNineHoursLater);
      expect(checkAllowed.allowed).toBe(true);
    });
  });

  describe('Product Success Analytics (§2 & Guardrail 4)', () => {
    it('calculates Section 2 Day-90 engagement, 3+ day recovery re-engagement, and graduation re-enrollment rates', async () => {
      const fixedNow = new Date('2026-06-01T00:00:00.000Z');

      // 1. Mock Goals for Day-90 Cohort
      const mockGoals = [
        {
          id: 'goal-cohort-1',
          user_id: 'user-1',
          status: 'COMPLETED',
          start_date: new Date('2026-02-01T00:00:00.000Z'), // > 90 days ago
          sessions: [],
          recovery_events: [],
        },
        {
          id: 'goal-cohort-2',
          user_id: 'user-2',
          status: 'ACTIVE',
          start_date: new Date('2026-02-15T00:00:00.000Z'), // > 90 days ago
          sessions: [
            // Active session completed 4 days ago
            {
              status: 'DONE',
              completed_at_utc: new Date('2026-05-28T00:00:00.000Z'),
            },
          ],
          recovery_events: [],
        },
        {
          id: 'goal-cohort-3',
          user_id: 'user-3',
          status: 'ACTIVE',
          start_date: new Date('2026-02-15T00:00:00.000Z'), // > 90 days ago
          sessions: [
            // Inactive (no sessions in last 14 days)
            {
              status: 'DONE',
              completed_at_utc: new Date('2026-03-10T00:00:00.000Z'),
            },
          ],
          recovery_events: [],
        },
      ];

      // 2. Mock Recovery Events for 3+ Day Lapse Recovery Rate
      const mockRecoveryEvents = [
        {
          user_goal_id: 'goal-lapse-recovered',
          timestamp: new Date('2026-04-01T00:00:00.000Z'),
          trigger_condition: 'CONSECUTIVE_DAYS_MISSED',
          user_choice: 'shrink_week',
          user_goal: {
            sessions: [
              {
                status: 'DONE',
                completed_at_utc: new Date('2026-04-05T00:00:00.000Z'), // Done after recovery event
              },
            ],
          },
        },
        {
          user_goal_id: 'goal-lapse-unrecovered',
          timestamp: new Date('2026-04-10T00:00:00.000Z'),
          trigger_condition: 'NO_FREE_SLOTS',
          user_choice: 'shift_timeline',
          user_goal: {
            sessions: [
              // No sessions done after event
            ],
          },
        },
      ];

      // 3. Mock Completed Goals for Graduation Re-enrollment Rate
      const mockCompletedGoals = [
        { id: 'g1', user_id: 'user-grad-1' },
        { id: 'g2', user_id: 'user-grad-2' },
      ];

      (prisma.userGoal.findMany as any).mockImplementation(async (args?: any) => {
        if (args?.where?.status === 'COMPLETED') {
          return mockCompletedGoals;
        }
        return mockGoals;
      });

      (prisma.recoveryEvent.findMany as any).mockResolvedValue(mockRecoveryEvents);

      // User 1 has 2 goals (re-enrolled); User 2 has 1 goal (not re-enrolled)
      (prisma.userGoal.count as any).mockImplementation(async ({ where }: any) => {
        if (where?.user_id === 'user-grad-1') return 2;
        if (where?.user_id === 'user-grad-2') return 1;
        return 1;
      });

      const metrics = await calculateProductSuccessMetrics(fixedNow);

      // Day-90 rate: 2 out of 3 engaged -> 66.7%
      expect(metrics.day_90_engagement.cohort_total).toBe(3);
      expect(metrics.day_90_engagement.engaged_count).toBe(2);
      expect(metrics.day_90_engagement.rate_percentage).toBe(66.7);

      // Lapse recovery rate: 1 out of 2 recovered -> 50.0%
      expect(metrics.lapse_recovery_reengagement.lapsed_total).toBe(2);
      expect(metrics.lapse_recovery_reengagement.recovered_count).toBe(1);
      expect(metrics.lapse_recovery_reengagement.rate_percentage).toBe(50.0);

      // Graduation re-enrollment rate: 1 out of 2 re-enrolled -> 50.0%
      expect(metrics.graduation_reenrollment.graduated_total).toBe(2);
      expect(metrics.graduation_reenrollment.reenrolled_count).toBe(1);
      expect(metrics.graduation_reenrollment.rate_percentage).toBe(50.0);
    });

    it('tracks telemetry events cleanly in in-memory buffer', () => {
      const event = trackProductEvent('recovery_choice_selected', 'user-123', {
        choice: 'shrink_week',
      });

      expect(event.eventName).toBe('recovery_choice_selected');
      expect(event.userId).toBe('user-123');
      expect(event.metadata?.choice).toBe('shrink_week');
      expect(event.timestamp).toBeDefined();
    });
  });
});
