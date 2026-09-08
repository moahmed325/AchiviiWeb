import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateRoadmapVariant,
  getDeterministicFallbackRoadmaps,
  generateRoadmapVariants,
  type RoadmapVariant,
  type UserConstraints,
} from '../src/lib/planner.js';
import {
  analyzeWeeklyPerformance,
  type WeeklyAnalysis,
} from '../src/lib/reviewer.js';
import {
  optimizeGoalPlan,
  type OptimizerPlanAdjustment,
} from '../src/lib/optimizer.js';
import {
  generateDailyBriefing,
  generateWeeklyCoachingTakeaway,
  generateCircuitBreakerCoachingMessage,
} from '../src/lib/coach.js';
import { generateThreeMonthSchedule, timeToMinutes } from '../src/lib/scheduler.js';
import { prisma } from '../src/lib/prisma.js';

// Mock prisma
vi.mock('../src/lib/prisma.js', () => {
  return {
    prisma: {
      userGoal: {
        findUnique: vi.fn(),
      },
      roadmap: {
        findUnique: vi.fn(),
      },
      task: {
        findMany: vi.fn(),
      },
      busyBlock: {
        findMany: vi.fn(),
      },
      availabilitySlot: {
        findMany: vi.fn(),
      },
      session: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
      },
    },
  };
});

