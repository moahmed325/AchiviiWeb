import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GoalProvider } from './context/GoalContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { DashboardPage } from './pages/DashboardPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { OnboardingPage } from './pages/OnboardingPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <GoalProvider>
        <BrowserRouter>
          <div className="min-h-[100dvh] w-full bg-[#050807] text-[#e5ebe7] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overscroll-contain">
            <Navbar />
            <AuthModal />

            <div className="flex-1 flex flex-col">
              <Routes>
                {/* Public Landing Page */}
                <Route path="/" element={<Home />} />

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

                {/* Fallback to root */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

            <footer className="text-center text-xs text-neutral-600 py-6 border-t border-white/5">
              Achivii © {new Date().getFullYear()}
            </footer>
          </div>
        </BrowserRouter>
      </GoalProvider>
    </AuthProvider>
  );
};

export default App;
