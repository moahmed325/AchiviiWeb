import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { Goal } from '../../types';
import { AppShell } from './AppShell';
import { shellEntries, shellMode } from './shellEntries';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
    reconcileGoal: vi.fn().mockResolvedValue({ applies: false, reason: 'no_active_goal' }),
    resetActiveGoal: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(async () => ({
      data: {
        session: localStorage.getItem('achivii_auth_token')
          ? { access_token: localStorage.getItem('achivii_auth_token') }
          : null,
      },
    })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(async () => undefined),
  },
}));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));
const USER = { id: 'u1', email: 'mo@example.com', created_at: '2026-09-23' };
const GOAL = { id: 'g1', rawGoal: 'Run a 10K Under 50 Minutes', clarifiedOutcome: '49.98', currentWeek: 3 } as Goal;

const renderAt = (url: string) =>
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter initialEntries={[url]}>
          <AppShell>
            <Routes>
              <Route path="/" element={<main id="main">Today page</main>} />
              <Route path="/dashboard" element={<main id="main">Dashboard page</main>} />
              <Route path="/roadmap" element={<main id="main">Roadmap page</main>} />
              <Route path="/onboarding" element={<main id="main">Onboarding page</main>} />
            </Routes>
          </AppShell>
        </MemoryRouter>
      </GoalProvider>
    </AuthProvider>,
  );

/** jsdom applies no CSS, so the rail and the bottom bar are both in the tree; each is checked on its own. */
const rail = () => within(document.querySelector<HTMLElement>('[data-shell="rail"]')!);
const bottomBar = () => within(document.querySelector<HTMLElement>('[data-shell="bottom-bar"]')!);
/** The Supabase session resolves after the first render, so the app frame (rail and bar) mounts a tick later. */
const shellReady = () => vi.waitFor(() => expect(document.querySelector('[data-shell="rail"]')).not.toBeNull());

const signedIn = (goal: Goal | null) => {
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
  mocked.fetchCurrentUser.mockResolvedValue(USER);
  mocked.fetchActiveGoal.mockResolvedValue(goal);
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  supabaseMock.auth.getSession.mockImplementation(async () => ({
    data: { session: null },
  }));
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
});

describe('shellMode and shellEntries', () => {
  it('keeps the landing, auth and preview screens chromeless and gives onboarding the top bar', () => {
    expect(shellMode('/', false)).toBe('chromeless');
    expect(shellMode('/login', true)).toBe('chromeless');
    expect(shellMode('/__ui', true, '/__ui')).toBe('chromeless');
    expect(shellMode('/roadmap', false)).toBe('bare');
    expect(shellMode('/onboarding', true)).toBe('focused');
    expect(shellMode('/', true)).toBe('app');
    expect(shellMode('/dashboard', true)).toBe('app');
  });

  it('shows Roadmap and Progress only with a goal, and marks Today active on /', () => {
    expect(shellEntries('/', false).showRoadmap).toBe(false);
    expect(shellEntries('/', false).showProgress).toBe(false);
    expect(shellEntries('/', true).showRoadmap).toBe(true);
    expect(shellEntries('/', true).showProgress).toBe(true);
    expect(shellEntries('/', true).todayActive).toBe(true);
    expect(shellEntries('/dashboard', true).todayActive).toBe(false);
    expect(shellEntries('/dashboard', true).dashboardActive).toBe(true);
    expect(shellEntries('/roadmap', true)).toEqual({
      dashboardActive: false,
      todayActive: false,
      roadmapActive: true,
      showRoadmap: true,
      progressActive: false,
      showProgress: true,
    });
    expect(shellEntries('/progress', true)).toEqual({
      dashboardActive: false,
      todayActive: false,
      roadmapActive: false,
      showRoadmap: true,
      progressActive: true,
      showProgress: true,
    });
  });
});

