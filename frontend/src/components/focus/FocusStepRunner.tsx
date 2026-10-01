import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ShieldCheck,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { Button, Badge } from '../ui';
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
  currentStep,
  currentStepIndex,
  totalSteps,
  showTips,
  onToggleTips,
  onPrevStep,
  onNextStep,
  onCompleteFallback,
  fallbackTitle,
  minimumVersion,
  onUseMinimumVersion,
  isMinimumVersion,
}) => {
  if (!currentStep) {
    return (
      <div className="p-6 rounded-panel bg-surface border border-border space-y-4 text-left">
        <p className="text-small text-text-secondary">
          Focus on the primary deliberate practice outcome: <strong className="text-text font-medium">{fallbackTitle}</strong>
        </p>
        <Button variant="primary" onClick={onCompleteFallback} className="min-h-[44px]">
          Complete Practice Session
        </Button>
      </div>
    );
  }

  return (
    <article aria-label={`Step ${currentStepIndex + 1} of ${totalSteps}`} className="p-4 sm:p-6 rounded-panel bg-surface border border-border text-left space-y-4 shadow-raised">
      {/* Step Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-5 rounded-full bg-accent/20 text-accent text-micro font-ui-mono font-bold flex items-center justify-center border border-accent/30">
            {currentStepIndex + 1}
          </span>
          <span className="text-micro font-ui-mono text-text-secondary uppercase tracking-wider">
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
        </div>

        <Badge tone="accent">
          {currentStep.durationMinutes} min target
        </Badge>
      </div>

      {/* Step Title & Instructions */}
      <div className="space-y-2">
        <h3 className="text-h3 font-medium text-text tracking-tight leading-snug">
          {currentStep.title}
        </h3>


        <p className="text-small text-text-secondary leading-relaxed max-h-32 overflow-y-auto pr-1">
          {currentStep.instructions}
        </p>

        {currentStep.passMark && (
          <div className="flex items-start gap-2 rounded-control border border-accent/30 bg-accent/10 px-3 py-2 text-small">
            <ShieldCheck className="size-4 text-accent shrink-0 mt-0.5" />
            <span className="text-text-secondary">
              <strong className="text-text font-medium">Done when: </strong>
              {currentStep.passMark}
            </span>
          </div>
        )}
      </div>

      {/* Interactive Challenge Widget */}
      <StepChallengeWidget step={currentStep} />

      {/* Collapsible Tips & Guidance Toggle */}
      {(currentStep.focusCue || currentStep.pitfallToAvoid) && (
        <div className="border-t border-border pt-2">
          <button
            type="button"
            onClick={onToggleTips}
            aria-expanded={showTips}
            className="inline-flex items-center gap-2 text-small text-text-secondary hover:text-text cursor-pointer transition-colors min-h-[44px] focus-ring rounded-control select-none"
          >
            <Lightbulb aria-hidden="true" className="size-4 text-caution" />
            <span>{showTips ? 'Hide Tips & Cues' : 'View Tips & Guidance'}</span>
            {showTips ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          </button>

          {showTips && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-small animate-fadeIn">
              {currentStep.focusCue && (
                <div className="p-3 rounded-control bg-surface-elevated border border-border flex items-start gap-2 text-text-secondary">
                  <Target aria-hidden="true" className="size-4 text-accent shrink-0 mt-0.5" />
                  <div>
                    <span className="text-micro text-text-secondary uppercase block font-ui-mono">Focus Cue</span>
                    <span className="leading-snug">{currentStep.focusCue}</span>
                  </div>
                </div>
              )}

              {currentStep.pitfallToAvoid && (
                <div className="p-3 rounded-control bg-surface-elevated border border-border flex items-start gap-2 text-text-secondary">
                  <AlertTriangle aria-hidden="true" className="size-4 text-caution shrink-0 mt-0.5" />
                  <div>
                    <span className="text-micro text-text-secondary uppercase block font-ui-mono">Pitfall to Avoid</span>
                    <span className="leading-snug">{currentStep.pitfallToAvoid}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* External Resource Link (if present) */}
      {currentStep.resourceUrl && (
        <div className="pt-0.5">
          <a
            href={currentStep.resourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-small text-accent hover:underline min-h-[32px] focus-ring rounded-control"
          >
            <span>{currentStep.resourceTitle || 'Recommended Guide'}</span>
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      )}

      {minimumVersion && !isMinimumVersion && (
        <div className="rounded-control border border-accent/30 bg-accent/5 px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-small font-medium text-text">Short on time or energy?</p>
            <p className="text-micro text-text-secondary mt-0.5">Do the 10-minute minimum version and keep the day moving.</p>
          </div>
          <Button variant="secondary" onClick={onUseMinimumVersion} className="min-h-[44px] shrink-0">
            Do minimum version
          </Button>
        </div>
      )}

      {/* Step Navigation Controls */}
      <footer className="pt-3 flex items-center justify-between border-t border-border">
        <Button
          variant="secondary"
          onClick={onPrevStep}
          disabled={currentStepIndex === 0}
          className="min-h-[44px]"
        >
          <ArrowLeft aria-hidden="true" className="size-4 mr-2" />
          <span>Previous</span>
        </Button>

        <Button
          variant="primary"
          onClick={onNextStep}
          className="min-h-[48px] px-5 shadow-[0_10px_30px_rgba(199,167,92,0.16)]"
        >
          <span>{isMinimumVersion ? 'Complete minimum session' : currentStepIndex === totalSteps - 1 ? 'Complete Session' : 'Next Step'}</span>
          <ArrowRight aria-hidden="true" className="size-4 ml-2" />
        </Button>
      </footer>
    </article>
  );
};
