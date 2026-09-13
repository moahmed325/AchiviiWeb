import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarView } from '../components/CalendarView';
import {
  fetchCurrentUserGoal,
  fetchHealthCheck,
} from '../lib/api';
import {
  fetchAdaptiveDashboard,
  recordSessionTelemetry,
} from '../lib/adaptiveApi';
import { UserGoal } from '../types';
import type {
  AdaptiveDashboardResponse,
  GoalIntegrityStatus,
  CapabilityState,
} from '../types/adaptive';
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Loader2,
  Compass,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Check,
  Calendar as CalendarIcon,
  CheckCircle,
  ShieldAlert,
  Zap,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { DiscardGoalModal } from '../components/DiscardGoalModal';
import { WeeklyReflection } from '../components/WeeklyReflection';
import { GraduationModal } from '../components/GraduationModal';

const INTEGRITY_CONFIG: Record<
  GoalIntegrityStatus,
  { label: string; badgeClass: string; textClass: string; icon: React.ReactNode }
> = {
  INTACT: {
    label: 'DESTINATION INTACT',
    badgeClass: 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]',
    textClass: 'text-[#07CB6C]',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C]" />,
  },
  REVISED: {
    label: 'REVISED TRAJECTORY',
    badgeClass: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    textClass: 'text-sky-400',
    icon: <Sparkles className="w-3.5 h-3.5 text-sky-400" />,
  },
  AT_RISK: {
    label: 'CRITICAL PATH AT RISK',
    badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    textClass: 'text-amber-400',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  },
  COMPROMISED: {
    label: 'DESTINATION COMPROMISED',
    badgeClass: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    textClass: 'text-rose-400',
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
  },
};

const STATE_CONFIG: Record<
  CapabilityState,
  { label: string; bgClass: string; textClass: string; borderClass: string }
