import { describe, it, expect, beforeEach } from 'vitest';
import {
  isGroqDailyLimitError,
  isGroqUnavailable,
  markGroqUnavailable,
  resetGroqAvailability,
} from '../src/lib/ai/groq.js';

describe('LLM provider limits', () => {
  beforeEach(() => {
    resetGroqAvailability();
  });

  it('treats Groq TPD 429 copy as a daily limit, not a short TPM wait', () => {
    const daily =
      'Rate limit reached for model `openai/gpt-oss-120b` on tokens per day (TPD): Limit 200000';
    expect(isGroqDailyLimitError(daily)).toBe(true);
    expect(isGroqDailyLimitError('Rate limit reached on tokens per minute (TPM)')).toBe(false);
  });

  it('skips Groq after a daily-limit cooldown is set', () => {
    expect(isGroqUnavailable()).toBe(false);
    markGroqUnavailable(60_000);
    expect(isGroqUnavailable()).toBe(true);
    resetGroqAvailability();
    expect(isGroqUnavailable()).toBe(false);
  });
});
