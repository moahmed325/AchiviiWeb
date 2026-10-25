import { generateStructuredContent } from './gemini.js';

/**
 * Each later attempt tells the model why the answer before was thrown out, and loosens temperature. Two attempts by
 * default; the roadmap takes three (B-32).
 */
export async function generateWithOneRetry<T, R>(
  prompt: string,
  systemInstruction: string,
  responseSchema: Record<string, unknown>,
  /** `lastAttempt` lets soft checks give way so the user still gets an answer. */
  accept: (data: T, lastAttempt: boolean) => { value: R } | { reason: string },
  label: string,
  attempts = 2
): Promise<R | null> {
  let rejection = '';
  for (let attempt = 0; attempt < attempts; attempt++) {
    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\nYOUR PREVIOUS ANSWER WAS REJECTED: ${rejection}\nReturn the complete JSON again with that problem fixed.`;
    const result = await generateStructuredContent<T>(attemptPrompt, systemInstruction, undefined, {
      responseSchema,
      temperature: attempt === 0 ? 0 : 0.4,
    });
    if (!result.success || !result.data) {
      rejection = result.error || 'no answer';
      console.warn(`[AI] ${label} attempt ${attempt + 1} failed: ${rejection}`);
      continue;
    }
    const verdict = accept(result.data, attempt === attempts - 1);
    if ('value' in verdict) return verdict.value;
    rejection = verdict.reason;
    console.warn(`[AI] ${label} attempt ${attempt + 1} rejected: ${rejection}`);
  }
  return null;
}
