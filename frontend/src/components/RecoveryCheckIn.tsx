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
    'Consecutive misses detected threatening the active critical path.';

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
      setErrorMessage(err.message || 'Failed to submit strategic diagnosis.');
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

      <div className="relative w-full max-w-2xl bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-amber-500/40 shadow-2xl z-10 space-y-6 my-auto text-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1a2824] pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                STRATEGIC DIAGNOSTIC // ADAPTIVE CALIBRATION
              </span>
              {isBottleneckThreatened && (
                <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold uppercase">
                  CRITICAL BOTTLENECK THREATENED
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              System Disruption Diagnosis
            </h2>

            <p className="text-xs font-mono text-neutral-400 leading-relaxed max-w-xl">
              {triggerReason}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer shrink-0"
            title="Dismiss diagnostic"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Diagnostic Form or Result Presentation */}
        {!submitResult ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Root Cause Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-neutral-300">
                1. What was the governing cause of this disruption?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40'
                          : 'bg-[#0d1412] border-[#1a2824] hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <div className="space-y-0.5 min-w-0">
                        <span className={`text-xs font-bold font-mono block ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                          {cat.title}
                        </span>
                        <span className="text-[11px] text-neutral-400 block leading-tight line-clamp-2 font-mono">
                          {cat.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Temporal Nature (Acute vs. Persistent) */}
            <div className="space-y-2 pt-2 border-t border-[#1a2824]">
              <label className="block text-xs font-mono font-semibold uppercase tracking-wider text-neutral-300">
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
                  <span className="text-xs font-bold font-mono block text-emerald-400 mb-0.5">
                    Temporary (Acute Event)
                  </span>
                  <p className="text-[11px] font-mono text-neutral-400 leading-snug">
                    Short-term friction (e.g. 2-day travel, brief illness). Compress or resume route with zero backlog debt.
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
                  <span className="text-xs font-bold font-mono block text-amber-400 mb-0.5">
                    Persistent Capacity Shift
                  </span>
                  <p className="text-[11px] font-mono text-neutral-400 leading-snug">
                    Ongoing routine change (new job, reduced hours). System drops lower-tier work to protect critical path.
                  </p>
                </button>
              </div>
            </div>

            {/* Step 3: Capacity Slider (if persistent) */}
            {isPersistent && (
              <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-300 uppercase">Adjust Sustainable Weekly Capacity:</span>
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
                <p className="text-[11px] font-mono text-neutral-400">
                  Minimum Effective Dose (MED) will be calibrated to fit within this capacity.
                </p>
              </div>
            )}

            {/* Step 4: Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Additional Diagnostic Notes (Optional)
              </label>
              <input
                type="text"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Recovering from flu, back to full strength on Monday"
                className="w-full px-3 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#080d0b]" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              <span>REBALANCE TRAJECTORY // NO DEBT GUARANTEE</span>
            </button>
          </form>
        ) : (
          /* Rebalance Result Explanation */
          <div className="space-y-5 p-5 rounded-xl bg-[#0d1412] border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>TRAJECTORY RECALIBRATED SUCCESSFULLY</span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                DECISION TRACE EXPLANATION
              </span>
              <p className="text-xs font-mono text-white leading-relaxed bg-[#0a0f0d] p-3.5 rounded border border-[#1a2824]">
                {submitResult.userFacingExplanation}
              </p>
            </div>

            {submitResult.replanResult?.primaryAction && (
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-neutral-400">Selected Core Action:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                  [{submitResult.replanResult.primaryAction}]
                </span>
                <span className="text-neutral-400 ml-2">No-Debt Principle Enforced</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAcknowledgeAndClose}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>CONTINUE EXECUTION PROTOCOL</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
