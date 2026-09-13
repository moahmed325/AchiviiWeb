import {
  RescheduleActionType,
  DecisionTrace,
  DiagnosticRecord,
} from '../core/types.js';
import { prisma } from '../../prisma.js';
import { loadStateGraph } from '../core/stateGraph.js';
import {
  identifyCriticalPath,
  identifyCurrentBottleneck,
} from '../strategy/bottleneckEngine.js';
import { calculateMED } from '../strategy/capacityModel.js';

export interface CandidateRoute {
  action: RescheduleActionType;
  description: string;
  projectedCompletionDate: Date;
  successProbability: number;
  weeklyWorkloadMinutes: number;
  tradeOffs: string;
  isFeasible: boolean;
}

export interface ReplanResult {
  userGoalId: string;
  previousTrajectoryVersionId?: string | null;
  newTrajectoryVersionId: string;
  newVersionNumber: number;
  primaryAction: RescheduleActionType;
  selectedRoute: CandidateRoute;
  candidateRoutes: CandidateRoute[];
  decisionTrace: DecisionTrace;
  newProjectedCompletion: Date;
  goalPreserved: boolean;
}

/**
 * The Adaptive Rescheduler: Core Closed-Loop Decision Engine.
 *
 * Fundamental Laws:
 * 1. "Never reschedule from the old calendar. Replan from current state."
 * 2. "The No-Debt Principle": Missed work is not debt. Never pile missed sessions into upcoming weeks.
 * 3. "Preserve the Destination; Adapt the Route": Destination stays protected.
 * 4. "Hard vs. Soft Deadlines": Hard deadlines optimize within fixed runway without moving dates;
 *    Soft deadlines extend completion dates transparently when scientifically warranted.
 */
