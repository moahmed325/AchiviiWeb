import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import {
  Target,
  LogOut,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { formatGoalTitle } from '../lib/formatters';
import { PathwaysExplorerModal } from './PathwaysExplorerModal';

interface NavbarProps {
  apiStatus?: 'online' | 'offline' | 'checking';
}

export const Navbar: React.FC<NavbarProps> = ({ apiStatus: propApiStatus }) => {
  const { user, logout } = useAuth();
  const { activeGoal, resetGoal, apiStatus: contextApiStatus } = useGoal();
  const location = useLocation();
  const navigate = useNavigate();

  const apiStatus = propApiStatus || contextApiStatus;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isPathwaysModalOpen, setIsPathwaysModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Home link destination: always root '/'
  const homeLink = '/';

  const handleResetPlan = async () => {
    if (!window.confirm('Are you sure you want to reset your 90-day plan? All task progress will be cleared.')) {
      return;
    }
    setIsResetting(true);
    const success = await resetGoal();
    setIsResetting(false);
    setIsMenuOpen(false);
    if (success) {
      navigate('/onboarding');
    }
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
    // The router applies navigation as a transition. Clearing the session in the same transition means no render sees
    // a protected page without a user, which would redirect to /login instead of the landing page.
    React.startTransition(() => {
      logout();
      navigate('/');
    });
  };

  const isTodayActive = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <header className="w-full border-b border-white/5 bg-[#050807]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-6">
          <Link
            to={homeLink}
            className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none"
          >
            <div className="w-7 h-7 rounded-md bg-[#0c1410] border border-[#07CB6C]/30 flex items-center justify-center transition-all group-hover:border-[#07CB6C]/60">
              <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">Achivii</span>
          </Link>

          {/* Navigation Tabs (Only visible when user has an active goal) */}
          {user && activeGoal && (
            <nav className="hidden sm:flex items-center gap-1.5" aria-label="Main Navigation">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  isTodayActive
                    ? 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/25 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>Today</span>
              </Link>

              <Link
                to="/roadmap"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                  location.pathname === '/roadmap'
                    ? 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/25 shadow-xs'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span>Roadmap</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsPathwaysModalOpen(true)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent"
              >
                <Sparkles className="w-3 h-3 text-[#07CB6C]" />
                <span>Pathways (10)</span>
              </button>
            </nav>
          )}
        </div>

        {/* Mobile Navigation Tabs (Shown under top bar if needed or compact in bar) */}
        {user && activeGoal && (
          <div className="flex sm:hidden items-center gap-1">
            <Link
              to="/"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                isTodayActive
                  ? 'bg-[#07CB6C]/15 text-[#07CB6C]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Today
            </Link>
            <Link
              to="/roadmap"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                location.pathname === '/roadmap'
                  ? 'bg-[#07CB6C]/15 text-[#07CB6C]'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Roadmap
            </Link>
            <button
              type="button"
              onClick={() => setIsPathwaysModalOpen(true)}
              className="px-2 py-1 rounded text-xs font-medium transition-colors text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-2.5 h-2.5 text-[#07CB6C]" />
              <span>Goals</span>
            </button>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Offline indicator — only shown when offline */}
          {apiStatus === 'offline' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[11px] font-medium">Offline</span>
            </div>
          )}

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-md hover:bg-white/5 border border-white/5 hover:border-white/10 transition-colors cursor-pointer focus-visible:outline-none"
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
              >
                <span className="w-6 h-6 rounded-full bg-[#07CB6C]/15 border border-[#07CB6C]/25 flex items-center justify-center text-[#07CB6C] font-mono text-[10px] font-bold">
                  {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {/* Profile / Settings Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[#0c1210] border border-[#1a2824] rounded-md shadow-xl py-1.5 z-50 animate-fadeIn">
                  <div className="px-3.5 py-2 border-b border-[#1a2824]/80">
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-mono">
                      Signed in as
                    </p>
                    <p className="text-xs text-white font-medium truncate mt-0.5">
                      {user.email}
                    </p>
                    {activeGoal && (
                      <p className="text-[11px] text-[#07CB6C] truncate mt-1">
                        Week {activeGoal.currentWeek || 1} • {formatGoalTitle(activeGoal.clarifiedOutcome, activeGoal.rawGoal)}
                      </p>
                    )}
                  </div>

                  <div className="py-1 border-b border-[#1a2824]/80">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsPathwaysModalOpen(true);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs text-neutral-300 hover:text-[#07CB6C] hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                      <span>Explore 10 Pathways</span>
                    </button>
                  </div>

                  {activeGoal && (
                    <div className="py-1 border-b border-[#1a2824]/80">
                      <button
                        type="button"
                        disabled={isResetting}
                        onClick={handleResetPlan}
                        className="w-full px-3.5 py-2 text-left text-xs text-neutral-300 hover:text-amber-400 hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span>{isResetting ? 'Resetting...' : 'Reset 90-Day Plan'}</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full px-3.5 py-2 text-left text-xs text-neutral-300 hover:text-rose-400 hover:bg-white/5 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                id="btn-signin-nav"
                to="/login"
                className="min-h-[36px] inline-flex items-center px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors rounded-md cursor-pointer"
              >
                Sign In
              </Link>
              <Link
                id="btn-getstarted-nav"
                to="/signup"
                className="min-h-[36px] inline-flex items-center px-4 py-1.5 rounded-md bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-xs font-semibold transition-all cursor-pointer"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pathways Explorer Modal Accessible Globally from Navbar */}
      <PathwaysExplorerModal
        isOpen={isPathwaysModalOpen}
        onClose={() => setIsPathwaysModalOpen(false)}
        activeGoalTitle={activeGoal?.rawGoal}
      />
    </header>
  );
};

export default Navbar;
