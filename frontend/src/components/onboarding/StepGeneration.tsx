import React from 'react';
import { AlertCircle, Check, Target } from 'lucide-react';
import type { PlanProgressEvent } from '../../lib/api';
import type { OnboardingError } from './requestErrors';

const PLAN_STEPS: Array<{ id: PlanProgressEvent['id']; pending: string }> = [
  { id: 'search', pending: 'Search sources' },
  { id: 'method', pending: 'Choose the method' },
  { id: 'plan', pending: 'Write the first week' },
];

interface StepGenerationProps {
  planSteps: PlanProgressEvent[];
  generationError: OnboardingError | null;
  onReviewInputs: () => void;
  onRetry: () => void;
}

/* Phase 4 redesigns this screen; M3.7 only made its failure copy honest and announced. */
export const StepGeneration: React.FC<StepGenerationProps> = ({ planSteps, generationError, onReviewInputs, onRetry }) => (
  <div className="py-16 text-center space-y-6 animate-fadeInUp">
    {generationError ? (
      <div role="alert" className="max-w-md mx-auto space-y-6 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-red-950/50 border border-red-800 flex items-center justify-center text-red-400 shadow-xl shadow-red-950/30">
          <AlertCircle aria-hidden="true" className="w-8 h-8 text-red-400 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">{generationError.title}</h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">{generationError.message}</p>
          {generationError.kind === 'server' && (
            <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
              No plan was made, and your current journey, if you have one, is unchanged.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onReviewInputs}
            className="min-h-11 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Review your answers
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 px-5 py-2 bg-[#07CB6C] hover:bg-[#06b560] text-black rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-[#07CB6C]/20"
          >
            Try again
          </button>
        </div>
      </div>
    ) : (
      <>
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[#07CB6C]/20 border-t-[#07CB6C] animate-spin" />
          <Target className="w-8 h-8 text-[#07CB6C] animate-pulse" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Building your plan...
          </h2>
          <ol className="max-w-md mx-auto text-left space-y-2 pt-2">
            {PLAN_STEPS.map((item, index) => {
              const seen = planSteps.find((step) => step.id === item.id);
              const active = planSteps[planSteps.length - 1]?.id === item.id;
              const done = Boolean(seen) && !active;
              return (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                    active
                      ? 'border-[#07CB6C]/50 bg-[#07CB6C]/10'
                      : done
                      ? 'border-[#1a2824] bg-[#0a120e]'
                      : 'border-[#121c18] bg-[#050807] opacity-60'
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done || active ? 'bg-[#07CB6C] text-black' : 'bg-[#121a17] text-neutral-500'
                  }`}>
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm ${active ? 'text-white' : 'text-neutral-300'}`}>
                      {seen?.label || item.pending}
                    </span>
                    {seen?.detail && (
                      <span className="block text-[11px] text-neutral-500">{seen.detail}</span>
                    )}
                    {active && seen?.slow && (
                      <span className="block text-[11px] text-amber-300">
                        This is taking longer than usual. Still working ({Math.round(seen.elapsedMs / 1000)}s).
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </>
    )}
  </div>
);
