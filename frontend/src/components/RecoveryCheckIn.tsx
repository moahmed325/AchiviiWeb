import React, { useState } from 'react';
import { PendingRecoveryState, Session } from '../types';
import { submitRecoveryAction } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  ShieldAlert,
  Minimize2,
  FastForward,
  Sliders,
  PauseCircle,
  CheckCircle2,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface RecoveryCheckInProps {
  recoveryState: PendingRecoveryState;
  sessions?: Session[];
  slippageDays?: number;
  onResolved: () => void | Promise<void>;
}

export const RecoveryCheckIn: React.FC<RecoveryCheckInProps> = ({
  recoveryState,
  sessions,
  slippageDays,
  onResolved,
}) => {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileCollapsed, setIsMobileCollapsed] = useState<boolean>(false);

  if (!recoveryState.pending || isDismissed) {
    return null;
  }

  const isCircuitBreaker =
    recoveryState.circuit_breaker_active || recoveryState.rolling_28_day_events >= 2;

  // Real-time telemetry calculations
  const lapsedSessions =
    recoveryState.missed_session_count ??
    (sessions ? sessions.filter((s) => s.status === 'MISSED').length : null) ??
    (recoveryState.consecutive_missed_days ?? 3);

  const availableBuffers = sessions
    ? sessions.filter((s) => s.tier === 'buffer' && s.status !== 'DONE').length
    : 0;

  const netTimelineDrift = slippageDays ?? 0;

  // Header diagnostic telemetry indicator
  let statusIndicatorText = 'DIAGNOSTIC PROTOCOL ENGAGED // CADENCE DRIFT DETECTED';
  if (isCircuitBreaker) {
    statusIndicatorText = `PACING CIRCUIT BREAKER // ${Math.max(
      recoveryState.rolling_28_day_events,
      3
    )} RECOVERY EVENTS LOGGED`;
  } else if (recoveryState.reason === 'CONSECUTIVE_DAYS_MISSED') {
    statusIndicatorText = `DIAGNOSTIC PROTOCOL ENGAGED // ${
      recoveryState.consecutive_missed_days ?? 3
    } CONSECUTIVE LAPSES DETECTED`;
  } else if (recoveryState.reason === 'NO_FREE_SLOTS') {
    statusIndicatorText = 'DIAGNOSTIC PROTOCOL ENGAGED // BUFFER CAPACITY EXHAUSTED';
  }

  const handleAction = async (
    choice: 'shrink_week' | 'shift_timeline' | 'scope_reduction' | 'pause_goal'
  ) => {
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await submitRecoveryAction(token, {
        user_goal_id: recoveryState.user_goal_id,
        choice,
      });

      if (choice === 'shrink_week') {
        const droppedCount = res.resultingAdjustment?.dropped_sessions?.length || 0;
        setActionSuccessMessage(
          droppedCount > 0
            ? `DIAGNOSTIC RESOLUTION APPLIED // DROPPED ${droppedCount} BUFFER SESSION(S). CORE TRAJECTORY PRESERVED.`
            : 'DIAGNOSTIC RESOLUTION APPLIED // WEEK CONDENSED TO AVAILABLE CAPACITY.'
        );
      } else if (choice === 'shift_timeline') {
        setActionSuccessMessage(
          'DIAGNOSTIC RESOLUTION APPLIED // TIMELINE ADVANCED +7 DAYS VIA O(1) OFFSET. SESSIONS RE-ALIGNED.'
        );
      } else if (choice === 'scope_reduction') {
        setActionSuccessMessage(
          'DIAGNOSTIC RESOLUTION APPLIED // GOAL COMMITMENT RE-CALIBRATED TO SUSTAINABLE CADENCE.'
        );
      } else if (choice === 'pause_goal') {
        setActionSuccessMessage(
          'DIAGNOSTIC RESOLUTION APPLIED // GOAL SCHEDULE SUSPENDED. PROGRESS PRESERVED.'
        );
      }

      setTimeout(async () => {
        await onResolved();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Diagnostic mutation failed: unable to update schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Mobile Collapsed Dock Bar (< 768px) */}
      {isMobileCollapsed ? (
        <div
          id="recovery-check-in-mobile-dock"
          role="region"
          aria-label="Recovery Telemetry Dock"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1210] border-t border-amber-500/40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-none flex items-center justify-between gap-2 text-xs font-mono"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div className="min-w-0">
              <span className="text-amber-400 font-bold truncate block text-[11px]">
                {statusIndicatorText}
              </span>
              <span className="text-[#7e8f85] text-[10px] truncate block">
                Lapsed: {lapsedSessions} · Buffers: {availableBuffers} · Drift: +{netTimelineDrift}d
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileCollapsed(false)}
            className="min-h-[44px] min-w-[44px] px-3 py-2 bg-amber-950/40 hover:bg-amber-900/50 active:scale-[0.98] border border-amber-500/40 text-amber-300 font-bold text-[11px] rounded-sm transition-colors flex items-center gap-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label="Expand diagnostic telemetry panel"
          >
            <span>EXPAND</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* Primary Diagnostic Banner / Mobile Drawer Container */}
      <div
        id="recovery-check-in-card"
        role="region"
        aria-label="Recovery Telemetry Diagnostic Banner"
        className={`w-full max-w-full bg-[#0c1210] border border-amber-500/30 rounded-md shadow-none transition-all ${
          isMobileCollapsed
            ? 'hidden md:block'
            : 'fixed bottom-0 left-0 right-0 z-40 max-h-[90dvh] overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))] rounded-b-none md:rounded-b-md md:static md:z-auto md:max-h-none md:overflow-visible md:pb-0 mb-6'
        }`}
      >
        {/* Mobile Drawer Grab / Collapse Header (< 768px) */}
        <div className="md:hidden flex items-center justify-between px-4 pt-3 pb-2 border-b border-[#182621] bg-[#080d0b]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
              SYSTEM DIAGNOSTIC DRAWER
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileCollapsed(true)}
            className="min-h-[44px] min-w-[44px] px-2 text-xs font-mono text-[#7e8f85] hover:text-[#e5ebe7] active:scale-[0.98] flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
            aria-label="Collapse recovery drawer to bottom dock"
          >
            <ChevronDown className="w-4 h-4" />
            <span>COLLAPSE</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Diagnostic Telemetry Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-sm border shrink-0 flex items-center justify-center ${
                  isCircuitBreaker
                    ? 'bg-amber-950/40 text-amber-400 border-amber-500/50'
                    : 'bg-amber-950/30 text-amber-400 border-amber-500/40'
                }`}
              >
                {isCircuitBreaker ? (
                  <ShieldAlert className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                    {statusIndicatorText}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-sm border ${
                      isCircuitBreaker
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {isCircuitBreaker ? 'PACING CIRCUIT BREAKER' : 'TIER 2 RECOVERY'}
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-[#e5ebe7]">
                  {isCircuitBreaker
                    ? 'Pacing Safety Guardrail: Rolling Threshold Exceeded'
                    : 'Cadence Divergence Detected: System Intervention Required'}
                </h3>
                <p className="text-xs text-[#7e8f85] max-w-3xl leading-relaxed">
                  {isCircuitBreaker
                    ? 'System logged 3 recovery interventions within the rolling 28-day window. Execution pacing has exceeded allowable tolerance. Pacing circuit breaker engaged to prevent compounding slippage. Sustainable scope reduction or schedule pause required.'
                    : recoveryState.reason === 'CONSECUTIVE_DAYS_MISSED'
                    ? `Autonomous pacing monitor logged ${
                        recoveryState.consecutive_missed_days ?? 3
                      } consecutive lapsed session dates. Buffer re-allocation or schedule shift required to preserve timeline.`
                    : 'Autonomous pacing monitor detected schedule saturation. Weekly commitment exceeds remaining open capacity without buffer re-allocation. Select remediation vector:'}
                </p>
              </div>
            </div>

            {/* Non-blocking Dismiss Button */}
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="min-h-[44px] min-w-[44px] text-[#7e8f85] hover:text-[#e5ebe7] p-2.5 rounded-sm hover:bg-[#182621] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              title="Dismiss diagnostic for now"
              aria-label="Dismiss recovery diagnostic for now"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Real-Time Diagnostic Telemetry Readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs pt-1">
            <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621] flex flex-col justify-between">
              <span className="text-[10px] text-[#7e8f85] uppercase tracking-wider block">
                Lapsed Sessions
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm sm:text-base font-bold text-amber-400">
                  {lapsedSessions}
                </span>
                <span className="text-[10px] text-[#7e8f85]">UNCOMPLETED</span>
              </div>
            </div>

            <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621] flex flex-col justify-between">
              <span className="text-[10px] text-[#7e8f85] uppercase tracking-wider block">
                Available Buffers
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm sm:text-base font-bold text-[#e5ebe7]">
                  {availableBuffers}
                </span>
                <span className="text-[10px] text-[#7e8f85]">OPEN SLOTS</span>
              </div>
            </div>

            <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621] flex flex-col justify-between">
              <span className="text-[10px] text-[#7e8f85] uppercase tracking-wider block">
                Net Timeline Drift
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm sm:text-base font-bold text-amber-400">
                  +{netTimelineDrift} Days
                </span>
                <span className="text-[10px] text-[#7e8f85]">CUMULATIVE</span>
              </div>
            </div>
          </div>

          {/* Success or Error Feedback */}
          {actionSuccessMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-sm bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono"
            >
              {errorMessage}
            </div>
          )}

          {/* Action Vectors */}
          {!actionSuccessMessage && (
            <div
              role="group"
              aria-label="Recovery plan adjustment options"
              className="pt-1"
            >
              {!isCircuitBreaker ? (
                /* Standard Non-Blocking Recovery Actions */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Action 1: Shrink Week */}
                  <button
                    id="btn-recovery-shrink-week"
                    type="button"
                    onClick={() => handleAction('shrink_week')}
                    disabled={isSubmitting}
                    aria-label="Shrink Week: Drop non-essential buffer sessions to preserve core progress and protect calendar end date."
                    className="p-4 rounded-sm border border-[#182621] bg-[#080d0b] hover:bg-[#111a17] hover:border-amber-500/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-40 min-h-[44px]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Minimize2 className="w-3.5 h-3.5" /> OPTION 01 // SHRINK WEEK
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                          PROTECT END DATE
                        </span>
                      </div>
                      <h4 className="font-bold text-[#e5ebe7] text-sm group-hover:text-amber-200 transition-colors">
                        Shrink Week
                      </h4>
                      <p className="text-xs text-[#7e8f85] leading-normal">
                        Drop non-essential buffer sessions to preserve core progress and protect the calendar end date.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#182621] flex items-center justify-between text-xs font-mono font-semibold text-amber-400 min-h-[44px] items-center">
                      <span>APPLY SHRINK WEEK</span>
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>→</span>
                      )}
                    </div>
                  </button>

                  {/* Action 2: Shift Timeline */}
                  <button
                    id="btn-recovery-shift-timeline"
                    type="button"
                    onClick={() => handleAction('shift_timeline')}
                    disabled={isSubmitting}
                    aria-label="Shift Timeline: Advance plan window via O(1) day offset."
                    className="p-4 rounded-sm border border-[#182621] bg-[#080d0b] hover:bg-[#111a17] hover:border-amber-500/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-40 min-h-[44px]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FastForward className="w-3.5 h-3.5" /> OPTION 02 // SHIFT TIMELINE
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                          +7D TIMELINE OFFSET
                        </span>
                      </div>
                      <h4 className="font-bold text-[#e5ebe7] text-sm group-hover:text-amber-200 transition-colors">
                        Shift Timeline (+7 Days)
                      </h4>
                      <p className="text-xs text-[#7e8f85] leading-normal">
                        Advance plan window via O(1) day offset. Shifts uncompleted sessions to the next schedule window without day compression.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#182621] flex items-center justify-between text-xs font-mono font-semibold text-amber-400 min-h-[44px] items-center">
                      <span>SHIFT TIMELINE (+7D)</span>
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>→</span>
                      )}
                    </div>
                  </button>
                </div>
              ) : (
                /* Pacing Circuit Breaker Dedicated Amber Safety Panel */
                <div className="p-4 rounded-sm border border-amber-500/30 bg-amber-950/20 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      PACING SAFETY GUARDRAIL PANEL // SUSTAINABLE REMEDIATION
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                      CIRCUIT ENGAGED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Circuit Action 1: Scope Reduction */}
                    <button
                      id="btn-circuit-scope-reduction"
                      type="button"
                      onClick={() => handleAction('scope_reduction')}
                      disabled={isSubmitting}
                      aria-label="Pacing circuit breaker: Reduce goal scope to a sustainable pace."
                      className="p-4 rounded-sm border border-amber-500/40 bg-[#080d0b] hover:bg-[#111a17] hover:border-amber-400 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-40 min-h-[44px]"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5" /> SAFETY OPTION 01
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                            SUSTAINABLE PACE
                          </span>
                        </div>
                        <h4 className="font-bold text-[#e5ebe7] text-sm group-hover:text-amber-200 transition-colors">
                          Reduce Goal Scope
                        </h4>
                        <p className="text-xs text-[#7e8f85] leading-normal">
                          Scale down weekly session frequency and duration to establish a stable, sustainable execution baseline.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#182621] flex items-center justify-between text-xs font-mono font-semibold text-amber-400 min-h-[44px] items-center">
                        <span>APPLY SCOPE REDUCTION</span>
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>→</span>
                        )}
                      </div>
                    </button>

                    {/* Circuit Action 2: Pause Goal */}
                    <button
                      id="btn-circuit-pause-goal"
                      type="button"
                      onClick={() => handleAction('pause_goal')}
                      disabled={isSubmitting}
                      aria-label="Pacing circuit breaker: Penalty-free pause to preserve all stats."
                      className="p-4 rounded-sm border border-[#182621] bg-[#080d0b] hover:bg-[#111a17] hover:border-amber-500/50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-40 min-h-[44px]"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-[#a6b8ad] uppercase tracking-wider flex items-center gap-1.5">
                            <PauseCircle className="w-3.5 h-3.5" /> SAFETY OPTION 02
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-[#182621] text-[#a6b8ad] border border-[#1f332c] font-semibold">
                            PRESERVE ALL STATS
                          </span>
                        </div>
                        <h4 className="font-bold text-[#e5ebe7] text-sm group-hover:text-white transition-colors">
                          Penalty-Free Pause
                        </h4>
                        <p className="text-xs text-[#7e8f85] leading-normal">
                          Freeze active schedule state with zero penalty. All progression milestones, streaks, and data remain preserved until manual resume.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#182621] flex items-center justify-between text-xs font-mono font-semibold text-[#a6b8ad] min-h-[44px] items-center">
                        <span>ENGAGE GOAL PAUSE</span>
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>→</span>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
