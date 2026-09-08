import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateGraduationEligibility,
  handleGraduationChoice,
  resumePausedGoal,
} from '../src/lib/graduation.js';
import {
  aggregateUserProfile,
  getOnboardingLearnedDefaults,
} from '../src/lib/profile.js';
import { prisma } from '../src/lib/prisma.js';

// Mock prisma
vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      userGoal: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
      },
    },
  };
});

describe('Phase 5 Graduation & Profile Learning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Graduation Trigger Math (§4.9 & Guardrail 1)', () => {
    it('returns eligible: false early in plan (Day 10, 74 days remaining)', async () => {
      const startDate = new Date('2026-03-01T00:00:00.000Z');
      const now = new Date('2026-03-11T00:00:00.000Z'); // 10 days in

      const mockGoal = {
        id: 'goal-early',
        user_id: 'user-1',
        status: 'ACTIVE',
        start_date: startDate,
        slippage_days: 0,
        current_plan_day_offset: 0,
        goal_catalog: { title: 'Learn Python' },
        sessions: [
          { status: 'DONE' },
          { status: 'UPCOMING' },
        ],
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const state = await evaluateGraduationEligibility('goal-early', now);

      expect(state.eligible).toBe(false);
      expect(state.elapsed_days).toBe(10);
      expect(state.remaining_plan_days).toBe(74);
      expect(state.options).toHaveLength(0);
    });

    it('triggers graduation when remaining plan days <= 15 (e.g. Day 70 with 84-day total plan)', async () => {
      const startDate = new Date('2026-03-01T00:00:00.000Z');
      const now = new Date('2026-05-10T00:00:00.000Z'); // 70 days in, 14 days remaining <= 15

      const mockGoal = {
        id: 'goal-grad-1',
        user_id: 'user-1',
        status: 'ACTIVE',
        start_date: startDate,
        slippage_days: 0,
        current_plan_day_offset: 0,
        goal_catalog: { title: 'Fullstack Mastery' },
        sessions: [
          { status: 'DONE' },
          { status: 'DONE' },
          { status: 'UPCOMING' },
        ],
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const state = await evaluateGraduationEligibility('goal-grad-1', now);

      expect(state.eligible).toBe(true);
      expect(state.remaining_plan_days).toBeLessThanOrEqual(15);
      expect(state.options).toEqual(['start_new_goal', 'maintenance_mode', 'pause']);
      expect(state.graduation_message).toContain('Fullstack Mastery');
    });

    it('triggers graduation when elapsed days >= 75 regardless of slippage extension', async () => {
      const startDate = new Date('2026-03-01T00:00:00.000Z');
      const now = new Date('2026-05-16T00:00:00.000Z'); // 76 days in (>= 75)

      const mockGoal = {
        id: 'goal-grad-2',
        user_id: 'user-1',
        status: 'ACTIVE',
        start_date: startDate,
        slippage_days: 10, // extended to 94 days, remaining 18
        current_plan_day_offset: 0,
        goal_catalog: { title: 'Marathon Run' },
        sessions: [{ status: 'DONE' }],
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const state = await evaluateGraduationEligibility('goal-grad-2', now);

      expect(state.eligible).toBe(true);
      expect(state.elapsed_days).toBeGreaterThanOrEqual(75);
      expect(state.options).toContain('start_new_goal');
    });

    it('returns eligible: false for non-active goals (PAUSED, COMPLETED, ABANDONED)', async () => {
      const mockGoal = {
        id: 'goal-completed',
        user_id: 'user-1',
        status: 'COMPLETED',
        start_date: new Date('2026-01-01'),
        goal_catalog: { title: 'Old Goal' },
        sessions: [],
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const state = await evaluateGraduationEligibility('goal-completed');
      expect(state.eligible).toBe(false);
      expect(state.options).toHaveLength(0);
    });
  });

  describe('Pause & Resume Recalculation (§4.9 & Guardrail 1)', () => {
    it('sets status to PAUSED and records paused_at timestamp', async () => {
      const mockGoal = {
        id: 'goal-pause-1',
        user_id: 'user-1',
        status: 'ACTIVE',
        goal_catalog: { title: 'Deep Learning' },
      };

      (prisma.userGoal.findFirst as any).mockResolvedValue(mockGoal);
      (prisma.userGoal.update as any).mockImplementation(async ({ data }: any) => ({
        ...mockGoal,
        ...data,
      }));

      const res = await handleGraduationChoice({
        userId: 'user-1',
        userGoalId: 'goal-pause-1',
        choice: 'pause',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('PAUSED');
      expect(prisma.userGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'goal-pause-1' },
          data: expect.objectContaining({
            status: 'PAUSED',
            paused_at: expect.any(Date),
          }),
        })
      );
    });

    it('shifts timeline and current_plan_day_offset lazily upon resume from pause', async () => {
      const pausedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // paused 10 days ago
      const originalTargetDate = new Date('2026-06-01T00:00:00.000Z');

      const mockGoal = {
        id: 'goal-resume-1',
        user_id: 'user-1',
        status: 'PAUSED',
        paused_at: pausedAt,
        target_end_date: originalTargetDate,
        current_plan_day_offset: 2,
      };

      (prisma.userGoal.findFirst as any).mockResolvedValue(mockGoal);
      (prisma.userGoal.update as any).mockImplementation(async ({ data }: any) => ({
        ...mockGoal,
        ...data,
      }));

      const resumeResult = await resumePausedGoal('user-1', 'goal-resume-1');

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.days_paused).toBe(10);
      expect(prisma.userGoal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'goal-resume-1' },
          data: expect.objectContaining({
            status: 'ACTIVE',
            paused_at: null,
            current_plan_day_offset: 12, // 2 + 10
          }),
        })
      );
    });
  });

  describe('Continuous Profile Learning (§4.10 & Guardrail 2)', () => {
    it('aggregates best_working_hours from completed sessions timestamps', async () => {
      const mockUser = {
        id: 'user-learner',
        timezone: 'America/New_York',
        user_goals: [
          {
            sessions: [
              // Morning completions: 09:00 NY time
              {
                status: 'DONE',
                completed_at_utc: '2026-03-02T14:00:00.000Z', // 09:00 AM EST (Mon)
                task_template: { session_duration_minutes: 60 },
              },
              {
                status: 'DONE',
                completed_at_utc: '2026-03-03T14:00:00.000Z', // 09:00 AM EST (Tue)
                task_template: { session_duration_minutes: 60 },
              },
              {
                status: 'DONE',
                completed_at_utc: '2026-03-04T15:00:00.000Z', // 10:00 AM EST (Wed)
                task_template: { session_duration_minutes: 60 },
              },
            ],
            recovery_events: [
              {
                trigger_condition: 'CONSECUTIVE_DAYS_MISSED',
                user_choice: 'shrink_week',
                resulting_adjustment: {},
              },
            ],
          },
        ],
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.user.update as any).mockResolvedValue(mockUser);

      const profile = await aggregateUserProfile('user-learner');

      expect(profile.best_working_hours.preferred_time_of_day).toBe('morning');
      expect(profile.best_working_hours.total_completed_sessions).toBe(3);
      expect(profile.best_working_hours.average_session_duration_minutes).toBe(60);
      expect(profile.lapse_pattern_summary.total_recovery_events).toBe(1);
      expect(profile.lapse_pattern_summary.frequent_trigger).toBe('CONSECUTIVE_DAYS_MISSED');
      expect(profile.lapse_pattern_summary.preferred_recovery_choice).toBe('shrink_week');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-learner' },
          data: expect.objectContaining({
            best_working_hours: expect.any(Object),
            lapse_pattern_summary: expect.any(Object),
          }),
        })
      );
    });

    it('returns learned defaults to pre-fill subsequent goal onboarding as editable suggestions', async () => {
      const mockUser = {
        id: 'user-learned-defaults',
        best_working_hours: {
          preferred_time_of_day: 'morning',
          peak_hour_window: { start: '08:00', end: '11:00' },
          days_distribution: { MON: 5, TUE: 6, WED: 4, THU: 5, FRI: 1, SAT: 0, SUN: 0 },
          average_session_duration_minutes: 50,
          total_completed_sessions: 21,
          last_updated: '2026-03-08T00:00:00.000Z',
        },
        lapse_pattern_summary: {
          total_recovery_events: 1,
          frequent_trigger: 'NO_FREE_SLOTS',
          preferred_recovery_choice: 'shrink_week',
          circuit_breaker_count: 0,
          recovery_choices_breakdown: { shrink_week: 1 },
          last_updated: '2026-03-08T00:00:00.000Z',
        },
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const defaults = await getOnboardingLearnedDefaults('user-learned-defaults');

      expect(defaults.has_historical_data).toBe(true);
      expect(defaults.preferred_time_of_day).toBe('morning');
      expect(defaults.suggested_session_duration_minutes).toBe(50);
      expect(defaults.high_completion_days).toEqual(expect.arrayContaining(['TUE', 'MON', 'THU', 'WED']));
      expect(defaults.coaching_insight).toContain('peak window 08:00–11:00');
    });

    it('returns sensible baseline defaults when user has no prior history', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'new-user',
        best_working_hours: null,
        lapse_pattern_summary: null,
      });

      const defaults = await getOnboardingLearnedDefaults('new-user');

      expect(defaults.has_historical_data).toBe(false);
      expect(defaults.preferred_time_of_day).toBe('flexible');
      expect(defaults.recommended_days_per_week).toBe(4);
      expect(defaults.suggested_session_duration_minutes).toBe(45);
      expect(defaults.coaching_insight).toBeUndefined();
    });
  });

  describe('Graduation Choice Execution (§4.9)', () => {
    it('start_new_goal completes current goal and triggers profile learning', async () => {
      const mockGoal = {
        id: 'goal-finish-1',
        user_id: 'user-grad',
        status: 'ACTIVE',
        goal_catalog: { title: 'Learn Rust' },
      };

      (prisma.userGoal.findFirst as any).mockResolvedValue(mockGoal);
      (prisma.userGoal.update as any).mockImplementation(async ({ data }: any) => ({
        ...mockGoal,
        ...data,
      }));
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-grad',
        user_goals: [],
      });
      (prisma.user.update as any).mockResolvedValue({});

      const result = await handleGraduationChoice({
        userId: 'user-grad',
        userGoalId: 'goal-finish-1',
        choice: 'start_new_goal',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('COMPLETED');
      expect(result.message).toContain('Learn Rust');
    });

    it('maintenance_mode prunes buffer/reflect sessions to sustain 1-2 core weekly habit', async () => {
      const mockGoal = {
        id: 'goal-maint-1',
        user_id: 'user-grad',
        status: 'ACTIVE',
        goal_catalog: { title: 'Guitar Practice' },
      };

      (prisma.userGoal.findFirst as any).mockResolvedValue(mockGoal);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 12 });
      (prisma.user.findUnique as any).mockResolvedValue({
        id: 'user-grad',
        user_goals: [],
      });
      (prisma.user.update as any).mockResolvedValue({});

      const result = await handleGraduationChoice({
        userId: 'user-grad',
        userGoalId: 'goal-maint-1',
        choice: 'maintenance_mode',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('ACTIVE');
      expect(prisma.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_goal_id: 'goal-maint-1',
            status: 'UPCOMING',
            tier: { in: ['buffer', 'reflect'] },
          },
        })
      );
    });
  });
});
