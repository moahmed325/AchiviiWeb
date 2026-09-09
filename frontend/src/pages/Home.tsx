import React, { useEffect, useState, useRef } from 'react';
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
  Check,
  Play,
  ChevronDown,
  X,
} from 'lucide-react';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { DiscardGoalModal } from '../components/DiscardGoalModal';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  videoSrc: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'missed-week',
    question: 'What happens if I miss a full week due to work or illness?',
    answer:
      'The recovery engine reallocates core sessions into your planned buffer slots. If total slippage exceeds the recovery threshold, the system flags a circuit breaker to reset expectations without guilt.',
    videoSrc: '/videos/faq-missed-week.mp4',
  },
  {
    id: 'no-streaks',
    question: "Why don't you use streak counters like other apps?",
    answer:
      'Streaks reward presence over substance and introduce extreme fragility. One sick day wipes out 60 days of momentum. Achivii tracks completion volume across 90 days instead.',
    videoSrc: '/videos/faq-no-streaks.mp4',
  },
  {
    id: 'custom-goals',
    question: 'Can I customize the weekly hours or create my own goal?',
    answer:
      'Yes. While our curated blueprints are pre-calibrated for optimal pacing, you can adjust weekly session duration or calibrate a fully custom protocol.',
    videoSrc: '/videos/faq-custom-goals.mp4',
  },
];

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

  // Video & Accordion states
  const [introVideoPlaying, setIntroVideoPlaying] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);

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

  // Single Active Goal & Discard States
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);
  const [activeGoalConflictTarget, setActiveGoalConflictTarget] = useState<GoalCatalog | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSelectGoal = (goal: GoalCatalog) => {
    if (!user) {
      openAuthModal('signup');
      return;
    }
    if (activeUserGoal) {
      if (activeUserGoal.goal_catalog_id === goal.id) {
        navigate('/');
        return;
      }
      // Single active goal guard: prompt with warning dialog
      setActiveGoalConflictTarget(goal);
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

            {/* Minimal High-Signal Proof Strip */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-10 sm:pt-14 text-neutral-400 text-xs font-mono">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                12-Week Scoped Roadmaps
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                Dynamic Buffer Reallocation
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                Zero Fragile Streaks
              </span>
            </div>
          </section>
        )}

        {/* Section 2: Personal Introduction & System Walkthrough */}
        {!activeUserGoal && (
          <section className="py-20 sm:py-28 border-t border-[#141f1b]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center max-w-7xl mx-auto">
              {/* Left Column (Text & Value Proposition - 5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <span className="font-mono text-xs text-[#07CB6C] tracking-widest uppercase mb-3 block">
                    [ CREATOR NOTE // THE THESIS ]
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight mb-4">
                    Why I built Achivii.
                  </h2>
                  <div className="space-y-4 text-neutral-300 text-sm sm:text-base leading-relaxed">
                    <p>
                      For years, I watched ambitious engineers and operators burn out on rigid habit systems. Conventional trackers assume robotic conditions: zero illness, zero urgent production outages, and zero family emergencies.
                    </p>
                    <p>
                      The moment reality intervenes, a broken streak triggers guilt, and the entire goal is abandoned. Achivii transforms intentions into deterministic 90-day execution using mathematical buffer absorption instead of fragile streak counters.
                    </p>
                  </div>
                </div>

                {/* Quick Bullet Highlights with Checkmarks */}
                <div className="space-y-2.5 pt-2 border-t border-[#1a2824]">
                  <div className="flex items-center gap-3 text-sm text-neutral-200">
                    <span className="w-5 h-5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C] shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span>Zero streak tracking or guilt mechanisms</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-200">
                    <span className="w-5 h-5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C] shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span>Deterministic 90-day time horizons</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-neutral-200">
                    <span className="w-5 h-5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C] shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span>Dynamic buffer slots that absorb missed sessions</span>
                  </div>
                </div>
              </div>

              {/* Right Column (Video Player Frame - 7 cols) */}
              <div className="lg:col-span-7 space-y-2">
                <div className="relative aspect-video rounded-xl overflow-hidden border border-[#1a2824] bg-[#0d1412] shadow-2xl group">
                  <video
                    ref={introVideoRef}
                    src="/videos/intro-walkthrough.mp4"
                    controls={introVideoPlaying}
                    controlsList="nodownload"
                    className="w-full h-full object-cover"
                    onPlay={() => setIntroVideoPlaying(true)}
                    onPause={() => setIntroVideoPlaying(false)}
                  />

                  {!introVideoPlaying && (
                    <div
                      onClick={() => {
                        setIntroVideoPlaying(true);
                        if (introVideoRef.current) {
                          introVideoRef.current.play().catch(() => {});
                        }
                      }}
                      className="absolute inset-0 bg-gradient-to-t from-[#080d0b] via-[#0d1412]/80 to-[#080d0b]/90 flex flex-col items-center justify-center gap-4 cursor-pointer p-6 text-center"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#07CB6C] text-[#080d0b] flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_25px_rgba(7,203,108,0.4)]">
                        <Play className="w-6 h-6 fill-current translate-x-0.5" />
                      </div>
                      <div className="space-y-1">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#07CB6C] block font-medium">
                          System Architecture Walkthrough
                        </span>
                        <span className="text-white text-sm font-medium">
                          Watch creator walkthrough (4:12)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between font-mono text-[11px] text-neutral-500 px-1">
                  <span>SYSTEM BREAKDOWN // 4 MIN WALKTHROUGH</span>
                  <span className="text-[#07CB6C]">1080P PRO RES</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Authenticated State: Active Goal Header & Tab Switcher (If active goal exists) */}
        {activeUserGoal && activeUserGoal.goal_catalog && (
          <div className="space-y-6">
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
                  <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight truncate">
                    {activeUserGoal.goal_catalog.title}
                  </h2>
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

            {/* Dashboard View Tab Toggle */}
            <div className="flex items-center gap-2 border-b border-[#1a2824] pb-3">
              <button
                onClick={() => setDashboardTab('schedule')}
                className={`min-h-[40px] flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  dashboardTab === 'schedule'
                    ? 'bg-[#131f1b] text-white border border-[#07CB6C]/40'
                    : 'bg-[#0a0f0d] text-neutral-400 hover:text-white border border-[#1a2824]'
                }`}
              >
                <Calendar className="w-4 h-4 text-[#07CB6C]" />
                <span>ROLLING AGENDA // THIS WEEK</span>
              </button>

              <button
                onClick={() => setDashboardTab('catalog')}
                className={`min-h-[40px] flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer ${
                  dashboardTab === 'catalog'
                    ? 'bg-[#131f1b] text-white border border-[#07CB6C]/40'
                    : 'bg-[#0a0f0d] text-neutral-400 hover:text-white border border-[#1a2824]'
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
                <div className="p-16 rounded-2xl bg-[#0a0f0d] border border-[#1a2824] flex flex-col items-center justify-center text-neutral-400 gap-3 shadow-2xl">
                  <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
                  <span className="text-xs font-mono tracking-wider uppercase">LOADING BLUEPRINT SPECIFICATIONS...</span>
                </div>
              )}

              {error && (
                <div className="p-8 rounded-2xl bg-[#0a0f0d] border border-rose-500/30 text-center space-y-4 shadow-2xl">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white font-mono uppercase">CATALOG TELEMETRY OFFLINE</h3>
                    <p className="text-xs font-mono text-neutral-400 max-w-md mx-auto mt-1">{error}</p>
                  </div>
                  <button
                    onClick={loadData}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0d1412] hover:bg-[#131f1b] text-white text-xs font-mono border border-[#1a2824] transition-colors cursor-pointer"
                  >
                    RETRY CONNECTION
                  </button>
                </div>
              )}

              {!loading && !error && filteredGoals.length === 0 && (
                <div className="p-12 rounded-2xl bg-[#0a0f0d] border border-[#1a2824] text-center text-neutral-400 space-y-2 shadow-2xl">
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
                      hasActiveGoal={Boolean(activeUserGoal)}
                      isActiveGoal={activeUserGoal?.goal_catalog_id === goal.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section 4: Interactive Video FAQ Accordion */}
        {!activeUserGoal && (
          <section className="max-w-4xl mx-auto py-20 sm:py-28 border-t border-[#141f1b] px-4">
            {/* Header */}
            <div className="text-center space-y-3 mb-10 sm:mb-12">
              <span className="font-mono text-xs text-[#07CB6C] tracking-widest uppercase block">
                [ FREQUENTLY ANSWERED ]
              </span>
              <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-tight">
                Questions &amp; Video Answers
              </h2>
              <p className="text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                Direct, honest answers about the protocol, recovery engine, and why this system actually works.
              </p>
            </div>

            {/* Accordion List */}
            <div className="space-y-4">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={item.id}
                    className="border border-[#1a2824] bg-[#0a0f0d] rounded-xl overflow-hidden mb-4 transition-colors hover:border-[#22352f]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="w-full p-5 sm:p-6 flex items-center justify-between text-left gap-4 cursor-pointer"
                    >
                      <span className="text-white font-medium text-base sm:text-lg">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-neutral-400 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#07CB6C]' : ''
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="p-5 sm:p-6 border-t border-[#141f1b] bg-[#0c1310] space-y-4">
                        <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                          {item.answer}
                        </p>
                        <div className="relative aspect-video w-full max-w-xl mx-auto rounded-lg overflow-hidden border border-[#1a2824] bg-[#080d0b]">
                          <video
                            src={item.videoSrc}
                            controls
                            controlsList="nodownload"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-[10px] text-neutral-500 uppercase">
                            Video Brief // Protocol Q&amp;A
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Section 5: Clean Editorial Footer */}
      <footer className="border-t border-[#141f1b] py-10 bg-[#070b09]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-xs font-mono text-neutral-400">
          {/* Left: Brand Monogram + Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-[#131f1b] border border-[#1a2824] flex items-center justify-center text-[#07CB6C] font-bold text-[11px]">
              A
            </div>
            <span>
              <strong className="text-white font-semibold">Achivii</strong> // Deterministic Execution Engine
            </span>
          </div>

          {/* Center: System Architecture Statement */}
          <div className="text-neutral-500 text-center">
            <span>Local-first SQLite • Zero cloud telemetry</span>
          </div>

          {/* Right: Copyright and Version Tag */}
          <div className="flex items-center gap-3 text-neutral-500">
            <span>© {new Date().getFullYear()} Achivii</span>
            <span className="px-2 py-0.5 rounded bg-[#0d1412] border border-[#1a2824] text-[10px] text-[#07CB6C]">
              v1.0.0-offline
            </span>
          </div>
        </div>
      </footer>

      {/* Slide-over Technical Phase Inspection Drawer */}
      <GoalDetailDrawer
        goal={inspectedGoal}
        onClose={() => setInspectedGoal(null)}
        onSelect={(goal) => handleSelectGoal(goal)}
        hasActiveGoal={Boolean(activeUserGoal)}
        isActiveGoal={activeUserGoal?.goal_catalog_id === inspectedGoal?.id}
      />

      {/* Active Protocol In Progress Conflict Dialog */}
      {activeGoalConflictTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-[#0a0f0d] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => setActiveGoalConflictTarget(null)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-[#131f1b] transition-colors cursor-pointer"
              title="Close warning"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
                [ CONFLICT // ACTIVE PROTOCOL IN PROGRESS ]
              </span>
              <h3 className="text-xl font-bold text-white tracking-tight">
                Active Protocol In Progress
              </h3>
            </div>

            <div className="space-y-2.5 text-xs font-mono text-neutral-300 leading-relaxed border-l-2 border-amber-500/60 pl-3">
              <p>
                Only one active 90-day protocol can run concurrently. You are currently committed to:
              </p>
              <p className="text-white font-bold bg-[#0d1412] p-2 rounded border border-[#1a2824] truncate">
                {activeUserGoal?.goal_catalog?.title || 'Active Blueprint'}
              </p>
              <p className="text-neutral-400">
                To initialize <strong className="text-white">"{activeGoalConflictTarget.title}"</strong>, complete or discard your active protocol first.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setActiveGoalConflictTarget(null);
                  navigate('/');
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] font-mono font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)]"
              >
                <span>Go to Active Workbench →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveGoalConflictTarget(null);
                  setIsDiscardModalOpen(true);
                }}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0d1412] hover:bg-red-950/20 text-red-400 hover:text-red-300 border border-red-500/30 font-mono text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Discard Current Protocol</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Goal Typed Confirmation Modal */}
      <DiscardGoalModal
        isOpen={isDiscardModalOpen}
        goalId={activeUserGoal?.id}
        goalTitle={activeUserGoal?.goal_catalog?.title}
        onClose={() => setIsDiscardModalOpen(false)}
        onSuccess={async () => {
          setIsDiscardModalOpen(false);
          setActiveUserGoal(null);
          setToastMessage('Protocol discarded. Catalog unlocked.');
          await loadData();
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-lg bg-[#0a0f0d] border border-[#07CB6C]/40 text-[#07CB6C] text-xs font-mono flex items-center gap-2 shadow-2xl">
          <Check className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-3 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
};

export default Home;
