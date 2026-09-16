export interface MasterPlanItem {
  title: string;
  description: string;
  why_this_matters?: string;
  mvs_fallback_description?: string;
  target_reps: number;
  estimated_minutes: number;
  energy_requirement: 'HIGH' | 'MEDIUM' | 'LOW';
  preferred_window: 'MORNING' | 'AFTERNOON' | 'EVENING';
  capability_id?: string;
  week_number: number;
}

export interface MasterPlanPhase {
  phase_order: number;
  title: string;
  focus: string;
  duration_weeks: number;
  items: MasterPlanItem[];
}

export interface MasterPlanOutput {
  summary: string;
  target_date: string;
  weekly_target_hours: number;
  recommended_dose_minutes: number;
  minimum_viable_dose_minutes: number;
  preferred_window: 'MORNING' | 'AFTERNOON' | 'EVENING';
  energy_requirement: 'HIGH' | 'MEDIUM' | 'LOW';
  diagnostic_baseline: string;
  interventions_needed: string[];
  phases: MasterPlanPhase[];
}

export interface MasterPlanInput {
  blueprint: {
    id: string;
    title: string;
    category?: string;
    est_weekly_hours?: number;
    blueprint_metadata?: string | any;
  };
  answers: Record<string, string>;
  interpretedProfile?: {
    suggestedWeeklyHours?: number;
    rationale?: string;
    assessedBaselineLevel?: string;
    detectedConstraints?: string[];
    interpretedScaffolding?: string;
  };
  lifeStructure?: {
    wake_time: string;
    sleep_time: string;
    buffer_minutes: number;
    schedule_reliability: string;
    routine_blocks?: any[];
  };
  userMemory?: string;
  startDate?: string | Date;
}

export function validateMasterPlanOutput(data: any): { valid: boolean; data?: MasterPlanOutput; errors: string[] } {
  return { valid: true, data: data as MasterPlanOutput, errors: [] };
}

/**
 * Clean stub for Master Plan generation (ready for clean-slate redesign).
 */
export async function generateMasterPlan(
  input: MasterPlanInput
): Promise<{ plan: MasterPlanOutput; isFallback: boolean; rawPrompt?: string }> {
  return {
    plan: generateDeterministicMasterPlan(input),
    isFallback: true,
  };
}

export function generateDeterministicMasterPlan(input: MasterPlanInput): MasterPlanOutput {
  const start = input.startDate ? new Date(input.startDate) : new Date();
  const targetDateObj = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  return {
    summary: `90-day plan for "${input.blueprint?.title || 'Goal'}"`,
    target_date: targetDateObj.toISOString().split('T')[0],
    weekly_target_hours: input.blueprint?.est_weekly_hours || 6,
    recommended_dose_minutes: 45,
    minimum_viable_dose_minutes: 15,
    preferred_window: 'MORNING',
    energy_requirement: 'HIGH',
    diagnostic_baseline: 'Initial baseline',
    interventions_needed: [],
    phases: [],
  };
}

export const buildDeterministicMasterPlan = generateDeterministicMasterPlan;
