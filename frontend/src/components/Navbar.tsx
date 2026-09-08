import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Target, LogOut, Sparkles, Calendar, TrendingUp, LayoutDashboard } from 'lucide-react';

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
    <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link to="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Target className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">Achivii</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wide">
                  Engine
                </span>
              </div>
            </div>
          </Link>

          {/* Nav Tabs for authenticated users */}
          {user && (
            <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
              {navLinks.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.path;
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{tab.name}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right Actions: API health & User Auth */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Subtle API Health Status */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                apiStatus === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : apiStatus === 'offline'
                  ? 'bg-rose-500'
                  : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-400 font-mono text-[11px]">
              {apiStatus === 'online' ? 'API 200' : apiStatus === 'offline' ? 'API Offline' : 'Connecting'}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[10px]">
                  {user.email.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-slate-300 font-medium max-w-[140px] truncate hidden sm:inline">
                  {user.email}
                </span>
              </div>
              <button
                id="btn-logout"
                onClick={logout}
                title="Log out"
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="btn-signin-nav"
                onClick={() => openAuthModal('signin')}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                id="btn-getstarted-nav"
                onClick={() => openAuthModal('signup')}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
