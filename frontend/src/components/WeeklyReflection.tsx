import React, { useState } from 'react';
import { PendingReflectionState } from '../types';
import { submitWeeklyReflection } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  Loader2,
  X,
  Send,
  Check,
  CalendarCheck2,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export interface WeeklyReflectionProps {
  reflectionState: PendingReflectionState;
  isRecoveryPending?: boolean;
  onResolved: () => void | Promise<void>;
}

export const WeeklyReflection: React.FC<WeeklyReflectionProps> = ({
  reflectionState,
  isRecoveryPending = false,
  onResolved,
}) => {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states for full retrospective log
  const [whatWentWell, setWhatWentWell] = useState<string>('');
  const [whatGotInWay, setWhatGotInWay] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('Just Right');
  const [scheduleChanges, setScheduleChanges] = useState<string>('');

  // Enforce absolute precedence: Recovery check-ins override reflection
  if (!reflectionState.pending || isDismissed || isRecoveryPending) {
    return null;
  }

  const completionRate = reflectionState.completion_rate ?? 1;
  const isSingleTap = reflectionState.reflection_type === 'single_tap' || completionRate >= 0.7;
  const weekNumber = reflectionState.week_number || 1;
  const completionRatePercent = Math.round(completionRate * 100);

  const handleSingleTapConfirm = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitWeeklyReflection(token, {
        user_goal_id: reflectionState.user_goal_id,
        week_number: weekNumber,
        reflection_type: 'single_tap',
        responses: {
          confirmed_same_plan: true,
          completion_rate: reflectionState.completion_rate,
        },
      });

      setSuccessMessage(
        `CYCLE VERIFICATION RECORDED // WEEK ${weekNumber + 1} CADENCE CONFIRMED.`
      );
      setTimeout(async () => {
        await onResolved();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'TELEMETRY SUBMISSION FAILED // Unable to record confirmation.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitWeeklyReflection(token, {
        user_goal_id: reflectionState.user_goal_id,
        week_number: weekNumber,
        reflection_type: 'full',
        responses: {
          what_went_well: whatWentWell.trim(),
          what_got_in_way: whatGotInWay.trim(),
          difficulty,
          schedule_changes: scheduleChanges.trim(),
          completion_rate: reflectionState.completion_rate,
        },
      });

      setSuccessMessage(
        `RETROSPECTIVE LOG COMMITTED // ROUTINE INSIGHTS INDEXED FOR WEEK ${weekNumber + 1}.`
      );
      setTimeout(async () => {
        await onResolved();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'TELEMETRY SUBMISSION FAILED // Unable to commit retrospective log.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="weekly-reflection-card"
      role="region"
      aria-label="Weekly Retrospective & Post-Run Log"
      className="mb-6 rounded-md bg-[#0c1210] border border-[#182621] shadow-none overflow-hidden transition-all duration-200 relative"
    >
      {/* Non-blocking Dismiss Button */}
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] text-[#7e8f85] hover:text-[#e5ebe7] p-2.5 rounded-sm hover:bg-[#182621] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] transition-colors flex items-center justify-center cursor-pointer z-10"
        title="Dismiss retrospective for now"
        aria-label="Dismiss weekly reflection for now"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Header Telemetry Architecture */}
        <div className="flex items-start gap-3.5 pr-10">
          <div
            className={`w-9 h-9 rounded-sm border shrink-0 flex items-center justify-center ${
              isSingleTap
                ? 'bg-[#0a1711] text-[#07CB6C] border-[#07CB6C]/30'
                : 'bg-amber-950/20 text-amber-400 border-amber-500/30'
            }`}
          >
            {isSingleTap ? (
              <CalendarCheck2 className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                  isSingleTap ? 'text-[#07CB6C]' : 'text-amber-400'
                }`}
              >
                {isSingleTap
                  ? 'CYCLE STATUS: NOMINAL // REFLECTION CONFIRMATION'
                  : 'CYCLE STATUS: DIVERGENCE DETECTED // RETROSPECTIVE LOG'}
              </span>
              <span
                className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-sm border ${
                  isSingleTap
                    ? 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                }`}
              >
                {completionRatePercent}% CADENCE MET
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-[#e5ebe7]">
              {isSingleTap
                ? `Week ${weekNumber} Pacing Nominal: Cycle Cadence Maintained`
                : `Week ${weekNumber} Engineering Retrospective: Cadence Recalibration`}
            </h3>

            <p className="text-xs text-[#7e8f85] leading-relaxed max-w-3xl">
              {isSingleTap
                ? `Execution telemetry confirms ${completionRatePercent}% session completion for Week ${weekNumber}. Pacing targets nominal. Confirm plan continuation for Week ${
                    weekNumber + 1
                  }.`
                : `Session completion fell to ${completionRatePercent}%. Complete the 4-point routine-tuning log below to calibrate slot allocations and pacing for Week ${
                    weekNumber + 1
                  }.`}
            </p>
          </div>
        </div>

        {/* Telemetry Feedback Messages */}
        {successMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3 rounded-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3 rounded-sm bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-[#ef4444] shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* High-Completion Variant (>= 70%): Streamlined Verification Panel */}
        {isSingleTap && !successMessage && (
          <div className="pt-2 border-t border-[#182621] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-mono text-xs text-[#7e8f85]">
              <span className="text-[#e5ebe7] font-semibold">VERIFICATION ACTION:</span> Retain current schedule configuration for Week {weekNumber + 1}.
            </div>
            <button
              id="btn-confirm-same-plan"
              type="button"
              onClick={handleSingleTapConfirm}
              disabled={isSubmitting}
              aria-label={`Confirm same plan for Week ${weekNumber + 1}`}
              className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs font-mono font-bold bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] text-[#050807] rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>RECORDING VERIFICATION...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>CONFIRM CYCLE CADENCE (WEEK {weekNumber + 1})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Low-Completion Variant (< 70%): Structured 4-Point Retrospective Log */}
        {!isSingleTap && !successMessage && (
          <form onSubmit={handleFullSubmit} className="space-y-4 pt-1 border-t border-[#182621]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              {/* Prompt 1: What went well */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#07CB6C] uppercase tracking-wider">
                    01 // SYSTEM SUCCESS VECTORS
                  </span>
                  <span className="text-[10px] font-mono text-[#7e8f85]">OPTIONAL</span>
                </div>
                <label
                  htmlFor="reflection-q1"
                  className="text-xs font-mono font-medium text-[#e5ebe7] block"
                >
                  What execution conditions supported completed sessions?
                </label>
                <textarea
                  id="reflection-q1"
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  placeholder="e.g. Morning 08:00 blocks executed with zero friction..."
                  rows={3}
                  className="w-full p-3 rounded-sm bg-[#080d0b] border border-[#182621] hover:border-[#1f332c] focus-visible:border-[#07CB6C] focus-visible:ring-1 focus-visible:ring-[#07CB6C] text-base md:text-xs font-mono text-[#e5ebe7] placeholder-[#4e6155] outline-none overscroll-contain resize-none transition-colors"
                />
              </div>

              {/* Prompt 2: Bottlenecks & Friction */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                    02 // BOTTLENECK ANALYSIS
                  </span>
                  <span className="text-[10px] font-mono text-[#7e8f85]">PRIMARY</span>
                </div>
                <label
                  htmlFor="reflection-q2"
                  className="text-xs font-mono font-medium text-[#e5ebe7] block"
                >
                  What operational friction or schedule conflicts caused missed sessions?
                </label>
                <textarea
                  id="reflection-q2"
                  value={whatGotInWay}
                  onChange={(e) => setWhatGotInWay(e.target.value)}
                  placeholder="e.g. Late work deliverable collided with Thursday 18:00 slot..."
                  rows={3}
                  className="w-full p-3 rounded-sm bg-[#080d0b] border border-[#182621] hover:border-[#1f332c] focus-visible:border-amber-400 focus-visible:ring-1 focus-visible:ring-amber-400 text-base md:text-xs font-mono text-[#e5ebe7] placeholder-[#4e6155] outline-none overscroll-contain resize-none transition-colors"
                />
              </div>
            </div>

            {/* Prompt 3: Pacing & Difficulty Calibration */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#a6b8ad] uppercase tracking-wider">
                  03 // WORKLOAD & DIFFICULTY CALIBRATION
                </span>
                <span className="text-[10px] font-mono text-[#7e8f85]">REQUIRED</span>
              </div>
              <label
                id="difficulty-group-label"
                className="text-xs font-mono font-medium text-[#e5ebe7] block"
              >
                Pacing telemetry calibration:
              </label>
              <div
                role="radiogroup"
                aria-labelledby="difficulty-group-label"
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                {['Too Easy', 'Just Right', 'Too Challenging'].map((option) => {
                  const isSelected = difficulty === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Pacing calibration: ${option}`}
                      onClick={() => setDifficulty(option)}
                      className={`min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs font-mono rounded-sm transition-all cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] active:scale-[0.99] ${
                        isSelected
                          ? 'bg-[#07CB6C]/15 border border-[#07CB6C] text-[#07CB6C] font-bold'
                          : 'bg-[#080d0b] border border-[#182621] text-[#7e8f85] hover:text-[#e5ebe7] hover:border-[#1f332c]'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isSelected ? 'bg-[#07CB6C]' : 'bg-[#182621]'
                        }`}
                      />
                      <span>{option.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt 4: Time Block & Schedule Adjustments */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-[#a6b8ad] uppercase tracking-wider">
                  04 // TIME BLOCK ADJUSTMENT
                </span>
                <span className="text-[10px] font-mono text-[#7e8f85]">OPTIONAL</span>
              </div>
              <label
                htmlFor="reflection-q4"
                className="text-xs font-mono font-medium text-[#e5ebe7] block"
              >
                Proposed routine tuning or availability modifications:
              </label>
              <textarea
                id="reflection-q4"
                value={scheduleChanges}
                onChange={(e) => setScheduleChanges(e.target.value)}
                placeholder="e.g. Shift Thursday session to Saturday 10:00 AM window..."
                rows={2}
                className="w-full p-3 rounded-sm bg-[#080d0b] border border-[#182621] hover:border-[#1f332c] focus-visible:border-[#07CB6C] focus-visible:ring-1 focus-visible:ring-[#07CB6C] text-base md:text-xs font-mono text-[#e5ebe7] placeholder-[#4e6155] outline-none overscroll-contain resize-none transition-colors"
              />
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#182621]">
              <span className="text-[10px] font-mono text-[#7e8f85] hidden sm:inline">
                INSIGHTS WILL CALIBRATE WEEK {weekNumber + 1} BUFFER ALLOCATIONS.
              </span>
              <button
                id="btn-submit-reflection"
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs font-mono font-bold bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] text-[#050807] rounded-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 ml-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>COMMITTING LOG...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>COMMIT RETROSPECTIVE // RE-CALIBRATE ROUTINE</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
