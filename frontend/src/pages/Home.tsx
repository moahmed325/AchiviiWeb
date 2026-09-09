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
  Loader2,
  Search, 
  ArrowRight,
  AlertCircle,
  Calendar,
  Settings,
  TrendingUp,
  Cpu,
  ShieldCheck,
  Clock,
  CheckCircle2
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

  const handleScrollToCatalog = () => {
    const catalogEl = document.getElementById('catalog-section');
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7] relative">
      {/* Global Navbar */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10 space-y-12 sm:space-y-16">
        {/* Unauthenticated Landing Experience / Public View */}
        {!activeUserGoal && (
          <section className="space-y-6 max-w-4xl mx-auto pt-2 sm:pt-4 text-center">
            {/* Overhead Monospace Telemetry Chip */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#0c1210] border border-[#182621] text-[#07CB6C] text-xs font-mono font-medium tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              <span>SYSTEM SPEC // 12-WEEK RESILIENT CADENCE</span>
            </div>

            {/* Stark High-Contrast Headline (Zero Gradient Text) */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#e5ebe7] leading-[1.15]">
              Deterministic 90-Day <br className="hidden sm:inline" />
              Execution Engine
            </h1>

            {/* Engineering Rationale & Copy */}
            <p className="text-[#7e8f85] text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-mono">
              Ambitious goals fail because life interrupts rigid plans. Achivii pairs pre-scoped blueprints with a 3-tier deterministic recovery engine that adapts your calendar whenever sessions are missed.
            </p>

            {/* Primary & Secondary Call to Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    openAuthModal('signup');
                  } else {
                    handleScrollToCatalog();
                  }
                }}
                className="min-h-[44px] px-6 py-2.5 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>INITIALIZE GOAL</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleScrollToCatalog}
                className="min-h-[44px] px-5 py-2.5 rounded-sm bg-[#0c1210] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] border border-[#182621] hover:border-[#1f332c] text-xs font-mono font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#07CB6C]" />
                <span>EXPLORE BLUEPRINT CATALOG</span>
              </button>
            </div>

            {/* Workbench Telemetry Status Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-4 text-xs font-mono text-left">
              <div className="p-3 rounded-sm bg-[#0c1210] border border-[#182621] space-y-0.5">
                <span className="text-[9px] text-[#55675c] block uppercase">BLUEPRINT REPOSITORY</span>
                <span className="text-xs font-bold text-[#e5ebe7]">{goals.length || 6} CURATED SCHEMAS</span>
              </div>

              <div className="p-3 rounded-sm bg-[#0c1210] border border-[#182621] space-y-0.5">
                <span className="text-[9px] text-[#55675c] block uppercase">EXECUTION HORIZON</span>
                <span className="text-xs font-bold text-[#e5ebe7]">12 WEEKS // 84 DAYS</span>
              </div>

              <div className="p-3 rounded-sm bg-[#0c1210] border border-[#182621] space-y-0.5">
                <span className="text-[9px] text-[#55675c] block uppercase">RECOVERY ENGINE</span>
                <span className="text-xs font-bold text-[#07CB6C]">3-TIER ADAPTIVE</span>
              </div>

              <div className="p-3 rounded-sm bg-[#0c1210] border border-[#182621] space-y-0.5">
                <span className="text-[9px] text-[#55675c] block uppercase">SYSTEM FAIL-SAFE</span>
                <span className="text-xs font-bold text-[#e5ebe7]">0 CORE DROPPED</span>
              </div>
            </div>

            {/* The Workbench Preview Window Mockup */}
            <div className="w-full rounded-md bg-[#0c1210] border border-[#182621] shadow-none overflow-hidden text-left mt-6">
              {/* Window Titlebar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#080d0b] border-b border-[#182621]">
                <div className="flex items-center gap-2">
                  {/* Window dot controls */}
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/70 border border-[#ef4444]/90" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/70 border border-[#f59e0b]/90" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#07CB6C]/70 border border-[#07CB6C]/90" />
                  </div>
                  <span className="text-[10px] font-mono text-[#55675c] ml-2 select-none tracking-wide">
                    achivii-workbench // live-cycle-preview
                  </span>
                </div>

                {/* Real-time telemetry badge */}
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#16221e] border border-[#1f332c] text-[9px] font-mono font-bold text-[#07CB6C]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                  <span>O(1) TIMELINE RECOVERY: 0 CORE BLOCKS DROPPED</span>
                </div>
              </div>

              {/* Mobile-only Telemetry Badge */}
              <div className="sm:hidden px-3.5 py-1.5 bg-[#080d0b] border-b border-[#182621] flex items-center justify-between text-[9px] font-mono font-bold text-[#07CB6C]">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                  <span>O(1) RECOVERY ENGINE</span>
                </span>
                <span className="text-[#a6b8ad]">0 BLOCKS DROPPED</span>
              </div>

              {/* Mockup Body: Sample Rolling Week Schedule */}
              <div className="p-3.5 sm:p-5 space-y-3 font-mono">
                <div className="flex flex-wrap items-center justify-between text-[10px] text-[#7e8f85] border-b border-[#182621] pb-2.5 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#07CB6C] font-bold">CYCLE: WEEK 04</span>
                    <span className="text-[#55675c]">//</span>
                    <span className="text-[#e5ebe7]">STAGE 1: FOUNDATION ARCHITECTURE</span>
                  </div>
                  <div className="text-[#07CB6C] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                    <span>3/3 SESSIONS ALIGNED</span>
                  </div>
                </div>

                {/* 3 Day Columns Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {/* Day 1: Completed [CORE] block */}
                  <div className="p-3 rounded-sm bg-[#080d0b] border border-[#182621] space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#e5ebe7] font-bold">TUE 18:00</span>
                      <span className="px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 text-[9px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>VERIFIED</span>
                      </span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-[#07CB6C] text-[#050807] space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider">
                        <span>[CORE] SESSION 10</span>
                        <span>90 MIN</span>
                      </div>
                      <div className="text-xs font-bold leading-tight line-clamp-1">
                        Schema Migration & Data Models
                      </div>
                      <div className="text-[9px] font-medium opacity-90">
                        Phase 1: Foundation • Completed
                      </div>
                    </div>
                  </div>

                  {/* Day 2: Active [CORE] block */}
                  <div className="p-3 rounded-sm bg-[#080d0b] border border-[#1f332c] space-y-2 relative">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#e5ebe7] font-bold">THU 19:30</span>
                      <span className="px-1.5 py-0.5 rounded-sm bg-[#16221e] text-[#07CB6C] border border-[#07CB6C]/50 text-[9px] font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                        <span>READY TO EXECUTE</span>
                      </span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-[#0c1210] border border-[#07CB6C] text-[#e5ebe7] space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#07CB6C]">
                        <span>[CORE] SESSION 11</span>
                        <span className="text-[#a6b8ad]">90 MIN</span>
                      </div>
                      <div className="text-xs font-bold leading-tight line-clamp-1 text-white">
                        API Endpoints & Integration Tests
                      </div>
                      <div className="text-[9px] text-[#7e8f85]">
                        Target: 19:30 – 21:00 • In Window
                      </div>
                    </div>
                  </div>

                  {/* Day 3: Dashed open [BUFFER] slot */}
                  <div className="p-3 rounded-sm bg-[#080d0b] border border-dashed border-[#2a443a] space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#7e8f85] font-bold">SAT 10:00</span>
                      <span className="px-1.5 py-0.5 rounded-sm bg-[#0c1210] text-[#7e8f85] border border-[#182621] text-[9px]">
                        DYNAMIC RESERVED
                      </span>
                    </div>
                    <div className="p-2.5 rounded-sm bg-[#0c1210]/60 border border-dashed border-[#1f332c] text-[#7e8f85] space-y-1">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-[#7e8f85]">
                        <span>[BUFFER] RESILIENCE SLOT</span>
                        <span>60 MIN</span>
                      </div>
                      <div className="text-xs font-semibold leading-tight line-clamp-1 text-[#a6b8ad]">
                        Standby Overflow Protection
                      </div>
                      <div className="text-[9px] text-[#55675c]">
                        Auto-absorbs slips • Zero disruption
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Authenticated State: Active Goal Header & Tab Switcher (If active goal exists) */}
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
          <section id="catalog-section" className="space-y-6 pt-4">
            {/* Catalog Section Header Micro-Label */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#182621] pb-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C] block">
                  CURATED BLUEPRINTS // SELECT TARGET SPECIFICATION
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-[#e5ebe7]">
                  Pre-Scoped 12-Week Blueprints
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#55675c]">
                DETERMINISTIC 3-PHASE PROGRESSION
              </span>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Category Filter Tabs with >= 44px Touch Targets */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`min-h-[44px] px-3.5 py-2 rounded-sm text-xs font-mono font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedCategory === category
                        ? 'bg-[#16221e] text-[#07CB6C] border border-[#1f332c]'
                        : 'bg-[#0c1210] text-[#7e8f85] hover:text-[#e5ebe7] border border-[#182621]'
                    }`}
                  >
                    {category.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Search Input with >= 16px Font Size on Mobile */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#7e8f85] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title, domain, or skills..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-sm bg-[#0c1210] border border-[#182621] text-[#e5ebe7] placeholder-[#55675c] text-base sm:text-xs font-mono focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-colors"
                />
              </div>
            </div>

            {/* Goal Catalog Content Grid */}
            <div className="space-y-6">
              {loading && (
                <div className="p-16 rounded-md bg-[#0c1210] border border-[#182621] flex flex-col items-center justify-center text-[#7e8f85] gap-3 shadow-none">
                  <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
                  <span className="text-xs font-mono tracking-wider uppercase">LOADING BLUEPRINT SPECIFICATIONS...</span>
                </div>
              )}

              {error && (
                <div className="p-8 rounded-md bg-[#0c1210] border border-[#ef4444]/30 text-center space-y-4 shadow-none">
                  <div className="w-10 h-10 rounded-sm bg-[#161214] text-[#ef4444] border border-[#ef4444]/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#e5ebe7] font-mono uppercase">CATALOG TELEMETRY OFFLINE</h3>
                    <p className="text-xs font-mono text-[#a6b8ad] max-w-md mx-auto mt-1">{error}</p>
                  </div>
                  <button
                    onClick={loadData}
                    className="min-h-[44px] px-4 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#e5ebe7] text-xs font-mono border border-[#182621] transition-colors cursor-pointer"
                  >
                    RETRY CONNECTION
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length === 0 && (
                <div className="p-12 rounded-md bg-[#0c1210] border border-[#182621] text-center text-[#7e8f85] space-y-2 shadow-none">
                  <p className="text-xs font-mono uppercase">NO BLUEPRINTS MATCH SPECIFIED FILTER CRITERIA</p>
                  <button
                    onClick={() => {
                      setSelectedCategory('All');
                      setSearchQuery('');
                    }}
                    className="text-xs font-mono text-[#07CB6C] underline font-medium cursor-pointer"
                  >
                    Reset Filter Queries
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
            </div>
          </section>
        )}

        {/* Platform Technical Specifications (Engineering Infrastructure) */}
        {!activeUserGoal && (
          <section className="pt-8 border-t border-[#182621]">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-[#182621] pb-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                  INFRASTRUCTURE SPECIFICATION // CORE PILLARS
                </span>
                <span className="text-[10px] font-mono text-[#55675c]">
                  FOUNDATION STANDARDS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
                <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-3 shadow-none">
                  <div className="w-8 h-8 rounded-sm bg-[#111a17] border border-[#182621] flex items-center justify-center text-[#07CB6C]">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#e5ebe7] font-mono">DETERMINISTIC BLUEPRINTS</h4>
                  <p className="text-xs text-[#7e8f85] leading-relaxed font-mono">
                    Zero decision fatigue. Blueprints arrive pre-scoped with 3 sequential 4-week phases, concrete session durations, and optimal times of day.
                  </p>
                </div>

                <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-3 shadow-none">
                  <div className="w-8 h-8 rounded-sm bg-[#111a17] border border-[#182621] flex items-center justify-center text-[#07CB6C]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#e5ebe7] font-mono">AVAILABILITY BUFFER SYNC</h4>
                  <p className="text-xs text-[#7e8f85] leading-relaxed font-mono">
                    Learns your recurring weekly commitments (Mon–Sat busy blocks). Achivii slots goal units exclusively into genuine, unreserved free time.
                  </p>
                </div>

                <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#182621] space-y-3 shadow-none">
                  <div className="w-8 h-8 rounded-sm bg-[#111a17] border border-[#182621] flex items-center justify-center text-[#07CB6C]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#e5ebe7] font-mono">HABIT CIRCUIT BREAKER</h4>
                  <p className="text-xs text-[#7e8f85] leading-relaxed font-mono">
                    Eliminates the guilt and abandonment death-spiral. If life derails execution, the engine auto-dilates or prunes buffer blocks while defending core habits.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Slide-over Technical Phase Inspection Drawer */}
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

export default Home;
