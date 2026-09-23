import { describe, expect, it } from 'vitest';
import type { FollowUpQuestion } from '../../types';
import { answerFor } from './payload';
import { questionFlow } from './questionFlow';

const q = (id: string): FollowUpQuestion => ({
  id,
  question: `${id}?`,
  subtitle: '',
  options: ['A', 'B'],
  allowCustom: true,
  retry: { question: `${id} again?`, subtitle: '' },
});

type Update<T> = T | ((prev: T) => T);
const apply = <T>(prev: T, next: Update<T>) => (typeof next === 'function' ? (next as (p: T) => T)(prev) : next);

/** Mirrors the hook's state so a flow can be re-derived after each action, as a re-render would. */
function harness(questions: FollowUpQuestion[]) {
  const s = {
    activeQuestionIndex: 0,
    answers: {} as Record<string, string>,
    customAnswers: {} as Record<string, string>,
    skipCounts: {} as Record<string, number>,
    finished: 0,
  };
  const flow = () => {
    const resolved = (x: FollowUpQuestion) =>
      Boolean(answerFor(x, s)) || (!answerFor(x, s) && (s.skipCounts[x.id] || 0) >= 2);
    return questionFlow(
      {
        activeQuestionIndex: s.activeQuestionIndex,
        skipCounts: s.skipCounts,
        isResolved: resolved,
        shownQuestion: (x) => ((s.skipCounts[x.id] || 0) >= 1 && x.retry ? x.retry : { question: x.question, subtitle: x.subtitle }),
        setActiveQuestionIndex: (v) => (s.activeQuestionIndex = apply(s.activeQuestionIndex, v)),
        setAnswers: (v) => (s.answers = apply(s.answers, v)),
        setCustomAnswers: (v) => (s.customAnswers = apply(s.customAnswers, v)),
        setSkipCounts: (v) => (s.skipCounts = apply(s.skipCounts, v)),
      },
      questions,
      () => (s.finished += 1),
    );
  };
  return { s, flow };
}

describe('questionFlow', () => {
  it('a first skip rewords the question and stays; a second skip moves on', () => {
    const { s, flow } = harness([q('a'), q('b')]);
    flow().skipCurrent();
    expect(s.activeQuestionIndex).toBe(0);
    expect(flow().currentShown?.question).toBe('a again?');
    flow().skipCurrent();
    expect(s.skipCounts.a).toBe(2);
    expect(s.activeQuestionIndex).toBe(1);
  });

  it('choosing an option clears a typed answer', () => {
    const { s, flow } = harness([q('a')]);
    flow().typeAnswer('Some notes');
    flow().chooseOption('B');
    expect(s.answers).toEqual({ a: 'B' });
    expect(s.customAnswers).toEqual({ a: '' });
  });

  it('after the last question, returns to the first unresolved one before finishing the step', () => {
    const { s, flow } = harness([q('a'), q('b')]);
    flow().showQuestion(1);
    flow().chooseOption('A');
    flow().moveOn(1);
    expect(s.activeQuestionIndex).toBe(0);
    expect(s.finished).toBe(0);

    flow().chooseOption('B');
    flow().moveOn(0);
    flow().moveOn(1);
    expect(s.finished).toBe(1);
  });

  it('knows when moving on finishes the step', () => {
    const { s, flow } = harness([q('a'), q('b')]);
    expect(flow().isLastStop).toBe(false);
    flow().showQuestion(1);
    expect(flow().isLastStop).toBe(false);
    s.answers = { a: 'A' };
    expect(flow().isLastStop).toBe(true);
  });

  it('skipping the last question twice finishes the step', () => {
    const { s, flow } = harness([q('a')]);
    flow().skipCurrent();
    flow().skipCurrent();
    expect(s.skipCounts.a).toBe(2);
    expect(s.finished).toBe(1);
  });

  it('clamps an out-of-range index to the last question', () => {
    const { s, flow } = harness([q('a'), q('b')]);
    s.activeQuestionIndex = 5;
    expect(flow().safeIdx).toBe(1);
    expect(flow().currentQ?.id).toBe('b');
  });

  it('an empty group has no current question and finishes at once', () => {
    const { s, flow } = harness([]);
    expect(flow().currentQ).toBeUndefined();
    expect(flow().isLastStop).toBe(true);
    flow().moveOn(0);
    expect(s.finished).toBe(1);
  });
});
