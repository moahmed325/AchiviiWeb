import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { GoalProvider } from '../context/GoalContext';
import * as api from '../lib/api';
import { ProtectedRoute } from './ProtectedRoute';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    fetchHealthCheck: vi.fn(),
    fetchCurrentUser: vi.fn(),
    fetchActiveGoal: vi.fn(),
  };
});

const mocked = vi.mocked(api);

const MOCK_USER = {
  id: 'u1',
  email: 'runner@example.com',
  name: 'Runner',
  created_at: '2026-09-21',
};

describe('ProtectedRoute (R1 — OD-9 / ND-12 Route Protection)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('achivii_auth_token', 'test-token');
    mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString(), service: 'achivii-api' });
    mocked.fetchCurrentUser.mockResolvedValue(MOCK_USER);
  });

  it('redirects to / instead of /onboarding when goal load fails', async () => {
    mocked.fetchActiveGoal.mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireGoal={true}>
                    <div>Dashboard Protected Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<div>Home Root Page</div>} />
              <Route path="/onboarding" element={<div>Onboarding Page</div>} />
            </Routes>
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>
    );

    // Should redirect to / so the user can see the error and retry, NOT /onboarding
    expect(await screen.findByText('Home Root Page')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding Page')).not.toBeInTheDocument();
  });

  it('redirects to /onboarding when active goal is genuinely null without error', async () => {
    mocked.fetchActiveGoal.mockResolvedValueOnce(null);

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireGoal={true}>
                    <div>Dashboard Protected Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<div>Home Root Page</div>} />
              <Route path="/onboarding" element={<div>Onboarding Page</div>} />
            </Routes>
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>
    );

    // Genuinely no goal -> redirect to /onboarding
    expect(await screen.findByText('Onboarding Page')).toBeInTheDocument();
    expect(screen.queryByText('Home Root Page')).not.toBeInTheDocument();
  });

  it('redirects signed-in user with an active goal from /onboarding to / instead of /dashboard', async () => {
    mocked.fetchActiveGoal.mockResolvedValueOnce({
      id: 'g1',
      userId: 'u1',
      rawGoal: 'Run a marathon',
      status: 'active',
      planVersion: 2,
    } as unknown as import('../types').Goal);

    render(
      <AuthProvider>
        <GoalProvider>
          <MemoryRouter initialEntries={['/onboarding']}>
            <Routes>
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requireGoal={false}>
                    <div>Onboarding Content</div>
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<div>Home Root Page</div>} />
            </Routes>
          </MemoryRouter>
        </GoalProvider>
      </AuthProvider>
    );

    expect(await screen.findByText('Home Root Page')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding Content')).not.toBeInTheDocument();
  });
});
