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
  <header className="w-full max-w-3xl mx-auto flex items-center justify-between shrink-0 pb-4 border-b border-border/60 z-10">
    <div className="flex items-center gap-2.5">
      <span className="size-2 rounded-full bg-achievement shadow-[0_0_14px_rgba(200,169,107,0.55)]" />
      <span id="focus-session-heading" className="text-micro font-ui-mono font-bold tracking-[0.18em] uppercase text-text">Focus</span>
    </div>
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onToggleMute} title={isMuted ? 'Unmute' : 'Mute'} aria-label={isMuted ? 'Unmute' : 'Mute'} className="min-w-[44px] min-h-[44px] p-2.5 rounded-control text-text-secondary hover:text-achievement hover:bg-achievement/5 transition-colors flex items-center justify-center cursor-pointer focus-ring">
        {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4 text-achievement" />}
      </button>      <button type="button" onClick={onClose} title="Exit focus mode (Esc)" aria-label="Exit focus mode (Esc)" className="min-w-[44px] min-h-[44px] p-2.5 rounded-control text-text-secondary hover:text-text hover:bg-surface transition-colors flex items-center justify-center cursor-pointer focus-ring">
        <X className="size-4" />
      </button>
    </div>
  </header>
);
