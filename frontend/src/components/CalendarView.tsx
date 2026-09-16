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
import { fetchPendingDiagnosis } from '../lib/adaptiveApi';
import type { DiagnosisPendingResponse } from '../types/adaptive';
import { getLocalDateString } from '../lib/dateUtils';
import { 
  Session, 
  WeekSessionsResponse, 
  AvailabilitySlot, 
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
  Dumbbell,
  Coffee,
  Heart,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { formatTaskTitle } from '../lib/formatters';
import { SessionDetailModal } from './SessionDetailModal';
import { DayDetailModal } from './DayDetailModal';
import { RecoveryCheckIn } from './RecoveryCheckIn';
import { WeeklyReflection } from './WeeklyReflection';
import { GraduationModal } from './GraduationModal';
import { RoutineSettingsModal } from './RoutineSettingsModal';

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
  onlyShowSlippageWhenDrifted?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  initialWeekOffset = 0,
  onWeekChange,
  onlyShowSlippageWhenDrifted: _onlyShowSlippageWhenDrifted = true,
}) => {
  const { token, user } = useAuth();
  const [weekOffset, setWeekOffset] = useState<number>(initialWeekOffset);
  const [data, setData] = useState<WeekSessionsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);

  // Recovery, Diagnosis & Reflection State
  const [pendingDiagnosis, setPendingDiagnosis] = useState<DiagnosisPendingResponse | null>(null);
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

  // Routine Settings Drawer Modal & Missed Prompt State
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState<boolean>(false);
  const [isMissedCardDismissed, setIsMissedCardDismissed] = useState<boolean>(false);

  // Live current time (e.g. "14:30") updated every 30 seconds for the live now line
  const [currentTime, setCurrentTime] = useState<string>(() => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);

  const loadWeek = useCallback(async (offset: number) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWeekSessions(token, offset);
      setData(res);
      setWeekOffset(res.weekOffset);
      if (onWeekChange) onWeekChange(res.weekOffset);

      let isDiagOrRecPending = false;

      // 1. First priority: Adaptive Strategic Diagnosis
      try {
        const diag = await fetchPendingDiagnosis(token, res.goal?.id);
        if (diag && diag.pending) {
          setPendingDiagnosis(diag);
          isDiagOrRecPending = true;
        } else {
          setPendingDiagnosis(null);
        }
      } catch {
        setPendingDiagnosis(null);
      }

      // 2. Fallback legacy recovery check-in
      if (!isDiagOrRecPending) {
        if (res.pendingRecovery) {
          setPendingRecovery(res.pendingRecovery);
          isDiagOrRecPending = !!res.pendingRecovery.pending;
        } else {
          try {
            const rec = await fetchPendingRecovery(token);
            setPendingRecovery(rec.pending ? rec : null);
            isDiagOrRecPending = !!rec.pending;
          } catch {
            setPendingRecovery(null);
          }
        }
      } else {
        setPendingRecovery(null);
      }

      // Check weekly reflection only if recovery/diagnosis check-in is NOT pending (precedence rule)
      if (!isDiagOrRecPending) {
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
    setError(null);
    try {
      await triggerReschedule(token);
      await loadWeek(weekOffset);
    } catch (err: any) {
      setError(err.message || 'Rescheduling check failed.');
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
      setError(err.message || 'Failed to toggle session status');
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
        return <Clock className="w-3 h-3 text-[#9ca3af]" />;
    }
  };

  const getBusyIcon = (label?: string | null, category?: string | null, isHappeningNow?: boolean) => {
    const text = `${label || ''} ${category || ''}`.toLowerCase();
    const activeColor = isHappeningNow ? 'text-[#07CB6C]' : '';
    if (text.includes('workout') || text.includes('gym') || text.includes('run') || text.includes('fitness') || text.includes('exercise')) {
      return <Dumbbell className={`w-3 h-3 shrink-0 ${activeColor || 'text-emerald-400'}`} />;
    }
    if (text.includes('lunch') || text.includes('meal') || text.includes('breakfast') || text.includes('coffee') || text.includes('food')) {
      return <Coffee className={`w-3 h-3 shrink-0 ${activeColor || 'text-amber-400'}`} />;
    }
    if (text.includes('dinner') || text.includes('family') || text.includes('personal') || text.includes('kid')) {
      return <Heart className={`w-3 h-3 shrink-0 ${activeColor || 'text-rose-400'}`} />;
    }
    if (text.includes('commute') || text.includes('travel') || text.includes('drive') || text.includes('transit')) {
      return <Clock className={`w-3 h-3 shrink-0 ${activeColor || 'text-blue-400'}`} />;
    }
    return <Briefcase className={`w-3 h-3 shrink-0 ${activeColor || 'text-neutral-500'}`} />;
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

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 flex flex-col items-center justify-center text-neutral-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
        <p className="text-xs font-medium text-neutral-300">Loading your schedule...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-rose-500/20 p-8 text-center text-rose-400 space-y-4">
        <div className="flex items-center justify-center gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4" />
          <span>Unable to sync schedule</span>
        </div>
        <p className="text-xs text-neutral-400 max-w-md mx-auto">{error}</p>
        <button
          onClick={() => loadWeek(weekOffset)}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-colors cursor-pointer"
        >
          Try Again
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
    <div className="space-y-6 w-full max-w-full">
      {/* Tier 2 Non-blocking inline check-in: Adaptive Strategic Diagnosis */}
      {((pendingDiagnosis && pendingDiagnosis.pending) || (pendingRecovery && pendingRecovery.pending)) && (
        <RecoveryCheckIn
          diagnosisData={pendingDiagnosis}
          recoveryState={pendingRecovery}
          userGoalId={data?.goal?.id}
          sessions={data?.sessions}
          slippageDays={data?.goal?.slippage_days || 0}
          onResolved={async () => {
            setPendingDiagnosis(null);
            setPendingRecovery(null);
            await loadWeek(weekOffset);
          }}
        />
      )}

      {/* Weekly Reflection (shown only when recovery/diagnosis check-in is not pending) */}
      {(!pendingDiagnosis || !pendingDiagnosis.pending) && (!pendingRecovery || !pendingRecovery.pending) && pendingReflection && pendingReflection.pending && (
        <WeeklyReflection
          reflectionState={pendingReflection}
          isRecoveryPending={!!((pendingDiagnosis && pendingDiagnosis.pending) || (pendingRecovery && pendingRecovery.pending))}
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

      {/* Sleek Week Header: Stepper + Date Range + Edit Routine */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              id="btn-prev-week"
              onClick={handlePrevWeek}
              disabled={weekOffset <= 0}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              id="btn-current-week"
              onClick={() => setWeekOffset(0)}
              className="px-2.5 text-xs font-semibold text-white hover:text-[#07CB6C] transition-colors"
            >
              Week {data.weekNumber}
            </button>

            <button
              id="btn-next-week"
              onClick={handleNextWeek}
              disabled={weekOffset >= 11}
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs text-neutral-400 font-mono">
            {startDateFormatted} – {endDateFormatted}
          </span>
        </div>

        <button
          id="btn-edit-routine"
          type="button"
          onClick={() => setIsRoutineModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
          title="Edit waking hours and fixed commitments"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#07CB6C]" />
          <span>Edit Routine</span>
        </button>
      </div>

      {/* Supportive Contextual Prompt when sessions from earlier in the week were missed */}
      {!isMissedCardDismissed && (() => {
        const todayLocal = new Date().toISOString().split('T')[0];
        const missedSessions = (data.sessions || []).filter((s) => {
          if (s.status === 'DONE') return false;
          if (s.status === 'MISSED') return true;
          const sDate = s.scheduled_date ? s.scheduled_date.split('T')[0] : '';
          return sDate && sDate < todayLocal;
        });

        if (missedSessions.length === 0) return null;

        return (
          <div className="p-4 rounded-2xl bg-amber-400/[0.04] border border-amber-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span>
                {missedSessions.length} session{missedSessions.length > 1 ? 's' : ''} from earlier wasn't completed. Achivii absorbs misses without backlog debt.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await handleTriggerReschedule();
                  setIsMissedCardDismissed(true);
                }}
                disabled={isRescheduling}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold transition-colors cursor-pointer disabled:opacity-40"
              >
                Move to Sunday Buffer
              </button>
              <button
                type="button"
                onClick={() => setIsMissedCardDismissed(true)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                Keep Pace
              </button>
            </div>
          </div>
        );
      })()}

      {/* 
        7-Day Schedule Grid & Mobile Agenda Stack
        Mobile (< 768px): Collapses to vertical day-agenda stack without horizontal viewport blowout.
        Tablet/Desktop (>= 768px): Expands to md:grid md:grid-cols-7 gap-3.
      */}
      <div className="flex flex-col md:grid md:grid-cols-7 gap-3 w-full">
        {weekDays.map((day) => (
          <div
            key={day.dateStr}
            className={`rounded-2xl bg-[#0a0f0d] flex flex-col justify-between transition-all border ${
              day.isToday
                ? 'border-[#07CB6C]/50 bg-[#07CB6C]/[0.02] shadow-[0_0_15px_rgba(7,203,108,0.06)]'
                : 'border-white/5 hover:border-white/10'
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
              className={`min-h-[44px] w-full p-3 border-b flex items-center justify-between text-left cursor-pointer transition-colors rounded-t-2xl group/header ${
                day.isToday
                  ? 'border-[#07CB6C]/20 bg-[#07CB6C]/5 hover:bg-[#07CB6C]/10'
                  : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.03]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white group-hover/header:text-[#07CB6C] transition-colors flex items-center gap-1">
                  <span>{day.dayShort}</span>
                  <Eye className="w-2.5 h-2.5 opacity-0 group-hover/header:opacity-100 transition-opacity text-[#07CB6C]" />
                </div>
                <div className="text-[11px] font-mono text-neutral-400 truncate">
                  {day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {day.isToday && (
                  <span className="px-2 py-0.5 rounded-full bg-[#07CB6C]/20 text-[#07CB6C] text-[10px] font-semibold">
                    Today
                  </span>
                )}

                {day.dayKey === 'SUN' && (
                  <span className="px-2 py-0.5 rounded-full bg-white/5 text-neutral-400 text-[10px] font-mono">
                    Buffer
                  </span>
                )}
              </div>
            </button>

            {/* Day Column Body with Unified Chronological Flow & Live Now Line */}
            {(() => {
              const unifiedItems: Array<{
                id: string;
                type: 'busy' | 'session';
                startTime: string;
                endTime: string;
                busy?: AvailabilitySlot;
                session?: Session;
              }> = [
                ...day.busySlots.map((busy, bIdx) => ({
                  id: `busy-${bIdx}-${busy.start_time}`,
                  type: 'busy' as const,
                  startTime: busy.start_time,
                  endTime: busy.end_time,
                  busy,
                })),
                ...day.sessions.map((session) => ({
                  id: session.id,
                  type: 'session' as const,
                  startTime: session.start_time || '09:00',
                  endTime: session.end_time || '10:00',
                  session,
                })),
              ].sort((a, b) => a.startTime.localeCompare(b.startTime));

              let hasRenderedNowLine = false;

              const renderNowLine = () => (
                <div
                  key="live-now-line"
                  className="relative py-1.5 flex items-center gap-2 my-1 z-10 animate-in fade-in duration-300"
                  title={`Current Time: ${currentTime}`}
                >
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#07CB6C] text-black text-[9px] font-mono font-bold shrink-0 shadow-[0_0_12px_rgba(7,203,108,0.5)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    <span>{currentTime} NOW</span>
                  </div>
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-[#07CB6C] via-[#07CB6C]/70 to-transparent shadow-[0_0_8px_rgba(7,203,108,0.4)]" />
                </div>
              );

              return (
                <div className="p-2.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  {unifiedItems.length === 0 ? (
                    <div className="space-y-2 flex-1 flex flex-col justify-center">
                      {day.isToday && renderNowLine()}
                      <div className="min-h-[70px] rounded-xl border border-dashed border-white/5 p-3 flex flex-col items-center justify-center text-center text-neutral-500 text-xs">
                        <span>Open buffer time</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 flex-1">
                      {unifiedItems.map((item) => {
                        let nowLineBefore = false;
                        if (day.isToday && !hasRenderedNowLine && currentTime < item.startTime) {
                          nowLineBefore = true;
                          hasRenderedNowLine = true;
                        }

                        const isHappeningNow =
                          day.isToday &&
                          item.startTime <= currentTime &&
                          item.endTime > currentTime;

                        return (
                          <React.Fragment key={item.id}>
                            {nowLineBefore && renderNowLine()}

                            {item.type === 'busy' && item.busy && (
                              <div
                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-neutral-400 flex items-center justify-between gap-1 transition-all ${
                                  isHappeningNow
                                    ? 'bg-[#07CB6C]/10 border-[#07CB6C]/40 text-white shadow-[0_0_10px_rgba(7,203,108,0.1)]'
                                    : 'bg-white/[0.02] border-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {getBusyIcon(item.busy.label, (item.busy as any).category, isHappeningNow)}
                                  <span
                                    className="truncate text-[11px]"
                                    title={item.busy.label || 'Busy'}
                                  >
                                    {item.busy.label || 'Busy'}
                                  </span>
                                  {isHappeningNow && (
                                    <span className="text-[9px] font-mono text-[#07CB6C] font-semibold shrink-0">
                                      • Now
                                    </span>
                                  )}
                                </div>
                                <span className="shrink-0 text-[10px] font-mono text-neutral-500">
                                  {item.startTime}–{item.endTime}
                                </span>
                              </div>
                            )}

                            {item.type === 'session' && item.session && (
                              <div
                                onClick={() => setSelectedSession(item.session!)}
                                className={`min-h-[44px] p-3 rounded-xl transition-all space-y-2 cursor-pointer relative border ${
                                  item.session.status === 'DONE'
                                    ? 'bg-white/[0.01] border-white/5 text-neutral-500 opacity-60'
                                    : isHappeningNow
                                    ? 'bg-[#0a1811] border-[#07CB6C] shadow-[0_0_15px_rgba(7,203,108,0.18)]'
                                    : getSessionTier(item.session) === 'core'
                                    ? 'bg-[#0a140f] border-[#07CB6C]/30 hover:border-[#07CB6C]/70 shadow-sm'
                                    : getSessionTier(item.session) === 'reflect'
                                    ? 'bg-[#0f1118] border-indigo-500/30 hover:border-indigo-500/60'
                                    : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                                }`}
                              >
                                {/* Title & Check Target */}
                                <div className="flex items-start justify-between gap-2 min-w-0">
                                  <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isHappeningNow
                                            ? 'bg-[#07CB6C] animate-pulse'
                                            : getSessionTier(item.session) === 'core'
                                            ? 'bg-[#07CB6C]'
                                            : getSessionTier(item.session) === 'reflect'
                                            ? 'bg-indigo-400'
                                            : 'bg-neutral-500'
                                        }`}
                                      />
                                      <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">
                                        {getSessionTier(item.session) === 'core'
                                          ? 'Core Focus'
                                          : getSessionTier(item.session) === 'reflect'
                                          ? 'Weekly Review'
                                          : 'Buffer'}
                                      </span>
                                      {isHappeningNow && (
                                        <span className="text-[9px] font-mono font-bold text-[#07CB6C] bg-[#07CB6C]/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                          <span className="w-1 h-1 rounded-full bg-[#07CB6C] animate-ping" />
                                          Live Now
                                        </span>
                                      )}
                                      {item.session.status === 'RESCHEDULED' && (
                                        <span className="text-[10px] font-medium text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                          Moved
                                        </span>
                                      )}
                                      <span className="text-[9px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/20 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                        📋 Guide
                                      </span>
                                    </div>

                                    <h4
                                      title={item.session.task_template?.title || 'Goal Session'}
                                      className={`text-xs font-semibold leading-tight line-clamp-1 break-words ${
                                        item.session.status === 'DONE'
                                          ? 'line-through text-neutral-500'
                                          : 'text-white'
                                      }`}
                                    >
                                      {formatTaskTitle(item.session.task_template?.title || 'Goal Session')}
                                    </h4>

                                    {item.session.task_template?.description && (
                                      <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5 leading-snug">
                                        {item.session.task_template.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Complete Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleDoneDirect(e, item.session!)}
                                    title={item.session.status === 'DONE' ? 'Mark Upcoming' : 'Mark Done'}
                                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-neutral-400 hover:text-[#07CB6C] transition-colors cursor-pointer shrink-0"
                                  >
                                    {item.session.status === 'DONE' ? (
                                      <CheckCircle2 className="w-4 h-4 text-[#07CB6C]" />
                                    ) : (
                                      <Circle className="w-4 h-4 hover:text-[#07CB6C]" />
                                    )}
                                  </button>
                                </div>

                                {/* Time & Duration */}
                                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1.5 border-t border-white/5">
                                  <span className={isHappeningNow ? 'text-[#07CB6C] font-semibold' : ''}>
                                    {item.startTime} – {item.endTime}
                                  </span>
                                  <span className="flex items-center gap-1 text-[10px]">
                                    {getTimeIcon(item.session.task_template?.preferred_time_of_day)}
                                    <span>{item.session.task_template?.session_duration_minutes || 60}m</span>
                                  </span>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {day.isToday && !hasRenderedNowLine && renderNowLine()}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Session Detail & Edit Modal */}
      <SessionDetailModal
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        onSessionUpdated={handleSessionUpdated}
        onDiagnosisTriggered={async () => {
          setSelectedSession(null);
          if (!token) return;
          try {
            const diag = await fetchPendingDiagnosis(token, data?.goal?.id || undefined);
            if (diag && diag.pending) {
              setPendingDiagnosis(diag);
            }
          } catch {}
        }}
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

      {/* Routine Settings Drawer Modal */}
      <RoutineSettingsModal
        isOpen={isRoutineModalOpen}
        onClose={() => setIsRoutineModalOpen(false)}
        onSaved={() => loadWeek(weekOffset)}
      />
    </div>
  );
};
