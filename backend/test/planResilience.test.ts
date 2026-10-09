import { describe, it, expect, vi } from 'vitest';
import { parseModelJson } from '../src/lib/ai/modelJson.js';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';

describe('Model JSON repair', () => {
  it('repairs the sourdough-style broken token instead of throwing', () => {
    const broken = '{"steps":[{"title":"Fold","instructions":ing}]}';
    const { data, repaired } = parseModelJson<{ steps: Array<{ title: string }> }>(broken);
    expect(repaired).toBe(true);
    expect(data.steps[0].title).toBe('Fold');
  });

  it('parses fenced JSON without calling it repaired', () => {
    const { data, repaired } = parseModelJson<{ ok: boolean }>('```json\n{"ok": true}\n```');
    expect(data.ok).toBe(true);
    expect(repaired).toBe(false);
  });
});

describe('LLM cascade without a fallback provider', () => {
  it('answers a miss when Gemini has no key, and calls nothing else', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await generateStructuredContent<{ ok: boolean }>('Say ok', undefined, undefined, { responseSchema: { type: 'object' } });
    expect(result).toMatchObject({ success: false, data: null, provider: 'deterministic', error: 'GEMINI_API_KEY is not configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
