import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCatalog, fetchHealthCheck } from '../lib/api';
import { GoalCatalog } from '../types';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { GoalCard } from '../components/GoalCard';
import { GoalDetailDrawer } from '../components/GoalDetailDrawer';
import { AuthModal } from '../components/AuthModal';
import { 
  Compass, 
  Loader2,
  Search, 
  ArrowRight,
  AlertCircle,
  Check,
  Play,
  ChevronDown,
  Clock,
  ShieldCheck,
  Sparkles,
  Activity,
  Target,
} from 'lucide-react';

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
      'The recovery engine reallocates core sessions into your planned buffer slots. If total slippage exceeds the recovery threshold, the system flags an adaptive checkpoint to reset expectations without guilt.',
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
  const { token } = useAuth();
  const [goals, setGoals] = useState<GoalCatalog[]>([]);
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

      // 3. Authenticated Routing: Send logged-in users to /dashboard
      if (token) {
        navigate('/dashboard', { replace: true });
        return;
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
    { id: 'all', label: 'All Blueprints', match: () => true },
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
    navigate(`/onboarding?goalId=${goal.id}`);
  };

  const handleStartOnboarding = () => {
    navigate('/onboarding');
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

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16 relative z-10 space-y-16 sm:space-y-24">
        
        {/* ─── SECTION 1: EDITORIAL HERO ─── */}
        <section className="space-y-6 sm:space-y-8 max-w-4xl mx-auto pt-4 sm:pt-8 pb-4 text-center">
          {/* Refined Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#07CB6C] text-xs font-medium backdrop-blur-sm shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
            <span>90-Day Adaptive Execution System</span>
          </div>

          {/* Bold Editorial Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.15]">
            Turn Your Highest Ambition <br className="hidden sm:inline" />
            Into Daily Reality
          </h1>

          {/* High-Impact Value Proposition */}
          <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            Ambitious goals fail because life interrupts rigid habit trackers. Achivii pairs pre-calibrated blueprints with an adaptive engine that dynamically protects your schedule with zero catch-up debt.
          </p>

          {/* Editorial CTA Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartOnboarding}
              className="min-h-[46px] px-7 py-3 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(7,203,108,0.25)] hover:shadow-[0_0_30px_rgba(7,203,108,0.4)] transition-all cursor-pointer"
            >
              <span>Start Your 90 Days</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleScrollToCatalog}
              className="min-h-[46px] px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#07CB6C]" />
              <span>Explore Curated Blueprints</span>
            </button>
          </div>

          {/* Proof Strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-8 sm:pt-12 text-neutral-400 text-xs font-medium">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              Pre-Calibrated 12-Week Roadmaps
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              Dynamic Buffer Absorption
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              Zero Guilt, Zero Broken Streaks
            </span>
          </div>
        </section>

        {/* ─── SECTION 2: INTERACTIVE PRODUCT SHOWCASE / LIVE PREVIEW ─── */}
        <section className="relative max-w-4xl mx-auto rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Mockup Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              <span className="text-xs text-neutral-400 font-mono ml-2">achivii.app // workbench</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
              <span className="text-xs font-semibold text-[#07CB6C]">Adaptive Engine Active</span>
            </div>
          </div>

          {/* Workbench Showcase Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
            {/* Left: Scheduled Core Session */}
            <div className="md:col-span-7 p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#07CB6C] px-2.5 py-0.5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-ping" />
                  Live Now • Session Scheduled
                </span>
                <span className="text-xs font-mono text-neutral-400">09:30 – 11:00</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Full-Stack Architecture &amp; Endpoint Specs</h3>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  Deep focus block: build relational data models, test real-time synchronization, and verify acceptance.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300">
                  <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                  <span>90 min Focus</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Milestone #4</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300">
                  <Activity className="w-3.5 h-3.5 text-sky-400" />
                  <span>Alpha Soundscape</span>
                </div>
              </div>
            </div>

            {/* Right: Dynamic Buffer Protection Card */}
            <div className="md:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#07CB6C]/[0.04] border border-[#07CB6C]/25 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#07CB6C]">
                  <ShieldCheck className="w-4 h-4" />
                  <span>No-Debt Guarantee</span>
                </div>
                <h4 className="text-sm font-semibold text-white">Automated Buffer Balancing</h4>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  If urgent meetings or illness disrupt today, Achivii automatically reallocates this block into your Friday buffer slot. No backlog debt, no guilt.
                </p>
              </div>
              <div className="text-[11px] font-mono text-neutral-300 bg-white/5 p-3 rounded-xl border border-white/10 flex items-center justify-between">
                <span>Weekly Buffer Balance</span>
                <span className="text-[#07CB6C] font-bold">3.5 Hours Safe</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 3: HOW ACHIVII WORKS (3-STEP FRAMEWORK) ─── */}
        <section className="space-y-8 max-w-5xl mx-auto text-center">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#07CB6C] uppercase tracking-wider">
              The Framework
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Execution Designed for Real Life
            </h2>
            <p className="text-sm text-neutral-400 max-w-xl mx-auto">
              How Achivii eliminates burnout and guarantees 90-day consistency.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-left">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#07CB6C] font-bold text-sm">
                1
              </div>
              <h3 className="text-base font-semibold text-white">Choose Your Ambition</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Select from battle-tested 90-day blueprints in engineering, athletics, writing, or languages—pre-scoped with realistic weekly pacing.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#07CB6C] font-bold text-sm">
                2
              </div>
              <h3 className="text-base font-semibold text-white">Map Your Real Routine</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Enter your work hours, sleep schedule, and family commitments. Achivii schedules around your real life instead of demanding empty calendar blocks.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#07CB6C] font-bold text-sm">
                3
              </div>
              <h3 className="text-base font-semibold text-white">Execute With Buffer Safety</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Miss a day? The adaptive engine absorbs slippage into scheduled buffer slots. You never wake up to an overwhelming mountain of overdue tasks.
              </p>
            </div>
          </div>
        </section>

        {/* ─── SECTION 4: CURATED BLUEPRINT CATALOG SHOWCASE ─── */}
        <section id="catalog-section" className="space-y-8 pt-4">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-white/10 pb-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#07CB6C] block">
                Curated Ambitions
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Pre-Scoped 12-Week Blueprints
              </h2>
            </div>
            <p className="text-xs text-neutral-400 font-normal">
              Click any blueprint to explore its curriculum and weekly routine
            </p>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {CATALOG_FILTERS.map((filter) => {
                const count = goals.filter(filter.match).length;
                const isSelected = selectedCategory === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setSelectedCategory(filter.id)}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'border border-[#07CB6C] text-white bg-[#07CB6C]/10 shadow-[0_0_15px_rgba(7,203,108,0.15)]'
                        : 'border border-white/10 text-neutral-400 hover:text-white bg-white/[0.02]'
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span className={`text-[11px] ${isSelected ? 'text-[#07CB6C] font-semibold' : 'text-neutral-500'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by title, domain, or skills..."
                className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-neutral-500 text-xs font-normal focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-colors"
              />
            </div>
          </div>

          {/* Goal Catalog Content Grid */}
          <div className="space-y-6">
            {loading && (
              <div className="p-16 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-neutral-400 gap-3 shadow-xl">
                <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
                <span className="text-xs font-medium tracking-wide">Loading Curated Blueprints...</span>
              </div>
            )}

            {error && (
              <div className="p-8 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-center space-y-4 shadow-xl">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Unable to Load Catalog</h3>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1">{error}</p>
                </div>
                <button
                  onClick={loadData}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && filteredGoals.length === 0 && (
              <div className="p-12 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-neutral-400 space-y-2 shadow-xl">
                <p className="text-sm font-medium text-neutral-300">No blueprints match your filter criteria</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="text-xs text-[#07CB6C] hover:underline font-medium cursor-pointer"
                >
                  Reset Filters
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
                    hasActiveGoal={false}
                    isActiveGoal={false}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── SECTION 5: CREATOR NOTE & WALKTHROUGH VIDEO ─── */}
        <section className="py-16 sm:py-24 border-t border-white/10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center max-w-7xl mx-auto">
            {/* Left Column */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <span className="text-xs font-semibold text-[#07CB6C] tracking-wider uppercase mb-3 block">
                  The Philosophy
                </span>
                <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight mb-4">
                  Why I built Achivii.
                </h2>
                <div className="space-y-4 text-neutral-300 text-sm sm:text-base leading-relaxed">
                  <p>
                    For years, I watched ambitious people burn out on rigid habit systems. Conventional trackers assume robotic conditions: zero illness, zero urgent work deadlines, and zero family emergencies.
                  </p>
                  <p>
                    The moment reality intervenes, a broken streak triggers guilt, and the entire goal is abandoned. Achivii transforms intentions into deterministic 90-day execution using mathematical buffer absorption instead of fragile streak counters.
                  </p>
                </div>
              </div>

              {/* Highlights */}
              <div className="space-y-2.5 pt-2 border-t border-white/5">
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

            {/* Right Column (Video Player Frame) */}
            <div className="lg:col-span-7 space-y-2">
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-[#0d1412] shadow-2xl group">
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
                    <div className="w-14 h-14 rounded-full bg-[#07CB6C] text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_25px_rgba(7,203,108,0.4)]">
                      <Play className="w-6 h-6 fill-current translate-x-0.5" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-[#07CB6C] block font-semibold">
                        System Walkthrough
                      </span>
                      <span className="text-white text-sm font-medium">
                        Watch how the adaptive engine works (4:12)
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-neutral-500 px-1">
                <span>HOW ACHIVII WORKS // 4 MIN WALKTHROUGH</span>
                <span className="text-[#07CB6C]">HD VIDEO</span>
              </div>
            </div>
          </div>
        </section>

        {/* ─── SECTION 6: INTERACTIVE FAQ ACCORDION ─── */}
        <section className="max-w-4xl mx-auto py-16 sm:py-24 border-t border-white/10 px-4">
          <div className="text-center space-y-3 mb-10 sm:mb-12">
            <span className="text-xs font-semibold text-[#07CB6C] tracking-wider uppercase block">
              Frequently Answered
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Questions &amp; Video Answers
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              Direct, honest answers about the protocol, recovery engine, and why this system actually works.
            </p>
          </div>

          <div className="space-y-4">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={item.id}
                  className="border border-white/10 bg-white/[0.02] rounded-2xl overflow-hidden mb-4 transition-colors hover:border-white/20"
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
                      className={`w-5 h-5 text-[#07CB6C] transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-white/5 space-y-4">
                      <p className="text-neutral-300 text-sm sm:text-base leading-relaxed">
                        {item.answer}
                      </p>

                      <div className="pt-2">
                        <div className="relative aspect-video max-w-md rounded-xl overflow-hidden border border-white/10 bg-black">
                          <video
                            src={item.videoSrc}
                            controls
                            controlsList="nodownload"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[11px] font-mono text-neutral-500 mt-1 block">
                          Video explanation (0:45)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── SECTION 7: BOTTOM CALL TO ACTION ─── */}
        <section className="text-center py-16 sm:py-20 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 max-w-4xl mx-auto p-8 space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#07CB6C] uppercase tracking-wider">
              Start Your Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Ready to Turn Intention Into Execution?
            </h2>
            <p className="text-neutral-400 text-sm max-w-lg mx-auto leading-relaxed">
              Pick your 90-day ambition, calibrate your real schedule, and experience progress with zero backlog debt.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleStartOnboarding}
              className="min-h-[48px] px-8 py-3 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(7,203,108,0.25)] hover:shadow-[0_0_35px_rgba(7,203,108,0.4)] transition-all cursor-pointer"
            >
              <span>Initialize Your Blueprint</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-8 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium text-neutral-400">
            <Target className="w-4 h-4 text-[#07CB6C]" />
            <span>Achivii — Adaptive 90-Day Execution</span>
          </div>
          <div>Local-first SQLite • Zero cloud telemetry</div>
        </div>
      </footer>

      {/* Goal Detail Drawer (When inspecting a card) */}
      <GoalDetailDrawer
        goal={inspectedGoal}
        onClose={() => setInspectedGoal(null)}
        onSelect={(goal) => {
          setInspectedGoal(null);
          handleSelectGoal(goal);
        }}
        hasActiveGoal={false}
      />

      {/* Global Auth Modal */}
      <AuthModal />
    </div>
  );
};

export default Home;
