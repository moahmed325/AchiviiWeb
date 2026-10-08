import { describe, it, expect, beforeEach } from 'vitest';
import { parseModelJson } from '../src/lib/ai/modelJson.js';
import {
  DEFAULT_GROQ_MODEL,
  GROQ_BACKUP_MODEL,
  groqModelsToTry,
  markGroqUnavailable,
  resetGroqAvailability,
} from '../src/lib/ai/groq.js';

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

describe('Groq backup model', () => {
  beforeEach(() => resetGroqAvailability());

  it('moves to the backup model when the main one hits its daily limit', () => {
    expect(groqModelsToTry()).toEqual([DEFAULT_GROQ_MODEL, GROQ_BACKUP_MODEL]);
    markGroqUnavailable(60_000, DEFAULT_GROQ_MODEL);
    expect(groqModelsToTry()).toEqual([GROQ_BACKUP_MODEL]);
    markGroqUnavailable(60_000, GROQ_BACKUP_MODEL);
    expect(groqModelsToTry()).toEqual([]);
  });
});
