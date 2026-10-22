import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal, WeekTarget } from '../../types';
import { BreakChoice, CLOSE_FAILED, GETTING_READY, WeekTestFirst } from './WeekClose';
import { DailyTimeCard } from './Retest';
import { WEEK_CLOSED_LINES } from '../../lib/weekClose';
import { RETEST_LINES } from '../../lib/retest';
import { week12LineText } from '../../lib/week12Line';
import { nextCheckLine } from '../../lib/lightTest';

// Weekly update M4.1a (requirement 2, RULE-7, section 6): every line the feature shows in the app is free of the
// forbidden words and asks nothing, except the two questions the copy table holds.

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 't' }) }));
vi.mock('../../context/GoalContext', () => ({
  useGoal: () => ({ answerChoice: vi.fn(), answerHeldClose: vi.fn(), refreshGoal: vi.fn(async () => undefined) }),
}));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  answerDailyTime: vi.fn(async () => ({ dailyMinutes: 30 })),
}));

const FORBIDDEN = /\b(missed|behind|failed|fail)\b/i;
/** The copy table's own questions (section 6: "Test not logged before the close", "Daily-time check"). */
const TABLE_QUESTIONS = [/^Did you do last week's test\?$/, /^Does \d+ minutes a day still work\?$/];

function expectClean(line: string) {
  expect(line, line).not.toMatch(FORBIDDEN);
  const sentences = line.match(/[^.?!…]+[.?!…]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  for (const sentence of sentences) {
    if (sentence.includes('?')) expect(TABLE_QUESTIONS.some((q) => q.test(sentence)), sentence).toBe(true);
  }
}

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' }) as WeekTarget;
const goal = {
  id: 'g1',
  rawGoal: 'Run 10 km',
  roadmapWeeks: [{ weekNumber: 3, target: km(12), test: { type: 'time_trial', instructions: 'Run 3 km', passRule: 'Under 20 minutes' } }],
} as unknown as Goal;

describe('the app lines pass the copy check (M4.1a requirement 2)', () => {
  it('the check itself refuses a forbidden word and any other question', () => {
    expect(() => expectClean('You fell behind this week.')).toThrow();
    expect(() => expectClean('Ready for next week?')).toThrow();
    expect(() => expectClean("Did you do last week's test? Log your result.")).not.toThrow();
  });

  it('fixed lines and lines built from data', () => {
    const lines = [
      GETTING_READY,
      CLOSE_FAILED,
      ...Object.values(RETEST_LINES),
      ...Object.values(WEEK_CLOSED_LINES),
      week12LineText({ safe: '22 km', goal: '24 km' })!,
      week12LineText({ safe: '22 km', goal: null })!,
      nextCheckLine(5, km(14)),
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

  it('the test card before a close', () => {
    render(<WeekTestFirst goal={goal} weekNumber={3} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText("Did you do last week's test?")).toBeInTheDocument();
    expectClean(within(dialog).getByText("Did you do last week's test?").textContent ?? '');
    expectClean(within(dialog).getByText('Log your result to shape next week.').textContent ?? '');
    for (const button of within(dialog).getAllByRole('button')) expectClean(button.textContent || button.getAttribute('aria-label') || '');
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
