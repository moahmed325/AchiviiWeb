import React, { useState } from 'react';
import { PendingReflectionState } from '../types';
import { submitWeeklyReflection } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  HelpCircle,
  Loader2,
  X,
  Send,
  Check,
  CalendarCheck2,
} from 'lucide-react';

interface WeeklyReflectionProps {
  reflectionState: PendingReflectionState;
  onResolved: () => void | Promise<void>;
}

export const WeeklyReflection: React.FC<WeeklyReflectionProps> = ({
  reflectionState,
  onResolved,
}) => {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states for full reflection
  const [whatWentWell, setWhatWentWell] = useState<string>('');
  const [whatGotInWay, setWhatGotInWay] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('Just Right');
  const [scheduleChanges, setScheduleChanges] = useState<string>('');

  if (!reflectionState.pending || isDismissed) {
    return null;
  }

  const isSingleTap = reflectionState.reflection_type === 'single_tap';
  const weekNumber = reflectionState.week_number || 1;
  const completionRatePercent = Math.round((reflectionState.completion_rate ?? 1) * 100);

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

      setSuccessMessage('Week confirmed! Your plan continues smoothly.');
      setTimeout(async () => {
        await onResolved();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit check-in.');
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

      setSuccessMessage('Reflection saved! Your coach will use these insights to optimize upcoming weeks.');
      setTimeout(async () => {
        await onResolved();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit reflection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="weekly-reflection-card"
      role="region"
      aria-label="Weekly Reflection Check-In"
      className="mb-6 rounded-2xl overflow-hidden border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-950/95 shadow-xl transition-all duration-300 relative"
    >
      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
        title="Dismiss reflection for now"
        aria-label="Dismiss weekly reflection for now"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3.5 pr-8">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            {isSingleTap ? <CalendarCheck2 className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-base sm:text-lg text-white">
                {isSingleTap
                  ? `Week ${weekNumber} Check-in: Good week — same plan next week?`
                  : `Week ${weekNumber} Reflection`}
              </h3>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {completionRatePercent}% Completed
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              {isSingleTap ? (
                <>
                  You completed {completionRatePercent}% of your sessions in Week {weekNumber}. One tap to confirm
                  your upcoming week’s routine.
                </>
              ) : (
                <>
                  You completed {completionRatePercent}% of scheduled sessions this week. Let’s take a brief moment
                  to reflect so we can optimize your routine for next week.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Feedback states */}
        {successMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs"
          >
            {errorMessage}
          </div>
        )}

        {/* Single-Tap Variant */}
        {isSingleTap && !successMessage && (
          <div className="pt-2 flex items-center gap-3">
            <button
              id="btn-confirm-same-plan"
              type="button"
              onClick={handleSingleTapConfirm}
              disabled={isSubmitting}
              aria-label={`Keep same plan for Week ${weekNumber + 1}`}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Keep Same Plan for Week {weekNumber + 1}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Full 4-Question Variant */}
        {!isSingleTap && !successMessage && (
          <form onSubmit={handleFullSubmit} className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Question 1 */}
              <div className="space-y-1.5">
                <label htmlFor="reflection-q1" className="text-xs font-semibold text-slate-300">
                  1. What went well this week?
                </label>
                <textarea
                  id="reflection-q1"
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  placeholder="e.g. Morning sessions felt natural and productive..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              {/* Question 2 */}
              <div className="space-y-1.5">
                <label htmlFor="reflection-q2" className="text-xs font-semibold text-slate-300">
                  2. What got in the way of your sessions?
                </label>
                <textarea
                  id="reflection-q2"
                  value={whatGotInWay}
                  onChange={(e) => setWhatGotInWay(e.target.value)}
                  placeholder="e.g. Late work meetings clashed with Thursday session..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Question 3: Difficulty Choices */}
            <div className="space-y-1.5">
              <label id="difficulty-group-label" className="text-xs font-semibold text-slate-300">
                3. How did the pacing and difficulty feel?
              </label>
              <div
                role="radiogroup"
                aria-labelledby="difficulty-group-label"
                className="flex flex-wrap gap-2"
              >
                {['Too Easy', 'Just Right', 'Too Challenging'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={difficulty === option}
                    aria-label={`Difficulty: ${option}`}
                    onClick={() => setDifficulty(option)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      difficulty === option
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 4: Routine Changes */}
            <div className="space-y-1.5">
              <label htmlFor="reflection-q4" className="text-xs font-semibold text-slate-300">
                4. Do you need any adjustments to your weekly routine?
              </label>
              <textarea
                id="reflection-q4"
                value={scheduleChanges}
                onChange={(e) => setScheduleChanges(e.target.value)}
                placeholder="e.g. Free up Thursday evening and move to Saturday morning..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                id="btn-submit-reflection"
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Reflection</span>
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
