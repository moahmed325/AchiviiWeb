import React, { useState } from 'react';
import { RescheduleResult } from '../types';
import { AlertTriangle, Clock, CheckCircle2, ArrowRight, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SlippageBannerProps {
  slippageDays: number;
  startDate?: string;
  targetEndDate: string;
  onTriggerReschedule: () => Promise<void>;
  isRescheduling?: boolean;
  lastRescheduleResult?: RescheduleResult | null;
  onOpenRecovery?: () => void;
}

export const SlippageBanner: React.FC<SlippageBannerProps> = ({
  slippageDays,
  targetEndDate,
  onTriggerReschedule,
  isRescheduling = false,
  lastRescheduleResult,
  onOpenRecovery,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const formattedTarget = new Date(targetEndDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isGuardrail = slippageDays >= 14;
  const isSlipped = slippageDays > 0;

  if (isDismissed) {
    return (
      <div className="mb-4 flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-xs font-mono">
        <div className="flex items-center gap-2 text-neutral-400">
          <span className={`w-1.5 h-1.5 rounded-full ${isGuardrail ? 'bg-[#ef4444]' : isSlipped ? 'bg-amber-400' : 'bg-[#07CB6C]'} animate-pulse`} />
          <span className="text-neutral-400">RECOVERY TELEMETRY SNOOZED</span>
          {isSlipped && (
            <span className={isGuardrail ? 'text-[#ef4444] font-semibold' : 'text-amber-400 font-semibold'}>
              (+{slippageDays}d drift)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-xs text-[#07CB6C] hover:underline cursor-pointer"
        >
          Restore Banner
        </button>
      </div>
    );
  }

  const handleInitiate = () => {
    if (onOpenRecovery) {
      onOpenRecovery();
    } else {
      onTriggerReschedule();
    }
  };

  return (
    <div className="mb-6 bg-[#131b18] border border-[#1a2824] rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Column: Telemetry Badge + Editorial Copy */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center ${
              isGuardrail
                ? 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]'
                : isSlipped
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                : 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]'
            }`}
          >
            {isGuardrail ? (
              <AlertTriangle className="w-4 h-4" />
            ) : isSlipped ? (
              <Clock className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {isGuardrail ? (
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 px-2 py-0.5 rounded font-medium">
                  [CRITICAL SLIPPAGE DETECTED]
                </span>
              ) : isSlipped ? (
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/30 px-2 py-0.5 rounded font-medium">
                  [SCHEDULE DRIFT DETECTED]
                </span>
              ) : (
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/30 px-2 py-0.5 rounded font-medium">
                  [CADENCE NOMINAL]
                </span>
              )}
              {isSlipped && (
                <span className="font-mono text-[10px] text-neutral-400 bg-[#0d1412] px-2 py-0.5 rounded border border-[#1a2824]">
                  +{slippageDays}D OFFSET
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-medium text-white">
              {isGuardrail
                ? `Buffer capacity threshold reached. ${slippageDays} days behind target.`
                : isSlipped
                ? 'Buffer capacity active. Core sessions require reallocation.'
                : 'Pacing nominal. All buffer slots intact.'}
            </h3>

            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              {isSlipped
                ? 'Your 90-day trajectory is preserved. Allocate to upcoming buffer slots to restore optimal pacing.'
                : `Current execution velocity matches target trajectory. Target finish date: ${formattedTarget}.`}
            </p>
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
          {isSlipped && (
            <Link
              to="/onboarding?mode=adjust"
              className="min-h-[44px] px-3.5 py-2 text-xs font-mono font-medium bg-[#0a0f0d] hover:bg-[#111a17] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#2a3e38] rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Adjust</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleInitiate}
            disabled={isRescheduling}
            className="min-h-[44px] px-4 py-2 text-xs font-mono font-bold bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.2)] disabled:opacity-40"
          >
            {isRescheduling ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#080d0b] border-t-transparent rounded-full" />
                <span>Recalibrating...</span>
              </>
            ) : (
              <>
                <span>Initiate Recovery Protocol</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="min-h-[44px] px-3 py-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Snooze banner"
          >
            Snooze
          </button>
        </div>
      </div>

      {/* Reallocation telemetry log when actions occurred */}
      {lastRescheduleResult && lastRescheduleResult.actions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#1a2824] text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
              <span>REALLOCATION TELEMETRY // {lastRescheduleResult.actions.length} SESSIONS REALLOCATED</span>
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-[#07CB6C] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{showDetails ? 'COLLAPSE LOG' : 'EXPAND LOG'}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showDetails && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto overscroll-contain pr-1">
              {lastRescheduleResult.actions.map((act, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-[#0a0f0d] border border-[#1a2824] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-white truncate block">{act.taskTitle}</span>
                    <p className="text-neutral-400 text-[11px] mt-0.5">{act.details}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      act.actionType === 'REALLOCATED_SAME_WEEK'
                        ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30'
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
