import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GoalProvider } from './context/GoalContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { DashboardPage } from './pages/DashboardPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SignupPage } from './pages/auth/SignupPage';
import { LoginPage } from './pages/auth/LoginPage';

/* Development-only primitives preview; the branch is dropped from production builds. */
const UiPreviewPage = import.meta.env.DEV ? React.lazy(() => import('./pages/dev/UiPreviewPage')) : null;

const AUTH_ROUTES = ['/signup', '/login'];

/** The signed-out landing page and the auth screens bring their own navigation. */
const AppShell: React.FC = () => {
  const { pathname } = useLocation();
  const { token } = useAuth();
  const isMarketing = pathname === '/' && !token;
  const isChromeless =
    isMarketing || AUTH_ROUTES.includes(pathname) || (UiPreviewPage !== null && pathname === '/__ui');

  return (
    <div
      className={`min-h-[100dvh] w-full flex flex-col overscroll-contain ${
        isChromeless
          ? 'bg-background text-text'
          : 'bg-[#050807] text-[#e5ebe7] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
      }`}
    >
      {!isChromeless && <Navbar />}

      <div className="flex-1 flex flex-col">
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

          {/* Daily Execution Dashboard (Protected, requires active plan) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireGoal={true}>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

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
      </div>

      {!isChromeless && (
        <footer className="text-center text-xs text-neutral-600 py-6 border-t border-white/5">
          Achivii © {new Date().getFullYear()}
        </footer>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <GoalProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </GoalProvider>
    </AuthProvider>
  );
};

export default App;
