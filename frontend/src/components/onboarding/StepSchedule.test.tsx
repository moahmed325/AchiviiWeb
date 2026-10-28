import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoutineSettings } from '../../types';
import { addDaysToDateKey } from '../../lib/dateUtils';
import { FIXED_DATE_FITS, FIXED_DATE_HINT, FIXED_DATE_INVALID, FIXED_DATE_SHORT } from '../../lib/fixedDate';
import { todayKey } from '../../lib/today';
import { StepSchedule } from './StepSchedule';

// B-106: the optional fixed date on the schedule step.
const ROUTINE: RoutineSettings = { wakeTime: '07:00', sleepTime: '23:00', busyHours: '09:00 - 17:00', preferredSlot: 'evening', dailyMinutes: 60, planVariant: 'steady', commitments: [] };

function Harness({ onContinue }: { onContinue: () => void }) {
  const [fixedDate, setFixedDate] = useState('');
  return (
    <StepSchedule
      rawGoal="Pass the IELTS"
      routine={ROUTINE}
      onRoutineChange={() => {}}
      onChooseSlot={() => {}}
      timeline={null}
      commitments={null}
      scheduleChosen
      fixedDate={fixedDate}
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

  it('a date before day 90 says the plan ends after it; a later one says it ends by it', async () => {
    render(<Harness onContinue={() => {}} />);
    const today = todayKey(new Date());
    await userEvent.type(field(), addDaysToDateKey(today, 30));
    expect(screen.getByText(FIXED_DATE_SHORT)).toBeInTheDocument();
    await userEvent.clear(field());
    await userEvent.type(field(), addDaysToDateKey(today, 120));
    expect(screen.getByText(FIXED_DATE_FITS)).toBeInTheDocument();
  });

  it('a date that is not after today is an error and blocks Continue', async () => {
    render(<Harness onContinue={() => {}} />);
    await userEvent.type(field(), todayKey(new Date()));
    expect(screen.getByText(FIXED_DATE_INVALID)).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
});
