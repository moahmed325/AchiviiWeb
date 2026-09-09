import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Target, LogOut, Calendar, TrendingUp, LayoutDashboard, ArrowRight } from 'lucide-react';

interface NavbarProps {
  apiStatus: 'online' | 'offline' | 'checking';
}

export const Navbar: React.FC<NavbarProps> = ({ apiStatus }) => {
  const { user, logout, openAuthModal } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Schedule', path: '/schedule', icon: Calendar },
    { name: 'Progress', path: '/progress', icon: TrendingUp },
  ];

  return (
    <header className="w-full border-b border-[#1a2824] bg-[#0c1210]/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-5 sm:gap-7">
          <Link
            to="/"
            className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#07CB6C] rounded-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-[#0d1412] border border-[#1a2824] flex items-center justify-center transition-colors group-hover:border-[#07CB6C]/40">
              <Target className="w-4 h-4 text-[#07CB6C]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-tight text-white">Achivii</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20 uppercase tracking-wider">
                ENGINE
              </span>
            </div>
          </Link>

          {/* Nav Tabs for authenticated users */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 bg-[#0a0f0d] p-1 rounded-lg border border-[#1a2824]">
              {navLinks.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.path;
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors ${
                      isActive
                        ? 'bg-[#131f1b] text-white border border-[#07CB6C]/30'
                        : 'text-neutral-400 hover:text-white hover:bg-[#0d1412] border border-transparent'
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

        {/* Right Actions: API health & User Auth */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Subtle API Health Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0a0f0d] border border-[#1a2824] text-xs font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                apiStatus === 'online'
                  ? 'bg-[#07CB6C]'
                  : apiStatus === 'offline'
                  ? 'bg-rose-500'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-neutral-400 text-[11px]">
              {apiStatus === 'online' ? 'API 200' : apiStatus === 'offline' ? 'API Offline' : 'Connecting'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0a0f0d] border border-[#1a2824] text-xs font-mono">
                <span className="w-5 h-5 rounded bg-[#131f1b] border border-[#1a2824] flex items-center justify-center text-[#07CB6C] font-mono text-[10px] font-bold">
                  {user.email.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-neutral-300 max-w-[130px] truncate hidden sm:inline">
                  {user.email}
                </span>
              </div>
              <button
                id="btn-logout"
                onClick={logout}
                title="Log out"
                aria-label="Log out"
                className="min-h-[36px] min-w-[36px] p-2 rounded-lg bg-[#0a0f0d] border border-[#1a2824] hover:border-rose-500/40 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer flex items-center justify-center"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-signin-nav"
                onClick={() => openAuthModal('signin')}
                className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors rounded-lg cursor-pointer flex items-center"
              >
                Sign In
              </button>
              <button
                id="btn-getstarted-nav"
                onClick={() => openAuthModal('signup')}
                className="min-h-[40px] flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-medium transition-colors cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
