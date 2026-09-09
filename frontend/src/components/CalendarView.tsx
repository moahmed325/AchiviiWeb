import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchWeekSessions, 
  updateSession, 
  triggerReschedule, 
  fetchPendingRecovery, 
  fetchPendingWeeklyReflection, 
  fetchGraduationStatus 
} from '../lib/api';
import { getLocalDateString } from '../lib/dateUtils';
import { 
  Session, 
  WeekSessionsResponse, 
  AvailabilitySlot, 
  RescheduleResult, 
  PendingRecoveryState, 
  PendingReflectionState, 
  GraduationState,
  DayOfWeek
} from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Loader2, 
  Sun, 
  Sunset, 
  Moon, 
  Briefcase,
  Zap,
  Eye
} from 'lucide-react';
import { SessionDetailModal } from './SessionDetailModal';
import { DayDetailModal } from './DayDetailModal';
import { SlippageBanner } from './SlippageBanner';
import { RecoveryCheckIn } from './RecoveryCheckIn';
import { WeeklyReflection } from './WeeklyReflection';
import { GraduationModal } from './GraduationModal';

const DAY_ORDER: { key: DayOfWeek | 'SUN'; name: string; short: string; jsIndex: number }[] = [
  { key: 'MON', name: 'Monday', short: 'MON', jsIndex: 1 },
  { key: 'TUE', name: 'Tuesday', short: 'TUE', jsIndex: 2 },
  { key: 'WED', name: 'Wednesday', short: 'WED', jsIndex: 3 },
  { key: 'THU', name: 'Thursday', short: 'THU', jsIndex: 4 },
  { key: 'FRI', name: 'Friday', short: 'FRI', jsIndex: 5 },
  { key: 'SAT', name: 'Saturday', short: 'SAT', jsIndex: 6 },
  { key: 'SUN', name: 'Sunday', short: 'SUN', jsIndex: 0 },
];

