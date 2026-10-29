import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoutineSettings } from '../../types';
import { StepSummary } from './StepSummary';

const ROUTINE: RoutineSettings = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  busyHours: '09:00 - 17:00',
  preferredSlot: 'morning',
  dailyMinutes: 30,
  planVariant: 'accelerated',
  commitments: [],
};

const renderSummary = (props: Partial<React.ComponentProps<typeof StepSummary>> = {}) =>
  render(
    <StepSummary
      outcome="Run 5K without stopping"
      defaultOutcome="Run 5K without stopping"
      onOutcomeChange={vi.fn()}
      routine={ROUTINE}
      weeks={12}
      fixedDate=""
      signedIn
      onBack={vi.fn()}
      onStart={vi.fn()}
      {...props}
    />,
  );

describe('StepSummary', () => {
  it('shows where they are going and what the plan asks of them', () => {
    renderSummary();
    expect(screen.getByText('Run 5K without stopping')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your week' })).toHaveTextContent('6 days a week30 min a sessionIn the mornings');
    expect(screen.getByText(/72 sessions, each one small/)).toBeInTheDocument();
    expect(screen.queryByText(/create your account/)).not.toBeInTheDocument();
  });

  it('tells a visitor the account comes next, and starts on tap', async () => {
    const onStart = vi.fn();
    renderSummary({ signedIn: false, onStart, weeks: 8, fixedDate: '2099-03-01' });
    expect(screen.getByText(/Next, create your account/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /By March 1/ })).toBeInTheDocument();
    expect(screen.getByText(/48 sessions/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Start my journey/ }));
    expect(onStart).toHaveBeenCalled();
  });

  it('a goal cleared while editing falls back to the suggested one', async () => {
    const onOutcomeChange = vi.fn();
    renderSummary({ outcome: '  ', onOutcomeChange });
    await userEvent.click(screen.getByRole('button', { name: 'Edit your goal' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onOutcomeChange).toHaveBeenCalledWith('Run 5K without stopping');
  });
});
