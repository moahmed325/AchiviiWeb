import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { useGoal } from '../context/GoalContext';
import { todayKey } from '../lib/today';
import type { DailyTask, Goal, MissedSignals, Reconciliation } from '../types';

vi.mock('../context/GoalContext', () => ({ useGoal: vi.fn() }));
vi.mock('../hooks/useJourneyData', () => ({ useJourneyData: () => null }));

const DAY_MS = 24 * 60 * 60 * 1000;

const step = (n: number, title: string, minutes: number) => ({
  stepNumber: n, title, durationMinutes: minutes, instructions: '', focusCue: '', pitfallToAvoid: '',
});

const makeTask = (overrides: Partial<DailyTask>): DailyTask => ({
  id: 't', goalId: 'g', weekNumber: 4, dayNumber: 1, date: todayKey(new Date()), dayOfWeek: 'Monday', title: 'Task',
  detailedSteps: '[]', implementationIntention: '', durationMinutes: 30, isRestDay: false, status: 'pending',
  created_at: '2026-09-01T00:00:00.000Z', ...overrides,
});

const buildGoal = (todayStatus: 'pending' | 'completed'): Goal => {
  const now = Date.now();
  const tasks: DailyTask[] = [
    makeTask({ id: 't1', dayNumber: 1, dayOfWeek: 'Monday', title: 'Easy base run', status: 'completed', date: todayKey(new Date(now - DAY_MS)) }),
    makeTask({
      id: 't2', dayNumber: 2, dayOfWeek: 'Tuesday', title: 'Tempo intervals', status: todayStatus, isKeySession: true, slotTime: '07:00',
      detailedSteps: JSON.stringify([step(1, 'Warm up jog', 10), step(2, 'Four tempo reps', 20), step(3, 'Cool down walk', 5), step(4, 'Log the session', 2)]),
      whyToday: 'Builds the pace you will race at.',
    }),
    makeTask({ id: 't3', dayNumber: 3, dayOfWeek: 'Wednesday', title: 'Long steady run', date: todayKey(new Date(now + DAY_MS)) }),
  ];
  return {
    id: 'g', userId: 'u', rawGoal: 'Run a 10K', clarifiedOutcome: 'Run 10 kilometers in under 50 minutes', methodologyNotes: '',
    status: 'active', startDate: '2026-09-01T00:00:00.000Z', targetDate: `${todayKey(new Date(now + 63 * DAY_MS))}T00:00:00.000Z`, currentWeek: 4,
    answers: '{}', routine: '{}', created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z',
    roadmapWeeks: [{ id: 'rw', goalId: 'g', weekNumber: 4, phase: 'Aerobic Foundation', theme: 'Building Volume', objective: 'x', keyMilestone: 'First 5km continuous run', targetIntensity: 65, plannedMinutes: 140, status: 'active', created_at: '2026-09-01' }],
    dailyTasks: tasks,
  } as unknown as Goal;
};

const renderWith = (goal: Goal, reconciliation: Reconciliation | null = null) => {
  vi.mocked(useGoal).mockReturnValue({ activeGoal: goal, loadingGoal: false, goalLoadFailed: false, refreshGoal: vi.fn(), reconciliation } as unknown as ReturnType<typeof useGoal>);
  return render(<MemoryRouter><Dashboard /></MemoryRouter>);
};

