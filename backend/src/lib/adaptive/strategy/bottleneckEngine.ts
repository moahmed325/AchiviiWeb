import { CapabilityNode } from '../core/types.js';
import { CapabilityStateGraph } from '../core/stateGraph.js';

/**
 * Identifies the critical path of capabilities leading to the target outcome node.
 * Uses reverse traversal along prerequisites from targetOutcomeId, returning
 * all unestablished or constraining capabilities in topological execution order.
 */
export function identifyCriticalPath(
  graph: CapabilityStateGraph,
  targetOutcomeId: string
): CapabilityNode[] {
  const targetNode = graph.getCapability(targetOutcomeId);
  if (!targetNode) {
    throw new Error(`Target outcome node "${targetOutcomeId}" not found in capability graph.`);
  }

  // Set of all node IDs that are ancestors of targetOutcomeId (including targetOutcomeId)
  const criticalNodeIds = new Set<string>();

  const collectAncestors = (nodeId: string) => {
    if (criticalNodeIds.has(nodeId)) return;
    criticalNodeIds.add(nodeId);

    const prereqs = graph.getPrerequisites(nodeId);
    for (const prereqId of prereqs) {
      collectAncestors(prereqId);
    }
  };

  collectAncestors(targetOutcomeId);

  // Return nodes in topological order (earliest prerequisite first)
  const fullOrder = graph.getTopologicalOrder();
  return fullOrder.filter((node) => criticalNodeIds.has(node.id));
}

/**
 * Identifies the current limiting bottleneck along the critical path.
 * The bottleneck is the earliest unsatisfied prerequisite along the critical path
 * that most constrains outcome probability.
 */
export function identifyCurrentBottleneck(criticalPath: CapabilityNode[]): CapabilityNode | null {
  if (criticalPath.length === 0) {
    return null;
  }

  // Filter to unestablished or regressed nodes
  const unestablishedNodes = criticalPath.filter(
    (node) => node.state !== 'ESTABLISHED' && node.state !== 'ROBUST'
  );

  if (unestablishedNodes.length === 0) {
    // All prerequisites established; target outcome itself is the final gate if not yet robust
    const lastNode = criticalPath[criticalPath.length - 1];
    return lastNode.state !== 'ROBUST' ? lastNode : null;
  }

  // Tier ranking priority
  const tierWeights = {
    TIER_1_CRITICAL: 1,
    TIER_2_HIGH_LEVERAGE: 2,
    TIER_3_SUPPORTIVE: 3,
    TIER_4_OPTIONAL: 4,
  };

  // State urgency: REGRESSED > UNTESTED > EMERGING
  const stateUrgency = {
    REGRESSED: 1,
    UNTESTED: 2,
    EMERGING: 3,
    ESTABLISHED: 4,
    ROBUST: 5,
  };

  // Candidate sorting:
  // 1. Earlier in critical path topological sequence
  // 2. Critical tier over lower tier
  // 3. More severe unestablished state
  const candidates = [...unestablishedNodes];
  candidates.sort((a, b) => {
    // If one is REGRESSED, it is an urgent regression on the critical path
    if (a.state === 'REGRESSED' && b.state !== 'REGRESSED') return -1;
    if (b.state === 'REGRESSED' && a.state !== 'REGRESSED') return 1;

    // Topological sequence: earliest unsatisfied prerequisite along critical path is the constraint
    const topoDiff = criticalPath.indexOf(a) - criticalPath.indexOf(b);
    if (topoDiff !== 0) return topoDiff;

    const tierDiff = tierWeights[a.tier] - tierWeights[b.tier];
    if (tierDiff !== 0) return tierDiff;

    const urgencyDiff = stateUrgency[a.state] - stateUrgency[b.state];
    if (urgencyDiff !== 0) return urgencyDiff;

    return 0;
  });

  return candidates[0] || null;
}

/**
 * Detects if the limiting bottleneck has shifted between evaluations.
 */
export function detectBottleneckShift(
  previousBottleneckId: string | null,
  currentBottleneckId: string | null
): boolean {
  return previousBottleneckId !== currentBottleneckId;
}
