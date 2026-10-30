import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Goal, JourneyResult } from '../../types';
import { BreakChoice } from './WeekClose';

// Next plan (NP-9): "Start a fresh plan" after a long break starts from the level now with Pro (asked, the last result
// filled in), and is the goal's text only without Pro, as before (WU-9).

const pro = vi.hoisted(() => ({ value: false }));
vi.mock('../../hooks/useProEntitlement', () => ({ useProEntitlement: () => pro.value }));
vi.mock('../../context/GoalContext', () => ({ useGoal: () => ({ answerChoice: vi.fn() }) }));

const journeyResult: JourneyResult = {
  kind: 'number',
  start: '3 km',
  startValue: 3,
  goal: 'Run 10 km',
  unit: 'km',
  direction: 'higher_is_better',
  weeksFinished: 7,
  sessionsDone: 30,
  sessionsPlanned: 35,
};

const goal = { id: 'g1', rawGoal: 'Run 10 km', status: 'active', roadmap: { answers: [] }, journeyResult } as unknown as Goal;

const Probe = () => <pre data-testid="state">{JSON.stringify(useLocation().state)}</pre>;
const seenState = () => JSON.parse(screen.getByTestId('state').textContent ?? 'null');

const renderCard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BreakChoice goal={goal} choice="keep_going" />} />
        <Route path="/onboarding" element={<Probe />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  pro.value = false;
});

describe('Start a fresh plan', () => {
  it('without Pro: the goal text only, as before', async () => {
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Start a fresh plan' }));
    expect(seenState()).toEqual({ draftGoal: 'Run 10 km', isPreset: false, switchGoal: true });
  });

  it('with Pro: asks the level now, then starts from it', async () => {
    pro.value = true;
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Start a fresh plan' }));
    const dialog = screen.getByRole('dialog');
    const input = within(dialog).getByLabelText('You started this plan at 3 km. Where are you now?');
    expect(input).toHaveValue('');
    await userEvent.clear(input);
    await userEvent.type(input, '5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(seenState()).toMatchObject({ draftGoal: 'Run 10 km', nextPlan: { request: { fromGoalId: 'g1', mode: 'fresh', level: 5 }, startsFrom: '5 km' } });
  });

  it('refuses an empty level', async () => {
    pro.value = true;
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Start a fresh plan' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByRole('textbox'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByText('Enter a number.')).toBeInTheDocument();
    expect(screen.queryByTestId('state')).toBeNull();
  });
});
