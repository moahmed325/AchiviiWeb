import React from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

interface FocusHeaderProps {
  dayNumber: number;
  durationMinutes: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onClose: () => void;
}

export const FocusHeader: React.FC<FocusHeaderProps> = ({ isMuted, onToggleMute, onClose }) => (
  <header className="w-full max-w-5xl mx-auto flex items-center justify-between shrink-0 pb-3 border-b border-border z-10">
    <div className="flex items-center gap-2.5">
      <span className="size-2 rounded-full bg-accent shadow-[0_0_14px_rgba(199,167,92,0.55)]" />
      <span className="text-micro font-ui-mono font-bold tracking-[0.18em] uppercase text-text">Focus</span>
    </div>
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'} aria-label={isMuted ? 'Unmute' : 'Mute'} className="min-w-[40px] min-h-[40px] p-2.5 rounded-control text-text-secondary hover:text-accent hover:bg-accent/5 transition-colors flex items-center justify-center cursor-pointer focus-ring">
        {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-accent" />}
      </button>      <button type="button" onClick={onClose} title="Exit focus mode (Esc)" aria-label="Exit focus mode (Esc)" className="min-w-[40px] min-h-[40px] p-2.5 rounded-control text-text-secondary hover:text-text hover:bg-surface transition-colors flex items-center justify-center cursor-pointer focus-ring">
        <X className="size-4" />
      </button>
    </div>
  </header>
);
