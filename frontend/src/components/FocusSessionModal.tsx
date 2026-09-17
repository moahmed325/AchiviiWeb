import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Target,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { DailyTask, DetailedStep } from '../types';
import { playSessionStart, playStepTransition, playSessionComplete } from '../lib/audio';

interface FocusSessionModalProps {
  task: DailyTask;
  dayNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onCompleteSession: (reflectionNotes?: string) => Promise<void> | void;
}

export const FocusSessionModal: React.FC<FocusSessionModalProps> = ({
  task,
  dayNumber,
  isOpen,
  onClose,
  onCompleteSession,
}) => {
  // Parse steps
  const steps: DetailedStep[] = useMemo(() => {
    if (!task.detailedSteps) return [];
    try {
      const parsed = JSON.parse(task.detailedSteps);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [task.detailedSteps]);

  // Total duration in seconds (fallback to 30 min)
  const totalDurationSeconds = useMemo(() => {
    const mins = task.durationMinutes || 30;
    return mins * 60;
  }, [task.durationMinutes]);

  // Timer State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(totalDurationSeconds);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCelebration, setIsCelebration] = useState<boolean>(false);
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize/Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSecondsRemaining(totalDurationSeconds);
      setIsActive(true);
      setCurrentStepIndex(0);
      setIsCelebration(false);
      setReflectionNote('');
      playSessionStart(isMuted);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen, totalDurationSeconds]);

  // Step transition audio
  const handleNextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      playStepTransition(isMuted);
    } else {
      // Last step finished -> trigger celebration
      triggerCompletion();
    }
  }, [currentStepIndex, steps.length, isMuted]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const triggerCompletion = useCallback(() => {
    setIsActive(false);
    setIsCelebration(true);
    playSessionComplete(isMuted);
  }, [isMuted]);

  // Countdown timer loop
  useEffect(() => {
    if (isActive && secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            triggerCompletion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (!isActive && timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, secondsRemaining, triggerCompletion]);

  // Global Keyboard Shortcuts (Space to play/pause, Esc to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing reflection notes
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!isCelebration) {
          setIsActive((prev) => !prev);
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCelebration, onClose]);

  // Submit completion to backend
  const handleSaveAndExit = async () => {
    setIsSubmitting(true);
    try {
      await onCompleteSession(reflectionNote);
      onClose();
    } catch (err) {
      console.error('Failed to complete session:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Format time (MM:SS)
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Circular progress calculation
  const progressRatio = (totalDurationSeconds - secondsRemaining) / totalDurationSeconds;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-50 bg-[#050807]/97 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 animate-fadeIn text-white select-none overflow-y-auto">
      {/* Top Controls Bar */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-neutral-400">
            Day {dayNumber} • Focus Mode
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute Button */}
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute chimes' : 'Mute chimes'}
            className="p-2 rounded-md bg-[#0d1411] border border-[#1a2824] hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#07CB6C]" />}
          </button>

          {/* Close / Esc Button */}
          <button
            type="button"
            onClick={onClose}
            title="Exit focus mode (Esc)"
            className="p-2 rounded-md bg-[#0d1411] border border-[#1a2824] hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Focus Stage */}
      <div className="w-full max-w-2xl mx-auto my-auto py-6 space-y-8 text-center">
        {!isCelebration ? (
          <>
            {/* Session Headline */}
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-snug">
                {task.title}
              </h2>
              <p className="text-xs text-neutral-400">
                Immerse yourself in deliberate practice. Press <kbd className="px-1.5 py-0.5 rounded bg-[#111a17] border border-[#1a2824] font-mono text-[11px] text-neutral-300">Space</kbd> to pause.
              </p>
            </div>

            {/* Circular Progress Timer */}
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-44 h-44 sm:w-52 sm:h-52 -rotate-90 transform">
                {/* Background Ring */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  className="stroke-[#101a16]"
                  strokeWidth="6"
                  fill="transparent"
                />
                {/* Mint Progress Ring */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  className="stroke-[#07CB6C] transition-all duration-1000 ease-linear"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Time Inside Ring */}
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-white">
                  {timeFormatted}
                </span>
                <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest mt-1">
                  {isActive ? 'In Flow' : 'Paused'}
                </span>
              </div>
            </div>

            {/* Timer Play / Pause Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={`px-6 py-2.5 rounded-full font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
                  isActive
                    ? 'bg-[#111a17] border border-[#1a2824] text-neutral-200 hover:border-[#07CB6C]/40 hover:text-white'
                    : 'bg-[#07CB6C] text-black hover:bg-[#06b560] hover:scale-105'
                }`}
              >
                {isActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Resume</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSecondsRemaining(totalDurationSeconds);
                  setIsActive(false);
                }}
                title="Reset timer"
                className="p-2.5 rounded-full bg-[#0d1411] border border-[#1a2824] hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Active Step Runner */}
            {currentStep ? (
              <div className="p-5 sm:p-6 rounded-xl bg-[#09100d] border border-[#1a2824] text-left space-y-4 shadow-xl">
                {/* Step Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#07CB6C]/20 text-[#07CB6C] text-xs font-mono font-bold flex items-center justify-center">
                      {currentStepIndex + 1}
                    </span>
                    <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                      Step {currentStepIndex + 1} of {steps.length}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2 py-0.5 rounded border border-[#07CB6C]/20">
                    {currentStep.durationMinutes} min target
                  </span>
                </div>

                {/* Step Title & Instructions */}
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {currentStep.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                    {currentStep.instructions}
                  </p>
                </div>

                {/* Tip or Cue */}
                {(currentStep.focusCue || currentStep.pitfallToAvoid) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    {currentStep.focusCue && (
                      <div className="p-2 rounded-md bg-[#07CB6C]/5 border border-[#07CB6C]/20 flex items-start gap-2 text-neutral-300">
                        <Target className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                        <span>{currentStep.focusCue}</span>
                      </div>
                    )}
                    {currentStep.pitfallToAvoid && (
                      <div className="p-2 rounded-md bg-neutral-900/50 border border-[#1a2824] flex items-start gap-2 text-neutral-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                        <span>{currentStep.pitfallToAvoid}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Step Resource if available */}
                {currentStep.resourceUrl && (
                  <div className="pt-1">
                    <a
                      href={currentStep.resourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#07CB6C] hover:underline"
                    >
                      <span>{currentStep.resourceTitle || 'External Guide'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Step Navigation Controls */}
                <div className="pt-2 flex items-center justify-between border-t border-[#1a2824]">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={currentStepIndex === 0}
                    className="px-3 py-1.5 rounded-md border border-[#1a2824] text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-4 py-1.5 rounded-md bg-[#07CB6C] text-black hover:bg-[#06b560] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{currentStepIndex === steps.length - 1 ? 'Complete Practice' : 'Next Step'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Fallback if task has no parsed sub-steps */
              <div className="p-6 rounded-xl bg-[#09100d] border border-[#1a2824] space-y-4">
                <p className="text-sm text-neutral-300">
                  Focus on the primary daily outcome: <strong>{task.title}</strong>
                </p>
                <button
                  type="button"
                  onClick={triggerCompletion}
                  className="px-5 py-2 rounded-md bg-[#07CB6C] text-black font-bold text-xs hover:bg-[#06b560] transition-colors cursor-pointer"
                >
                  Mark Practice Finished
                </button>
              </div>
            )}
          </>
        ) : (
          /* ===================================================================== */
          /* Post-Session Zen Celebration Screen */
          /* ===================================================================== */
          <div className="space-y-6 animate-fadeIn py-4">
            {/* Glowing Celebration Badge */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#07CB6C]/10 border-2 border-[#07CB6C] flex items-center justify-center text-[#07CB6C] shadow-[0_0_30px_rgba(7,203,108,0.35)] animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-xs font-mono font-bold text-[#07CB6C]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Deliberate Practice Complete</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Day {dayNumber} Mastered
              </h2>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                You showed up and executed your deliberate practice for today. Another step closer to your 90-day mastery outcome.
              </p>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
              <div className="p-3 rounded-lg bg-[#080d0b] border border-[#1a2824]">
                <span className="text-[10px] font-mono text-neutral-500 uppercase block">Time Invested</span>
                <span className="text-base font-bold font-mono text-white">
                  {task.durationMinutes || 30} min
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#080d0b] border border-[#1a2824]">
                <span className="text-[10px] font-mono text-neutral-500 uppercase block">Trajectory</span>
                <span className="text-base font-bold font-mono text-[#07CB6C]">
                  Day {dayNumber} / 90
                </span>
              </div>
            </div>

            {/* Reflection Note Input */}
            <div className="max-w-md mx-auto text-left space-y-2">
              <label htmlFor="reflectionInput" className="text-xs font-medium text-neutral-300 block">
                Quick Reflection (Optional):
              </label>
              <input
                id="reflectionInput"
                type="text"
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder="What went well or what was your breakthrough?"
                className="w-full px-3.5 py-2.5 rounded-md bg-[#080d0b] border border-[#1a2824] focus:border-[#07CB6C] text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveAndExit();
                  }
                }}
              />
            </div>

            {/* Return Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveAndExit}
                className="px-8 py-3 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs tracking-wide uppercase transition-all shadow-lg hover:scale-105 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving Progress...' : 'Save & Return to Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Step Indicator Bar (During active practice) */}
      {!isCelebration && steps.length > 0 && (
        <div className="w-full max-w-md mx-auto flex items-center justify-center gap-1.5 pb-2">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setCurrentStepIndex(idx);
                playStepTransition(isMuted);
              }}
              title={`Jump to step ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentStepIndex
                  ? 'w-8 bg-[#07CB6C]'
                  : idx < currentStepIndex
                  ? 'w-4 bg-[#07CB6C]/40'
                  : 'w-4 bg-[#1a2824]'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FocusSessionModal;
