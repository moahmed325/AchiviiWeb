import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GoalProvider } from './context/GoalContext';
import { AppShell } from './components/app/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';

/* Route-level code-splitting for secondary flows (M12.5) to keep initial bundle lean. */
/* B-19: the Dashboard is a secondary screen too; Today (Home) stays in the main bundle. */
const Dashboard = React.lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'));
const RoadmapPage = React.lazy(() => import('./pages/RoadmapPage'));
const SignupPage = React.lazy(() => import('./pages/auth/SignupPage'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
/* B-15: password reset. */
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/PasswordResetPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/PasswordResetPages').then((m) => ({ default: m.ResetPasswordPage })));

/* Development-only primitives preview; the branch is dropped from production builds. */
const UiPreviewPage = import.meta.env.DEV ? React.lazy(() => import('./pages/dev/UiPreviewPage')) : null;

/* Dedicated Progress page (ND-8 Option A). Lazy-loaded to keep the main bundle lean. */
const ProgressPage = React.lazy(() => import('./pages/ProgressPage'));

/* Dedicated Achievement page (M9.3). Lazy-loaded to keep the main bundle lean. */
const AchievementPage = React.lazy(() => import('./pages/AchievementPage'));
const CheckoutReturnPage = React.lazy(() => import('./pages/CheckoutReturnPage'));

/* Public legal/support pages (store review readiness). */
const LegalPage = React.lazy(() => import('./pages/LegalPage'));


export const DashboardRedirect: React.FC = () => { const location = useLocation(); return <Navigate to={{ pathname: '/', search: location.search, hash: location.hash }} replace />; };

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <GoalProvider>
        <BrowserRouter>
          <AppShell previewPath={UiPreviewPage ? '/__ui' : undefined}>
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<Home />} />

              <Route
                path="/signup"
                element={
                  <React.Suspense fallback={null}>
                    <SignupPage />
                  </React.Suspense>
                }
              />
              <Route
                path="/login"
                element={
                  <React.Suspense fallback={null}>
                    <LoginPage />
                  </React.Suspense>
                }
              />
              <Route path="/forgot-password" element={<React.Suspense fallback={null}><ForgotPasswordPage /></React.Suspense>} />
              <Route path="/reset-password" element={<React.Suspense fallback={null}><ResetPasswordPage /></React.Suspense>} />

              {/* Onboarding: open to visitors (ND-28), who sign up from its last page */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requireGoal={false} allowAnonymous>
                    <React.Suspense fallback={null}>
                      <OnboardingPage />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Dashboard: the user's home base, separate from daily execution. */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requireGoal={true}>
                    <React.Suspense fallback={null}>
                      <Dashboard />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Dedicated 90-Day Roadmap (Protected, requires active plan) */}
              <Route
                path="/roadmap"
                element={
                  <ProtectedRoute requireGoal={true}>
                    <React.Suspense fallback={null}>
                      <RoadmapPage />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Dedicated Progress page (ND-8 Option A, M8.2) */}
              <Route
                path="/progress"
                element={
                  <ProtectedRoute requireGoal={false}>
                    <React.Suspense fallback={null}>
                      <ProgressPage />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />

              {/* Billing return: provider redirect is never treated as payment proof. */}
              <Route path="/billing/return" element={<React.Suspense fallback={null}><CheckoutReturnPage /></React.Suspense>} />

              {/* Public legal/support pages. */}
              <Route path="/legal/:doc" element={<React.Suspense fallback={null}><LegalPage /></React.Suspense>} />
              {/* Dedicated Achievement Destination (Protected, requires goal, M9.3) */}
              <Route
                path="/achievement"
                element={
                  <ProtectedRoute requireGoal={true}>
                    <React.Suspense fallback={null}>
                      <AchievementPage />
                    </React.Suspense>
                  </ProtectedRoute>
                }
              />

              {UiPreviewPage && (
                <Route
                  path="/__ui"
                  element={
                    <React.Suspense fallback={null}>
                      <UiPreviewPage />
                    </React.Suspense>
                  }
                />
              )}

              {/* Fallback to root */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </GoalProvider>
    </AuthProvider>
  );
};

export default App;
