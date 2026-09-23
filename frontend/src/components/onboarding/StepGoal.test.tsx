import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepGoal } from './StepGoal';

describe('StepGoal', () => {
  it('hands onboarding the pathway title as a preset goal', async () => {
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="" onStartGoal={onStartGoal} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Creative' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Play 5 Songs on Acoustic Guitar' }));
    await userEvent.click(screen.getByRole('button', { name: /Start this pathway/ }));
    expect(onStartGoal).toHaveBeenCalledWith('Play 5 Songs on Acoustic Guitar', 'pathway');
  });

  it('comes back to the pathway already chosen', () => {
    render(<StepGoal rawGoal="Speak Conversational Spanish" onStartGoal={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Learning' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Speak Conversational Spanish' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Your goal' })).toHaveValue('');
  });

  it('keeps a custom goal free and available beside the pathways (ND-6)', async () => {
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="" onStartGoal={onStartGoal} />);
    const custom = screen.getByRole('region', { name: 'Something else in mind?' });
    expect(custom).not.toHaveTextContent(/premium|locked|upgrade|paid|price/i);

    const field = screen.getByRole('textbox', { name: 'Your goal' });
    expect(field).toBeEnabled();
    await userEvent.type(field, 'Bake sourdough bread at home');
    await userEvent.click(screen.getByRole('button', { name: /Continue with my goal/ }));
    expect(onStartGoal).toHaveBeenCalledWith('Bake sourdough bread at home', 'custom');
  });

  it('keeps a custom goal that is not a pathway in the custom field', () => {
    render(<StepGoal rawGoal="Bake sourdough bread at home" onStartGoal={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Your goal' })).toHaveValue('Bake sourdough bread at home');
    expect(screen.queryByRole('group', { name: /pathway$/ })).not.toBeInTheDocument();
  });
});
