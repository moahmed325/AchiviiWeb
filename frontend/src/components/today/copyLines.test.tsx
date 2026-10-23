import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal, RoadmapWeek, WeekTarget } from '../../types';
import { BreakChoice, CLOSE_FAILED, GETTING_READY, WeekTestFirst } from './WeekClose';
import { DailyTimeCard } from './Retest';
import { TestResultDialog } from './TestResultDialog';
import { WEEK_CLOSED_LINES } from '../../lib/weekClose';
import { RETEST_LINES } from '../../lib/retest';
import { week12LineText } from '../../lib/week12Line';
import { nextCheckLine } from '../../lib/lightTest';
import { FIRST_WEEK_BACK_LINE } from '../../lib/stepLines';

// Weekly update M4.1a (requirement 2, RULE-7, section 6): every line the feature shows in the app is free of the
// forbidden words and asks nothing, except the two questions the copy table holds.

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 't' }) }));
vi.mock('../../context/GoalContext', () => ({
  useGoal: () => ({ answerChoice: vi.fn(), answerHeldClose: vi.fn(), refreshGoal: vi.fn(async () => undefined) }),
}));
vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  answerDailyTime: vi.fn(async () => ({ dailyMinutes: 30 })),
  logWeeklyTestResult: vi.fn(async () => {
    throw new Error('offline');
  }),
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

describe("section 6's app lines and step texts, word for word (M4.1b requirement 6, WU-62 (4))", () => {
  const lightWeek = {
    weekNumber: 2,
    target: km(14),
    test: { type: 'other', instructions: "Log the week's long run as written", passRule: 'Done as written', light: true },
  } as unknown as RoadmapWeek;

  it('the fixed lines', () => {
    expect(GETTING_READY).toBe('Getting your next week ready…');
    expect(CLOSE_FAILED).toBe("Couldn't get your next week ready. Please try again.");
    expect(WEEK_CLOSED_LINES).toEqual({
      reflectionSaved: 'This week had already closed. Your reflection is saved.',
      alreadySaved: "This week's review is already saved.",
    });
    expect(FIRST_WEEK_BACK_LINE).toBe('First week back: keep the effort easy today.');
    expect(nextCheckLine(2, km(14))).toMatch(/^Next check, week 4: /);
    [FIRST_WEEK_BACK_LINE, nextCheckLine(2, km(14))].forEach(expectClean);
  });

  it('the test card\'s entry: "Log last week\'s test" with "Save result"', async () => {
    const user = userEvent.setup();
    render(<WeekTestFirst goal={goal} weekNumber={3} />);
    await user.click(screen.getByRole('button', { name: 'Log result' }));
    const entry = await screen.findByRole('dialog', { name: "Log last week's test" });
    expect(within(entry).getByRole('button', { name: 'Save result' })).toBeInTheDocument();
    for (const button of within(entry).getAllByRole('button')) expectClean(button.textContent || button.getAttribute('aria-label') || '');
  });

  it('the re-test entry: "Log re-test result", "I did it" on a light test, and the failed-save line', async () => {
    const user = userEvent.setup();
    render(<TestResultDialog week={lightWeek} open onOpenChange={() => {}} title="Log re-test result" />);
    const dialog = screen.getByRole('dialog', { name: 'Log re-test result' });
    expect(within(dialog).getByText(nextCheckLine(2, km(14)))).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'I did it' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent("That didn't save. Please try again.");
    expectClean(alert.textContent ?? '');
    for (const button of within(dialog).getAllByRole('button')) expectClean(button.textContent || button.getAttribute('aria-label') || '');
  });
});
