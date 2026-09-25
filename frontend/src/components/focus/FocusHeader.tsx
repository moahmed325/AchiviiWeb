import React from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

interface FocusHeaderProps {
  dayNumber: number;
  durationMinutes: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
}

export const FocusHeader: React.FC<FocusHeaderProps> = ({
  dayNumber,
  durationMinutes,
  isMuted,
  onToggleMute,
  onClose,
}) => {
  return (
    <header className="w-full max-w-6xl mx-auto flex items-center justify-between shrink-0 pb-3 border-b border-border z-10">
      <div className="flex items-center gap-3">
        <span className="size-2 rounded-full bg-accent animate-pulse" />
        <h1 id="focus-session-heading" className="text-micro font-ui-mono font-bold tracking-wider uppercase text-text">
          Day {dayNumber} of 90 • Focus Mode
        </h1>
        <span className="text-micro font-ui-mono text-text-secondary bg-surface px-2 sm:px-2.5 py-0.5 rounded-control border border-border">
          <span className="sm:hidden">{durationMinutes}m</span>
          <span className="hidden sm:inline">{durationMinutes}m deliberate practice</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Mute Button */}
        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? 'Unmute chimes' : 'Mute chimes'}
          aria-label={isMuted ? 'Unmute chimes' : 'Mute chimes'}
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-control bg-surface border border-border hover:border-border-control text-text-secondary hover:text-text transition-colors flex items-center justify-center cursor-pointer focus-ring"
        >
          {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-accent" />}
        </button>

        {/* Close / Esc Button */}
        <button
          type="button"
          onClick={onClose}
          title="Exit focus mode (Esc)"
          aria-label="Exit focus mode (Esc)"
          className="min-w-[44px] min-h-[44px] p-2.5 rounded-control bg-surface border border-border hover:border-border-control text-text-secondary hover:text-text transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus-ring"
        >
          <span className="text-[10px] font-ui-mono text-text-secondary hidden sm:inline">ESC</span>
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
};
