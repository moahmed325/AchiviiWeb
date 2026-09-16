import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  generateDeterministicFieldManual,
  generateFieldManual,
  TaskFieldManual,
} from '../src/lib/life/fieldManualEngine.js';
import { CapabilityStateGraph } from '../src/lib/adaptive/core/stateGraph.js';
import { generateInitialTrajectory } from '../src/lib/adaptive/strategy/trajectoryEngine.js';

describe('Interactive Field Manual & Step-by-Step Task System', () => {
  describe('Deterministic Field Manual Generator', () => {
    it('generates a complete, structured field manual for SOFTWARE / SaaS domains', () => {
      const manual = generateDeterministicFieldManual(
        'Next.js Setup & Auth Scaffold',
        'Software & Technology',
        45,
        'Launch a micro-SaaS in 90 days'
      );

      expect(manual.objective).toContain('Next.js Setup & Auth Scaffold');
      expect(manual.checklist.length).toBeGreaterThanOrEqual(3);

      // Verify each checklist step has required schema
      for (const step of manual.checklist) {
        expect(step.step_number).toBeGreaterThan(0);
        expect(step.action.length).toBeGreaterThan(10);
        expect(step.duration_minutes).toBeGreaterThan(0);
      }
      expect(manual.checklist.some((s) => s.is_checkpoint)).toBe(true);

      // Verify curated resources
      expect(manual.resources.length).toBeGreaterThanOrEqual(2);
      expect(manual.resources.some((r) => r.type === 'DOCS' || r.type === 'TOOL')).toBe(true);
      expect(manual.resources.some((r) => r.type === 'YOUTUBE')).toBe(true);
      expect(manual.resources.some((r) => r.type === 'PROMPT')).toBe(true);

      // Verify Section 9.9 Fallback Hierarchy
      expect(manual.fallbacks.level_1_standard).toContain('45m');
      expect(manual.fallbacks.level_2_reduced).toContain('29m');
      expect(manual.fallbacks.level_3_mvs).toContain('16m');
      expect(manual.fallbacks.level_4_substitute).toContain('10m');

      // Verify Section 9.10 Pitfall Guardrail
      expect(manual.pitfall_guardrail.trap.length).toBeGreaterThan(5);
      expect(manual.pitfall_guardrail.antidote.length).toBeGreaterThan(5);
    });

    it('generates scientifically backed training manual for FITNESS / Running domains', () => {
      const manual = generateDeterministicFieldManual(
        '5K Tempo Intervals',
        'Athletics & Endurance',
        45,
        'Run a sub-20 minute 5K'
      );

      expect(manual.objective).toContain('5K Tempo Intervals');
      expect(manual.resources.some((r) => r.title.includes('VDOT'))).toBe(true);
      expect(manual.fallbacks.level_1_standard).toBeDefined();
      expect(manual.fallbacks.level_3_mvs).toBeDefined();
    });

    it('generates active recall manual for LANGUAGE domains', () => {
      const manual = generateDeterministicFieldManual(
        'Spanish Dialogue Shadowing',
        'Language & Fluency',
        30,
        'Learn conversational Spanish'
      );

      expect(manual.checklist[0].action).toContain('vocabulary');
      expect(manual.resources.some((r) => r.title.includes('Anki'))).toBe(true);
      expect(manual.pitfall_guardrail.antidote).toContain('muscle memory');
    });
  });

  describe('Trajectory Progressive Milestone Progression', () => {
    it('creates progressive session names across weeks rather than static repetitions', async () => {
      // 1. Create a dummy test user and goal
      const user = await prisma.user.create({
        data: {
          email: `fieldmanual-test-${Date.now()}@example.com`,
          password_hash: 'hashed',
        },
      });

      const catalog = await prisma.goalCatalog.create({
        data: {
          title: 'Launch SaaS Prototype',
          description: 'SaaS in 90 days',
          category: 'Software & Technology',
          icon: 'code',
          est_weekly_hours: 6,
        },
      });

      const userGoal = await prisma.userGoal.create({
        data: {
          user_id: user.id,
          goal_catalog_id: catalog.id,
          outcome_statement: 'Deploy production SaaS with first customer',
          verification_criteria: 'Live Stripe checkout verified',
          start_date: new Date(),
          target_end_date: new Date(Date.now() + 84 * 86400000),
          sustainable_weekly_capacity_hours: 6,
          status: 'ACTIVE',
        },
      });

      const graph = new CapabilityStateGraph();
      graph.addCapability({
        id: `cap-base-${Date.now()}`,
        userGoalId: userGoal.id,
        name: 'Full-Stack Architecture Foundation',
        description: 'Next.js & Database',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
        prerequisites: [],
      });

      // 2. Generate trajectory
      const traj = await generateInitialTrajectory(userGoal.id, graph, {
        sustainableWeeklyHours: 6,
        medHours: 4.5,
        reliabilityMarginHours: 1.5,
      });

      // 3. Inspect items across different weeks
      const items = await prisma.trajectoryItem.findMany({
        where: { trajectory_version_id: traj.id },
        orderBy: [{ planned_week: 'asc' }, { priority_tier: 'asc' }],
      });

      expect(items.length).toBeGreaterThanOrEqual(36);

      const week1Session1 = items.find((i) => i.planned_week === 1 && i.priority_tier === 1);
      const week2Session1 = items.find((i) => i.planned_week === 2 && i.priority_tier === 1);
      const week5Session1 = items.find((i) => i.planned_week === 5 && i.priority_tier === 1);
      const week12Session1 = items.find((i) => i.planned_week === 12 && i.priority_tier === 1);

      // Verify non-repetitive progressive naming
      expect(week1Session1?.intervention_name).toContain('Setup');
      expect(week2Session1?.intervention_name).toContain('Core Patterns');
      expect(week5Session1?.intervention_name).toContain('Feature Sprint');
      expect(week12Session1?.intervention_name).toContain('Capstone Demonstration');

      // Verify embedded field manual in fallback_options
      expect(week1Session1?.fallback_options).toBeDefined();
      const rawOptions = week1Session1?.fallback_options as string[];
      const fieldManualEntry = rawOptions.find((o) => o.startsWith('FIELD_MANUAL: '));
      expect(fieldManualEntry).toBeDefined();

      const parsedManual = JSON.parse(fieldManualEntry!.replace('FIELD_MANUAL: ', '')) as TaskFieldManual;
      expect(parsedManual.checklist.length).toBeGreaterThanOrEqual(3);
      expect(parsedManual.fallbacks.level_1_standard).toBeDefined();
      expect(parsedManual.fallbacks.level_3_mvs).toBeDefined();
    });
  });
});
