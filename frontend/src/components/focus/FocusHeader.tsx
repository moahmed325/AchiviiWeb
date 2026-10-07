import React from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import { IconButton } from '../ui';

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
      <span className="size-2 rounded-full bg-achievement shadow-[0_0_14px_color-mix(in_srgb,var(--color-achievement)_55%,transparent)]" />
      <span className="text-micro font-ui-mono font-bold tracking-[0.18em] uppercase text-text">Focus</span>
    </div>
    <div className="flex items-center gap-1.5">
      <IconButton
        label={isMuted ? 'Unmute' : 'Mute'}
        title={isMuted ? 'Unmute' : 'Mute'}
        onClick={onToggleMute}
        icon={
          isMuted ? (
            <VolumeX aria-hidden="true" strokeWidth={1.5} className="size-4" />
          ) : (
            <Volume2 aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />
          )
        }
      />
      <IconButton
        label="Exit focus mode (Esc)"
        title="Exit focus mode (Esc)"
        onClick={onClose}
        icon={<X aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      />
    </div>
  </header>
);
