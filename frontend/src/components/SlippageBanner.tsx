import React, { useState } from 'react';
import { RescheduleResult } from '../types';
import {
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface TrajectoryStatusBannerProps {
  slippageDays?: number;
  startDate?: string;
  targetEndDate: string;
  onTriggerReschedule: () => Promise<void>;
  isRescheduling?: boolean;
  lastRescheduleResult?: RescheduleResult | null;
  onOpenRecovery?: () => void;
  trajectoryVersion?: {
    id: string;
    versionNumber: number;
    projectedCompletion: string | Date;
    confidenceScore: number;
  };
  goalIntegrityStatus?: string;
  isDisrupted?: boolean;
}

export const SlippageBanner: React.FC<TrajectoryStatusBannerProps> = ({
  targetEndDate,
  onTriggerReschedule,
  isRescheduling = false,
  onOpenRecovery,
  trajectoryVersion,
  goalIntegrityStatus = 'INTACT',
  isDisrupted = false,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const formattedTarget = new Date(targetEndDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const versionNumber = trajectoryVersion?.versionNumber || 1;
  const isRevised = versionNumber > 1;

  if (isDismissed) {
    return (
      <div className="mb-4 flex items-center justify-between px-3.5 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-xs font-mono">
        <div className="flex items-center gap-2 text-neutral-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
          <span className="text-neutral-400">TRAJECTORY TELEMETRY MINIMIZED</span>
          <span className="text-[#07CB6C] font-semibold">
            [TRAJECTORY v{versionNumber} ACTIVE]
          </span>
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
    <div className="mb-6 bg-[#0a0f0d] border border-[#1a2824] rounded-xl p-4 sm:p-5 shadow-2xl relative overflow-hidden transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Column: Adaptive Status + Integrity Telemetry */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center ${
              isDisrupted
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                : isRevised
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]'
            }`}
          >
            {isDisrupted ? (
              <AlertTriangle className="w-4 h-4" />
            ) : isRevised ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/30 px-2 py-0.5 rounded font-bold">
                TRAJECTORY v{versionNumber} ACTIVE
              </span>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30 font-medium">
                DESTINATION INTACT [{goalIntegrityStatus}]
              </span>
              <span className="font-mono text-[10px] text-neutral-400 bg-[#0d1412] px-2 py-0.5 rounded border border-[#1a2824]">
                ZERO BACKLOG DEBT
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-semibold text-white">
              {isDisrupted
                ? 'Strategic Deviation Flagged: Bottleneck capability requires diagnostic calibration.'
                : isRevised
                ? `Route dynamically recalibrated from current verified state. Target: ${formattedTarget}.`
                : `Trajectory pacing optimal. Target completion: ${formattedTarget}.`}
            </h3>

            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              {isDisrupted
                ? 'The adaptive engine protects your destination. Identify the friction point to recalculate an optimal route without debt.'
                : 'Adaptive 90-Day Execution: Missed sessions are absorbed by reliability margins. Your schedule replans from current capability state rather than calendar debt.'}
            </p>
          </div>
        </div>

        {/* Right Column: Interactive Actions */}
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
          <Link
            to="/dashboard"
            className="min-h-[44px] px-3.5 py-2 text-xs font-mono font-medium bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#2a3e38] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span>Workbench</span>
          </Link>

          <button
            type="button"
            onClick={handleInitiate}
            disabled={isRescheduling}
            className="min-h-[44px] px-4 py-2 text-xs font-mono font-bold bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.2)] disabled:opacity-40"
          >
            {isRescheduling ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#080d0b] border-t-transparent rounded-full" />
                <span>Replanning Route...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isDisrupted ? 'Strategic Diagnosis' : 'Adaptive Replan'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="min-h-[44px] px-3 py-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Snooze banner"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlippageBanner;
