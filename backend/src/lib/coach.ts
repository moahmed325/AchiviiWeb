import { generateTextContent } from './ai/gemini.js';
import { WeeklyAnalysis } from './reviewer.js';
import { OptimizerPlanAdjustment } from './optimizer.js';

export const COACH_TONE_GUIDELINES = `
You are the Achivii Coach. You are the SOLE user-facing voice across the entire application.
VOICE & TONE PRINCIPLES (Plan Section 13 & Decision Log D9):
1. Consistency > Perfection: Missing days is normal and recoverable. Never scold, shame, or induce guilt.
2. Realistic & Warm: Speak like a wise, empathetic mentor who understands busy lives and high demands.
3. Action-Oriented: Keep messages concise (2–3 sentences max), actionable, and clear.
4. Unified Voice: Regardless of whether input came from the Reviewer, Optimizer, or Scheduler, present it seamlessly as "your coach".
`;

/**
 * Generates a warm daily briefing message for the user's dashboard.
 */
export async function generateDailyBriefing(params: {
  goalTitle: string;
  sessionTitle?: string;
  durationMinutes?: number;
  isRestDay?: boolean;
}): Promise<string> {
  const { goalTitle, sessionTitle, durationMinutes, isRestDay } = params;

  if (isRestDay) {
    return `Rest is where progress consolidates. Take today to recharge for your "${goalTitle}" journey.`;
  }

  const fallback = `Today’s session: ${sessionTitle || 'Scheduled block'} (${durationMinutes || 60}m). Focus on taking one steady step forward.`;

  const prompt = `Goal: "${goalTitle}"
Session: "${sessionTitle || 'Focus session'}" (${durationMinutes || 60} minutes)
Generate a warm 2-sentence morning coaching briefing encouraging the user to complete today's session.`;

  const result = await generateTextContent(prompt, COACH_TONE_GUIDELINES);
  if (result.success && result.data && result.data.trim()) {
    return result.data.trim();
  }

  return fallback;
}

/**
 * Translates Reviewer AI structured analysis into a warm weekly coaching takeaway.
 */
export async function generateWeeklyCoachingTakeaway(params: {
  weekNumber: number;
  completionRate: number;
  analysis: WeeklyAnalysis;
}): Promise<string> {
  const { weekNumber, completionRate, analysis } = params;

  const fallback =
    completionRate >= 0.7
      ? `Solid work in Week ${weekNumber} with ${Math.round(completionRate * 100)}% completion! Let’s keep this healthy rhythm going.`
      : `Week ${weekNumber} presented some challenges (${Math.round(completionRate * 100)}% completed). Remember, consistency is about adapting, not being flawless. Let’s calibrate your coming week.`;

  const prompt = `Week Number: ${weekNumber}
Completion Rate: ${Math.round(completionRate * 100)}%
Reviewer Analysis:
- Primary Friction: ${analysis.primary_friction}
- Recommended Adjustment: ${analysis.recommended_adjustment}
- Notes: ${analysis.notes}

Translate this structured analysis into a warm, encouraging 2-sentence coaching takeaway for the user.`;

  const result = await generateTextContent(prompt, COACH_TONE_GUIDELINES);
  if (result.success && result.data && result.data.trim()) {
    return result.data.trim();
  }

  return fallback;
}

/**
 * Translates Optimizer AI structured replan into a supportive coaching message.
 */
export async function generateCircuitBreakerCoachingMessage(params: {
  adjustment: OptimizerPlanAdjustment;
}): Promise<string> {
  const { adjustment } = params;

  const fallback =
    adjustment.adjustment_type === 'pause_recommended'
      ? 'Life is demanding right now. Pausing your goal lets you catch your breath without losing a shred of your hard-earned progress.'
      : 'We noticed the last few weeks have been heavy. We have adjusted your upcoming pace so your goal works for your actual life, not against it.';

  const prompt = `Optimizer Recommendation:
- Adjustment Type: ${adjustment.adjustment_type}
- Days/Week: ${adjustment.new_days_per_week || 'Unchanged'}
- Minutes Variance: ${adjustment.new_daily_minutes_variance || 0}
- Technical Rationale: ${adjustment.rationale_structured}

Translate this into a warm, non-judgmental 2-sentence explanation of why we are dialing back the commitment.`;

  const result = await generateTextContent(prompt, COACH_TONE_GUIDELINES);
  if (result.success && result.data && result.data.trim()) {
    return result.data.trim();
  }

  return fallback;
}
