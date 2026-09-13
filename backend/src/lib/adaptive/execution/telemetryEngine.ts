import {
  ExecutionState,
  CapabilityState,
  ProofType,
} from '../core/types.js';
import { prisma } from '../../prisma.js';
import { loadStateGraph } from '../core/stateGraph.js';

export interface RecordExecutionTelemetryInput {
  executionState: ExecutionState;
  proofOfWorkText?: string;
  rpeRating?: number; // 1-10 Rate of Perceived Exertion
  durationMinutes?: number;
  notes?: string;
}

export interface TelemetryResult {
  sessionId: string;
  userGoalId: string;
  trajectoryItemId?: string | null;
  targetCapabilityId?: string | null;
  executionState: ExecutionState;
  doseAdequacy: number;
  proofOfWorkText?: string | null;
  telemetryData: any;
  recordedAt: Date;
}

export interface EvidenceIngestionResult {
  evidenceCreated: boolean;
  evidenceId?: string;
  capabilityId?: string;
  previousState?: CapabilityState;
  newState?: CapabilityState;
  stateTransitioned: boolean;
}

export interface AdherenceProfile {
  userGoalId: string;
  windowWeeks: number;
  totalSessions: number;
  completedCount: number;
  reducedCount: number;
  mvsCount: number;
  missedCount: number;
  taskCompletionRate: number;
  criticalPath: {
    total: number;
    executed: number;
    adherenceRate: number;
  };
  highLeverage: {
    total: number;
    executed: number;
    adherenceRate: number;
  };
  supportive: {
    total: number;
    executed: number;
    adherenceRate: number;
  };
  hasCriticalDisparity: boolean;
  disparityAnalysis?: string;
}

/**
 * Computes dose adequacy factor based on executed action state.
 */
export function computeDoseAdequacy(state: ExecutionState): number {
  switch (state) {
    case 'COMPLETED':
      return 1.0;
    case 'REDUCED':
      return 0.65;
    case 'MINIMUM_VIABLE':
      // Preserves behavioral continuity; discounts physiological/cognitive adaptation
      return 0.35;
    case 'REPLACED':
      return 0.85;
    case 'DEFERRED':
    case 'BLOCKED':
    case 'MISSED':
    default:
      return 0.0;
  }
}

/**
 * Records execution telemetry for a specific session in the database.
 */
export async function recordExecutionTelemetry(
  sessionId: string,
  data: RecordExecutionTelemetryInput
): Promise<TelemetryResult> {
  let session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    // Try resolving by trajectory_item_id
    session = await prisma.session.findFirst({
      where: { trajectory_item_id: sessionId },
    });
  }

  if (!session && sessionId.startsWith('mvd-')) {
    const rawId = sessionId.replace(/^mvd-(traj-)?/, '');
    session = await prisma.session.findFirst({
      where: {
        OR: [
          { id: rawId },
          { trajectory_item_id: rawId },
        ],
      },
    });
  }

  if (!session) {
    // Check if sessionId is a TrajectoryItem id
    const cleanId = sessionId.replace(/^mvd-(traj-)?/, '');
    const trajItem = await prisma.trajectoryItem.findUnique({
      where: { id: cleanId },
      include: { trajectory_version: true },
    });
    if (trajItem) {
      let taskTemplateId = (await prisma.taskTemplate.findFirst())?.id;
      if (!taskTemplateId) {
        let phase = await prisma.phase.findFirst();
        if (!phase) {
          let catalog = await prisma.goalCatalog.findFirst();
          if (!catalog) {
            catalog = await prisma.goalCatalog.create({
              data: {
                title: 'Adaptive Execution Catalog',
                description: 'Generated catalog',
                category: 'FITNESS',
                icon: 'compass',
                est_weekly_hours: 6,
              },
            });
          }
          phase = await prisma.phase.create({
            data: {
              goal_catalog_id: catalog.id,
              phase_order: 1,
              title: 'Phase 1: Foundation',
              duration_weeks: 4,
            },
          });
        }
        const tpl = await prisma.taskTemplate.create({
          data: {
            phase_id: phase.id,
            title: trajItem.intervention_name,
            sessions_per_week: 3,
            session_duration_minutes: trajItem.standard_duration_minutes,
          },
        });
        taskTemplateId = tpl.id;
      }

      session = await prisma.session.create({
        data: {
          user_goal_id: trajItem.trajectory_version.user_goal_id,
          task_template_id: taskTemplateId,
          trajectory_item_id: trajItem.id,
          scheduled_date: new Date(),
          status: 'UPCOMING',
          execution_state: 'PLANNED',
          tier: trajItem.priority_tier === 1 ? 'core' : trajItem.priority_tier === 2 ? 'buffer' : 'reflect',
        },
      });
    }
  }

  if (!session) {
    throw new Error(`Session with id "${sessionId}" not found.`);
  }

  const doseAdequacy = computeDoseAdequacy(data.executionState);
  const recordedAt = new Date();

  const telemetryPayload = {
    rpeRating: data.rpeRating ?? null,
    durationMinutes: data.durationMinutes ?? null,
    notes: data.notes ?? null,
    doseAdequacy,
    recordedAt: recordedAt.toISOString(),
  };

  // Sync with legacy status field for compatibility
  let updatedLegacyStatus = session.status;
  let completedAtUtc = session.completed_at_utc;

  if (
    data.executionState === 'COMPLETED' ||
    data.executionState === 'REDUCED' ||
    data.executionState === 'MINIMUM_VIABLE' ||
    data.executionState === 'REPLACED'
  ) {
    updatedLegacyStatus = 'DONE';
    completedAtUtc = recordedAt;
  } else if (data.executionState === 'MISSED') {
    updatedLegacyStatus = 'MISSED';
  }

  // Update session record
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      execution_state: data.executionState,
      proof_of_work_text: data.proofOfWorkText || null,
      telemetry_signals: telemetryPayload,
      status: updatedLegacyStatus,
      completed_at_utc: completedAtUtc,
    },
  });

  // Check if session has associated trajectory item to fetch target capability
  let targetCapabilityId: string | null = null;
  if (session.trajectory_item_id) {
    const trajItem = await prisma.trajectoryItem.findUnique({
      where: { id: session.trajectory_item_id },
    });
    targetCapabilityId = trajItem?.target_capability_id || null;
  }

  return {
    sessionId: session.id,
    userGoalId: session.user_goal_id,
    trajectoryItemId: session.trajectory_item_id,
    targetCapabilityId,
    executionState: data.executionState,
    doseAdequacy,
    proofOfWorkText: data.proofOfWorkText || null,
    telemetryData: telemetryPayload,
    recordedAt,
  };
}

