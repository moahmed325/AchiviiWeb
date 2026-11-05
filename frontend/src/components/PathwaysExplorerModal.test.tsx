import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAccess } from '../hooks/useAccess';
import { PathwaysExplorerModal } from './PathwaysExplorerModal';

const auth = vi.hoisted(() => ({ upNextSkill: null as string | null, setUpNextSkill: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuthUser: () => ({ id: 'u1', email: 'test@example.com', upNextSkill: auth.upNextSkill }),
  useSetUpNextSkill: () => auth.setUpNextSkill,
  useAuthToken: () => 't',
}));
vi.mock('../hooks/useAccess', () => ({ useAccess: vi.fn() }));
vi.mock('../lib/api', () => ({ startProCheckout: vi.fn() }));

const access = vi.mocked(useAccess);
const Onboarding = () => <pre data-testid="state">{JSON.stringify(useLocation().state)}</pre>;

const Screen = ({ activeGoalTitle, initialPathwayId }: { activeGoalTitle?: string; initialPathwayId?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open skills</button>
      <PathwaysExplorerModal isOpen={open} onClose={() => setOpen(false)} activeGoalTitle={activeGoalTitle} initialPathwayId={initialPathwayId} />
    </>
  );
};

const renderScreen = (props: { activeGoalTitle?: string; initialPathwayId?: string } = {}) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Screen {...props} />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </MemoryRouter>,
  );

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Open skills' }));
  return screen.findByRole('dialog', { name: 'Skills' });
};

beforeEach(() => {
  auth.upNextSkill = null;
  auth.setUpNextSkill.mockReset().mockResolvedValue(undefined);
  access.mockReturnValue({ state: 'pro', trialEndsAt: null, reload: vi.fn() });
});
afterEach(() => localStorage.clear());

describe('Skills (ND-38)', () => {
  it('Pro with a plan running: adds the chosen skill to the timeline, never the current plan', async () => {
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App' });
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription('Add one to your timeline. When your current plan ends, it’s ready to start.');
    expect(screen.getByRole('radio', { name: 'Build & Ship a SaaS Web App' })).toHaveAccessibleDescription(/^Current pathway/);
    expect(screen.getByRole('button', { name: 'Your current plan' })).toBeDisabled();

    await userEvent.click(screen.getByRole('tab', { name: 'Fitness' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add to my timeline' }));
    expect(auth.setUpNextSkill).toHaveBeenCalledWith('run10k');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByTestId('state')).not.toBeInTheDocument();
  });

  it('marks the skill already up next', async () => {
    auth.upNextSkill = 'youtube';
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App', initialPathwayId: 'youtube' });
    await open();
    expect(screen.getByRole('radio', { name: 'Launch a YouTube Channel (12 Videos)' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Up next already' })).toBeDisabled();
  });

  it('without Pro, a plan running leads to Pro instead', async () => {
    access.mockReturnValue({ state: 'trial', trialEndsAt: null, reload: vi.fn() });
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App' });
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription(/With Achivii Pro, add a skill to your timeline/);
    await userEvent.click(screen.getByRole('button', { name: 'See Pro' }));
    expect(screen.getByRole('button', { name: 'Continue to Pro' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to skills' }));
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(auth.setUpNextSkill).not.toHaveBeenCalled();
  });

  it('with no plan, starts the chosen skill as the plan', async () => {
    renderScreen();
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription('Pick one to start your plan.');
    await userEvent.click(screen.getByRole('tab', { name: 'Fitness' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' }));
    await userEvent.click(screen.getByRole('button', { name: /Start this skill/ }));
    expect(JSON.parse((await screen.findByTestId('state')).textContent!)).toMatchObject({ presetGoal: 'Run a 10K Under 50 Minutes' });
  });

  it('does not mark a custom goal that mentions a pathway as that pathway', async () => {
    renderScreen({ activeGoalTitle: 'Learn some Spanish for my trip' });
    await open();
    expect(screen.queryByText(/Current pathway/)).not.toBeInTheDocument();
  });

  it('closes on Escape and on Cancel, returning focus, and starts fresh each time', async () => {
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App' });
    const opener = screen.getByRole('button', { name: 'Open skills' });
    await open();
    await userEvent.click(screen.getByRole('tab', { name: 'Learning' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());

    await open();
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(auth.setUpNextSkill).not.toHaveBeenCalled();
  });
});
