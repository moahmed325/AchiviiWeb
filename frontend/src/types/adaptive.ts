// =============================================================================
// Adaptive 90-Day Execution System — Canonical Frontend Domain Types
// =============================================================================
// Mirrored from backend/src/lib/adaptive/core/types.ts and engine return types.
// Dates are serialized as ISO strings (JSON transport layer).
// This file is the single source of truth for the adaptive type system on the frontend.
// =============================================================================

// ---------------------------------------------------------------------------
// Core Enums / Union Types
// ---------------------------------------------------------------------------

export type DeadlineType = 'HARD' | 'SOFT';

export type GoalDomain = 'PHYSICAL' | 'COGNITIVE' | 'PROJECT';

export type FeasibilityZone = 'GREEN' | 'YELLOW' | 'RED';

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

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';

export type GoalIntegrityStatus =
  | 'INTACT'
  | 'AT_RISK'
  | 'COMPROMISED'
  | 'REVISED';

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

export type ProofType =
  | 'SELF_REPORT'
  | 'OBJECTIVE_METRIC'
  | 'DELIVERABLE'
  | 'PERFORMANCE_TEST'
  | 'OUTCOME_VERIFICATION';

export type DeviationSeverity =
  | 'NONE'
  | 'SILENT_ABSORPTION'
  | 'MINOR_ABSORB'
  | 'MATERIAL_DISRUPTION';

export type TelemetrySignalType =
  | 'COMPLETION'
  | 'PERFORMANCE'
  | 'EFFORT_RPE'
  | 'FRICTION'
  | 'PROOF_OF_WORK';

// ---------------------------------------------------------------------------
// Core Domain Interfaces
// ---------------------------------------------------------------------------

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
  scheduledDate?: string; // ISO date string
  startTime?: string;     // HH:MM
  endTime?: string;       // HH:MM
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

export interface FeasibilityAssessment {
  zone: FeasibilityZone;
  score: number;
  bottleneckRisks: string[];
  recommendations: string[];
}

export interface CustomBaselineOption {
  value: string;
  label: string;
  score?: number;
  recommended_weekly_hours?: number;
}

export interface CustomBaselineQuestion {
  id: string;
  question: string;
  options: CustomBaselineOption[];
}

export interface CustomCapabilityBlueprint {
  id: string;
  name: string;
  description: string;
  tier: CapabilityTier;
  prerequisites: string[];
  verification_criteria?: string;
}

export interface GoalFormalizationResult {
  concreteOutcomeStatement: string;
  verificationCriteria: string;
  deadlineType: DeadlineType;
  baselineQuestions: (string | CustomBaselineQuestion)[];
  domain: GoalDomain;
  targetDeadline: string; // ISO date string
  isFallback: boolean;
  category?: string;
  recommendedWeeklyHours?: number;
  feasibilityScore?: number;
  feasibilityNote?: string;
  capabilityDag?: CustomCapabilityBlueprint[];
}

export interface CapabilityEvidence {
  id: string;
  capabilityId: string;
  proofType: ProofType;
  payload: any;
  confidenceWeight: number;
  recordedAt: string; // ISO date string
}

export interface CapacityModel {
  sustainableWeeklyHours: number;
  medHours: number;
  reliabilityMarginHours: number;
  maxSessionDurationMinutes: number;
}

export interface DiagnosticRecord {
  triggerReason: string;
  category: DiagnosticCategory;
  details: string;
  isPersistent: boolean;
  proposedAction: RescheduleActionType;
}

export interface TrajectoryVersion {
  id: string;
  userGoalId: string;
  versionNumber: number;
  trigger: string;
  items: any[];
  projectedCompletionDate: string; // ISO date string
  confidence: ConfidenceLevel;
}

// ---------------------------------------------------------------------------
// Deviation & Telemetry Interfaces
// ---------------------------------------------------------------------------

export interface DeviationReport {
  userGoalId: string;
  severity: DeviationSeverity;
  consecutiveCriticalMisses: number;
  totalRecentMisses: number;
  affectedTiers: CapabilityTier[];
  isBottleneckThreatened: boolean;
  requiresDiagnostic: boolean;
  explanation: string;
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
  recordedAt: string; // ISO date string
}

// ---------------------------------------------------------------------------
// Diagnostic Engine Interfaces
// ---------------------------------------------------------------------------

export interface DiagnosticOption {
  id: string;
  category: DiagnosticCategory;
  label: string;
  description: string;
}

export interface DiagnosticQuestionItem {
  category: DiagnosticCategory;
  title: string;
  question: string;
  options: DiagnosticOption[];
}

export interface DiagnosticQuestions {
  userGoalId: string;
  triggerReason: string;
  questions: DiagnosticQuestionItem[];
}

// ---------------------------------------------------------------------------
// Rescheduler Interfaces
// ---------------------------------------------------------------------------

export interface CandidateRoute {
  action: RescheduleActionType;
  description: string;
  projectedCompletionDate: string; // ISO date string
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
  newProjectedCompletion: string; // ISO date string
  goalPreserved: boolean;
}

// ---------------------------------------------------------------------------
// Forecast & Goal Integrity Interfaces
// ---------------------------------------------------------------------------

export interface ForecastResult {
  userGoalId: string;
  projectedCompletionDate: string; // ISO date string
  projectedWindowStart: string;    // ISO date string
  projectedWindowEnd: string;      // ISO date string
  projectedDayOffset: number;
  projectedWindowDays: [number, number];
  confidenceLevel: ConfidenceLevel;
  adaptationRate: number;
  remainingCapabilitiesCount: number;
  establishedCapabilitiesCount: number;
  totalCapabilitiesCount: number;
  isWithinPlannedRunway: boolean;
}

