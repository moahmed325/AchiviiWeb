import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { ArrowRight } from 'lucide-react';

export const Home: React.FC = () => {
  const { user, token, loading: authLoading, openAuthModal } = useAuth();
  const { activeGoal, loadingGoal } = useGoal();

  // If user is logged in, redirect them seamlessly to their active space
  if (user && token) {
    if (loadingGoal || authLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-4 animate-fadeIn">
          <div className="w-8 h-8 border-2 border-[#07CB6C]/30 border-t-[#07CB6C] rounded-full animate-spin" />
          <p className="text-xs text-neutral-400">Loading your plan...</p>
        </div>
      );
    }

    if (activeGoal) {
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/onboarding" replace />;
  }

  return (
    <main className="flex-1 flex flex-col justify-center py-12 sm:py-20 animate-fadeIn">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Achieve any goal in <span className="text-[#07CB6C]">90 days</span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 max-w-lg mx-auto leading-relaxed">
              Tell us what you want to accomplish. We'll create a personalized daily plan that fits your schedule and adapts as you go.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="w-full sm:w-auto px-7 py-3.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.98] text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started — It's Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-md bg-[#0c1210] hover:bg-[#16221e] border border-[#1a2824] text-neutral-300 font-medium text-sm transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
