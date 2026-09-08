import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPendingRecoveryState,
  shrinkWeekForGoal,
  shiftTimelineForGoal,
  executeRecoveryAction,
} from '../src/lib/recovery.js';
import { prisma } from '../src/lib/prisma.js';

// Mock prisma client
vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      userGoal: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      session: {
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      recoveryEvent: {
        count: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      availabilitySlot: {
        findMany: vi.fn(),
      },
    },
  };
});

describe('Phase 2 Recovery System (Tasks 4, 5, 6, 8, 9)', () => {
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

  describe('getPendingRecoveryState & Lapse Circuit Breaker', () => {
    it('returns pending: false when no recovery is triggered and 0 recovery events', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        user_id: 'user-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.session.findMany as any).mockResolvedValue([]);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      const result = await getPendingRecoveryState('goal-1');
      expect(result.pending).toBe(false);
      expect(result.rolling_28_day_events).toBe(0);
      expect(result.circuit_breaker_active).toBe(false);
    });

    it('triggers circuit breaker when exactly 2 prior recovery events exist in 28 days (making this the 3rd)', async () => {
      freezeTime(new Date('2026-09-04T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        user_id: 'user-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [
          {
            id: 's-1',
            scheduled_date: new Date('2026-09-01T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
          {
            id: 's-2',
            scheduled_date: new Date('2026-09-02T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
          {
            id: 's-3',
            scheduled_date: new Date('2026-09-03T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
        ],
        availability_slots: [],
      });

      // Exactly 2 events in rolling 28-day window
      (prisma.recoveryEvent.count as any).mockResolvedValue(2);
      (prisma.session.findMany as any).mockResolvedValue([
        {
          id: 's-1',
          scheduled_date: new Date('2026-09-01T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
        {
          id: 's-2',
          scheduled_date: new Date('2026-09-02T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
        {
          id: 's-3',
          scheduled_date: new Date('2026-09-03T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
      ]);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      const result = await getPendingRecoveryState('goal-1');
      expect(result.pending).toBe(true);
      expect(result.tier).toBe('TIER_2_PENDING');
      expect(result.reason).toBe('CONSECUTIVE_DAYS_MISSED');
      expect(result.rolling_28_day_events).toBe(2);
      expect(result.circuit_breaker_active).toBe(true);
      expect(result.options).toEqual(['scope_reduction', 'pause_goal']);
    });

    it('clears Tier 2 pending state retroactively if offline completions broke the consecutive lapse streak', async () => {
      freezeTime(new Date('2026-09-04T12:00:00.000Z'));

      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        user_id: 'user-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        status: 'ACTIVE',
        slippage_days: 0,
        current_plan_day_offset: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        sessions: [
          {
            id: 's-1',
            scheduled_date: new Date('2026-09-01T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
          {
            // Reconciled offline completion on day 2!
            id: 's-2',
            scheduled_date: new Date('2026-09-02T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'DONE',
            completed_at_utc: new Date('2026-09-02T08:50:00.000Z'),
            tier: 'core',
          },
          {
            id: 's-3',
            scheduled_date: new Date('2026-09-03T08:00:00.000Z'),
            start_time: '08:00',
            end_time: '09:00',
            status: 'UPCOMING',
            tier: 'core',
          },
        ],
        availability_slots: [],
      });

      (prisma.recoveryEvent.count as any).mockResolvedValue(0);
      (prisma.session.findMany as any).mockResolvedValue([
        {
          id: 's-1',
          scheduled_date: new Date('2026-09-01T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
        {
          id: 's-3',
          scheduled_date: new Date('2026-09-03T08:00:00.000Z'),
          start_time: '08:00',
          end_time: '09:00',
          status: 'UPCOMING',
          tier: 'core',
          task_template: { session_duration_minutes: 60 },
        },
      ]);
      (prisma.availabilitySlot.findMany as any).mockResolvedValue([]);

      const result = await getPendingRecoveryState('goal-1');
      // Because Day 2 was DONE, streak is broken and pending recovery is cleared!
      expect(result.pending).toBe(false);
    });
  });

  describe('shrinkWeekForGoal (Task 5 & Guardrail 3)', () => {
    it('drops buffer-tier sessions first and preserves core-tier sessions', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        user: { timezone: 'UTC', availability_slots: [] },
      });

      // Current week has 1 core, 1 buffer, 1 reflect
      (prisma.session.findMany as any).mockResolvedValue([
        { id: 'session-core', tier: 'core', status: 'UPCOMING' },
        { id: 'session-buffer', tier: 'buffer', status: 'UPCOMING' },
        { id: 'session-reflect', tier: 'reflect', status: 'UPCOMING' },
      ]);

      (prisma.session.update as any).mockResolvedValue({});

      const result = await shrinkWeekForGoal('goal-1', 0);

      // Must have dropped buffer session
      expect(result.droppedSessions).toContain('session-buffer');
      // Must NOT have dropped core session
      expect(result.droppedSessions).not.toContain('session-core');
      // Reflect was not dropped because buffer was sufficient
      expect(result.droppedSessions).not.toContain('session-reflect');

      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-buffer' },
        data: { status: 'RESCHEDULED' },
      });
    });

    it('drops reflect-tier sessions if no buffer sessions exist, but NEVER touches core sessions', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        user: { timezone: 'UTC', availability_slots: [] },
      });

      // Current week only has core and reflect
      (prisma.session.findMany as any).mockResolvedValue([
        { id: 'session-core-1', tier: 'core', status: 'UPCOMING' },
        { id: 'session-core-2', tier: 'core', status: 'UPCOMING' },
        { id: 'session-reflect', tier: 'reflect', status: 'UPCOMING' },
      ]);

      (prisma.session.update as any).mockResolvedValue({});

      const result = await shrinkWeekForGoal('goal-1', 0);

      expect(result.droppedSessions).toEqual(['session-reflect']);
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-reflect' },
        data: { status: 'RESCHEDULED' },
      });
    });
  });

  describe('shiftTimelineForGoal (Task 6 & Guardrail 3)', () => {
    it('performs an O(1) increment on current_plan_day_offset and target_end_date', async () => {
      const initialTargetEnd = new Date('2026-11-24T00:00:00.000Z');
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        current_plan_day_offset: 0,
        target_end_date: initialTargetEnd,
        slippage_days: 0,
      });

      (prisma.userGoal.update as any).mockResolvedValue({});
      (prisma.session.updateMany as any).mockResolvedValue({ count: 2 });

      const result = await shiftTimelineForGoal('goal-1', 7);

      expect(result.newOffset).toBe(7);
      expect(result.newSlippageDays).toBe(7);
      expect(result.newTargetEndDate.getTime()).toBe(
        initialTargetEnd.getTime() + 7 * 24 * 60 * 60 * 1000
      );

      // Single O(1) update on userGoal
      expect(prisma.userGoal.update).toHaveBeenCalledTimes(1);
      expect(prisma.userGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-1' },
        data: {
          current_plan_day_offset: 7,
          target_end_date: expect.any(Date),
          slippage_days: 7,
        },
      });

      // Marks missed sessions as RESCHEDULED
      expect(prisma.session.updateMany).toHaveBeenCalledWith({
        where: { user_goal_id: 'goal-1', status: 'MISSED' },
        data: { status: 'RESCHEDULED' },
      });
    });
  });

  describe('executeRecoveryAction (Tasks 4, 5, 6, 8, 9)', () => {
    it('creates a RecoveryEvent when executing shrink_week', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        start_date: new Date('2026-09-01T00:00:00.000Z'),
        user: { timezone: 'UTC', availability_slots: [] },
      });

      (prisma.session.findMany as any).mockResolvedValue([
        { id: 'session-buffer', tier: 'buffer', status: 'UPCOMING' },
      ]);
      (prisma.session.update as any).mockResolvedValue({});

      (prisma.recoveryEvent.create as any).mockResolvedValue({
        id: 'event-1',
        user_goal_id: 'goal-1',
        trigger_condition: 'TIER_2_PENDING',
        user_choice: 'shrink_week',
        resulting_adjustment: {},
      });

      const res = await executeRecoveryAction('goal-1', 'shrink_week', { weekOffset: 0 });
      expect(res.success).toBe(true);
      expect(res.choice).toBe('shrink_week');
      expect(prisma.recoveryEvent.create).toHaveBeenCalledWith({
        data: {
          user_goal_id: 'goal-1',
          trigger_condition: 'TIER_2_PENDING',
          user_choice: 'shrink_week',
          resulting_adjustment: expect.objectContaining({
            action: 'shrink_week',
            dropped_sessions: ['session-buffer'],
          }),
        },
      });
    });

    it('creates a RecoveryEvent when executing shift_timeline', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        current_plan_day_offset: 0,
        target_end_date: new Date('2026-11-24T00:00:00.000Z'),
        slippage_days: 0,
      });
      (prisma.userGoal.update as any).mockResolvedValue({});
      (prisma.session.updateMany as any).mockResolvedValue({ count: 1 });

      (prisma.recoveryEvent.create as any).mockResolvedValue({
        id: 'event-2',
        user_goal_id: 'goal-1',
        trigger_condition: 'TIER_2_PENDING',
        user_choice: 'shift_timeline',
        resulting_adjustment: {},
      });

      const res = await executeRecoveryAction('goal-1', 'shift_timeline');
      expect(res.success).toBe(true);
      expect(res.choice).toBe('shift_timeline');
      expect(prisma.recoveryEvent.create).toHaveBeenCalledWith({
        data: {
          user_goal_id: 'goal-1',
          trigger_condition: 'TIER_2_PENDING',
          user_choice: 'shift_timeline',
          resulting_adjustment: expect.objectContaining({
            action: 'shift_timeline',
            offset_increment: 7,
            new_offset: 7,
          }),
        },
      });
    });

    it('creates a RecoveryEvent and updates goal status for pause_goal on circuit breaker', async () => {
      (prisma.userGoal.findUnique as any).mockResolvedValue({
        id: 'goal-1',
        status: 'ACTIVE',
      });
      (prisma.userGoal.update as any).mockResolvedValue({});

      (prisma.recoveryEvent.create as any).mockResolvedValue({
        id: 'event-3',
        user_goal_id: 'goal-1',
        trigger_condition: 'CIRCUIT_BREAKER',
        user_choice: 'pause_goal',
        resulting_adjustment: {},
      });

      const res = await executeRecoveryAction('goal-1', 'pause_goal');
      expect(res.success).toBe(true);
      expect(res.choice).toBe('pause_goal');
      expect(prisma.userGoal.update).toHaveBeenCalledWith({
        where: { id: 'goal-1' },
        data: { status: 'PAUSED' },
      });
      expect(prisma.recoveryEvent.create).toHaveBeenCalledWith({
        data: {
          user_goal_id: 'goal-1',
          trigger_condition: 'CIRCUIT_BREAKER',
          user_choice: 'pause_goal',
          resulting_adjustment: {
            action: 'pause_goal',
            status: 'PAUSED',
          },
        },
      });
    });
  });
});