/**
 * Ingests evidence from telemetry into the capability state graph.
 * If proof-of-work or high dose is demonstrated, creates a CapabilityEvidence record,
 * re-evaluates the capability state, and updates the database if state transitions.
 */
export async function ingestEvidenceFromTelemetry(
  userGoalId: string,
  telemetry: TelemetryResult
): Promise<EvidenceIngestionResult> {
  // If no target capability or zero dose execution, no capability state change
  if (telemetry.doseAdequacy <= 0) {
    return { evidenceCreated: false, stateTransitioned: false };
  }

  let targetCapabilityId = telemetry.targetCapabilityId;

  // If not explicitly set on trajectory item, resolve to user's active bottleneck capability or first capability
  if (!targetCapabilityId) {
    const activeGoal = await prisma.userGoal.findUnique({
      where: { id: userGoalId },
      include: { capabilities: true },
    });

    if (activeGoal?.active_bottleneck_capability_id) {
      targetCapabilityId = activeGoal.active_bottleneck_capability_id;
    } else if (activeGoal?.capabilities && activeGoal.capabilities.length > 0) {
      targetCapabilityId = activeGoal.capabilities[0].id;
    }
  }

  if (!targetCapabilityId) {
    return { evidenceCreated: false, stateTransitioned: false };
  }

  const capabilityRecord = await prisma.goalCapability.findUnique({
    where: { id: targetCapabilityId },
  });

  if (!capabilityRecord) {
    return { evidenceCreated: false, stateTransitioned: false };
  }

  const previousState = capabilityRecord.state as CapabilityState;

  // Determine proof type and confidence weight
  const proofText = telemetry.proofOfWorkText?.toLowerCase() || '';
  let proofType: ProofType = 'SELF_REPORT';

  if (
    proofText.includes('test') ||
    proofText.includes('pace') ||
    proofText.includes('benchmark') ||
    proofText.includes('split') ||
    proofText.includes('chip') ||
    proofText.includes('km') ||
    proofText.includes('score')
  ) {
    proofType = 'PERFORMANCE_TEST';
  } else if (proofText.includes('http') || proofText.includes('deploy') || proofText.includes('pr')) {
    proofType = 'DELIVERABLE';
  } else if (telemetry.telemetryData?.durationMinutes) {
    proofType = 'OBJECTIVE_METRIC';
  }

  // Weight is discounted by dose adequacy (e.g. MVS 0.35 avoids false capability inflation)
  const baseWeight = proofType === 'PERFORMANCE_TEST' || proofType === 'DELIVERABLE' ? 1.0 : 0.8;
  const confidenceWeight = Math.round(baseWeight * telemetry.doseAdequacy * 100) / 100;

  // Create evidence record in DB
  const createdEvidence = await prisma.capabilityEvidence.create({
    data: {
      capability_id: targetCapabilityId,
      proof_type: proofType,
      confidence_weight: confidenceWeight,
      recorded_at: telemetry.recordedAt,
      payload: {
        sessionId: telemetry.sessionId,
        executionState: telemetry.executionState,
        proofOfWorkText: telemetry.proofOfWorkText,
        telemetrySignals: telemetry.telemetryData,
      },
    },
  });

  // Re-evaluate capability state in state graph
  const graph = await loadStateGraph(userGoalId);
  const newState = graph.evaluateCapabilityState(targetCapabilityId);

  const stateTransitioned = newState !== previousState;

  if (stateTransitioned) {
    await prisma.goalCapability.update({
      where: { id: targetCapabilityId },
      data: { state: newState },
    });
  }

  return {
    evidenceCreated: true,
    evidenceId: createdEvidence.id,
    capabilityId: targetCapabilityId,
    previousState,
    newState,
    stateTransitioned,
  };
}

