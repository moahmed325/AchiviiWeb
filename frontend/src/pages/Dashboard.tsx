import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarView } from '../components/CalendarView';
import { fetchCurrentUserGoal, fetchHealthCheck } from '../lib/api';
import { UserGoal } from '../types';
import {
  Calendar,
  TrendingUp,
  Settings,
  ArrowRight,
  AlertCircle,
  Loader2,
  Compass
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [goalRes] = await Promise.all([
        fetchCurrentUserGoal(token),
        fetchHealthCheck()
          .then(() => setApiStatus('online'))
          .catch(() => setApiStatus('offline')),
      ]);
      setActiveUserGoal(goalRes.user_goal);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Achivii engine.');
      setApiStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white relative min-h-screen">
      {/* Global Navigation */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {/* If user has an active goal */}
        {activeUserGoal && activeUserGoal.goal_catalog ? (
          <div className="space-y-6">
            {/* Top Instrumentation Panel: Cycle Telemetry */}
            <div className="p-5 sm:p-6 rounded-2xl bg-[#0a0f0d] border border-[#1a2824] space-y-4 shadow-2xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#07CB6C]">
                      CYCLE TELEMETRY // ACTIVE BLUEPRINT
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-[10px] font-mono font-medium tracking-wider">
                      STATUS: ACTIVE
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight truncate">
                    {activeUserGoal.goal_catalog.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
                      STARTED: <strong className="text-white font-mono">{new Date(activeUserGoal.start_date).toLocaleDateString().toUpperCase()}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#07CB6C]" />
                      TARGET: <strong className="text-[#07CB6C] font-mono">{new Date(activeUserGoal.target_end_date).toLocaleDateString().toUpperCase()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#0d1412] border border-[#1a2824] text-[10px] text-neutral-400">
                      SLIPPAGE: {activeUserGoal.slippage_days > 0 ? `+${activeUserGoal.slippage_days} DAYS` : '0 DAYS [NOMINAL]'}
                    </span>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => navigate(`/onboarding?mode=adjust&goalId=${activeUserGoal.goal_catalog_id}`)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white text-xs font-mono border border-[#1a2824] hover:border-[#2a3e38] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-neutral-400" />
                    <span>ADJUST ROUTINE</span>
                  </button>
                  <button
                    onClick={() => navigate('/progress')}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#0d1412] hover:bg-[#131f1b] text-[#07CB6C] text-xs font-mono border border-[#1a2824] hover:border-[#07CB6C]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>PROGRESS</span>
                  </button>
                  <button
                    onClick={() => navigate('/schedule')}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)]"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>12-WEEK SCHEDULE</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar Schedule Grid Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#1a2824] pb-2">
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400">
                  ROLLING AGENDA // 7-DAY EXECUTION GRID
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  TOUCH-OPTIMIZED & AUTO-COLLAPSING
                </span>
              </div>

              <CalendarView />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-[#0a0f0d] border border-rose-500/40 p-8 text-center text-rose-400 space-y-4 shadow-2xl max-w-xl mx-auto">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white uppercase font-mono">CONNECTION TELEMETRY FAILED</h3>
              <p className="text-xs font-mono text-neutral-400">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0d1412] hover:bg-[#131f1b] text-white text-xs font-mono border border-[#1a2824] transition-colors cursor-pointer"
            >
              RETRY TELEMETRY
            </button>
          </div>
        ) : loading ? (
          <div className="rounded-2xl bg-[#0a0f0d] border border-[#1a2824] p-16 flex flex-col items-center justify-center text-neutral-400 gap-3 shadow-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
            <span className="text-xs font-mono uppercase tracking-wider">RETRIEVING DASHBOARD TELEMETRY...</span>
          </div>
        ) : (
          /* No active goal: Guide user to select from catalog */
          <div className="rounded-2xl bg-[#0a0f0d] border border-[#1a2824] p-8 sm:p-12 text-center space-y-6 shadow-2xl max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-xl bg-[#0d1412] border border-[#1a2824] text-[#07CB6C] flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#07CB6C]">
                ACHIVII EXECUTION ENGINE
              </span>
              <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                No Active Goal Plan Initialized
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                Choose a pre-scoped 3-month blueprint from our catalog to generate your tailored, time-blocked execution calendar.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/')}
                className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-medium inline-flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)]"
              >
                <span>EXPLORE GOAL CATALOG</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
