import React, { useState, useEffect } from 'react';
import { PendingReflectionState } from '../types';
import { submitWeeklyReflection } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
  Check
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

  // Structured telemetry inputs
  const [frictionLevel, setFrictionLevel] = useState<'Low Friction' | 'Manageable' | 'High Drag'>('Low Friction');
  const [blocker, setBlocker] = useState<string>('None');
  const [notes, setNotes] = useState<string>('');

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

  // Enforce precedence: Recovery check-ins override reflection
  if (!reflectionState.pending || isDismissed || isRecoveryPending) {
    return null;
  }

  const completionRate = reflectionState.completion_rate ?? 0.8;
  const weekNumber = reflectionState.week_number || 1;
  const targetHours = 10.0;
  const completedHours = (targetHours * completionRate).toFixed(1);

  const isNominal = completionRate >= 0.7;
  const bufferText = isNominal ? '1 of 2 Buffers Absorbed' : '2 of 2 Buffers Absorbed';
  const bufferBadge = isNominal ? '[NOMINAL]' : '[OVERBURDENED]';

  const BLOCKER_TAGS = [
    'None',
    'Context Switching',
    'Underestimated Scope',
    'External Life Event'
  ];

  const handleSubmit = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await submitWeeklyReflection(token, {
        user_goal_id: reflectionState.user_goal_id,
        week_number: weekNumber,
        reflection_type: 'full',
        responses: {
          friction_level: frictionLevel,
          blocker_category: blocker,
          notes: notes.trim(),
          confirmed_same_plan: true,
          completion_rate: completionRate,
          // Backwards compatibility mappings
          difficulty: frictionLevel,
          what_got_in_way: blocker,
          schedule_changes: notes.trim(),
        },
      });

      setSuccessMessage(
        `WEEKLY RETROSPECTIVE LOGGED // PROTOCOL COMMITTED FOR WEEK ${weekNumber + 1}.`
      );

      setTimeout(async () => {
        await onResolved();
      }, 1000);
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="reflection-modal-title"
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
          aria-label="Dismiss debrief modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-1 pr-8">
            <span className="font-mono text-xs text-[#07CB6C] tracking-widest uppercase block font-medium">
              [ TELEMETRY // WEEKLY RETROSPECTIVE ]
            </span>
            <h2 id="reflection-modal-title" className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
              Weekly Cadence Debrief
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Audit session execution, log system friction, and commit the upcoming week&apos;s schedule.
            </p>
          </div>

          {/* Quantitative Cadence Strip (2-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Planned vs. Executed */}
            <div className="bg-[#0d1412] border border-[#1a2824] p-4 rounded-xl space-y-1">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
                PLANNED VS. EXECUTED
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-semibold text-white">
                  {completedHours} / {targetHours.toFixed(1)}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  Hours Completed
                </span>
              </div>
              <div className="w-full bg-[#131f1b] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#07CB6C] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round(completionRate * 100))}%` }}
                />
              </div>
            </div>

            {/* Buffer Utilization */}
            <div className="bg-[#0d1412] border border-[#1a2824] p-4 rounded-xl space-y-1">
              <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
                BUFFER UTILIZATION
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-sm sm:text-base font-semibold text-white">
                  {bufferText}
                </span>
              </div>
              <div className="pt-1.5">
                <span
                  className={`font-mono text-[10px] px-2 py-0.5 rounded font-medium ${
                    isNominal
                      ? 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30'
                      : 'bg-amber-400/10 text-amber-400 border border-amber-400/30'
                  }`}
                >
                  {bufferBadge}
                </span>
              </div>
            </div>
          </div>

          {/* Low-Friction Telemetry Inputs */}
          <div className="space-y-4 pt-1">
            {/* Energy / Friction Toggle */}
            <div className="space-y-2">
              <label className="font-mono text-xs text-neutral-300 uppercase tracking-wider block font-medium">
                Cadence Friction
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['Low Friction', 'Manageable', 'High Drag'] as const).map((level) => {
                  const isSelected = frictionLevel === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFrictionLevel(level)}
                      className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium transition-all border cursor-pointer flex items-center justify-center text-center ${
                        isSelected
                          ? 'border-[#07CB6C] bg-[#07CB6C]/10 text-white font-semibold'
                          : 'border-[#1a2824] bg-[#0d1412] text-neutral-400 hover:text-white hover:border-[#2a3e38]'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Blocker Categorization */}
            <div className="space-y-2">
              <label className="font-mono text-xs text-neutral-300 uppercase tracking-wider block font-medium">
                Primary Friction Source
              </label>
              <div className="flex flex-wrap gap-2">
                {BLOCKER_TAGS.map((tag) => {
                  const isSelected = blocker === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setBlocker(tag)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all border cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'border-[#07CB6C] bg-[#07CB6C]/10 text-white font-semibold'
                          : 'border-[#1a2824] bg-[#0d1412] text-neutral-400 hover:text-white hover:border-[#2a3e38]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-[#07CB6C]" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Compact Notes Field */}
            <div className="space-y-2">
              <label className="font-mono text-xs text-neutral-300 uppercase tracking-wider block font-medium">
                System Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional: Note any system adjustment for next week..."
                className="w-full bg-[#0d1412] border border-[#1a2824] rounded-lg p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C] transition-colors resize-none"
              />
            </div>
          </div>

          {/* Feedback Messages */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
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
              onClick={() => setIsDismissed(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-lg text-neutral-400 hover:text-white border border-[#1a2824] hover:border-[#2a3e38] text-xs font-mono font-medium transition-colors cursor-pointer text-center"
            >
              Dismiss
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] bg-[#07CB6C] text-[#080d0b] font-medium py-2.5 px-5 rounded-lg hover:bg-[#06b860] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Committing Protocol...</span>
                </>
              ) : (
                <>
                  <span>Commit Week Protocol</span>
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