export async function replanFromCurrentState(
  userGoalId: string,
  diagnosticRecord?: DiagnosticRecord
): Promise<ReplanResult> {
  // Step 1: Query verified state and active goal context
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: true,
      trajectory_versions: {
        where: { is_active: true },
        include: { items: true },
        orderBy: { version_number: 'desc' },
        take: 1,
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  const activeTrajectory = userGoal.trajectory_versions[0];
  const previousVersionNumber = activeTrajectory ? activeTrajectory.version_number : 0;
  const newVersionNumber = previousVersionNumber + 1;

  // Step 2: Load capability DAG and recalculate critical path & bottleneck
  const graph = await loadStateGraph(userGoalId);
  const allCapabilities = graph.getAllCapabilities();

  // Target node is the final capstone capability (or highest tier outcome)
  const targetNode =
    allCapabilities.length > 0
      ? allCapabilities[allCapabilities.length - 1]
      : {
          id: 'target-capstone',
          name: userGoal.outcome_statement || 'Goal Outcome',
          userGoalId,
          description: 'Destination outcome',
          tier: 'TIER_1_CRITICAL' as const,
          state: 'UNTESTED' as const,
          prerequisites: [],
        };

  if (!graph.getCapability(targetNode.id)) {
    graph.addCapability(targetNode);
  }

  const criticalPath = identifyCriticalPath(graph, targetNode.id);
  const currentBottleneck = identifyCurrentBottleneck(criticalPath) || targetNode;

  // Update active bottleneck in UserGoal
  await prisma.userGoal.update({
    where: { id: userGoalId },
    data: { active_bottleneck_capability_id: currentBottleneck.id },
  });

  // Step 3: Recheck sustainable capacity and remaining runway
  const sustainableCapacityHours = userGoal.sustainable_weekly_capacity_hours;
  const sustainableCapacityMinutes = Math.round(sustainableCapacityHours * 60);

  const startDate = new Date(userGoal.start_date);
  const now = new Date();
  const daysElapsed = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const totalPlanDays = 90; // 90-Day Execution System
  const remainingDays = Math.max(7, totalPlanDays - daysElapsed);

  // Compute MED for remaining bottleneck
  const medCalculation = calculateMED(
    currentBottleneck,
    remainingDays,
    userGoal.goal_catalog_id ? 'PHYSICAL' : 'COGNITIVE'
  );
  const medMinutes = medCalculation.medWeeklyMinutes;

  const isHardDeadline = userGoal.deadline_type === 'HARD';
  const baselineTargetDate = new Date(userGoal.target_end_date || startDate.getTime() + totalPlanDays * 24 * 60 * 60 * 1000);

  // Step 4: Evaluate Candidate Routes across the 6 Actions
  const candidateRoutes: CandidateRoute[] = [];

  // Route 1: RESUME
  const canResume =
    !diagnosticRecord?.isPersistent &&
    currentBottleneck.state !== 'REGRESSED' &&
    sustainableCapacityMinutes >= medMinutes;

  candidateRoutes.push({
    action: 'RESUME',
    description: 'Continue the current trajectory without workload modification.',
    projectedCompletionDate: baselineTargetDate,
    successProbability: canResume ? 0.82 : 0.45,
    weeklyWorkloadMinutes: medMinutes,
    tradeOffs: 'Absorbs recent deviation without changes; requires immediate adherence resumption.',
    isFeasible: canResume,
  });

  // Route 2: COMPRESS
  // Fit remaining critical work into tighter high-efficiency sessions within safe limits
  const compressedMinutes = Math.max(180, Math.round(medMinutes * 0.85));
  candidateRoutes.push({
    action: 'COMPRESS',
    description: 'Compress essential work into higher-density sessions preserving core stimulus.',
    projectedCompletionDate: baselineTargetDate,
    successProbability: 0.86,
    weeklyWorkloadMinutes: compressedMinutes,
    tradeOffs: 'Reduced total volume, higher focus on critical bottleneck; eliminates non-essential exercises.',
    isFeasible: sustainableCapacityMinutes >= compressedMinutes,
  });

  // Route 3: REORDER
  candidateRoutes.push({
    action: 'REORDER',
    description: 'Re-sequence interventions to prioritize unblocked parallel capabilities.',
    projectedCompletionDate: baselineTargetDate,
    successProbability: 0.78,
    weeklyWorkloadMinutes: medMinutes,
    tradeOffs: 'Advances parallel technical capabilities while bottleneck recovers.',
    isFeasible: true,
  });

  // Route 4: REPLACE
  candidateRoutes.push({
    action: 'REPLACE',
    description: 'Substitute original intervention with an equivalent targeting the same capability.',
    projectedCompletionDate: baselineTargetDate,
    successProbability: 0.80,
    weeklyWorkloadMinutes: medMinutes,
    tradeOffs: 'Substitutes intervention format (e.g. low-impact simulation or home-based alternative).',
    isFeasible: true,
  });

  // Route 5: REMOVE
  // Prune lower-tier supportive/optional sessions to strictly fit reduced capacity
  const prunedMinutes = Math.min(sustainableCapacityMinutes, Math.round(medMinutes * 0.75));
  candidateRoutes.push({
    action: 'REMOVE',
    description: 'Prune Tier 3 supportive and Tier 2 sessions to fit reduced capacity and protect the critical path.',
    projectedCompletionDate: baselineTargetDate,
    successProbability: sustainableCapacityMinutes < medMinutes ? 0.76 : 0.72,
    weeklyWorkloadMinutes: prunedMinutes,
    tradeOffs: 'Sacrifices auxiliary and maintenance volume to ensure primary bottleneck is never missed.',
    isFeasible: true,
  });

  // Route 6: EXTEND
  const extendedDays = isHardDeadline ? 0 : 12; // e.g. Day 84 -> Day 96 (or Day 90 -> Day 102)
  const extendedCompletionDate = new Date(baselineTargetDate.getTime() + extendedDays * 24 * 60 * 60 * 1000);

  if (isHardDeadline) {
    candidateRoutes.push({
      action: 'EXTEND',
      description: 'Timeline extension requested on a HARD deadline.',
      projectedCompletionDate: baselineTargetDate,
      successProbability: 0.1,
      weeklyWorkloadMinutes: medMinutes,
      tradeOffs: 'Rejected: Goal has an immovable hard deadline (race or fixed launch). Date cannot be moved.',
      isFeasible: false,
    });
  } else {
    candidateRoutes.push({
      action: 'EXTEND',
      description: 'Extend projected completion date to preserve destination without cramming excessive volume.',
      projectedCompletionDate: extendedCompletionDate,
      successProbability: 0.90, // Highest confidence because destination is preserved and runway is relaxed
      weeklyWorkloadMinutes: Math.round(medMinutes * 0.8),
      tradeOffs: `Projected completion moved by ${extendedDays} days. Goal destination remains 100% intact.`,
      isFeasible: true,
    });
  }

  // Step 5: Route Scoring and Winning Selection
  // Filter to feasible routes
  const feasibleRoutes = candidateRoutes.filter((r) => r.isFeasible);

  // Preference order guided by diagnostic and capacity constraints:
  // - If persistent capacity reduction: REMOVE is favored
  // - If soft deadline and high time pressure: EXTEND is favored
  // - If temporary illness / recovery: COMPRESS is favored
  // - Otherwise: pick highest successProbability
  feasibleRoutes.sort((a, b) => {
    if (diagnosticRecord?.proposedAction) {
      if (a.action === diagnosticRecord.proposedAction) return -1;
      if (b.action === diagnosticRecord.proposedAction) return 1;
    }
    if (diagnosticRecord?.isPersistent && diagnosticRecord.category === 'CAPACITY') {
      if (a.action === 'REMOVE') return -1;
      if (b.action === 'REMOVE') return 1;
    }
    if (!isHardDeadline && (sustainableCapacityMinutes < medMinutes || diagnosticRecord?.category === 'RECOVERY')) {
      if (a.action === 'EXTEND') return -1;
      if (b.action === 'EXTEND') return 1;
    }
    if (isHardDeadline) {
      if (a.action === 'COMPRESS') return -1;
      if (b.action === 'COMPRESS') return 1;
    }
    return b.successProbability - a.successProbability;
  });

  const selectedRoute = feasibleRoutes[0] || candidateRoutes[0];

  // Step 6: Generate Trajectory v(N+1) with No-Debt Invariant
  if (activeTrajectory) {
    await prisma.trajectoryVersion.update({
      where: { id: activeTrajectory.id },
      data: { is_active: false },
    });
  }

  const newTrajectory = await prisma.trajectoryVersion.create({
    data: {
      user_goal_id: userGoalId,
      version_number: newVersionNumber,
      trigger_type: diagnosticRecord ? `DIAGNOSTIC_${diagnosticRecord.category}` : 'ADAPTIVE_REPLAN',
      projected_completion: selectedRoute.projectedCompletionDate,
      confidence_score: selectedRoute.successProbability,
      is_active: true,
    },
  });

  // Generate new items for remaining weeks (No-Debt: 3-4 sessions per week, never adding missed backlog)
  const remainingWeeks = Math.max(1, Math.ceil(remainingDays / 7));
  const sessionsPerWeek = selectedRoute.weeklyWorkloadMinutes >= 240 ? 4 : 3;
  const sessionDuration = Math.max(20, Math.floor(selectedRoute.weeklyWorkloadMinutes / sessionsPerWeek));

  for (let w = 1; w <= remainingWeeks; w++) {
    for (let s = 0; s < sessionsPerWeek; s++) {
      const isCritical = s === 0;
      await prisma.trajectoryItem.create({
        data: {
          trajectory_version_id: newTrajectory.id,
          target_capability_id: currentBottleneck.id,
          intervention_name: isCritical
            ? `Re-routed Critical Focus: ${currentBottleneck.name}`
            : `Supportive Session ${s + 1}`,
          planned_week: w,
          priority_tier: isCritical ? 1 : 2,
          standard_duration_minutes: sessionDuration,
          reduced_duration_minutes: Math.max(15, Math.round(sessionDuration * 0.65)),
          mvs_duration_minutes: Math.max(15, Math.round(sessionDuration * 0.40)),
          fallback_options: [
            `20m minimum session for ${currentBottleneck.name}`,
            'Low-friction active recovery alternative',
          ],
        },
      });
    }
  }

  // Update UserGoal projected completion
  await prisma.userGoal.update({
    where: { id: userGoalId },
    data: {
      projected_completion_date: selectedRoute.projectedCompletionDate,
      current_med_hours: Math.round((selectedRoute.weeklyWorkloadMinutes / 60) * 10) / 10,
    },
  });

  // Step 7: Create DecisionTrace and ReplanAudit record
  const decisionTrace: DecisionTrace = {
    trigger: diagnosticRecord
      ? `Diagnostic event: ${diagnosticRecord.category} (${diagnosticRecord.triggerReason})`
      : 'Material disruption detected along critical path',
    observation: `Active bottleneck is "${currentBottleneck.name}" (State: ${currentBottleneck.state}). Sustainable capacity is ${sustainableCapacityHours}h/wk.`,
    diagnosis: diagnosticRecord
      ? diagnosticRecord.details
      : 'Execution variance threatens trajectory continuity.',
    assumptions: [
      `User can execute ${Math.round(selectedRoute.weeklyWorkloadMinutes / 60)}h/wk reliably going forward`,
      'Critical bottleneck receives prioritized adaptation focus',
      'No-debt rule applied: missed volume absorbed rather than compounded into debt',
    ],
    optionsConsidered: candidateRoutes.map(
      (r) => `${r.action}: ${r.description} (Probability: ${Math.round(r.successProbability * 100)}%)`
    ),
    decision: `Selected ${selectedRoute.action}: ${selectedRoute.description}`,
    tradeOff: selectedRoute.tradeOffs,
    forecastEffect: `Projected completion is ${selectedRoute.projectedCompletionDate.toISOString().split('T')[0]}. Success probability is ${Math.round(selectedRoute.successProbability * 100)}%.`,
    nextAction: `Execute next session: 45m focused on ${currentBottleneck.name}. No catch-up required.`,
  };

  await prisma.replanAudit.create({
    data: {
      user_goal_id: userGoalId,
      from_trajectory_id: activeTrajectory ? activeTrajectory.id : null,
      to_trajectory_id: newTrajectory.id,
      primary_action: selectedRoute.action,
      decision_trace: decisionTrace as any,
    },
  });

  return {
    userGoalId,
    previousTrajectoryVersionId: activeTrajectory?.id || null,
    newTrajectoryVersionId: newTrajectory.id,
    newVersionNumber,
    primaryAction: selectedRoute.action,
    selectedRoute,
    candidateRoutes,
    decisionTrace,
    newProjectedCompletion: selectedRoute.projectedCompletionDate,
    goalPreserved: true,
  };
}
