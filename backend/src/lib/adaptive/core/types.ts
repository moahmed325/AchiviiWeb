export type DeadlineType = 'HARD' | 'SOFT';

export type GoalDomain = 'PHYSICAL' | 'COGNITIVE' | 'PROJECT';

export interface GoalDefinition {
  outcomeStatement: string;
  verificationCriteria: string;
  deadlineType: DeadlineType;
  targetDate: Date;
  domain: GoalDomain;
}

export interface GoalFormalizationResult {
  concreteOutcomeStatement: string;
  verificationCriteria: string;
  deadlineType: DeadlineType;
  baselineQuestions: string[];
  domain: GoalDomain;
  targetDeadline: Date;
  isFallback: boolean;
}

export type FeasibilityZone = 'GREEN' | 'YELLOW' | 'RED';

export interface FeasibilityAssessment {
  zone: FeasibilityZone;
  score: number;
  bottleneckRisks: string[];
  recommendations: string[];
}

export type CapabilityTier =
  | 'TIER_1_CRITICAL'
  | 'TIER_2_HIGH_LEVERAGE'
  | 'TIER_3_SUPPORTIVE'
  | 'TIER_4_OPTIONAL';

export type CapabilityState =
  | 'UNTESTED'
  | 'EMERGING'
  | 'ESTABLISHED'
  | 'ROBUST'
  | 'REGRESSED';

export interface CapabilityNode {
  id: string;
  userGoalId: string;
  name: string;
  description: string;
  tier: CapabilityTier;
  state: CapabilityState;
  prerequisites: string[];
  metricValue?: number;
  targetMetric?: number;
}

export interface SimpleVerificationQuestion {
  capabilityId: string;
  capabilityName: string;
  question: string;
  expectedMetricUnit?: string;
  verificationType: ProofType;
}

export type ProofType =
  | 'SELF_REPORT'
  | 'OBJECTIVE_METRIC'
  | 'DELIVERABLE'
  | 'PERFORMANCE_TEST'
  | 'OUTCOME_VERIFICATION';

export interface CapabilityEvidence {
  id: string;
  capabilityId: string;
  proofType: ProofType;
  payload: any;
  confidenceWeight: number;
  recordedAt: Date;
}

export interface CapacityModel {
  sustainableWeeklyHours: number;
  medHours: number;
  reliabilityMarginHours: number;
  maxSessionDurationMinutes: number;
}

export type ExecutionState =
  | 'PLANNED'
  | 'READY'
  | 'INITIATED'
  | 'COMPLETED'
  | 'REDUCED'
  | 'MINIMUM_VIABLE'
  | 'REPLACED'
  | 'DEFERRED'
  | 'BLOCKED'
  | 'MISSED';

export interface ExecutionObject {
  id: string;
  trajectoryItemId: string;
  userGoalId: string;
  targetCapabilityId: string;
  actionName: string;
  purpose: string;
  priorityTier: number;
  standardDoseMinutes: number;
  reducedDoseMinutes: number;
  mvsDoseMinutes: number;
  fallbackOptions: string[];
  executionState: ExecutionState;
  scheduledDate?: Date;
  startTime?: string;
  endTime?: string;
}

export type TelemetrySignalType =
  | 'COMPLETION'
  | 'PERFORMANCE'
  | 'EFFORT_RPE'
  | 'FRICTION'
  | 'PROOF_OF_WORK';

export interface TelemetrySignal {
  type: TelemetrySignalType;
  value: any;
  timestamp: Date;
}

export type DiagnosticCategory =
  | 'CAPACITY'
  | 'CAPABILITY'
  | 'RECOVERY'
  | 'FRICTION'
  | 'MOTIVATION'
  | 'EXTERNAL';

export type RescheduleActionType =
  | 'RESUME'
  | 'COMPRESS'
  | 'REORDER'
  | 'REPLACE'
  | 'REMOVE'
  | 'EXTEND';

export interface DiagnosticRecord {
  triggerReason: string;
  category: DiagnosticCategory;
  details: string;
  isPersistent: boolean;
  proposedAction: RescheduleActionType;
}

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface TrajectoryVersion {
  id: string;
  userGoalId: string;
  versionNumber: number;
  trigger: string;
  items: any[];
  projectedCompletionDate: Date;
  confidence: ConfidenceLevel;
}

export interface DecisionTrace {
  trigger: string;
  observation: string;
  diagnosis: string;
  assumptions: string[];
  optionsConsidered: string[];
  decision: string;
  tradeOff: string;
  forecastEffect: string;
  nextAction: string;
}

export type GoalIntegrityStatus =
  | 'INTACT'
  | 'AT_RISK'
  | 'COMPROMISED'
  | 'REVISED';
