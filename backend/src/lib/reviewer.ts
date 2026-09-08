import { generateStructuredContent } from './ai/gemini.js';

export interface WeeklyAnalysis {
  adherence_score: number;
  primary_friction: 'scheduling_clash' | 'session_length' | 'fatigue' | 'unspecified';
  recommended_adjustment: 'reduce_sessions_per_week' | 'shorten_duration' | 'shift_time_of_day' | 'keep_pace';
  notes: string;
}

/**
 * Reviewer AI Role:
 * Assesses weekly signal (adherence, skip patterns, qualitative reflection responses)
 * strictly when completion rate is < 70%.
 *
 * CRITICAL RULE (Decision Log D9):
 * Reviewer outputs structured metadata/analysis ONLY, NEVER user-facing text directly.
 * Coach is the sole presentation layer.
 */
export async function analyzeWeeklyPerformance(params: {
  weekNumber: number;
  completionRate: number;
  scheduledSessionCount: number;
  completedSessionCount: number;
  reflectionResponses?: any;
}): Promise<WeeklyAnalysis> {
  const { weekNumber, completionRate, scheduledSessionCount, completedSessionCount, reflectionResponses } = params;

  // Deterministic baseline fallback
  const fallback: WeeklyAnalysis = {
    adherence_score: Math.round(completionRate * 100) / 100,
    primary_friction:
      reflectionResponses?.difficulty === 'Too Challenging'
        ? 'session_length'
        : reflectionResponses?.what_got_in_way
        ? 'scheduling_clash'
        : 'unspecified',
    recommended_adjustment:
      completionRate < 0.4
        ? 'reduce_sessions_per_week'
        : completionRate < 0.7
        ? 'shorten_duration'
        : 'keep_pace',
    notes: `Week ${weekNumber} completed ${completedSessionCount}/${scheduledSessionCount} sessions (${Math.round(
      completionRate * 100
    )}%).`,
  };

  const systemInstruction = `You are the Achivii Reviewer AI.
CRITICAL ROLE BOUNDARY (Decision Log D9):
1. You output ONLY structured JSON metadata matching the WeeklyAnalysis schema.
2. You must NEVER write user-facing greeting, coaching, or motivational text. The Coach role handles all user-facing copy.
3. Schema:
   - adherence_score: number between 0.0 and 1.0
   - primary_friction: one of ["scheduling_clash", "session_length", "fatigue", "unspecified"]
   - recommended_adjustment: one of ["reduce_sessions_per_week", "shorten_duration", "shift_time_of_day", "keep_pace"]
   - notes: brief factual analysis string`;

  const prompt = `Week Number: ${weekNumber}
Completion Rate: ${Math.round(completionRate * 100)}% (${completedSessionCount}/${scheduledSessionCount} sessions)
User Reflection: ${JSON.stringify(reflectionResponses || {})}

Analyze the week's performance and provide structured diagnosis.`;

  const result = await generateStructuredContent<WeeklyAnalysis>(prompt, systemInstruction);

  if (result.success && result.data && typeof result.data.adherence_score === 'number') {
    return {
      adherence_score: result.data.adherence_score,
      primary_friction: result.data.primary_friction || fallback.primary_friction,
      recommended_adjustment: result.data.recommended_adjustment || fallback.recommended_adjustment,
      notes: result.data.notes || fallback.notes,
    };
  }

  return fallback;
}
