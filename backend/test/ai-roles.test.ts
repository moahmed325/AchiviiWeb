import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateMasterPlanOutput,
  buildDeterministicMasterPlan,
  type MasterPlanOutput,
} from '../src/lib/ai/masterPlanningPrompt.js';
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
import { timeToMinutes } from '../src/lib/timeUtils.js';
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

  describe('Master Planning Engine: Schema Validation & Deterministic Fallbacks', () => {
    it('approves valid MasterPlanOutput objects adhering to schema', () => {
      const validPlan: MasterPlanOutput = {
        summary: '90-Day Full-Stack Web App Execution Protocol',
        target_date: '2026-12-15',
        weekly_target_hours: 8,
        recommended_dose_minutes: 60,
        minimum_viable_dose_minutes: 25,
        preferred_window: 'MORNING',
        energy_requirement: 'HIGH',
        diagnostic_baseline: 'Demonstrate production deployment and authenticated CRUD',
        interventions_needed: ['TDD scaffolding', 'Docker orchestration'],
        phases: [
          {
            phase_number: 1,
            phase_name: 'Core Architecture',
            focus_description: 'Prerequisites & database schema',
            items: [
              {
                intervention_name: 'Schema definition & migration',
                standard_duration_minutes: 60,
                mvs_duration_minutes: 25,
                planned_week: 1,
                priority_tier: 'TIER_1_CRITICAL',
              },
            ],
          },
        ],
      };

      const result = validateMasterPlanOutput(validPlan);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid MasterPlanOutput objects missing required fields', () => {
      const invalidPlan: any = {
        summary: 'Incomplete Plan',
      };

      const result = validateMasterPlanOutput(invalidPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('generates a valid deterministic fallback MasterPlan with phases and doses', () => {
      const fallback = buildDeterministicMasterPlan({
        blueprint: {
          id: 'test-bp',
          title: 'Fullstack Web Development',
          est_weekly_hours: 8,
        },
        answers: {
          q_baseline: 'Intermediate JavaScript',
          q_weekly_ceiling: '8 hours',
        },
        lifeStructure: {
          wake_time: '07:00',
          sleep_time: '23:00',
          buffer_minutes: 15,
          schedule_reliability: 'HIGH',
        },
      });

      const validation = validateMasterPlanOutput(fallback);
      expect(validation.valid).toBe(true);
      expect(fallback.phases.length).toBeGreaterThan(0);
      expect(fallback.weekly_target_hours).toBe(8);
      expect(fallback.recommended_dose_minutes).toBeGreaterThan(0);
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
});
