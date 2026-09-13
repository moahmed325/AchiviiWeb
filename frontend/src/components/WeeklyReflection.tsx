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
    setSuccessMessage(`Trajectory ratified for Week ${effectiveWeek + 1}. Execution schedule committed.`);
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
              <span className="p-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                WEEKLY STRATEGIC REVIEW // WEEK {effectiveWeek}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#0d1412] border border-[#1a2824] text-neutral-300 text-[10px] font-mono font-medium uppercase">
                7 STRATEGIC QUESTIONS
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              System Telemetry Evaluation
            </h2>

            <p className="text-xs font-mono text-neutral-400 leading-relaxed max-w-xl">
              Automated empirical audit evaluating dose adequacy, capability state transitions, and trajectory integrity.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer shrink-0"
            title="Dismiss review"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
            <span className="text-xs font-mono uppercase tracking-wider">
              EVALUATING 7 STRATEGIC TELEMETRY QUESTIONS...
            </span>
          </div>
        ) : errorMessage ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : answers ? (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Feedback notification toast */}
            {successMessage && (
              <div className="p-3.5 rounded-lg bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Question 1: Planned vs Actual */}
            <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
                1. DOSE ADEQUACY // WHAT WAS SUPPOSED TO HAPPEN VS WHAT HAPPENED?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-[#0a0f0d] border border-[#1a2824]">
                  <span className="text-[10px] text-neutral-500 block mb-0.5">PLANNED TARGET</span>
                  <p className="text-neutral-300 leading-relaxed">{answers.whatWasSupposedToHappen}</p>
                </div>
                <div className="p-2.5 rounded bg-[#0a0f0d] border border-[#1a2824]">
                  <span className="text-[10px] text-neutral-500 block mb-0.5">ACTUAL EXECUTION</span>
                  <p className="text-white leading-relaxed">{answers.whatActuallyHappened}</p>
                </div>
              </div>
            </div>

            {/* Question 2: Capability State Transitions */}
            <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  2. CAPABILITY STATE TRANSITIONS
                </span>
                {stateDeltas.length > 0 && (
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    +{stateDeltas.length} STATE ADVANCEMENTS
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-neutral-300 leading-relaxed bg-[#0a0f0d] p-2.5 rounded border border-[#1a2824]">
                {answers.whatChangedInCapabilityState}
              </p>
              {stateDeltas.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {stateDeltas.map(([capName, delta]) => (
                    <div
                      key={capName}
                      className="px-2.5 py-1 rounded bg-emerald-950/30 border border-emerald-500/30 text-xs font-mono flex items-center gap-1.5"
                    >
                      <span className="text-white font-semibold">{capName}:</span>
                      <span className="text-neutral-400">{delta.from}</span>
                      <span className="text-emerald-400">→</span>
                      <span className="text-emerald-400 font-bold">{delta.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Question 3: Meaningful Deviations & Strategic Filtering */}
            <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                3. MEANINGFUL DEVIATIONS & STRATEGIC FILTERING
              </span>
              <p className="text-xs font-mono text-neutral-300 leading-relaxed bg-[#0a0f0d] p-2.5 rounded border border-[#1a2824]">
                {answers.whatCausedMeaningfulDeviations}
              </p>
            </div>

            {/* Question 4 & 5: Bottleneck & Trajectory Validity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  4. GOVERNING BOTTLENECK
                </span>
                <p className="text-xs font-mono text-neutral-300 leading-relaxed bg-[#0a0f0d] p-2.5 rounded border border-[#1a2824]">
                  {answers.isTheBottleneckStillTheBottleneck}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  5. TRAJECTORY VALIDITY
                </span>
                <p className="text-xs font-mono text-neutral-300 leading-relaxed bg-[#0a0f0d] p-2.5 rounded border border-[#1a2824]">
                  {answers.isTheTrajectoryStillValid}
                </p>
              </div>
            </div>

            {/* Question 6 & 7: What Should Happen Next & System Recommendation */}
            <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#07CB6C]/40 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#07CB6C] font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#07CB6C]" />
                6 & 7. STRATEGIC RECOMMENDATION FOR WEEK {effectiveWeek + 1}
              </span>
              <p className="text-xs font-mono text-white leading-relaxed bg-[#0a0f0d] p-3 rounded border border-[#1a2824]">
                {answers.whatShouldHappenNext}
              </p>
            </div>

            {/* Ratify Action Button */}
            <button
              type="button"
              onClick={handleRatify}
              disabled={isRatifying}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-50"
            >
              {isRatifying ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#080d0b]" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>RATIFY TRAJECTORY CALIBRATION FOR WEEK {effectiveWeek + 1}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default WeeklyReflection;
