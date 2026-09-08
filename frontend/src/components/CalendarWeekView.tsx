import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getLocalDateString, getTodayDateString } from '../lib/dateUtils';
import { fetchWeekSessions, triggerReschedule, updateSession, fetchPendingRecovery, fetchPendingWeeklyReflection, fetchGraduationStatus } from '../lib/api';
import { WeekSessionsResponse, Session, DayOfWeek, AvailabilitySlot, RescheduleResult, PendingRecoveryState, PendingReflectionState, GraduationState } from '../types';
import { SlippageBanner } from './SlippageBanner';
import { RecoveryCheckIn } from './RecoveryCheckIn';
import { WeeklyReflection } from './WeeklyReflection';
import { GraduationModal } from './GraduationModal';
import { SessionDetailModal } from './SessionDetailModal';
import { DayDetailModal } from './DayDetailModal';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Sun, 
  Sunset, 
  Moon, 
  Loader2, 
  Sparkles,
  Layers,
  Briefcase,
  CheckCircle2,
  Circle,
  Eye,
  Zap
} from 'lucide-react';

const DAY_ORDER: { key: DayOfWeek | 'SUN'; name: string; short: string; jsIndex: number }[] = [
  { key: 'MON', name: 'Monday', short: 'Mon', jsIndex: 1 },
  { key: 'TUE', name: 'Tuesday', short: 'Tue', jsIndex: 2 },
  { key: 'WED', name: 'Wednesday', short: 'Wed', jsIndex: 3 },
  { key: 'THU', name: 'Thursday', short: 'Thu', jsIndex: 4 },
  { key: 'FRI', name: 'Friday', short: 'Fri', jsIndex: 5 },
  { key: 'SAT', name: 'Saturday', short: 'Sat', jsIndex: 6 },
  { key: 'SUN', name: 'Sunday', short: 'Sun', jsIndex: 0 },
];

interface CalendarWeekViewProps {
  initialWeekOffset?: number;
  onWeekChange?: (weekOffset: number) => void;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({ 
  initialWeekOffset = 0,
  onWeekChange 
}) => {
  const { token, user } = useAuth();
  const [weekOffset, setWeekOffset] = useState<number>(initialWeekOffset);
  const [data, setData] = useState<WeekSessionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction modals
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    name: string;
    sessions: Session[];
    busySlots: AvailabilitySlot[];
  } | null>(null);

  // Phase 2 Recovery UX state
  const [pendingRecovery, setPendingRecovery] = useState<PendingRecoveryState | null>(null);

  // Phase 3 Weekly Reflection state
  const [pendingReflection, setPendingReflection] = useState<PendingReflectionState | null>(null);

  // Phase 5 Graduation state
  const [graduationState, setGraduationState] = useState<GraduationState | null>(null);

