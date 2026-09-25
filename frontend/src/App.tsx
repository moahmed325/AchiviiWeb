import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GoalProvider } from './context/GoalContext';
import { AppShell } from './components/app/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { RoadmapPage } from './pages/RoadmapPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SignupPage } from './pages/auth/SignupPage';
import { LoginPage } from './pages/auth/LoginPage';

/* Development-only primitives preview; the branch is dropped from production builds. */
const UiPreviewPage = import.meta.env.DEV ? React.lazy(() => import('./pages/dev/UiPreviewPage')) : null;

export const DashboardRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', search: location.search, hash: location.hash }} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <GoalProvider>
        <BrowserRouter>
          <AppShell previewPath={UiPreviewPage ? '/__ui' : undefined}>
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<Home />} />

              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />

              {/* Onboarding / Plan Creation (Protected, only for users without active plan) */}
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute requireGoal={false}>
                    <OnboardingPage />
                  </ProtectedRoute>
                }
              />

              {/* Legacy dashboard route redirects to / preserving query and hash (OD-3) */}
              <Route path="/dashboard" element={<DashboardRedirect />} />

              {/* Dedicated 90-Day Roadmap (Protected, requires active plan) */}
              <Route
                path="/roadmap"
                element={
                  <ProtectedRoute requireGoal={true}>
                    <RoadmapPage />
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
