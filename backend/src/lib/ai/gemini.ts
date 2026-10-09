import { GoogleGenAI } from '@google/genai';
import { parseModelJson } from './modelJson.js';

export interface GenerationUsage {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
  durationMs: number;
}

export interface GenerationResult<T = string> {
  success: boolean;
  data: T | null;
  usage?: GenerationUsage;
  error?: string;
  isFallback: boolean;
  provider?: 'gemini' | 'deterministic';
}

/**
 * Shared Gemini client instance, lazily instantiated when GEMINI_API_KEY is present.
 */
let clientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'placeholder' || apiKey.trim() === '') {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

export interface StructuredOptions {
  /** JSON Schema that Gemini is held to. */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
}

/**
 * Generates structured JSON using the provider cascade:
 * 1. Gemini (gemini-3.5-flash-lite) — 1M context, ~500 free RPD, enough for 12-week JSON. Busy and rate-limit
 *    errors are retried, and a schema the API rejects is retried without it.
 * 2. No fallback provider for now (Groq was removed). A second provider goes here.
 * 3. Caller handles a total miss.
 */
export async function generateStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL,
  options: StructuredOptions = {}
): Promise<GenerationResult<T>> {
  const gemini = await tryGeminiStructured<T>(prompt, systemInstruction, modelName, options);
  if (gemini.success && gemini.data) return gemini;
  if (gemini.error) {
    console.warn('[LLM:Cascade] Gemini failed:', gemini.error);
  }

  return {
    success: false,
    data: null,
    isFallback: true,
    provider: 'deterministic',
    error: gemini.error || 'GEMINI_API_KEY produced no result',
  };
}

/** Gemini's schema rejections are a bare 400 INVALID_ARGUMENT with no mention of the schema. */
function isSchemaRejection(message: string): boolean {
  return /INVALID_ARGUMENT|"code":400/.test(message);
}

async function tryGeminiStructured<T>(
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string,
  options: StructuredOptions = {}
): Promise<GenerationResult<T>> {
  const client = getGeminiClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      data: null,
      isFallback: true,
      provider: 'deterministic',
      error: 'GEMINI_API_KEY is not configured',
    };
  }

  try {
    const config: any = {
      responseMimeType: 'application/json',
      temperature: options.temperature ?? 0.0,
      seed: 42,
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (options.responseSchema) {
      config.responseJsonSchema = options.responseSchema;
    }

    let response: { text?: string; usageMetadata?: unknown };
    try {
      response = await generateGeminiWithRetry(client, modelName, prompt, config);
    } catch (err: any) {
      if (!config.responseJsonSchema || !isSchemaRejection(String(err?.message || err))) throw err;
      console.warn('[Gemini] Schema rejected by the API, retrying without it:', err?.message);
      delete config.responseJsonSchema;
      response = await generateGeminiWithRetry(client, modelName, prompt, config);
    }

    const durationMs = Date.now() - startTime;
    const { data: parsed, repaired } = parseModelJson<T>(response.text || '');
    if (repaired) console.warn(`[Gemini] Repaired malformed JSON from ${modelName}`);

    return {
      success: true,
      data: parsed,
      usage: {
        promptTokens: (response as any).usageMetadata?.promptTokenCount,
        candidatesTokens: (response as any).usageMetadata?.candidatesTokenCount,
        totalTokens: (response as any).usageMetadata?.totalTokenCount,
        durationMs,
      },
      isFallback: false,
      provider: 'gemini',
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err.message,
      usage: { durationMs: Date.now() - startTime },
      isFallback: true,
      provider: 'deterministic',
    };
  }
}

function isTransientGeminiError(message: string): boolean {
  return /UNAVAILABLE|high demand|503|RESOURCE_EXHAUSTED|429/i.test(message);
}

async function generateGeminiWithRetry(
  client: GoogleGenAI,
  modelName: string,
  prompt: string,
  config: Record<string, unknown>,
  attempt = 0
): Promise<{ text?: string; usageMetadata?: unknown }> {
  try {
    return await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config,
    });
  } catch (err: any) {
    const message = String(err?.message || err);
    if (attempt < 2 && isTransientGeminiError(message)) {
      const waitMs = 4000 * (attempt + 1);
      console.warn(`[Gemini] Transient error. Retrying in ${waitMs}ms (${attempt + 1}/2)...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return generateGeminiWithRetry(client, modelName, prompt, config, attempt + 1);
    }
    throw err;
  }
}

/**
 * Generates natural language text using the provider cascade (Gemini -> miss).
 */
export async function generateTextContent(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<GenerationResult<string>> {
  const gemini = await tryGeminiText(prompt, systemInstruction, modelName);
  if (gemini.success && gemini.data) return gemini;
  if (gemini.error) {
    console.warn('[LLM:Cascade] Gemini text failed:', gemini.error);
  }

  return {
    success: false,
    data: null,
    isFallback: true,
    provider: 'deterministic',
    error: gemini.error || 'GEMINI_API_KEY produced no result',
  };
}

async function tryGeminiText(
  prompt: string,
  systemInstruction: string | undefined,
  modelName: string
): Promise<GenerationResult<string>> {
  const client = getGeminiClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      data: null,
      isFallback: true,
      provider: 'deterministic',
      error: 'GEMINI_API_KEY is not configured',
    };
  }

  try {
    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await generateGeminiWithRetry(client, modelName, prompt, config);

    return {
      success: true,
      data: response.text || '',
      usage: {
        promptTokens: (response as any).usageMetadata?.promptTokenCount,
        candidatesTokens: (response as any).usageMetadata?.candidatesTokenCount,
        totalTokens: (response as any).usageMetadata?.totalTokenCount,
        durationMs: Date.now() - startTime,
      },
      isFallback: false,
      provider: 'gemini',
    };
  } catch (err: any) {
    return {
      success: false,
      data: null,
      error: err.message,
      usage: { durationMs: Date.now() - startTime },
      isFallback: true,
      provider: 'deterministic',
    };
  }
}