describe('Phase 4 AI Layer: Roles & Structured Output', () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.clearAllMocks();
  });

  describe('Planner: Constraint Validation & Deterministic Fallbacks', () => {
    const baseConstraints: UserConstraints = {
      availableDaysCount: 4,
      maxSessionDurationMinutes: 90,
      minSessionDurationMinutes: 30,
      catalogTitle: 'Fullstack Web Development',
      phases: [
        { title: 'Foundation', order: 1, defaultDuration: 60 },
        { title: 'API Development', order: 2, defaultDuration: 60 },
      ],
    };

    it('approves valid roadmap variants within user constraints', () => {
      const validVariant: RoadmapVariant = {
        name: 'Steady & Balanced',
        description: 'Consistent moderate pace',
        trade_offs: 'Predictable cadence that fits regular schedules.',
        days_per_week: 3,
        daily_minutes_variance: 0,
        phase_emphasis: {
          Foundation: 1.0,
          'API Development': 1.0,
        },
      };

      const result = validateRoadmapVariant(validVariant, baseConstraints);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects variants whose days_per_week exceeds available days', () => {
      const invalidVariant: RoadmapVariant = {
        name: 'Overloaded Sprint',
        description: 'Too many days',
        trade_offs: 'High risk of burnout',
        days_per_week: 5, // Exceeds availableDaysCount: 4
        daily_minutes_variance: 0,
        phase_emphasis: { Foundation: 1.0 },
      };

      const result = validateRoadmapVariant(invalidVariant, baseConstraints);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds user\'s available days'))).toBe(true);
    });

    it('rejects variants whose duration variance breaches session duration cap', () => {
      const invalidVariant: RoadmapVariant = {
        name: 'Heavy Sessions',
        description: 'Too long',
        trade_offs: 'Requires deep focus',
        days_per_week: 3,
        daily_minutes_variance: 40, // 60 + 40 = 100 > 90 cap
        phase_emphasis: { Foundation: 1.0 },
      };

      const result = validateRoadmapVariant(invalidVariant, baseConstraints);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum cap'))).toBe(true);
    });

    it('rejects variants whose duration variance breaches minimum session duration', () => {
      const invalidVariant: RoadmapVariant = {
        name: 'Too Short',
        description: 'Sessions too tiny',
        trade_offs: 'Hardly enough time to start',
        days_per_week: 3,
        daily_minutes_variance: -40, // 60 - 40 = 20 < 30 min
        phase_emphasis: { Foundation: 1.0 },
      };

      const result = validateRoadmapVariant(invalidVariant, baseConstraints);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('below minimum'))).toBe(true);
    });

    it('generates 3 valid deterministic fallback variants', () => {
      const fallbacks = getDeterministicFallbackRoadmaps(baseConstraints);
      expect(fallbacks).toHaveLength(3);

      for (const variant of fallbacks) {
        const validation = validateRoadmapVariant(variant, baseConstraints);
        expect(validation.valid).toBe(true);
        expect(variant.days_per_week).toBeLessThanOrEqual(baseConstraints.availableDaysCount);
      }
    });

    it('generates roadmap variants from database goal context without Gemini key', async () => {
      const mockGoal = {
        id: 'goal-p1',
        title: 'Learn Go',
        user: {
          availability_slots: [
            { day_of_week: 1, start_time: '09:00', end_time: '12:00' },
            { day_of_week: 2, start_time: '09:00', end_time: '12:00' },
            { day_of_week: 3, start_time: '09:00', end_time: '12:00' },
            { day_of_week: 4, start_time: '09:00', end_time: '12:00' },
          ],
        },
        goal_catalog: {
          title: 'Learn Go',
          phases: [
            {
              title: 'Basics',
              phase_order: 1,
              task_templates: [{ estimated_duration_minutes: 60 }],
            },
          ],
        },
      };

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);

      const variants = await generateRoadmapVariants('goal-p1');
      expect(variants).toHaveLength(3);
      expect(variants[0].name).toBe('Steady & Balanced');
    });
  });

  describe('Reviewer: Strict Structured Metadata Output', () => {
    it('returns structured metadata adhering to schema with no conversational filler', async () => {
      const analysis: WeeklyAnalysis = await analyzeWeeklyPerformance({
        weekNumber: 2,
        completionRate: 0.5,
        scheduledSessionCount: 4,
        completedSessionCount: 2,
        reflectionResponses: { difficulty: 'Too Challenging' },
      });

      expect(typeof analysis.adherence_score).toBe('number');
      expect(analysis.adherence_score).toBe(0.5);
      expect(['scheduling_clash', 'session_length', 'fatigue', 'unspecified']).toContain(
        analysis.primary_friction
      );
      expect(['reduce_sessions_per_week', 'shorten_duration', 'shift_time_of_day', 'keep_pace']).toContain(
        analysis.recommended_adjustment
      );
      expect(typeof analysis.notes).toBe('string');

      // Crucial: Reviewer must never output conversational greetings or user copy
      expect(analysis).not.toHaveProperty('greeting');
      expect(analysis).not.toHaveProperty('coaching_message');
    });
  });

  describe('Optimizer: Replan Parameters Only (No Invented Tasks or Dates)', () => {
    it('returns structured replan parameters only and does not invent tasks or dates', async () => {
      const plan: OptimizerPlanAdjustment = await optimizeGoalPlan({
        goalTitle: 'Master Kubernetes',
        currentDaysPerWeek: 4,
        slippageDays: 5,
        rollingRecoveryCount: 3,
        recentNotes: 'Struggling with weekly time commitments',
      });

      expect(['reduce_days', 'shorten_sessions', 'pause_recommended']).toContain(
        plan.adjustment_type
      );
      expect(typeof plan.new_days_per_week).toBe('number');
      expect(typeof plan.new_daily_minutes_variance).toBe('number');
      expect(typeof plan.rationale_structured).toBe('string');

      // Crucial: Optimizer must NEVER invent tasks, calendar dates, or conversational text
      expect(plan).not.toHaveProperty('tasks');
      expect(plan).not.toHaveProperty('sessions');
      expect(plan).not.toHaveProperty('scheduled_date');
      expect(plan).not.toHaveProperty('message');
    });
  });

  describe('Coach: Unified Presentation Layer with Warm Voice', () => {
    it('produces an encouraging, supportive daily briefing', async () => {
      const briefing = await generateDailyBriefing({
        goalTitle: 'Learn TypeScript',
        sessionTitle: 'Generics Fundamentals',
        durationMinutes: 45,
      });

      expect(typeof briefing).toBe('string');
      expect(briefing.length).toBeGreaterThan(10);
      expect(briefing).toContain('Generics Fundamentals');
    });

    it('translates structured Reviewer signals into unified coaching takeaway', async () => {
      const takeaway = await generateWeeklyCoachingTakeaway({
        weekNumber: 3,
        completionRate: 0.6,
        analysis: {
          adherence_score: 0.6,
          primary_friction: 'scheduling_clash',
          recommended_adjustment: 'reduce_sessions_per_week',
          notes: 'Busy weekdays disrupted sessions',
        },
      });

      expect(typeof takeaway).toBe('string');
      expect(takeaway.length).toBeGreaterThan(15);
      expect(takeaway).not.toContain('{"'); // No raw JSON leaked to user
    });

    it('generates non-judgmental, low-friction message for circuit breaker', async () => {
      const message = await generateCircuitBreakerCoachingMessage({
        adjustment: {
          adjustment_type: 'reduce_days',
          new_days_per_week: 3,
          new_daily_minutes_variance: -15,
          rationale_structured: 'Lapse circuit breaker triggered',
        },
      });

      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(20);
      expect(message.toLowerCase()).not.toContain('failed');
      expect(message.toLowerCase()).not.toContain('lazy');
    });
  });

  describe('Scheduler: Consumes Chosen Roadmap Parameters', () => {
    it('applies daily_minutes_variance and days_per_week from roadmap', async () => {
      const mockGoal = {
        id: 'goal-road-1',
        title: 'Learn Rust',
        target_hours: 30,
        start_date: new Date('2026-03-01T00:00:00.000Z'),
        end_date: new Date('2026-05-31T00:00:00.000Z'),
        selected_roadmap_id: 'road-speedy',
        current_plan_day_offset: 0,
        user: {
          timezone: 'UTC',
          availability_slots: [
            { day_of_week: 1, start_time: '09:00', end_time: '12:00' }, // Monday
            { day_of_week: 2, start_time: '09:00', end_time: '12:00' }, // Tuesday
            { day_of_week: 3, start_time: '09:00', end_time: '12:00' }, // Wednesday
            { day_of_week: 4, start_time: '09:00', end_time: '12:00' }, // Thursday
            { day_of_week: 5, start_time: '09:00', end_time: '12:00' }, // Friday
          ],
        },
        goal_catalog: {
          title: 'Learn Rust',
          phases: [
            {
              id: 'phase-1',
              title: 'Phase 1',
              phase_order: 1,
              task_templates: [
                {
                  id: 'task-template-1',
                  title: 'Syntax Basics',
                  sessions_per_week: 3,
                  session_duration_minutes: 30,
                  preferred_time_of_day: 'morning',
                  tier: 'core',
                  category: 'learn',
                },
              ],
            },
          ],
        },
      };

      const mockRoadmap = {
        id: 'road-speedy',
        user_goal_id: 'goal-road-1',
        roadmap_name: 'Sprint Builder',
        days_per_week: 3,
        daily_minutes_variance: 15,
        phase_emphasis: { Phase1: 1.0 },
      };

      const mockTasks = [
        {
          id: 'task-1',
          goal_id: 'goal-road-1',
          title: 'Syntax Basics',
          phase: 1,
          order_index: 0,
          session_duration_minutes: 30,
          status: 'pending',
          tier: 'core',
          category: 'learn',
        },
      ];

      (prisma.userGoal.findUnique as any).mockResolvedValue(mockGoal);
      (prisma.roadmap.findUnique as any).mockResolvedValue(mockRoadmap);
      (prisma.task.findMany as any).mockResolvedValue(mockTasks);
      (prisma.busyBlock.findMany as any).mockResolvedValue([]);
      (prisma.session.deleteMany as any).mockResolvedValue({ count: 0 });

      let createdSessions: any[] = [];
      (prisma.session.createMany as any).mockImplementation(async ({ data }: any) => {
        createdSessions = data;
        return { count: data.length };
      });

      await generateThreeMonthSchedule('goal-road-1', 'user-123');

      expect(createdSessions.length).toBeGreaterThan(0);
      // baseline duration was 30. With daily_minutes_variance = 15, duration should be 45
      const firstSession = createdSessions[0];
      const durationMinutes = timeToMinutes(firstSession.end_time) - timeToMinutes(firstSession.start_time);

      expect(durationMinutes).toBe(45);
    });
  });
});
