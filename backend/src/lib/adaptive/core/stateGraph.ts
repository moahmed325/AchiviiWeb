import {
  CapabilityNode,
  CapabilityState,
  CapabilityTier,
  CapabilityEvidence,
  SimpleVerificationQuestion,
} from './types.js';
import { prisma } from '../../prisma.js';

export class CapabilityStateGraph {
  private nodes: Map<string, CapabilityNode> = new Map();
  private prerequisites: Map<string, Set<string>> = new Map(); // capabilityId -> Set of prerequisite capability IDs
  private dependents: Map<string, Set<string>> = new Map();    // prerequisiteId -> Set of dependent capability IDs
  private evidencesMap: Map<string, CapabilityEvidence[]> = new Map();

  constructor() {}

  /**
   * Adds a capability node to the graph.
   */
  public addCapability(
    capability: CapabilityNode | {
      id: string;
      userGoalId: string;
      name: string;
      description: string;
      tier: CapabilityTier;
      state?: CapabilityState;
      prerequisites?: string[];
      metricValue?: number;
      targetMetric?: number;
    }
  ): CapabilityNode {
    const fullNode: CapabilityNode = {
      id: capability.id,
      userGoalId: capability.userGoalId,
      name: capability.name,
      description: capability.description,
      tier: capability.tier,
      state: capability.state || 'UNTESTED',
      prerequisites: capability.prerequisites || [],
      metricValue: capability.metricValue,
      targetMetric: capability.targetMetric,
    };

    this.nodes.set(fullNode.id, fullNode);
    if (!this.prerequisites.has(fullNode.id)) {
      this.prerequisites.set(fullNode.id, new Set());
    }
    if (!this.dependents.has(fullNode.id)) {
      this.dependents.set(fullNode.id, new Set());
    }

    if (capability.prerequisites && capability.prerequisites.length > 0) {
      for (const prereqId of capability.prerequisites) {
        this.addPrerequisite(fullNode.id, prereqId);
      }
    }

    return fullNode;
  }

  /**
   * Adds a prerequisite dependency: `prerequisiteId` must precede `capabilityId`.
   * Throws an error if adding this edge would create a cycle.
   */
  public addPrerequisite(capabilityId: string, prerequisiteId: string): void {
    if (capabilityId === prerequisiteId) {
      throw new Error(`Cycle detected: Capability "${capabilityId}" cannot be a prerequisite of itself.`);
    }

    if (!this.nodes.has(capabilityId)) {
      throw new Error(`Capability "${capabilityId}" does not exist in graph.`);
    }
    if (!this.nodes.has(prerequisiteId)) {
      throw new Error(`Prerequisite capability "${prerequisiteId}" does not exist in graph.`);
    }

    // Cycle detection: check if prerequisiteId can reach capabilityId via existing prerequisites.
    // If prerequisiteId already depends on capabilityId, adding capabilityId -> prerequisiteId creates a cycle.
    if (this.canReach(prerequisiteId, capabilityId)) {
      throw new Error(
        `Cycle detected: Adding prerequisite "${prerequisiteId}" to "${capabilityId}" would introduce a cyclic dependency.`
      );
    }

    this.prerequisites.get(capabilityId)!.add(prerequisiteId);
    this.dependents.get(prerequisiteId)!.add(capabilityId);

    // Keep node prerequisites array in sync
    const node = this.nodes.get(capabilityId)!;
    if (!node.prerequisites.includes(prerequisiteId)) {
      node.prerequisites.push(prerequisiteId);
    }
  }

