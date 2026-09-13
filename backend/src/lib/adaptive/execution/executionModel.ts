import {
  ExecutionObject,
  ExecutionState,
} from '../core/types.js';

export interface CreateExecutionObjectParams {
  id?: string;
  trajectoryItemId: string;
  userGoalId: string;
  targetCapabilityId: string;
  actionName: string;
  purpose: string;
  priorityTier: number;
  standardDoseMinutes: number;
  reducedDoseMinutes?: number;
  mvsDoseMinutes?: number;
  fallbackOptions?: string[];
  executionState?: ExecutionState;
  scheduledDate?: Date;
  startTime?: string;
  endTime?: string;
}

/**
 * Valid execution state transitions in the action state machine:
 * PLANNED -> READY -> INITIATED -> COMPLETED / REDUCED / MINIMUM_VIABLE / REPLACED
 * (with fallback branches to DEFERRED, BLOCKED, MISSED)
 */
export const VALID_EXECUTION_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  PLANNED: ['READY', 'DEFERRED', 'BLOCKED', 'MISSED', 'COMPLETED'],
  READY: ['INITIATED', 'DEFERRED', 'BLOCKED', 'MISSED', 'COMPLETED', 'REDUCED', 'MINIMUM_VIABLE', 'REPLACED'],
  INITIATED: ['COMPLETED', 'REDUCED', 'MINIMUM_VIABLE', 'REPLACED', 'BLOCKED', 'MISSED'],
  COMPLETED: [],
  REDUCED: [],
  MINIMUM_VIABLE: [],
  REPLACED: [],
  DEFERRED: ['READY', 'PLANNED', 'MISSED'],
  BLOCKED: ['READY', 'DEFERRED', 'MISSED'],
  MISSED: ['READY', 'REPLACED'],
};

export function canTransitionExecutionState(from: ExecutionState, to: ExecutionState): boolean {
  if (from === to) return true;
  return VALID_EXECUTION_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Creates an ExecutionObject with calculated dose gradients:
 * - Standard: Target adaptation stimulus
 * - Reduced: 60-70% dose preserving core adaptation
 * - Minimum Viable Session (MVS): Smallest valid continuity dose (35-45%)
 * - Fallbacks: Low-friction equivalent alternatives
 */
export function createExecutionObject(params: CreateExecutionObjectParams): ExecutionObject {
  const standardDose = Math.max(15, params.standardDoseMinutes);
  const reducedDose = params.reducedDoseMinutes
    ? Math.max(15, params.reducedDoseMinutes)
    : Math.max(15, Math.round(standardDose * 0.65));
  const mvsDose = params.mvsDoseMinutes
    ? Math.max(15, params.mvsDoseMinutes)
    : Math.max(15, Math.round(standardDose * 0.40));

  const fallbackOptions =
    params.fallbackOptions && params.fallbackOptions.length > 0
      ? params.fallbackOptions
      : [
          `Low-friction equivalent: 20m indoor session targeting ${params.actionName}`,
          'Active recovery walk or mental rehearsal simulation',
        ];

  return {
    id: params.id || `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    trajectoryItemId: params.trajectoryItemId,
    userGoalId: params.userGoalId,
    targetCapabilityId: params.targetCapabilityId,
    actionName: params.actionName,
    purpose: params.purpose,
    priorityTier: params.priorityTier,
    standardDoseMinutes: standardDose,
    reducedDoseMinutes: reducedDose,
    mvsDoseMinutes: mvsDose,
    fallbackOptions,
    executionState: params.executionState || 'PLANNED',
    scheduledDate: params.scheduledDate,
    startTime: params.startTime,
    endTime: params.endTime,
  };
}
