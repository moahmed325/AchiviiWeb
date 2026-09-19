export interface DiagnosticQuestion {
  id: string;
  question: string;
  subtitle: string;
  options: string[];
  allowCustom: boolean;
}

export interface ScientificFramework {
  name: string;
  description: string;
  application: string;
}

export interface VDOTPacingEntry {
  baselineKey: string; // e.g. 'under_24', '24_27', '27_30', 'over_30'
  label: string;
  vdot: number;
  easyPace: string;
  marathonPace: string;
  thresholdPace: string;
  intervalPace: string;
  repetitionPace: string;
  targetHeartRateRange: string;
}

export interface BlueprintPhase {
  phaseNumber: 1 | 2 | 3;
  phaseName: 'Foundation' | 'Acceleration' | 'Mastery';
  weeks: number[];
  focus: string;
  targetIntensity: number;
  milestoneWeek: number;
  milestoneTitle: string;
  milestoneCriteria: string;
}

export interface BlueprintWorkoutArchetype {
  workoutType: 'recovery' | 'aerobic_base' | 'threshold' | 'intervals' | 'long_run';
  title: string;
  focus: string;
  isRestDay: boolean;
  baseDurationMinutes: number;
  drillStepsTemplate: Array<{
    stepNumber: number;
    title: string;
    durationRatio: number; // e.g. 0.2 for 20% of session time
    instructions: string;
    focusCue: string;
    pitfallToAvoid: string;
    layer: 'mechanism' | 'adherence' | 'safety';
    layerReasoning: string;
  }>;
}

export interface BlueprintWeekSchedule {
  weekNumber: number;
  phase: 'Foundation' | 'Acceleration' | 'Mastery';
  theme: string;
  objective: string;
  keyMilestone: string;
  targetIntensity: number;
  workoutArchetypes: BlueprintWorkoutArchetype[];
}

export interface EvidencePillar {
  title: string;
  subtitle: string;
  tag: string;
  coreRule: string;
  realWorldApplication: string;
}

export interface EvidenceTriad {
  science: EvidencePillar;
  socialAdherence: EvidencePillar;
  proCoaching: EvidencePillar;
}

export interface CertifiedPresetBlueprint {
  id: string;
  matchingPatterns: RegExp[];
  title: string;
  primaryDomain: string;
  clarifiedOutcome: string;
  badge: string;
  scientificFrameworks: ScientificFramework[];
  verificationCriteria: string;
  diagnosticQuestions: DiagnosticQuestion[];
  vdotPacingTable?: VDOTPacingEntry[];
  phases: BlueprintPhase[];
  weeks: BlueprintWeekSchedule[];
  expertPromptContext: string;
  evidenceTriad?: EvidenceTriad;
}