  /**
   * DFS check to see if targetId is reachable from startId via prerequisites.
   */
  private canReach(startId: string, targetId: string, visited = new Set<string>()): boolean {
    if (startId === targetId) return true;
    if (visited.has(startId)) return false;
    visited.add(startId);

    const currentPrereqs = this.prerequisites.get(startId);
    if (!currentPrereqs) return false;

    for (const prereq of currentPrereqs) {
      if (this.canReach(prereq, targetId, visited)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retrieves all capability nodes in the graph.
   */
  public getAllCapabilities(): CapabilityNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Retrieves a single capability node by ID.
   */
  public getCapability(id: string): CapabilityNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Retrieves direct prerequisites for a given capability.
   */
  public getPrerequisites(id: string): string[] {
    const prereqs = this.prerequisites.get(id);
    return prereqs ? Array.from(prereqs) : [];
  }

  /**
   * Retrieves direct downstream dependents for a given capability.
   */
  public getDependents(id: string): string[] {
    const deps = this.dependents.get(id);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Evaluates capability state based on recorded evidence, recency, and proof weighting.
   * State transitions: UNTESTED -> EMERGING -> ESTABLISHED -> ROBUST (or REGRESSED).
   */
  public evaluateCapabilityState(
    capabilityId: string,
    newEvidences?: CapabilityEvidence[]
  ): CapabilityState {
    const node = this.nodes.get(capabilityId);
    if (!node) {
      throw new Error(`Capability "${capabilityId}" not found in graph.`);
    }

    if (newEvidences) {
      this.evidencesMap.set(capabilityId, newEvidences);
    }

    const evidences = this.evidencesMap.get(capabilityId) || [];
    if (evidences.length === 0) {
      node.state = 'UNTESTED';
      return 'UNTESTED';
    }

    // Check for explicit regression signal in evidence payload
    const hasRegression = evidences.some((ev) => {
      if (!ev.payload) return false;
      return (
        ev.payload.isRegressed === true ||
        ev.payload.status === 'FAILED' ||
        ev.payload.painScale > 7
      );
    });

    if (hasRegression) {
      node.state = 'REGRESSED';
      return 'REGRESSED';
    }

    // Calculate cumulative evidence score
    let totalWeightedScore = 0;
    const now = Date.now();

    for (const ev of evidences) {
      const recencyDays = Math.max(
        0,
        (now - new Date(ev.recordedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Recency weighting
      const recencyFactor =
        recencyDays <= 14 ? 1.0 : recencyDays <= 35 ? 0.8 : 0.5;

      // Proof type multiplier
      let proofMultiplier = 1.0;
      switch (ev.proofType) {
        case 'OUTCOME_VERIFICATION':
          proofMultiplier = 2.5;
          break;
        case 'PERFORMANCE_TEST':
          proofMultiplier = 1.8;
          break;
        case 'OBJECTIVE_METRIC':
          proofMultiplier = 1.4;
          break;
        case 'DELIVERABLE':
          proofMultiplier = 1.4;
          break;
        case 'SELF_REPORT':
          proofMultiplier = 0.8;
          break;
      }

      totalWeightedScore += (ev.confidenceWeight || 1.0) * recencyFactor * proofMultiplier;
    }

    let nextState: CapabilityState;
    if (totalWeightedScore >= 3.0 && evidences.length >= 2) {
      nextState = 'ROBUST';
    } else if (totalWeightedScore >= 1.2) {
      nextState = 'ESTABLISHED';
    } else if (totalWeightedScore >= 0.5) {
      nextState = 'EMERGING';
    } else {
      nextState = 'UNTESTED';
    }

    node.state = nextState;
    return nextState;
  }

  /**
   * Verifies if all prerequisites for this capability are satisfied.
   * A prerequisite is satisfied ONLY if it is 'ESTABLISHED' or 'ROBUST'.
   * If any prerequisite is 'UNTESTED', 'EMERGING', or 'REGRESSED', returns false.
   */
  public arePrerequisitesSatisfied(capabilityId: string): boolean {
    const prereqIds = this.prerequisites.get(capabilityId);
    if (!prereqIds || prereqIds.size === 0) {
      return true;
    }

    for (const prereqId of prereqIds) {
      const prereqNode = this.nodes.get(prereqId);
      if (!prereqNode) {
        return false;
      }
      if (prereqNode.state !== 'ESTABLISHED' && prereqNode.state !== 'ROBUST') {
        return false;
      }
    }

    return true;
  }

  /**
   * Returns capabilities in topological order (prerequisites before dependents).
   */
  public getTopologicalOrder(): CapabilityNode[] {
    const visited = new Set<string>();
    const temp = new Set<string>();
    const order: CapabilityNode[] = [];

    const visit = (nodeId: string) => {
      if (temp.has(nodeId)) {
        throw new Error(`Graph contains a cycle at node "${nodeId}".`);
      }
      if (!visited.has(nodeId)) {
        temp.add(nodeId);
        const prereqs = this.prerequisites.get(nodeId) || new Set();
        for (const prereq of prereqs) {
          visit(prereq);
        }
        temp.delete(nodeId);
        visited.add(nodeId);
        order.push(this.nodes.get(nodeId)!);
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId);
      }
    }

    return order;
  }

  /**
   * Generates 2-3 observable verification questions for active emerging or unestablished
   * capabilities whose prerequisites are satisfied, avoiding user cognitive overload.
   */
  public generateVerificationQuestions(): SimpleVerificationQuestion[] {
    const questions: SimpleVerificationQuestion[] = [];
    const candidates = this.getAllCapabilities().filter(
      (node) =>
        (node.state === 'UNTESTED' || node.state === 'EMERGING') &&
        this.arePrerequisitesSatisfied(node.id)
    );

    // Prioritize critical and high leverage capabilities
    candidates.sort((a, b) => {
      const tierRank: Record<CapabilityTier, number> = {
        TIER_1_CRITICAL: 1,
        TIER_2_HIGH_LEVERAGE: 2,
        TIER_3_SUPPORTIVE: 3,
        TIER_4_OPTIONAL: 4,
      };
      return tierRank[a.tier] - tierRank[b.tier];
    });

    for (const node of candidates.slice(0, 3)) {
      questions.push({
        capabilityId: node.id,
        capabilityName: node.name,
        question: `In your recent sessions, have you demonstrated "${node.name}" (${node.description})?`,
        expectedMetricUnit: node.targetMetric ? 'measurement' : undefined,
        verificationType: 'SELF_REPORT',
      });
    }

    return questions;
  }
}

/**
 * Persists an in-memory CapabilityStateGraph to Prisma database for a given userGoalId.
 */
export async function persistStateGraph(
  userGoalId: string,
  graph: CapabilityStateGraph
): Promise<void> {
  const capabilities = graph.getAllCapabilities();

  for (const node of capabilities) {
    const prereqIds = graph.getPrerequisites(node.id);
    await prisma.goalCapability.upsert({
      where: { id: node.id },
      update: {
        name: node.name,
        description: node.description,
        tier: node.tier,
        state: node.state,
        prerequisites_ids: prereqIds,
        target_metric: node.targetMetric ?? null,
        current_metric: node.metricValue ?? null,
      },
      create: {
        id: node.id,
        user_goal_id: userGoalId,
        name: node.name,
        description: node.description,
        tier: node.tier,
        state: node.state,
        prerequisites_ids: prereqIds,
        target_metric: node.targetMetric ?? null,
        current_metric: node.metricValue ?? null,
      },
    });
  }
}

/**
 * Loads a CapabilityStateGraph from Prisma database for a given userGoalId,
 * rebuilding the graph topology, wiring prerequisites, and evaluating states.
 */
export async function loadStateGraph(userGoalId: string): Promise<CapabilityStateGraph> {
  const records = await prisma.goalCapability.findMany({
    where: { user_goal_id: userGoalId },
    include: { evidences: true },
  });

  const graph = new CapabilityStateGraph();

  // 1. Add all nodes
  for (const record of records) {
    graph.addCapability({
      id: record.id,
      userGoalId: record.user_goal_id,
      name: record.name,
      description: record.description,
      tier: record.tier as CapabilityTier,
      state: record.state as CapabilityState,
      targetMetric: record.target_metric ?? undefined,
      metricValue: record.current_metric ?? undefined,
    });
  }

  // 2. Wire prerequisites
  for (const record of records) {
    const prereqIds = Array.isArray(record.prerequisites_ids)
      ? (record.prerequisites_ids as string[])
      : [];

    for (const prereqId of prereqIds) {
      if (graph.getCapability(prereqId)) {
        graph.addPrerequisite(record.id, prereqId);
      }
    }
  }

  // 3. Ingest evidences and evaluate states
  for (const record of records) {
    if (record.evidences && record.evidences.length > 0) {
      const typedEvidences: CapabilityEvidence[] = record.evidences.map((ev) => ({
        id: ev.id,
        capabilityId: ev.capability_id,
        proofType: ev.proof_type as any,
        payload: ev.payload,
        confidenceWeight: ev.confidence_weight,
        recordedAt: ev.recorded_at,
      }));
      graph.evaluateCapabilityState(record.id, typedEvidences);
    }
  }

  return graph;
}