export interface GoalIntegrityAuditResult {
  userGoalId: string;
  status: GoalIntegrityStatus;
  reason: string;
  originalOutcomeStatement: string;
  currentOutcomeStatement: string;
  originalVerificationCriteria: string;
  currentVerificationCriteria: string;
  requiresUserEscalation: boolean;
}

export interface OutcomeGateStatus {
  userGoalId: string;
  isAchieved: boolean;
  status: 'ACHIEVED' | 'NOT_MET' | 'IN_PROGRESS';
  verificationCriteria: string;
  evidenceCount: number;
  validatingEvidence: any[];
  unmetCriteria: string[];
  reason: string;
}

// ---------------------------------------------------------------------------
// Weekly Review Interfaces
// ---------------------------------------------------------------------------

export interface WeeklyStrategicQuestions {
  whatWasSupposedToHappen: string;
  whatActuallyHappened: string;
  whatChangedInCapabilityState: string;
  whatCausedMeaningfulDeviations: string;
  isTheBottleneckStillTheBottleneck: string;
  isTheTrajectoryStillValid: string;
  whatShouldHappenNext: string;
}

export interface WeeklyReviewSummary {
  id: string;
  userGoalId: string;
  weekNumber: number;
  answers: WeeklyStrategicQuestions;
  stateDeltas: Record<string, { from: string; to: string }>;
  createdAt: string; // ISO date string
}

// ---------------------------------------------------------------------------
// API Request Payload Types
// ---------------------------------------------------------------------------

export interface FormalizeGoalParams {
  rawGoal: string;
  domain?: GoalDomain;
  targetDeadline?: string; // ISO date string
  deadlineType?: DeadlineType;
  startingBaselineScore?: number;
  targetDifficultyScore?: number;
  weeklyAvailableHours?: number;
}

export interface CommitGoalParams {
  goalCatalogId?: string;
  outcomeStatement: string;
  verificationCriteria?: string;
  deadlineType?: DeadlineType;
  domain?: GoalDomain;
  targetDeadline?: string; // ISO date string
  startDate?: string;      // ISO date string
  sustainableWeeklyHours?: number;
  capabilities?: {
    name: string;
    description?: string;
    tier?: CapabilityTier;
    prerequisites?: string[];
  }[];
  availabilitySlots?: {
    day_of_week: string;
    start_time: string;
    end_time: string;
    label?: string;
  }[];
  questionnaireAnswers?: Record<string, string>;
  interpretedProfile?: InterpretedAnswerProfile;
  userMemory?: string;
}

export interface InterpretedAnswerProfile {
  suggestedWeeklyHours?: number;
  rationale?: string;
  assessedBaselineLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  detectedConstraints: string[];
  interpretedScaffolding: string;
}

export interface InterpretAnswersParams {
  goalTitle: string;
  domain?: string;
  questionnaireAnswers: Record<string, string>;
  defaultWeeklyHours?: number;
  userMemory?: string;
}

export interface InterpretAnswersResponse {
  profile: InterpretedAnswerProfile;
}

export interface RecordSessionTelemetryParams {
  sessionId: string;
  executionState: ExecutionState;
  proofOfWorkText?: string;
  rpeRating?: number;
  durationMinutes?: number;
  notes?: string;
}

export interface SubmitDiagnosisParams {
  userGoalId: string;
  category: DiagnosticCategory;
  triggerReason?: string;
  details: string;
  isPersistent?: boolean;
  newCapacityHours?: number;
  suggestedAction?: RescheduleActionType;
}

export interface VerifyOutcomeGateParams {
  userGoalId: string;
  capabilityId?: string;
  proofType?: ProofType;
  confidenceWeight?: number;
  payload?: any;
}

// ---------------------------------------------------------------------------
// API Response Types (match actual endpoint JSON shapes)
// ---------------------------------------------------------------------------

export interface FormalizeGoalResponse {
  formalization: GoalFormalizationResult;
  feasibility: FeasibilityAssessment;
}

export interface CommitGoalResponse {
  userGoalId: string;
  trajectoryVersionId: string;
  capabilitiesCount: number;
  week1ExecutionObjects: ExecutionObject[];
  message: string;
}

export interface AdaptiveDashboardResponse {
  userGoalId: string;
  outcomeStatement: string;
  goalIntegrityStatus: GoalIntegrityStatus;
  feasibilityZone: FeasibilityZone | null;
  confidenceLevel: ConfidenceLevel;
  projectedCompletionWindow: string;
  projectedCompletionDate: string; // ISO date string
  activeBottleneck: {
    id: string;
    name: string;
    state: CapabilityState;
    description: string;
  } | null;
  todayAction: ExecutionObject | null;
  latestPlanUpdate: string;
  reliabilityMarginHours: number;
  capabilities?: {
    id: string;
    name: string;
    tier: CapabilityTier;
    state: CapabilityState;
    description: string;
  }[];
  currentWeekExecutionObjects?: (ExecutionObject & {
    sessionId?: string | null;
    scheduledDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    status?: string;
    title?: string;
  })[];
  currentWeek?: number;
  totalWeeks?: number;
}

export interface TelemetrySessionResponse {
  telemetryResult: TelemetryResult;
  deviationReport: DeviationReport;
}

export interface DiagnosisPendingResponse {
  pending: boolean;
  prompt?: DiagnosticQuestions;
  deviationReport: DeviationReport;
  message?: string;
}

export interface DiagnosisSubmitResponse {
  diagnosticRecord: DiagnosticRecord;
  replanResult: ReplanResult;
  userFacingExplanation: string;
}

/** Weekly Review response is the WeeklyReviewSummary directly */
export type WeeklyReviewResponse = WeeklyReviewSummary;

/** Outcome Gate response is the OutcomeGateStatus directly */
export type OutcomeGateResponse = OutcomeGateStatus;
