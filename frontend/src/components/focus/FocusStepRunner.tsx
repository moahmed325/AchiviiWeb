import React from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from '../ui';
import type { DetailedStep } from '../../types';

interface FocusStepRunnerProps {
  currentStep?: DetailedStep;
  currentStepIndex: number;
  totalSteps: number;
  showTips: boolean;
  onToggleTips: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onCompleteFallback: () => void;
  fallbackTitle: string;
  minimumVersion?: DetailedStep | null;
  onUseMinimumVersion: () => void;
  isMinimumVersion: boolean;
}

export const FocusStepRunner: React.FC<FocusStepRunnerProps> = ({
  currentStep, currentStepIndex, totalSteps, onNextStep, onCompleteFallback, fallbackTitle,
  minimumVersion, onUseMinimumVersion, isMinimumVersion,
}) => {
  if (!currentStep) return (
    <section className="max-w-xl mx-auto p-6 sm:p-8 rounded-2xl bg-surface border border-accent/20 shadow-[0_16px_50px_rgba(199,167,92,0.08)] text-center">
      <p className="text-base text-text leading-relaxed mb-5">{fallbackTitle}</p>
      <Button variant="primary" onClick={onCompleteFallback} className="min-h-[48px] w-full">Complete session</Button>
    </section>
  );

  return (
    <article aria-label={isMinimumVersion ? 'Minimum version' : 'Current step'} className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-micro font-ui-mono uppercase tracking-[0.18em] text-achievement">
          {isMinimumVersion ? 'Minimum version' : `Step ${currentStepIndex + 1} of ${totalSteps}`}
        </p>
        {minimumVersion && !isMinimumVersion && (
          <button type="button" onClick={onUseMinimumVersion} aria-label="Low energy — do the minimum" className="inline-flex min-h-11 items-center text-small text-text-secondary hover:text-achievement transition-colors focus-ring rounded-control">
            Do the minimum
          </button>
        )}
      </div>

      <div className="space-y-5">
        <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text leading-tight">{currentStep.title}</h3>
        <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">{currentStep.instructions}</p>

        {currentStep.passMark && (
          <p className="text-small text-text-secondary pl-3 border-l-2 border-achievement/50">
            <strong className="text-text font-medium">Done when:</strong> {currentStep.passMark}
          </p>
        )}

        {(currentStep.resourceUrl || currentStep.focusCue || currentStep.pitfallToAvoid) && (
          <details className="group pt-1">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-small text-text-secondary hover:text-achievement transition-colors focus-ring rounded-control">
              Need help?
            </summary>
            <div className="mt-3 space-y-2 text-small text-text-secondary">
              {currentStep.focusCue && <p><span className="text-text">Focus:</span> {currentStep.focusCue}</p>}
              {currentStep.pitfallToAvoid && <p><span className="text-text">Avoid:</span> {currentStep.pitfallToAvoid}</p>}
              {currentStep.resourceUrl && <a href={currentStep.resourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-achievement">{currentStep.resourceTitle || 'Open guide'} <ExternalLink className="size-3.5" /></a>}
            </div>
          </details>
        )}

        <Button variant="primary" onClick={onNextStep} className="w-full min-h-[52px] text-base shadow-[0_12px_32px_rgba(200,169,107,0.16)]">
          {isMinimumVersion ? 'Complete minimum' : currentStepIndex === totalSteps - 1 ? 'Complete session' : 'Done — next'}
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>
    </article>
  );
};
