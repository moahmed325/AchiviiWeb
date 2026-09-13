import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  subtractIntervals,
  getPreferredWindow,
  determineSessionTier,
  generateThreeMonthSchedule,
  materializeWeekForGoal,
  type TimeInterval,
} from '../src/lib/scheduler.js';
import {
  calculateConsecutiveMissedDays,
  detectAndRescheduleMissed,
} from '../src/lib/rescheduler.js';
import {
  getPendingRecoveryState,
  shrinkWeekForGoal,
  shiftTimelineForGoal,
  executeRecoveryAction,
} from '../src/lib/recovery.js';
import {
  validateRoadmapVariant,
  getDeterministicFallbackRoadmaps,
  type RoadmapVariant,
  type UserConstraints,
} from '../src/lib/planner.js';
import { SessionTier } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

// Mock Prisma for deterministic algorithmic testing
vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    userGoal: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    session: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    roadmap: {
      findUnique: vi.fn(),
    },
    recoveryEvent: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('90-Day Scheduling Engine: Algorithmic Mechanics & Constraint Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* =========================================================================
   * 1. MATHEMATICAL FORMULAS & TIER RATIOS
   * ========================================================================= */
  describe('Mathematical Formulas: Tier Allocation & Dynamic Buffer Ratios', () => {
    it('accurately partitions single session to 100% core tier', () => {
      expect(determineSessionTier(0, 1)).toBe(SessionTier.core);
    });

    it('accurately partitions 2 sessions to 50% core and 50% buffer', () => {
      expect(determineSessionTier(0, 2)).toBe(SessionTier.core);
      expect(determineSessionTier(1, 2)).toBe(SessionTier.buffer);
    });

    it('accurately partitions 3 sessions to 1 core, 1 buffer, 1 reflect', () => {
      expect(determineSessionTier(0, 3)).toBe(SessionTier.core);
      expect(determineSessionTier(1, 3)).toBe(SessionTier.buffer);
      expect(determineSessionTier(2, 3)).toBe(SessionTier.reflect);
    });

    it('accurately partitions 4 sessions to 50% core, 25% buffer, 25% reflect', () => {
      expect(determineSessionTier(0, 4)).toBe(SessionTier.core);
      expect(determineSessionTier(1, 4)).toBe(SessionTier.core);
      expect(determineSessionTier(2, 4)).toBe(SessionTier.buffer);
      expect(determineSessionTier(3, 4)).toBe(SessionTier.reflect);
    });

    it('applies ~45% core, ~35% buffer, ~20% reflect formula for N >= 5 sessions', () => {
      // For N = 5:
      // coreCount = Math.max(1, Math.round(5 * 0.45)) = 2 (indices 0, 1)
      // reflectCount = Math.max(1, Math.round(5 * 0.20)) = 1 (index 4)
      // buffer = remaining (indices 2, 3)
      const tiersN5 = [0, 1, 2, 3, 4].map((i) => determineSessionTier(i, 5));
      expect(tiersN5).toEqual([
        SessionTier.core,
        SessionTier.core,
        SessionTier.buffer,
        SessionTier.buffer,
        SessionTier.reflect,
      ]);

      // For N = 6:
      // coreCount = Math.round(6 * 0.45) = 3 (indices 0, 1, 2)
      // reflectCount = Math.round(6 * 0.20) = 1 (index 5)
      // buffer = indices 3, 4
      const tiersN6 = [0, 1, 2, 3, 4, 5].map((i) => determineSessionTier(i, 6));
      expect(tiersN6).toEqual([
        SessionTier.core,
        SessionTier.core,
        SessionTier.core,
        SessionTier.buffer,
        SessionTier.buffer,
        SessionTier.reflect,
      ]);
    });
  });

  /* =========================================================================
   * 2. INTERVAL SUBTRACTION & TIME-SLOT PLACEMENT ALGEBRA
   * ========================================================================= */
  describe('Interval Subtraction Algebra & Operating Windows', () => {
    it('subtracts busy blocks leaving clean remaining openings', () => {
      const openings: TimeInterval[] = [{ start: 7 * 60, end: 22 * 60 }]; // 07:00 - 22:00 (15 hrs)
      const busyJob: TimeInterval = { start: 9 * 60, end: 17 * 60 };      // 09:00 - 17:00 (8 hrs)

      const free = subtractIntervals(openings, busyJob);
      expect(free).toEqual([
        { start: 7 * 60, end: 9 * 60 },   // Morning: 07:00 - 09:00 (120m)
        { start: 17 * 60, end: 22 * 60 }, // Evening: 17:00 - 22:00 (300m)
      ]);
    });

    it('filters out unusable sliver fragments strictly under 15 minutes', () => {
      const openings: TimeInterval[] = [{ start: 600, end: 720 }]; // 10:00 - 12:00
      const busyLeaving14m: TimeInterval = { start: 600, end: 706 }; // leaves 14m (706-720)
      expect(subtractIntervals(openings, busyLeaving14m)).toEqual([]);

      const busyLeaving15m: TimeInterval = { start: 600, end: 705 }; // leaves exactly 15m (705-720)
      expect(subtractIntervals(openings, busyLeaving15m)).toEqual([{ start: 705, end: 720 }]);
    });

    it('correctly maps preferred time of day windows', () => {
      expect(getPreferredWindow('morning')).toEqual({ start: 420, end: 720 });     // 07:00 - 12:00
      expect(getPreferredWindow('afternoon')).toEqual({ start: 720, end: 1020 });  // 12:00 - 17:00
      expect(getPreferredWindow('evening')).toEqual({ start: 1020, end: 1290 });   // 17:00 - 21:30
      expect(getPreferredWindow(null)).toEqual({ start: 420, end: 1320 });         // 07:00 - 22:00 baseline
    });
  });

  /* =========================================================================
   * 3. END-TO-END BLUEPRINT GENERATION ACROSS 12 WEEKS
   * ========================================================================= */
  describe('End-to-End Blueprint to 12-Week (90-Day) Calendar Plan', () => {
    it('generates structured sessions across Weeks 1–4, 5–8, and 9–12', async () => {
      const mockGoal = {
        id: 'goal-saas-101',
        start_date: new Date('2026-10-01T00:00:00Z'),
        target_end_date: new Date('2026-12-24T00:00:00Z'),
        selected_roadmap_id: null,
        user: {
          timezone: 'UTC',
          availability_slots: [
            { day_of_week: 'MON', start_time: '09:00', end_time: '17:00' },
            { day_of_week: 'TUE', start_time: '09:00', end_time: '17:00' },
            { day_of_week: 'WED', start_time: '09:00', end_time: '17:00' },
            { day_of_week: 'THU', start_time: '09:00', end_time: '17:00' },
            { day_of_week: 'FRI', start_time: '09:00', end_time: '17:00' },
          ],
        },
        goal_catalog: {
          title: 'Build & Launch a SaaS MVP',
          phases: [
            {
              id: 'phase-1',
              phase_order: 1,
              title: 'Phase 1: Foundation & Core Backend',
              duration_weeks: 4,
              task_templates: [
                {
                  id: 'task-1-backend',
                  title: 'Data Architecture & API Design',
                  sessions_per_week: 3,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'evening',
                },
                {
                  id: 'task-1-auth',
                  title: 'Authentication & Security Engine',
                  sessions_per_week: 2,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
            {
              id: 'phase-2',
              phase_order: 2,
              title: 'Phase 2: Interactive Frontend & User Flows',
              duration_weeks: 4,
              task_templates: [
                {
                  id: 'task-2-ui',
                  title: 'Dashboard Layout & Core Feature UI',
                  sessions_per_week: 3,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
            {
              id: 'phase-3',
              phase_order: 3,
              title: 'Phase 3: Testing, Billing & Product Launch',
              duration_weeks: 4,
              task_templates: [
                {
                  id: 'task-3-launch',
                  title: 'Landing Page & Launch',
                  sessions_per_week: 2,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          ],
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 0 });

      let createdSessions: any[] = [];
      (prisma.session.createMany as any).mockImplementation(({ data }: { data: any[] }) => {
        createdSessions = data;
        return Promise.resolve({ count: data.length });
      });

      const totalCount = await generateThreeMonthSchedule('goal-saas-101');

      // Verify total count matches expected 12-week schedule:
      // Phase 1 (Weeks 1-4 = 4 weeks): 5 sessions/week * 4 = 20 sessions
      // Phase 2 (Weeks 5-8 = 4 weeks): 3 sessions/week * 4 = 12 sessions
      // Phase 3 (Weeks 9-12 = 4 weeks): 2 sessions/week * 4 = 8 sessions
      // Total = 40 sessions
      expect(totalCount).toBe(40);
      expect(createdSessions.length).toBe(40);

      // Verify sequence order is 1-indexed and strictly monotonic
      for (let i = 0; i < createdSessions.length; i++) {
        expect(createdSessions[i].sequence_order).toBe(i + 1);
      }

      // Verify Phase 1 (first 4 weeks: day_numbers 0 to 27) contains tasks 1 and 2
      const phase1Sessions = createdSessions.filter((s) => s.day_number < 28);
      expect(phase1Sessions.length).toBe(20);
      expect(phase1Sessions.every((s) => ['task-1-backend', 'task-1-auth'].includes(s.task_template_id))).toBe(true);

      // Verify Phase 2 (weeks 5 to 8: day_numbers 28 to 55) contains task 2
      const phase2Sessions = createdSessions.filter((s) => s.day_number >= 28 && s.day_number < 56);
      expect(phase2Sessions.length).toBe(12);
      expect(phase2Sessions.every((s) => s.task_template_id === 'task-2-ui')).toBe(true);

      // Verify Phase 3 (weeks 9 to 12: day_numbers 56 to 83) contains task 3
      const phase3Sessions = createdSessions.filter((s) => s.day_number >= 56);
      expect(phase3Sessions.length).toBe(8);
      expect(phase3Sessions.every((s) => s.task_template_id === 'task-3-launch')).toBe(true);

      // Verify Week 1 (rolling current week) has materialized dates and times
      const week1Sessions = createdSessions.filter((s) => s.day_number < 7);
      expect(week1Sessions.every((s) => s.scheduled_date !== null && s.start_time !== null && s.end_time !== null)).toBe(true);

      // Verify future weeks remain lightweight/unmaterialized until rolling activation
      const futureSessions = createdSessions.filter((s) => s.day_number >= 7);
      expect(futureSessions.every((s) => s.scheduled_date === null && s.start_time === null)).toBe(true);
    });
  });

  /* =========================================================================
   * 4. RUNTIME ADAPTATION & RECOVERY MECHANICS
   * ========================================================================= */
  describe('Runtime Adaptation: Missed Session Detection & Circuit Breaker', () => {
    it('calculates consecutive missed days correctly looking backwards', () => {
      const allSessions = [
        { scheduled_date: '2026-09-08', status: 'DONE', end_time: '18:00' },
        { scheduled_date: '2026-09-09', status: 'MISSED', end_time: '18:00' },
        { scheduled_date: '2026-09-10', status: 'MISSED', end_time: '18:00' },
      ];

      const count = calculateConsecutiveMissedDays(allSessions, '2026-09-10', 1200, 'UTC');
      expect(count).toBe(2);
    });

    it('triggers Tier 2 Pending Recovery when consecutive missed days >= 3', async () => {
      const mockGoal = {
        id: 'user-goal-tier2',
        slippage_days: 0,
        user: { timezone: 'UTC', availability_slots: [] },
        goal_catalog: { phases: [] },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const pastSessions = [
        {
          id: 's-1',
          scheduled_date: new Date('2026-09-07T12:00:00Z'),
          status: 'MISSED',
          end_time: '18:00',
          task_template: { session_duration_minutes: 60, preferred_time_of_day: 'morning' },
        },
        {
          id: 's-2',
          scheduled_date: new Date('2026-09-08T12:00:00Z'),
          status: 'MISSED',
          end_time: '18:00',
          task_template: { session_duration_minutes: 60, preferred_time_of_day: 'morning' },
        },
        {
          id: 's-3',
          scheduled_date: new Date('2026-09-09T12:00:00Z'),
          status: 'MISSED',
          end_time: '18:00',
          task_template: { session_duration_minutes: 60, preferred_time_of_day: 'morning' },
        },
      ];

      (prisma.session.findMany as any).mockResolvedValue(pastSessions);

      const result = await detectAndRescheduleMissed('user-goal-tier2');
      expect(result.pendingRecovery?.triggered).toBe(true);
      expect(result.pendingRecovery?.tier).toBe('TIER_2_PENDING');
      expect(result.pendingRecovery?.reason).toBe('CONSECUTIVE_DAYS_MISSED');
      expect(result.pendingRecovery?.consecutiveMissedDays).toBeGreaterThanOrEqual(3);
    });

    it('triggers circuit breaker when 2 prior recovery events exist in 28-day window', async () => {
      const mockGoal = {
        id: 'goal-circuit-breaker',
        user: { timezone: 'UTC', availability_slots: [] },
        goal_catalog: { phases: [] },
        slippage_days: 7,
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      // Simulate 2 prior events within 28 days -> current state is 3rd event
      (prisma.recoveryEvent.count as any).mockResolvedValue(2);

      // detectAndRescheduleMissed triggers Tier 2
      (prisma.session.findMany as any).mockResolvedValue([
        {
          id: 's-past',
          scheduled_date: new Date('2026-09-01T12:00:00Z'),
          status: 'MISSED',
          end_time: '18:00',
          task_template: { session_duration_minutes: 60, preferred_time_of_day: 'morning' },
        },
      ]);

      const state = await getPendingRecoveryState('goal-circuit-breaker');
      expect(state.circuit_breaker_active).toBe(true);
      expect(state.options).toEqual(['scope_reduction', 'pause_goal']);
    });

    it('shrink_week drops buffer sessions first and protects core sessions', async () => {
      const mockGoal = {
        id: 'goal-shrink',
        start_date: new Date('2026-09-01T00:00:00Z'),
        user: { timezone: 'UTC', availability_slots: [] },
        goal_catalog: { phases: [] },
      };
      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const weekSessions = [
        { id: 's-core-1', tier: 'core', status: 'UPCOMING' },
        { id: 's-buffer-1', tier: 'buffer', status: 'UPCOMING' },
        { id: 's-reflect-1', tier: 'reflect', status: 'UPCOMING' },
      ];
      (prisma.session.findMany as any).mockResolvedValue(weekSessions);
      (prisma.session.update as any).mockResolvedValue({});

      const shrinkResult = await shrinkWeekForGoal('goal-shrink', 0);

      // Must drop buffer session first
      expect(shrinkResult.droppedSessions).toEqual(['s-buffer-1']);
      // Verify core session was untouched
      expect(shrinkResult.droppedSessions).not.toContain('s-core-1');
    });

    it('shift_timeline updates plan offset and increments slippage days in O(1)', async () => {
      const mockGoal = {
        id: 'goal-shift',
        current_plan_day_offset: 0,
        target_end_date: new Date('2026-11-24T00:00:00Z'),
        slippage_days: 0,
      };
      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.userGoal.update as any).mockResolvedValue({});
      (prisma.session.updateMany as any).mockResolvedValue({ count: 2 });

      const shiftResult = await shiftTimelineForGoal('goal-shift', 7);

      expect(shiftResult.newOffset).toBe(7);
      expect(shiftResult.newSlippageDays).toBe(7);
      expect(shiftResult.newTargetEndDate.getTime()).toBe(
        new Date('2026-11-24T00:00:00Z').getTime() + 7 * 24 * 60 * 60 * 1000
      );
    });
  });
});
