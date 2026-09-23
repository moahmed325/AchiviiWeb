import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  buildClarifyPrompt,
  checkClarifyAnswer,
  clarifyGoalWithAI,
  QUESTION_IDS,
  RETRY_FALLBACK_SUBTITLE,
  type RawClarifyAnswer,
} from '../src/lib/ai/clarify.js';

function question(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    question: `Question about ${id}?`,
    subtitle: `Why we ask about ${id}`,
    options: ['Option A', 'Option B', 'Option C'],
    allowCustom: true,
    retry: { question: `Easier question about ${id}?`, subtitle: 'A rough guess is fine.' },
    ...overrides,
  };
}

function answer(overrides: Partial<RawClarifyAnswer> = {}): RawClarifyAnswer {
  return {
    workingTitle: 'Become a live streamer',
    domain: 'Live streaming',
    questions: QUESTION_IDS.map((id) => question(id)),
    ...overrides,
  };
}

describe('checkClarifyAnswer', () => {
  it('accepts a complete answer and maps it to the wizard shape', () => {
    const result = checkClarifyAnswer(answer());
    expect('value' in result).toBe(true);
    if (!('value' in result)) return;
    expect(result.value.clarifiedOutcome).toBe('Become a live streamer');
    expect(result.value.primaryDomain).toBe('Live streaming');
    expect(result.value.followUpQuestions.map((q) => q.id)).toEqual([...QUESTION_IDS]);
    expect(result.value.followUpQuestions[0].retry.question).toBe('Easier question about current_level?');
  });

  it('puts the questions back in the agreed order', () => {
    const shuffled = [...QUESTION_IDS].reverse().map((id) => question(id));
    const result = checkClarifyAnswer(answer({ questions: shuffled }));
    if (!('value' in result)) throw new Error(result.reason);
    expect(result.value.followUpQuestions.map((q) => q.id)).toEqual([...QUESTION_IDS]);
  });

  it('rejects a missing question with a reason the model can act on', () => {
    const result = checkClarifyAnswer(answer({ questions: QUESTION_IDS.slice(0, 3).map((id) => question(id)) }));
    expect(result).toEqual({ reason: expect.stringContaining('"obstacle" is missing') });
  });

  it('dedupes options, caps them at 5, and rejects fewer than 3', () => {
    const many = checkClarifyAnswer(answer({
      questions: QUESTION_IDS.map((id) => question(id, { options: ['A', 'a', 'B', 'C', 'D', 'E', 'F'] })),
    }));
    if (!('value' in many)) throw new Error(many.reason);
    expect(many.value.followUpQuestions[0].options).toEqual(['A', 'B', 'C', 'D', 'E']);

    const few = checkClarifyAnswer(answer({
      questions: QUESTION_IDS.map((id) => question(id, { options: ['Yes', 'yes', ' '] })),
    }));
    expect(few).toEqual({ reason: expect.stringContaining('needs 3 to 5 different options') });
  });

  it('falls back to the same question when the retry wording is missing or identical', () => {
    const result = checkClarifyAnswer(answer({
      questions: QUESTION_IDS.map((id, i) =>
        question(id, { retry: i === 0 ? null : { question: `Question about ${id}?`, subtitle: '' } })
      ),
    }));
    if (!('value' in result)) throw new Error(result.reason);
    for (const q of result.value.followUpQuestions) {
      expect(q.retry).toEqual({ question: q.question, subtitle: RETRY_FALLBACK_SUBTITLE });
    }
  });

  it('forces allowCustom on, so every question has "write your own"', () => {
    const result = checkClarifyAnswer(answer({
      questions: QUESTION_IDS.map((id) => question(id, { allowCustom: false })),
    }));
    if (!('value' in result)) throw new Error(result.reason);
    expect(result.value.followUpQuestions.every((q) => q.allowCustom)).toBe(true);
  });

  it('rejects an empty or run-on title', () => {
    expect(checkClarifyAnswer(answer({ workingTitle: 'Stream' }))).toEqual({ reason: expect.stringContaining('workingTitle') });
    const longTitle = 'Become a full time live streamer with a big audience and sponsors and merch by day ninety';
    expect(checkClarifyAnswer(answer({ workingTitle: longTitle }))).toEqual({ reason: expect.stringContaining('workingTitle') });
  });
});

describe('buildClarifyPrompt', () => {
  it('asks for the four agreed questions and none of the removed fields', () => {
    const prompt = buildClarifyPrompt('I want to be a streamer');
    expect(prompt).toContain('"I want to be a streamer"');
    for (const id of QUESTION_IDS) expect(prompt).toContain(`id "${id}"`);
    expect(prompt).toContain('"retry"');
    for (const removed of ['canonicalKey', 'capabilities', 'scientificFrameworks', 'verificationCriteria']) {
      expect(prompt).not.toContain(removed);
    }
  });
});

describe('clarifyGoalWithAI', () => {
  const generate = vi.mocked(generateStructuredContent);
  beforeEach(() => generate.mockReset());

  it('retries once with the rejection reason, then returns the fixed answer', async () => {
    generate
      .mockResolvedValueOnce({ success: true, data: answer({ questions: [] }) } as never)
      .mockResolvedValueOnce({ success: true, data: answer() } as never);

    const result = await clarifyGoalWithAI('I want to be a streamer');

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0]).toContain('YOUR PREVIOUS ANSWER WAS REJECTED');
    expect(result.followUpQuestions).toHaveLength(4);
  });

  it('throws after two bad answers instead of inventing questions', async () => {
    generate.mockResolvedValue({ success: false, error: 'quota' } as never);
    await expect(clarifyGoalWithAI('I want to be a streamer')).rejects.toThrow('Unable to analyze your goal');
  });

  it('skips the model for presets and still gives every question a retry', async () => {
    const result = await clarifyGoalWithAI('Run a 10k in under 50 minutes');
    expect(generate).not.toHaveBeenCalled();
    expect(result.followUpQuestions.every((q) => q.retry.subtitle === RETRY_FALLBACK_SUBTITLE)).toBe(true);
  });
});
