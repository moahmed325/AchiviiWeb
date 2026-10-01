import React from 'react';
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '../ui';
import { StepChallengeWidget } from '../StepChallengeWidget';
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
    <article aria-label={isMinimumVersion ? 'Minimum version' : `Current step`} className="max-w-2xl mx-auto w-full rounded-2xl bg-surface border border-border shadow-raised overflow-hidden">      <div className="h-1 bg-accent" aria-hidden="true" />
      <div className="p-5 sm:p-7 space-y-5">
        <div>
          <p className="text-micro font-ui-mono uppercase tracking-[0.18em] text-accent mb-2">
            {isMinimumVersion ? 'Minimum version' : 'Do this now'}
          </p>
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text leading-tight">{currentStep.title}</h3>
        </div>

        <p className="text-base text-text-secondary leading-relaxed">{currentStep.instructions}</p>

        {currentStep.passMark && (
          <div className="flex items-start gap-2.5 rounded-xl bg-accent/8 border border-accent/20 px-4 py-3 text-small text-text-secondary">
            <ShieldCheck className="size-4 text-accent shrink-0 mt-0.5" />
            <span><strong className="text-text font-medium">Done when:</strong> {currentStep.passMark}</span>
          </div>
        )}

        <StepChallengeWidget step={currentStep} />

        {minimumVersion && !isMinimumVersion && (
          <button type="button" onClick={onUseMinimumVersion} className="w-full text-left rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 hover:bg-accent/10 transition-colors focus-ring">
            <span className="block text-small font-medium text-text">Low energy? Do the minimum.</span>
            <span className="block text-micro text-text-secondary mt-0.5">Keep the habit moving with the shorter version.</span>
          </button>
        )}        {currentStep.resourceUrl && (
          <a href={currentStep.resourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-small text-accent hover:underline focus-ring rounded-control">
            {currentStep.resourceTitle || 'Open guide'} <ExternalLink className="size-3.5" />
          </a>
        )}

        <div className="pt-2 border-t border-border">
          <Button variant="primary" onClick={onNextStep} className="w-full min-h-[52px] text-base shadow-[0_12px_32px_rgba(199,167,92,0.16)]">
            {isMinimumVersion ? 'Complete minimum' : currentStepIndex === totalSteps - 1 ? 'Complete session' : 'I’m done — next'}
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </div>
    </article>
  );
};
