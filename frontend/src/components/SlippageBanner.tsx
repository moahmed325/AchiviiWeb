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
  goalIntegrityStatus: _goalIntegrityStatus = 'INTACT',
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
      <div className="mb-4 flex items-center justify-between px-4 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
        <div className="flex items-center gap-2 text-neutral-400">
          <span className="w-2 h-2 rounded-full bg-[#07CB6C]" />
          <span>Schedule on track • Target: {formattedTarget}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-xs text-[#07CB6C] hover:underline cursor-pointer"
        >
          Show status
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
    <div className="mb-6 bg-[#0a0f0d] border border-white/10 rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Column: Calm Status & Target Date */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border shrink-0 flex items-center justify-center ${
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
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                isDisrupted
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isDisrupted ? 'bg-amber-400' : 'bg-[#07CB6C]'}`} />
                <span>{isDisrupted ? 'Adjustment Suggested' : 'On Track'}</span>
              </span>
              <span className="text-xs text-neutral-400">
                Target: <strong className="text-white font-medium">{formattedTarget}</strong>
              </span>
            </div>

            <h3 className="text-sm font-semibold text-white">
              {isDisrupted
                ? 'Let’s realign your weekly sessions to fit your available time.'
                : isRevised
                ? `Route calibrated to your recent rhythm. Protected target: ${formattedTarget}.`
                : `Pacing is steady. You are scheduled to complete by ${formattedTarget}.`}
            </h3>

            <p className="text-xs text-neutral-400 max-w-2xl leading-relaxed">
              {isDisrupted
                ? 'Achivii protects your energy. Reorganize your upcoming commitments without piling on catch-up debt.'
                : 'Life comes first: missed sessions are absorbed naturally by buffer time. We adjust future days rather than creating guilt.'}
            </p>
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
          <Link
            to="/dashboard"
            className="min-h-[40px] px-3.5 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/10 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span>Workbench</span>
          </Link>

          <button
            type="button"
            onClick={handleInitiate}
            disabled={isRescheduling}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold bg-[#07CB6C] hover:bg-[#07CB6C]/90 active:scale-[0.99] text-black rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            {isRescheduling ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full" />
                <span>Adjusting...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isDisrupted ? 'Rebalance Sessions' : 'Adjust Schedule'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="min-h-[40px] px-3 py-2 text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer"
            title="Dismiss status"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlippageBanner;
