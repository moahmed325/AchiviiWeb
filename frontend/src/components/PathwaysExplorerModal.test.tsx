import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PathwaysExplorerModal } from './PathwaysExplorerModal';

const Onboarding = () => <pre data-testid="state">{JSON.stringify(useLocation().state)}</pre>;

const Screen = ({ activeGoalTitle, initialPathwayId }: { activeGoalTitle?: string; initialPathwayId?: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Explore Goals</button>
      <PathwaysExplorerModal
        isOpen={open}
        onClose={() => setOpen(false)}
        activeGoalTitle={activeGoalTitle}
        initialPathwayId={initialPathwayId}
      />
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
  await userEvent.click(screen.getByRole('button', { name: 'Explore Goals' }));
  return screen.findByRole('dialog', { name: 'Explore pathways' });
};

afterEach(() => localStorage.clear());

describe('PathwaysExplorerModal', () => {
  it('switches from the current goal to another pathway with the switch launch state', async () => {
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App' });
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription(/Your current journey stays as it is until you finish setting up a new one\./);
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: 'Build & Ship a SaaS Web App' })).toHaveAccessibleDescription(/^Current pathway/);
    expect(screen.getByRole('button', { name: /Restart this pathway/ })).toBeEnabled();

    await userEvent.click(screen.getByRole('tab', { name: 'Fitness' }));
    const switchButton = screen.getByRole('button', { name: /Switch to this pathway/ });
    expect(switchButton).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Run a 10K Under 50 Minutes' }));
    await userEvent.click(switchButton);

    expect(localStorage.getItem('achivii_draft_goal')).toBe('Run a 10K Under 50 Minutes');
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
      presetGoal: 'Run a 10K Under 50 Minutes',
      isPreset: true,
      switchGoal: true,
    });
  });

  it('opens on the pathway it was opened from', async () => {
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App', initialPathwayId: 'youtube' });
    await open();
    expect(screen.getByRole('tab', { name: 'Creative' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('radio', { name: 'Launch a YouTube Channel (12 Videos)' })).toBeChecked();
    expect(screen.getByRole('button', { name: /Switch to this pathway/ })).toBeEnabled();
  });

  it('offers to start, not switch, when there is no goal', async () => {
    renderScreen();
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription('Each pathway is a guided 90-day journey, planned around your life.');
    expect(screen.getByRole('button', { name: /Start this pathway/ })).toBeInTheDocument();
    expect(screen.queryByText(/Current pathway/)).not.toBeInTheDocument();
  });

  it('does not mark a custom goal that mentions a pathway as that pathway', async () => {
    renderScreen({ activeGoalTitle: 'Learn some Spanish for my trip' });
    await open();
    expect(screen.queryByText(/Current pathway/)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Career' })).toHaveAttribute('aria-selected', 'true');
  });

  it('closes on Escape and on Cancel, returning focus, and starts fresh each time', async () => {
    renderScreen({ activeGoalTitle: 'Build & Ship a SaaS Web App' });
    const opener = screen.getByRole('button', { name: 'Explore Goals' });
    await open();
    await userEvent.click(screen.getByRole('tab', { name: 'Learning' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Speak Conversational Spanish' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());

    await open();
    expect(screen.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(localStorage.getItem('achivii_draft_goal')).toBeNull();
    expect(screen.queryByTestId('state')).not.toBeInTheDocument();
  });
});
