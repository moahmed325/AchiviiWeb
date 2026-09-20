import { GoogleGenAI } from '@google/genai';
import {
  generateGroqStructuredContent,
  generateGroqTextContent,
  getGroqApiKey,
} from './groq.js';

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

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

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

/**
 * Generates structured JSON using the tiered provider cascade:
 * 1. Primary: Groq (llama-3.3-70b-versatile) with native JSON mode. Free, no card required, high throughput.
 * 2. Secondary Fallback: Gemini (gemini-2.5-flash-lite) with application/json.
 * 3. Final Safety Net: Deterministic parser / template in caller.
 */
export async function generateStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<GenerationResult<T>> {
  llmCallCounter++;

  // 1. Primary Provider: Groq
  if (getGroqApiKey()) {
    const groqResult = await generateGroqStructuredContent<T>(prompt, systemInstruction);
    if (groqResult.success && groqResult.data) {
      return {
        success: true,
        data: groqResult.data,
        usage: groqResult.usage,
        isFallback: false,
        provider: 'groq',
      };
    }
    console.warn('[LLM:Cascade] Groq call failed or returned null, falling back to Gemini:', groqResult.error);
  }

  // 2. Secondary Fallback: Gemini
  const client = getGeminiClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      data: null,
      isFallback: true,
      provider: 'deterministic',
      error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured',
    };
  }

  try {
    const config: any = {
      responseMimeType: 'application/json',
      temperature: 0.0,
      seed: 42,
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
      provider: 'gemini',
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
      provider: 'deterministic',
    };
  }
}

/**
 * Generates natural language text using the provider cascade (Groq -> Gemini -> Fallback).
 */
export async function generateTextContent(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GEMINI_MODEL
): Promise<GenerationResult<string>> {
  llmCallCounter++;

  // 1. Primary Provider: Groq
  if (getGroqApiKey()) {
    const groqResult = await generateGroqTextContent(prompt, systemInstruction);
    if (groqResult.success && groqResult.data) {
      return {
        success: true,
        data: groqResult.data,
        usage: groqResult.usage,
        isFallback: false,
        provider: 'groq',
      };
    }
    console.warn('[LLM:Cascade] Groq text generation failed, falling back to Gemini:', groqResult.error);
  }

  // 2. Secondary Fallback: Gemini
  const client = getGeminiClient();
  const startTime = Date.now();

  if (!client) {
    return {
      success: false,
      data: null,
      isFallback: true,
      provider: 'deterministic',
      error: 'Neither GROQ_API_KEY nor GEMINI_API_KEY is configured',
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
