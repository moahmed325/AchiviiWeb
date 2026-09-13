import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, Zap, Minimize2 } from 'lucide-react';
import { DailyScheduleItem } from '../lib/lifeApi';

interface FullscreenFocusModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DailyScheduleItem;
  onComplete: (notes: string, isMvs: boolean) => Promise<void>;
  onSkip?: () => Promise<void>;
}

export const FullscreenFocusModal: React.FC<FullscreenFocusModalProps> = ({
  isOpen,
  onClose,
  item,
  onComplete,
  onSkip,
}) => {
  const nominalMins = item.allocated_minutes || 45;
  const mvsMins = item.minimum_viable_minutes || 20;

  const [isMvs, setIsMvs] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(nominalMins * 60);
  const [totalSeconds, setTotalSeconds] = useState<number>(nominalMins * 60);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Initialize duration when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      const mins = isMvs ? mvsMins : nominalMins;
      setSecondsLeft(mins * 60);
      setTotalSeconds(mins * 60);
      setIsRunning(true);
      setNotes('');
    }
  }, [isOpen, item.id]);

  // Handle ESC key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Timer countdown
  useEffect(() => {
    if (!isOpen || !isRunning || secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isRunning, secondsLeft]);

  if (!isOpen) return null;

  const toggleMvs = (mvsSelected: boolean) => {
    setIsMvs(mvsSelected);
    const mins = mvsSelected ? mvsMins : nominalMins;
    setSecondsLeft(mins * 60);
    setTotalSeconds(mins * 60);
    setIsRunning(true);
  };

  const resetTimer = () => {
    const mins = isMvs ? mvsMins : nominalMins;
    setSecondsLeft(mins * 60);
    setIsRunning(false);
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await onComplete(notes, isMvs);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const progressPercent = Math.max(0, Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-[#070b09]/95 backdrop-blur-xl text-white flex flex-col justify-between p-6 sm:p-10 select-none animate-in fade-in duration-200">
      {/* ─── Top Header Bar ─── */}
      <div className="flex items-center justify-between max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#07CB6C] animate-pulse" />
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
            Focus Session Active
          </span>
          <span className="text-neutral-600">•</span>
          <span className="text-xs font-mono text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/20 px-2 py-0.5 rounded-full">
            {isMvs ? `Micro Dose (${mvsMins}m)` : `Standard Dose (${nominalMins}m)`}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
          title="Minimize Focus Mode (Esc)"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          <span>Exit (Esc)</span>
        </button>
      </div>

      {/* ─── Center: Main Focus Area ─── */}
      <div className="max-w-2xl w-full mx-auto text-center space-y-8 my-auto">
        {/* Session Title & Window */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            {item.title}
          </h1>
          {item.description && (
            <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
              {item.description}
            </p>
          )}
        </div>

        {/* Big Minimalist Timer Display with Ring */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex flex-col items-center justify-center">
          {/* Circular Progress SVG */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-neutral-800/60"
              strokeWidth="3.5"
              fill="transparent"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              className="stroke-[#07CB6C] transition-all duration-1000 ease-linear"
              strokeWidth="3.5"
              strokeDasharray={276.46}
              strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Time digits */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl sm:text-6xl font-mono font-bold tracking-tighter text-white tabular-nums">
              {formattedTime}
            </div>
            <div className="text-xs font-mono text-neutral-500 mt-1 uppercase tracking-widest">
              {isRunning ? 'Remaining' : 'Paused'}
            </div>
          </div>
        </div>

        {/* Timer Controls & Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsRunning((prev) => !prev)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold text-sm transition-all shadow-lg cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-black" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetTimer}
              className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          {/* Quick Dose / MVS Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono">
            <button
              type="button"
              onClick={() => toggleMvs(false)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                !isMvs ? 'bg-white/10 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Full ({nominalMins}m)
            </button>
            <button
              type="button"
              onClick={() => toggleMvs(true)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                isMvs ? 'bg-[#07CB6C]/20 text-[#07CB6C] font-bold border border-[#07CB6C]/30' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3 text-[#07CB6C]" />
              <span>Quick ({mvsMins}m)</span>
            </button>
          </div>
        </div>

        {/* What did you accomplish? (Clean Proof Input) */}
        <div className="max-w-md mx-auto pt-2">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quick takeaway or proof of work (optional)..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]/50 transition-colors"
          />
        </div>
      </div>

      {/* ─── Bottom Footer Bar ─── */}
      <div className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
        <div className="text-xs text-neutral-500 font-mono">
          Scheduled window: {item.start_time} – {item.end_time}
        </div>

        <div className="flex items-center gap-3">
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 text-xs font-mono transition-colors cursor-pointer"
            >
              Skip Today (No Debt)
            </button>
          )}

          <button
            type="button"
            onClick={handleFinish}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs tracking-wide shadow-[0_0_25px_rgba(7,203,108,0.25)] transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Verifying...' : 'Complete Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
