import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
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
  secondsRemaining, totalDurationSeconds, isActive, onToggleActive, onReset, currentStepIndex, totalSteps,
}) => {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progress = totalDurationSeconds > 0 ? (totalDurationSeconds - secondsRemaining) / totalDurationSeconds : 0;
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <section aria-label="Focus timer" className="flex flex-col items-center text-center">
      <div className="mb-5 flex items-center gap-2 text-micro font-ui-mono uppercase tracking-[0.18em] text-text-secondary">
        <span className="size-1.5 rounded-full bg-accent" />
        <span>Step {Math.min(currentStepIndex + 1, totalSteps || 1)} of {totalSteps || 1}</span>
      </div>      <div className="relative inline-flex items-center justify-center">
        <svg className="size-52 sm:size-60 -rotate-90" aria-hidden="true">
          <circle cx="50%" cy="50%" r={radius} className="stroke-border-strong" strokeWidth="5" fill="transparent" />
          <circle cx="50%" cy="50%" r={radius} className="stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear" strokeWidth="5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" fill="transparent" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-5xl sm:text-6xl font-ui-mono font-bold tracking-tight text-text tabular">{timeFormatted}</span>
          <span className="mt-2 text-micro font-ui-mono uppercase tracking-widest text-accent">{isActive ? 'In flow' : 'Paused'}</span>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Button variant={isActive ? 'secondary' : 'primary'} onClick={onToggleActive} className="min-h-[44px] min-w-[120px] shadow-[0_8px_24px_rgba(199,167,92,0.12)]">
          {isActive ? <><Pause aria-hidden="true" className="size-4 mr-2" />Pause</> : <><Play aria-hidden="true" className="size-4 mr-2 fill-current" />Resume</>}
        </Button>
        <IconButton variant="secondary" label="Reset timer" icon={<RotateCcw className="size-4" />} onClick={onReset} className="min-h-[44px] min-w-[44px]" />
      </div>
    </section>
  );
};
