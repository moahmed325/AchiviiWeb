import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { OnboardingPage } from './pages/OnboardingPage';
import { SchedulePage } from './pages/SchedulePage';
import { ProgressPage } from './pages/ProgressPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-[100dvh] w-full bg-[#050807] text-[#e5ebe7] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] overscroll-contain">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/progress" element={<ProgressPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
