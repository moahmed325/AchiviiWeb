import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrainingDays } from './TrainingDays';

// Edit my schedule (B-108): the weekday picker.
describe('TrainingDays', () => {
  it('checks the training days, Monday first, and reports a change as the new rest days', async () => {
    const onChange = vi.fn();
    render(<TrainingDays variant="steady" restWeekdays={[0, 4]} onChange={onChange} />);
    expect(screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-labelledby') && (box as HTMLInputElement).checked)).toEqual([true, true, true, false, true, true, false]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thu' }));
    expect(onChange).toHaveBeenCalledWith([0]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sat' }));
    expect(onChange).toHaveBeenLastCalledWith([0, 4, 6]);
  });

  it('keeps a live count that says how many to pick until it adds up', () => {
    const { rerender } = render(<TrainingDays variant="steady" restWeekdays={[0, 4]} onChange={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('');
    rerender(<TrainingDays variant="steady" restWeekdays={[0]} onChange={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('6 picked. Pick exactly 5.');
  });
});
