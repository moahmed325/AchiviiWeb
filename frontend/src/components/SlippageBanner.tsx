import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RescheduleResult } from '../types';
import { AlertTriangle, Clock, CheckCircle2, Zap, Sliders } from 'lucide-react';

interface SlippageBannerProps {
  slippageDays: number;
  startDate: string;
  targetEndDate: string;
  onTriggerReschedule: () => Promise<void>;
  isRescheduling?: boolean;
  lastRescheduleResult?: RescheduleResult | null;
}

export const SlippageBanner: React.FC<SlippageBannerProps> = ({
  slippageDays,
  targetEndDate,
  onTriggerReschedule,
  isRescheduling = false,
  lastRescheduleResult,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const formattedTarget = new Date(targetEndDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isGuardrail = slippageDays >= 14;
  const isSlipped = slippageDays > 0;

  return (
    <div className="mb-6 rounded-md bg-[#0c1210] border border-[#182621] shadow-none">
      {/* Guardrail critical alert */}
      {isGuardrail ? (
        <div className="p-4 sm:p-5 border-l-2 border-l-[#ef4444]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-sm bg-[#161214] border border-[#ef4444]/30 text-[#ef4444] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ef4444]">
                    PACING TELEMETRY // GUARDRAIL ENGAGED
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-sm bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30">
                    +{slippageDays}D SLIPPAGE
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#e5ebe7]">
                  Critical Delay Detected: <span className="font-mono text-[#ef4444]">{slippageDays} Days</span> Behind Target
                </h3>
                <p className="text-xs text-[#7e8f85] max-w-2xl leading-relaxed">
                  Execution pacing has drifted over 14 days. Target finish updated to{' '}
                  <span className="font-mono text-[#e5ebe7] font-medium">{formattedTarget}</span>.
                  Pacing drift requires slot recalibration or recovery scan to re-index session sequence.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
              <Link
                to="/onboarding?mode=adjust"
                className="min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs font-mono font-medium bg-[#080d0b] hover:bg-[#111a17] active:scale-[0.99] text-[#a6b8ad] hover:text-[#e5ebe7] border border-[#182621] hover:border-[#1f332c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-sm transition-colors flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-[#7e8f85]" />
                <span>Adjust Routine</span>
              </Link>
              <button
                type="button"
                onClick={onTriggerReschedule}
                disabled={isRescheduling}
                className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs font-mono font-bold bg-[#ef4444] hover:bg-[#dc2626] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444] disabled:opacity-40 text-[#050807] rounded-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isRescheduling ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#050807] border-t-transparent rounded-full" />
                    <span>Re-evaluating...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run Recovery Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : isSlipped ? (
        /* Moderate slippage notice */
        <div className="p-4 sm:p-5 border-l-2 border-l-amber-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-sm bg-amber-950/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                    PACING TELEMETRY // ADAPTIVE OFFSET
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-sm bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    +{slippageDays}D EXTENSION
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#e5ebe7]">
                  Adaptive Reallocation Active: <span className="font-mono text-amber-400">+{slippageDays} {slippageDays === 1 ? 'Day' : 'Days'}</span>
                </h3>
                <p className="text-xs text-[#7e8f85] max-w-2xl leading-relaxed">
                  Missed sessions have been reallocated into open buffer windows. Target finish dynamically shifted to{' '}
                  <span className="font-mono text-[#e5ebe7] font-medium">{formattedTarget}</span> with zero lost session content.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
              <button
                type="button"
                onClick={onTriggerReschedule}
                disabled={isRescheduling}
                className="min-h-[44px] min-w-[44px] px-4 py-2 text-xs font-mono font-bold bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-40 text-[#050807] rounded-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isRescheduling ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#050807] border-t-transparent rounded-full" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Reschedule Missed</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* On track */
        <div className="p-4 sm:p-5 border-l-2 border-l-[#07CB6C]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-sm bg-[#0a1711] border border-[#07CB6C]/30 text-[#07CB6C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                    PACING TELEMETRY // NOMINAL CADENCE
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-sm bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30">
                    100% ON TRACK
                  </span>
                </div>
                <p className="text-xs text-[#7e8f85]">
                  Target finish: <span className="font-mono text-[#e5ebe7] font-medium">{formattedTarget}</span> · Slippage: <span className="font-mono text-[#07CB6C]">0 days</span>. All buffer slots intact.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onTriggerReschedule}
              disabled={isRescheduling}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 text-xs font-mono font-medium text-[#a6b8ad] hover:text-[#e5ebe7] bg-[#080d0b] hover:bg-[#111a17] active:scale-[0.99] border border-[#182621] hover:border-[#1f332c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] rounded-sm transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer disabled:opacity-40"
            >
              {isRescheduling ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#a6b8ad] border-t-transparent rounded-full" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-[#07CB6C]" />
                  <span>Run Pacing Check</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Reschedule Log drawer when actions occurred */}
      {lastRescheduleResult && lastRescheduleResult.actions.length > 0 && (
        <div className="border-t border-[#182621] bg-[#080d0b] p-4 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#a6b8ad] flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              <span>REALLOCATION TELEMETRY // {lastRescheduleResult.actions.length} SESSIONS REALLOCATED</span>
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="min-h-[44px] min-w-[44px] px-2 text-[#07CB6C] hover:text-[#06b560] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] rounded-sm transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{showDetails ? 'COLLAPSE LOG [-]' : 'EXPAND LOG [+]'}</span>
            </button>
          </div>

          {showDetails && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto overscroll-contain pr-1">
              {lastRescheduleResult.actions.map((act, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-sm bg-[#0c1210] border border-[#182621] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-[#e5ebe7] truncate block">{act.taskTitle}</span>
                    <p className="text-[#7e8f85] text-[11px] mt-0.5">{act.details}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      act.actionType === 'REALLOCATED_SAME_WEEK'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30'
                    }`}
                  >
                    {act.actionType === 'REALLOCATED_SAME_WEEK' ? 'WITHIN WEEK' : 'PLAN EXTENDED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
