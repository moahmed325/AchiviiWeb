import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { Checkpoint, DailyTask, Goal, RoadmapWeek } from '../../types';
import { Today } from './Today';
import { todayKey } from '../../lib/today';
import { addDaysToDateKey } from '../../lib/dateUtils';
import { CHECKPOINT_NOT_SAVED, acceptedLine, checkpointCopy } from '../../lib/checkpoint';
import { dayNinetyLineText, week12NoteText } from '../../lib/week12Line';

// Checkpoints M2 (RULE-7, RULE-8, RULE-11, section 6, AC-5, AC-9, AC-11): the Today card, its answers and the day-90 line.

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    closeWeek: vi.fn(async () => ({ due: false as const })),
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn(),
    answerCheckpoint: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const isoDay = (offset: number) => addDaysToDateKey(todayKey(new Date()), offset);
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const LOWER: Checkpoint = { week: 4, kind: 'lower', target: '10 km', offered: '6 km', goal: '10 km', last: false, toFullGoal: false };

const tasks = (): DailyTask[] =>
  DAYS.map((dayOfWeek, index) => ({
    id: `t${index + 1}`,
    goalId: 'g1',
    weekNumber: 5,
    dayNumber: 28 + index + 1,
    date: isoDay(index - 2),
    dayOfWeek,
    title: `Session ${index + 1}`,
    detailedSteps: JSON.stringify([{ title: 'Easy run', instructions: 'Run easy.', durationMinutes: 30, priority: 1 }]),
    implementationIntention: '',
    durationMinutes: 30,
    isRestDay: index === 6,
    isTestDay: index === 5,
    status: 'pending',
    created_at: '',
  }) as DailyTask);

const week = (weekNumber: number, status: string) =>
  ({
    id: `w${weekNumber}`,
    goalId: 'g1',
    weekNumber,
    phase: 'Base',
    theme: 'Easy miles',
    status,
    target: { kind: 'number', metric: 'Weekly running distance', value: weekNumber, unit: 'km', direction: 'higher_is_better' },
    test: { type: 'distance', instructions: 'Run the weekly distance.', passIf: `${weekNumber} km` },
    testResult: null,
  }) as unknown as RoadmapWeek;

const goal = (extra: Partial<Goal> = {}): Goal =>
  ({
    id: 'g1',
    planVersion: 2,
    rawGoal: 'Run 10 km a week',
    clarifiedOutcome: '',
    status: 'active',
    currentWeek: 5,
    targetDate: `${isoDay(50)}T00:00:00.000Z`,
    roadmapWeeks: [week(4, 'completed'), week(5, 'active')],
    dailyTasks: tasks(),
    retest: null,
    dailyTimeCheck: null,
    checkpoint: LOWER,
    dayNinetyLine: null,
    ...extra,
  }) as unknown as Goal;

const Harness = () => {
  const { activeGoal } = useGoal();
  return activeGoal ? <Today goal={activeGoal} /> : null;
};

const renderToday = async () => {
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter>
          <Harness />
        </MemoryRouter>
      </GoalProvider>
    </AuthProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
};

const card = () => screen.queryByRole('region', { name: /check on your pace|You've caught up/ });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(goal());
  mocked.reconcileGoal.mockResolvedValue({ applies: false, reason: 'no_active_goal' });
  mocked.answerCheckpoint.mockResolvedValue({ week: 4, answer: 'keep' });
});

describe('the copy table (section 6, AC-11)', () => {
  it('every card, word for word', () => {
    expect(checkpointCopy(LOWER)).toEqual({
      title: 'A check on your pace',
      body: "At this pace you'll reach about 6 km by day 90. Your day-90 target is 10 km.",
      accept: 'Aim for 6 km',
      keep: 'Keep my goal',
    });
    expect(checkpointCopy({ ...LOWER, week: 8, last: true }).title).toBe('Last check on your pace');
    expect(checkpointCopy({ ...LOWER, kind: 'line_only', offered: null })).toEqual({
      title: 'A check on your pace',
      body: "Your result hasn't improved yet. Your day-90 target stays at 10 km, and the next weeks build toward it.",
      accept: null,
      keep: 'Got it',
    });
    expect(checkpointCopy({ ...LOWER, week: 8, kind: 'raise', target: '6 km', offered: '10 km', last: true, toFullGoal: true })).toEqual({
      title: "You've caught up",
      body: "At this pace you'll reach 10 km by day 90.",
      accept: 'Aim for 10 km',
      keep: 'Keep 6 km',
    });
    expect(checkpointCopy({ ...LOWER, week: 8, kind: 'raise', target: '6 km', offered: '8.5 km', last: true }).body).toBe(
      "At this pace you'll reach about 8.5 km by day 90. Your day-90 target is 6 km."
    );
    expect(acceptedLine(LOWER)).toBe('Your day-90 target is now 6 km.');
    expect(acceptedLine({ ...LOWER, kind: 'raise', target: '6 km', offered: '8.5 km' })).toBe('Your day-90 target is now 8.5 km.');
    expect(acceptedLine({ ...LOWER, kind: 'raise', target: '6 km', offered: '10 km', toFullGoal: true })).toBe('Your day-90 target is back to 10 km.');
    expect(dayNinetyLineText({ target: '6 km', goal: '10 km' })).toBe('Day-90 target: 6 km. Your goal: 10 km.');
    expect(CHECKPOINT_NOT_SAVED).toBe("Couldn't save your choice. Please try again.");
  });

  it('no forbidden word and no question in any line', () => {
    const cards = [LOWER, { ...LOWER, last: true }, { ...LOWER, kind: 'line_only' as const, offered: null }, { ...LOWER, kind: 'raise' as const, toFullGoal: true }, { ...LOWER, kind: 'raise' as const }];
    const lines = cards.flatMap((item) => [...Object.values(checkpointCopy(item)).filter((line): line is string => Boolean(line)), acceptedLine(item)]);
    for (const line of [...lines, dayNinetyLineText({ target: '6 km', goal: '10 km' }), CHECKPOINT_NOT_SAVED]) {
      expect(line, line).not.toMatch(/\b(behind|failed|fail|off track|missed|fall short)\b/i);
      expect(line, line).not.toContain('?');
    }
  });
});

