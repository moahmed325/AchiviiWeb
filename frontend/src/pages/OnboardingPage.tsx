import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#070b09] text-white flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-[#07CB6C] selection:text-black">
      {/* Top Navbar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">
            Clean Slate • Goal Architecture
          </span>
        </div>
      </header>

      {/* Center Hero */}
      <main className="max-w-2xl w-full mx-auto text-center space-y-6 my-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/20 text-[#07CB6C] text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>First Principles Redesign</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
          Ready for the New Goal Setting System
        </h1>

        <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
          All legacy algorithms, hardcoded heuristics, and rigid prompts have been wiped clean.
          The canvas is clear to architect the definitive step-by-step experience from scratch.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/schedule"
            className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-xs tracking-wider uppercase hover:bg-neutral-200 transition-all shadow-lg"
          >
            View Schedule & Calendar
          </Link>
          <Link
            to="/dashboard"
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-neutral-300 font-semibold text-xs tracking-wider uppercase hover:bg-white/10 hover:text-white transition-all"
          >
            Open Dashboard
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center text-xs font-mono text-neutral-600">
        Achivii Life & Ambition Operating System • Clean Slate Mode
      </footer>
    </div>
  );
};

export default OnboardingPage;
