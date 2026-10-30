import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { DailyTask, Goal } from '../../types';
import { BreakChoice, CLOSE_FAILED, GETTING_READY } from './WeekClose';
import { DailyTimeCard } from './DailyTimeCard';
import { FeelPicker } from './FeelPicker';
import { NOT_SAVED, WEEK_CLOSED_LINES } from '../../lib/weekClose';
import { FIRST_WEEK_BACK_LINE } from '../../lib/stepLines';

// Weekly update M4.1a (requirement 2, RULE-7, section 6): every line the feature shows in the app is free of the
// forbidden words and asks nothing, except the questions the copy table holds. No weekly tests (2026-10-30): the test,
// re-test and late-test lines went; the feel tap's question is in the table.

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 't' }), useAuthToken: () => null }));
vi.mock('../../context/GoalContext', () => ({
  useGoal: () => ({ answerChoice: vi.fn(), refreshGoal: vi.fn(async () => undefined), activeGoal: null, updateActiveGoal: vi.fn() }),
}));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  answerDailyTime: vi.fn(async () => ({ dailyMinutes: 30 })),
  updateDailyTask: vi.fn(async () => {
    throw new Error('offline');
  }),
}));

const FORBIDDEN = /\b(missed|behind|failed|fail)\b/i;
/** The copy table's own questions (section 6: "Daily-time check"; no weekly tests, section 7: the feel tap). */
const TABLE_QUESTIONS = [/^Does \d+ minutes a day still work\?$/, /^How did it feel\?$/];

function expectClean(line: string) {
  expect(line, line).not.toMatch(FORBIDDEN);
  const sentences = line.match(/[^.?!…]+[.?!…]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  for (const sentence of sentences) {
    if (sentence.includes('?')) expect(TABLE_QUESTIONS.some((q) => q.test(sentence)), sentence).toBe(true);
  }
}

const goal = { id: 'g1', rawGoal: 'Run 10 km', roadmapWeeks: [] } as unknown as Goal;

describe('the app lines pass the copy check (M4.1a requirement 2)', () => {
  it('the check itself refuses a forbidden word and any other question', () => {
    expect(() => expectClean('You fell behind this week.')).toThrow();
    expect(() => expectClean('Ready for next week?')).toThrow();
    expect(() => expectClean('How did it feel? Optional.')).not.toThrow();
  });

  it('fixed lines and lines built from data', () => {
    const lines = [
      GETTING_READY,
      CLOSE_FAILED,
      ...Object.values(WEEK_CLOSED_LINES),
      'Paused',
    ];
    lines.forEach(expectClean);
  });

  it.each(['keep_going', 'final_week'] as const)('the choice card after a break (%s)', (choice) => {
    render(
      <MemoryRouter>
        <BreakChoice goal={goal} choice={choice} />
      </MemoryRouter>
    );
    const card = screen.getByRole('region', { name: 'Welcome back.' });
    expectClean(card.textContent ?? '');
    for (const button of within(card).getAllByRole('button')) expectClean(button.textContent ?? '');
  });

  it('the daily-time card, before and after a shorter choice', async () => {
    const user = userEvent.setup();
    render(<DailyTimeCard check={{ minutes: 60, shorter: [30, 45] }} />);
    expectClean(screen.getByRole('heading').textContent ?? '');
    await user.click(screen.getByRole('button', { name: 'Make it shorter' }));
    for (const button of screen.getAllByRole('button')) expectClean(button.textContent ?? '');
    await user.click(screen.getByRole('button', { name: '30 min' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('From next week, your sessions are 30 minutes.');
    expectClean(status.textContent ?? '');
  });
});

describe("section 6's app lines and step texts, word for word (M4.1b requirement 6, WU-62 (4))", () => {
  it('the fixed lines', () => {
    expect(GETTING_READY).toBe('Getting your next week ready…');
    expect(CLOSE_FAILED).toBe("Couldn't get your next week ready. Please try again.");
    expect(WEEK_CLOSED_LINES).toEqual({
      reflectionSaved: 'This week had already closed. Your reflection is saved.',
      alreadySaved: "This week's review is already saved.",
    });
    expect(NOT_SAVED).toBe("That didn't save. Please try again.");
    expect(FIRST_WEEK_BACK_LINE).toBe('First week back: keep the effort easy today.');
    [NOT_SAVED, FIRST_WEEK_BACK_LINE].forEach(expectClean);
  });

  it('the feel tap after a done session: its question, its options, its lines and a failed save', async () => {
    const user = userEvent.setup();
    const done = { id: 't1', status: 'completed', feel: null } as unknown as DailyTask;
    const { unmount } = render(<FeelPicker task={done} onAddNote={() => {}} />);
    const group = screen.getByRole('group', { name: 'How did it feel?' });
    expect(within(group).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['Too easy', 'Just right', 'Too hard']);
    expect(screen.getByRole('status')).toHaveTextContent('Optional. Next week is planned from what you did and how it felt.');
    expectClean(group.textContent ?? '');
    expectClean(screen.getByRole('status').textContent ?? '');
    await user.click(within(group).getByRole('radio', { name: 'Too hard' }));
    expect(await screen.findByText(NOT_SAVED)).toBeInTheDocument();
    unmount();
    render(<FeelPicker task={{ ...done, feel: 'too_hard' } as DailyTask} onAddNote={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Thanks. Next week takes it into account.');
    expect(screen.getByRole('button', { name: 'Add a note' })).toBeInTheDocument();
    expectClean(screen.getByRole('status').textContent ?? '');
  });
});
