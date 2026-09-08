import React, { useState } from 'react';
import { PendingRecoveryState } from '../types';
import { submitRecoveryAction } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Minimize2,
  FastForward,
  ShieldAlert,
  PauseCircle,
  Sliders,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';

interface RecoveryCheckInProps {
  recoveryState: PendingRecoveryState;
  onResolved: () => void | Promise<void>;
}

export const RecoveryCheckIn: React.FC<RecoveryCheckInProps> = ({
  recoveryState,
  onResolved,
}) => {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!recoveryState.pending || isDismissed) {
    return null;
  }

  const isCircuitBreaker = recoveryState.circuit_breaker_active;

  const handleAction = async (choice: 'shrink_week' | 'shift_timeline' | 'scope_reduction' | 'pause_goal') => {
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
            ? `Week adjusted: Dropped ${droppedCount} buffer session(s) while protecting your core sessions.`
            : 'Week adjusted to fit your available slots.'
        );
      } else if (choice === 'shift_timeline') {
        setActionSuccessMessage('Timeline rolled forward by 7 days. Your uncompleted sessions have been rescheduled.');
      } else if (choice === 'scope_reduction') {
        setActionSuccessMessage('Goal commitment reduced to a sustainable pace.');
      } else if (choice === 'pause_goal') {
        setActionSuccessMessage('Goal paused. All your progress is safely preserved until you are ready.');
      }

      setTimeout(async () => {
        await onResolved();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update schedule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="recovery-check-in-card"
      className="mb-6 rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-950/95 shadow-xl transition-all duration-300 relative"
    >
      {/* Non-blocking dismiss button */}
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
        title="Dismiss for now"
        aria-label="Dismiss check-in"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Header with Warm, Non-Judgmental Voice */}
        <div className="flex items-start gap-3.5 pr-8">
          <div
            className={`p-2.5 rounded-xl border shrink-0 ${
              isCircuitBreaker
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}
          >
            {isCircuitBreaker ? <ShieldAlert className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-white">
                {isCircuitBreaker
                  ? 'Let’s Make This Sustainable'
                  : 'Life Happened. Want to Adjust This Week?'}
              </h3>
              <span
                className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                  isCircuitBreaker
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {isCircuitBreaker ? 'Pacing Circuit Breaker' : 'Adaptive Recovery'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              {isCircuitBreaker ? (
                <>
                  You’ve had 3 recovery adjustments over the last 28 days. Consistency isn't about grinding
                  through impossible weeks — it’s about adjusting your targets when life demands it.
                </>
              ) : recoveryState.reason === 'CONSECUTIVE_DAYS_MISSED' ? (
                <>
                  You missed {recoveryState.consecutive_missed_days ?? 3} days in a row. No guilt, no stress.
                  Choose how you'd like your coach to adapt your calendar:
                </>
              ) : (
                <>
                  Your remaining slots this week are tight. Rather than overloading your schedule, choose how you'd
                  like your plan to adapt:
                </>
              )}
            </p>
          </div>
        </div>

        {/* Success or Error Feedback */}
        {actionSuccessMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Action Choice Cards */}
        {!actionSuccessMessage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {!isCircuitBreaker ? (
              <>
                {/* Choice 1: Shrink Week */}
                <button
                  id="btn-recovery-shrink-week"
                  type="button"
                  onClick={() => handleAction('shrink_week')}
                  disabled={isSubmitting}
                  className="p-4 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-indigo-500/50 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Minimize2 className="w-3.5 h-3.5" /> Option 1
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold">
                        Keep Finish Date
                      </span>
                    </div>
                    <h4 className="font-semibold text-white text-sm group-hover:text-indigo-200 transition-colors">
                      Shrink this week
                    </h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      Drop buffer and reflection sessions for this week. Protects your core sessions and keeps your
                      target end date untouched.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-indigo-400">
                    <span>Apply Shrink</span>
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>→</span>}
                  </div>
                </button>

                {/* Choice 2: Shift Timeline */}
                <button
                  id="btn-recovery-shift-timeline"
                  type="button"
                  onClick={() => handleAction('shift_timeline')}
                  disabled={isSubmitting}
                  className="p-4 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-amber-500/50 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FastForward className="w-3.5 h-3.5" /> Option 2
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                        +7 Days Timeline
                      </span>
                    </div>
                    <h4 className="font-semibold text-white text-sm group-hover:text-amber-200 transition-colors">
                      Shift the whole timeline
                    </h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      Roll the entire plan forward by one week. Uncompleted sessions roll to next week without
                      compressing your days.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                    <span>Shift Timeline</span>
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>→</span>}
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Circuit Breaker Choice 1: Scope Reduction */}
                <button
                  id="btn-circuit-scope-reduction"
                  type="button"
                  onClick={() => handleAction('scope_reduction')}
                  disabled={isSubmitting}
                  className="p-4 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-purple-500/50 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" /> Sustainable Pace
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                        Recommended
                      </span>
                    </div>
                    <h4 className="font-semibold text-white text-sm group-hover:text-purple-200 transition-colors">
                      Dial back goal commitment
                    </h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      Reduce session intensity and drop future buffer loads so your goal stays realistic alongside
                      your actual life constraints.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-purple-400">
                    <span>Reduce Goal Scope</span>
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>→</span>}
                  </div>
                </button>

                {/* Circuit Breaker Choice 2: Pause Goal */}
                <button
                  id="btn-circuit-pause-goal"
                  type="button"
                  onClick={() => handleAction('pause_goal')}
                  disabled={isSubmitting}
                  className="p-4 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-850 hover:border-slate-500/50 text-left transition-all group flex flex-col justify-between gap-3 cursor-pointer disabled:opacity-50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <PauseCircle className="w-3.5 h-3.5" /> Temporary Pause
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                        Preserve All Stats
                      </span>
                    </div>
                    <h4 className="font-semibold text-white text-sm group-hover:text-slate-200 transition-colors">
                      Pause goal for now
                    </h4>
                    <p className="text-xs text-slate-400 leading-normal">
                      Freeze your schedule with zero penalty. Resume anytime when your schedule re-opens.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Pause Goal</span>
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>→</span>}
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
