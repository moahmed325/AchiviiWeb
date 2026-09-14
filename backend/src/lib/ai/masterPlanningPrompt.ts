import { generateStructuredContent } from './gemini.js';
import { AvailableWindow, calculateAvailableWindows } from '../life/lifeStructureEngine.js';

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
  lifeStructure?: {
    wake_time: string;
    sleep_time: string;
    buffer_minutes: number;
    schedule_reliability: string;
    routine_blocks?: any[];
  };
  startDate?: string | Date;
}

/**
 * Validates whether an unknown object conforms to MasterPlanOutput schema.
 */
export function validateMasterPlanOutput(data: any): { valid: boolean; data?: MasterPlanOutput; errors: string[] } {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Plan data must be a non-null object'] };
  }

  if (typeof data.summary !== 'string' || !data.summary.trim()) {
    errors.push('Missing or invalid "summary" string');
  }
  if (typeof data.target_date !== 'string' || !data.target_date.trim()) {
    errors.push('Missing or invalid "target_date" string');
  }
  if (typeof data.weekly_target_hours !== 'number' || data.weekly_target_hours <= 0) {
    errors.push('Missing or invalid "weekly_target_hours" (must be > 0)');
  }
  if (typeof data.recommended_dose_minutes !== 'number' || data.recommended_dose_minutes <= 0) {
    errors.push('Missing or invalid "recommended_dose_minutes" (must be > 0)');
  }
  if (typeof data.minimum_viable_dose_minutes !== 'number' || data.minimum_viable_dose_minutes <= 0) {
    errors.push('Missing or invalid "minimum_viable_dose_minutes" (must be > 0)');
  }

  const validWindows = ['MORNING', 'AFTERNOON', 'EVENING'];
  if (!validWindows.includes(data.preferred_window)) {
    errors.push(`Invalid "preferred_window". Must be one of: ${validWindows.join(', ')}`);
  }

  const validEnergies = ['HIGH', 'MEDIUM', 'LOW'];
  if (!validEnergies.includes(data.energy_requirement)) {
    errors.push(`Invalid "energy_requirement". Must be one of: ${validEnergies.join(', ')}`);
  }

  if (typeof data.diagnostic_baseline !== 'string') {
    errors.push('Missing "diagnostic_baseline" string');
  }

  if (!Array.isArray(data.interventions_needed)) {
    errors.push('"interventions_needed" must be an array of strings');
  }

  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    errors.push('"phases" must be a non-empty array');
  } else {
    for (let pIdx = 0; pIdx < data.phases.length; pIdx++) {
      const p = data.phases[pIdx];
      const pTitle = p?.title || p?.phase_name;
      if (!p || typeof pTitle !== 'string' || !Array.isArray(p.items)) {
        errors.push(`Phase at index ${pIdx} is invalid or missing items`);
      } else {
        for (let iIdx = 0; iIdx < p.items.length; iIdx++) {
          const item = p.items[iIdx];
          const iTitle = item?.title || item?.intervention_name;
          const iMins = item?.estimated_minutes ?? item?.standard_duration_minutes;
          if (!item || typeof iTitle !== 'string' || typeof iMins !== 'number') {
            errors.push(`Item at phase ${pIdx}, item ${iIdx} is invalid`);
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: data as MasterPlanOutput, errors: [] };
}

/**
 * Generates an immediate deterministic Master Plan using blueprint DAG and user onboarding answers.
 * Guarantees zero latency and rock-solid schema compliance.
 */
export function generateDeterministicMasterPlan(input: MasterPlanInput): MasterPlanOutput {
  const { blueprint, answers, lifeStructure } = input;
  const start = input.startDate ? new Date(input.startDate) : new Date();
  
  // 90 days out
  const targetDateObj = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  const targetDateStr = targetDateObj.toISOString().split('T')[0];

  // Parse blueprint metadata if present
  let meta: any = {};
  if (blueprint.blueprint_metadata) {
    if (typeof blueprint.blueprint_metadata === 'string') {
      try {
        meta = JSON.parse(blueprint.blueprint_metadata);
      } catch {
        meta = {};
      }
    } else {
      meta = blueprint.blueprint_metadata;
    }
  }

  function extractAnswerString(val: any): string {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      if (typeof val.value === 'string') return val.value;
      if (typeof val.label === 'string') return val.label;
      if (Array.isArray(val)) return val.map(extractAnswerString).join(', ');
    }
    return String(val ?? '');
  }

  // Parse weekly hours (handling standard option values or custom "Other" write-in answers)
  let weeklyHours = blueprint.est_weekly_hours || 6;
  for (const key of Object.keys(answers)) {
    const rawVal = answers[key];
    const val = extractAnswerString(rawVal);
    const match = val.match(/(\d+(\.\d+)?)/);
    if (match) {
      const num = parseFloat(match[1]);
      if (!isNaN(num) && num >= 2 && num <= 30) {
        weeklyHours = num;
        break;
      }
    }
  }

  // Determine baseline description from answers
  let baselineDesc = 'Standard starting point';
  for (const [key, rawVal] of Object.entries(answers)) {
    const val = extractAnswerString(rawVal);
    if (key.includes('level') || key.includes('baseline') || key.includes('stage') || key.includes('history')) {
      baselineDesc = `Assessed Baseline: ${val.replace(/_/g, ' ').toUpperCase()}`;
      break;
    }
  }

  // Check preferred window from answers or life routine
  let prefWindow: 'MORNING' | 'AFTERNOON' | 'EVENING' = meta.preferred_window || 'MORNING';
  for (const [key, rawVal] of Object.entries(answers)) {
    const val = extractAnswerString(rawVal).toLowerCase();
    if (key.includes('time') || key.includes('window') || key.includes('environment')) {
      if (val.includes('morning')) prefWindow = 'MORNING';
      else if (val.includes('afternoon')) prefWindow = 'AFTERNOON';
      else if (val.includes('evening')) prefWindow = 'EVENING';
    }
  }

  const energyReq: 'HIGH' | 'MEDIUM' | 'LOW' = meta.energy_requirement || 'HIGH';
  const nominalMinutes = meta.nominal_session_duration_minutes || 60;
  const mvdMinutes = meta.minimum_viable_session_minutes || 25;

  // Interventions identified from answers
  const interventions: string[] = [];
  for (const [key, rawVal] of Object.entries(answers)) {
    const val = extractAnswerString(rawVal);
    if (key.includes('bottleneck') || key.includes('challenge') || key.includes('vulnerability') || key.includes('blocker') || key.includes('comfort_zone')) {
      interventions.push(`Targeted Focus Scaffolding: ${val.replace(/_/g, ' ')}`);
    }
  }
  if (interventions.length === 0) {
    interventions.push('Daily routine anchoring with minimum viable dose fallback');
  }

  // Construct 3 phases (12 weeks total)
  const dags = Array.isArray(meta.capability_dag) ? meta.capability_dag : [];
  const milestones = Array.isArray(meta.milestones) ? meta.milestones : [];

  const phases: MasterPlanPhase[] = [
    {
      phase_order: 1,
      title: milestones[0]?.title || 'Phase 1: Foundation & Baseline Capability (Weeks 1–4)',
      focus: 'Establish core rhythm, verify minimum viable dose, and clear initial capability hurdles',
      duration_weeks: 4,
      items: [
        {
          title: dags[0]?.name || `${blueprint.title} Core Foundation Sprint`,
          description: dags[0]?.description || 'Master foundational techniques and establish habit anchor',
          why_this_matters: 'Establishes fundamental neurological and physical adaptation without burnout, building the foundation for Phase 2 volume.',
          mvs_fallback_description: '15-minute low-friction sub-component drill to protect daily streak and neural momentum.',
          target_reps: 3,
          estimated_minutes: nominalMinutes,
          energy_requirement: energyReq,
          preferred_window: prefWindow,
          capability_id: dags[0]?.id || 'cap_1',
          week_number: 1,
        },
        {
          title: dags[1]?.name || `${blueprint.title} Progression Drill`,
          description: dags[1]?.description || 'Expand volume and reinforce consistent execution',
          why_this_matters: 'Gradually overloads initial stimulus within safe biological limits to prepare for autonomous execution.',
          mvs_fallback_description: '15-minute core review or targeted technique practice.',
          target_reps: 2,
          estimated_minutes: nominalMinutes,
          energy_requirement: energyReq,
          preferred_window: prefWindow,
          capability_id: dags[1]?.id || 'cap_2',
          week_number: 3,
        },
      ],
    },
    {
      phase_order: 2,
      title: milestones[1]?.title || 'Phase 2: Volume, Pacing & Endurance (Weeks 5–8)',
      focus: 'Scale sustained output, tackle primary bottleneck, and maintain cadence',
      duration_weeks: 4,
      items: [
        {
          title: dags[2]?.name || `${blueprint.title} Deep Work Interval`,
          description: dags[2]?.description || 'Complex integration and extended focus practice',
          why_this_matters: 'Expands sustained work capacity and tackles core integration bottlenecks under progressive overload.',
          mvs_fallback_description: '20-minute focused single-component exercise to maintain momentum.',
          target_reps: 3,
          estimated_minutes: nominalMinutes,
          energy_requirement: energyReq,
          preferred_window: prefWindow,
          capability_id: dags[2]?.id || 'cap_3',
          week_number: 5,
        },
        {
          title: dags[3]?.name || `${blueprint.title} Midpoint Benchmark Challenge`,
          description: dags[3]?.description || 'Midway milestone validation and diagnostic audit',
          why_this_matters: 'Provides falsifiable mid-term diagnostic feedback before entering the capstone phase.',
          mvs_fallback_description: '15-minute diagnostic self-audit or progress assessment.',
          target_reps: 2,
          estimated_minutes: Math.round(nominalMinutes * 1.15),
          energy_requirement: energyReq,
          preferred_window: prefWindow,
          capability_id: dags[3]?.id || 'cap_4',
          week_number: 7,
        },
      ],
    },
    {
      phase_order: 3,
      title: milestones[2]?.title || 'Phase 3: Peak Performance & Final Delivery (Weeks 9–12)',
      focus: 'Finalize output, consolidate capabilities, and clear formal target outcome',
      duration_weeks: 4,
      items: [
        {
          title: dags[4]?.name || `${blueprint.title} Final Stretch Sprint`,
          description: dags[4]?.description || 'Refine deliverables, eliminate defects, and prepare for finish line',
          why_this_matters: 'Sharpens precision and timing for the final capstone demonstration.',
          mvs_fallback_description: '15-minute rehearsal or checklist inspection.',
          target_reps: 3,
          estimated_minutes: nominalMinutes,
          energy_requirement: energyReq,
          preferred_window: prefWindow,
          capability_id: dags[4]?.id || 'cap_5',
          week_number: 9,
        },
        {
          title: `${blueprint.title} Completion & Graduation Milestone`,
          description: milestones[2]?.exit_criteria || 'Attain final 90-day ambition target and lock in sustained habit',
          why_this_matters: 'Executes the definitive real-world verification test proving goal completion.',
          mvs_fallback_description: '20-minute capstone rehearsal.',
          target_reps: 2,
          estimated_minutes: nominalMinutes,
          energy_requirement: energyReq,
          preferred_window: prefWindow,
          capability_id: 'cap_graduation',
          week_number: 12,
        },
      ],
    },
  ];

  return {
    summary: `Personalized 90-day plan for "${blueprint.title}", optimized around your daily schedule with ${weeklyHours} hrs/week commitment.`,
    target_date: targetDateStr,
    weekly_target_hours: weeklyHours,
    recommended_dose_minutes: nominalMinutes,
    minimum_viable_dose_minutes: mvdMinutes,
    preferred_window: prefWindow,
    energy_requirement: energyReq,
    diagnostic_baseline: baselineDesc,
    interventions_needed: interventions,
    phases,
  };
}

export const buildDeterministicMasterPlan = generateDeterministicMasterPlan;

/**
 * Generates the full Master Plan via Gemini AI or instant deterministic fallback.
 * Validates output against the strict MasterPlanOutput contract.
 */
export async function generateMasterPlan(
  input: MasterPlanInput
): Promise<{ plan: MasterPlanOutput; isFallback: boolean; rawPrompt?: string }> {
  const deterministicPlan = generateDeterministicMasterPlan(input);

  const systemInstruction = `You are the Lead Master Planning Intelligence for an executive Life + Ambition Operating System.
Your task is to take a Goal Blueprint, user onboarding answers, and the user's daily life schedule routines, and synthesize a structured 90-day trajectory.
Ensure EVERY single item includes a clear, inspiring "why_this_matters" field and a practical "mvs_fallback_description" micro-task.
Return ONLY valid JSON matching this schema:
{
  "summary": "string",
  "target_date": "YYYY-MM-DD",
  "weekly_target_hours": number,
  "recommended_dose_minutes": number,
  "minimum_viable_dose_minutes": number,
  "preferred_window": "MORNING" | "AFTERNOON" | "EVENING",
  "energy_requirement": "HIGH" | "MEDIUM" | "LOW",
  "diagnostic_baseline": "string",
  "interventions_needed": ["string"],
  "phases": [
    {
      "phase_order": number,
      "title": "string",
      "focus": "string",
      "duration_weeks": number,
      "items": [
        {
          "title": "string",
          "description": "string",
          "why_this_matters": "Plain English 1-2 sentence explanation of why this specific session matters and its tangible ROI",
          "mvs_fallback_description": "Concrete 10-15 min micro-task if user is completely exhausted or pressed for time",
          "target_reps": number,
          "estimated_minutes": number,
          "energy_requirement": "HIGH" | "MEDIUM" | "LOW",
          "preferred_window": "MORNING" | "AFTERNOON" | "EVENING",
          "capability_id": "string",
          "week_number": number
        }
      ]
    }
  ]
}`;

  const prompt = `Goal Blueprint: ${JSON.stringify(input.blueprint)}
User Onboarding Questionnaire Answers: ${JSON.stringify(input.answers)}
User Life Structure & Daily Routines: ${JSON.stringify(input.lifeStructure || {})}
Start Date: ${input.startDate ? new Date(input.startDate).toISOString() : new Date().toISOString()}`;

  try {
    // 4-second timeout race
    const geminiCall = generateStructuredContent<MasterPlanOutput>(prompt, systemInstruction);
    const timeoutPromise = new Promise<{ success: false; data: null; isFallback: true }>((resolve) =>
      setTimeout(() => resolve({ success: false, data: null, isFallback: true }), 4000)
    );

    const result = await Promise.race([geminiCall, timeoutPromise]);

    if (result.success && result.data) {
      const validation = validateMasterPlanOutput(result.data);
      if (validation.valid && validation.data) {
        return { plan: validation.data, isFallback: false, rawPrompt: prompt };
      }
    }
  } catch (err) {
    console.warn('[MasterPlanningPrompt] AI generation failed or timed out, using deterministic plan:', err);
  }

  return { plan: deterministicPlan, isFallback: true, rawPrompt: prompt };
}
