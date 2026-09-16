import { describe, it, expect, afterAll } from 'vitest';
import {
  CapacityModel,
  createExecutionObject,
  canTransitionExecutionState,
  generateInitialTrajectory,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Initial Trajectory Engine & Multi-Tier Execution Model', () => {
  const testGoalId = `test-traj-goal-${Date.now()}`;
  const testUserId = `test-traj-user-${Date.now()}`;
  const testCatalogId = `test-traj-catalog-${Date.now()}`;

  afterAll(async () => {
    try {
      await prisma.session.deleteMany({
        where: { user_goal_id: testGoalId },
      }).catch(() => {});
      await prisma.trajectoryItem.deleteMany({
        where: { trajectory_version: { user_goal_id: testGoalId } },
      }).catch(() => {});
      await prisma.trajectoryVersion.deleteMany({
        where: { user_goal_id: testGoalId },
      }).catch(() => {});
      await prisma.goalCapability.deleteMany({
        where: { user_goal_id: testGoalId },
      }).catch(() => {});
      await prisma.userGoal.deleteMany({
        where: { id: testGoalId },
      }).catch(() => {});
      await prisma.goalCatalog.deleteMany({
        where: { id: testCatalogId },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: testUserId },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning in trajectory test:', e);
    }
  });

  describe('Execution Object & State Machine', () => {
    it('creates ExecutionObject with dose gradients (Standard, Reduced, MVS) and fallbacks', () => {
      const exec = createExecutionObject({
        trajectoryItemId: 'item-1',
        userGoalId: 'goal-1',
        targetCapabilityId: 'cap-aerobic',
        actionName: 'Zone 2 Base Run',
        purpose: 'Develop aerobic durability',
        priorityTier: 1,
        standardDoseMinutes: 50,
      });

      expect(exec.standardDoseMinutes).toBe(50);
      expect(exec.reducedDoseMinutes).toBe(33); // ~65% of 50
      expect(exec.mvsDoseMinutes).toBe(20);     // ~40% of 50
      expect(exec.fallbackOptions.length).toBeGreaterThan(0);
      expect(exec.executionState).toBe('PLANNED');
    });

    it('validates action state machine transitions correctly', () => {
      // Valid transitions
      expect(canTransitionExecutionState('PLANNED', 'READY')).toBe(true);
      expect(canTransitionExecutionState('READY', 'INITIATED')).toBe(true);
      expect(canTransitionExecutionState('INITIATED', 'COMPLETED')).toBe(true);
      expect(canTransitionExecutionState('INITIATED', 'MINIMUM_VIABLE')).toBe(true);
      expect(canTransitionExecutionState('INITIATED', 'REDUCED')).toBe(true);

      // Terminal state COMPLETED cannot transition to PLANNED
      expect(canTransitionExecutionState('COMPLETED', 'PLANNED')).toBe(false);
      // Terminal state MISSED can transition to READY or REPLACED on replan
      expect(canTransitionExecutionState('MISSED', 'READY')).toBe(true);
    });
  });

  describe('Trajectory Engine DB Generation', () => {
    it('generates a 12-week Trajectory v1 adhering to capacity constraints', async () => {
      // 1. Create DB prerequisites
      await prisma.user.create({
        data: {
          id: testUserId,
          email: `${testUserId}@example.com`,
          password_hash: 'hash123',
          timezone: 'UTC',
        },
      });

      await prisma.goalCatalog.create({
        data: {
          id: testCatalogId,
          title: 'Adaptive Marathon Blueprint',
          description: '12-week plan',
          category: 'FITNESS',
          icon: 'run',
          est_weekly_hours: 6,
        },
      });

      await prisma.userGoal.create({
        data: {
          id: testGoalId,
          user_id: testUserId,
          goal_catalog_id: testCatalogId,
          start_date: new Date('2026-09-15T00:00:00Z'),
          target_end_date: new Date('2026-12-08T00:00:00Z'),
          status: 'ACTIVE',
        },
      });

      // 2. Define Capacity Model (6h sustainable, 1.5h reliability margin -> 4.5h MED)
      const capacity: CapacityModel = {
        sustainableWeeklyHours: 6.0,
        medHours: 4.5,
        reliabilityMarginHours: 1.5,
        maxSessionDurationMinutes: 75,
      };

      // 3. Generate Initial Trajectory
      const trajectory = await generateInitialTrajectory(
        testGoalId,
        capacity,
        [
          { day_of_week: 'TUE', start_time: '06:30', end_time: '08:00' },
          { day_of_week: 'THU', start_time: '06:30', end_time: '08:00' },
          { day_of_week: 'SAT', start_time: '07:00', end_time: '09:00' },
        ]
      );

      expect(trajectory.versionNumber).toBe(1);
      expect(trajectory.trigger).toBe('INITIAL_TRAJECTORY');
      expect(trajectory.confidence).toBe('HIGH');
      expect(trajectory.items.length).toBeGreaterThanOrEqual(36); // At least 3 sessions * 12 weeks

      // Verify every item contains standard, reduced, and MVS doses
      for (const item of trajectory.items) {
        expect(item.standard_duration_minutes).toBeGreaterThan(0);
        expect(item.reduced_duration_minutes).toBeGreaterThan(0);
        expect(item.mvs_duration_minutes).toBeGreaterThan(0);
        expect(item.standard_duration_minutes).toBeGreaterThan(item.reduced_duration_minutes);
        expect(item.reduced_duration_minutes).toBeGreaterThanOrEqual(item.mvs_duration_minutes);
      }

      // Verify invariant: Total weekly scheduled hours does not exceed sustainable capacity minus reliability margin
      const week1Items = trajectory.items.filter((item: any) => item.planned_week === 1);
      const totalWeek1Minutes = week1Items.reduce(
        (sum: number, item: any) => sum + item.standard_duration_minutes,
        0
      );

      const maxAllowedMinutes = Math.round(
        (capacity.sustainableWeeklyHours - capacity.reliabilityMarginHours) * 60
      );
      expect(totalWeek1Minutes).toBeLessThanOrEqual(maxAllowedMinutes + 1);

      // Verify Week 1 sessions materialized in database
      const dbSessions = await prisma.session.findMany({
        where: { user_goal_id: testGoalId },
      });
      expect(dbSessions.length).toBeGreaterThanOrEqual(3);
      expect(dbSessions[0].execution_state).toBe('PLANNED');
    });
  });
});
