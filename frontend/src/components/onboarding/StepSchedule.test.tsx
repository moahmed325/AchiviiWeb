import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoutineSettings } from '../../types';
import { addDaysToDateKey } from '../../lib/dateUtils';
import { FIXED_DATE_FITS, FIXED_DATE_HINT, FIXED_DATE_INVALID, FIXED_DATE_TOO_CLOSE, checkFixedDate } from '../../lib/fixedDate';
import { todayKey } from '../../lib/today';
import { StepSchedule } from './StepSchedule';

// B-106: the optional fixed date on the schedule step.
const ROUTINE: RoutineSettings = { wakeTime: '07:00', sleepTime: '23:00', busyHours: '09:00 - 17:00', preferredSlot: 'evening', dailyMinutes: 60, planVariant: 'steady', commitments: [] };

function Harness({ onContinue }: { onContinue: () => void }) {
  const [fixedDate, setFixedDate] = useState('');
  const [routine, setRoutine] = useState<RoutineSettings>(ROUTINE);
  const today = todayKey(new Date());
  return (
    <StepSchedule
      rawGoal="Pass the IELTS"
      routine={routine}
      onRoutineChange={setRoutine}
      onChooseSlot={() => {}}
      timeline={null}
      commitments={null}
      scheduleChosen
      fixedDate={fixedDate}
      fixedDateCheck={checkFixedDate(fixedDate, today)}
      today={today}
      onFixedDateChange={setFixedDate}
      isWaitingForClarification={false}
      clarificationError={null}
      isClarifying={false}
      onRetryClarification={() => {}}
      onChangeGoal={() => {}}
      onBack={() => {}}
      onContinue={onContinue}
    />
  );
}

const field = () => screen.getByLabelText(/Is there a fixed date this has to be ready by\?/);

describe('StepSchedule: fixed date (B-106)', () => {
  it('is optional: empty shows the hint and Continue works', async () => {
    const onContinue = vi.fn();
    render(<Harness onContinue={onContinue} />);
    expect(field()).toHaveValue('');
    expect(screen.getByText(FIXED_DATE_HINT)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('B-109: a date under 12 weeks away names the shorter plan; a later one says the plan ends by it', async () => {
    render(<Harness onContinue={() => {}} />);
    const today = todayKey(new Date());
    await userEvent.type(field(), addDaysToDateKey(today, 45));
    expect(screen.getByText('Your plan will be 6 weeks, with the final test in week 5, the week before your date.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    await userEvent.clear(field());
    await userEvent.type(field(), addDaysToDateKey(today, 120));
    expect(screen.getByText(FIXED_DATE_FITS)).toBeInTheDocument();
  });

  it('B-109: a date under 4 weeks away is an error and blocks Continue', async () => {
    render(<Harness onContinue={() => {}} />);
    await userEvent.type(field(), addDaysToDateKey(todayKey(new Date()), 20));
    expect(screen.getByText(FIXED_DATE_TOO_CLOSE)).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('a date that is not after today is an error and blocks Continue', async () => {
    render(<Harness onContinue={() => {}} />);
    await userEvent.type(field(), todayKey(new Date()));
    expect(screen.getByText(FIXED_DATE_INVALID)).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});

describe('StepSchedule: which days (B-108)', () => {
  it('shows the training days with the plan\'s own rest days picked from today, and keeps a count until it adds up', async () => {
    render(<Harness onContinue={() => {}} />);
    const days = screen.getByRole('group', { name: 'Which days?' });
    expect(within(days).getAllByRole('checkbox').filter((box) => (box as HTMLInputElement).checked)).toHaveLength(5);
    const firstTraining = within(days).getAllByRole('checkbox').find((box) => (box as HTMLInputElement).checked)!;
    await userEvent.click(firstTraining);
    expect(screen.getByText('4 picked. Pick exactly 5.')).toBeInTheDocument();
  });
});

