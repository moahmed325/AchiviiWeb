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
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string; // snippet/summary
  score: number;
  raw_content?: string | null;
  published_date?: string;
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
   * Search endpoint: executes real-time web search and returns ranked raw results.
   */
  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
    if (!query || query.trim() === '') {
      throw new Error('Tavily search query must not be empty.');
    }

    const endpoint = `${this.baseUrl}/search`;
    tavilyCallCounter++;
    const timeoutMs = options.timeoutMs ?? 20000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const payload: Record<string, any> = {
      api_key: this.apiKey,
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

      if (!response.ok) {
        const rawText = await response.text();
        let errorDetails = rawText;
        try {
          const errJson = JSON.parse(rawText);
          errorDetails = errJson.detail?.error || errJson.error || (typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson));
        } catch {
          // fallback to rawText
        }
        throw new Error(`Tavily search failed (${response.status} ${response.statusText}): ${errorDetails}`);
      }

      const data = (await response.json()) as TavilySearchResponse;
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Tavily search timed out after ${timeoutMs}ms for query: "${query}"`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract endpoint: retrieves full parsed page content for given URLs.
   */
  async extract(urls: string | string[], options: { timeoutMs?: number } = {}): Promise<TavilyExtractResponse> {
    const urlList = (Array.isArray(urls) ? urls : [urls]).filter((u) => typeof u === 'string' && u.trim().length > 0);
    if (urlList.length === 0) {
      throw new Error('Tavily extract requires at least one valid URL.');
    }

    const endpoint = `${this.baseUrl}/extract`;
    tavilyCallCounter++;
    const timeoutMs = options.timeoutMs ?? 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      api_key: this.apiKey,
      urls: urlList,
    };

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

      if (!response.ok) {
        const rawText = await response.text();
        let errorDetails = rawText;
        try {
          const errJson = JSON.parse(rawText);
          errorDetails = errJson.detail?.error || errJson.error || (typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson));
        } catch {
          // fallback to rawText
        }
        throw new Error(`Tavily extract failed (${response.status} ${response.statusText}): ${errorDetails}`);
      }

      const data = (await response.json()) as TavilyExtractResponse;
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Tavily extract timed out after ${timeoutMs}ms for ${urlList.length} URLs`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
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
