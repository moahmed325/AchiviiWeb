import { GoalDomain } from './types.js';

export interface InterpretedAnswerProfile {
  suggestedWeeklyHours?: number;
  rationale?: string;
  assessedBaselineLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  detectedConstraints: string[];
  interpretedScaffolding: string;
}

export interface InterpretAnswersInput {
  goalTitle: string;
  domain?: GoalDomain | string;
  questionnaireAnswers: Record<string, string>;
  defaultWeeklyHours?: number;
  userMemory?: string;
}

/**
 * Clean stub for answer interpretation (ready for clean-slate redesign).
 */
export async function interpretOnboardingAnswers(input: InterpretAnswersInput): Promise<InterpretedAnswerProfile> {
  return heuristicInterpretAnswers(input);
}

export function heuristicInterpretAnswers(input: InterpretAnswersInput): InterpretedAnswerProfile {
  return {
    suggestedWeeklyHours: input.defaultWeeklyHours || 6,
    rationale: 'Clean slate cadence',
    assessedBaselineLevel: 'BEGINNER',
    detectedConstraints: [],
    interpretedScaffolding: 'Direct execution scaffolding',
  };
}
