import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarView } from '../components/CalendarView';
import {
  fetchCurrentUserGoal,
  fetchHealthCheck,
  fetchWeekSessions,
  fetchGoalProgress,
  updateSession,
  triggerReschedule,
} from '../lib/api';
import { getLocalDateString, getTodayDateString } from '../lib/dateUtils';
import { UserGoal, WeekSessionsResponse, GoalProgressResponse, Session } from '../types';
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
} from 'lucide-react';

function timeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getSessionDuration(session: Session): number {
  if (session.task_template?.session_duration_minutes) {
    return session.task_template.session_duration_minutes;
  }
  if (session.start_time && session.end_time) {
    const diff = timeToMinutes(session.end_time) - timeToMinutes(session.start_time);
    if (diff > 0) return diff;
  }
  return 45;
}

export const Dashboard: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [weekData, setWeekData] = useState<WeekSessionsResponse | null>(null);
  const [progressData, setProgressData] = useState<GoalProgressResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Action states for Hero workbench
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Focus Timer state for deep execution
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
        // Parallel fetch current week sessions (offset 0) and goal progress metrics
        const [weekRes, progRes] = await Promise.all([
          fetchWeekSessions(token, 0).catch(() => null),
          fetchGoalProgress(token).catch(() => null),
        ]);
        setWeekData(weekRes);
        setProgressData(progRes);
      } else {
        setWeekData(null);
        setProgressData(null);
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
  const todayDateStr = useMemo(() => {
    return getTodayDateString(user?.timezone);
  }, [user?.timezone]);

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

  // Identify sessions scheduled for today
  const todaySessions = useMemo(() => {
    if (!weekData?.sessions) return [];
    return weekData.sessions.filter((s) => {
      if (!s.scheduled_date) return false;
      return getLocalDateString(s.scheduled_date, user?.timezone) === todayDateStr;
    });
  }, [weekData?.sessions, todayDateStr, user?.timezone]);

  // Today's actionable current/next session (UPCOMING or RESCHEDULED)
  const nextSessionToday = useMemo(() => {
    const pending = todaySessions
      .filter((s) => s.status === 'UPCOMING' || s.status === 'RESCHEDULED')
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return pending.length > 0 ? pending[0] : null;
  }, [todaySessions]);

  // If no sessions remain today, find the next upcoming session across the week
  const nextUpcomingSession = useMemo(() => {
    if (nextSessionToday) return null;
    if (!weekData?.sessions) return null;

    const upcoming = weekData.sessions
      .filter((s) => {
        if (s.status !== 'UPCOMING' && s.status !== 'RESCHEDULED') return false;
        if (!s.scheduled_date) return false;
        const dateStr = getLocalDateString(s.scheduled_date, user?.timezone);
        return dateStr >= todayDateStr;
      })
      .sort((a, b) => {
        const dateA = getLocalDateString(a.scheduled_date, user?.timezone);
        const dateB = getLocalDateString(b.scheduled_date, user?.timezone);
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.start_time.localeCompare(b.start_time);
      });

    return upcoming.length > 0 ? upcoming[0] : null;
  }, [nextSessionToday, weekData?.sessions, todayDateStr, user?.timezone]);

  // Format the upcoming session's scheduled date string
  const formattedUpcomingTime = useMemo(() => {
    if (!nextUpcomingSession?.scheduled_date) return null;
    try {
      const dateStr = getLocalDateString(nextUpcomingSession.scheduled_date, user?.timezone);
      const isTomorrow = (() => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return dateStr === getLocalDateString(tomorrow, user?.timezone);
      })();

      if (isTomorrow) {
        return `Tomorrow at ${nextUpcomingSession.start_time}`;
      }

      const d = new Date(nextUpcomingSession.scheduled_date);
      const dayName = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: user?.timezone || 'UTC',
      }).format(d);

      return `${dayName} at ${nextUpcomingSession.start_time}`;
    } catch {
      return `Next at ${nextUpcomingSession.start_time}`;
    }
  }, [nextUpcomingSession, user?.timezone]);

  // Primary Action: Mark Completed
  const handleMarkCompleted = async (session: Session) => {
    if (!token) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await updateSession(token, session.id, { status: 'DONE' });
      setActionFeedback({
        type: 'success',
        message: `Milestone verified: "${session.task_template?.title || 'Session'}" marked complete.`,
      });
      setIsFocusActive(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to update session status.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Primary Action Alternative: Start/Toggle Focus
  const handleStartFocus = (session: Session) => {
    const duration = getSessionDuration(session);
    setFocusTotalSeconds(duration * 60);
    setFocusSecondsLeft(duration * 60);
    setIsFocusPaused(false);
    setIsFocusActive(true);
  };

  const handleStopFocus = () => {
    setIsFocusActive(false);
    setIsFocusPaused(false);
  };

  // Secondary Action: Defer to Buffer
  const handleDeferToBuffer = async (session: Session) => {
    if (!token) return;
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await triggerReschedule(token, session.id);
      const detail =
        res.result?.actions?.[0]?.details ||
        'Session reallocated to upcoming buffer capacity.';
      setActionFeedback({
        type: 'success',
        message: `Cadence preserved: ${detail}`,
      });
      setIsFocusActive(false);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Adaptive reallocation failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ----------------------------------------------------
  // Telemetry Calculations (Streamlined 3 Cards)
  // ----------------------------------------------------

  // Card 1: 90-Day Trajectory
  const currentWeekNumber = progressData?.metrics?.currentWeek || weekData?.weekNumber || 1;
  const totalWeeks = progressData?.metrics?.totalWeeks || weekData?.totalWeeks || 12;
  const milestoneCompletionPct = progressData?.metrics?.completionPercentage || 0;
  const slippageDays = activeUserGoal?.slippage_days || weekData?.goal?.slippage_days || 0;
  const isPaceNominal = slippageDays === 0;

  // Card 2: Weekly Hours Logged
  const currentWeekSessions = weekData?.sessions || [];
  const executedMinutesThisWeek = currentWeekSessions
    .filter((s) => s.status === 'DONE')
    .reduce((acc, s) => acc + getSessionDuration(s), 0);
  const executedHoursThisWeek = executedMinutesThisWeek / 60;

  const targetWeeklyHours = useMemo(() => {
    if (activeUserGoal?.goal_catalog?.est_weekly_hours) {
      return activeUserGoal.goal_catalog.est_weekly_hours;
    }
    const scheduledMinutes = currentWeekSessions.reduce(
      (acc, s) => acc + getSessionDuration(s),
      0
    );
    return scheduledMinutes > 0 ? scheduledMinutes / 60 : 5.0;
  }, [activeUserGoal?.goal_catalog?.est_weekly_hours, currentWeekSessions]);

  const weeklyProgressPct = targetWeeklyHours > 0
    ? Math.min(100, Math.round((executedHoursThisWeek / targetWeeklyHours) * 100))
    : 0;

  // Card 3: Buffer Capacity Status
  const bufferSessionsThisWeek = currentWeekSessions.filter((s) => {
    const isBufferTier = s.tier === 'buffer' || s.status === 'RESCHEDULED';
    const title = s.task_template?.title?.toLowerCase() || '';
    return isBufferTier || title.includes('buffer');
  });

  const activeBufferSlotsRemaining = bufferSessionsThisWeek.filter(
    (s) => s.status !== 'DONE' && s.status !== 'MISSED'
  ).length;

  const totalBufferSlotsThisWeek = Math.max(bufferSessionsThisWeek.length, 1);
  const isBufferOptimal = activeBufferSlotsRemaining > 0;

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white relative min-h-screen">
      {/* Global Navigation */}
      <Navbar apiStatus={apiStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {activeUserGoal && activeUserGoal.goal_catalog ? (
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
            {/* 1. HERO WORKBENCH HEADER ("NEXT UP")                 */}
            {/* ---------------------------------------------------- */}
            {nextSessionToday ? (
              <div className="p-5 sm:p-6 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-5">
                {/* Micro-Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2824] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                      DAILY WORKBENCH // PRIMARY OBJECTIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-neutral-400">
                      {formattedToday}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#0d1412] border border-[#1a2824] text-[10px] font-mono text-neutral-300 font-medium uppercase">
                      {nextSessionToday.tier === 'buffer'
                        ? '[BUFFER SESSION]'
                        : nextSessionToday.tier === 'reflect'
                        ? '[REFLECTION]'
                        : '[CORE CADENCE]'}
                    </span>
                  </div>
                </div>

                {/* Session Main Presentation & Focus Timer */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Left Details */}
                  <div className="space-y-2 min-w-0 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-neutral-400">
                      <span className="flex items-center gap-1.5 text-white font-semibold">
                        <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                        {nextSessionToday.start_time} – {nextSessionToday.end_time}
                      </span>
                      <span className="text-[#1a2824]">|</span>
                      <span className="text-neutral-300">
                        {getSessionDuration(nextSessionToday)} MIN ESTIMATED
                      </span>
                      {nextSessionToday.task_template?.preferred_time_of_day && (
                        <>
                          <span className="text-[#1a2824]">|</span>
                          <span className="text-neutral-400 uppercase">
                            {nextSessionToday.task_template.preferred_time_of_day} SLOT
                          </span>
                        </>
                      )}
                    </div>

                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {nextSessionToday.task_template?.title || 'Scheduled Daily Focus'}
                    </h1>

                    <p className="text-xs font-mono text-neutral-400 leading-relaxed">
                      {activeUserGoal.goal_catalog.title} // Phase{' '}
                      {weekData?.phase?.phase_order || 1}: {weekData?.phase?.title || 'Execution Phase'}
                    </p>
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
                                width: `${focusTotalSeconds > 0 ? Math.min(100, Math.round(((focusTotalSeconds - focusSecondsLeft) / focusTotalSeconds) * 100)) : 0}%`,
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
                        onClick={() => handleStartFocus(nextSessionToday)}
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
                      onClick={() => handleMarkCompleted(nextSessionToday)}
                      disabled={actionLoading}
                      className="min-h-[44px] px-5 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-40"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#080d0b]" />
                      ) : (
                        <Check className="w-4 h-4 stroke-[3]" />
                      )}
                      <span>MARK COMPLETED</span>
                    </button>

                    {/* Secondary Action: Defer to Buffer */}
                    <button
                      type="button"
                      onClick={() => handleDeferToBuffer(nextSessionToday)}
                      disabled={actionLoading}
                      className="min-h-[44px] px-3.5 py-2 rounded-md bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white text-xs font-mono border border-[#1a2824] hover:border-amber-500/40 flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                      title="Defer session to an open buffer slot this week"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>DEFER TO BUFFER</span>
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
                          100% COMPLETE
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        Cadence Satisfied for Today
                      </h2>
                      <p className="text-xs font-mono text-neutral-400 max-w-xl leading-relaxed">
                        All scheduled sessions completed or nominal cadence preserved. System trajectory is nominal — rest or review buffer.
                      </p>
                    </div>
                  </div>

                  {/* Next session preview */}
                  <div className="p-3.5 rounded-md bg-[#0d1412] border border-[#1a2824] text-xs font-mono space-y-1.5 shrink-0 min-w-[220px]">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                      <CalendarIcon className="w-3 h-3 text-[#07CB6C]" />
                      NEXT UPCOMING SESSION
                    </span>
                    {nextUpcomingSession && formattedUpcomingTime ? (
                      <div>
                        <span className="text-white font-semibold block">
                          {formattedUpcomingTime}
                        </span>
                        <span className="text-neutral-400 text-[11px] truncate block max-w-[240px]">
                          {nextUpcomingSession.task_template?.title || 'Next Session'} (
                          {getSessionDuration(nextUpcomingSession)}m)
                        </span>
                      </div>
                    ) : (
                      <span className="text-neutral-400 block text-[11px]">
                        Weekly schedule fully executed. Next cycle commences next Monday.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* 2. STREAMLINED TELEMETRY ROW (3 CARDS ONLY)          */}
            {/* ---------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: 90-Day Trajectory */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    TELEMETRY // 90-DAY HORIZON
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                      isPaceNominal
                        ? 'bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C]'
                        : 'bg-amber-400/10 border border-amber-400/30 text-amber-400'
                    }`}
                  >
                    {isPaceNominal ? '[NOMINAL]' : `[+${slippageDays}D DRIFT]`}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    WEEK {String(currentWeekNumber).padStart(2, '0')}{' '}
                    <span className="text-sm font-normal text-neutral-500">/ {totalWeeks}</span>
                  </div>
                  <div className="text-xs font-mono text-[#07CB6C] font-semibold">
                    {milestoneCompletionPct}% MILESTONE PROGRESS
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1a2824] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span>
                    {progressData?.metrics?.completedSessions || 0} /{' '}
                    {progressData?.metrics?.totalSessions || 60} SESSIONS LOGGED
                  </span>
                  <span className="text-neutral-500">DETERMINISTIC</span>
                </div>
              </div>

              {/* Card 2: Weekly Hours Logged */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    TELEMETRY // WEEKLY HOURS
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    WEEK {String(weekData?.weekNumber || 1).padStart(2, '0')} QUOTA
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {executedHoursThisWeek.toFixed(1)}h{' '}
                    <span className="text-sm font-normal text-neutral-500">
                      / {targetWeeklyHours.toFixed(1)}h TARGET
                    </span>
                  </div>

                  {/* Mint Progress Bar */}
                  <div className="w-full bg-[#0d1412] h-2 rounded-full overflow-hidden border border-[#1a2824]">
                    <div
                      className="bg-[#07CB6C] h-full transition-all duration-500 rounded-full"
                      style={{ width: `${weeklyProgressPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1a2824] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span className="text-[#07CB6C] font-semibold">
                    {weeklyProgressPct}% EXECUTED
                  </span>
                  <span>
                    {currentWeekSessions.filter((s) => s.status === 'DONE').length} /{' '}
                    {currentWeekSessions.length} SESSIONS
                  </span>
                </div>
              </div>

              {/* Card 3: Buffer Capacity Status */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    TELEMETRY // BUFFER CAPACITY
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                      isBufferOptimal
                        ? 'bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C]'
                        : 'bg-amber-400/10 border border-amber-400/30 text-amber-400'
                    }`}
                  >
                    {isBufferOptimal ? '[OPTIMAL]' : '[DRAINED]'}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {activeBufferSlotsRemaining}{' '}
                    <span className="text-sm font-normal text-neutral-500">
                      / {totalBufferSlotsThisWeek} ACTIVE SLOTS
                    </span>
                  </div>
                  <div className="text-xs font-mono text-neutral-300">
                    {isBufferOptimal
                      ? 'Resilience headroom available'
                      : 'Zero buffer slots remaining this week'}
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1a2824] flex items-center justify-between text-[11px] font-mono text-neutral-400">
                  <span className="truncate max-w-[230px]">
                    {isBufferOptimal
                      ? 'Protects 90-day trajectory from slippage'
                      : 'Reallocation required upon next miss'}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- */}
            {/* 3. SCHEDULE & RECOVERY INTEGRATION                   */}
            {/* ---------------------------------------------------- */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-[#1a2824] pb-2.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                  WEEKLY EXECUTION AGENDA // ROLLING GRID
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  SCHEDULE DRIFT & RECOVERY INTEGRATED
                </span>
              </div>

              {/* Condensed Weekly Calendar schedule with SlippageBanner only when drifted */}
              <CalendarView
                key={refreshTrigger}
                onlyShowSlippageWhenDrifted={true}
              />
            </div>
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
              RETRIEVING DASHBOARD TELEMETRY...
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
                Choose a pre-scoped 3-month blueprint from our catalog to generate your tailored, time-blocked execution calendar.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('/')}
                className="min-h-[44px] px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-bold inline-flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)]"
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
