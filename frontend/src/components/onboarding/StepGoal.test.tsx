import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as api from '../../lib/api';
import { StepGoal } from './StepGoal';

vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ token: 'test-token' }) }));
vi.mock('../../lib/api', () => ({ fetchBillingEntitlement: vi.fn(), startProCheckout: vi.fn() }));

const entitlement = vi.mocked(api.fetchBillingEntitlement);

describe('StepGoal', () => {
  beforeEach(() => {
    entitlement.mockReset();
    entitlement.mockResolvedValue({ plan: 'pro', entitled: true });
  });

  it('hands onboarding the pathway title as a preset goal', async () => {
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="" onStartGoal={onStartGoal} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Creative' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Play 5 Songs on Acoustic Guitar' }));
    await userEvent.click(screen.getByRole('button', { name: /Start this pathway/ }));
    expect(onStartGoal).toHaveBeenCalledWith('Play 5 Songs on Acoustic Guitar', 'pathway');
  });

  it('comes back to the pathway already chosen', async () => {
    render(<StepGoal rawGoal="Speak Conversational Spanish" onStartGoal={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Learning' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Speak Conversational Spanish' })).toBeChecked();
    expect(await screen.findByRole('textbox', { name: 'Your goal' })).toHaveValue('');
  });

  it('gives a Pro user the custom goal field beside the pathways, unchanged (ND-6, ND-10)', async () => {
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="" onStartGoal={onStartGoal} />);
    const custom = screen.getByRole('region', { name: 'Have something unique in mind?' });

    const field = await screen.findByRole('textbox', { name: 'Your goal' });
    expect(custom).toContainElement(field);
    expect(custom).not.toHaveTextContent(/upgrade|price|\$/i);
    expect(field).toBeEnabled();
    await userEvent.type(field, 'Bake sourdough bread at home');
    await userEvent.click(screen.getByRole('button', { name: /Continue with my goal/ }));
    expect(onStartGoal).toHaveBeenCalledWith('Bake sourdough bread at home', 'custom');
  });

  it('keeps a custom goal that is not a pathway in the custom field', async () => {
    render(<StepGoal rawGoal="Bake sourdough bread at home" onStartGoal={vi.fn()} />);
    expect(await screen.findByRole('textbox', { name: 'Your goal' })).toHaveValue('Bake sourdough bread at home');
    expect(screen.queryByRole('group', { name: /pathway$/ })).not.toBeInTheDocument();
  });

  it('tells a free user a custom goal is Pro before they write it, and keeps the pathways free', async () => {
    entitlement.mockResolvedValue({ plan: 'free', entitled: false });
    const onStartGoal = vi.fn();
    render(<StepGoal rawGoal="" onStartGoal={onStartGoal} />);
    const custom = screen.getByRole('region', { name: 'Have something unique in mind?' });

    expect(await screen.findByRole('heading', { name: 'Make the journey yours.' })).toBeInTheDocument();
    expect(custom).toContainElement(screen.getByRole('button', { name: 'Continue to Pro' }));
    expect(screen.queryByRole('textbox', { name: 'Your goal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue with my goal/ })).not.toBeInTheDocument();
    expect(entitlement).toHaveBeenCalledWith('test-token');

    await userEvent.click(screen.getByRole('radio', { name: 'Creative' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Play 5 Songs on Acoustic Guitar' }));
    await userEvent.click(screen.getByRole('button', { name: /Start this pathway/ }));
    expect(onStartGoal).toHaveBeenCalledWith('Play 5 Songs on Acoustic Guitar', 'pathway');
  });
});
