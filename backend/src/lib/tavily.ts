import dotenv from 'dotenv';

// Ensure environment variables are loaded if called outside full express bootstrap
dotenv.config();

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced';
  topic?: 'general' | 'news';
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeImages?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  timeoutMs?: number;
  maxRetries?: number;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string; // snippet/summary
  score: number;
  raw_content?: string | null;
  published_date?: string;
  id?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  response_time: number;
  answer?: string;
  images?: Array<{ url: string; description?: string }>;
  [key: string]: any;
}

export interface TavilyExtractResult {
  url: string;
  raw_content: string;
}

export interface TavilyExtractFailedResult {
  url: string;
  error: string;
}

export interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results: TavilyExtractFailedResult[];
  response_time: number;
  [key: string]: any;
}

/** Transient failures worth another attempt. Auth/quota/validation errors are not retried. */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const DEFAULT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTavilyError(rawText: string): string {
  try {
    const errJson = JSON.parse(rawText);
    return (
      errJson.detail?.error ||
      errJson.error ||
      (typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson))
    );
  } catch {
    return rawText;
  }
}

/**
 * Exponential backoff with jitter, capped at 8s. A server-sent Retry-After wins
 * over our own schedule when present.
 */
function computeBackoffMs(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 30000);
    }
  }
  const exponential = BASE_RETRY_DELAY_MS * 2 ** attempt;
  return Math.min(exponential, 8000) + Math.random() * 250;
}

export class TavilyClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.tavily.com') {
    const resolvedKey = apiKey || process.env.TAVILY_API_KEY;
    if (!resolvedKey || resolvedKey.trim() === '' || resolvedKey === 'placeholder') {
      throw new Error(
        'TAVILY_API_KEY is not configured. Please define TAVILY_API_KEY in your environment or backend/.env file.'
      );
    }
    this.apiKey = resolvedKey.trim();
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Issues a POST and retries transient failures. Timeouts are not retried so a
   * stalled request can't multiply the caller's latency budget — Stage 2 fans out
   * several of these in parallel and needs a bounded worst case.
   */
  private async post<T>(
    path: 'search' | 'extract',
    payload: Record<string, any>,
    timeoutMs: number,
    maxRetries: number,
    timeoutMessage: string
  ): Promise<T> {
    const endpoint = `${this.baseUrl}/${path}`;

    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.ok) {
          return (await response.json()) as T;
        }

        const rawText = await response.text();
        if (response.status === 403 && /<html/i.test(rawText)) {
          throw new Error('Search is blocked from this network (403). Connect a VPN and retry.');
        }

        const failure = new Error(
          `Tavily ${path} failed (${response.status} ${response.statusText}): ${parseTavilyError(rawText)}`
        );

        if (attempt >= maxRetries || !RETRYABLE_STATUS_CODES.has(response.status)) {
          throw failure;
        }

        const retryAfter = response.headers?.get?.('retry-after');
        console.warn(
          `[Tavily] ${path} attempt ${attempt + 1}/${maxRetries + 1} got ${response.status}; retrying.`
        );
        await sleep(computeBackoffMs(attempt, retryAfter));
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          throw new Error(timeoutMessage);
        }
        // Network-level faults (DNS, reset connections) are transient; API errors already threw above.
        const isNetworkFault = err instanceof TypeError;
        if (!isNetworkFault || attempt >= maxRetries) {
          throw err;
        }
        console.warn(
          `[Tavily] ${path} attempt ${attempt + 1}/${maxRetries + 1} network error: ${err.message}; retrying.`
        );
        await sleep(computeBackoffMs(attempt));
      } finally {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Search endpoint: executes real-time web search and returns ranked raw results.
   */
  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
    if (!query || query.trim() === '') {
      throw new Error('Tavily search query must not be empty.');
    }

    tavilyCallCounter++;
    const timeoutMs = options.timeoutMs ?? 20000;

    const payload: Record<string, any> = {
      query: query.trim(),
      search_depth: options.searchDepth ?? 'basic',
      topic: options.topic ?? 'general',
      max_results: options.maxResults ?? 5,
      include_answer: options.includeAnswer ?? false,
      include_raw_content: options.includeRawContent ?? false,
      include_images: options.includeImages ?? false,
    };

    if (options.includeDomains && options.includeDomains.length > 0) {
      payload.include_domains = options.includeDomains;
    }
    if (options.excludeDomains && options.excludeDomains.length > 0) {
      payload.exclude_domains = options.excludeDomains;
    }

    return this.post<TavilySearchResponse>(
      'search',
      payload,
      timeoutMs,
      options.maxRetries ?? DEFAULT_MAX_RETRIES,
      `Tavily search timed out after ${timeoutMs}ms for query: "${query}"`
    );
  }

  /**
   * Extract endpoint: retrieves full parsed page content for given URLs.
   */
  async extract(
    urls: string | string[],
    options: { timeoutMs?: number; maxRetries?: number } = {}
  ): Promise<TavilyExtractResponse> {
    const urlList = (Array.isArray(urls) ? urls : [urls]).filter((u) => typeof u === 'string' && u.trim().length > 0);
    if (urlList.length === 0) {
      throw new Error('Tavily extract requires at least one valid URL.');
    }

    tavilyCallCounter++;
    const timeoutMs = options.timeoutMs ?? 30000;

    return this.post<TavilyExtractResponse>(
      'extract',
      { urls: urlList },
      timeoutMs,
      options.maxRetries ?? DEFAULT_MAX_RETRIES,
      `Tavily extract timed out after ${timeoutMs}ms for ${urlList.length} URLs`
    );
  }
}

let tavilyCallCounter = 0;

export function getTavilyCallCount(): number {
  return tavilyCallCounter;
}

export function resetTavilyCallCount(): void {
  tavilyCallCounter = 0;
}

/**
 * Singleton client instance helper
 */
let defaultClientInstance: TavilyClient | null = null;

export function getTavilyClient(): TavilyClient {
  if (!defaultClientInstance) {
    defaultClientInstance = new TavilyClient();
  }
  return defaultClientInstance;
}

/**
 * Convenience helper: tavilySearch
 */
export async function tavilySearch(
  query: string,
  options?: TavilySearchOptions
): Promise<TavilySearchResponse> {
  const client = getTavilyClient();
  return client.search(query, options);
}

/**
 * Convenience helper: tavilyExtract
 */
export async function tavilyExtract(
  urls: string | string[],
  options?: { timeoutMs?: number }
): Promise<TavilyExtractResponse> {
  const client = getTavilyClient();
  return client.extract(urls, options);
}
