import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatDateYYYYMMDD,
  getDayKey,
  getBaselineDayOpenings,
  detectAndRescheduleMissed,
} from '../src/lib/rescheduler.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    userGoal: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('rescheduler.ts baseline unit tests', () => {
  const RealDate = globalThis.Date;
  const mockFrozenTime = new RealDate('2026-09-16T15:00:00');

  function freezeTime() {
    if (typeof vi.useFakeTimers === 'function' && typeof vi.setSystemTime === 'function') {
      vi.useFakeTimers();
      vi.setSystemTime(mockFrozenTime);
    }
    // Cross-runtime fallback (e.g. Bun test runner)
    const customDate = class extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockFrozenTime.getTime());
        } else {
          // @ts-expect-error spread constructor
          super(...args);
        }
      }
      static now() {
        return mockFrozenTime.getTime();
      }
    };
    globalThis.Date = customDate as any;
  }

  function unfreezeTime() {
    if (typeof vi.useRealTimers === 'function') {
      vi.useRealTimers();
    }
    globalThis.Date = RealDate;
  }
  describe('helper functions', () => {
    it('formats date as YYYY-MM-DD with zero-padding', () => {
      const d1 = new Date(2026, 0, 5); // Jan 5 2026
      expect(formatDateYYYYMMDD(d1)).toBe('2026-01-05');

      const d2 = new Date(2026, 11, 25); // Dec 25 2026
      expect(formatDateYYYYMMDD(d2)).toBe('2026-12-25');
    });

    it('identifies correct DayKey from date', () => {
      // 2026-09-14 is Monday
      expect(getDayKey(new Date('2026-09-14T12:00:00Z'))).toBe('MON');
      // 2026-09-20 is Sunday
      expect(getDayKey(new Date('2026-09-20T12:00:00Z'))).toBe('SUN');
      // 2026-09-19 is Saturday
      expect(getDayKey(new Date('2026-09-19T12:00:00Z'))).toBe('SAT');
    });

    it('returns baseline day openings according to day of week', () => {
      expect(getBaselineDayOpenings('SUN')).toEqual([{ start: 480, end: 1260 }]); // 08:00 - 21:00
      expect(getBaselineDayOpenings('SAT')).toEqual([{ start: 480, end: 1290 }]); // 08:00 - 21:30
      expect(getBaselineDayOpenings('MON')).toEqual([{ start: 420, end: 1320 }]); // 07:00 - 22:00
      expect(getBaselineDayOpenings('FRI')).toEqual([{ start: 420, end: 1320 }]); // 07:00 - 22:00
    });

    it('formats date according to user timezone when provided', () => {
      const utcDate = new Date('2026-09-08T23:30:00Z');
      expect(formatDateYYYYMMDD(utcDate, 'Asia/Tokyo')).toBe('2026-09-09');
      expect(formatDateYYYYMMDD(utcDate, 'America/New_York')).toBe('2026-09-08');
    });

    it('identifies correct DayKey according to user timezone', () => {
      const utcDate = new Date('2026-09-08T23:30:00Z');
      expect(getDayKey(utcDate, 'Asia/Tokyo')).toBe('WED');
      expect(getDayKey(utcDate, 'America/New_York')).toBe('TUE');
    });
  });

  describe('detectAndRescheduleMissed', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      freezeTime();
    });

    afterEach(() => {
      unfreezeTime();
    });

    it('throws error if userGoal is not found', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue(null);
      await expect(detectAndRescheduleMissed('nonexistent-goal')).rejects.toThrow(
        'Active user goal not found.'
      );
    });

    it('ignores DONE sessions and future sessions that are not past end_time', async () => {
      const mockGoal = {
        id: 'goal-1',
        slippage_days: 0,
        target_end_date: new Date('2026-12-07T00:00:00'),
        user: { availability_slots: [] },
        goal_catalog: { phases: [] },
      };

      const sessions = [
        {
          id: 's-done',
          scheduled_date: new Date('2026-09-15T10:00:00'), // yesterday
          start_time: '10:00',
          end_time: '11:00',
          status: 'DONE',
          task_template: { title: 'Task 1', session_duration_minutes: 60, preferred_time_of_day: null },
        },
        {
          id: 's-future',
          scheduled_date: new Date('2026-09-17T10:00:00'), // tomorrow
          start_time: '10:00',
          end_time: '11:00',
          status: 'UPCOMING',
          task_template: { title: 'Task 2', session_duration_minutes: 60, preferred_time_of_day: null },
        },
      ];

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue(sessions);

      const result = await detectAndRescheduleMissed('goal-1');

      expect(result.missedDetectedCount).toBe(0);
      expect(result.rescheduledCount).toBe(0);
      expect(prisma.session.update).not.toHaveBeenCalled();
    });

    it('reallocates missed session within the same week when a slot is free', async () => {
      // Current time is Wednesday 2026-09-16 15:00.
      // Session was scheduled for Tuesday 2026-09-15 (yesterday) at 10:00-11:00 and missed (UPCOMING).
      const mockGoal = {
        id: 'goal-same-week',
        slippage_days: 0,
        target_end_date: new Date('2026-12-07T00:00:00'),
        user: { availability_slots: [] }, // fully open
        goal_catalog: { phases: [] },
      };

      const missedSession = {
        id: 's-missed-tue',
        scheduled_date: new Date('2026-09-15T10:00:00'),
        start_time: '10:00',
        end_time: '11:00',
        status: 'UPCOMING',
        task_template: {
          title: 'Deep Work',
          session_duration_minutes: 60,
          preferred_time_of_day: 'morning',
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue([missedSession]);
      (prisma.session.update as any).mockResolvedValue({});

      const result = await detectAndRescheduleMissed('goal-same-week');

      expect(result.missedDetectedCount).toBe(1);
      expect(result.sameWeekReallocatedCount).toBe(1);
      expect(result.planShiftCount).toBe(0);
      expect(result.slippageDaysAdded).toBe(0);
      expect(result.totalSlippageDays).toBe(0);
      expect(result.guardrailTriggered).toBe(false);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].actionType).toBe('REALLOCATED_SAME_WEEK');
      expect(result.actions[0].sessionId).toBe('s-missed-tue');

      // Check that session was updated with RESCHEDULED status
      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-missed-tue' },
          data: expect.objectContaining({
            status: 'RESCHEDULED',
          }),
        })
      );
      // UserGoal should not be updated since no slippage was added
      expect(prisma.userGoal.update).not.toHaveBeenCalled();
    });

    it('flags pending recovery state (Tier 2: NO_FREE_SLOTS) without auto-shifting when no free slot exists in current week', async () => {
      // Missed session on Monday 2026-09-14.
      // User has availability slots covering all remaining days of the week (Wed-Sun) 00:00-23:59.
      const mockGoal = {
        id: 'goal-cascade',
        slippage_days: 0,
        target_end_date: new Date('2026-12-07T00:00:00'),
        user: {
          availability_slots: [
            { day_of_week: 'WED', start_time: '00:00', end_time: '23:59' },
            { day_of_week: 'THU', start_time: '00:00', end_time: '23:59' },
            { day_of_week: 'FRI', start_time: '00:00', end_time: '23:59' },
            { day_of_week: 'SAT', start_time: '00:00', end_time: '23:59' },
          ],
        },
        goal_catalog: { phases: [] },
      };

      const missedSession = {
        id: 's-missed',
        scheduled_date: new Date('2026-09-14T09:00:00'),
        start_time: '09:00',
        end_time: '10:00',
        status: 'MISSED',
        task_template: {
          title: 'Morning Run',
          session_duration_minutes: 60,
          preferred_time_of_day: 'morning',
        },
      };

      // Book Sunday 2026-09-20 completely with another session (08:00 - 21:00) so no free window exists
      const sundaySession = {
        id: 's-sunday',
        scheduled_date: new Date('2026-09-20T08:00:00'),
        start_time: '08:00',
        end_time: '21:00',
        status: 'UPCOMING',
        task_template: {
          title: 'Full Day Event',
          session_duration_minutes: 780,
          preferred_time_of_day: null,
        },
      };

      // Future session in week 2 that must NOT be auto-shifted in Phase 2
      const futureSession = {
        id: 's-future-w2',
        scheduled_date: new Date('2026-09-21T09:00:00'),
        start_time: '09:00',
        end_time: '10:00',
        status: 'UPCOMING',
        task_template: {
          title: 'Week 2 Run',
          session_duration_minutes: 60,
          preferred_time_of_day: null,
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue([
        missedSession,
        sundaySession,
        futureSession,
      ]);

      const result = await detectAndRescheduleMissed('goal-cascade');

      expect(result.missedDetectedCount).toBe(1);
      expect(result.sameWeekReallocatedCount).toBe(0);
      expect(result.planShiftCount).toBe(0);
      expect(result.slippageDaysAdded).toBe(0);
      expect(result.totalSlippageDays).toBe(0);
      expect(result.guardrailTriggered).toBe(false);

      // Tier 2 pending recovery flagged with reason NO_FREE_SLOTS
      expect(result.pendingRecovery).toBeDefined();
      expect(result.pendingRecovery?.triggered).toBe(true);
      expect(result.pendingRecovery?.tier).toBe('TIER_2_PENDING');
      expect(result.pendingRecovery?.reason).toBe('NO_FREE_SLOTS');
      expect(result.pendingRecovery?.missedSessionIds).toContain('s-missed');

      // Crucial Phase 2 Guardrail 2: Do NOT mutate sessions or user goal in the background
      expect(prisma.session.update).not.toHaveBeenCalled();
      expect(prisma.userGoal.update).not.toHaveBeenCalled();
    });

    it('triggers Tier 2 pending state when 3+ consecutive days are missed without mutating sessions', async () => {
      // Current frozen time is Wednesday 2026-09-16 15:00
      // User missed sessions on Monday, Tuesday, and Wednesday (after 10-11 session)
      const mockGoal = {
        id: 'goal-3-missed',
        slippage_days: 0,
        target_end_date: new Date('2026-12-07T00:00:00'),
        user: { availability_slots: [] }, // open slots on Thu/Fri/Sat/Sun
        goal_catalog: { phases: [] },
      };

      const sessions = [
        {
          id: 's-mon',
          scheduled_date: new Date('2026-09-14T10:00:00'),
          start_time: '10:00',
          end_time: '11:00',
          status: 'UPCOMING',
          task_template: { title: 'Day 1', session_duration_minutes: 60, preferred_time_of_day: null },
        },
        {
          id: 's-tue',
          scheduled_date: new Date('2026-09-15T10:00:00'),
          start_time: '10:00',
          end_time: '11:00',
          status: 'UPCOMING',
          task_template: { title: 'Day 2', session_duration_minutes: 60, preferred_time_of_day: null },
        },
        {
          id: 's-wed',
          scheduled_date: new Date('2026-09-16T10:00:00'),
          start_time: '10:00',
          end_time: '11:00',
          status: 'UPCOMING',
          task_template: { title: 'Day 3', session_duration_minutes: 60, preferred_time_of_day: null },
        },
      ];

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue(sessions);

      const result = await detectAndRescheduleMissed('goal-3-missed');

      expect(result.missedDetectedCount).toBe(3);
      expect(result.sameWeekReallocatedCount).toBe(0);
      expect(result.planShiftCount).toBe(0);

      expect(result.pendingRecovery?.triggered).toBe(true);
      expect(result.pendingRecovery?.tier).toBe('TIER_2_PENDING');
      expect(result.pendingRecovery?.reason).toBe('CONSECUTIVE_DAYS_MISSED');
      expect(result.pendingRecovery?.consecutiveMissedDays).toBe(3);
      expect(result.pendingRecovery?.missedSessionIds).toEqual(['s-mon', 's-tue', 's-wed']);

      // No background mutation
      expect(prisma.session.update).not.toHaveBeenCalled();
      expect(prisma.userGoal.update).not.toHaveBeenCalled();
    });

    it('clears Tier 2 pending state retroactively when an offline completion reconciles (Decision Log D8)', async () => {
      // Mon and Tue were missed, but Mon was completed offline and synced (status: 'DONE')
      const mockGoal = {
        id: 'goal-reconciled',
        slippage_days: 0,
        target_end_date: new Date('2026-12-07T00:00:00'),
        user: { availability_slots: [] },
        goal_catalog: { phases: [] },
      };

      const sessions = [
        {
          id: 's-mon-done',
          scheduled_date: new Date('2026-09-14T10:00:00'),
          start_time: '10:00',
          end_time: '11:00',
          status: 'DONE', // synced offline completion!
          task_template: { title: 'Day 1', session_duration_minutes: 60, preferred_time_of_day: null },
        },
        {
          id: 's-tue-missed',
          scheduled_date: new Date('2026-09-15T10:00:00'),
          start_time: '10:00',
          end_time: '11:00',
          status: 'UPCOMING', // only 1 day missed!
          task_template: { title: 'Day 2', session_duration_minutes: 60, preferred_time_of_day: null },
        },
      ];

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue(sessions);
      (prisma.session.update as any).mockResolvedValue({});

      const result = await detectAndRescheduleMissed('goal-reconciled');

      // Mon being DONE broke the streak, so only 1 missed day (Tier 1 silent reallocation)
      expect(result.missedDetectedCount).toBe(1);
      expect(result.sameWeekReallocatedCount).toBe(1);
      expect(result.pendingRecovery?.triggered).toBe(false);
      expect(result.pendingRecovery?.tier).toBe('TIER_1_SILENT');
    });

    it('forces rescheduling when forceRescheduleSessionId is specified', async () => {
      // Future session that normally would not be rescheduled
      const futureSession = {
        id: 's-forced',
        scheduled_date: new Date('2026-09-17T10:00:00'), // tomorrow
        start_time: '10:00',
        end_time: '11:00',
        status: 'UPCOMING',
        task_template: {
          title: 'Forced Move',
          session_duration_minutes: 60,
          preferred_time_of_day: null,
        },
      };

      const mockGoal = {
        id: 'goal-force',
        slippage_days: 0,
        target_end_date: new Date('2026-12-07T00:00:00'),
        user: { availability_slots: [] },
        goal_catalog: { phases: [] },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.findMany as any).mockResolvedValue([futureSession]);
      (prisma.session.update as any).mockResolvedValue({});

      const result = await detectAndRescheduleMissed('goal-force', 's-forced');

      expect(result.missedDetectedCount).toBe(1);
      expect(result.rescheduledCount).toBe(1);
      expect(result.actions[0].sessionId).toBe('s-forced');
    });
  });
});
