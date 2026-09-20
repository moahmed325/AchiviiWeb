import dotenv from 'dotenv';

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

let groqCallCounter = 0;

export function getGroqCallCount(): number {
  return groqCallCounter;
}

export function resetGroqCallCount(): void {
  groqCallCounter = 0;
}

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.trim() === '' || key === 'placeholder') {
    return null;
  }
  return key.trim();
}

/**
 * Generates structured JSON from Groq using llama-3.3-70b-versatile with response_format: { type: "json_object" }.
 */
export async function generateGroqStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  modelName: string = DEFAULT_GROQ_MODEL,
  retryCount: number = 0
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
        response_format: { type: 'json_object' },
        temperature: 0.0,
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

      // Handle transient TPM 429 rate limits with automatic retry
      if (response.status === 429 && retryCount < 2) {
        const waitMatch = errorMsg.match(/try again in ([0-9.]+)s/);
        const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 250 : 1500;
        console.warn(`[Groq:RateLimit] 429 received. Waiting ${waitMs}ms before automatic retry (${retryCount + 1}/2)...`);
        await new Promise((r) => setTimeout(r, waitMs));
        return generateGroqStructuredContent<T>(prompt, systemInstruction, modelName, retryCount + 1);
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
    const parsedData = JSON.parse(contentText) as T;

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
      error: err.name === 'AbortError' ? 'Groq request timed out after 25s' : err.message,
      usage: { durationMs },
      isFallback: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Generates natural language text from Groq using llama-3.3-70b-versatile.
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
