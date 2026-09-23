import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CUSTOM_GOAL_LAUNCH, pathwayLaunch, usePathwayLaunch } from './launch';
import { findPathwayBySlug } from '../../lib/certifiedPresets';
import { resolvePostAuthDestination } from '../../lib/authFlow';

const run10k = findPathwayBySlug('run10k')!;

const Onboarding = () => <pre data-testid="state">{JSON.stringify(useLocation().state)}</pre>;

const Launcher = () => {
  const { startPathway, startCustomGoal } = usePathwayLaunch();
  return (
    <>
      <button onClick={() => startPathway(run10k)}>Pathway</button>
      <button onClick={startCustomGoal}>Custom</button>
    </>
  );
};

const renderLauncher = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Launcher />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => localStorage.clear());

describe('pathway launch', () => {
  it('sends the pathway title as the preset, as every gallery always has (R-3, R-15)', () => {
    expect(pathwayLaunch(run10k)).toEqual({
      to: '/onboarding',
      state: { presetGoal: 'Run a 10K Under 50 Minutes', isPreset: true, switchGoal: true },
      draftGoal: 'Run a 10K Under 50 Minutes',
    });
  });

  it('is the same launch the signup handoff uses (R-16)', () => {
    expect(resolvePostAuthDestination({ pathway: run10k, next: null, hasGoal: false, goalLoadFailed: false })).toEqual(
      pathwayLaunch(run10k),
    );
  });

  it('writes the draft goal and opens onboarding with the preset', async () => {
    renderLauncher();
    await userEvent.click(screen.getByRole('button', { name: 'Pathway' }));
    expect(localStorage.getItem('achivii_draft_goal')).toBe('Run a 10K Under 50 Minutes');
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual(pathwayLaunch(run10k).state);
  });

  it('opens a custom goal with no preset and clears any leftover draft', async () => {
    localStorage.setItem('achivii_draft_goal', 'Run a 10K Under 50 Minutes');
    renderLauncher();
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    expect(localStorage.getItem('achivii_draft_goal')).toBeNull();
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual(CUSTOM_GOAL_LAUNCH.state);
    expect(CUSTOM_GOAL_LAUNCH.state).toEqual({ isPreset: false, customGoal: true });
  });
});
