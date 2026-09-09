import React, { useState, useEffect } from 'react';
import { PendingRecoveryState, Session } from '../types';
import { submitRecoveryAction } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export interface RecoveryCheckInProps {
  recoveryState: PendingRecoveryState;
  sessions?: Session[];
  slippageDays?: number;
  onResolved: () => void | Promise<void>;
}

interface BufferSlotItem {
  id: string;
  day: string;
  time: string;
  durationMinutes: number;
  title: string;
}

export const RecoveryCheckIn: React.FC<RecoveryCheckInProps> = ({
  recoveryState,
  sessions,
  slippageDays = 0,
  onResolved,
}) => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [circuitChoice, setCircuitChoice] = useState<'shrink_week' | 'shift_timeline'>('shrink_week');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDismissed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!recoveryState.pending || isDismissed) {
    return null;
  }

  // Calculate missed core blocks
  const missedSessions = sessions
    ? sessions.filter(
        (s) =>
          s.status === 'MISSED' ||
          (s.tier === 'core' && s.status !== 'DONE' && new Date(s.scheduled_date) < new Date())
      )
    : [];

  const missedCount =
    missedSessions.length > 0
      ? missedSessions.length
      : recoveryState.missed_session_count ?? recoveryState.consecutive_missed_days ?? 2;

  const missedHours =
    missedSessions.length > 0
      ? missedSessions.reduce((acc, s) => {
          const dur = s.task_template?.session_duration_minutes || 60;
          return acc + dur;
        }, 0) / 60
      : missedCount * 2.0;

  // Calculate available buffer slots from sessions or structured defaults
  const realBufferSessions = sessions
    ? sessions.filter((s) => s.tier === 'buffer' && s.status !== 'DONE')
    : [];

  const availableBuffers: BufferSlotItem[] =
    realBufferSessions.length > 0
      ? realBufferSessions.map((s) => {
          const d = new Date(s.scheduled_date);
          const dayStr = isNaN(d.getTime())
            ? 'BUF'
            : d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
          return {
            id: s.id,
            day: dayStr,
            time: s.start_time || '18:00',
            durationMinutes: s.task_template?.session_duration_minutes || 60,
            title: s.task_template?.title || 'Open Buffer Window',
          };
        })
      : [
          { id: 'buf-slot-1', day: 'TUE', time: '18:30', durationMinutes: 90, title: 'Evening Reallocation Buffer' },
          { id: 'buf-slot-2', day: 'THU', time: '19:00', durationMinutes: 60, title: 'Mid-Week Dynamic Buffer' },
          { id: 'buf-slot-3', day: 'SAT', time: '10:30', durationMinutes: 90, title: 'Weekend Absorption Window' },
        ];

  const totalBufferHours = availableBuffers.reduce((acc, b) => acc + b.durationMinutes, 0) / 60;

  // Circuit breaker condition: explicit circuit breaker OR rolling events >= 2 OR slippage >= 14d OR buffer capacity strictly less than missed
  const isCircuitBreaker =
    recoveryState.circuit_breaker_active ||
    recoveryState.rolling_28_day_events >= 2 ||
    slippageDays >= 14 ||
    totalBufferHours < missedHours;

  // Track user-selected buffer slots for reassignment
  const [selectedBufferIds, setSelectedBufferIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Pre-select enough buffer slots to absorb missed sessions
    for (let i = 0; i < Math.min(missedCount, availableBuffers.length); i++) {
      initial.add(availableBuffers[i].id);
    }
    return initial;
  });

  const toggleBufferSlot = (id: string) => {
    setSelectedBufferIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExecuteReallocation = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    const choice = isCircuitBreaker ? circuitChoice : 'shrink_week';

    try {
      await submitRecoveryAction(token, {
        user_goal_id: recoveryState.user_goal_id,
        choice,
        details: {
          reallocated_slots: Array.from(selectedBufferIds),
        },
      });

      setActionSuccessMessage(
        choice === 'shift_timeline'
          ? 'Trajectory adjusted: +7 days buffer window added with zero streak penalty.'
          : 'Cadence re-aligned: orphaned sessions allocated to buffer slots.'
      );

      setTimeout(async () => {
        await onResolved();
      }, 1100);
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to submit recovery choice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsDismissed(true);
      }}
    >
      <div className="bg-[#0a0f0d] border border-[#1a2824] rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl overflow-hidden relative my-8">
        {/* Top Dismiss Button */}
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="absolute top-5 right-5 text-neutral-400 hover:text-white p-2 rounded-lg hover:bg-[#131f1b] transition-colors cursor-pointer"
          aria-label="Close recovery protocol modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-1.5 pr-8">
            <span className="font-mono text-xs text-[#07CB6C] tracking-widest uppercase block font-medium">
              [ TIER 2 // RECOVERY PROTOCOL ]
            </span>
            <h2 id="recovery-modal-title" className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Recalibrate Weekly Cadence
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Your 90-day trajectory is preserved. Allocate orphaned sessions into upcoming buffer slots to absorb missed work without broken momentum.
            </p>
          </div>

          {/* Diagnostic Readout: Clean 2-Metric Strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0d1412] border border-[#1a2824] p-4 rounded-xl space-y-1">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
                MISSED CORE BLOCKS
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-semibold text-amber-400">
                  {missedCount} {missedCount === 1 ? 'Session' : 'Sessions'}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  / {missedHours.toFixed(1)}h
                </span>
              </div>
            </div>

            <div className="bg-[#0d1412] border border-[#1a2824] p-4 rounded-xl space-y-1">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
                RECOVERY CAPACITY
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-semibold text-[#07CB6C]">
                  {availableBuffers.length} Buffer Slots
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  / {totalBufferHours.toFixed(1)}h
                </span>
              </div>
            </div>
          </div>

          {/* Circuit Breaker Fallback (if capacity exhausted or safety triggered) */}
          {isCircuitBreaker ? (
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>[ PACING SAFETY GUARDRAIL TRIGGERED ]</span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Circuit Breaker Engaged</h4>
                <p className="text-xs text-neutral-400 leading-relaxed mt-1">
                  Required recovery workload exceeds open buffer hours. Select an adaptive adjustment vector with zero guilt and zero streak penalty:
                </p>
              </div>

              {/* Option Radio Cards */}
              <div className="space-y-2 pt-1">
                <div
                  onClick={() => setCircuitChoice('shrink_week')}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    circuitChoice === 'shrink_week'
                      ? 'border-[#07CB6C] bg-[#07CB6C]/10 text-white'
                      : 'border-[#1a2824] bg-[#0a0f0d] text-neutral-300 hover:border-[#2a3e38]'
                  }`}
                >
                  <input
                    type="radio"
                    name="circuitChoice"
                    checked={circuitChoice === 'shrink_week'}
                    onChange={() => setCircuitChoice('shrink_week')}
                    className="mt-0.5 accent-[#07CB6C] cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium block">Option A: Compress Milestone Scope</span>
                    <span className="text-xs text-neutral-400 block leading-normal">
                      Drop non-essential buffer sessions to defend the milestone completion date.
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setCircuitChoice('shift_timeline')}
                  className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    circuitChoice === 'shift_timeline'
                      ? 'border-[#07CB6C] bg-[#07CB6C]/10 text-white'
                      : 'border-[#1a2824] bg-[#0a0f0d] text-neutral-300 hover:border-[#2a3e38]'
                  }`}
                >
                  <input
                    type="radio"
                    name="circuitChoice"
                    checked={circuitChoice === 'shift_timeline'}
                    onChange={() => setCircuitChoice('shift_timeline')}
                    className="mt-0.5 accent-[#07CB6C] cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium block">Option B: Extend Timeline by 1 Week</span>
                    <span className="text-xs text-neutral-400 block leading-normal">
                      Add a 7-day buffer window. Zero streak penalty, all habit stats preserved.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Interactive Buffer Slot Picker */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neutral-400 uppercase tracking-wider font-medium">
                  SELECT REALLOCATION SLOTS
                </span>
                <span className="text-[#07CB6C] font-mono text-[11px]">
                  {selectedBufferIds.size} / {missedCount} TARGETED
                </span>
              </div>

              <div className="space-y-2">
                {availableBuffers.map((slot) => {
                  const isSelected = selectedBufferIds.has(slot.id);
                  return (
                    <div
                      key={slot.id}
                      onClick={() => toggleBufferSlot(slot.id)}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-[#07CB6C]/50 bg-[#07CB6C]/5 text-white'
                          : 'border-[#1a2824] bg-[#0d1412] text-neutral-300 hover:border-[#2a3e38]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 rounded bg-[#0a0f0d] border border-[#1a2824] text-xs font-mono font-semibold text-white">
                          {slot.day} // {slot.time}
                        </span>
                        <div>
                          <span className="text-sm font-medium block">{slot.title}</span>
                          <span className="text-[11px] text-neutral-400 font-mono">
                            {slot.durationMinutes} MIN ALLOCATION
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>REALLOCATED</span>
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#0a0f0d] border border-[#1a2824] text-neutral-400">
                            AVAILABLE
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback banners */}
          {actionSuccessMessage && (
            <div className="p-3.5 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono">
              {errorMessage}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 border-t border-[#1a2824] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                navigate('/onboarding?mode=adjust');
                setIsDismissed(true);
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-lg text-neutral-400 hover:text-white border border-[#1a2824] hover:border-[#2a3e38] text-xs font-mono font-medium transition-colors cursor-pointer text-center"
            >
              Adjust Manually
            </button>

            <button
              type="button"
              onClick={handleExecuteReallocation}
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(7,203,108,0.25)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Cadence...</span>
                </>
              ) : (
                <>
                  <span>Lock Reallocation</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
