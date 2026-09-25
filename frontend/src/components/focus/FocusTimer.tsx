import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button, IconButton } from '../ui';
import type { DetailedStep } from '../../types';

interface FocusTimerProps {
  taskTitle: string;
  secondsRemaining: number;
  totalDurationSeconds: number;
  isActive: boolean;
  onToggleActive: () => void;
  onReset: () => void;
  steps: DetailedStep[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  taskTitle,
  secondsRemaining,
  totalDurationSeconds,
  isActive,
  onToggleActive,
  onReset,
  steps,
  currentStepIndex,
  onSelectStep,
}) => {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressRatio = totalDurationSeconds > 0 ? (totalDurationSeconds - secondsRemaining) / totalDurationSeconds : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <section aria-label="Focus timer and session controls" className="flex flex-col items-center text-center space-y-4">
      {/* Task Title & Keyboard Hint */}
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-h3 font-medium tracking-tight text-text line-clamp-2 leading-snug">
          {taskTitle}
        </h2>
        <p className="text-micro text-text-secondary font-ui-mono">
          Press <kbd className="px-1.5 py-0.5 rounded-control bg-surface border border-border text-text-secondary">Space</kbd> to {isActive ? 'pause' : 'resume'}
        </p>
      </div>

      {/* Scaled Circular SVG Timer */}
      <div className="relative inline-flex items-center justify-center">
        <svg className="size-40 sm:size-48 -rotate-90 transform" aria-hidden="true">
          {/* Background Ring */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            className="stroke-border-strong"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Accent Progress Ring */}
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            className="stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear"
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* Time Inside Ring */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl lg:text-5xl font-ui-mono font-bold tracking-tight text-text tabular">
            {timeFormatted}
          </span>
          <span
            className={`text-micro font-ui-mono uppercase tracking-widest mt-1.5 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 border ${
              isActive
                ? 'bg-accent/15 text-accent border-accent/30'
                : 'bg-surface text-text-secondary border-border'
            }`}
          >
            {isActive ? (
              <>
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                <span>In Flow</span>
              </>
            ) : (
              <span>Paused</span>
            )}
          </span>
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          variant={isActive ? 'secondary' : 'primary'}
          onClick={onToggleActive}
          className="min-h-[44px] px-6 text-small font-medium"
        >
          {isActive ? (
            <>
              <Pause className="size-4 mr-2" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="size-4 mr-2 fill-current" />
              <span>Resume</span>
            </>
          )}
        </Button>

        <IconButton
          variant="secondary"
          label="Reset timer"
          icon={<RotateCcw className="size-4" />}
          onClick={onReset}
          className="min-h-[44px] min-w-[44px]"
        />
      </div>

      {/* Horizontal Step Indicator Pills */}
      {steps.length > 0 && (
        <nav aria-label="Step navigation" className="flex flex-wrap items-center justify-center gap-1 pt-1">
          {steps.map((step, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectStep(idx)}
              title={`Step ${idx + 1}: ${step.title || ''}`}
              aria-label={`Step ${idx + 1}: ${step.title || ''}`}
              aria-current={idx === currentStepIndex ? 'step' : undefined}
              className="min-h-[44px] min-w-[28px] flex items-center justify-center p-1.5 cursor-pointer focus-ring rounded-control"
            >
              <span
                className={`h-2 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'w-8 bg-accent'
                    : idx < currentStepIndex
                    ? 'w-3.5 bg-accent/40'
                    : 'w-3.5 bg-border-control'
                }`}
              />
            </button>
          ))}
        </nav>
      )}
    </section>
  );
};