describe('entries', () => {
  it('with a goal: Dashboard (Home on mobile), Today, Roadmap, Progress, Pathways, Coach and Account, in both layouts', async () => {
    signedIn(GOAL);
    renderAt('/');
    await shellReady();
    await rail().findByRole('link', { name: 'Roadmap' });
    for (const [layout, home] of [[rail(), 'Dashboard'], [bottomBar(), 'Home']] as const) {
      const nav = layout.getByRole('navigation', { name: 'Primary' });
      const names = Array.from(nav.querySelectorAll('a, button'))
        .filter((el) => !el.closest('[hidden]'))
        .map((el) => el.textContent?.replace('mo@example.com', '').trim());
      expect(names).toEqual([home, 'Today', 'Roadmap', 'Progress', 'Pathways', 'Coach ✦', 'Account']);
      expect(within(nav).getByRole('link', { name: home })).toHaveAttribute('href', '/dashboard');
      expect(within(nav).getByRole('link', { name: home })).not.toHaveAttribute('aria-current');
      expect(within(nav).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByRole('link', { name: 'Roadmap' })).not.toHaveAttribute('aria-current');
      expect(within(nav).getByRole('link', { name: 'Progress' })).not.toHaveAttribute('aria-current');
      expect(within(nav).queryByText(/Journey|coming soon|\(\d+\)/i)).toBeNull();
    }
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByText(/Achivii ©/)).toBeNull();
  });

  it('opens an honest Coach coming-soon sheet from the shell', async () => {
    signedIn(GOAL);
    const user = userEvent.setup();
    renderAt('/');
    await shellReady();
    await rail().findByRole('button', { name: /Coach/ });
    await user.click(rail().getByRole('button', { name: /Coach/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Achivii Coach' });
    expect(dialog).toHaveTextContent('In development');
    expect(dialog).toHaveTextContent(/1-on-1 companion/);
    await user.click(screen.getByRole('button', { name: 'Back to Practice' }));
    expect(screen.queryByRole('dialog', { name: 'Achivii Coach' })).toBeNull();
  });

  it('without a goal: no Roadmap or Progress entry', async () => {
    signedIn(null);
    renderAt('/');
    await screen.findByText('Today page');
    await vi.waitFor(() => expect(mocked.fetchActiveGoal).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: 'Roadmap' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Progress' })).toBeNull();
    expect(rail().getByRole('button', { name: 'Pathways' })).toBeInTheDocument();
  });

  it('marks Roadmap as the current page on /roadmap, Progress on /progress, and Today on /', async () => {
    signedIn(GOAL);
    const { unmount } = renderAt('/roadmap');
    await shellReady();
    expect(await rail().findByRole('link', { name: 'Roadmap' })).toHaveAttribute('aria-current', 'page');
    expect(rail().getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
    expect(rail().getByRole('link', { name: 'Progress' })).not.toHaveAttribute('aria-current');
    unmount();
    const progressRender = renderAt('/progress');
    await shellReady();
    expect(await rail().findByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
    progressRender.unmount();
    renderAt('/');
    await shellReady();
    expect(await bottomBar().findByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('starts every signed-in screen with the skip link', async () => {
    signedIn(GOAL);
    renderAt('/');
    await screen.findByText('Today page');
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
  });

  it('clicking Coach ✦ opens the CoachModal', async () => {
    signedIn(GOAL);
    const user = userEvent.setup();
    renderAt('/');
    await shellReady();
    await rail().findByRole('link', { name: 'Roadmap' });
    await user.click(rail().getByRole('button', { name: /Coach/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Achivii Coach' });
    expect(dialog).toHaveTextContent('In development');
    expect(dialog).toHaveTextContent(/1-on-1 companion/);
    await user.click(screen.getByRole('button', { name: 'Back to Practice' }));
    expect(screen.queryByRole('dialog', { name: 'Achivii Coach' })).toBeNull();
  });
});

describe('Account', () => {
  it('opens as a disclosure, shows the goal the user chose, and closes on Escape with focus back', async () => {
    signedIn(GOAL);
    const user = userEvent.setup();
    renderAt('/roadmap');
    await shellReady();
    await rail().findByRole('link', { name: 'Roadmap' });
    const trigger = rail().getByRole('button', { name: /^Account/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(rail().getByText('mo@example.com', { selector: 'p' })).toBeInTheDocument();
    expect(rail().getByText(GOAL.rawGoal)).toBeInTheDocument();
    expect(rail().queryByText('49.98')).toBeNull();
    expect(rail().getByRole('button', { name: 'Reset 90-Day Plan' })).toBeInTheDocument();
    expect(rail().getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(rail().queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('Reset asks first; confirming deletes the plan and opens onboarding', async () => {
    signedIn(GOAL);
    mocked.resetActiveGoal.mockResolvedValue(true);
    const user = userEvent.setup();
    renderAt('/roadmap');
    await shellReady();
    await rail().findByRole('link', { name: 'Roadmap' });
    await user.click(rail().getByRole('button', { name: /^Account/ }));
    await user.click(rail().getByRole('button', { name: 'Reset 90-Day Plan' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reset your 90-day plan?' });
    expect(dialog).toHaveTextContent("It can't be undone");
    await user.click(within(dialog).getByRole('button', { name: 'Keep my plan' }));
    expect(mocked.resetActiveGoal).not.toHaveBeenCalled();
    expect(screen.getByText('Roadmap page')).toBeInTheDocument();

    await user.click(rail().getByRole('button', { name: 'Reset 90-Day Plan' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset plan' }));
    expect(await screen.findByText('Onboarding page')).toBeInTheDocument();
    expect(mocked.resetActiveGoal).toHaveBeenCalledTimes(1);
  });

  it('a failed reset says so and does not navigate', async () => {
    signedIn(GOAL);
    mocked.resetActiveGoal.mockRejectedValue(new Error('Failed to reset goal'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderAt('/roadmap');
    await shellReady();
    await rail().findByRole('link', { name: 'Roadmap' });
    await user.click(rail().getByRole('button', { name: /^Account/ }));
    await user.click(rail().getByRole('button', { name: 'Reset 90-Day Plan' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset your 90-day plan?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reset plan' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("We couldn't reset your plan. Please try again.");
    expect(screen.getByText('Roadmap page')).toBeInTheDocument();
  });

  it('on onboarding: only the top bar, and Account has Sign out but no Reset', async () => {
    signedIn(GOAL);
    const user = userEvent.setup();
    renderAt('/onboarding');
    await screen.findByText('Onboarding page');
    await vi.waitFor(() => expect(mocked.fetchActiveGoal).toHaveBeenCalled());
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'Achivii, home' })).toHaveAttribute('href', '/');
    await user.click(within(banner).getAllByRole('button', { name: /^Account/ })[0]);
    expect(within(banner).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset 90-Day Plan' })).toBeNull();
    expect(screen.queryByText(GOAL.rawGoal)).toBeNull();
  });

  it('shows the offline chip from the load-time check', async () => {
    signedIn(GOAL);
    mocked.fetchHealthCheck.mockRejectedValue(new Error('down'));
    renderAt('/');
    await shellReady();
    expect(await rail().findByRole('status')).toHaveTextContent('Offline');
    expect(bottomBar().getByRole('status')).toHaveTextContent('Offline');
  });
});
