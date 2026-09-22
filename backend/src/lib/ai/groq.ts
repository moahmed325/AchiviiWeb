import dotenv from 'dotenv';
import { parseModelJson } from './modelJson.js';

dotenv.config();

export interface GroqGenerationUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
}

export interface GroqResult<T = string> {
  success: boolean;
  data: T | null;
  usage?: GroqGenerationUsage;
  error?: string;
  isFallback: boolean;
}

export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
/** Separate daily token budget from the 120b model, so it can still answer after 120b is spent. */
export const GROQ_BACKUP_MODEL = process.env.GROQ_BACKUP_MODEL || 'openai/gpt-oss-20b';

let groqCallCounter = 0;
const groqUnavailableUntil = new Map<string, number>();

export function getGroqCallCount(): number {
  return groqCallCounter;
}

export function resetGroqCallCount(): void {
  groqCallCounter = 0;
}

export function isGroqDailyLimitError(error?: string): boolean {
  return Boolean(error && /tokens per day|\bTPD\b/i.test(error));
}

/** Daily limits are per model on Groq. */
export function isGroqUnavailable(modelName: string = DEFAULT_GROQ_MODEL): boolean {
  return Date.now() < (groqUnavailableUntil.get(modelName) ?? 0);
}

export function markGroqUnavailable(ms = 30 * 60 * 1000, modelName: string = DEFAULT_GROQ_MODEL): void {
  groqUnavailableUntil.set(modelName, Date.now() + ms);
}

export function resetGroqAvailability(): void {
  groqUnavailableUntil.clear();
}

export function groqModelsToTry(): string[] {
  return [...new Set([DEFAULT_GROQ_MODEL, GROQ_BACKUP_MODEL])].filter((model) => !isGroqUnavailable(model));
}

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.trim() === '' || key === 'placeholder') {
    return null;
  }
  return key.trim();
}

/**
 * Generates structured JSON from Groq using openai/gpt-oss-120b with response_format: { type: "json_object" }.
 */
export async function generateGroqStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GROQ_MODEL,
  retryCount: number = 0,
  temperature: number = 0.0
): Promise<GroqResult<T>> {
  const apiKey = getGroqApiKey();
  const startTime = Date.now();

  if (!apiKey) {
    return {
      success: false,
      data: null,
      isFallback: true,
      error: 'GROQ_API_KEY is not configured in environment or backend/.env',
    };
  }

  if (isGroqUnavailable(modelName)) {
    return {
      success: false,
      data: null,
      isFallback: true,
      error: `Groq daily token limit reached for ${modelName} — skipped until cooldown ends`,
    };
  }

  groqCallCounter++;
  const controller = new AbortController();
  // 12-week plans are large JSON; 25s aborted after Groq 429 waits.
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: { type: 'json_object' },
        temperature,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = errorText;
      let failedGeneration: string | undefined;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error?.message || errorText;
        failedGeneration = parsed.error?.failed_generation;
      } catch {}

      // json_object mode rejects near-valid JSON; the raw text is often repairable.
      if (response.status === 400 && failedGeneration) {
        try {
          const { data } = parseModelJson<T>(failedGeneration);
          console.warn(`[Groq] Repaired JSON that ${modelName} failed to validate`);
          return { success: true, data, usage: { durationMs }, isFallback: false };
        } catch {}
      }

      if (response.status === 429 && isGroqDailyLimitError(errorMsg)) {
        markGroqUnavailable(undefined, modelName);
        return {
          success: false,
          data: null,
          error: `Groq API error (${response.status}): ${errorMsg}`,
          usage: { durationMs },
          isFallback: true,
        };
      }

      // Retry only short TPM waits.
      if (response.status === 429 && retryCount < 2) {
        const waitMatch = errorMsg.match(/try again in ([0-9.]+)s/);
        const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 250 : 1500;
        console.warn(`[Groq:RateLimit] 429 received. Waiting ${waitMs}ms before automatic retry (${retryCount + 1}/2)...`);
        await new Promise((r) => setTimeout(r, waitMs));
        return generateGroqStructuredContent<T>(prompt, systemInstruction, modelName, retryCount + 1, temperature);
      }

      return {
        success: false,
        data: null,
        error: `Groq API error (${response.status}): ${errorMsg}`,
        usage: { durationMs },
        isFallback: true,
      };
    }

    const json = (await response.json()) as any;
    const contentText = json.choices?.[0]?.message?.content || '';
    const { data: parsedData, repaired } = parseModelJson<T>(contentText);
    if (repaired) console.warn(`[Groq] Repaired malformed JSON from ${modelName}`);

    return {
      success: true,
      data: parsedData,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens,
        durationMs,
      },
      isFallback: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      data: null,
      error: err.name === 'AbortError' ? 'Groq request timed out after 90s' : err.message,
      usage: { durationMs },
      isFallback: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generates natural language text from Groq using openai/gpt-oss-120b.
 */
export async function generateGroqTextContent(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GROQ_MODEL
): Promise<GroqResult<string>> {
  const apiKey = getGroqApiKey();
  const startTime = Date.now();

  if (!apiKey) {
    return {
      success: false,
      data: null,
      isFallback: true,
      error: 'GROQ_API_KEY is not configured in environment or backend/.env',
    };
  }

  groqCallCounter++;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: prompt });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = errorText;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed.error?.message || errorText;
      } catch {}
      return {
        success: false,
        data: null,
        error: `Groq API error (${response.status}): ${errorMsg}`,
        usage: { durationMs },
        isFallback: true,
      };
    }

    const json = (await response.json()) as any;
    const contentText = json.choices?.[0]?.message?.content || '';

    return {
      success: true,
      data: contentText,
      usage: {
        promptTokens: json.usage?.prompt_tokens,
        completionTokens: json.usage?.completion_tokens,
        totalTokens: json.usage?.total_tokens,
        durationMs,
      },
      isFallback: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      success: false,
      data: null,
      error: err.name === 'AbortError' ? 'Groq request timed out after 25s' : err.message,
      usage: { durationMs },
      isFallback: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