  // Phase 5 Rescheduling state
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);
  const [lastRescheduleResult, setLastRescheduleResult] = useState<RescheduleResult | null>(null);

  const handleTriggerReschedule = async () => {
    if (!token) return;
    setIsRescheduling(true);
    try {
      const res = await triggerReschedule(token);
      setLastRescheduleResult(res.result);
      // Reload week to get freshly positioned sessions and updated slippage
      await loadWeek(weekOffset);
    } catch (err: any) {
      alert(err.message || 'Failed to trigger adaptive rescheduling');
    } finally {
      setIsRescheduling(false);
    }
  };

  const loadWeek = async (offset: number) => {
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
        } catch (_) {
          setPendingRecovery(null);
        }
      }

      // Check weekly reflection only if recovery check-in is NOT pending (precedence rule)
      if (!isRecPending) {
        try {
          const refl = await fetchPendingWeeklyReflection(token);
          setPendingReflection(refl.pending ? refl : null);
        } catch (_) {
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
        } catch (_) {
          setGraduationState(null);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load weekly schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeek(weekOffset);
  }, [token, weekOffset]);

  const handleSessionUpdated = (updatedSession: Session) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sessions: prev.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s)),
      };
    });

    if (selectedSession?.id === updatedSession.id) {
      setSelectedSession(updatedSession);
    }
  };

  const handleToggleDoneDirect = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    if (!token) return;
    const nextStatus = session.status === 'DONE' ? 'UPCOMING' : 'DONE';
    try {
      const res = await updateSession(token, session.id, { status: nextStatus });
      handleSessionUpdated(res.session);
    } catch (err: any) {
      alert(err.message || 'Failed to update session');
    }
  };

  const handlePrevWeek = () => {
    if (weekOffset > 0) {
      setWeekOffset((prev) => prev - 1);
    }
  };

  const handleNextWeek = () => {
    if (weekOffset < 11) {
      setWeekOffset((prev) => prev + 1);
    }
  };

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-orange-400" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const todayDateString = getTodayDateString(user?.timezone);

  // Helper to group sessions by date string YYYY-MM-DD
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

  // Generate the 7 days of the requested week
  const weekDays = React.useMemo(() => {
    if (!data?.startDate) return [];
    const start = new Date(data.startDate);

    return Array.from({ length: 7 }).map((_, idx) => {
      const dayDate = new Date(start.getTime() + idx * 24 * 60 * 60 * 1000);
      const dateStr = getLocalDateString(dayDate, user?.timezone);
      const jsDay = dayDate.getDay();
      const meta = DAY_ORDER.find((d) => d.jsIndex === jsDay) || DAY_ORDER[0];

      // Busy slots for this day of week
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

  // Total scheduled minutes this week
  const totalMinutes = data?.sessions?.reduce(
    (sum, s) => sum + (s.task_template?.session_duration_minutes || 60),
    0
  ) || 0;
  const totalHours = (totalMinutes / 60).toFixed(1);

  if (loading && !data) {
    return (
      <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-slate-400 gap-3 border border-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Generating time-blocked calendar...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-rose-400 border border-rose-500/30 space-y-3">
        <p className="text-sm font-semibold">{error}</p>
        <button
          onClick={() => loadWeek(weekOffset)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const startDateFormatted = new Date(data.startDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endDateFormatted = new Date(new Date(data.endDate).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Real Recovery UX: Tier 2 Non-blocking inline check-in */}
      {pendingRecovery && pendingRecovery.pending && (
        <RecoveryCheckIn
          recoveryState={pendingRecovery}
          onResolved={async () => {
            setPendingRecovery(null);
            await loadWeek(weekOffset);
          }}
        />
      )}

      {/* Phase 3: Weekly Reflection (shown only when recovery check-in is not pending) */}
      {(!pendingRecovery || !pendingRecovery.pending) && pendingReflection && pendingReflection.pending && (
        <WeeklyReflection
          reflectionState={pendingReflection}
          onResolved={async () => {
            setPendingReflection(null);
            await loadWeek(weekOffset);
          }}
        />
      )}

      {/* Phase 5: Graduation Milestone Modal */}
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

      {/* Week Navigator & Metrics Header */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Week {data.weekNumber} of {data.totalWeeks}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {startDateFormatted} – {endDateFormatted}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>{data.goal?.title || 'Goal Schedule'}</span>
          </h2>

          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span className="font-semibold text-white">{data.phase?.title}</span>
          </div>
        </div>

        {/* Navigation buttons & Quick Metrics */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Weekly Summary Chips */}
          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-medium">
              <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                <strong className="text-white">{data.sessions.length}</strong> Sessions
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>
                <strong className="text-white">{totalHours}</strong> Hours
              </span>
            </div>
          </div>

          {/* Quick Reschedule Action Trigger */}
          <button
            id="btn-quick-reschedule"
            type="button"
            onClick={handleTriggerReschedule}
            disabled={isRescheduling}
            className="px-3 py-1.5 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            title="Scan & Recover Missed Sessions"
          >
            {isRescheduling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Adaptive Reschedule</span>
          </button>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              id="btn-prev-week"
              onClick={handlePrevWeek}
              disabled={weekOffset <= 0}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              id="btn-current-week"
              onClick={() => setWeekOffset(0)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                weekOffset === 0
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              Week 1
            </button>

            <button
              id="btn-next-week"
              onClick={handleNextWeek}
              disabled={weekOffset >= 11}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={`rounded-2xl flex flex-col justify-between transition-all border ${
              day.isToday
                ? 'glass-panel border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-lg shadow-indigo-600/10'
                : 'glass-panel border-slate-800/80 hover:border-slate-700'
            }`}
          >
            {/* Day Column Header - Clickable for Day Detail Inspection */}
            <div
              onClick={() => setSelectedDay({
                date: day.date,
                name: day.dayName,
                sessions: day.sessions,
                busySlots: day.busySlots,
              })}
              title="Click to view full chronological day timeline"
              className={`p-3.5 border-b flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors group/header ${
                day.isToday
                  ? 'border-indigo-500/30 bg-indigo-950/20'
                  : 'border-slate-800/80 bg-slate-900/40'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover/header:text-indigo-300 transition-colors flex items-center gap-1">
                  <span>{day.dayShort}</span>
                  <Eye className="w-2.5 h-2.5 opacity-0 group-hover/header:opacity-100 transition-opacity text-indigo-400" />
                </div>
                <div className="text-sm font-extrabold text-white">
                  {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>

              {day.isToday && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-bold uppercase shadow-sm">
                  Today
                </span>
              )}

              {day.dayKey === 'SUN' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-semibold">
                  Buffer
                </span>
              )}
            </div>

            {/* Day Column Body */}
            <div className="p-3 space-y-3 flex-1 flex flex-col">
              {/* Configured Busy Blocks (Collapsible/Preview) */}
              {day.busySlots.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span>Busy Routine</span>
                  </div>
                  <div className="space-y-1">
                    {day.busySlots.map((busy, bIdx) => (
                      <div
                        key={bIdx}
                        className="px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between"
                      >
                        <span className="truncate max-w-[70px]">{busy.label || 'Busy'}</span>
                        <span className="font-mono text-[9px]">{busy.start_time}–{busy.end_time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal Sessions Section */}
              <div className="space-y-2 flex-1">
                {day.sessions.length > 0 && (
                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Goal Sessions</span>
                    <span className="font-mono text-[10px]">{day.sessions.length}</span>
                  </div>
                )}

                {day.sessions.length === 0 ? (
                  <div className="h-full min-h-[90px] rounded-xl border border-dashed border-slate-800/60 p-3 flex flex-col items-center justify-center text-center text-slate-400 text-[11px]">
                    <span>Open Time</span>
                    <span className="text-[10px] text-slate-400">No session scheduled</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {day.sessions.map((session) => {
                      const isDone = session.status === 'DONE';
                      const isMissed = session.status === 'MISSED';
                      const isRescheduled = session.status === 'RESCHEDULED';

                      return (
                        <div
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={`group/card p-3 rounded-xl border transition-all space-y-2 shadow-sm cursor-pointer relative hover:scale-[1.02] ${
                            isDone
                              ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70 shadow-emerald-500/5'
                              : isMissed
                              ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/70'
                              : isRescheduled
                              ? 'bg-gradient-to-br from-amber-950/35 via-slate-900/90 to-amber-900/20 border-amber-500/50 hover:border-amber-500/80 shadow-amber-500/5'
                              : 'bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-purple-950/30 border-indigo-500/30 hover:border-indigo-500/60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className={`text-xs font-bold leading-tight transition-colors ${
                              isDone
                                ? 'text-emerald-200 line-through opacity-80'
                                : isRescheduled
                                ? 'text-amber-100 group-hover/card:text-amber-200'
                                : 'text-white group-hover/card:text-indigo-200'
                            }`}>
                              {session.task_template?.title || 'Goal Session'}
                            </h4>

                            {/* Quick Complete Action Button */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleDoneDirect(e, session)}
                              title={isDone ? 'Mark Upcoming' : 'Mark Done'}
                              className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                                isDone
                                  ? 'text-emerald-400 hover:text-slate-300'
                                  : isRescheduled
                                  ? 'text-amber-400 hover:text-emerald-400'
                                  : 'text-slate-500 hover:text-emerald-400'
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className={`px-2 py-0.5 rounded font-mono font-semibold border ${
                              isDone
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                : isRescheduled
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            }`}>
                              {session.start_time} – {session.end_time}
                            </span>
                            <span className="text-slate-400 font-mono flex items-center gap-1">
                              {getTimeIcon(session.task_template?.preferred_time_of_day)}
                              <span>{session.task_template?.session_duration_minutes || 60}m</span>
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                            <span className={`inline-flex items-center gap-1 font-semibold ${
                              isDone
                                ? 'text-emerald-400'
                                : isMissed
                                ? 'text-rose-400'
                                : isRescheduled
                                ? 'text-amber-300'
                                : 'text-indigo-300'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                isDone
                                  ? 'bg-emerald-400'
                                  : isMissed
                                  ? 'bg-rose-400'
                                  : isRescheduled
                                  ? 'bg-amber-400 animate-pulse'
                                  : 'bg-indigo-400 animate-pulse'
                              }`} />
                              {isRescheduled ? '⚡ Rescheduled' : session.status}
                            </span>
                            <span className="text-slate-400 text-[9px] truncate max-w-[80px]">
                              {session.task_template?.phase?.title?.split(':')[0] || 'P1'}
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
