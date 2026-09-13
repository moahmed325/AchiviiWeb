import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWeeklyReview } from '../lib/adaptiveApi';
import type { WeeklyReviewSummary } from '../types/adaptive';
import { PendingReflectionState } from '../types';
import {
  CheckCircle2,
  Loader2,
  X,
  Sparkles,
  Layers,
  Zap,
  Target,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export interface WeeklyReflectionProps {
  weekNumber?: number;
  userGoalId?: string;
  reflectionState?: PendingReflectionState | null;
  isRecoveryPending?: boolean;
  onResolved: () => void | Promise<void>;
}

export const WeeklyReflection: React.FC<WeeklyReflectionProps> = ({
  weekNumber = 1,
  userGoalId,
  reflectionState,
  isRecoveryPending = false,
  onResolved,
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [review, setReview] = useState<WeeklyReviewSummary | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isRatifying, setIsRatifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const effectiveWeek = reflectionState?.week_number || weekNumber;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDismissed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    async function loadReview() {
      if (!token) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const data = await fetchWeeklyReview(token, effectiveWeek, userGoalId);
        setReview(data);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to generate weekly strategic review.');
      } finally {
        setLoading(false);
      }
    }

    if (!isRecoveryPending) {
      loadReview();
    }
  }, [token, effectiveWeek, userGoalId, isRecoveryPending]);

  // Enforce precedence: Recovery check-ins override reflection
  if (isDismissed || isRecoveryPending) {
    return null;
  }

  const handleRatify = async () => {
    setIsRatifying(true);
    setSuccessMessage(`Week ${effectiveWeek + 1} confirmed! Your execution schedule is ready.`);
    setTimeout(async () => {
      await onResolved();
      setIsDismissed(true);
    }, 1000);
  };

  const answers = review?.answers;
  const stateDeltas = review?.stateDeltas ? Object.entries(review.stateDeltas) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={() => setIsDismissed(true)}
      />

      <div className="relative w-full max-w-2xl bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-[#1a2824] shadow-2xl z-10 space-y-6 my-auto text-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1a2824] pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-[#07CB6C]">
                Weekly Review • Week {effectiveWeek}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 text-[10px] font-medium">
                Weekly Checkpoint
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Week {effectiveWeek} Progress Review
            </h2>

            <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
              A quick review of what you accomplished, what shifted, and your game plan for next week.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Dismiss review"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
            <span className="text-xs font-medium tracking-wide">
              Reviewing your week's progress...
            </span>
          </div>
        ) : errorMessage ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : answers ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Feedback notification toast */}
            {successMessage && (
              <div className="p-3.5 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Question 1: Planned vs Actual */}
            <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#07CB6C]" />
                1. Plan vs. Reality
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1a2824]">
                  <span className="text-[11px] text-neutral-400 block mb-1 font-medium">Planned Focus</span>
                  <p className="text-neutral-300 leading-relaxed">{answers.whatWasSupposedToHappen}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0f0d] border border-[#1a2824]">
                  <span className="text-[11px] text-[#07CB6C] block mb-1 font-medium">What You Completed</span>
                  <p className="text-white leading-relaxed font-medium">{answers.whatActuallyHappened}</p>
                </div>
              </div>
            </div>

            {/* Question 2: Capability State Transitions */}
            <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  2. Skills &amp; Capability Milestones
                </span>
                {stateDeltas.length > 0 && (
                  <span className="text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/40 border border-emerald-500/30">
                    +{stateDeltas.length} Milestones Reached
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed bg-[#0a0f0d] p-3 rounded-lg border border-[#1a2824]">
                {answers.whatChangedInCapabilityState}
              </p>
              {stateDeltas.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {stateDeltas.map(([capName, delta]) => (
                    <div
                      key={capName}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs flex items-center gap-1.5"
                    >
                      <span className="text-white font-medium">{capName}:</span>
                      <span className="text-neutral-400">{delta.from}</span>
                      <span className="text-emerald-400">→</span>
                      <span className="text-emerald-400 font-semibold">{delta.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Question 3: Meaningful Deviations & Strategic Filtering */}
            <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                3. Key Learnings &amp; Adjustments
              </span>
              <p className="text-xs text-neutral-300 leading-relaxed bg-[#0a0f0d] p-3 rounded-lg border border-[#1a2824]">
                {answers.whatCausedMeaningfulDeviations}
              </p>
            </div>

            {/* Question 4 & 5: Bottleneck & Trajectory Validity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  4. Current Bottleneck
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed bg-[#0a0f0d] p-3 rounded-lg border border-[#1a2824]">
                  {answers.isTheBottleneckStillTheBottleneck}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                  5. Pace &amp; Feasibility
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed bg-[#0a0f0d] p-3 rounded-lg border border-[#1a2824]">
                  {answers.isTheTrajectoryStillValid}
                </p>
              </div>
            </div>

            {/* Question 6 & 7: Next Week Focus */}
            <div className="p-4 rounded-xl bg-[#0d1412] border border-[#07CB6C]/40 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#07CB6C] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#07CB6C]" />
                Next Week's Focus (Week {effectiveWeek + 1})
              </span>
              <p className="text-xs text-white leading-relaxed bg-[#0a0f0d] p-3 rounded-lg border border-[#1a2824]">
                {answers.whatShouldHappenNext}
              </p>
            </div>

            {/* Ratify Action Button */}
            <button
              type="button"
              onClick={handleRatify}
              disabled={isRatifying}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-50"
            >
              {isRatifying ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Confirm &amp; Start Week {effectiveWeek + 1}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default WeeklyReflection;
