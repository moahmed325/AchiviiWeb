import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepGoal } from './StepGoal';

describe('StepGoal', () => {
  it('starts with the goal in the person’s own words', async () => {
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="" onStartGoal={onStartGoal} />);
    expect(screen.getByRole('heading', { level: 1, name: 'What do you want to achieve?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'What do you want to achieve?' }), 'Bake sourdough bread at home{Enter}');
    expect(onStartGoal).toHaveBeenCalledWith('Bake sourdough bread at home');
  });

  it('starts with an example in one tap, and keeps a goal already typed', async () => {
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="Learn to juggle" onStartGoal={onStartGoal} />);
    expect(screen.getByRole('textbox')).toHaveValue('Learn to juggle');
    await userEvent.click(screen.getByRole('button', { name: 'Get fit' }));
    expect(onStartGoal).toHaveBeenCalledWith('Get fit');
  });
});
