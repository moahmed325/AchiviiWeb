import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthError } from '@supabase/supabase-js';
import { AuthProvider } from '../../context/AuthContext';
import * as api from '../../lib/api';
import { EMAIL_NOT_CONFIRMED } from '../../lib/authFlow';
import { LoginPage } from './LoginPage';
import { SignupPage } from './SignupPage';

// B-15: email confirmation and sign-in with Google.

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
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
  },
}));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));

const renderAt = (url: string) =>
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
  supabaseMock.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  vi.mocked(api.fetchCurrentUser).mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '2026-09-23' });
});

async function fillAndSubmit(button: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email'), 'mo@example.com');
  await user.type(screen.getByLabelText('Password'), 'secret-pass');
  await user.click(screen.getByRole('button', { name: button }));
}

describe('email confirmation (B-15)', () => {
  it('sign-up that needs a confirmed email shows the inbox line, not an error', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: { session: null, user: { id: 'x' } }, error: null });
    renderAt('/signup');
    await fillAndSubmit('Create account');
    expect(await screen.findByRole('status')).toHaveTextContent('Check your inbox. We sent a link to mo@example.com.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(supabaseMock.auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(`${window.location.origin}/login`);
  });

  it('signing in before confirming says what to do', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new AuthError('Email not confirmed', 400, 'email_not_confirmed'),
    });
    renderAt('/login');
    await fillAndSubmit('Sign in');
    expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_NOT_CONFIRMED);
  });
});

describe('sign in with Google (B-15)', () => {
  it.each(['/login', '/signup'])('%s offers Google and comes back to sign-in', async (url) => {
    const user = userEvent.setup();
    renderAt(url);
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(supabaseMock.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/login` } });
  });

  it('a failure shows in the form', async () => {
    const user = userEvent.setup();
    supabaseMock.auth.signInWithOAuth.mockResolvedValue({ data: {}, error: new AuthError('Unsupported provider: provider is not enabled', 400, 'validation_failed') });
    renderAt('/login');
    await user.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported provider');
  });
});
