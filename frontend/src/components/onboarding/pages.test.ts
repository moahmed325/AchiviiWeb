import { describe, expect, it } from 'vitest';
import { pageList, sectionOf } from './pages';

const q = (id: string) => ({ id, question: id, subtitle: '', options: ['a', 'b', 'c'], allowCustom: true });

describe('pageList', () => {
  it('puts the essentials first, holds a place for the questions, and ends on the summary', () => {
    expect(pageList({ focusAfter: null, questions: null })).toEqual([
      'goal', 'days', 'weekdays', 'minutes', 'slot', 'day', 'commitments', 'date', 'questions', 'summary',
    ]);
  });

  it('gives each question its own page and puts the focus page after the essential it follows', () => {
    expect(pageList({ focusAfter: 'minutes', questions: [q('current_level'), q('success')] })).toEqual([
      'goal', 'days', 'weekdays', 'minutes', 'focus', 'slot', 'day', 'commitments', 'date', 'q:current_level', 'q:success', 'summary',
    ]);
  });

  it('names the section each page belongs to', () => {
    expect(['goal', 'focus', 'days', 'q:success', 'questions', 'summary'].map((p) => sectionOf(p as never))).toEqual([
      'goal', 'goal', 'week', 'you', 'you', 'ready',
    ]);
  });
});