describe('Dashboard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ND-29: today first with one way in, the sessions done, the 90-day map and a status sentence from real state', () => {
    renderWith(buildGoal('pending'));

    expect(screen.getByText('1 of 3 sessions done this week. Keep the rhythm.')).toBeInTheDocument();
    // ND-18: the goal the person chose, never the stored outcome.
    expect(screen.getByText('Run a 10K')).toBeInTheDocument();
    expect(screen.queryByText('Run 10 kilometers in under 50 minutes')).not.toBeInTheDocument();

    expect(screen.getByText('1 session done, 30 min of practice.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 of 1 practice days done so far. Day 28 of 90.' })).toBeInTheDocument();
    expect(screen.getByText('62 days to go')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Tempo intervals' })).toBeInTheDocument();
    expect(screen.getByText('Key session')).toBeInTheDocument();
    expect(screen.getByText('30 min · 4 steps · at 07:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start session/i })).toHaveAttribute('href', '/');
    // ND-19: an overview; nothing here writes.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("B-50, B-52: steps from a done day are left out of today's card and the later day's title", () => {
    const goal = buildGoal('pending');
    const days = goal.dailyTasks!;
    const fromMonday = { taskId: 't1', date: days[0].date };
    const withPriority = (n: number, title: string, minutes: number, extra: Record<string, unknown> = {}) => ({ ...step(n, title, minutes), priority: n, ...extra });
    days[1] = {
      ...days[1],
      title: 'Hill repeats',
      whyToday: 'Hill repeats build strength.',
      detailedSteps: JSON.stringify([withPriority(1, 'Hill repeats', 12, { carriedFrom: { ...fromMonday, replaced: [] } }), withPriority(2, 'Warm up jog', 10), withPriority(3, 'Four tempo reps', 8)]),
    };
    days[2] = {
      ...days[2],
      title: 'Lesson 1',
      detailedSteps: JSON.stringify([withPriority(1, 'Lesson 1', 20, { shiftedFrom: fromMonday }), withPriority(2, 'Lesson review', 10)]),
    };
    // Monday was set aside (both steps moved on) and then done anyway: it still holds them (B-55).
    days[0] = { ...days[0], status: 'completed', detailedSteps: JSON.stringify([withPriority(1, 'Hill repeats', 12), withPriority(2, 'Lesson 1', 20)]) };
    renderWith(goal);

    expect(screen.getByRole('heading', { level: 2, name: 'Warm up jog' })).toBeInTheDocument();
    expect(screen.queryByText('Hill repeats build strength.')).not.toBeInTheDocument();
    expect(screen.getByText('18 min · 2 steps · at 07:00')).toBeInTheDocument();
  });

  it('B-55: a done day that no longer holds the step (it gave it up) hides nothing', () => {
    const goal = buildGoal('pending');
    const days = goal.dailyTasks!;
    const fromMonday = { taskId: 't1', date: days[0].date, replaced: [] };
    days[0] = { ...days[0], status: 'completed', detailedSteps: JSON.stringify([{ ...step(1, 'Review', 10), priority: 1 }]) };
    days[1] = {
      ...days[1],
      title: 'Hill repeats',
      detailedSteps: JSON.stringify([{ ...step(1, 'Hill repeats', 12), priority: 1, carriedFrom: fromMonday }, { ...step(2, 'Warm up jog', 10), priority: 2 }]),
    };
    renderWith(goal);
    expect(screen.getByRole('heading', { level: 2, name: 'Hill repeats' })).toBeInTheDocument();
    expect(screen.getByText(/2 steps/)).toBeInTheDocument();
  });

  it("a goal measured by milestones with no checks yet shows this week's milestone, without inventing a number", () => {
    renderWith(buildGoal('pending'));

    const panel = screen.getByRole('region', { name: "This week's milestone" });
    expect(within(panel).getByText('First 5km continuous run')).toBeInTheDocument();
    expect(screen.queryByText(/milestones reached/)).not.toBeInTheDocument();
  });

  it('a number goal shows the share of the gap closed, the line from the start, and a new best', () => {
    const goal = buildGoal('pending');
    goal.roadmap = { startingPoint: { value: 60, description: '' }, phases: [] } as unknown as Goal['roadmap'];
    const target = (value: number) => ({ kind: 'number' as const, metric: '10K time', value, unit: 'min', direction: 'lower_is_better' as const });
    goal.roadmapWeeks = [1, 2, 3, 12].map((weekNumber) => ({
      ...goal.roadmapWeeks![0],
      id: 'w' + weekNumber,
      weekNumber,
      target: target(weekNumber === 12 ? 50 : 58),
      test: { type: 'timer' as const, instructions: '', passIf: '' },
      testResult: weekNumber === 1 ? { value: 57, passed: true } : weekNumber === 2 ? { value: 55, passed: true } : null,
    }));
    renderWith(goal);

    const panel = screen.getByRole('region', { name: '10K time' });
    expect(within(panel).getByText('50%')).toBeInTheDocument();
    expect(within(panel).getByText('of the gap to your goal closed')).toBeInTheDocument();
    expect(within(panel).getByText('New best')).toBeInTheDocument();
  });

  it('celebrates a finished day, counts it, and leads back to Today without starting anything', () => {
    renderWith(buildGoal('completed'));

    expect(screen.getByRole('heading', { level: 2, name: 'Today is done.' })).toBeInTheDocument();
    expect(screen.getByText('Session 2 is in the books. Come back tomorrow.')).toBeInTheDocument();
    expect(screen.getByText('2 sessions done, 1 hour of practice.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /See today/i })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/min · /)).not.toBeInTheDocument();
  });

  describe('status line from the reconcile signals (missed sessions M3.1, ND-19)', () => {
    const key = (offset: number) => todayKey(new Date(Date.now() + offset * DAY_MS));
    const weekday = (offset: number) => new Date(`${key(offset)}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
    const body = (signals: Partial<MissedSignals>) => ({ applies: true, goalId: 'g', signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
    const carried = (from: number, to: number) => ({ fromDate: key(from), fromTaskId: 'x', toDate: key(to), toTaskId: 'y', stepTitle: 'Lead' });
    const UNCHANGED = '1 of 3 sessions done this week. Keep the rhythm.';
    const calm = () => {
      const text = document.body.textContent ?? '';
      for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
    };

    it('carried into today, from yesterday or an earlier weekday', () => {
      const { unmount } = renderWith(buildGoal('pending'), body({ notice: 'carried', carried: [carried(-1, 0)] }));
      expect(screen.getByText("Yesterday's most important step is part of today's session.")).toBeInTheDocument();
      calm();
      unmount();
      renderWith(buildGoal('pending'), body({ notice: 'carried', carried: [carried(-2, 0)] }));
      expect(screen.getByText(`${weekday(-2)}'s most important step is part of today's session.`)).toBeInTheDocument();
    });

    it('dropped, yesterday or an earlier weekday', () => {
      const { unmount } = renderWith(buildGoal('pending'), body({ notice: 'dropped', dropped: [{ date: key(-1), taskId: 't1', reason: 'high_load' }] }));
      expect(screen.getByText('Yesterday slipped past. No catching up needed, just today.')).toBeInTheDocument();
      calm();
      unmount();
      renderWith(buildGoal('pending'), body({ notice: 'dropped', dropped: [{ date: key(-2), taskId: 't0', reason: 'does_not_fit' }] }));
      expect(screen.getByText(`${weekday(-2)} slipped past. No catching up needed, just today.`)).toBeInTheDocument();
    });

    it('a step carried to a later day, other notices, and no reconcile leave the line unchanged', () => {
      const cases: Array<Reconciliation | null> = [
        body({ notice: 'carried', carried: [carried(-1, 1)] }),
        body({ notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: key(-4), lastDate: key(-1) } }),
        body({ notice: 'swap_offer', swapOffer: { missedTaskId: 't1', missedDate: key(-1), receivingTaskId: 't2', receivingDate: key(0), offerUntil: '' } }),
        body({ notice: null }),
        null,
      ];
      for (const reconciliation of cases) {
        const { unmount } = renderWith(buildGoal('pending'), reconciliation);
        expect(screen.getByText(UNCHANGED)).toBeInTheDocument();
        unmount();
      }
    });

    it('yesterday left pending no longer drives a line by itself', () => {
      const goal = buildGoal('pending');
      goal.dailyTasks = goal.dailyTasks!.map((t) => (t.id === 't1' ? { ...t, status: 'pending' as const } : t));
      renderWith(goal, null);
      expect(screen.queryByText(/slipped past/)).not.toBeInTheDocument();
      expect(screen.getByText('A fresh week. One session at a time.')).toBeInTheDocument();
    });

    it('keeps the old priority: a finished day and a rest day speak first', () => {
      const dropped = body({ notice: 'dropped', dropped: [{ date: key(-1), taskId: 't1', reason: 'high_load' }] });
      const { unmount } = renderWith(buildGoal('completed'), dropped);
      expect(screen.getByText('1 session left this week. Rest well tonight.')).toBeInTheDocument();
      expect(screen.queryByText(/slipped past/)).not.toBeInTheDocument();
      unmount();
      const rest = buildGoal('pending');
      rest.dailyTasks = rest.dailyTasks!.map((t) => (t.id === 't2' ? { ...t, isRestDay: true } : t));
      renderWith(rest, dropped);
      expect(screen.getByText('A rest day is part of the plan. Let the work settle in.')).toBeInTheDocument();
      expect(screen.queryByText(/slipped past/)).not.toBeInTheDocument();
    });
  });
});

describe('Dashboard: gentle-return line (missed sessions M3.2, ND-19)', () => {
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
  const body = (signals: Partial<MissedSignals>) => ({ applies: true, goalId: 'g', signals: { ...NONE, ...signals } }) as unknown as Reconciliation;
  const key = (offset: number) => todayKey(new Date(Date.now() + offset * DAY_MS));
  const GENTLE: Partial<MissedSignals> = { notice: 'gentle_return', gentleReturn: { gapLength: 3, firstDate: key(-4), lastDate: key(-1) } };
  const MINIMUM = { stepNumber: 1, title: 'Ten minutes', durationMinutes: 10, instructions: '', focusCue: '', pitfallToAvoid: '' };
  const withMinimum = (status: 'pending' | 'completed' = 'pending') => {
    const goal = buildGoal(status);
    goal.dailyTasks = goal.dailyTasks!.map((t) => (t.id === 't2' ? { ...t, minimumVersion: MINIMUM } : t));
    return goal;
  };
  const WELCOME = "Welcome back. Today's a short one to ease in.";

  beforeEach(() => vi.clearAllMocks());

  it('says the welcome line on a gentle-return day, and nothing about being short on time', () => {
    renderWith(withMinimum(), body({ ...GENTLE, shortOnTime: true }));
    expect(screen.getByText(WELCOME)).toBeInTheDocument();
    expect(screen.queryByText(/still counts toward this week/)).not.toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
  });

  it("shows the 10-minute version's minutes, not the full session's (B-1)", () => {
    renderWith(withMinimum(), body(GENTLE));
    expect(screen.getByText(/10 min, short version/)).toBeInTheDocument();
  });

  it('has no short-on-time line', () => {
    renderWith(withMinimum(), body({ shortOnTime: true }));
    expect(screen.queryByText(/10-minute version/)).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3 sessions done this week. Keep the rhythm.')).toBeInTheDocument();
  });

  it('keeps the old priority: a finished day speaks first', () => {
    renderWith(withMinimum('completed'), body(GENTLE));
    expect(screen.queryByText(WELCOME)).not.toBeInTheDocument();
  });
});

describe('Dashboard: swap offer and a day set aside (missed sessions M3.3, ND-19)', () => {
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null };
  const CARRY = { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] };
  const body = (signals: Partial<MissedSignals>, extra: Record<string, unknown> = {}) =>
    ({ applies: true, goalId: 'g', days: [], carry: CARRY, signals: { ...NONE, ...signals }, ...extra }) as unknown as Reconciliation;
  const key = (offset: number) => todayKey(new Date(Date.now() + offset * DAY_MS));
  const weekday = (offset: number) =>
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${key(offset)}T00:00:00Z`).getUTCDay()];
  const offer = (missedTaskId: string, missedOffset: number, receivingTaskId: string, receivingOffset: number) => ({
    notice: 'swap_offer' as const,
    swapOffer: { missedTaskId, missedDate: key(missedOffset), receivingTaskId, receivingDate: key(receivingOffset), offerUntil: '' },
  });
  const SET_ASIDE = "Today's session is set aside. No catching up needed.";
  const calm = () => {
    const text = document.body.textContent ?? '';
    for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i]) expect(text).not.toMatch(word);
  };

  beforeEach(() => vi.clearAllMocks());

  it('says the swap-offer line, with no buttons; "Start session" leads to Today', () => {
    renderWith(buildGoal('pending'), body(offer('t1', -1, 't2', 0)));
    expect(screen.getByText("Yesterday's key session didn't happen. Do it today instead?")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Swap the days' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Just move its main step' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Start session/i })).toHaveAttribute('href', '/');
    calm();
  });

  it('says the set-aside form of the offer when today is the held day', () => {
    renderWith(buildGoal('pending'), body(offer('t2', 0, 't3', 1)));
    expect(screen.getByText(`Today's key session is set aside. Do it ${weekday(1)} instead?`)).toBeInTheDocument();
  });

  it('after setting today aside, carried or dropped, says the one decided line', () => {
    const carried = body({ notice: 'carried', carried: [{ fromDate: key(0), fromTaskId: 't2', toDate: key(1), toTaskId: 't3', stepTitle: 'Lead' }] });
    const { unmount } = renderWith(buildGoal('pending'), carried);
    expect(screen.getByText(SET_ASIDE)).toBeInTheDocument();
    calm();
    unmount();
    const dropped = body({}, {
      days: [{ taskId: 't2', date: key(0), weekNumber: 4, dayNumber: 2, isKeySession: true, isTestDay: false, kind: 'missed' }],
      carry: { ...CARRY, drops: [{ taskId: 't2', date: key(0), reason: 'high_load' }] },
    });
    renderWith(buildGoal('pending'), dropped);
    expect(screen.getByText(SET_ASIDE)).toBeInTheDocument();
  });

  it('with the switch off, neither line', () => {
    renderWith(buildGoal('pending'), body(offer('t1', -1, 't2', 0), { carry: { ...CARRY, enabled: false } }));
    expect(screen.queryByText(/key session/)).not.toBeInTheDocument();
    expect(screen.getByText('1 of 3 sessions done this week. Keep the rhythm.')).toBeInTheDocument();
  });
});