> = {
  ROBUST: {
    label: 'ROBUST',
    bgClass: 'bg-emerald-950/40',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
  },
  ESTABLISHED: {
    label: 'ESTABLISHED',
    bgClass: 'bg-teal-950/40',
    textClass: 'text-teal-400',
    borderClass: 'border-teal-500/30',
  },
  EMERGING: {
    label: 'EMERGING',
    bgClass: 'bg-amber-950/40',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
  },
  UNTESTED: {
    label: 'UNTESTED',
    bgClass: 'bg-[#131f1b]',
    textClass: 'text-neutral-400',
    borderClass: 'border-[#1a2824]',
  },
  REGRESSED: {
    label: 'REGRESSED',
    bgClass: 'bg-rose-950/40',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
  },
};

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Action states for Hero workbench
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState<boolean>(false);
  const [isOutcomeGateOpen, setIsOutcomeGateOpen] = useState<boolean>(false);

  // Focus Timer & Dose selection
  const [selectedDose, setSelectedDose] = useState<'STANDARD' | 'REDUCED' | 'MVS'>('STANDARD');
  const [isFocusActive, setIsFocusActive] = useState<boolean>(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState<number>(0);
  const [focusTotalSeconds, setFocusTotalSeconds] = useState<number>(0);
  const [isFocusPaused, setIsFocusPaused] = useState<boolean>(false);

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
        // Fetch Unified Adaptive Dashboard
        const adaptRes = await fetchAdaptiveDashboard(token, goalRes.user_goal.id);
        setAdaptiveData(adaptRes);
      } else {
        setAdaptiveData(null);
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

  // Focus countdown timer effect
  useEffect(() => {
    if (!isFocusActive || isFocusPaused || focusSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isFocusActive, isFocusPaused, focusSecondsLeft]);

  // Today's date in user's timezone
  const formattedToday = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: user?.timezone || 'UTC',
      })
        .format(new Date())
        .toUpperCase();
    } catch {
      return 'TODAY';
    }
  }, [user?.timezone]);

  // Get current dose duration in minutes
  const activeDurationMinutes = useMemo(() => {
    const today = adaptiveData?.todayAction;
    if (!today) return 45;
    if (selectedDose === 'MVS') return today.mvsDoseMinutes || 15;
    if (selectedDose === 'REDUCED') return today.reducedDoseMinutes || 30;
    return today.standardDoseMinutes || 45;
  }, [adaptiveData?.todayAction, selectedDose]);

  // Primary Action: Start / Toggle Focus
  const handleStartFocus = () => {
    setFocusTotalSeconds(activeDurationMinutes * 60);
    setFocusSecondsLeft(activeDurationMinutes * 60);
    setIsFocusPaused(false);
    setIsFocusActive(true);
  };

  const handleStopFocus = () => {
    setIsFocusActive(false);
    setIsFocusPaused(false);
  };

  // Primary Action: Mark Completed with Adaptive Telemetry
  const handleMarkCompleted = async () => {
    if (!token || !adaptiveData) return;
    const todayAction = adaptiveData.todayAction;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      // Find matching session ID if present
      const sessionId =
        todayAction?.trajectoryItemId ||
        todayAction?.id ||
        'session-today';

      // Log execution telemetry
      await recordSessionTelemetry(token, {
        sessionId,
        executionState: 'COMPLETED',
        proofOfWorkText: `Executed ${selectedDose} dose (${activeDurationMinutes}m) for ${todayAction?.actionName || 'daily objective'}.`,
        durationMinutes: activeDurationMinutes,
        rpeRating: selectedDose === 'MVS' ? 4 : 7,
      });

      setActionFeedback({
        type: 'success',
        message: `Milestone verified: Completed ${activeDurationMinutes}m session. Trajectory updated.`,
      });
      setIsFocusActive(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to record session telemetry.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Secondary Action: Apply Minimum Viable Session (MVS) Fallback
  const handleSelectDose = (dose: 'STANDARD' | 'REDUCED' | 'MVS') => {
    setSelectedDose(dose);
    if (isFocusActive) {
      const today = adaptiveData?.todayAction;
      const mins =
        dose === 'MVS'
          ? today?.mvsDoseMinutes || 15
          : dose === 'REDUCED'
          ? today?.reducedDoseMinutes || 30
          : today?.standardDoseMinutes || 45;
      setFocusTotalSeconds(mins * 60);
      setFocusSecondsLeft(mins * 60);
    }
  };

  // Capability verified count
  const capabilitiesList = adaptiveData?.capabilities || [];
  const verifiedCapsCount = capabilitiesList.filter((c) => c.state === 'ESTABLISHED' || c.state === 'ROBUST').length;
  const totalCapsCount = capabilitiesList.length || 3;
  const verifiedProgressPct = totalCapsCount > 0 ? Math.round((verifiedCapsCount / totalCapsCount) * 100) : 0;

  const integrity = adaptiveData?.goalIntegrityStatus || 'INTACT';
  const integrityConfig = INTEGRITY_CONFIG[integrity] || INTEGRITY_CONFIG.INTACT;

  const currentWeek = adaptiveData?.currentWeek || 1;
  const totalWeeks = adaptiveData?.totalWeeks || 12;

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white relative min-h-screen">
      {/* Global Navigation */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {activeUserGoal && adaptiveData ? (
          <div className="space-y-6">
            {/* Feedback notification toast */}
            {actionFeedback && (
              <div
                className={`p-3.5 rounded-md text-xs font-mono flex items-center justify-between border transition-all ${
                  actionFeedback.type === 'success'
                    ? 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {actionFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{actionFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="text-neutral-400 hover:text-white text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* STRATEGIC DESTINATION HEADER                         */}
            {/* ---------------------------------------------------- */}
            <div className="p-5 sm:p-6 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1a2824] pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                      90-DAY ADAPTIVE PROTOCOL
                    </span>
                    <span className="text-[#1a2824]">|</span>
                    <span className="text-[10px] font-mono text-neutral-400">
                      WEEK {String(currentWeek).padStart(2, '0')} OF {totalWeeks}
                    </span>
                    <span className="text-[#1a2824]">|</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 ${integrityConfig.badgeClass}`}
                    >
                      {integrityConfig.icon}
                      <span>[{integrityConfig.label}]</span>
                    </span>
                    {adaptiveData.confidenceLevel && (
                      <span className="px-2 py-0.5 rounded bg-[#0d1412] border border-[#1a2824] text-[10px] font-mono text-neutral-300 font-medium">
                        CONFIDENCE: {adaptiveData.confidenceLevel}
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {adaptiveData.outcomeStatement || activeUserGoal.goal_catalog?.title || 'Execution Protocol'}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsWeeklyReviewOpen(true)}
                    className="min-h-[44px] px-3.5 py-2 rounded-md bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Open Weekly Strategic Review"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Weekly Review</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOutcomeGateOpen(true)}
                    className="min-h-[44px] px-3.5 py-2 rounded-md bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Verify Outcome Gate Readiness"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span>Outcome Gate</span>
                  </button>
                  <div className="p-2.5 px-3 rounded-md bg-[#0d1412] border border-[#1a2824] text-right hidden sm:block">
                    <span className="text-[9px] font-mono uppercase text-neutral-400 block">
                      DYNAMIC FORECAST
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {adaptiveData.projectedCompletionWindow || 'Day 87–91'}
                    </span>
                  </div>
                  <Link
                    to="/progress"
                    className="min-h-[44px] px-3.5 py-2 rounded-md bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-mono flex items-center gap-1.5 transition-all"
                  >
                    <span>Capabilities</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Capability State DAG Mini-Pipeline */}
              {capabilitiesList.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#07CB6C]" />
                      CAPABILITY STATE TRANSITIONS ({verifiedCapsCount}/{totalCapsCount} VERIFIED)
                    </span>
                    <span className="text-[#07CB6C] font-semibold">{verifiedProgressPct}% MASTERY</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {capabilitiesList.map((cap) => {
                      const stateCfg = STATE_CONFIG[cap.state] || STATE_CONFIG.UNTESTED;
                      const isBottleneck = adaptiveData.activeBottleneck?.id === cap.id;
                      return (
                        <div
                          key={cap.id}
                          className={`p-2.5 rounded border transition-all ${stateCfg.bgClass} ${stateCfg.borderClass} ${
                            isBottleneck ? 'ring-1 ring-amber-500/50' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className="text-xs font-semibold text-white truncate">{cap.name}</span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase ${stateCfg.textClass} ${stateCfg.borderClass}`}
                            >
                              {stateCfg.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 line-clamp-1">{cap.description}</p>
                          {isBottleneck && (
                            <span className="text-[9px] font-mono text-amber-400 font-bold uppercase tracking-wider block mt-1">
                              ⚡ ACTIVE BOTTLENECK
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ---------------------------------------------------- */}
            {/* 1. HERO WORKBENCH HEADER ("DAILY ACTION // MVD")      */}
            {/* ---------------------------------------------------- */}
            {adaptiveData.todayAction ? (
              <div className="p-5 sm:p-6 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-5">
                {/* Micro-Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2824] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                      DAILY WORKBENCH // MINIMUM VIABLE DAY
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-400">{formattedToday}</span>
                    <span className="px-2 py-0.5 rounded bg-[#0d1412] border border-[#1a2824] text-[10px] font-mono text-neutral-300 font-medium uppercase">
                      {adaptiveData.todayAction.priorityTier === 1
                        ? '[TIER 1 CRITICAL]'
                        : adaptiveData.todayAction.priorityTier === 2
                        ? '[TIER 2 SUPPORTIVE]'
                        : '[TIER 3 BUFFER]'}
                    </span>
                  </div>
                </div>

                {/* Session Main Presentation & Focus Timer */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left Details */}
                  <div className="space-y-3 min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-neutral-400">
                      <span className="flex items-center gap-1.5 text-white font-semibold">
                        <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                        {activeDurationMinutes} MIN DOSE
                      </span>
                      <span className="text-[#1a2824]">|</span>
                      <span className="text-neutral-300">
                        {selectedDose === 'MVS'
                          ? 'MINIMUM VIABLE SESSION'
                          : selectedDose === 'REDUCED'
                          ? 'REDUCED CAPACITY DOSE'
                          : 'STANDARD CALIBRATION DOSE'}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {adaptiveData.todayAction.actionName}
                    </h2>

                    {adaptiveData.todayAction.fallbackOptions && adaptiveData.todayAction.fallbackOptions.length > 0 && (
                      <p className="text-xs font-mono text-neutral-400 leading-relaxed bg-[#0d1412] p-2.5 rounded border border-[#1a2824]">
                        <span className="text-amber-400 font-semibold uppercase block mb-0.5">MVS Fallback Option:</span>
                        {adaptiveData.todayAction.fallbackOptions[0]}
                      </p>
                    )}

                    {/* Dose Level Selector Buttons */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">DOSE:</span>
                      <button
                        type="button"
                        onClick={() => handleSelectDose('STANDARD')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                          selectedDose === 'STANDARD'
                            ? 'bg-[#07CB6C]/20 border border-[#07CB6C] text-[#07CB6C] font-bold'
                            : 'bg-[#0d1412] border border-[#1a2824] text-neutral-400 hover:text-white'
                        }`}
                      >
                        Standard ({adaptiveData.todayAction.standardDoseMinutes || 45}m)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDose('REDUCED')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                          selectedDose === 'REDUCED'
                            ? 'bg-amber-500/20 border border-amber-500 text-amber-400 font-bold'
                            : 'bg-[#0d1412] border border-[#1a2824] text-neutral-400 hover:text-white'
                        }`}
                      >
                        Reduced ({adaptiveData.todayAction.reducedDoseMinutes || 30}m)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDose('MVS')}
                        className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                          selectedDose === 'MVS'
                            ? 'bg-sky-500/20 border border-sky-500 text-sky-400 font-bold'
                            : 'bg-[#0d1412] border border-[#1a2824] text-neutral-400 hover:text-white'
                        }`}
                      >
                        MVS ({adaptiveData.todayAction.mvsDoseMinutes || 15}m)
                      </button>
                    </div>
                  </div>

                  {/* Right Actions & Focus Module */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    {/* Inline Focus Countdown Mode */}
                    {isFocusActive ? (
                      <div className="flex items-center gap-2 bg-[#0d1412] border border-[#07CB6C]/40 px-3.5 py-1.5 rounded-md">
                        <div className="space-y-0.5 min-w-[70px]">
                          <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider block">
                            FOCUS REMAINING
                          </span>
                          <span className="text-base font-mono font-bold text-[#07CB6C]">
                            {Math.floor(focusSecondsLeft / 60)
                              .toString()
                              .padStart(2, '0')}
                            :
                            {(focusSecondsLeft % 60).toString().padStart(2, '0')}
                          </span>
                          <div className="w-16 bg-[#080d0b] h-1 rounded-full overflow-hidden border border-[#1a2824]">
                            <div
                              className="bg-[#07CB6C] h-full transition-all"
                              style={{
                                width: `${
                                  focusTotalSeconds > 0
                                    ? Math.min(
                                        100,
                                        Math.round(((focusTotalSeconds - focusSecondsLeft) / focusTotalSeconds) * 100)
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsFocusPaused(!isFocusPaused)}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#16221e] hover:bg-[#1f332c] text-neutral-200 border border-[#1a2824] transition-colors cursor-pointer"
                          title={isFocusPaused ? 'Resume Focus' : 'Pause Focus'}
                        >
                          {isFocusPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleStopFocus}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded bg-[#16221e] hover:bg-[#1f332c] text-neutral-400 hover:text-white border border-[#1a2824] transition-colors cursor-pointer"
                          title="Reset Focus Timer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartFocus}
                        disabled={actionLoading}
                        className="min-h-[44px] px-4 py-2 rounded-md bg-[#0d1412] hover:bg-[#16221e] text-[#07CB6C] text-xs font-mono font-semibold border border-[#1a2824] hover:border-[#07CB6C]/40 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <Play className="w-3.5 h-3.5 text-[#07CB6C]" />
                        <span>START FOCUS</span>
                      </button>
                    )}

                    {/* Primary Action: Mark Completed */}
                    <button
                      type="button"
                      onClick={handleMarkCompleted}
                      disabled={actionLoading}
                      className="min-h-[44px] px-5 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#080d0b]" />
                      ) : (
                        <Check className="w-4 h-4 stroke-[3]" />
                      )}
                      <span>LOG TELEMETRY</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Serene "Cadence Satisfied for Today" status card */
              <div className="p-6 sm:p-7 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C] shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                          DAILY CADENCE // STATUS SATISFIED
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-[10px] font-mono font-bold">
                          100% NOMINAL
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        Cadence Satisfied for Today
                      </h2>
                      <p className="text-xs font-mono text-neutral-400 max-w-xl leading-relaxed">
                        No critical-path obligations remaining for today. System trajectory is nominal — rest, review buffer, or continue unassisted practice.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-md bg-[#0d1412] border border-[#1a2824] text-xs font-mono space-y-1.5 shrink-0 min-w-[220px]">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <CalendarIcon className="w-3 h-3 text-[#07CB6C]" />
                      ADAPTIVE TRAJECTORY
                    </span>
                    <span className="text-white font-semibold block">
                      Projected Window: {adaptiveData.projectedCompletionWindow}
                    </span>
                    <span className="text-neutral-400 text-[11px] block">
                      Confidence: {adaptiveData.confidenceLevel}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 2. ADAPTIVE TELEMETRY ROW (3 CARDS)                  */}
            {/* ---------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: 90-Day Trajectory & Forecast */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    DYNAMIC FORECAST // HORIZON
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${integrityConfig.badgeClass}`}>
                    {integrityConfig.label}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {adaptiveData.projectedCompletionWindow || 'Day 87–91'}
                  </div>
                  <div className="text-xs font-mono text-[#07CB6C] font-semibold">
                    {verifiedCapsCount} / {totalCapsCount} CAPABILITIES UNLOCKED
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1a2824] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>WEEK {currentWeek} OF {totalWeeks}</span>
                  <span className="text-neutral-500">NO CATCH-UP DEBT</span>
                </div>
              </div>

              {/* Card 2: Reliability Margin & Capacity */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    RELIABILITY MARGIN // HEADROOM
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      adaptiveData.reliabilityMarginHours > 0
                        ? 'bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C]'
                        : 'bg-amber-400/10 border border-amber-400/30 text-amber-400'
                    }`}
                  >
                    {adaptiveData.reliabilityMarginHours > 0 ? '[OPTIMAL]' : '[CONSTRAINED]'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {adaptiveData.reliabilityMarginHours.toFixed(1)}h{' '}
                    <span className="text-sm font-normal text-neutral-500">BUFFER HEADROOM</span>
                  </div>
                  <div className="text-xs font-mono text-neutral-300">
                    Absorbs disruptions without scolding or penalty
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1a2824] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>STRATEGIC FILTERING</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                </div>
              </div>

              {/* Card 3: Latest Adaptive Decision Trace */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    DECISION TRACE // SYSTEM REASONING
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">TRANSPARENT</span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-mono text-neutral-300 line-clamp-3 leading-relaxed">
                    {adaptiveData.latestPlanUpdate || 'Trajectory progressing normally according to plan.'}
                  </p>
                </div>

                <div className="pt-1 border-t border-[#1a2824] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span className="truncate max-w-[200px]">Audited replanning</span>
                  <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 3. SCHEDULE & TRAJECTORY AGENDA                     */}
            {/* ---------------------------------------------------- */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-[#1a2824] pb-2.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                  WEEKLY EXECUTION AGENDA // ADAPTIVE TRAJECTORY
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  CONTINUOUS ROLLING SCHEDULE
                </span>
              </div>

              {/* Condensed Weekly Calendar schedule */}
              <CalendarView
                key={refreshTrigger}
                onlyShowSlippageWhenDrifted={true}
              />
            </div>

            {/* Protocol Maintenance & Discard Action */}
            <div className="pt-6 border-t border-[#1a2824] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">
                  ACTIVE PROTOCOL LIFECYCLE
                </span>
                <p className="text-xs font-mono text-neutral-400">
                  Enrolled in <strong className="text-neutral-300 font-mono">{activeUserGoal.goal_catalog?.title || 'Goal Protocol'}</strong>. Single active goal policy enforced.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsDiscardModalOpen(true)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-md bg-[#0d1412] hover:bg-red-950/20 text-neutral-400 hover:text-red-400 border border-[#1a2824] hover:border-red-500/40 text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>DISCARD PROTOCOL</span>
              </button>
            </div>

            {/* Discard Goal Typed Confirmation Modal */}
            <DiscardGoalModal
              isOpen={isDiscardModalOpen}
              goalId={activeUserGoal.id}
              goalTitle={activeUserGoal.goal_catalog?.title || 'Goal Protocol'}
              onClose={() => setIsDiscardModalOpen(false)}
              onSuccess={async () => {
                setIsDiscardModalOpen(false);
                setActiveUserGoal(null);
                setAdaptiveData(null);
                setActionFeedback({
                  type: 'success',
                  message: 'Protocol discarded. Catalog unlocked.',
                });
                await loadDashboardData();
              }}
            />
          </div>
        ) : error ? (
          <div className="rounded-md bg-[#0a0f0d] border border-rose-500/40 p-8 text-center text-rose-400 space-y-4 max-w-xl mx-auto">
            <div className="w-10 h-10 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white uppercase font-mono">
                CONNECTION TELEMETRY FAILED
              </h3>
              <p className="text-xs font-mono text-neutral-400">{error}</p>
            </div>
            <button
              onClick={loadDashboardData}
              className="min-h-[44px] px-4 py-2 rounded-md bg-[#0d1412] hover:bg-[#131f1b] text-white text-xs font-mono border border-[#1a2824] transition-colors cursor-pointer"
            >
              RETRY TELEMETRY
            </button>
          </div>
        ) : loading ? (
          <div className="rounded-md bg-[#0a0f0d] border border-[#1a2824] p-16 flex flex-col items-center justify-center text-neutral-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
            <span className="text-xs font-mono uppercase tracking-wider">
              RETRIEVING ADAPTIVE DASHBOARD...
            </span>
          </div>
        ) : (
          /* Empty state: prompt to select goal blueprint from catalog */
          <div className="rounded-md bg-[#0a0f0d] border border-[#1a2824] p-8 sm:p-12 text-center space-y-6 max-w-2xl mx-auto">
            <div className="w-12 h-12 rounded-md bg-[#0d1412] border border-[#1a2824] text-[#07CB6C] flex items-center justify-center mx-auto">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                ACHIVII EXECUTION ENGINE
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                No Active Goal Plan Initialized
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                Formalize a goal and commit your initial 90-day trajectory to activate adaptive execution.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/onboarding')}
                className="min-h-[44px] px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)]"
              >
                <span>COMMENCE GOAL FORMALIZATION</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Weekly Strategic Review Modal */}
        {isWeeklyReviewOpen && activeUserGoal && (
          <WeeklyReflection
            weekNumber={adaptiveData?.currentWeek || 1}
            userGoalId={activeUserGoal.id}
            onResolved={async () => {
              setIsWeeklyReviewOpen(false);
              setRefreshTrigger((prev) => prev + 1);
            }}
          />
        )}

        {/* Outcome Gate Verification Modal */}
        {isOutcomeGateOpen && activeUserGoal && (
          <GraduationModal
            userGoalId={activeUserGoal.id}
            goalTitle={adaptiveData?.outcomeStatement || activeUserGoal.goal_catalog?.title}
            onResolved={async () => {
              setIsOutcomeGateOpen(false);
              setRefreshTrigger((prev) => prev + 1);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
