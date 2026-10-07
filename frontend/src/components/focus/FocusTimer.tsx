import React from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '../ui';

interface FocusTimerProps {
  taskTitle: string;
  secondsRemaining: number;
  totalDurationSeconds: number;
  isActive: boolean;
  onToggleActive: () => void;
  currentStepIndex: number;
  totalSteps: number;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  secondsRemaining, totalDurationSeconds, isActive, onToggleActive,
}) => {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progress = totalDurationSeconds > 0 ? (totalDurationSeconds - secondsRemaining) / totalDurationSeconds : 0;

  return (
    <section aria-label="Focus timer" className="w-full flex flex-col items-center text-center">
      <div className="relative w-full max-w-2xl h-1 rounded-full bg-border overflow-hidden mb-6" aria-hidden="true">
        <div className="h-full rounded-full bg-achievement transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-6xl sm:text-7xl font-ui-mono font-semibold tracking-tight text-text tabular">{timeFormatted}</span>
      <span className="mt-2 text-micro font-ui-mono uppercase tracking-[0.18em] text-achievement">{isActive ? 'In flow' : 'Paused'}</span>
      <Button variant={isActive ? 'secondary' : 'primary'} onClick={onToggleActive} className="mt-5 min-h-[44px] min-w-[108px] border-achievement/40 shadow-[0_8px_24px_rgba(200,169,107,0.12)]">
        {isActive ? <><Pause aria-hidden="true" className="size-4 mr-2" />Pause</> : <><Play aria-hidden="true" className="size-4 mr-2 fill-current" />Resume</>}
      </Button>
    </section>
  );
};
