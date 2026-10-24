import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Goal, JourneyResult } from '../../types';
import { AchievementHero } from './AchievementHero';
import { computeAchievementSummary } from '../../lib/achievement';

// Next plan (NP-1, NP-2, NP-5 to NP-7, NP-10): the day-90 screen's line, its outcome and its choices.

const pro = vi.hoisted(() => ({ value: false }));
vi.mock('../../hooks/useProEntitlement', () => ({ useProEntitlement: () => pro.value }));

const result = (over: Partial<JourneyResult> = {}): JourneyResult => ({
  kind: 'number',
  start: '3 km',
  startValue: 3,
  reached: '8 km',
  reachedValue: 8,
  reachedWeek: 12,
  goal: '10 km',
  goalValue: 10,
  unit: 'km',
  direction: 'higher_is_better',
  dayNinetyTarget: null,
  reachedDayNinety: false,
  madeIt: false,
  nearGoal: false,
  weeksFinished: 12,
  lastDone: null,
  ...over,
});

const goalWith = (journeyResult: JourneyResult | null, rawGoal = 'Run 10 km without stopping') =>
  ({
    id: 'g1',
    rawGoal,
    clarifiedOutcome: rawGoal,
    status: 'completed',
    roadmap: { answers: [] },
    roadmapWeeks: [],
    dailyTasks: [],
    journeyResult,
  }) as unknown as Goal;

const Probe = () => {
  const location = useLocation();
  return <pre data-testid="route">{JSON.stringify({ pathname: location.pathname, state: location.state })}</pre>;
};
const seenRoute = () => JSON.parse(screen.getByTestId('route').textContent ?? 'null');

const renderHero = (goal: Goal) =>
  render(
    <MemoryRouter initialEntries={['/achievement']}>
      <Routes>
        <Route
          path="/achievement"
          element={<AchievementHero goal={goal} summary={computeAchievementSummary(goal)} onViewResults={() => {}} onBeginAnotherJourney={() => {}} />}
        />
        <Route path="/onboarding" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  pro.value = false;
  localStorage.clear();
});

describe('day-90 screen', () => {
  it('leads with what they reached and the full goal, never "You made it" when short (NP-1, NP-2)', () => {
    renderHero(goalWith(result()));
    expect(screen.getByText('You went from 3 km to 8 km.')).toBeInTheDocument();
    expect(screen.getByText("Your goal: 10 km. That's your next plan.")).toBeInTheDocument();
    expect(screen.queryByText('You made it.')).not.toBeInTheDocument();
  });

  it('a checkpoint-lowered week 12 reached: the day-90 target, then the goal (NP-2)', () => {
    renderHero(goalWith(result({ reached: '7.5 km', dayNinetyTarget: '7.5 km', reachedDayNinety: true })));
    expect(screen.getByText("You reached your day-90 target: 7.5 km. Your goal: 10 km. That's your next plan.")).toBeInTheDocument();
  });

  it('free: no next plan and no Pro line, the same whether they made it or not (NP-7)', () => {
    for (const r of [result(), result({ madeIt: true })]) {
      const { unmount } = renderHero(goalWith(r));
      expect(screen.queryByRole('button', { name: /Keep going|Go further/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Pro/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose another pathway' })).toBeInTheDocument();
      unmount();
    }
  });

  it('free on a pathway: restart it from the start', () => {
    renderHero(goalWith(result(), 'Run a 10K Under 50 Minutes'));
    expect(screen.getByRole('button', { name: /again from the start/ })).toBeInTheDocument();
  });

  it('Pro, fell short: keep going first; within a safe step, go further first (NP-5, NP-6)', () => {
    pro.value = true;
    const { unmount } = renderHero(goalWith(result()));
    let buttons = screen.getAllByRole('button', { name: /Keep going|Go further/ }).map((b) => b.textContent);
    expect(buttons).toEqual(['Keep going to 10 km', 'Go further']);
    unmount();
    renderHero(goalWith(result({ nearGoal: true })));
    buttons = screen.getAllByRole('button', { name: /Keep going|Go further/ }).map((b) => b.textContent);
    expect(buttons).toEqual(['Go further', 'Keep going to 10 km']);
  });

  it('Pro, made it: go further only', () => {
    pro.value = true;
    renderHero(goalWith(result({ madeIt: true })));
    expect(screen.getByText('You reached your goal: 10 km.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Keep going|Go further/ }).map((b) => b.textContent)).toEqual(['Go further']);
  });

  it('keep going opens goal creation with the goal text and the next plan (NP-3)', async () => {
    pro.value = true;
    renderHero(goalWith(result()));
    await userEvent.click(screen.getByRole('button', { name: 'Keep going to 10 km' }));
    expect(seenRoute().pathname).toBe('/onboarding');
    expect(seenRoute().state).toMatchObject({
      switchGoal: true,
      draftGoal: 'Run 10 km without stopping',
      nextPlan: { request: { fromGoalId: 'g1', mode: 'keep_going' }, startsFrom: '8 km' },
    });
  });

  it('nothing measured: asks the level first, then sends it (NP-10)', async () => {
    pro.value = true;
    renderHero(goalWith(result({ reached: null, reachedValue: null, reachedWeek: null })));
    await userEvent.click(screen.getByRole('button', { name: 'Keep going to 10 km' }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('Where are you now?');
    await userEvent.type(input, '6.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(seenRoute().state).toMatchObject({ nextPlan: { request: { mode: 'keep_going', level: 6.5 }, startsFrom: '6.5 km' } });
  });
});
