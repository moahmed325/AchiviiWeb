import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCatalog, fetchHealthCheck, fetchCurrentUserGoal } from '../lib/api';
import { GoalCatalog, UserGoal } from '../types';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { GoalCard } from '../components/GoalCard';
import { GoalDetailDrawer } from '../components/GoalDetailDrawer';
import { AuthModal } from '../components/AuthModal';
import { 
  Compass, 
  Layers, 
  RotateCcw, 
  CalendarClock, 
  Loader2, 
  Search, 
  ArrowRight,
  AlertCircle,
  Calendar,
  Settings,
  TrendingUp
} from 'lucide-react';
import { CalendarWeekView } from '../components/CalendarWeekView';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, openAuthModal } = useAuth();
  const [goals, setGoals] = useState<GoalCatalog[]>([]);
  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [dashboardTab, setDashboardTab] = useState<'schedule' | 'catalog'>('schedule');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  
  // Interactive UI states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectedGoal, setInspectedGoal] = useState<GoalCatalog | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Check API Health
      await fetchHealthCheck();
      setApiStatus('online');

      // 2. Fetch Goal Catalog
      const catalogData = await fetchCatalog();
      setGoals(catalogData);

      // 3. Fetch active user goal if authenticated
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

  const categories = ['All', ...Array.from(new Set(goals.map((g) => g.category)))];

  const filteredGoals = goals.filter((g) => {
    const matchesCategory = selectedCategory === 'All' || g.category === selectedCategory;
    const matchesSearch =
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleSelectGoal = (goal: GoalCatalog) => {
    if (!user) {
      openAuthModal('signup');
      return;
    }
    navigate(`/onboarding?goalId=${goal.id}`);
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7] relative">
      {/* Global Navbar */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10 space-y-10 sm:space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4 max-w-3xl mx-auto pt-2 sm:pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#0c1210] border border-[#182621] text-[#07CB6C] text-xs font-mono font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
            <span>Curated Goal Catalogs Active</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#e5ebe7] leading-tight">
            Master Any Goal with <br className="hidden sm:inline" />
            <span className="text-[#07CB6C]">Adaptive Execution</span>
          </h1>

          <p className="text-[#7e8f85] text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Ambitious goals fail because life interrupts rigid plans. Achivii pairs pre-scoped blueprints with an auto-rescheduling engine that adapts whenever sessions are missed.
          </p>

          {/* Quick Pillar Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2 text-xs text-[#a6b8ad]">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#0c1210] border border-[#182621] font-mono text-[11px]">
              <Compass className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>12-Week Blueprints</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#0c1210] border border-[#182621] font-mono text-[11px]">
              <CalendarClock className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Learns Mon–Sat Busy Blocks</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#0c1210] border border-[#182621] font-mono text-[11px]">
              <RotateCcw className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Adaptive Rescheduling</span>
            </div>
          </div>
        </section>

        {/* Active User Goal Header & Tab Switcher (If active goal exists) */}
        {activeUserGoal && activeUserGoal.goal_catalog && (
          <div className="space-y-6">
            <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#182621] space-y-4 shadow-none">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                      CYCLE TELEMETRY // ACTIVE BLUEPRINT
                    </span>
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-[9px] font-mono font-bold tracking-wider">
                      STATUS: ACTIVE
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#e5ebe7] truncate">
                    {activeUserGoal.goal_catalog.title}
                  </h2>
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

            {/* Dashboard View Tab Toggle */}
            <div className="flex items-center gap-2 border-b border-[#182621] pb-3">
              <button
                onClick={() => setDashboardTab('schedule')}
                className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-sm text-xs font-mono font-medium transition-colors cursor-pointer ${
                  dashboardTab === 'schedule'
                    ? 'bg-[#16221e] text-[#e5ebe7] border border-[#1f332c]'
                    : 'bg-[#080d0b] text-[#7e8f85] hover:text-[#e5ebe7] border border-[#182621]'
                }`}
              >
                <Calendar className="w-4 h-4 text-[#07CB6C]" />
                <span>ROLLING AGENDA // THIS WEEK</span>
              </button>

              <button
                onClick={() => setDashboardTab('catalog')}
                className={`min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-sm text-xs font-mono font-medium transition-colors cursor-pointer ${
                  dashboardTab === 'catalog'
                    ? 'bg-[#16221e] text-[#e5ebe7] border border-[#1f332c]'
                    : 'bg-[#080d0b] text-[#7e8f85] hover:text-[#e5ebe7] border border-[#182621]'
                }`}
              >
                <Layers className="w-4 h-4 text-[#07CB6C]" />
                <span>EXPLORE GOAL CATALOG</span>
              </button>
            </div>

            {/* If tab is 'schedule', render CalendarWeekView */}
            {dashboardTab === 'schedule' && (
              <div className="space-y-4">
                <CalendarWeekView />
              </div>
            )}
          </div>
        )}

        {/* Goal Catalog Section (Shown if tab is catalog or no active goal) */}
        {(!activeUserGoal || dashboardTab === 'catalog') && (
          <>
            {/* Filter and Search Bar */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Category Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-sm text-xs font-mono font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        selectedCategory === category
                          ? 'bg-[#16221e] text-[#e5ebe7] border border-[#1f332c]'
                          : 'bg-[#0c1210] text-[#7e8f85] hover:text-[#e5ebe7] border border-[#182621]'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-[#7e8f85] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 3-month goals..."
                    className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-sm bg-[#0c1210] border border-[#182621] text-[#e5ebe7] placeholder-[#55675c] text-base sm:text-xs font-mono focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-colors"
                  />
                </div>
              </div>
            </section>

            {/* Goal Catalog Content Grid */}
            <section className="space-y-6">
              {loading && (
                <div className="p-16 flex flex-col items-center justify-center text-[#7e8f85] gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
                  <span className="text-xs font-mono">Loading curated goal blueprints...</span>
                </div>
              )}

              {error && (
                <div className="p-8 rounded-md bg-[#0c1210] border border-rose-500/30 text-center space-y-4">
                  <div className="w-10 h-10 rounded-sm bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#e5ebe7]">Failed to connect to backend</h3>
                    <p className="text-xs font-mono text-rose-300/80 max-w-md mx-auto mt-1">{error}</p>
                  </div>
                  <button
                    onClick={loadData}
                    className="min-h-[44px] px-4 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#e5ebe7] text-xs font-mono border border-[#182621] transition-colors cursor-pointer"
                  >
                    Retry Connection
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length === 0 && (
                <div className="p-12 rounded-md bg-[#0c1210] border border-[#182621] text-center text-[#7e8f85] space-y-2">
                  <p className="text-xs font-mono">No goals matched your filter.</p>
                  <button
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }}
                    className="text-xs font-mono text-[#07CB6C] underline font-medium cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                  {filteredGoals.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      onInspect={(g) => setInspectedGoal(g)}
                      onSelect={(g) => handleSelectGoal(g)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Architectural Explainer & Value Proposition */}
        <section className="pt-8 border-t border-[#182621]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-3">
              <div className="w-8 h-8 rounded-sm bg-[#111a17] border border-[#182621] flex items-center justify-center text-[#07CB6C]">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-[#e5ebe7]">Pre-Scoped Blueprints</h4>
              <p className="text-xs text-[#7e8f85] leading-relaxed">
                No decision fatigue. Goals arrive pre-broken into three 4-week phases with concrete session lengths, frequencies, and optimal times of day.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-3">
              <div className="w-8 h-8 rounded-sm bg-[#111a17] border border-[#182621] flex items-center justify-center text-[#07CB6C]">
                <CalendarClock className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-[#e5ebe7]">Time-Blocked Routine Sync</h4>
              <p className="text-xs text-[#7e8f85] leading-relaxed">
                Define your existing commitments (Mon–Sat busy blocks). Achivii slots your goal sessions exclusively into genuine free time.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-3">
              <div className="w-8 h-8 rounded-sm bg-[#111a17] border border-[#182621] flex items-center justify-center text-[#07CB6C]">
                <RotateCcw className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-[#e5ebe7]">Adaptive Rescheduling</h4>
              <p className="text-xs text-[#7e8f85] leading-relaxed">
                Miss a session? The engine automatically re-places it later in the week or shifts the timeline without friction.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Slide-over Phase Inspection Drawer */}
      <GoalDetailDrawer
        goal={inspectedGoal}
        onClose={() => setInspectedGoal(null)}
        onSelect={(goal) => handleSelectGoal(goal)}
      />

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
};
