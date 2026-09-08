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
  CheckCircle2, 
  Loader2, 
  Search, 
  Sparkles,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[400px] right-[-100px] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Global Navbar */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-5 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Phase 1: Curated Goal Catalog Active
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.15]">
            Master Any Goal in <br className="hidden sm:inline" />
            <span className="gradient-text">3 Adaptive Months</span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Ambitious goals fail because life interrupts rigid plans. Achivii pairs pre-scoped blueprints with an auto-rescheduling engine that adapts whenever sessions are missed.
          </p>

          {/* Quick Pillar Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-2 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Pre-Scoped 12-Week Blueprints</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <CalendarClock className="w-3.5 h-3.5 text-purple-400" />
              <span>Learns Mon–Sat Busy Blocks</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <RotateCcw className="w-3.5 h-3.5 text-pink-400" />
              <span>Zero-Fail Missed Session Recovery</span>
            </div>
          </div>
        </section>

        {/* Active User Goal Header & Tab Switcher (If active goal exists) */}
        {activeUserGoal && activeUserGoal.goal_catalog && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/40 to-slate-950/80 border border-indigo-500/40 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active 3-Month Goal
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {activeUserGoal.goal_catalog.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      Started: <strong className="text-white font-mono">{new Date(activeUserGoal.start_date).toLocaleDateString()}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Graduation Target: <strong className="text-emerald-300 font-mono">{new Date(activeUserGoal.target_end_date).toLocaleDateString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
                      Slippage: {activeUserGoal.slippage_days} days
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/onboarding?mode=adjust&goalId=${activeUserGoal.goal_catalog_id}`)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-semibold border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Adjust Routine</span>
                  </button>
                  <button
                    onClick={() => navigate('/progress')}
                    className="px-3.5 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 hover:text-white text-xs font-semibold border border-purple-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    <span>Progress</span>
                  </button>
                  <button
                    onClick={() => navigate('/schedule')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Full Schedule</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard View Tab Toggle */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setDashboardTab('schedule')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dashboardTab === 'schedule'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>This Week's Schedule</span>
              </button>

              <button
                onClick={() => setDashboardTab('catalog')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  dashboardTab === 'catalog'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Explore Other Goals</span>
              </button>
            </div>

            {/* If tab is 'schedule', render CalendarWeekView */}
            {dashboardTab === 'schedule' && (
              <div className="space-y-4 animate-in fade-in duration-300">
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
                      className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        selectedCategory === category
                          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                          : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 3-month goals..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </section>

            {/* Goal Catalog Content Grid */}
            <section className="space-y-6">
              {loading && (
                <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <span className="text-sm font-medium">Loading curated goal blueprints...</span>
                </div>
              )}

              {error && (
                <div className="p-8 rounded-2xl glass-panel border border-rose-500/30 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Failed to connect to backend</h3>
                    <p className="text-xs text-rose-300/80 max-w-md mx-auto mt-1">{error}</p>
                  </div>
                  <button
                    onClick={loadData}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                  >
                    Retry Connection
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length === 0 && (
                <div className="p-12 rounded-2xl glass-panel text-center text-slate-400 space-y-2">
                  <p className="text-sm">No goals matched your filter.</p>
                  <button
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }}
                    className="text-xs text-indigo-400 underline font-medium"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <section className="pt-8 border-t border-slate-800/80">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl space-y-3 border border-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Pre-Scoped Blueprints</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                No decision fatigue. Goals arrive pre-broken into three 4-week phases with concrete session lengths, frequencies, and optimal times of day.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl space-y-3 border border-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <CalendarClock className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Time-Blocked Routine Sync</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Define your existing commitments (Mon–Sat busy blocks). Achivii slots your goal sessions exclusively into genuine free time.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl space-y-3 border border-slate-800/80">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">Adaptive Rescheduling</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Miss a workout or coding sprint? The engine automatically re-places it later in the week or extends the timeline without friction.
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
