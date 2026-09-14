import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma';
import {
  getOrCreateLifeStructure,
  createRoutineBlock,
  calculateAvailableWindows,
  timeToMinutes,
  minutesToTime,
} from '../src/lib/life/lifeStructureEngine';
import {
  generateDeterministicMasterPlan,
  validateMasterPlanOutput,
  generateMasterPlan,
} from '../src/lib/ai/masterPlanningPrompt';
import {
  materializeDays,
  adaptTodaySchedule,
  findOptimalAmbitionWindow,
  cleanDoseTitle,
} from '../src/lib/life/dailyScheduler';
import {
  auditUserCapacity,
  updateAmbitionPriorities,
} from '../src/lib/life/multiAmbitionCoordinator';

describe('Life Operating System: Scenarios K through O', () => {
  const testUserId = `test-life-user-${Date.now()}`;

  beforeEach(async () => {
    // Ensure test user exists
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'hash123',
      },
    });

    // Ensure life structure exists
    await getOrCreateLifeStructure(testUserId);
  });

  // Scenario K: Life Structure Engine & Available Window Calculation
  describe('Scenario K: Life Structure Engine & Energy Window Math', () => {
    it('creates default life structure with waking 07:00 and sleep 23:00', async () => {
      const life = await getOrCreateLifeStructure(testUserId);
      expect(life.wake_time).toBe('07:00');
      expect(life.sleep_time).toBe('23:00');
      expect(life.routine_blocks.length).toBeGreaterThanOrEqual(3);
    });

    it('calculates free available windows subtracting routine blocks and buffers', async () => {
      const mondayDate = '2026-09-14'; // 2026-09-14 is Monday
      const windows = await calculateAvailableWindows(testUserId, mondayDate);

      expect(windows.length).toBeGreaterThanOrEqual(2);

      const morningWin = windows.find((w) => w.start_time === '07:00');
      expect(morningWin).toBeDefined();
      expect(morningWin?.end_time).toBe('08:45');
      expect(morningWin?.duration_minutes).toBe(105);
      expect(morningWin?.energy).toBe('HIGH');

      const eveningWin = windows.find((w) => w.start_time === '17:15');
      expect(eveningWin).toBeDefined();
      expect(eveningWin?.end_time).toBe('19:00');
    });

    it('handles custom routine blocks added by user', async () => {
      const customBlock = await createRoutineBlock(testUserId, {
        title: 'Morning School Run',
        category: 'FAMILY',
        days_of_week: [1, 2, 3, 4, 5],
        start_time: '08:00',
        end_time: '08:30',
        buffer_before_minutes: 10,
        buffer_after_minutes: 10,
      });

      expect(customBlock.id).toBeDefined();
      const windows = await calculateAvailableWindows(testUserId, '2026-09-14');
      const earlyMorning = windows.find((w) => w.start_time === '07:00');
      expect(earlyMorning?.end_time).toBe('07:50');
      expect(earlyMorning?.duration_minutes).toBe(50);
    });
  });

  // Scenario L: Master Planning Prompt Engine & Deterministic Fallback
  describe('Scenario L: Master Planning Prompt Engine', () => {
    it('generates a verified 90-day trajectory from blueprint and 5-7 questions', async () => {
      const saasCatalog = await prisma.goalCatalog.findUnique({
        where: { id: 'saas-mvp-catalog-id' },
      });
      expect(saasCatalog).toBeDefined();

      const answers = {
        current_technical_level: 'experienced',
        weekly_time_commitment: '9',
        preferred_dose_frequency: 'daily_micro',
        primary_past_bottleneck: 'scope_creep',
      };

      const result = await generateMasterPlan({
        blueprint: saasCatalog!,
        answers,
        lifeStructure: {
          wake_time: '07:00',
          sleep_time: '23:00',
          buffer_minutes: 30,
          schedule_reliability: 'HIGH',
        },
        startDate: '2026-09-14',
      });

      expect(result.plan).toBeDefined();
      const validation = validateMasterPlanOutput(result.plan);
      expect(validation.valid).toBe(true);

      // Verify personalized properties
      expect(result.plan.weekly_target_hours).toBe(9);
      expect(result.plan.phases.length).toBe(3);
      expect(result.plan.phases[0].items.length).toBeGreaterThanOrEqual(2);
      expect(result.plan.diagnostic_baseline).toContain('EXPERIENCED');
      expect(result.plan.interventions_needed.some((i) => i.includes('scope creep'))).toBe(true);
    });
  });

  // Scenario M: Intraday Friction & Adaptation without Backlog Debt
  describe('Scenario M: Daily Scheduler & No-Debt Invariant', () => {
    beforeEach(async () => {
      // Create user goal with active trajectory
      const saasCatalog = await prisma.goalCatalog.findUnique({
        where: { id: 'saas-mvp-catalog-id' },
      });

      await prisma.userGoal.create({
        data: {
          user_id: testUserId,
          goal_catalog_id: saasCatalog!.id,
          outcome_statement: 'Deploy Production SaaS MVP',
          start_date: new Date('2026-09-14'),
          target_end_date: new Date('2026-12-14'),
          sustainable_weekly_capacity_hours: 8.0,
          current_med_hours: 6.0,
          current_reliability_margin_hours: 2.0,
          status: 'ACTIVE',
          trajectory_versions: {
            create: {
              version_number: 1,
              trigger_type: 'INITIAL_PLAN',
              confidence_score: 0.85,
              projected_completion: new Date('2026-12-14'),
              is_active: true,
              items: {
                create: [
                  {
                    intervention_name: 'Database Architecture Sprint',
                    planned_week: 1,
                    priority_tier: 1,
                    standard_duration_minutes: 60,
                    reduced_duration_minutes: 40,
                    mvs_duration_minutes: 20,
                  },
                ],
              },
            },
          },
        },
      });
    });

    it('materializes integrated daily schedule containing routines and ambition dose', async () => {
      const today = '2026-09-14';
      const items = await materializeDays(testUserId, today, today, { forceRegenerate: true });

      expect(items.length).toBeGreaterThanOrEqual(4);
      const dose = items.find((i) => i.item_type === 'AMBITION_DOSE');
      expect(dose).toBeDefined();
      expect(dose.title).toBe('Database Architecture Sprint');
      expect(dose.allocated_minutes).toBe(50); // Intelligently fitted into 50m available window (07:00-07:50)
      expect(dose.status).toBe('SCHEDULED');
    });

    it('adapts today schedule on delay, compressing or relocating with zero debt scolding', async () => {
      const today = '2026-09-14';
      await materializeDays(testUserId, today, today, { forceRegenerate: true });

      // Run intraday adaptation with 45m shift
      const adaptation = await adaptTodaySchedule(testUserId, today, 45, 'Meeting Overran');
      expect(adaptation.modified).toBeGreaterThanOrEqual(1);

      // Verify items remain scheduled or marked SKIPPED_INTENTIONAL without carrying backlog debt
      const dayStart = new Date(today + 'T00:00:00.000Z');
      const dayEnd = new Date(today + 'T23:59:59.999Z');
      const updatedItems = await prisma.dailyScheduleItem.findMany({
        where: { user_id: testUserId, date: { gte: dayStart, lte: dayEnd } },
      });

      const dose = updatedItems.find((i) => i.item_type === 'AMBITION_DOSE');
      expect(dose).toBeDefined();
      expect(['SCHEDULED', 'SKIPPED_INTENTIONAL']).toContain(dose?.status);
    });
  });

  // Scenario N: Multi-Ambition Coordination Engine
  describe('Scenario N: Multi-Ambition Coordination Engine', () => {
    beforeEach(async () => {
      const saasCatalog = await prisma.goalCatalog.findUnique({
        where: { id: 'saas-mvp-catalog-id' },
      });

      await prisma.userGoal.create({
        data: {
          user_id: testUserId,
          goal_catalog_id: saasCatalog!.id,
          outcome_statement: 'Deploy Production SaaS MVP',
          start_date: new Date('2026-09-14'),
          target_end_date: new Date('2026-12-14'),
          sustainable_weekly_capacity_hours: 8.0,
          current_med_hours: 6.0,
          current_reliability_margin_hours: 2.0,
          priority_rank: 1,
          status: 'ACTIVE',
        },
      });
    });

    it('audits weekly capacity ceiling and detects overloading when ambitions exceed safe margin', async () => {
      const marathonCatalog = await prisma.goalCatalog.findUnique({
        where: { id: 'half-marathon-catalog-id' },
      });

      // User has 1 active goal (SaaS = 8h/week)
      const audit = await auditUserCapacity(testUserId);
      expect(audit.total_weekly_free_hours).toBeGreaterThan(0);
      expect(audit.committed_ambition_hours).toBeGreaterThanOrEqual(6);

      // Now add a second demanding ambition (Marathon = 5h/week)
      await prisma.userGoal.create({
        data: {
          user_id: testUserId,
          goal_catalog_id: marathonCatalog!.id,
          outcome_statement: 'Run Half-Marathon',
          start_date: new Date('2026-09-14'),
          target_end_date: new Date('2026-12-14'),
          sustainable_weekly_capacity_hours: 6.0,
          current_med_hours: 4.5,
          current_reliability_margin_hours: 1.5,
          priority_rank: 2,
          status: 'ACTIVE',
        },
      });

      const audit2 = await auditUserCapacity(testUserId);
      expect(audit2.active_ambitions_count).toBeGreaterThanOrEqual(2);
      expect(audit2.committed_ambition_hours).toBeGreaterThanOrEqual(11);
    });

    it('reorders and normalizes ambition priorities', async () => {
      const marathonCatalog = await prisma.goalCatalog.findUnique({
        where: { id: 'half-marathon-catalog-id' },
      });

      await prisma.userGoal.create({
        data: {
          user_id: testUserId,
          goal_catalog_id: marathonCatalog!.id,
          outcome_statement: 'Run Half-Marathon',
          start_date: new Date('2026-09-14'),
          target_end_date: new Date('2026-12-14'),
          sustainable_weekly_capacity_hours: 6.0,
          current_med_hours: 4.5,
          current_reliability_margin_hours: 1.5,
          priority_rank: 2,
          status: 'ACTIVE',
        },
      });

      const activeGoals = await prisma.userGoal.findMany({
        where: { user_id: testUserId, status: 'ACTIVE' },
        orderBy: { priority_rank: 'asc' },
      });

      expect(activeGoals.length).toBeGreaterThanOrEqual(2);
      const reorderedIds = [activeGoals[1].id, activeGoals[0].id];
      const prioritized = await updateAmbitionPriorities(testUserId, reorderedIds);

      expect(prioritized[0].id).toBe(reorderedIds[0]);
      expect(prioritized[0].priority_rank).toBe(1);
    });
  });

  // Scenario O: Simple Task Naming & Routine-Strict Intelligent Window Placement
  describe('Scenario O: Simple Task Naming & Routine-Strict Intelligent Window Placement', () => {
    it('generates concise to-the-point task titles (2 to 5 words max) with rich descriptions', () => {
      // 1. cleanDoseTitle verifies concise punchy naming
      expect(cleanDoseTitle('Core Adaptation Session: Jazz Piano Fundamentals')).toBe('Jazz Piano Fundamentals');
      expect(cleanDoseTitle('Consolidation Practice: Aerobic Base Running')).toBe('Aerobic Base Running');
      expect(cleanDoseTitle('Scales & Chords')).toBe('Scales & Chords');

      // 2. Deterministic plan items verify 2-5 words title and rich description
      const plan = generateDeterministicMasterPlan({
        blueprint: {
          id: 'jazz-piano-blueprint',
          title: 'Learn to play Jazz piano',
          est_weekly_hours: 6,
        },
        answers: {
          preferred_time_window: 'evening',
        },
        userMemory: 'Night owl, works 9-5',
      });

      expect(plan.phases.length).toBe(3);
      for (const phase of plan.phases) {
        for (const item of phase.items) {
          const words = item.title.split(/\s+/);
          expect(words.length).toBeLessThanOrEqual(5);
          expect(words.length).toBeGreaterThanOrEqual(2);
          expect(item.description.length).toBeGreaterThan(15);
          expect(item.why_this_matters).toBeDefined();
          expect(item.mvs_fallback_description).toBeDefined();
        }
      }
    });

    it('schedules night owl / evening preference strictly into evening open window, never overlapping 9-5 work', () => {
      // Available windows for a 9-to-5 worker (wake 07:00, sleep 23:00, work 09:00-17:00, dinner 19:00-20:00)
      const mockWindows = [
        { start_time: '07:00', end_time: '08:45', duration_minutes: 105, energy: 'HIGH' as const },
        { start_time: '17:15', end_time: '19:00', duration_minutes: 105, energy: 'MEDIUM' as const },
        { start_time: '20:15', end_time: '23:00', duration_minutes: 165, energy: 'LOW' as const },
      ];

      const optimal = findOptimalAmbitionWindow(mockWindows, {
        nominalMinutes: 45,
        mvdMinutes: 20,
        preferredWindow: 'EVENING',
        userMemory: 'Night owl, works 9-to-5, prefers focus sessions after 8pm',
      });

      expect(optimal).toBeDefined();
      expect(optimal?.window.start_time).toBe('20:15');
      // Starts in the evening (>= 20:00 / 1200 mins)
      expect(optimal!.startMins).toBeGreaterThanOrEqual(1200);
      // Finishes before sleep
      expect(optimal!.endMins).toBeLessThanOrEqual(1380); // <= 23:00
      // Strictly outside 09:00 - 17:00 (540 to 1020 mins)
      expect(optimal!.startMins).toBeGreaterThanOrEqual(1020);
    });

    it('schedules early bird / morning preference strictly into morning open window before 9-5 work', () => {
      const mockWindows = [
        { start_time: '07:00', end_time: '08:45', duration_minutes: 105, energy: 'HIGH' as const },
        { start_time: '17:15', end_time: '19:00', duration_minutes: 105, energy: 'MEDIUM' as const },
        { start_time: '20:15', end_time: '23:00', duration_minutes: 165, energy: 'LOW' as const },
      ];

      const optimal = findOptimalAmbitionWindow(mockWindows, {
        nominalMinutes: 45,
        mvdMinutes: 20,
        preferredWindow: 'MORNING',
        userMemory: 'Early bird, morning runner',
      });

      expect(optimal).toBeDefined();
      expect(optimal?.window.start_time).toBe('07:00');
      // Finishes before work starts (09:00 / 540 mins)
      expect(optimal!.endMins).toBeLessThanOrEqual(540);
    });
  });
});
