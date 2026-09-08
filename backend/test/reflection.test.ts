import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateWeekCompletionRate,
  getPendingWeeklyReflection,
  submitWeeklyReflection,
  FULL_REFLECTION_QUESTIONS,
} from '../src/lib/reflection.js';
import { prisma } from '../src/lib/prisma.js';

// Mock prisma
vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      userGoal: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      session: {
        findMany: vi.fn(),
      },
      recoveryEvent: {
        count: vi.fn(),
      },
      availabilitySlot: {
        findMany: vi.fn(),
      },
      weeklyReview: {
        upsert: vi.fn(),
      },
    },
  };
});

describe('Phase 3 Weekly Reflection (Tasks 2, 3, 4, 5)', () => {
  const RealDate = globalThis.Date;

  function freezeTime(targetDate: Date) {
    if (typeof vi.useFakeTimers === 'function' && typeof vi.setSystemTime === 'function') {
      try {
        vi.useFakeTimers();
        vi.setSystemTime(targetDate);
      } catch (_) {}
    }
    const customDate = class extends RealDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(targetDate.getTime());
        } else {
          // @ts-expect-error spread constructor
          super(...args);
        }
      }
      static now() {
        return targetDate.getTime();
      }
    };
    globalThis.Date = customDate as any;
  }

  function unfreezeTime() {
    if (typeof vi.useRealTimers === 'function') {
      try {
        vi.useRealTimers();
      } catch (_) {}
    }
    globalThis.Date = RealDate;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    unfreezeTime();
  });

  describe('calculateWeekCompletionRate', () => {
    it('calculates 100% completion rate when all sessions are DONE', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        user: { timezone: 'UTC' },
      });

      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'DONE' },
        { id: 's3', status: 'DONE' },
      ]);

      const res = await calculateWeekCompletionRate('goal-1', 0);
      expect(res.total).toBe(3);
      expect(res.completed).toBe(3);
      expect(res.rate).toBe(1.0);
    });

    it('calculates accurate percentage when partial sessions are completed', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        user: { timezone: 'UTC' },
      });

      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'MISSED' },
        { id: 's3', status: 'DONE' },
        { id: 's4', status: 'UPCOMING' },
      ]);

      const res = await calculateWeekCompletionRate('goal-1', 0);
      expect(res.total).toBe(4);
      expect(res.completed).toBe(2);
      expect(res.rate).toBe(0.5);
    });
  });

  describe('getPendingWeeklyReflection', () => {
    it('returns pending: false if user is still in Week 1 (no completed past week)', async () => {
      // 3 days into goal
      freezeTime(new Date('2026-09-04T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [],
        weekly_reviews: [],
      });
      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.session.findMany as any).mockResolvedValue([]);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      const result = await getPendingWeeklyReflection('goal-1');
      expect(result.pending).toBe(false);
    });

    it('defers reflection when a Tier 2 recovery check-in is pending (Guardrail 3 Precedence)', async () => {
      // 9 days into goal (Week 1 has ended, Week 2 is in progress)
      freezeTime(new Date('2026-09-10T12:00:00.000Z'));

      // Setup 3 consecutive missed days to trigger Tier 2 recovery
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [
          {
            id: 's-1',
            scheduled_date: new Date('2026-09-07T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
          {
            id: 's-2',
            scheduled_date: new Date('2026-09-08T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
          {
            id: 's-3',
            scheduled_date: new Date('2026-09-09T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
        ],
        weekly_reviews: [],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.session.findMany as any).mockResolvedValue([
        {
          id: 's-1',
          scheduled_date: new Date('2026-09-07T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
        {
          id: 's-2',
          scheduled_date: new Date('2026-09-08T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
        {
          id: 's-3',
          scheduled_date: new Date('2026-09-09T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
      ]);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      const result = await getPendingWeeklyReflection('goal-1');
      // Recovery check-in takes precedence: reflection is deferred!
      expect(result.pending).toBe(false);
      expect(result.deferred).toBe(true);
      expect(result.defer_reason).toBe('RECOVERY_CHECKIN_PENDING');
    });

    it('defaults to single_tap on Week 1 even if completion rate is below 70% (Guardrail 4 Baseline)', async () => {
      // 8 days into goal: Week 1 finished
      freezeTime(new Date('2026-09-09T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [],
        weekly_reviews: [],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      // Week 1 had 4 sessions, only 1 done (25% completion rate)
      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'MISSED' },
        { id: 's3', status: 'MISSED' },
        { id: 's4', status: 'MISSED' },
      ]);

      const result = await getPendingWeeklyReflection('goal-1');
      expect(result.pending).toBe(true);
      expect(result.week_number).toBe(1);
      expect(result.completion_rate).toBe(0.25);
      // Week 1 MUST default to single_tap!
      expect(result.reflection_type).toBe('single_tap');
      expect(result.prompt_copy?.headline).toBe('Week 1 Check-in');
    });

    it('serves single_tap on Week 2 when completion rate is >= 70%', async () => {
      // 15 days into goal: Week 1 and Week 2 finished
      freezeTime(new Date('2026-09-16T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [],
        // Week 1 was already reviewed
        weekly_reviews: [{ id: 'rev-1', week_number: 1 }],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      // Week 2 had 4 sessions, 3 done (75% completion rate >= 70%)
      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'DONE' },
        { id: 's3', status: 'DONE' },
        { id: 's4', status: 'MISSED' },
      ]);

      const result = await getPendingWeeklyReflection('goal-1');
      expect(result.pending).toBe(true);
      expect(result.week_number).toBe(2);
      expect(result.completion_rate).toBe(0.75);
      expect(result.reflection_type).toBe('single_tap');
      expect(result.prompt_copy?.headline).toBe('Week 2 Check-in');
    });

    it('serves full 4-question reflection on Week 2 when completion rate is < 70%', async () => {
      // 15 days into goal: Week 1 and Week 2 finished
      freezeTime(new Date('2026-09-16T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [],
        // Week 1 was already reviewed
        weekly_reviews: [{ id: 'rev-1', week_number: 1 }],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      // Week 2 had 4 sessions, only 2 done (50% completion rate < 70%)
      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'DONE' },
        { id: 's3', status: 'MISSED' },
        { id: 's4', status: 'MISSED' },
      ]);

      const result = await getPendingWeeklyReflection('goal-1');
      expect(result.pending).toBe(true);
      expect(result.week_number).toBe(2);
      expect(result.completion_rate).toBe(0.5);
      expect(result.reflection_type).toBe('full');
      expect(result.questions).toHaveLength(4);
      expect(result.questions).toEqual(FULL_REFLECTION_QUESTIONS);
    });

    it('returns pending: false if all completed weeks have already been reviewed', async () => {
      // 15 days into goal: Week 1 & 2 completed
      freezeTime(new Date('2026-09-16T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [],
        // Both weeks reviewed
        weekly_reviews: [
          { id: 'rev-1', week_number: 1 },
          { id: 'rev-2', week_number: 2 },
        ],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.session.findMany as any).mockResolvedValue([]);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      const result = await getPendingWeeklyReflection('goal-1');
      expect(result.pending).toBe(false);
    });
  });

  describe('submitWeeklyReflection', () => {
    it('persists weekly review with completion rate and responses', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        user: { timezone: 'UTC' },
      });

      (prisma.session.findMany as any).mockResolvedValue([
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'DONE' },
        { id: 's3', status: 'DONE' },
      ]);

      (prisma.weeklyReview.upsert as any).mockResolvedValue({
        id: 'rev-1',
        user_goal_id: 'goal-1',
        week_number: 2,
        completion_rate: 1.0,
        reflection_type: 'single_tap',
        reflection_responses: { confirm: true },
      });

      const res = await submitWeeklyReflection('goal-1', 2, 'single_tap', { confirm: true });
      expect(res.success).toBe(true);
      expect(prisma.weeklyReview.upsert).toHaveBeenCalledWith({
        where: {
          user_goal_id_week_number: {
            user_goal_id: 'goal-1',
            week_number: 2,
          },
        },
        update: {
          completion_rate: 1.0,
          reflection_type: 'single_tap',
          reflection_responses: { confirm: true },
        },
        create: {
          user_goal_id: 'goal-1',
          week_number: 2,
          completion_rate: 1.0,
          reflection_type: 'single_tap',
          reflection_responses: { confirm: true },
        },
      });
    });
  });
});
