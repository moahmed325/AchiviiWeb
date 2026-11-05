import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Goal } from '../types';

const auth = vi.hoisted(() => ({
  user: { id: 'u1', email: 'mo@example.com', created_at: '2026-09-23T00:00:00.000Z', timezone: 'Asia/Tokyo' } as Record<string, unknown>,
  firstName: 'Mo' as string | null,
}));
const goal = vi.hoisted(() => ({ activeGoal: null as Goal | null }));
const access = vi.hoisted(() => ({ state: 'trial' as string | null, trialEndsAt: null as string | null }));
const billing = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: auth.user, token: 't', logout: vi.fn(), setTimezone: vi.fn(), setReminders: vi.fn() }),
  useFirstName: () => ({ firstName: auth.firstName, setFirstName: vi.fn() }),
  useAuthToken: () => 't',
}));
vi.mock('../context/GoalContext', () => ({ useGoal: () => ({ activeGoal: goal.activeGoal, refreshGoal: vi.fn(), resetGoal: vi.fn() }) }));
vi.mock('../hooks/useAccess', () => ({ useAccess: () => ({ ...access, reload: vi.fn() }) }));
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), fetchBillingAccountState: billing.fetch }));

import { AccountPage } from './AccountPage';

const FREE = { plan: 'free', status: 'none', billingInterval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, manageUrl: null };
const renderPage = () => render(<MemoryRouter><AccountPage /></MemoryRouter>);
const membership = () => screen.getByRole('region', { name: 'Membership' });

beforeEach(() => {
  auth.firstName = 'Mo';
  goal.activeGoal = null;
  access.state = 'trial';
  access.trialEndsAt = new Date(Date.now() + 19 * 86_400_000 + 3_600_000).toISOString();
  billing.fetch.mockReset().mockResolvedValue(FREE);
});

describe('the Account page (ND-39)', () => {
  it('heads with the first name and email, and the time zone in words', async () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Mo' })).toBeInTheDocument();
    expect(screen.getAllByText(/mo@example\.com/).length).toBeGreaterThan(0);
    expect(screen.getByText('Your days start and end on Tokyo time.')).toBeInTheDocument();
    expect(await within(membership()).findByText('Free trial')).toBeInTheDocument();
  });

  it('without a name: "Your account"', () => {
    auth.firstName = null;
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Your account' })).toBeInTheDocument();
  });

  it('a trial: the days left, a bar of the trial used, and Go Pro', async () => {
    renderPage();
    expect(await within(membership()).findByText('20 days left. Go Pro to keep your plan going.')).toBeInTheDocument();
    expect(within(membership()).getByRole('progressbar', { name: 'Free trial used' })).toHaveAttribute('aria-valuetext', '20 of 30 days left');
    expect(within(membership()).getByRole('button', { name: 'Go Pro' })).toBeInTheDocument();
  });

  it('Pro: the renewal date and Manage subscription, no Go Pro', async () => {
    access.state = 'pro';
    billing.fetch.mockResolvedValue({ ...FREE, plan: 'pro', status: 'ACTIVE', currentPeriodEnd: '2026-12-01T00:00:00.000Z', manageUrl: 'https://manage.example' });
    renderPage();
    expect(await within(membership()).findByRole('link', { name: 'Manage subscription' })).toHaveAttribute('href', 'https://manage.example');
    expect(within(membership()).getByText('Achivii Pro')).toBeInTheDocument();
    expect(within(membership()).getByText(/^Renews on /)).toBeInTheDocument();
    expect(within(membership()).queryByRole('button', { name: 'Go Pro' })).toBeNull();
  });

  it('a trial that ended: the plan is paused and kept, Go Pro', async () => {
    access.state = 'locked';
    renderPage();
    expect(await within(membership()).findByText('Your free trial has ended')).toBeInTheDocument();
    expect(within(membership()).getByText(/Your plan is paused and kept as it is/)).toBeInTheDocument();
    expect(within(membership()).getByRole('button', { name: 'Go Pro' })).toBeInTheDocument();
  });

  it('before the first plan: when the trial starts, and no button', async () => {
    access.state = 'new';
    renderPage();
    expect(await within(membership()).findByText('Your 30-day free trial starts with your first plan.')).toBeInTheDocument();
    expect(within(membership()).queryByRole('button')).toBeNull();
  });

  it('a billing answer that fails says so and tries again', async () => {
    billing.fetch.mockRejectedValueOnce(new Error('down')).mockResolvedValue(FREE);
    renderPage();
    const retry = await within(membership()).findByRole('button', { name: 'Try again' });
    await userEvent.click(retry);
    expect(billing.fetch).toHaveBeenCalledTimes(2);
  });

  it('with a goal: the goal the person chose, Edit my schedule, and Reset set apart', () => {
    goal.activeGoal = { id: 'g', rawGoal: 'Run a 10K', clarifiedOutcome: '49.98', currentWeek: 3, targetDate: '2026-12-20T00:00:00.000Z' } as Goal;
    renderPage();
    expect(within(screen.getByRole('region', { name: 'Your goal' })).getByText('Run a 10K')).toBeInTheDocument();
    expect(screen.queryByText('49.98')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit my schedule' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Start over' })).getByRole('button', { name: 'Reset my plan' })).toBeInTheDocument();
  });

  it('without a goal: no goal card and no Reset', () => {
    renderPage();
    expect(screen.queryByRole('region', { name: 'Your goal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset my plan' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
