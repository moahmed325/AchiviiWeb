import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Home } from './pages/Home';
import { OnboardingPage } from './pages/OnboardingPage';
import { SchedulePage } from './pages/SchedulePage';
import { ProgressPage } from './pages/ProgressPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/progress" element={<ProgressPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
