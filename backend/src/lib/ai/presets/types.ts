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

export interface BPMPacingEntry {
  baselineKey: string; // e.g. 'complete_beginner', 'early_beginner', 'novice_plateau', 'rusty_returner'
  label: string;
  startingPracticeBPM: number;
  switchesTargetPerMin: number;
  songTargetBPM: number;
  targetMetronomeRange: string;
}

export interface SaaSVelocityEntry {
  baselineKey: string; // e.g. 'first_time', 'frontend_spec', 'backend_spec', 'full_stack'
  label: string;
  recommendedStack: string;
  coreLoopScope: string;
  targetLaunchWeek: number;
  guidance: string;
}

export interface LanguageVelocityEntry {
  baselineKey: string; // e.g. 'complete_beginner', 'false_beginner', 'intermediate_plateau', 'rusty_refresher'
  label: string;
  activeVocabTarget: number;
  speechRateWPM: number;
  coreFocus: string;
  targetDailyMinutes: number;
}

export interface RecompPacingEntry {
  baselineKey: string; // e.g. 'true_beginner', 'skinny_fat', 'overfat_intermediate', 'athletic_cut'
  label: string;
  dailyCalorieDeficit: number; // e.g. 400, 250, 500, 350 kcal
  proteinTargetGPerKg: number; // e.g. 1.8, 2.0, 2.2, 2.4 g/kg
  weeklySetsPerMuscle: string; // e.g. '10-12 direct working sets'
  neatStepTarget: number; // e.g. 8000, 10000 daily steps
  refeedFrequency: string; // e.g. 'Every 4 weeks (48hr maintenance refeed)'
  guidance: string;
}

export interface YouTubeVelocityEntry {
  baselineKey: string; // e.g. 'camera_shy_beginner', 'domain_expert', 'casual_hobbyist', 'fast_track'
  label: string;
  targetRuntimeMins: string; // e.g. '6–8 minutes', '8–12 minutes'
  first30sRetentionTarget: number; // e.g. 60, 65, 70 (%)
  ctrTarget: number; // e.g. 5, 7, 8 (%)
  weeklyProductionHours: number; // e.g. 6, 8, 10
  guidance: string;
}

export interface WritingVelocityEntry {
  baselineKey: string; // e.g. 'first_time_author', 'subject_matter_expert', 'fiction_novella', 'prolific_drafter'
  label: string;
  dailyTargetWords: number; // e.g. 400, 500, 600, 750 words
  weeklyWordQuota: number; // e.g. 2000, 2500, 3000, 3750 words
  targetChapterCount: number; // e.g. 10, 12 chapters
  recommendedSessionWindow: string; // e.g. 'Morning sacred 60-min sprint', 'Evening 45-min sprint'
  guidance: string;
}

export interface DeepWorkVelocityEntry {
  baselineKey: string; // e.g. 'scattered_multitasker', 'novice_deep_worker', 'structured_professional', 'advanced_focus'
  label: string;
  dailyDeepWorkHours: number; // e.g. 2.0, 2.5, 3.5, 4.0
  blockLengthMins: number; // e.g. 45, 60, 90
  screenTimeReductionTarget: number; // e.g. 30, 40, 50 (%)
  weeklyOutputMultiplier: string; // e.g. '1.5x output', '2x output'
  guidance: string;
}

export interface ChessVelocityEntry {
  baselineKey: string; // e.g. 'under_600', '600_800', '800_1000', '1000_1200'
  label: string;
  dailyTacticsCount: number; // e.g. 15, 20, 25, 30
  puzzleAccuracyTarget: string; // e.g. '75%+', '80%+', '82%+', '85%+'
  weeklyRapidGames: number; // e.g. 6, 8, 8, 10 (15+10 format)
  openingSystem: string; // e.g. 'London / Italian & Solid e5/Caro-Kann'
  guidance: string;
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
  workoutType:
    | 'recovery'
    | 'aerobic_base'
    | 'threshold'
    | 'intervals'
    | 'long_run'
    | 'mechanics'
    | 'chord_transitions'
    | 'rhythm_tempo'
    | 'ear_recovery'
    | 'repertoire'
    | 'fingerpicking'
    | 'milestone_audit'
    | string;
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
  capabilities?: string[];
  scientificFrameworks: ScientificFramework[];
  verificationCriteria: string;
  diagnosticQuestions: DiagnosticQuestion[];
  vdotPacingTable?: VDOTPacingEntry[];
  bpmPacingTable?: BPMPacingEntry[];
  saasVelocityTable?: SaaSVelocityEntry[];
  languageVelocityTable?: LanguageVelocityEntry[];
  recompPacingTable?: RecompPacingEntry[];
  youtubeVelocityTable?: YouTubeVelocityEntry[];
  writingVelocityTable?: WritingVelocityEntry[];
  deepWorkVelocityTable?: DeepWorkVelocityEntry[];
  chessVelocityTable?: ChessVelocityEntry[];
  phases: BlueprintPhase[];
  weeks: BlueprintWeekSchedule[];
  expertPromptContext: string;
  evidenceTriad?: EvidenceTriad;
}
