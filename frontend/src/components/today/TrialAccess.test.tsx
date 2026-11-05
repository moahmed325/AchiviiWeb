import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal } from '../../types';
import { useAccess, type AccessInfo } from '../../hooks/useAccess';
import { TrialEnded, TrialNotice } from './TrialAccess';

vi.mock('../../hooks/useAccess', () => ({ useAccess: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuthToken: () => 't' }));
vi.mock('../../lib/api', () => ({ startProCheckout: vi.fn() }));

const access = vi.mocked(useAccess);
const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000 - 60_000).toISOString();
const given = (info: Partial<AccessInfo>) => access.mockReturnValue({ state: null, trialEndsAt: null, reload: vi.fn(), ...info });

describe('TrialNotice (ND-37)', () => {
  beforeEach(() => access.mockReset());

  it('stays out of the way until the trial’s last week', () => {
    given({ state: 'trial', trialEndsAt: inDays(12) });
    const { container } = render(<TrialNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('in the last week, says how long is left and opens Pro', async () => {
    given({ state: 'trial', trialEndsAt: inDays(5) });
    render(<TrialNotice />);
    expect(screen.getByRole('complementary', { name: 'Your free trial' })).toHaveTextContent('5 days left of your free trial.');
    await userEvent.click(screen.getByRole('button', { name: 'See Pro' }));
    expect(screen.getByRole('dialog', { name: 'Achivii Pro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Pro' })).toBeEnabled();
  });

  it('names the last day, and shows nothing for Pro', () => {
    given({ state: 'trial', trialEndsAt: inDays(1) });
    const { unmount } = render(<TrialNotice />);
    expect(screen.getByText('Today is the last day of your free trial.')).toBeInTheDocument();
    unmount();
    given({ state: 'pro', trialEndsAt: inDays(3) });
    const { container } = render(<TrialNotice />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TrialEnded (ND-37)', () => {
  it('keeps the plan, offers Pro and the Roadmap', () => {
    render(
      <MemoryRouter>
        <TrialEnded goal={{ rawGoal: 'Run a 10K' } as Goal} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Keep going where you left off.' })).toBeInTheDocument();
    expect(screen.getByText(/Your plan for “Run a 10K”, your progress and your notes are all kept/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Pro' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Roadmap' })).toHaveAttribute('href', '/roadmap');
  });
});
