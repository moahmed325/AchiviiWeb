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
  Check,
  Play,
  Target,
  Lock,
  RefreshCw
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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
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

  const CATALOG_FILTERS: Array<{ id: string; label: string; match: (g: GoalCatalog) => boolean }> = [
    { id: 'all', label: 'All', match: () => true },
    {
      id: 'engineering',
      label: 'Engineering',
      match: (g: GoalCatalog) => /tech|engineer/i.test(g.category) || /saas|system|distributed/i.test(g.title),
    },
    {
      id: 'athletics',
      label: 'Athletics',
      match: (g: GoalCatalog) => /fitness|athletic|health/i.test(g.category) || /run|marathon/i.test(g.title),
    },
    {
      id: 'linguistics',
      label: 'Linguistics',
      match: (g: GoalCatalog) => /language/i.test(g.category) || /spanish|linguistic/i.test(g.title),
    },
    {
      id: 'writing',
      label: 'Writing',
      match: (g: GoalCatalog) => /writing|creative/i.test(g.category) || /book|publish/i.test(g.title),
    },
    {
      id: 'habits',
      label: 'Habits',
      match: (g: GoalCatalog) => /wellness|mindset/i.test(g.category) || /mindfulness|breathwork|habit/i.test(g.title),
    },
  ];

  const filteredGoals = goals.filter((g) => {
    const activeFilter = CATALOG_FILTERS.find((f) => f.id === selectedCategory);
    const matchesCategory = activeFilter ? activeFilter.match(g) : true;
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
          <section className="space-y-6 sm:space-y-8 max-w-4xl mx-auto pt-6 sm:pt-10 pb-4 text-center">
            {/* Subtle Operational Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1412] border border-[#1a2824] text-[#07CB6C] text-xs font-mono font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              <span>12-WEEK RESILIENT CADENCE</span>
            </div>

            {/* Stark High-Contrast Editorial Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-white leading-[1.1]">
              Deterministic 90-Day <br className="hidden sm:inline" />
              Execution Engine
            </h1>

            {/* Tight 2-Sentence Plain Value Proposition */}
            <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
              Ambitious goals fail because life interrupts rigid plans. Achivii pairs pre-scoped blueprints with an adaptive recovery engine that automatically restructures your calendar when sessions are missed.
            </p>

            {/* High-Contrast Editorial CTA Row */}
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
                className="min-h-[44px] px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b862] text-[#080d0b] text-sm font-medium flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(7,203,108,0.2)] hover:shadow-[0_0_25px_rgba(7,203,108,0.35)] transition-all cursor-pointer"
              >
                <span>Initialize Blueprint</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleScrollToCatalog}
                className="min-h-[44px] px-5 py-2.5 rounded-md bg-transparent hover:bg-[#0d1412] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#2a3e38] text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Compass className="w-4 h-4 text-[#07CB6C]" />
                <span>Explore Catalog</span>
              </button>
            </div>

            {/* Achivii Execution Workbench Preview Window */}
            <div className="max-w-4xl mx-auto mt-12 sm:mt-16 w-full rounded-xl border border-[#1a2824] bg-[#0a0f0d] p-4 sm:p-6 shadow-2xl shadow-black/50 overflow-hidden relative">
              {/* Top Chrome Bar */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#1a2824]">
                {/* Traffic Light Window Controls */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1a2824]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1a2824]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1a2824]" />
                </div>

                {/* Monospace Telemetry Pill */}
                <div className="font-mono text-[11px] text-neutral-400 flex items-center gap-2 px-2.5 py-1 rounded bg-[#0d1412] border border-[#1a2824]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                  <span>ENGINE STATUS: OPTIMAL</span>
                </div>
              </div>

              {/* Mock 3-Day Execution Cadence Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {/* Day 01 (Monday - Complete) */}
                <div className="border border-[#1a2824] bg-[#0d1412] p-3.5 rounded-lg flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-neutral-400 font-medium">MON // 09:00</span>
                    <span className="w-5 h-5 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C]">
                      <Check className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white leading-snug">Deep Work: Core Architecture</h4>
                    <div className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30">
                      [COMPLETED]
                    </div>
                  </div>
                </div>

                {/* Day 02 (Tuesday - Buffer Slot) */}
                <div className="border border-dashed border-[#1a2824] bg-[#0c1210]/50 p-3.5 rounded-lg flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-amber-400 font-medium">TUE // BUFFER</span>
                    <span className="w-5 h-5 rounded bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-[#f59e0b]">
                      <Clock className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-neutral-300 leading-snug">Dynamic Reallocation Buffer</h4>
                    <div className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30">
                      [AVAILABLE]
                    </div>
                  </div>
                </div>

                {/* Day 03 (Wednesday - Scheduled) */}
                <div className="border border-[#1a2824] bg-[#0d1412] p-3.5 rounded-lg flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-neutral-400 font-medium">WED // 14:00</span>
                    <span className="w-5 h-5 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400">
                      <Play className="w-3 h-3 fill-current" />
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white leading-snug">Sprint Execution: API Layer</h4>
                    <div className="inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                      [LOCKED]
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Telemetry Sub-Bar */}
              <div className="mt-4 pt-3 border-t border-[#1a2824] flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-2">
                  <span>O(1) TIMELINE BUFFERING: 0 CORE BLOCKS DROPPED</span>
                  <span className="text-neutral-700">•</span>
                  <span>STREAK GUILT: ZERO</span>
                </div>
                <div className="text-[10px] text-[#07CB6C] font-mono flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#07CB6C]" />
                  <span>SYNCHRONIZED WITH RECOVERY ENGINE</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* How Achivii Works // Protocol Specification Section */}
        {!activeUserGoal && (
          <section className="py-16 sm:py-24 border-t border-[#141f1b] space-y-12">
            {/* Section Header */}
            <div className="space-y-4 max-w-3xl mx-auto text-center">
              <span className="font-mono text-xs text-[#07CB6C] tracking-widest uppercase block">
                [ PROTOCOL SPECIFICATION ]
              </span>
              <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight">
                How Achivii Guarantees 90-Day Execution
              </h2>
              <p className="text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed font-normal">
                Most habit trackers rely on fragile streaks. One missed day breaks momentum. Achivii uses engineering-grade buffers so your schedule adapts when life happens.
              </p>
            </div>

            {/* 3-Step Mechanics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Step 01 */}
              <div className="bg-[#0d1412] border border-[#1a2824] rounded-xl p-6 relative hover:border-[#07CB6C]/40 transition-colors flex flex-col justify-between space-y-6 group">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-[#131f1b] border border-[#1a2824] flex items-center justify-center text-[#07CB6C] group-hover:border-[#07CB6C]/40 transition-colors">
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-xs text-[#07CB6C] tracking-wider uppercase block font-medium">
                      01 // Pre-Scoped Blueprints
                    </span>
                    <h3 className="text-lg font-medium text-white">
                      Mathematically Sourced
                    </h3>
                  </div>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Select a curated 12-week roadmap. Every milestone, weekly hour commitment, and deliverable is mathematically scoped in advance.
                  </p>
                </div>
              </div>

              {/* Step 02 */}
              <div className="bg-[#0d1412] border border-[#1a2824] rounded-xl p-6 relative hover:border-[#07CB6C]/40 transition-colors flex flex-col justify-between space-y-6 group">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-[#131f1b] border border-[#1a2824] flex items-center justify-center text-[#07CB6C] group-hover:border-[#07CB6C]/40 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-xs text-[#07CB6C] tracking-wider uppercase block font-medium">
                      02 // Fixed Core Sessions
                    </span>
                    <h3 className="text-lg font-medium text-white">
                      Protected Allocations
                    </h3>
                  </div>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Lock 3–4 non-negotiable core sessions into your week. Treat them like production deployments—scheduled, protected, and focused.
                  </p>
                </div>
              </div>

              {/* Step 03 */}
              <div className="bg-[#0d1412] border border-[#1a2824] rounded-xl p-6 relative hover:border-[#07CB6C]/40 transition-colors flex flex-col justify-between space-y-6 group">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-lg bg-[#131f1b] border border-[#1a2824] flex items-center justify-center text-[#07CB6C] group-hover:border-[#07CB6C]/40 transition-colors">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-xs text-[#07CB6C] tracking-wider uppercase block font-medium">
                      03 // Dynamic Buffer Absorption
                    </span>
                    <h3 className="text-lg font-medium text-white">
                      Zero-Guilt Reallocation
                    </h3>
                  </div>
                  <p className="text-neutral-400 text-sm leading-relaxed">
                    Life interrupts. When you miss a session, our recovery engine reallocates the workload into your buffer slots. Zero guilt. Zero broken streaks.
                  </p>
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
            {/* Catalog Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#1a2824] pb-4">
              <div className="space-y-1">
                <span className="text-xs font-mono font-medium uppercase tracking-wider text-[#07CB6C] block">
                  Curated Catalog
                </span>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  Pre-Scoped 12-Week Blueprints
                </h2>
              </div>
              <p className="text-xs text-neutral-400 font-normal">
                Battle-tested protocols with built-in recovery buffers
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Category Filter Tabs with >= 44px Touch Targets & Dynamic Counters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {CATALOG_FILTERS.map((filter) => {
                  const count = goals.filter(filter.match).length;
                  const isSelected = selectedCategory === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setSelectedCategory(filter.id)}
                      className={`min-h-[44px] px-3.5 sm:px-4 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'border border-[#07CB6C] text-white bg-[#07CB6C]/10'
                          : 'border border-[#1a2824] text-neutral-400 hover:text-white bg-[#0a0f0d]'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`font-mono text-[11px] ${isSelected ? 'text-[#07CB6C]' : 'text-neutral-500'}`}>
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Input with >= 16px Font Size on Mobile */}
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title, domain, or skills..."
                  className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-md bg-[#0d1412] border border-[#1a2824] text-white placeholder-neutral-500 text-base sm:text-xs font-normal focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-colors"
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
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className="text-xs font-mono text-[#07CB6C] underline font-medium cursor-pointer"
                  >
                    Reset Filter Queries
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
