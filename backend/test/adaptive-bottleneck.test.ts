import { describe, it, expect } from 'vitest';
import {
  CapabilityStateGraph,
  identifyCriticalPath,
  identifyCurrentBottleneck,
  detectBottleneckShift,
  calculateMED,
  calculateReliabilityMargin,
} from '../src/lib/adaptive/index.js';

describe('Bottleneck Engine, Critical Path & Capacity Model', () => {
  describe('Critical Path Derivation', () => {
    it('derives critical path for linear DAG from target outcome', () => {
      const graph = new CapabilityStateGraph();

      graph.addCapability({
        id: 'node-A',
        userGoalId: 'goal-1',
        name: 'Aerobic Base',
        description: 'Zone 2 running base',
        tier: 'TIER_1_CRITICAL',
      });
      graph.addCapability({
        id: 'node-B',
        userGoalId: 'goal-1',
        name: 'Musculoskeletal Durability',
        description: 'Weekly volume tolerance',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['node-A'],
      });
      graph.addCapability({
        id: 'node-C',
        userGoalId: 'goal-1',
        name: 'Half Marathon Race Readiness',
        description: 'Target finish line',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['node-B'],
      });

      const criticalPath = identifyCriticalPath(graph, 'node-C');
      expect(criticalPath).toHaveLength(3);
      expect(criticalPath.map((n) => n.id)).toEqual(['node-A', 'node-B', 'node-C']);
    });

    it('derives critical path for multi-branch DAG isolating required ancestors', () => {
      const graph = new CapabilityStateGraph();

      // Branch 1 (Critical Path)
      graph.addCapability({
        id: 'core-prereq-1',
        userGoalId: 'goal-2',
        name: 'Database Schema & Auth',
        description: 'Core backend foundation',
        tier: 'TIER_1_CRITICAL',
      });
      graph.addCapability({
        id: 'core-prereq-2',
        userGoalId: 'goal-2',
        name: 'Payment Integration',
        description: 'Stripe checkout flow',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['core-prereq-1'],
      });

      // Branch 2 (Independent parallel branch)
      graph.addCapability({
        id: 'parallel-prereq-1',
        userGoalId: 'goal-2',
        name: 'Landing Page Copy',
        description: 'Marketing value prop',
        tier: 'TIER_2_HIGH_LEVERAGE',
      });

      // Target Outcome (depends on core-prereq-2 and parallel-prereq-1)
      graph.addCapability({
        id: 'target-outcome',
        userGoalId: 'goal-2',
        name: 'MVP Launch to 10 Users',
        description: 'Live paying customers',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['core-prereq-2', 'parallel-prereq-1'],
      });

      // Unrelated optional capability not leading to target-outcome
      graph.addCapability({
        id: 'unrelated-node',
        userGoalId: 'goal-2',
        name: 'Dark Mode UI Theme',
        description: 'Optional cosmetic feature',
        tier: 'TIER_4_OPTIONAL',
      });

      const criticalPath = identifyCriticalPath(graph, 'target-outcome');
      const ids = criticalPath.map((n) => n.id);

      expect(ids).toContain('core-prereq-1');
      expect(ids).toContain('core-prereq-2');
      expect(ids).toContain('parallel-prereq-1');
      expect(ids).toContain('target-outcome');
      expect(ids).not.toContain('unrelated-node'); // Correctly pruned
    });
  });

  describe('Bottleneck Identification & Shift', () => {
    it('identifies earliest unsatisfied prerequisite as current bottleneck', () => {
      const graph = new CapabilityStateGraph();

      graph.addCapability({
        id: 'node-A',
        userGoalId: 'goal-3',
        name: 'Node A: Foundational Base',
        description: 'Base capability',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
      });
      graph.addCapability({
        id: 'node-B',
        userGoalId: 'goal-3',
        name: 'Node B: Specific Capacity',
        description: 'Specific capability',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
        prerequisites: ['node-A'],
      });

      const criticalPath = identifyCriticalPath(graph, 'node-B');
      const bottleneck = identifyCurrentBottleneck(criticalPath);

      expect(bottleneck).not.toBeNull();
      expect(bottleneck?.id).toBe('node-A'); // Earliest unestablished prerequisite
    });

    it('shifts bottleneck automatically when Node A becomes ROBUST', () => {
      const graph = new CapabilityStateGraph();

      const nodeA = graph.addCapability({
        id: 'node-A',
        userGoalId: 'goal-4',
        name: 'Node A',
        description: 'A',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
      });
      const nodeB = graph.addCapability({
        id: 'node-B',
        userGoalId: 'goal-4',
        name: 'Node B',
        description: 'B',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
        prerequisites: ['node-A'],
      });

      let criticalPath = identifyCriticalPath(graph, 'node-B');
      let initialBottleneck = identifyCurrentBottleneck(criticalPath);
      expect(initialBottleneck?.id).toBe('node-A');

      // Now Node A progresses to ROBUST
      nodeA.state = 'ROBUST';

      criticalPath = identifyCriticalPath(graph, 'node-B');
      const updatedBottleneck = identifyCurrentBottleneck(criticalPath);

      expect(updatedBottleneck?.id).toBe('node-B'); // Bottleneck dynamically shifted to B
      expect(detectBottleneckShift(initialBottleneck?.id || null, updatedBottleneck?.id || null)).toBe(true);
    });
  });

  describe('Minimum Effective Dose & Reliability Margin Math', () => {
    it('computes MED with recommended session distribution for physical and cognitive domains', () => {
      const mockBottleneck = {
        id: 'mock-cap-1',
        userGoalId: 'goal-5',
        name: 'Aerobic Base',
        description: 'Base volume',
        tier: 'TIER_1_CRITICAL' as const,
        state: 'UNTESTED' as const,
        prerequisites: [],
      };

      const physicalMed = calculateMED(mockBottleneck, 90, 'PHYSICAL');
      expect(physicalMed.medWeeklyMinutes).toBe(270); // 4.5 hours
      expect(physicalMed.recommendedSessions).toBe(4);
      expect(physicalMed.priorityDistribution.tier1).toBe(0.55);

      const cognitiveMed = calculateMED(mockBottleneck, 90, 'COGNITIVE');
      expect(cognitiveMed.medWeeklyMinutes).toBe(240); // 4 hours
      expect(cognitiveMed.recommendedSessions).toBe(4);
    });

    it('calculates Reliability Margin correctly: 420 mins capacity, 300 mins MED -> ROBUST (120 min margin)', () => {
      // 420 mins (7h) capacity, 300 mins (5h) MED -> 120 mins margin (28.6% margin)
      const result = calculateReliabilityMargin(420, 300);

      expect(result.marginMinutes).toBe(120);
      expect(result.marginRatio).toBeCloseTo(0.29, 2);
      expect(result.health).toBe('ROBUST');
    });

    it('calculates Reliability Margin correctly: 300 mins capacity, 330 mins MED -> DEFICIT', () => {
      // 300 mins (5h) capacity, 330 mins (5.5h) MED -> -30 mins margin
      const result = calculateReliabilityMargin(300, 330);

      expect(result.marginMinutes).toBe(-30);
      expect(result.marginRatio).toBeLessThan(0);
      expect(result.health).toBe('DEFICIT');
    });

    it('flags FRAGILE health when margin is narrow (e.g. between 5% and 20%)', () => {
      // 360 mins capacity, 320 mins MED -> 40 mins margin (11% margin)
      const result = calculateReliabilityMargin(360, 320);

      expect(result.marginMinutes).toBe(40);
      expect(result.health).toBe('FRAGILE');
    });
  });
});
