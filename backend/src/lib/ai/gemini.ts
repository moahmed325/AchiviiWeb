import { GoogleGenAI } from '@google/genai';

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

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

/**
 * Generates structured JSON using Gemini with responseMimeType: "application/json".
 * If the API key is not configured or an error occurs, returns null so the caller can use its deterministic fallback.
 */
export async function generateStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<GenerationResult<T>> {
  const client = getGeminiClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      data: null,
      isFallback: true,
      error: 'GEMINI_API_KEY is not configured',
    };
  }

  try {
    const config: any = {
      responseMimeType: 'application/json',
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config,
    });

    const durationMs = Date.now() - startTime;
    const text = response.text || '';
    const parsed = JSON.parse(text) as T;

    const usage: GenerationUsage = {
      promptTokens: (response as any).usageMetadata?.promptTokenCount,
      candidatesTokens: (response as any).usageMetadata?.candidatesTokenCount,
      totalTokens: (response as any).usageMetadata?.totalTokenCount,
      durationMs,
    };

    return {
      success: true,
      data: parsed,
      usage,
      isFallback: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.warn('[Gemini] Structured content generation failed, falling back to deterministic template:', err.message);
    return {
      success: false,
      data: null,
      error: err.message,
      usage: { durationMs },
      isFallback: true,
    };
  }
}

/**
 * Generates natural language text using Gemini (solely for the Coach role).
 */
export async function generateTextContent(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<GenerationResult<string>> {
  const client = getGeminiClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      data: null,
      isFallback: true,
      error: 'GEMINI_API_KEY is not configured',
    };
  }

  try {
    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await client.models.generateContent({
      model: modelName,
      contents: prompt,
      config,
    });

    const durationMs = Date.now() - startTime;
    const text = response.text || '';

    const usage: GenerationUsage = {
      promptTokens: (response as any).usageMetadata?.promptTokenCount,
      candidatesTokens: (response as any).usageMetadata?.candidatesTokenCount,
      totalTokens: (response as any).usageMetadata?.totalTokenCount,
      durationMs,
    };

    return {
      success: true,
      data: text,
      usage,
      isFallback: false,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.warn('[Gemini] Text generation failed, falling back to deterministic template:', err.message);
    return {
      success: false,
      data: null,
      error: err.message,
      usage: { durationMs },
      isFallback: true,
    };
  }
}