describe('the Today card (RULE-7, RULE-8, AC-5)', () => {
  it('shows the offer with its words, before the daily-time card', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({ dailyTimeCheck: { minutes: 45, shorter: [30] } }));
    await renderToday();
    const region = card()!;
    expect(within(region).getByRole('heading', { name: 'A check on your pace' })).toBeVisible();
    expect(within(region).getByText("At this pace you'll reach about 6 km by day 90. Your day-90 target is 10 km.")).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Aim for 6 km' })).toBeVisible();
    expect(within(region).getByRole('button', { name: 'Keep my goal' })).toBeVisible();
    const daily = screen.getByRole('heading', { name: 'Does 45 minutes a day still work?' });
    expect(region.compareDocumentPosition(daily) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is not shown without an open offer', async () => {
    mocked.fetchActiveGoal.mockResolvedValue(goal({ checkpoint: null }));
    await renderToday();
    expect(card()).toBeNull();
  });

  it('accept posts accept, says so, and refreshes the goal', async () => {
    const user = userEvent.setup();
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal({ checkpoint: null, dayNinetyLine: { target: '6 km', goal: '10 km' } }));
    const loads = mocked.fetchActiveGoal.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Aim for 6 km' }));
    expect(mocked.answerCheckpoint).toHaveBeenCalledWith(4, 'accept', 't');
    expect(await screen.findByText('Your day-90 target is now 6 km.')).toHaveAttribute('role', 'status');
    await waitFor(() => expect(mocked.fetchActiveGoal.mock.calls.length).toBeGreaterThan(loads));
    expect(card()).toBeNull();
  });

  it.each([
    ['Keep my goal', LOWER],
    ['Dismiss', LOWER],
    ['Got it', { ...LOWER, kind: 'line_only' as const, offered: null }],
  ])('%s posts keep and the card goes, with no line', async (name, checkpoint) => {
    const user = userEvent.setup();
    mocked.fetchActiveGoal.mockResolvedValue(goal({ checkpoint }));
    await renderToday();
    mocked.fetchActiveGoal.mockResolvedValue(goal({ checkpoint: null }));
    await user.click(screen.getByRole('button', { name }));
    expect(mocked.answerCheckpoint).toHaveBeenCalledWith(4, 'keep', 't');
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.queryByText(/Your day-90 target is/)).toBeNull();
  });

  it('a 409 refreshes the goal so the card goes', async () => {
    const user = userEvent.setup();
    await renderToday();
    mocked.answerCheckpoint.mockRejectedValue(new api.ApiError('There is no checkpoint to answer.', 409, 'no_checkpoint'));
    mocked.fetchActiveGoal.mockResolvedValue(goal({ checkpoint: null }));
    await user.click(screen.getByRole('button', { name: 'Aim for 6 km' }));
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.queryByText(CHECKPOINT_NOT_SAVED)).toBeNull();
  });

  it('any other failure says so and keeps the card', async () => {
    const user = userEvent.setup();
    await renderToday();
    mocked.answerCheckpoint.mockRejectedValue(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Keep my goal' }));
    expect(await screen.findByText(CHECKPOINT_NOT_SAVED)).toHaveAttribute('role', 'alert');
    expect(within(card()!).getByText(CHECKPOINT_NOT_SAVED)).toBeVisible();
  });
});

describe('the day-90 line (RULE-11, AC-9)', () => {
  it('replaces the honest week 12 line wherever that line shows', () => {
    expect(week12NoteText({ week12Line: { safe: '9 km', goal: '10 km' }, dayNinetyLine: { target: '7 km', goal: '10 km' } })).toBe('Day-90 target: 7 km. Your goal: 10 km.');
    expect(week12NoteText({ week12Line: { safe: '9 km', goal: '10 km' }, dayNinetyLine: null })).toBe('Week 12 aims at 9 km, a safe step. Your 10 km goal is the next step.');
    expect(week12NoteText({ week12Line: null, dayNinetyLine: null })).toBeNull();
  });
});
