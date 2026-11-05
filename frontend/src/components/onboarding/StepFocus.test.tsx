import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepFocus } from './StepFocus';

const OPTIONS = ['Run 5K without stopping', 'Do 20 push-ups in a row', 'Walk 10,000 steps a day'];

describe('StepFocus', () => {
  it('turns a vague goal into one of the suggestions', async () => {
    const onChoose = vi.fn();
    render(<StepFocus goal="Get fit" options={OPTIONS} onChoose={onChoose} onChangeGoal={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/“Get fit” is a great direction/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Do 20 push-ups in a row' }));
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onChoose).toHaveBeenCalledWith('Do 20 push-ups in a row');
  });

  it('takes a finish line of their own, and comes back to it', async () => {
    const onChoose = vi.fn();
    const { unmount } = render(<StepFocus goal="Get fit" options={OPTIONS} onChoose={onChoose} onChangeGoal={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: /Something else/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Your 90-day goal' }), 'Hike Ben Nevis');
    await userEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(onChoose).toHaveBeenCalledWith('Hike Ben Nevis');
    unmount();

    render(<StepFocus goal="Get fit" options={OPTIONS} chosen="Hike Ben Nevis" onChoose={onChoose} onChangeGoal={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /Something else/ })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Your 90-day goal' })).toHaveValue('Hike Ben Nevis');
  });
});