export interface CalendarViewProps {
  initialWeekOffset?: number;
  onWeekChange?: (weekOffset: number) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  initialWeekOffset = 0,
  onWeekChange,
}) => {
  const { token, user } = useAuth();
  const [weekOffset, setWeekOffset] = useState<number>(initialWeekOffset);
  const [data, setData] = useState<WeekSessionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [lastRescheduleResult, setLastRescheduleResult] = useState<RescheduleResult | null>(null);

  // Recovery & Reflection State
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecoveryState | null>(null);
  const [pendingReflection, setPendingReflection] = useState<PendingReflectionState | null>(null);
  const [graduationState, setGraduationState] = useState<GraduationState | null>(null);

  // Selected session for detail modal
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Selected day for day-timeline modal inspection
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    name: string;
    sessions: Session[];
    busySlots: AvailabilitySlot[];
  } | null>(null);

  const loadWeek = useCallback(async (offset: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWeekSessions(token, offset);
      setData(res);
      setWeekOffset(res.weekOffset);
      if (onWeekChange) onWeekChange(res.weekOffset);

      let isRecPending = false;
      if (res.pendingRecovery) {
        setPendingRecovery(res.pendingRecovery);
        isRecPending = !!res.pendingRecovery.pending;
      } else {
        try {
          const rec = await fetchPendingRecovery(token);
          setPendingRecovery(rec.pending ? rec : null);
          isRecPending = !!rec.pending;
        } catch {
          setPendingRecovery(null);
        }
      }

      // Check weekly reflection only if recovery check-in is NOT pending (precedence rule)
      if (!isRecPending) {
        try {
          const refl = await fetchPendingWeeklyReflection(token);
          setPendingReflection(refl.pending ? refl : null);
        } catch {
          setPendingReflection(null);
        }
      } else {
        setPendingReflection(null);
      }

      // Check graduation milestone eligibility lazily
      if (res.goal?.id) {
        try {
          const grad = await fetchGraduationStatus(token, res.goal.id);
          setGraduationState(grad.eligible ? grad : null);
        } catch {
          setGraduationState(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load weekly schedule.');
    } finally {
      setLoading(false);
    }
  }, [token, onWeekChange]);

  useEffect(() => {
    loadWeek(weekOffset);
  }, [loadWeek, weekOffset]);

  const handlePrevWeek = () => {
    if (weekOffset > 0) {
      const newOffset = weekOffset - 1;
      setWeekOffset(newOffset);
      onWeekChange?.(newOffset);
    }
  };

  const handleNextWeek = () => {
    if (weekOffset < 11) {
      const newOffset = weekOffset + 1;
      setWeekOffset(newOffset);
      onWeekChange?.(newOffset);
    }
  };

  const handleTriggerReschedule = async () => {
    if (!token) return;
    setIsRescheduling(true);
    try {
      const res = await triggerReschedule(token);
      setLastRescheduleResult(res.result);
      await loadWeek(weekOffset);
    } catch (err: any) {
      alert(err.message || 'Rescheduling check failed.');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleToggleDoneDirect = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    if (!token) return;
    try {
      const nextStatus = session.status === 'DONE' ? 'UPCOMING' : 'DONE';
      const res = await updateSession(token, session.id, { status: nextStatus });
      handleSessionUpdated(res.session);
    } catch (err: any) {
      alert(err.message || 'Failed to toggle session status');
    }
  };

  const handleSessionUpdated = (updatedSession: Session) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });
    if (selectedSession && selectedSession.id === updatedSession.id) {
      setSelectedSession(updatedSession);
    }
  };

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3 h-3 text-[#f59e0b]" />;
      case 'afternoon':
        return <Sunset className="w-3 h-3 text-[#f59e0b]" />;
      case 'evening':
        return <Moon className="w-3 h-3 text-[#a6b8ad]" />;
      default:
        return <Clock className="w-3 h-3 text-[#7e8f85]" />;
    }
  };

  const getSessionTier = (s: Session): 'core' | 'buffer' | 'reflect' => {
    if (s.tier) return s.tier;
    const title = s.task_template?.title?.toLowerCase() || '';
    if (title.includes('reflect') || title.includes('review') || title.includes('retrospective')) return 'reflect';
    if (s.status === 'RESCHEDULED' || title.includes('buffer')) return 'buffer';
    return 'core';
  };

  const todayDateString = React.useMemo(() => {
    return getLocalDateString(new Date(), user?.timezone);
  }, [user?.timezone]);

  const sessionsByDate: Record<string, Session[]> = {};
  if (data?.sessions) {
    for (const session of data.sessions) {
      if (!session.scheduled_date) continue;
      const dateStr = getLocalDateString(session.scheduled_date, user?.timezone);
      if (!sessionsByDate[dateStr]) {
        sessionsByDate[dateStr] = [];
      }
      sessionsByDate[dateStr].push(session);
    }
  }

  const weekDays = React.useMemo(() => {
    if (!data?.startDate) return [];
    const start = new Date(data.startDate);

    return Array.from({ length: 7 }).map((_, idx) => {
      const dayDate = new Date(start.getTime() + idx * 24 * 60 * 60 * 1000);
      const dateStr = getLocalDateString(dayDate, user?.timezone);
      const jsDay = dayDate.getDay();
      const meta = DAY_ORDER.find((d) => d.jsIndex === jsDay) || DAY_ORDER[0];

      const busySlots = data.availabilitySlots?.filter((s) => s.day_of_week === meta.key) || [];
      const daySessions = sessionsByDate[dateStr] || [];

      return {
        date: dayDate,
        dateStr,
        dayName: meta.name,
        dayShort: meta.short,
        dayKey: meta.key,
        isToday: dateStr === todayDateString,
        busySlots,
        sessions: daySessions,
      };
    });
  }, [data, todayDateString]);

  const totalMinutes = data?.sessions?.reduce(
    (sum, s) => sum + (s.task_template?.session_duration_minutes || 60),
    0
  ) || 0;
  const totalHours = (totalMinutes / 60).toFixed(1);
  const completedSessions = data?.sessions?.filter((s) => s.status === 'DONE').length || 0;

  if (loading && !data) {
    return (
      <div className="rounded-md bg-[#0c1210] border border-[#182621] p-12 flex flex-col items-center justify-center text-[#7e8f85] gap-3 shadow-none">
        <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
        <p className="text-xs font-mono tracking-wider uppercase">MATERIALIZING SCHEDULE TELEMETRY...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-md bg-[#0c1210] border border-[#ef4444]/40 p-8 text-center text-[#ef4444] space-y-4 shadow-none">
        <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider">
          <AlertCircle className="w-4 h-4" />
          <span>SCHEDULE SYNCHRONIZATION ERROR</span>
        </div>
        <p className="text-xs font-mono text-[#a6b8ad] max-w-md mx-auto">{error}</p>
        <button
          onClick={() => loadWeek(weekOffset)}
          className="min-h-[44px] px-4 py-2 rounded-sm bg-[#080d0b] hover:bg-[#161214] text-[#e5ebe7] text-xs font-mono border border-[#182621] transition-colors cursor-pointer"
        >
          RETRY TELEMETRY
        </button>
      </div>
    );
  }

  if (!data) return null;

  const startDateFormatted = new Date(data.startDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  }).toUpperCase();
  const endDateFormatted = new Date(new Date(data.endDate).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Tier 2 Non-blocking inline check-in */}
      {pendingRecovery && pendingRecovery.pending && (
        <RecoveryCheckIn
          recoveryState={pendingRecovery}
          sessions={data?.sessions}
          slippageDays={data?.goal?.slippage_days || 0}
          onResolved={async () => {
            setPendingRecovery(null);
            await loadWeek(weekOffset);
          }}
        />
      )}

      {/* Weekly Reflection (shown only when recovery check-in is not pending) */}
      {(!pendingRecovery || !pendingRecovery.pending) && pendingReflection && pendingReflection.pending && (
        <WeeklyReflection
          reflectionState={pendingReflection}
          onResolved={async () => {
            setPendingReflection(null);
            await loadWeek(weekOffset);
          }}
        />
      )}

      {/* Graduation Milestone Modal */}
      {graduationState && graduationState.eligible && (
        <GraduationModal
          graduationState={graduationState}
          onResolved={async () => {
            setGraduationState(null);
            await loadWeek(weekOffset);
          }}
        />
      )}

      {/* Adaptive Rescheduling & Slippage Pacing Banner */}
      <SlippageBanner
        slippageDays={data.goal?.slippage_days || 0}
        startDate={data.goal?.start_date || data.startDate}
        targetEndDate={data.goal?.target_end_date || data.endDate}
        onTriggerReschedule={handleTriggerReschedule}
        isRescheduling={isRescheduling}
        lastRescheduleResult={lastRescheduleResult}
      />

      {/* Week Navigator & Metrics Instrumentation Panel */}
      <div className="rounded-md bg-[#0c1210] border border-[#182621] p-4 sm:p-5 shadow-none space-y-4">
        {/* Section Header Micro-Label */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#182621] pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#07CB6C] uppercase">
                WEEK {String(data.weekNumber).padStart(2, '0')} // 12-WEEK BLUEPRINT
              </span>
              <span className="text-[10px] font-mono text-[#7e8f85]">
                [{startDateFormatted} – {endDateFormatted}]
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-[#e5ebe7] truncate">
              {data.goal?.title || 'Goal Schedule'}
            </h2>

            <div className="flex items-center gap-2 text-xs font-mono text-[#7e8f85]">
              <span className="text-[#07CB6C]">PHASE {data.phase?.phase_order || 1}:</span>
              <span className="text-[#a6b8ad] truncate">{data.phase?.title}</span>
            </div>
          </div>

          {/* Navigation Stepper Controls & Quick Reschedule */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-end pt-2 md:pt-0">
            {/* Quick Reschedule Action Trigger */}
            <button
              id="btn-quick-reschedule"
              type="button"
              onClick={handleTriggerReschedule}
              disabled={isRescheduling}
              className="min-h-[44px] px-3.5 py-2 rounded-sm bg-[#080d0b] hover:bg-[#16140d] border border-[#182621] hover:border-[#f59e0b]/40 text-[#f59e0b] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="Scan and Recover Missed Sessions"
            >
              {isRescheduling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
              )}
              <span>ADAPTIVE RESCHEDULE</span>
            </button>

            {/* Week Stepper Buttons */}
            <div className="flex items-center gap-1 bg-[#080d0b] p-1 rounded-sm border border-[#182621]">
              <button
                id="btn-prev-week"
                onClick={handlePrevWeek}
                disabled={weekOffset <= 0}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#111a17] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                id="btn-current-week"
                onClick={() => setWeekOffset(0)}
                className={`min-h-[44px] px-3 text-xs font-mono font-semibold rounded-sm transition-colors cursor-pointer flex items-center justify-center ${
                  weekOffset === 0
                    ? 'bg-[#16221e] text-[#07CB6C] border border-[#1f332c]'
                    : 'text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#111a17]'
                }`}
              >
                WEEK 1
              </button>

              <button
                id="btn-next-week"
                onClick={handleNextWeek}
                disabled={weekOffset >= 11}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#111a17] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Telemetry Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
          <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621]">
            <div className="text-[10px] text-[#7e8f85] uppercase">TOTAL SESSIONS</div>
            <div className="text-sm font-bold text-[#e5ebe7] mt-0.5">{data.sessions.length} UNITS</div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621]">
            <div className="text-[10px] text-[#7e8f85] uppercase">ESTIMATED RUNTIME</div>
            <div className="text-sm font-bold text-[#e5ebe7] mt-0.5">{totalHours} HOURS</div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621]">
            <div className="text-[10px] text-[#7e8f85] uppercase">COMPLETION RATE</div>
            <div className="text-sm font-bold text-[#07CB6C] mt-0.5">
              {data.sessions.length > 0 ? Math.round((completedSessions / data.sessions.length) * 100) : 0}% ({completedSessions}/{data.sessions.length})
            </div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621]">
            <div className="text-[10px] text-[#7e8f85] uppercase">PACING DRIFT</div>
            <div className={`text-sm font-bold mt-0.5 ${data.goal?.slippage_days > 0 ? 'text-[#f59e0b]' : 'text-[#07CB6C]'}`}>
              {data.goal?.slippage_days > 0 ? `+${data.goal.slippage_days} DAYS` : '0 DAYS [NOMINAL]'}
            </div>
          </div>
        </div>
      </div>

      {/* 
        7-Day Schedule Grid & Mobile Agenda Stack
        Mobile (< 768px): Collapses to vertical day-agenda stack without horizontal viewport blowout.
        Tablet/Desktop (>= 768px): Expands to md:grid md:grid-cols-7 gap-3.
      */}
      <div className="flex flex-col md:grid md:grid-cols-7 gap-3 w-full">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={`rounded-md bg-[#0c1210] flex flex-col justify-between transition-colors border shadow-none ${
              day.isToday
                ? 'border-[#07CB6C] ring-1 ring-[#07CB6C]/30'
                : 'border-[#182621] hover:border-[#2a443a]'
            }`}
          >
            {/* Day Header - Clickable for full Chrono Timeline Modal */}
            <button
              type="button"
              onClick={() => setSelectedDay({
                date: day.date,
                name: day.dayName,
                sessions: day.sessions,
                busySlots: day.busySlots,
              })}
              title="Inspect day timeline"
              className={`min-h-[44px] w-full p-3 border-b flex items-center justify-between text-left cursor-pointer transition-colors group/header ${
                day.isToday
                  ? 'border-[#07CB6C]/30 bg-[#07CB6C]/5 hover:bg-[#07CB6C]/10'
                  : 'border-[#182621] bg-[#080d0b] hover:bg-[#111a17]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-bold tracking-wider text-[#7e8f85] group-hover/header:text-[#07CB6C] transition-colors flex items-center gap-1">
                  <span>{day.dayShort}</span>
                  <Eye className="w-2.5 h-2.5 opacity-0 group-hover/header:opacity-100 transition-opacity text-[#07CB6C]" />
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-[#e5ebe7] truncate">
                  {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {day.isToday && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-[#07CB6C] text-[#050807] text-[9px] font-mono font-bold uppercase tracking-wide">
                    TODAY
                  </span>
                )}

                {day.dayKey === 'SUN' && (
                  <span className="px-1.5 py-0.5 rounded-sm bg-[#182621] border border-dashed border-[#2a443a] text-[#7e8f85] text-[9px] font-mono font-bold uppercase">
                    BUFFER
                  </span>
                )}
              </div>
            </button>

            {/* Day Column Body */}
            <div className="p-2.5 space-y-2.5 flex-1 flex flex-col justify-between">
              {/* Routine Busy Blocks Preview */}
              {day.busySlots.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[9px] font-mono text-[#55675c] uppercase tracking-wider">
                    <Briefcase className="w-2.5 h-2.5" />
                    <span>BUSY BLOCKS ({day.busySlots.length})</span>
                  </div>
                  <div className="space-y-1">
                    {day.busySlots.map((busy, bIdx) => (
                      <div
                        key={bIdx}
                        className="px-2 py-1 rounded-sm bg-[#080d0b] border border-[#182621] text-[10px] font-mono text-[#7e8f85] flex items-center justify-between gap-1"
                      >
                        <span className="truncate max-w-[80px]">{busy.label || 'Busy'}</span>
                        <span className="shrink-0 text-[9px]">{busy.start_time}–{busy.end_time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal Sessions Section */}
              <div className="space-y-2 flex-1">
                {day.sessions.length === 0 ? (
                  <div className="h-full min-h-[80px] rounded-sm border border-dashed border-[#182621] p-3 flex flex-col items-center justify-center text-center text-[#55675c] text-[10px] font-mono">
                    <span>UNRESERVED</span>
                    <span className="text-[9px] text-[#425047] mt-0.5">Open Buffer Window</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {day.sessions.map((session) => {
                      const isDone = session.status === 'DONE';
                      const isRescheduled = session.status === 'RESCHEDULED';
                      const tier = getSessionTier(session);

                      return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={`min-h-[44px] p-2.5 rounded-sm transition-colors space-y-2 cursor-pointer relative ${
                            isDone
                              ? 'bg-[#080d0b] border border-[#182621] text-[#55675c]'
                              : tier === 'core'
                              ? 'bg-[#0c1210] border border-[#07CB6C]/40 hover:border-[#07CB6C]'
                              : tier === 'buffer'
                              ? 'bg-[#0c1210] border border-dashed border-[#182621] hover:border-[#2a443a]'
                              : 'bg-[#0c1210] border border-[#1f332c] hover:border-[#07CB6C]/50'
                          }`}
                        >
                          {/* Title & Quick Check Target */}
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="min-w-0 space-y-0.5">
                              {/* Tier Micro-Tag */}
                              <div className="flex items-center gap-1.5">
                                {tier === 'core' && (
                                  <span className="text-[9px] font-mono font-bold text-[#07CB6C] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                                    [CORE]
                                  </span>
                                )}
                                {tier === 'buffer' && (
                                  <span className="text-[9px] font-mono font-bold text-[#7e8f85] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#7e8f85]" />
                                    [BUFFER]
                                  </span>
                                )}
                                {tier === 'reflect' && (
                                  <span className="text-[9px] font-mono font-bold text-[#a6b8ad] flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]" />
                                    [REFLECT]
                                  </span>
                                )}

                                {isRescheduled && (
                                  <span className="text-[9px] font-mono font-bold text-[#f59e0b]">
                                    ⚡ RESCHEDULED
                                  </span>
                                )}
                              </div>

                              <h4 className={`text-xs font-bold leading-snug truncate ${
                                isDone
                                  ? 'text-[#55675c] line-through'
                                  : isRescheduled
                                  ? 'text-[#f59e0b]'
                                  : 'text-[#e5ebe7]'
                              }`}>
                                {session.task_template?.title || 'Goal Session'}
                              </h4>
                            </div>

                            {/* Quick Complete Button - 44x44px Touch Target Compliance */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleDoneDirect(e, session)}
                              title={isDone ? 'Mark Upcoming' : 'Mark Done'}
                              className="min-h-[44px] min-w-[44px] -m-2 flex items-center justify-center rounded-sm text-[#7e8f85] hover:text-[#07CB6C] transition-colors cursor-pointer shrink-0"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-[#07CB6C]" />
                              ) : (
                                <Circle className="w-4 h-4 hover:text-[#07CB6C]" />
                              )}
                            </button>
                          </div>

                          {/* Time & Duration in Tabular Monospace */}
                          <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-[#182621]">
                            <span className="text-[#a6b8ad]">
                              {session.start_time || '09:00'} – {session.end_time || '10:00'}
                            </span>
                            <span className="text-[#7e8f85] flex items-center gap-1">
                              {getTimeIcon(session.task_template?.preferred_time_of_day)}
                              <span>{session.task_template?.session_duration_minutes || 60}M</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Session Detail & Edit Modal */}
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        onSessionUpdated={handleSessionUpdated}
      />

      {/* Day Timeline Detail Modal */}
      <DayDetailModal
        dayDate={selectedDay?.date || null}
        dayName={selectedDay?.name || ''}
        sessions={selectedDay?.sessions || []}
        busySlots={selectedDay?.busySlots || []}
        onClose={() => setSelectedDay(null)}
        onSelectSession={(s) => setSelectedSession(s)}
      />
    </div>
  );
};
