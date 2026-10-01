import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button, IconButton } from '../ui';

interface FocusTimerProps {
  taskTitle: string;
  secondsRemaining: number;
  totalDurationSeconds: number;
  isActive: boolean;
  onToggleActive: () => void;
  onReset: () => void;
  currentStepIndex: number;
  totalSteps: number;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  taskTitle,
  secondsRemaining,
  totalDurationSeconds,
  isActive,
  onToggleActive,
  onReset,
  currentStepIndex,
  totalSteps,
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
      <div className="space-y-2 max-w-xl">
        <span className="text-micro font-ui-mono uppercase tracking-[0.18em] text-accent">{isActive ? 'In progress' : 'Paused'}</span>
        <h2 className="text-h2 sm:text-3xl font-semibold tracking-tight text-text line-clamp-2 leading-tight">
          {taskTitle}
        </h2>
        <p className="text-small text-text-secondary">
          Step {Math.min(currentStepIndex + 1, totalSteps)} of {totalSteps || 1} · Keep your attention on the step in front of you.
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
              <Pause aria-hidden="true" className="size-4 mr-2" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play aria-hidden="true" className="size-4 mr-2 fill-current" />
              <span>Resume</span>
            </>
          )}
        </Button>

        <IconButton
          variant="secondary"
          label="Reset timer"
          icon={<RotateCcw aria-hidden="true" className="size-4" />}
          onClick={onReset}
          className="min-h-[44px] min-w-[44px]"
        />
      </div>

      <div className="flex items-center gap-2 text-micro font-ui-mono text-text-secondary">
        {Array.from({ length: Math.max(totalSteps, 1) }).map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all ${idx <= currentStepIndex ? 'w-7 bg-accent' : 'w-4 bg-border-control'}`}
            aria-hidden="true"
          />
        ))}
        <span className="ml-1">{Math.min(currentStepIndex + 1, totalSteps || 1)}/{totalSteps || 1}</span>
      </div>
    </section>
  );
};
