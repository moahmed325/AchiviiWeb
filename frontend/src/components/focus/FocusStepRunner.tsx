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
    <section className="max-w-xl mx-auto p-6 sm:p-8 rounded-panel bg-surface border border-accent/20 shadow-[0_16px_50px_color-mix(in_srgb,var(--color-achievement)_8%,transparent)] text-center">
      <p className="text-body text-text mb-5">{fallbackTitle}</p>
      <Button variant="primary" onClick={onCompleteFallback} className="w-full">Complete session</Button>
    </section>
  );

  return (
    <article aria-label={isMinimumVersion ? 'Minimum version' : 'Current step'} className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-micro font-ui-mono uppercase tracking-[0.18em] text-achievement">
          {isMinimumVersion ? 'Minimum version' : `Step ${currentStepIndex + 1} of ${totalSteps}`}
        </p>
        {minimumVersion && !isMinimumVersion && (
          <button type="button" onClick={onUseMinimumVersion} aria-label="Low energy — do the minimum" className="text-small text-text-secondary hover:text-achievement transition-colors focus-ring rounded-control">
            Do the minimum
          </button>
        )}
      </div>

      <div className="space-y-5">
        <h3 className="text-h3 text-text">{currentStep.title}</h3>
        <p className="text-body sm:text-body-lg text-text-secondary max-w-xl">{currentStep.instructions}</p>

        {currentStep.passMark && (
          <p className="text-small text-text-secondary pl-3 border-l-2 border-achievement/50">
            <strong className="text-text font-medium">Done when:</strong> {currentStep.passMark}
          </p>
        )}

        {(currentStep.resourceUrl || currentStep.focusCue || currentStep.pitfallToAvoid) && (
          <details className="group pt-1">
            <summary className="cursor-pointer list-none text-small text-text-secondary hover:text-achievement transition-colors focus-ring rounded-control">
              Need help?
            </summary>
            <div className="mt-3 space-y-2 text-small text-text-secondary">
              {currentStep.focusCue && <p><span className="text-text">Focus:</span> {currentStep.focusCue}</p>}
              {currentStep.pitfallToAvoid && <p><span className="text-text">Avoid:</span> {currentStep.pitfallToAvoid}</p>}
              {currentStep.resourceUrl && <a href={currentStep.resourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-achievement">{currentStep.resourceTitle || 'Open guide'} <ExternalLink className="size-3.5" /></a>}
            </div>
          </details>
        )}

        <Button variant="primary" size="lg" onClick={onNextStep} className="w-full shadow-[0_12px_32px_color-mix(in_srgb,var(--color-achievement)_16%,transparent)]">
          {isMinimumVersion ? 'Complete minimum' : currentStepIndex === totalSteps - 1 ? 'Complete session' : 'Done — next'}
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </div>
    </article>
  );
};
