import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RescheduleResult } from '../types';

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
    <div className="mb-6 rounded-2xl overflow-hidden border shadow-sm transition-all duration-300">
      {/* Guardrail critical alert */}
      {isGuardrail ? (
        <div className="bg-gradient-to-r from-rose-900/30 via-red-900/20 to-neutral-900/50 border-rose-500/40 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 text-xl">
                🚨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-rose-300 text-base">
                    Pace Guardrail Alert: {slippageDays} Days Behind Schedule
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    2+ Weeks Slippage
                  </span>
                </div>
                <p className="text-sm text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                  You are more than 2 weeks past your original target pacing. Projected finish has moved to{' '}
                  <span className="font-semibold text-white">{formattedTarget}</span>.
                  We recommend adjusting your routine availability or restarting Phase 1 to sustain healthy habits.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/onboarding?mode=adjust"
                className="px-3.5 py-2 text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/60 rounded-xl transition-colors text-center"
              >
                Adjust Routine
              </Link>
              <button
                type="button"
                onClick={onTriggerReschedule}
                disabled={isRescheduling}
                className="px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl shadow-md transition-colors flex items-center gap-2"
              >
                {isRescheduling ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Rescheduling...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Re-evaluate Schedule</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : isSlipped ? (
        /* Moderate slippage notice */
        <div className="bg-gradient-to-r from-amber-950/30 via-neutral-900/40 to-neutral-900/60 border-amber-500/30 p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0 text-xl">
                ⏳
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-amber-200 text-base">
                    Adaptive Rescheduling Active (+{slippageDays} {slippageDays === 1 ? 'day' : 'days'} slippage)
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Timeline Extended
                  </span>
                </div>
                <p className="text-sm text-neutral-300 mt-1 max-w-2xl leading-relaxed">
                  Missed sessions were pushed into open buffer slots (including Sunday recovery). Your projected completion is now{' '}
                  <span className="font-semibold text-white">{formattedTarget}</span>. No progress was lost!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onTriggerReschedule}
                disabled={isRescheduling}
                className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl shadow-md transition-colors flex items-center gap-2"
              >
                {isRescheduling ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    Checking...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>Run Rescheduler</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* On track */
        <div className="bg-gradient-to-r from-emerald-950/20 via-neutral-900/40 to-neutral-900/60 border-emerald-500/20 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-sm">
                ✓
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-emerald-300 text-sm">100% On Schedule</span>
                  <span className="text-xs text-neutral-400">· 0 days slippage</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Target finish: <span className="text-neutral-200 font-medium">{formattedTarget}</span>. Sunday buffer slots are currently unreserved.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onTriggerReschedule}
              disabled={isRescheduling}
              className="self-start sm:self-auto px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isRescheduling ? (
                <>
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Check Pace</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Reschedule Log drawer when actions occurred */}
      {lastRescheduleResult && lastRescheduleResult.actions.length > 0 && (
        <div className="border-t border-neutral-800 bg-neutral-950/70 p-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-neutral-300 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-400 animate-ping" />
              Recent Adaptive Actions ({lastRescheduleResult.actions.length} sessions reallocated)
            </span>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {showDetails && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
              {lastRescheduleResult.actions.map((act, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-medium text-white">{act.taskTitle}</span>
                    <p className="text-neutral-400 mt-0.5">{act.details}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                      act.actionType === 'REALLOCATED_SAME_WEEK'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {act.actionType === 'REALLOCATED_SAME_WEEK' ? 'Within Week' : 'Plan Extended'}
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
