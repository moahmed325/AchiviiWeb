import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { Goal } from '../../types';
import { SignupPage } from './SignupPage';
import { LoginPage } from './LoginPage';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    signupUser: vi.fn(),
    loginUser: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
  };
});

const mocked = vi.mocked(api);
const USER = { id: 'u1', email: 'mo@example.com', created_at: '2026-09-23' };
const GOAL = { id: 'g1', rawGoal: 'Ship a SaaS' } as Goal;

/** Resolves on a later task, the way a network response does. */
const later = <T,>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 5));
const laterReject = (error: unknown) => new Promise<never>((_, reject) => setTimeout(() => reject(error), 5));

const Destination: React.FC<{ name: string }> = ({ name }) => {
  const location = useLocation();
  return (
    <div>
      <p>At {name}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </div>
  );
};

const renderAt = (url: string) =>
  render(
    <AuthProvider>
      <GoalProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/onboarding" element={<Destination name="onboarding" />} />
            <Route path="/roadmap" element={<Destination name="roadmap" />} />
            <Route path="/" element={<Destination name="today" />} />
          </Routes>
        </MemoryRouter>
      </GoalProvider>
    </AuthProvider>,
  );

const fillAndSubmit = async (email: string, password: string, submit: RegExp) => {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: submit }));
  return user;
};

beforeEach(() => {
  localStorage.clear();
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockImplementation(() => later(USER));
  mocked.signupUser.mockImplementation(() => later({ message: 'ok', token: 't-new', user: USER }));
  mocked.loginUser.mockImplementation(() => later({ message: 'ok', token: 't-new', user: USER }));
  mocked.fetchActiveGoal.mockImplementation(() => later(null));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('sign-up and sign-in screens', () => {
  it('labels the fields with the right autocomplete and offers a password toggle', async () => {
    renderAt('/signup');
    expect(screen.getByRole('heading', { level: 1, name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    const password = screen.getByLabelText('Password');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/forgot/i)).not.toBeInTheDocument();
  });

  it('validates like the backend before sending anything', async () => {
    renderAt('/signup');
    await fillAndSubmit('mo.example.com', '12345', /create account/i);
    expect(screen.getByText(/with an @/)).toBeInTheDocument();
    expect(screen.getByText('Use at least 6 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(mocked.signupUser).not.toHaveBeenCalled();
  });

  it('sends one request however many times submit is pressed', async () => {
    mocked.signupUser.mockImplementation(() => new Promise(() => {}));
    renderAt('/signup');
    const user = await fillAndSubmit('mo@example.com', 'secret1', /create account/i);
    await user.click(screen.getByRole('button', { name: /creating your account/i }));
    await user.keyboard('{Enter}');
    expect(mocked.signupUser).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /creating your account/i })).toHaveAttribute('aria-busy', 'true');
  });

  it('sends a fresh sign-up to onboarding', async () => {
    renderAt('/signup');
    await fillAndSubmit('mo@example.com', 'secret1', /create account/i);
    expect(await screen.findByText('At onboarding')).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('carries a chosen pathway into onboarding and consumes it', async () => {
    renderAt('/signup?pathway=run10k');
    expect(screen.getAllByText('Run a 10K Under 50 Minutes').length).toBeGreaterThan(0);
    await fillAndSubmit('mo@example.com', 'secret1', /create account/i);
    expect(await screen.findByText('At onboarding')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({
      presetGoal: 'Run a 10K Under 50 Minutes',
      isPreset: true,
      switchGoal: true,
    });
    expect(localStorage.getItem('achivii_draft_goal')).toBe('Run a 10K Under 50 Minutes');
  });

  it('keeps an existing goal when a returning user picked a pathway', async () => {
    mocked.fetchActiveGoal.mockImplementation(() => later(GOAL));
    renderAt('/login?pathway=run10k');
    await fillAndSubmit('mo@example.com', 'secret1', /^sign in$/i);
    expect(await screen.findByText('At today')).toBeInTheDocument();
    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({ pathwayNotice: 'Run a 10K Under 50 Minutes' });
    expect(localStorage.getItem('achivii_draft_goal')).toBeNull();
  });

  it('lands on Today, not onboarding, when the goal fetch fails', async () => {
    mocked.fetchActiveGoal.mockImplementation(() => laterReject(new Error('Failed to fetch active goal')));
    renderAt('/login?pathway=run10k');
    await fillAndSubmit('mo@example.com', 'secret1', /^sign in$/i);
    expect(await screen.findByText('At today')).toBeInTheDocument();
    expect(screen.getByTestId('state')).toHaveTextContent('null');
  });

  it('still redirects when the goal fetch settles before it renders as loading', async () => {
    mocked.loginUser.mockResolvedValue({ message: 'ok', token: 't-new', user: USER });
    mocked.fetchCurrentUser.mockResolvedValue(USER);
    mocked.fetchActiveGoal.mockResolvedValue(GOAL);
    renderAt('/login');
    await fillAndSubmit('mo@example.com', 'secret1', /^sign in$/i);
    expect(await screen.findByText('At today', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('honours an internal next after sign-in', async () => {
    mocked.fetchActiveGoal.mockImplementation(() => later(GOAL));
    renderAt('/login?next=%2Froadmap');
    await fillAndSubmit('mo@example.com', 'secret1', /^sign in$/i);
    expect(await screen.findByText('At roadmap')).toBeInTheDocument();
  });

  it('moves an already signed-in visitor straight on', async () => {
    localStorage.setItem('achivii_auth_token', 't-old');
    mocked.fetchActiveGoal.mockImplementation(() => later(GOAL));
    renderAt('/login?next=%2Froadmap');
    expect(await screen.findByText('At roadmap')).toBeInTheDocument();
    expect(mocked.loginUser).not.toHaveBeenCalled();
  });

  it('explains a duplicate email and links to sign-in with the pathway kept', async () => {
    mocked.signupUser.mockImplementation(() => laterReject(new api.ApiError('An account with this email already exists.', 409)));
    renderAt('/signup?pathway=saas');
    await fillAndSubmit('mo@example.com', 'secret1', /create account/i);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('An account with this email already exists.');
    expect(screen.getByRole('link', { name: 'Sign in instead' })).toHaveAttribute('href', '/login?pathway=saas');
    expect(screen.getByRole('button', { name: /create account/i })).not.toHaveAttribute('aria-busy');
  });

  it('explains wrong credentials and an unreachable server', async () => {
    mocked.loginUser.mockImplementationOnce(() => laterReject(new api.ApiError('Invalid email or password.', 401)));
    renderAt('/login');
    const user = await fillAndSubmit('mo@example.com', 'wrong', /^sign in$/i);
    expect(await screen.findByRole('alert')).toHaveTextContent("That email and password don't match.");

    mocked.loginUser.mockImplementationOnce(() => laterReject(new TypeError('Failed to fetch')));
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent("We can't reach Achivii right now.");
  });

  it('switches between the screens keeping pathway and next', () => {
    renderAt('/signup?pathway=saas&next=%2Froadmap&utm=x');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?pathway=saas&next=%2Froadmap');
  });
});
