import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitDiagnosis } from '../lib/adaptiveApi';
import type {
  DiagnosisPendingResponse,
  DiagnosticCategory,
  DiagnosisSubmitResponse,
} from '../types/adaptive';
import { PendingRecoveryState, Session } from '../types';
import {
  AlertTriangle,
  Loader2,
  X,
  ArrowRight,
  ShieldAlert,
  Zap,
  CheckCircle2,
} from 'lucide-react';

export interface RecoveryCheckInProps {
  diagnosisData?: DiagnosisPendingResponse | null;
  recoveryState?: PendingRecoveryState | null;
  sessions?: Session[];
  slippageDays?: number;
  userGoalId?: string;
  onResolved: () => void | Promise<void>;
}

const CATEGORIES: {
  key: DiagnosticCategory;
  title: string;
  desc: string;
  icon: string;
}[] = [
  {
    key: 'CAPACITY',
    title: 'Capacity & Schedule',
    desc: 'Workload, busy calendar, or urgent professional deadlines',
    icon: '💼',
  },
  {
    key: 'CAPABILITY',
    title: 'Difficulty & Prerequisite',
    desc: 'Session difficulty exceeded current verified baseline',
    icon: '🧠',
  },
  {
    key: 'RECOVERY',
    title: 'Fatigue & Health',
    desc: 'Physical illness, muscle soreness, or sleep deficit',
    icon: '🛌',
  },
  {
    key: 'FRICTION',
    title: 'Logistics & Setup',
    desc: 'Equipment, gym access, software environment, or weather',
    icon: '⚡',
  },
  {
    key: 'MOTIVATION',
    title: 'Energy & Focus',
    desc: 'Mental friction, procrastination, or loss of clarity',
    icon: '🔥',
  },
  {
    key: 'EXTERNAL',
    title: 'Life Events & Travel',
    desc: 'Family obligations, unexpected travel, or emergencies',
    icon: '✈️',
  },
];

export const RecoveryCheckIn: React.FC<RecoveryCheckInProps> = ({
  diagnosisData,
  recoveryState,
  userGoalId,
  onResolved,
}) => {
  const { token } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<DiagnosticCategory>('CAPACITY');
  const [isPersistent, setIsPersistent] = useState<boolean>(false);
  const [newCapacityHours, setNewCapacityHours] = useState<number>(5.0);
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitResult, setSubmitResult] = useState<DiagnosisSubmitResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

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

  const isPending = Boolean(diagnosisData?.pending || recoveryState?.pending);

  if (!isPending || isDismissed) {
    return null;
  }

  const effectiveGoalId =
    userGoalId ||
    diagnosisData?.prompt?.userGoalId ||
    diagnosisData?.deviationReport?.userGoalId ||
    '';

  const triggerReason =
    diagnosisData?.prompt?.triggerReason ||
    diagnosisData?.deviationReport?.explanation ||
    "A couple of sessions were missed. Let's rebalance your routine with zero catch-up debt.";

  const isBottleneckThreatened = diagnosisData?.deviationReport?.isBottleneckThreatened;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await submitDiagnosis(token, {
        userGoalId: effectiveGoalId,
        category: selectedCategory,
        details: details.trim() || `Disruption resolved: ${selectedCategory} constraint diagnosed.`,
        isPersistent,
        newCapacityHours: isPersistent ? newCapacityHours : undefined,
      });

      setSubmitResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit check-in response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcknowledgeAndClose = async () => {
    await onResolved();
    setIsDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={() => setIsDismissed(true)}
      />

      <div className="relative w-full max-w-2xl bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-amber-500/30 shadow-2xl z-10 space-y-6 my-auto text-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1a2824] pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-amber-400">
                Adaptive Check-In
              </span>
              {isBottleneckThreatened && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold">
                  Priority Focus
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Let's Adjust Your Plan
            </h2>

            <p className="text-xs text-neutral-400 leading-relaxed max-w-xl">
              {triggerReason}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Dismiss check-in"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Diagnostic Form or Result Presentation */}
        {!submitResult ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Root Cause Selection */}
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                1. What got in the way?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                          : 'bg-[#0d1412] border-[#1a2824] hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <div className="space-y-0.5 min-w-0">
                        <span className={`text-xs font-semibold block ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                          {cat.title}
                        </span>
                        <span className="text-[11px] text-neutral-400 block leading-tight line-clamp-2">
                          {cat.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Temporal Nature (Acute vs. Persistent) */}
            <div className="space-y-2.5 pt-2 border-t border-[#1a2824]">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300">
                2. Is this disruption temporary or an ongoing schedule change?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsPersistent(false)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !isPersistent
                      ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-white'
                      : 'bg-[#0d1412] border-[#1a2824] text-neutral-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-semibold block text-emerald-400 mb-0.5">
                    Temporary (A few days off)
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Short-term friction (e.g. travel, illness, busy days). We'll absorb or rebalance without any backlog debt.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPersistent(true)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isPersistent
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-[#0d1412] border-[#1a2824] text-neutral-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-semibold block text-amber-400 mb-0.5">
                    Ongoing Schedule Change
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Ongoing routine change (new job, fewer free hours). The system adjusts weekly hours so you stay consistent.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 3: Capacity Slider (if persistent) */}
            {isPersistent && (
              <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">Adjust Weekly Target Hours:</span>
                  <span className="text-amber-400 font-bold">{newCapacityHours} Hours / Week</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  step={0.5}
                  value={newCapacityHours}
                  onChange={(e) => setNewCapacityHours(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <p className="text-[11px] text-neutral-400">
                  Your core sessions will be recalibrated to fit comfortably within this weekly capacity.
                </p>
              </div>
            )}

            {/* Step 4: Notes */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Additional Notes (Optional)
              </label>
              <input
                type="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Recovering from flu, back to full speed on Monday"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1412] border border-[#1a2824] text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>Rebalance Schedule (Zero Debt)</span>
            </button>
          </form>
        ) : (
          /* Rebalance Result Explanation */
          <div className="space-y-5 p-5 rounded-xl bg-[#0d1412] border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Schedule Rebalanced Successfully</span>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] text-neutral-400 uppercase tracking-wider block font-medium">
                How Your Plan Was Adjusted
              </span>
              <p className="text-xs text-white leading-relaxed bg-[#0a0f0d] p-3.5 rounded-xl border border-[#1a2824]">
                {submitResult.userFacingExplanation}
              </p>
            </div>

            {submitResult.replanResult?.primaryAction && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-400">Selected Action:</span>
                <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-semibold uppercase">
                  {submitResult.replanResult.primaryAction}
                </span>
                <span className="text-neutral-400 ml-2">No Backlog Debt</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAcknowledgeAndClose}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.2)]"
            >
              <span>Back to Today's Workbench</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
