import { generateStructuredContent } from '../../ai/gemini.js';
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
}

/**
 * Fallback heuristic interpreter if Gemini is unavailable, offline, or times out.
 * Reasons through common phrases, sums compound day commitments, and flags protective constraints.
 */
export function heuristicInterpretAnswers(input: InterpretAnswersInput): InterpretedAnswerProfile {
  const { questionnaireAnswers, defaultWeeklyHours = 6 } = input;
  const allText = Object.values(questionnaireAnswers).join(' ').toLowerCase();

  // 1. Calculate suggested weekly hours
  let suggestedWeeklyHours: number = defaultWeeklyHours;
  let rationale = 'Standard baseline cadence';

  // Check for compound day patterns like "2 hours on saturday and 3 hours on sunday"
  const hourMatches = [...allText.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/gi)];
  if (hourMatches.length > 1) {
    const total = hourMatches.reduce((sum, m) => sum + parseFloat(m[1]), 0);
    if (total >= 2 && total <= 25) {
      suggestedWeeklyHours = Math.round(total * 10) / 10;
      rationale = `Summed ${hourMatches.map((m) => m[1] + 'h').join(' + ')} from your note`;
    }
  } else if (hourMatches.length === 1) {
    const single = parseFloat(hourMatches[0][1]);
    if (single >= 2 && single <= 25) {
      suggestedWeeklyHours = single;
      rationale = `Extracted ${single}h/wk commitment from your note`;
    }
  }

  // 2. Detect protective constraints
  const detectedConstraints: string[] = [];
  if (allText.includes('sprain') || allText.includes('injury') || allText.includes('pain') || allText.includes('hurt') || allText.includes('knee') || allText.includes('shin')) {
    detectedConstraints.push('injury_protection');
  }
  if (allText.includes('weekend') || (allText.includes('saturday') && allText.includes('sunday'))) {
    detectedConstraints.push('weekend_clustered_schedule');
  }
  if (allText.includes('busy') || allText.includes('travel') || allText.includes('shift') || allText.includes('overtime')) {
    detectedConstraints.push('high_schedule_volatility');
  }
  if (allText.includes('asthma') || allText.includes('breath') || allText.includes('lungs')) {
    detectedConstraints.push('aerobic_pacing_guardrail');
  }

  // 3. Baseline assessment
  let assessedBaselineLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' = 'BEGINNER';
  if (allText.includes('advanced') || allText.includes('senior') || allText.includes('professional') || allText.includes('10k') || allText.includes('half')) {
    assessedBaselineLevel = 'ADVANCED';
  } else if (allText.includes('intermediate') || allText.includes('5k') || allText.includes('dabbled') || allText.includes('basics')) {
    assessedBaselineLevel = 'INTERMEDIATE';
  }

  const interpretedScaffolding = detectedConstraints.includes('injury_protection')
    ? 'Low-impact volume ramp with conservative progression'
    : detectedConstraints.includes('weekend_clustered_schedule')
    ? 'Consolidated deep-work weekend blocks with light weekday habit anchors'
    : 'Standard progressive capability overload';

  return {
    suggestedWeeklyHours,
    rationale,
    assessedBaselineLevel,
    detectedConstraints,
    interpretedScaffolding,
  };
}

/**
 * Normalizes user onboarding answers (especially open-ended "Other" write-in entries)
 * into clean, actionable variables for the scheduling and master planning engines.
 */
export async function interpretOnboardingAnswers(input: InterpretAnswersInput): Promise<InterpretedAnswerProfile> {
  // If answers only contain simple pre-set option keys without custom write-ins, heuristic is instant and perfect
  const answersList = Object.values(input.questionnaireAnswers);
  const hasLongCustomText = answersList.some((ans) => ans.includes(' ') && ans.length > 15);

  if (!hasLongCustomText) {
    return heuristicInterpretAnswers(input);
  }

  const systemInstruction = `You are the Expert Onboarding Interpreter for Achivii, an elite Life + Ambition Execution System.
Your job is to read a user's open-ended onboarding notes and normalize them into precise mathematical and architectural variables.

STRICT NORMALIZATION RULES:
1. "suggestedWeeklyHours": Compute realistic weekly hours. If the user mentions split time (e.g. "2 hours Sat and 3 hours Sun"), SUM THEM (2 + 3 = 5.0). Range: 2.0 to 25.0.
2. "rationale": Short 1-phrase explanation of how you computed their hours (e.g. "Calculated 5h/wk from 2h Sat + 3h Sun").
3. "assessedBaselineLevel": Choose strictly "BEGINNER", "INTERMEDIATE", or "ADVANCED".
4. "detectedConstraints": Array of short tags (e.g. ["injury_recovery", "weekend_clustered", "high_travel"]).
5. "interpretedScaffolding": 1 concise sentence describing how the early roadmap should scaffold their journey.

Return ONLY valid JSON matching this schema:
{
  "suggestedWeeklyHours": number,
  "rationale": string,
  "assessedBaselineLevel": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "detectedConstraints": string[],
  "interpretedScaffolding": string
}`;

  const prompt = `Goal: "${input.goalTitle}"
Domain: ${input.domain || 'PHYSICAL'}
User Onboarding Questionnaire Answers:
${JSON.stringify(input.questionnaireAnswers, null, 2)}
Default Fallback Hours: ${input.defaultWeeklyHours || 6}

Interpret these answers and return the normalized JSON object.`;

  try {
    // 2.5 second circuit-breaker timeout for snappy background execution
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI Answer Interpreter timeout')), 2500)
    );

    const aiPromise = generateStructuredContent<InterpretedAnswerProfile>(prompt, systemInstruction);
    const result = await Promise.race([aiPromise, timeoutPromise]);

    if (result && result.data && typeof result.data.suggestedWeeklyHours === 'number') {
      const hours = Math.min(25, Math.max(2, result.data.suggestedWeeklyHours));
      return {
        suggestedWeeklyHours: Math.round(hours * 10) / 10,
        rationale: result.data.rationale || 'Personalized from your answers',
        assessedBaselineLevel: result.data.assessedBaselineLevel || 'BEGINNER',
        detectedConstraints: Array.isArray(result.data.detectedConstraints) ? result.data.detectedConstraints : [],
        interpretedScaffolding: result.data.interpretedScaffolding || 'Tailored progressive capability progression',
      };
    }

    return heuristicInterpretAnswers(input);
  } catch (err) {
    console.warn('AI Answer Interpreter fell back to heuristic:', err);
    return heuristicInterpretAnswers(input);
  }
}
