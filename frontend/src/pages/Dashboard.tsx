import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCurrentUserGoal, fetchHealthCheck } from '../lib/api';
import { UserGoal } from '../types';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarView } from '../components/CalendarView';
import { 
  Calendar, 
  Settings, 
  TrendingUp, 
  ArrowRight, 
  Compass, 
  Loader2,
  AlertCircle
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchHealthCheck();
      setApiStatus('online');

      if (token) {
        try {
          const userGoalData = await fetchCurrentUserGoal(token);
          setActiveUserGoal(userGoalData.user_goal);
        } catch {
          setActiveUserGoal(null);
        }
      } else {
        setActiveUserGoal(null);
      }
    } catch (err: any) {
      setApiStatus('offline');
      setError(err.message || 'Unable to connect to the Achivii server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  return (
    <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7] relative">
      {/* Global Navigation */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {/* If user has an active goal */}
        {activeUserGoal && activeUserGoal.goal_catalog ? (
          <div className="space-y-6">
            {/* Top Instrumentation Panel: Cycle Telemetry */}
            <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#182621] space-y-4 shadow-none">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                      CYCLE TELEMETRY // ACTIVE BLUEPRINT
                    </span>
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-[9px] font-mono font-bold tracking-wider">
                      STATUS: ACTIVE
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold text-[#e5ebe7] truncate">
                    {activeUserGoal.goal_catalog.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-mono text-[#7e8f85]">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
                      STARTED: <strong className="text-[#e5ebe7] font-mono">{new Date(activeUserGoal.start_date).toLocaleDateString().toUpperCase()}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-[#07CB6C]" />
                      TARGET: <strong className="text-[#07CB6C] font-mono">{new Date(activeUserGoal.target_end_date).toLocaleDateString().toUpperCase()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-sm bg-[#080d0b] border border-[#182621] text-[10px] text-[#7e8f85]">
                      SLIPPAGE: {activeUserGoal.slippage_days > 0 ? `+${activeUserGoal.slippage_days} DAYS` : '0 DAYS [NOMINAL]'}
                    </span>
                  </div>
                </div>

                {/* Primary Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => navigate(`/onboarding?mode=adjust&goalId=${activeUserGoal.goal_catalog_id}`)}
                    className="min-h-[44px] px-3.5 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] text-xs font-mono border border-[#182621] hover:border-[#1f332c] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#7e8f85]" />
                    <span>ADJUST ROUTINE</span>
                  </button>
                  <button
                    onClick={() => navigate('/progress')}
                    className="min-h-[44px] px-3.5 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#07CB6C] text-xs font-mono border border-[#182621] hover:border-[#07CB6C]/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>PROGRESS</span>
                  </button>
                  <button
                    onClick={() => navigate('/schedule')}
                    className="min-h-[44px] px-4 py-2 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <div className="flex items-center justify-between border-b border-[#182621] pb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7e8f85]">
                  ROLLING AGENDA // 7-DAY EXECUTION GRID
                </span>
                <span className="text-[10px] font-mono text-[#55675c]">
                  TOUCH-OPTIMIZED & AUTO-COLLAPSING
                </span>
              </div>

              <CalendarView />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-md bg-[#0c1210] border border-[#ef4444]/40 p-8 text-center text-[#ef4444] space-y-4 shadow-none max-w-xl mx-auto">
            <div className="w-10 h-10 rounded-sm bg-[#161214] border border-[#ef4444]/30 flex items-center justify-center mx-auto text-[#ef4444]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#e5ebe7] uppercase font-mono">CONNECTION TELEMETRY FAILED</h3>
              <p className="text-xs font-mono text-[#a6b8ad]">{error}</p>
            </div>
            <button
              onClick={loadData}
              className="min-h-[44px] px-4 py-2 rounded-sm bg-[#080d0b] hover:bg-[#161214] text-[#e5ebe7] text-xs font-mono border border-[#182621] transition-colors cursor-pointer"
            >
              RETRY TELEMETRY
            </button>
          </div>
        ) : loading ? (
          <div className="rounded-md bg-[#0c1210] border border-[#182621] p-16 flex flex-col items-center justify-center text-[#7e8f85] gap-3 shadow-none">
            <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
            <span className="text-xs font-mono uppercase tracking-wider">RETRIEVING DASHBOARD TELEMETRY...</span>
          </div>
        ) : (
          /* No active goal: Guide user to select from catalog */
          <div className="rounded-md bg-[#0c1210] border border-[#182621] p-8 sm:p-12 text-center space-y-6 shadow-none max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-sm bg-[#111a17] border border-[#182621] text-[#07CB6C] flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                ACHIVII EXECUTION ENGINE
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#e5ebe7]">
                No Active Goal Plan Initialized
              </h2>
              <p className="text-xs sm:text-sm text-[#7e8f85] max-w-md mx-auto leading-relaxed">
                Choose a pre-scoped 3-month blueprint from our catalog to generate your tailored, time-blocked execution calendar.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/')}
                className="min-h-[44px] px-6 py-2.5 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
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
