import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import * as api from '../../lib/api';
import { LoginPage } from './LoginPage';
import { ForgotPasswordPage, RESET_LINK_EXPIRED_LINE, RESET_SENT_LINE, ResetPasswordPage } from './PasswordResetPages';

// B-15: password reset, from the sign-in screen's link to a new password.

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  fetchCurrentUser: vi.fn(),
}));
vi.mock('../../context/GoalContext', () => ({ useGoal: () => ({ apiStatus: 'online', activeGoal: null, loading: false }) }));

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));

const renderAt = (url: string, state?: unknown) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[{ pathname: url, state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<p>At Today</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  supabaseMock.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
  vi.mocked(api.fetchCurrentUser).mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '2026-09-23' });
});

describe('password reset (B-15)', () => {
  it('sign-in links to the reset screen with the typed email', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(await screen.findByLabelText('Email'), 'mo@example.com');
    await user.click(screen.getByRole('link', { name: 'Forgot password?' }));
    expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveValue('mo@example.com');
  });

  it('sends the link to /reset-password and never says whether the account exists', async () => {
    const user = userEvent.setup();
    renderAt('/forgot-password', { email: 'mo@example.com' });
    await user.click(await screen.findByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('status')).toHaveTextContent(RESET_SENT_LINE);
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith('mo@example.com', { redirectTo: `${window.location.origin}/reset-password` });
  });

  it('checks the email before sending', async () => {
    const user = userEvent.setup();
    renderAt('/forgot-password');
    await user.click(await screen.findByRole('button', { name: 'Send reset link' }));
    expect(supabaseMock.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('an expired or used link says so and offers a new one', async () => {
    renderAt('/reset-password');
    expect(await screen.findByRole('alert')).toHaveTextContent(RESET_LINK_EXPIRED_LINE);
    expect(screen.getByRole('link', { name: 'Send a new link' })).toHaveAttribute('href', '/forgot-password');
  });

  it('with the recovery session, saves the new password and goes to Today', async () => {
    const user = userEvent.setup();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'recovery-token' } } });
    renderAt('/reset-password');
    await user.type(await screen.findByLabelText('New password'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('New password'), 'def');
    await user.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('At Today')).toBeInTheDocument();
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'abcdef' });
  });
});
