import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Target, LogOut, Calendar, LayoutDashboard, ArrowRight } from 'lucide-react';

interface NavbarProps {
  apiStatus: 'online' | 'offline' | 'checking';
}

export const Navbar: React.FC<NavbarProps> = ({ apiStatus }) => {
  const { user, logout, openAuthModal } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: 'Today', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Schedule', path: '/schedule', icon: Calendar },
    { name: 'Progress', path: '/progress', icon: Target },
  ];

  return (
    <>
      <header className="w-full border-b border-white/5 bg-[#070b09]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Desktop Navigation */}
          <div className="flex items-center gap-6 sm:gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none rounded-xl"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0c1410] to-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center transition-all group-hover:border-[#07CB6C]/60 shadow-[0_0_12px_rgba(7,203,108,0.15)]">
                <Target className="w-4 h-4 text-[#07CB6C]" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">Achivii</span>
            </Link>

            {/* Nav Tabs for authenticated users on desktop */}
            {user && (
              <nav className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                {navLinks.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = location.pathname === tab.path;
                  return (
                    <Link
                      key={tab.path}
                      to={tab.path}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#07CB6C]/15 text-[#07CB6C] font-semibold border border-[#07CB6C]/30 shadow-sm'
                          : 'text-neutral-400 hover:text-white border border-transparent'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#07CB6C]' : 'text-neutral-400'}`} />
                      <span>{tab.name}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right Actions: Offline Alert & User Auth */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Show only if offline */}
            {apiStatus === 'offline' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[11px] font-medium">Offline</span>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="w-5 h-5 rounded-full bg-[#07CB6C]/20 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C] font-mono text-[10px] font-bold">
                    {user.email.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-neutral-300 max-w-[140px] truncate hidden sm:inline text-xs font-medium">
                    {user.email}
                  </span>
                </div>
                <button
                  id="btn-logout"
                  onClick={logout}
                  title="Log out"
                  aria-label="Log out"
                  className="min-h-[36px] min-w-[36px] p-2 rounded-xl bg-white/5 border border-white/10 hover:border-rose-500/40 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer flex items-center justify-center"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="btn-signin-nav"
                  onClick={() => openAuthModal('signin')}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors rounded-xl cursor-pointer flex items-center"
                >
                  Sign In
                </button>
                <button
                  id="btn-getstarted-nav"
                  onClick={() => openAuthModal('signup')}
                  className="min-h-[38px] flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-xs font-semibold shadow-[0_0_15px_rgba(7,203,108,0.2)] transition-all cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Visible only on < 768px for authenticated users) */}
      {user && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b09]/90 backdrop-blur-xl border-t border-white/10 px-6 py-2 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
          {navLinks.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.pathname === tab.path;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center gap-1 py-1 px-4 rounded-xl text-[11px] font-medium transition-all ${
                  isActive
                    ? 'text-[#07CB6C] font-semibold scale-105'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#07CB6C]' : 'text-neutral-400'}`} />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
};
