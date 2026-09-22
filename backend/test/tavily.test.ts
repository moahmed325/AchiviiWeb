import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TavilyClient, tavilySearch, tavilyExtract } from '../src/lib/tavily.js';

describe('TavilyClient wrapper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('throws an error when TAVILY_API_KEY is missing', () => {
    delete process.env.TAVILY_API_KEY;
    expect(() => new TavilyClient()).toThrow(/TAVILY_API_KEY is not configured/);
  });

  it('initializes successfully when apiKey is provided explicitly or in env', () => {
    const client = new TavilyClient('tvly-test-key-123');
    expect(client).toBeDefined();
  });

  it('constructs correct payload and headers for search endpoint', async () => {
    const mockSearchResponse = {
      query: 'running 10k',
      results: [
        {
          title: 'Daniels Running Formula',
          url: 'https://example.com/vdot',
          content: 'Jack Daniels VDOT training principles...',
          score: 0.98,
          raw_content: null,
        },
      ],
      response_time: 0.32,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSearchResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TavilyClient('tvly-test-key-123');
    const result = await client.search('running 10k', {
      maxResults: 3,
      searchDepth: 'advanced',
      includeDomains: ['runnersworld.com'],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tavily.com/search');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe('Bearer tvly-test-key-123');

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.query).toBe('running 10k');
    expect(parsedBody.max_results).toBe(3);
    expect(parsedBody.search_depth).toBe('advanced');
    expect(parsedBody.include_domains).toEqual(['runnersworld.com']);
    // Tavily deprecated in-body api_key; sending it gets the request rejected at the edge (403).
    expect(parsedBody.api_key).toBeUndefined();
    expect(result.results[0].title).toBe('Daniels Running Formula');
    expect(result.results[0].score).toBe(0.98);
  });

  it('constructs correct payload and headers for extract endpoint', async () => {
    const mockExtractResponse = {
      results: [
        {
          url: 'https://example.com/vdot',
          raw_content: 'Full article text regarding VDOT tables and pacing...',
        },
      ],
      failed_results: [],
      response_time: 0.45,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockExtractResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TavilyClient('tvly-test-key-123');
    const result = await client.extract(['https://example.com/vdot']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tavily.com/extract');
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer tvly-test-key-123');

    const parsedBody = JSON.parse(options.body);
    expect(parsedBody.urls).toEqual(['https://example.com/vdot']);
    expect(parsedBody.api_key).toBeUndefined();
    expect(result.results[0].raw_content).toContain('VDOT tables');
  });

  it('retries transient failures and succeeds on a later attempt', async () => {
    const rateLimited = {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: { get: () => '0' },
      text: async () => JSON.stringify({ detail: { error: 'Rate limit exceeded' } }),
    };
    const success = {
      ok: true,
      json: async () => ({ query: 'running 10k', results: [], response_time: 0.1 }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(success);
    vi.stubGlobal('fetch', fetchMock);

    const client = new TavilyClient('tvly-test-key-123');
    const result = await client.search('running 10k');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.query).toBe('running 10k');
  });

  it('gives up after exhausting retries on persistent transient failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: { get: () => '0' },
      text: async () => 'upstream unavailable',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TavilyClient('tvly-test-key-123');
    await expect(client.search('running 10k', { maxRetries: 2 })).rejects.toThrow(/503 Service Unavailable/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-transient errors such as auth failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: { get: () => null },
      text: async () => JSON.stringify({ detail: { error: 'Invalid API key' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TavilyClient('tvly-invalid-key');
    await expect(client.search('test query')).rejects.toThrow(/401 Unauthorized/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles API error responses with descriptive message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ detail: { error: 'Invalid API key' } }),
      json: async () => ({ detail: { error: 'Invalid API key' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new TavilyClient('tvly-invalid-key');
    await expect(client.search('test query')).rejects.toThrow(/Tavily search failed \(401 Unauthorized\): Invalid API key/);
  });
});