/**
 * Computes the Adherence Profile for a user goal, distinguishing critical-path execution
 * from total checklist completion to prevent false senses of security.
 */
export async function getAdherenceProfile(
  userGoalId: string,
  windowWeeks = 4
): Promise<AdherenceProfile> {
  const sessions = await prisma.session.findMany({
    where: { user_goal_id: userGoalId },
  });

  const totalSessions = sessions.length;
  let completedCount = 0;
  let reducedCount = 0;
  let mvsCount = 0;
  let missedCount = 0;

  let criticalTotal = 0;
  let criticalExecuted = 0;

  let highLeverageTotal = 0;
  let highLeverageExecuted = 0;

  let supportiveTotal = 0;
  let supportiveExecuted = 0;

  for (const session of sessions) {
    const isExecuted =
      session.execution_state === 'COMPLETED' ||
      session.execution_state === 'REDUCED' ||
      session.execution_state === 'MINIMUM_VIABLE' ||
      session.status === 'DONE';

    if (session.execution_state === 'COMPLETED' || session.status === 'DONE') completedCount++;
    if (session.execution_state === 'REDUCED') reducedCount++;
    if (session.execution_state === 'MINIMUM_VIABLE') mvsCount++;
    if (session.execution_state === 'MISSED' || session.status === 'MISSED') missedCount++;

    if (session.tier === 'core') {
      criticalTotal++;
      if (isExecuted) criticalExecuted++;
    } else if (session.tier === 'buffer') {
      highLeverageTotal++;
      if (isExecuted) highLeverageExecuted++;
    } else {
      supportiveTotal++;
      if (isExecuted) supportiveExecuted++;
    }
  }

  const taskCompletionRate = totalSessions > 0 ? (completedCount + reducedCount + mvsCount) / totalSessions : 1.0;
  const criticalAdherenceRate = criticalTotal > 0 ? criticalExecuted / criticalTotal : 1.0;
  const highLeverageAdherenceRate = highLeverageTotal > 0 ? highLeverageExecuted / highLeverageTotal : 1.0;
  const supportiveAdherenceRate = supportiveTotal > 0 ? supportiveExecuted / supportiveTotal : 1.0;

  // Diagnostic disparity flag: Completing superficial work while neglecting the critical path bottleneck
  const hasCriticalDisparity = taskCompletionRate >= 0.70 && criticalAdherenceRate < 0.60;
  let disparityAnalysis: string | undefined;

  if (hasCriticalDisparity) {
    disparityAnalysis = `Warning: High overall task completion (${Math.round(
      taskCompletionRate * 100
    )}%) masks critical-path failure (${Math.round(
      criticalAdherenceRate * 100
    )}% critical adherence). The primary capability bottleneck is being starved of required adaptation.`;
  }

  return {
    userGoalId,
    windowWeeks,
    totalSessions,
    completedCount,
    reducedCount,
    mvsCount,
    missedCount,
    taskCompletionRate: Math.round(taskCompletionRate * 100) / 100,
    criticalPath: {
      total: criticalTotal,
      executed: criticalExecuted,
      adherenceRate: Math.round(criticalAdherenceRate * 100) / 100,
    },
    highLeverage: {
      total: highLeverageTotal,
      executed: highLeverageExecuted,
      adherenceRate: Math.round(highLeverageAdherenceRate * 100) / 100,
    },
    supportive: {
      total: supportiveTotal,
      executed: supportiveExecuted,
      adherenceRate: Math.round(supportiveAdherenceRate * 100) / 100,
    },
    hasCriticalDisparity,
    disparityAnalysis,
  };
}
