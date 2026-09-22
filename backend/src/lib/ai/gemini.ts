import { GoogleGenAI } from '@google/genai';
import {
  generateGroqStructuredContent,
  generateGroqTextContent,
  getGroqApiKey,
  groqModelsToTry,
} from './groq.js';
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
  provider?: 'groq' | 'gemini' | 'deterministic';
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

let llmCallCounter = 0;
let embeddingCallCounter = 0;

export function getLlmCallCount(): number {
  return llmCallCounter;
}

export function resetLlmCallCount(): void {
  llmCallCounter = 0;
}

export function getEmbeddingCallCount(): number {
  return embeddingCallCounter;
}

export function resetEmbeddingCallCount(): void {
  embeddingCallCounter = 0;
}

export interface StructuredOptions {
  /** JSON Schema that Gemini is held to. Groq only gets the prompt text. */
  responseSchema?: Record<string, unknown>;
  temperature?: number;
}

/**
 * Generates structured JSON using the tiered provider cascade:
 * 1. Primary: Gemini (gemini-3.5-flash-lite) — 1M context, ~500 free RPD, enough for 12-week JSON.
 * 2. Fallback: Groq openai/gpt-oss-120b, then openai/gpt-oss-20b (separate daily budgets).
 * 3. Caller handles a total miss.
 */
export async function generateStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL,
  options: StructuredOptions = {}
): Promise<GenerationResult<T>> {
  llmCallCounter++;

  const gemini = await tryGeminiStructured<T>(prompt, systemInstruction, modelName, options);
  if (gemini.success && gemini.data) return gemini;
  if (gemini.error) {
    console.warn('[LLM:Cascade] Gemini failed, falling back to Groq:', gemini.error);
  }

  if (getGroqApiKey()) {
    for (const groqModel of groqModelsToTry()) {
      const groqResult = await generateGroqStructuredContent<T>(
        prompt,
        systemInstruction,
        groqModel,
        0,
        options.temperature ?? 0
      );
      if (groqResult.success && groqResult.data) {
        return {
          success: true,
          data: groqResult.data,
          usage: groqResult.usage,
          isFallback: true,
          provider: 'groq',
        };
      }
      console.warn(`[LLM:Cascade] Groq ${groqModel} failed:`, groqResult.error);
    }
  }

  return {
    success: false,
    data: null,
    isFallback: true,
    provider: 'deterministic',
    error: gemini.error || 'Neither GROQ_API_KEY nor GEMINI_API_KEY produced a result',
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
 * Generates natural language text using the provider cascade (Gemini -> Groq -> miss).
 */
export async function generateTextContent(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<GenerationResult<string>> {
  llmCallCounter++;

  const gemini = await tryGeminiText(prompt, systemInstruction, modelName);
  if (gemini.success && gemini.data) return gemini;
  if (gemini.error) {
    console.warn('[LLM:Cascade] Gemini text failed, falling back to Groq:', gemini.error);
  }

  if (getGroqApiKey()) {
    for (const groqModel of groqModelsToTry()) {
      const groqResult = await generateGroqTextContent(prompt, systemInstruction, groqModel);
      if (groqResult.success && groqResult.data) {
        return {
          success: true,
          data: groqResult.data,
          usage: groqResult.usage,
          isFallback: true,
          provider: 'groq',
        };
      }
    }
  }

  return {
    success: false,
    data: null,
    isFallback: true,
    provider: 'deterministic',
    error: gemini.error || 'Neither GROQ_API_KEY nor GEMINI_API_KEY produced a result',
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

export const DEFAULT_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

/**
 * Generates a 768-dimensional embedding vector for text using Gemini.
 * Uses gemini-embedding-001 with outputDimensionality: 768 (active supported model in @google/genai).
 */
export async function generateEmbedding(
  text: string,
  modelName: string = DEFAULT_EMBEDDING_MODEL
): Promise<number[]> {
  embeddingCallCounter++;
  const client = getGeminiClient();
  if (!client) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const response = await client.models.embedContent({
    model: modelName,
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  const values = (response as any).embedding?.values || (response as any).embeddings?.[0]?.values;
  if (!values || !Array.isArray(values)) {
    throw new Error('No embedding values returned from Gemini embedding API');
  }

  return values;
}
