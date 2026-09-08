import { generateStructuredContent } from './ai/gemini.js';

export interface OptimizerPlanAdjustment {
  adjustment_type: 'reduce_days' | 'shorten_sessions' | 'pause_recommended';
  new_days_per_week?: number;
  new_daily_minutes_variance?: number;
  rationale_structured: string;
}

/**
 * Optimizer AI Role:
 * Handles Tier 2c custom replan logic, triggered ONLY after the lapse circuit breaker fires
 * (exactly on the 3rd recovery event in rolling 28 days).
 *
 * CRITICAL ROLE BOUNDARY (Decision Log D9):
 * Optimizer outputs structured plan-adjustment parameters ONLY, NEVER user-facing text directly.
 * Coach translates this into the unified user-facing voice.
 */
export async function optimizeGoalPlan(params: {
  goalTitle: string;
  currentDaysPerWeek: number;
  slippageDays: number;
  rollingRecoveryCount: number;
  recentNotes?: string;
}): Promise<OptimizerPlanAdjustment> {
  const { goalTitle, currentDaysPerWeek, slippageDays, rollingRecoveryCount, recentNotes } = params;

  // Deterministic baseline fallback
  const fallback: OptimizerPlanAdjustment = {
    adjustment_type: currentDaysPerWeek > 3 ? 'reduce_days' : 'shorten_sessions',
    new_days_per_week: Math.max(2, currentDaysPerWeek - 1),
    new_daily_minutes_variance: -15,
    rationale_structured: `Circuit breaker fired after ${rollingRecoveryCount} recovery events. Reducing schedule intensity to restore sustainable adherence.`,
  };

  const systemInstruction = `You are the Achivii Optimizer AI.
CRITICAL ROLE BOUNDARY (Decision Log D9):
1. Output ONLY structured JSON matching the OptimizerPlanAdjustment schema.
2. Never write user-facing copy or direct conversational text. Coach handles presentation.
3. Schema:
   - adjustment_type: one of ["reduce_days", "shorten_sessions", "pause_recommended"]
   - new_days_per_week: optional integer (2 to 5)
   - new_daily_minutes_variance: optional integer (-30 to 0)
   - rationale_structured: factual technical explanation of the recommendation`;

  const prompt = `Goal: "${goalTitle}"
Current Days/Week: ${currentDaysPerWeek}
Accumulated Slippage: ${slippageDays} days
28-Day Recovery Events: ${rollingRecoveryCount}
Context: ${recentNotes || 'User has experienced multiple consecutive lapses.'}

Recommend optimal structural schedule parameter reductions.`;

  const result = await generateStructuredContent<OptimizerPlanAdjustment>(prompt, systemInstruction);

  if (result.success && result.data && result.data.adjustment_type) {
    return {
      adjustment_type: result.data.adjustment_type,
      new_days_per_week: result.data.new_days_per_week ?? fallback.new_days_per_week,
      new_daily_minutes_variance: result.data.new_daily_minutes_variance ?? fallback.new_daily_minutes_variance,
      rationale_structured: result.data.rationale_structured || fallback.rationale_structured,
    };
  }

  return fallback;
}
