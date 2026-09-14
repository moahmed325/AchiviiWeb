import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { FullscreenFocusModal } from '../components/FullscreenFocusModal';
import {
  fetchCurrentUserGoal,
  fetchHealthCheck,
  fetchCatalog,
  fetchAggregatedProfile,
} from '../lib/api';
import {
  fetchAdaptiveDashboard,
  recordSessionTelemetry,
} from '../lib/adaptiveApi';
import {
  fetchTodaySchedule,
  fetchLifeStructure,
  adaptSchedule,
  updateScheduleItemStatus,
  DailyScheduleItem,
  LifeStructure,
} from '../lib/lifeApi';
import { UserGoal, GoalCatalog } from '../types';
import type { AdaptiveDashboardResponse } from '../types/adaptive';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Play,
  Zap,
  Sun,
  Moon,
  FastForward,
  ChevronDown,
  X,
  Briefcase,
  Coffee,
  Heart,
  Dumbbell,
  MoreHorizontal,
  Award,
  Plus,
  Sparkles,
  Search,
} from 'lucide-react';
import { GoalCard } from '../components/GoalCard';
import { GoalDetailDrawer } from '../components/GoalDetailDrawer';
import { DiscardGoalModal } from '../components/DiscardGoalModal';
import { WeeklyReflection } from '../components/WeeklyReflection';
import { GraduationModal } from '../components/GraduationModal';
import { formatTaskTitle } from '../lib/formatters';

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  // Core State
  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveDashboardResponse | null>(null);
  const [lifeStructure, setLifeStructure] = useState<LifeStructure | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<{
    date: string;
    items: DailyScheduleItem[];
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Fullscreen Focus Modal State
  const [activeFocusDose, setActiveFocusDose] = useState<DailyScheduleItem | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState<boolean>(false);

  // Intraday Shift Dropdown & Actions
  const [isShiftDropdownOpen, setIsShiftDropdownOpen] = useState<boolean>(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState<boolean>(false);
  const [shiftLoading, setShiftLoading] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ambition Hub State (when !activeUserGoal)
  const [catalogGoals, setCatalogGoals] = useState<GoalCatalog[]>([]);
  const [profileTelemetry, setProfileTelemetry] = useState<Awaited<ReturnType<typeof fetchAggregatedProfile>> | null>(null);
  const [hubCategory, setHubCategory] = useState<string>('all');
  const [hubSearchQuery, setHubSearchQuery] = useState<string>('');
  const [inspectedGoal, setInspectedGoal] = useState<GoalCatalog | null>(null);

  // Modals
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState<boolean>(false);
  const [isOutcomeGateOpen, setIsOutcomeGateOpen] = useState<boolean>(false);

  // Load Dashboard Data
  const loadDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [goalRes, healthStatus] = await Promise.all([
        fetchCurrentUserGoal(token),
        fetchHealthCheck()
          .then(() => 'online' as const)
          .catch(() => 'offline' as const),
      ]);
      setApiStatus(healthStatus);
      setActiveUserGoal(goalRes.user_goal);

      if (goalRes.user_goal) {
        const [adaptRes, lifeRes, scheduleRes] = await Promise.all([
          fetchAdaptiveDashboard(token, goalRes.user_goal.id).catch(() => null),
          fetchLifeStructure(token).catch(() => null),
          fetchTodaySchedule(token).catch(() => null),
        ]);

        setAdaptiveData(adaptRes);
        setLifeStructure(lifeRes);
        setTodaySchedule(scheduleRes);
      } else {
        setAdaptiveData(null);
        setTodaySchedule(null);
        // Load Ambition Hub data: curated catalog & past telemetry
        const [catalogRes, profileRes] = await Promise.all([
          fetchCatalog().catch(() => []),
          fetchAggregatedProfile(token).catch(() => null),
        ]);
        setCatalogGoals(catalogRes);
        setProfileTelemetry(profileRes);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Achivii engine.');
      setApiStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [token, refreshTrigger]);

  // Find the Next Active Ambition Dose for Today
  const nextAmbitionDose = useMemo(() => {
    if (!todaySchedule?.items) return null;
    return (
      todaySchedule.items.find(
        (i) => i.item_type === 'AMBITION_DOSE' && i.status !== 'COMPLETED' && i.status !== 'SKIPPED_INTENTIONAL'
      ) || null
    );
  }, [todaySchedule]);

  // Check if all ambition doses today are completed
  const allDosesCompletedToday = useMemo(() => {
    if (!todaySchedule?.items) return false;
    const ambitionItems = todaySchedule.items.filter((i) => i.item_type === 'AMBITION_DOSE');
    return ambitionItems.length > 0 && ambitionItems.every((i) => i.status === 'COMPLETED' || i.status === 'SKIPPED_INTENTIONAL');
  }, [todaySchedule]);

  // Formatted date
  const formattedToday = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: user?.timezone || 'UTC',
      }).format(new Date());
    } catch {
      return 'Today';
    }
  }, [user?.timezone]);

  // Derived User Display Name
  const userDisplayName = useMemo(() => {
    if (!user?.email) return 'Pilot';
    const namePart = user.email.split('@')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }, [user?.email]);

  // Ambition Hub Filters
  const HUB_FILTERS = useMemo(
    () => [
      { id: 'all', label: 'All Goals', match: () => true },
      {
        id: 'engineering',
        label: 'Engineering',
        match: (g: GoalCatalog) =>
          /tech|engineer/i.test(g.category || '') || /saas|system|distributed/i.test(g.title || ''),
      },
      {
        id: 'athletics',
        label: 'Athletics & Health',
        match: (g: GoalCatalog) =>
          /health|fitness|endurance/i.test(g.category || '') || /marathon|10k/i.test(g.title || ''),
      },
      {
        id: 'cognitive',
        label: 'Languages & Cognitive',
        match: (g: GoalCatalog) =>
          /language|cognitive/i.test(g.category || '') || /spanish|b1/i.test(g.title || ''),
      },
      {
        id: 'writing',
        label: 'Writing & Publishing',
        match: (g: GoalCatalog) =>
          /writing/i.test(g.category || '') || /book|write|publish/i.test(g.title || ''),
      },
      {
        id: 'habits',
        label: 'Daily Habits',
        match: (g: GoalCatalog) =>
          /habit/i.test(g.category || '') || /mindfulness|breathwork/i.test(g.title || ''),
      },
    ],
    []
  );

  // Filtered Catalog for Ambition Hub
  const filteredCatalogGoals = useMemo(() => {
    return catalogGoals.filter((goal) => {
      const activeFilter = HUB_FILTERS.find((f) => f.id === hubCategory);
      const matchesCategory = activeFilter ? activeFilter.match(goal) : true;
      const matchesSearch =
        !hubSearchQuery ||
        (goal.title || '').toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
        (goal.description || '').toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
        (goal.category || '').toLowerCase().includes(hubSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [catalogGoals, hubCategory, hubSearchQuery, HUB_FILTERS]);

  // Handle Opening Fullscreen Focus Session
  const handleStartFocus = (dose: DailyScheduleItem) => {
    setActiveFocusDose(dose);
    setIsFocusModalOpen(true);
  };

  // Handle Fullscreen Focus Session Completion
  const handleCompleteSession = async (notes: string, isMvs: boolean) => {
    if (!token || !activeFocusDose) return;
    try {
      await updateScheduleItemStatus(token, activeFocusDose.id, 'COMPLETED');
      const mins = isMvs
        ? activeFocusDose.minimum_viable_minutes || 20
        : activeFocusDose.allocated_minutes || 45;

      await recordSessionTelemetry(token, {
        sessionId: activeFocusDose.id,
        executionState: isMvs ? 'MINIMUM_VIABLE' : 'COMPLETED',
        proofOfWorkText: notes.trim() || `Completed ${mins}m dose for ${activeFocusDose.title}.`,
        durationMinutes: mins,
        rpeRating: isMvs ? 4 : 7,
      });

      setActionFeedback({
        type: 'success',
        message: 'Session verified and completed. Great work!',
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to save session.',
      });
    }
  };

  // Handle Intraday Delay (+30m Shift)
  const handleIntradayShift = async (minutes: number) => {
    if (!token) return;
    setShiftLoading(true);
    setIsShiftDropdownOpen(false);
    setActionFeedback(null);
    try {
      await adaptSchedule(token, minutes, 'User requested delay');
      setActionFeedback({
        type: 'success',
        message: `Schedule pushed +${minutes}m smoothly. No catch-up debt created.`,
      });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to shift schedule.',
      });
    } finally {
      setShiftLoading(false);
    }
  };

  // Handle Skip Dose (No Debt)
  const handleSkipDose = async (doseId: string) => {
    if (!token) return;
    try {
      await updateScheduleItemStatus(token, doseId, 'SKIPPED_INTENTIONAL');
      setActionFeedback({
        type: 'success',
        message: 'Dose skipped for today. No debt rolled onto tomorrow.',
      });
      setIsFocusModalOpen(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to skip.',
      });
    }
  };

  // Category icon helper for lowkey timeline
  const getCategoryIcon = (category?: string) => {
    switch (category?.toUpperCase()) {
      case 'WORK':
        return <Briefcase className="w-3.5 h-3.5 text-neutral-400" />;
      case 'FAMILY':
        return <Heart className="w-3.5 h-3.5 text-neutral-400" />;
      case 'HEALTH':
        return <Dumbbell className="w-3.5 h-3.5 text-neutral-400" />;
      case 'MEALS':
      case 'FOOD':
        return <Coffee className="w-3.5 h-3.5 text-neutral-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b09] flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#07CB6C] animate-spin" />
          <span className="text-xs font-mono text-neutral-400">Loading your day...</span>
        </div>
      </div>
    );
  }

  // Ambition Hub view when no active goal
  if (!activeUserGoal) {
    const hasCompletedHistory =
      (profileTelemetry?.best_working_hours?.total_completed_sessions || 0) > 0;

    return (
      <div className="min-h-screen bg-[#070b09] text-white flex flex-col selection:bg-[#07CB6C]/30">
        <Navbar apiStatus={apiStatus} />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* ─── ELEMENT 1: WARM, PERSONALIZED WELCOME & STATUS ─── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pb-6 border-b border-white/5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                  Choose Your 90-Day Goal
                </span>
                <span className="text-neutral-600 text-xs">•</span>
                <span className="text-xs font-mono text-neutral-400">{formattedToday}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Welcome back, {userDisplayName}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
                Select a goal you want to achieve below to set up your schedule, or create your own custom goal.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/onboarding?mode=custom"
                className="min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black shadow-[0_0_20px_rgba(7,203,108,0.2)] transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your Own Goal</span>
              </Link>
            </div>
          </div>

          {/* ─── PAST ACCOMPLISHMENTS & GRADUATION TELEMETRY (If recorded) ─── */}
          {hasCompletedHistory && (
            <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0d1613] via-[#0f1c17] to-[#0d1613] border border-[#07CB6C]/30 shadow-[0_0_30px_rgba(7,203,108,0.06)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#07CB6C]/15 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C]">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Verified Execution Record</h2>
                    <p className="text-xs text-neutral-400">Learned telemetry preserved across your completed sessions</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-3 py-1 rounded-full border border-[#07CB6C]/20 self-start sm:self-auto font-medium">
                  PERFORMANCE ARCHIVE ACTIVE
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Completed Sessions</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {profileTelemetry?.best_working_hours?.total_completed_sessions || 0}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Avg Session Dose</span>
                  <span className="text-2xl font-bold font-mono text-[#07CB6C]">
                    {profileTelemetry?.best_working_hours?.average_session_duration_minutes || 0}m
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Peak Window</span>
                  <span className="text-2xl font-bold font-mono text-white capitalize">
                    {profileTelemetry?.best_working_hours?.preferred_time_of_day || 'Flexible'}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Zero-Debt Absorptions</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {profileTelemetry?.lapse_pattern_summary?.total_recovery_events || 0}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* ─── CHOOSE A GOAL WORKBENCH ─── */}
          <section className="space-y-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-white/5 pb-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#07CB6C] block">
                  Recommended Goals
                </span>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Select a Goal You Want to Achieve
                </h2>
              </div>
              <p className="text-xs text-neutral-400 font-normal">
                Choose a 12-week goal to set up your schedule and daily focus sessions
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {HUB_FILTERS.map((filter) => {
                  const count = catalogGoals.filter(filter.match).length;
                  const isSelected = hubCategory === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setHubCategory(filter.id)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'border border-[#07CB6C] text-white bg-[#07CB6C]/10 shadow-[0_0_15px_rgba(7,203,108,0.15)]'
                          : 'border border-white/10 text-neutral-400 hover:text-white bg-white/[0.02]'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span
                        className={`text-[11px] ${
                          isSelected ? 'text-[#07CB6C] font-semibold' : 'text-neutral-500'
                        }`}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={hubSearchQuery}
                  onChange={(e) => setHubSearchQuery(e.target.value)}
                  placeholder="Search goals..."
                  className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-neutral-500 text-xs font-normal focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-colors"
                />
              </div>
            </div>

            {/* Catalog Grid */}
            {filteredCatalogGoals.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-neutral-400 space-y-3">
                <p className="text-sm font-medium text-neutral-300">No goals match your search</p>
                <button
                  onClick={() => {
                    setHubCategory('all');
                    setHubSearchQuery('');
                  }}
                  className="text-xs text-[#07CB6C] hover:underline font-medium cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {filteredCatalogGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onInspect={(g) => setInspectedGoal(g)}
                    onSelect={(g) => navigate(`/onboarding?goalId=${g.id}`)}
                    hasActiveGoal={false}
                    isActiveGoal={false}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ─── CREATE YOUR OWN GOAL CTA ─── */}
          <section className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-white/[0.03] to-transparent border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-[#07CB6C] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Custom Goal</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Have a specific goal in mind?
              </h3>
              <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
                Tell us what you want to achieve and we'll break it down into realistic weekly phases and daily focus sessions.
              </p>
            </div>
            <Link
              to="/onboarding?mode=custom"
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/15 hover:border-[#07CB6C]/50 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
            >
              <span>Create Custom Goal</span>
              <ArrowRight className="w-4 h-4 text-[#07CB6C]" />
            </Link>
          </section>
        </main>

        {/* Goal Detail Drawer (When inspecting a card) */}
        <GoalDetailDrawer
          goal={inspectedGoal}
          onClose={() => setInspectedGoal(null)}
          onSelect={(goal) => {
            setInspectedGoal(null);
            navigate(`/onboarding?goalId=${goal.id}`);
          }}
          hasActiveGoal={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b09] text-white flex flex-col selection:bg-[#07CB6C]/30">
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Error or Feedback Banners */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionFeedback && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between border ${
              actionFeedback.type === 'success'
                ? 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ─── TOP BAR: Calm Header & Intraday Controls ─── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span>{formattedToday}</span>
              {adaptiveData?.currentWeek && (
                <>
                  <span className="text-neutral-600">•</span>
                  <span className="text-[#07CB6C]">Week {adaptiveData.currentWeek} of {adaptiveData.totalWeeks || 12}</span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {activeUserGoal.outcome_statement || activeUserGoal.goal_catalog?.title || 'Daily Execution'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Waking / Sleep Hours Pill */}
            {lifeStructure && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-400">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{lifeStructure.wake_time}</span>
                <span className="text-neutral-600">–</span>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>{lifeStructure.sleep_time}</span>
              </div>
            )}

            {/* "Running Late?" Quick Intraday Shift Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsShiftDropdownOpen((prev) => !prev)}
                disabled={shiftLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5 text-amber-400" />
                <span>Running Late?</span>
                <ChevronDown className="w-3 h-3 text-neutral-500" />
              </button>

              {isShiftDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#0c120f] border border-white/10 shadow-2xl p-1.5 z-40 space-y-0.5">
                  <div className="px-2.5 py-1 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                    Push Day (Zero Debt)
                  </div>
                  {[
                    { label: '+15 minutes', mins: 15 },
                    { label: '+30 minutes', mins: 30 },
                    { label: '+45 minutes', mins: 45 },
                    { label: '+60 minutes', mins: 60 },
                  ].map((s) => (
                    <button
                      key={s.mins}
                      onClick={() => handleIntradayShift(s.mins)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-neutral-300 hover:bg-white/5 hover:text-[#07CB6C] transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Subtle Options Dropdown (Reflection / Discard) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOptionsOpen((prev) => !prev)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                title="Options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isOptionsOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl bg-[#0c120f] border border-white/10 shadow-2xl p-1.5 z-40 space-y-0.5">
                  <button
                    onClick={() => {
                      setIsOptionsOpen(false);
                      setIsWeeklyReviewOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-neutral-300 hover:bg-white/5 transition-colors"
                  >
                    Weekly Reflection
                  </button>
                  <button
                    onClick={() => {
                      setIsOptionsOpen(false);
                      setIsDiscardModalOpen(true);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/30 transition-colors"
                  >
                    Change / Reset Ambition
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── HERO ACTION CARD: What Should I Do Right Now? ─── */}
        {nextAmbitionDose ? (
          <div className="p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-[#0c1410] to-[#080d0b] border border-[#07CB6C]/30 shadow-[0_0_35px_rgba(7,203,108,0.08)] relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#07CB6C]/5 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#07CB6C]">
                    Today's Focus
                  </span>
                  <span className="text-neutral-600">•</span>
                  <span className="text-xs font-mono text-neutral-400">
                    {nextAmbitionDose.start_time} – {nextAmbitionDose.end_time}
                  </span>
                </div>

                <div className="text-xs font-mono text-neutral-400">
                  {nextAmbitionDose.allocated_minutes} min
                </div>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {formatTaskTitle(nextAmbitionDose.title)}
                </h2>
                {nextAmbitionDose.description && (
                  <p className="text-xs sm:text-sm text-neutral-400 mt-1 leading-relaxed">
                    {nextAmbitionDose.description}
                  </p>
                )}
              </div>

              {/* Action Controls */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleStartFocus(nextAmbitionDose)}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs tracking-wide shadow-[0_0_20px_rgba(7,203,108,0.2)] transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Start Session</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartFocus(nextAmbitionDose)}
                  className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white font-mono text-xs transition-colors cursor-pointer"
                  title="Run shorter minimum viable session"
                >
                  <Zap className="w-3.5 h-3.5 text-[#07CB6C]" />
                  <span>Quick {nextAmbitionDose.minimum_viable_minutes || 20}m Version</span>
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSkipDose(nextAmbitionDose.id)}
                    className="px-3 py-2 text-neutral-500 hover:text-neutral-300 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Skip Today
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : allDosesCompletedToday ? (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0c1410] to-[#080d0b] border border-white/10 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/20 flex items-center justify-center mx-auto text-[#07CB6C]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">
              All set for today
            </h2>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              You showed up and completed your ambition session. Rest and recharge for tomorrow.
            </p>
          </div>
        ) : null}

        {/* ─── LOWKEY FULL-DAY TIMELINE ─── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
              Full Day Rhythm
            </h3>
            <span className="text-xs font-mono text-neutral-500">
              {todaySchedule?.items?.length || 0} events
            </span>
          </div>

          <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-px before:bg-white/10">
            {/* Morning Wake Boundary */}
            {lifeStructure && (
              <div className="relative flex items-center gap-3 text-xs font-mono text-neutral-500">
                <div className="absolute -left-6 w-4 h-4 rounded-full bg-[#070b09] border border-amber-500/40 flex items-center justify-center">
                  <Sun className="w-2.5 h-2.5 text-amber-400" />
                </div>
                <span>{lifeStructure.wake_time}</span>
                <span className="text-neutral-600">—</span>
                <span>Wake Up</span>
              </div>
            )}

            {/* Scheduled Day Events */}
            {todaySchedule?.items && todaySchedule.items.length > 0 ? (
              todaySchedule.items.map((item) => {
                const isAmbition = item.item_type === 'AMBITION_DOSE';
                const isCompleted = item.status === 'COMPLETED';
                const isSkipped = item.status === 'SKIPPED_INTENTIONAL';

                return (
                  <div
                    key={item.id}
                    className={`relative rounded-xl border transition-all ${
                      isCompleted ? 'opacity-50' : ''
                    } ${
                      isAmbition
                        ? 'p-4 bg-[#0d1612] border-[#07CB6C]/30 shadow-[0_0_20px_rgba(7,203,108,0.05)]'
                        : 'p-3.5 bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    {/* Node Dot on Timeline */}
                    <div
                      className={`absolute -left-6 top-5 w-2.5 h-2.5 rounded-full -translate-x-[3px] border ${
                        isCompleted
                          ? 'bg-[#07CB6C] border-[#07CB6C]'
                          : isAmbition
                          ? 'bg-[#07CB6C] border-[#07CB6C] ring-4 ring-[#07CB6C]/20'
                          : 'bg-neutral-800 border-neutral-600'
                      }`}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-neutral-400">
                            {item.start_time} – {item.end_time}
                          </span>

                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                              isAmbition
                                ? 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20'
                                : 'bg-white/5 text-neutral-400'
                            }`}
                          >
                            {!isAmbition && getCategoryIcon(item.category)}
                            <span>{isAmbition ? 'Ambition' : item.category || 'Routine'}</span>
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-white">
                          {formatTaskTitle(item.title)}
                        </div>

                        {item.description && (
                          <p className="text-xs text-neutral-400 mt-1 leading-relaxed max-w-xl">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Status / Action */}
                      <div className="shrink-0">
                        {isCompleted ? (
                          <div className="flex items-center gap-1 text-xs font-mono text-[#07CB6C]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Done</span>
                          </div>
                        ) : isSkipped ? (
                          <span className="text-[10px] font-mono text-neutral-500">
                            Skipped
                          </span>
                        ) : isAmbition ? (
                          <button
                            type="button"
                            onClick={() => handleStartFocus(item)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#07CB6C] hover:text-black text-white font-mono text-xs transition-colors cursor-pointer"
                          >
                            Focus
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-xs font-mono text-neutral-500">
                No events scheduled for today.
              </div>
            )}

            {/* Night Sleep Boundary */}
            {lifeStructure && (
              <div className="relative flex items-center gap-3 text-xs font-mono text-neutral-500 pt-1">
                <div className="absolute -left-6 w-4 h-4 rounded-full bg-[#070b09] border border-indigo-500/40 flex items-center justify-center">
                  <Moon className="w-2.5 h-2.5 text-indigo-400" />
                </div>
                <span>{lifeStructure.sleep_time}</span>
                <span className="text-neutral-600">—</span>
                <span>Sleep & Recharge</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── DEDICATED FULLSCREEN FOCUS MODAL ─── */}
      {activeFocusDose && (
        <FullscreenFocusModal
          isOpen={isFocusModalOpen}
          item={activeFocusDose}
          onClose={() => setIsFocusModalOpen(false)}
          onComplete={handleCompleteSession}
          onSkip={() => handleSkipDose(activeFocusDose.id)}
        />
      )}

      {/* Discard / Change Goal Modal */}
      {activeUserGoal && (
        <DiscardGoalModal
          isOpen={isDiscardModalOpen}
          goalTitle={activeUserGoal.outcome_statement || activeUserGoal.goal_catalog?.title || 'Ambition Protocol'}
          onClose={() => setIsDiscardModalOpen(false)}
          onSuccess={() => {
            setIsDiscardModalOpen(false);
            setActiveUserGoal(null);
            navigate('/onboarding');
          }}
        />
      )}

      {/* Weekly Strategic Review Modal */}
      {isWeeklyReviewOpen && activeUserGoal && (
        <WeeklyReflection
          userGoalId={activeUserGoal.id}
          weekNumber={1}
          onResolved={() => {
            setIsWeeklyReviewOpen(false);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {/* Graduation Outcome Gate Modal */}
      {isOutcomeGateOpen && activeUserGoal && (
        <GraduationModal
          userGoalId={activeUserGoal.id}
          goalTitle={activeUserGoal.outcome_statement || activeUserGoal.goal_catalog?.title}
          onResolved={() => {
            setIsOutcomeGateOpen(false);
            navigate('/onboarding');
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;