describe('Dashboard: method-aware recovery lines (M3.3, section 6, AC-7)', () => {
  const NONE: MissedSignals = { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null, line: null };
  const CARRY = { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [], outcomes: [], choices: { today: null, held: [] } };
  const key = (offset: number) => todayKey(new Date(Date.now() + offset * DAY_MS));
  const weekday = (offset: number) => new Date(`${key(offset)}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const body = (kind: string, from: number, to: number | null) =>
    ({
      applies: true,
      goalId: 'g',
      days: [],
      carry: CARRY,
      signals: {
        ...NONE,
        notice: 'method',
        line: { kind, taskId: 'x', date: key(from), toTaskId: to === null ? null : 'y', toDate: to === null ? null : key(to) },
      },
    }) as unknown as Reconciliation;

  // [kind, receiving day (0 = today) or null, the line for {Day}]
  const LINES: Array<[string, number | null, (day: string) => string]> = [
    ['moved', 1, (day) => `${day}'s most important step moved to ${weekday(1)}.`],
    ['moved', 0, (day) => `${day}'s most important step is part of today's session.`],
    ['moved_in_order', 1, (day) => `${day}'s most important step moved to ${weekday(1)}.`],
    ['moved_in_order', 0, (day) => `${day}'s most important step is part of today's session.`],
    ['continued', 1, (day) => `${day}'s work picks up again on ${weekday(1)}.`],
    ['continued', 0, (day) => `${day}'s work picks up again today.`],
    // B-38, B-39.
    ['restarted', 1, () => `The process starts again on ${weekday(1)}, from its first step.`],
    ['restarted', 0, () => 'The process starts again today, from its first step.'],
    ['due_passed', null, (day) => `${day}'s deadline has passed, so nothing moves.`],
    ['let_go', null, (day) => `${day} slipped past. No catching up needed, just today.`],
    ['fixed', null, (day) => `${day} slipped past. No catching up needed, just today.`],
    ['no_room', null, (day) => `${day} slipped past. Next week's plan takes it into account.`],
    ['next_week', null, (day) => `${day} slipped past. Next week starts with it.`],
    ['left_out', null, (day) => `${day} slipped past. This was the plan's last week.`],
  ];

  it.each(LINES)('%s (to %s): yesterday and an earlier weekday', (kind, to, words) => {
    const { unmount } = renderWith(buildGoal('pending'), body(kind, -1, to));
    expect(screen.getByText(words('Yesterday'))).toBeInTheDocument();
    unmount();
    renderWith(buildGoal('pending'), body(kind, -2, to));
    expect(screen.getByText(words(weekday(-2)))).toBeInTheDocument();
    const text = document.body.textContent ?? '';
    for (const word of [/missed/i, /failed/i, /behind/i, /\bwhy\b/i, /skipped/i]) expect(text).not.toMatch(word);
  });

  it.each(LINES.filter(([, to]) => to !== 0))('%s (to %s): set aside today', (kind, to) => {
    renderWith(buildGoal('pending'), body(kind, 0, to));
    expect(screen.getByText("Today's session is set aside. No catching up needed.")).toBeInTheDocument();
  });
});

describe('Dashboard: the count since the last visit (ND-29)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('names what was added since the last visit, and remembers the count for next time', () => {
    localStorage.setItem('achivii:dashboard-seen:g', '0');
    renderWith(buildGoal('completed'));
    expect(screen.getByText('2 more since your last visit.')).toBeInTheDocument();
    expect(localStorage.getItem('achivii:dashboard-seen:g')).toBe('2');
  });

  it('a first visit, or nothing new, names nothing', () => {
    const { unmount } = renderWith(buildGoal('pending'));
    expect(screen.queryByText(/since your last visit/)).not.toBeInTheDocument();
    unmount();
    renderWith(buildGoal('pending'));
    expect(screen.queryByText(/since your last visit/)).not.toBeInTheDocument();
  });
});
