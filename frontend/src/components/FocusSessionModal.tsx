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
  ChevronDown,
  ChevronUp,
  Lightbulb,
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

  // Timer & UI State
  const [secondsRemaining, setSecondsRemaining] = useState<number>(totalDurationSeconds);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCelebration, setIsCelebration] = useState<boolean>(false);
  const [showTips, setShowTips] = useState<boolean>(false);
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize / Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSecondsRemaining(totalDurationSeconds);
      setIsActive(true);
      setCurrentStepIndex(0);
      setIsCelebration(false);
      setShowTips(false);
      setReflectionNote('');
      playSessionStart(isMuted);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isOpen, totalDurationSeconds]);

  const triggerCompletion = useCallback(() => {
    setIsActive(false);
    setIsCelebration(true);
    playSessionComplete(isMuted);
  }, [isMuted]);

  // Step transition
  const handleNextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setShowTips(false); // Reset tips accordion on new step
      playStepTransition(isMuted);
    } else {
      triggerCompletion();
    }
  }, [currentStepIndex, steps.length, isMuted, triggerCompletion]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setShowTips(false);
    }
  }, [currentStepIndex]);

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
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-50 bg-[#050807]/98 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-6 lg:p-8 h-screen w-screen overflow-hidden animate-fadeIn text-white select-none">
      {/* Top Controls Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between shrink-0 pb-2 border-b border-[#1a2824]/60">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-neutral-300">
            Day {dayNumber} of 90 • Focus Mode
          </span>
          <span className="hidden sm:inline-block text-[11px] font-mono text-neutral-500 bg-[#0c1210] px-2 py-0.5 rounded border border-[#1a2824]">
            {task.durationMinutes || 30}m deliberate practice
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
            className="p-2 rounded-md bg-[#0d1411] border border-[#1a2824] hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="text-[10px] font-mono text-neutral-500 hidden sm:inline">ESC</span>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Focus Stage: 2-Column Balanced Zen Split */}
      <div className="w-full max-w-5xl mx-auto my-auto flex-1 flex flex-col justify-center overflow-y-auto md:overflow-hidden py-4">
        {!isCelebration ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-12 items-center w-full">
            {/* ================================================================= */}
            {/* LEFT COLUMN: TIMER HUB & ATMOSPHERE */}
            {/* ================================================================= */}
            <div className="md:col-span-5 flex flex-col items-center text-center space-y-4 lg:space-y-5">
              {/* Task Title */}
              <div className="space-y-1 max-w-xs">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white line-clamp-2 leading-snug">
                  {task.title}
                </h2>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-[#111a17] border border-[#1a2824] text-neutral-300">Space</kbd> to {isActive ? 'pause' : 'resume'}
                </p>
              </div>

              {/* Scaled Circular SVG Timer */}
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-40 h-40 sm:w-48 sm:h-48 -rotate-90 transform">
                  {/* Background Ring */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={radius}
                    className="stroke-[#101a16]"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  {/* Mint Progress Ring */}
                  <circle
                    cx="50%"
                    cy="50%"
                    r={radius}
                    className="stroke-[#07CB6C] transition-all duration-1000 ease-linear"
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Time Inside Ring */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-mono font-bold tracking-tight text-white">
                    {timeFormatted}
                  </span>
                  <span className={`text-[10px] font-mono uppercase tracking-widest mt-1 px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-[#07CB6C]/10 text-[#07CB6C]' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {isActive ? 'In Flow' : 'Paused'}
                  </span>
                </div>
              </div>

              {/* Timer Controls */}
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`px-5 py-2 rounded-full font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md ${
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
                  className="p-2 rounded-full bg-[#0d1411] border border-[#1a2824] hover:border-neutral-600 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Horizontal Step Indicator Pills */}
              {steps.length > 0 && (
                <div className="flex items-center justify-center gap-1 pt-1">
                  {steps.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCurrentStepIndex(idx);
                        setShowTips(false);
                        playStepTransition(isMuted);
                      }}
                      title={`Step ${idx + 1}: ${steps[idx]?.title || ''}`}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        idx === currentStepIndex
                          ? 'w-7 bg-[#07CB6C]'
                          : idx < currentStepIndex
                          ? 'w-3.5 bg-[#07CB6C]/40'
                          : 'w-3.5 bg-[#1a2824]'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ================================================================= */}
            {/* RIGHT COLUMN: DELIBERATE PRACTICE STEP RUNNER */}
            {/* ================================================================= */}
            <div className="md:col-span-7">
              {currentStep ? (
                <div className="p-5 sm:p-6 rounded-xl bg-[#09100d] border border-[#1a2824] text-left space-y-4 shadow-xl">
                  {/* Step Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#07CB6C]/20 text-[#07CB6C] text-xs font-mono font-bold flex items-center justify-center border border-[#07CB6C]/30">
                        {currentStepIndex + 1}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
                        Step {currentStepIndex + 1} of {steps.length}
                      </span>
                    </div>

                    <span className="text-xs font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2.5 py-0.5 rounded border border-[#07CB6C]/20">
                      {currentStep.durationMinutes} min target
                    </span>
                  </div>

                  {/* Step Title & Instructions */}
                  <div className="space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                      {currentStep.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-h-32 overflow-y-auto pr-1">
                      {currentStep.instructions}
                    </p>
                  </div>

                  {/* Collapsible Tips & Guidance Toggle */}
                  {(currentStep.focusCue || currentStep.pitfallToAvoid) && (
                    <div className="border-t border-[#1a2824] pt-2">
                      <button
                        type="button"
                        onClick={() => setShowTips(!showTips)}
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer select-none"
                      >
                        <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                        <span>{showTips ? 'Hide Tips & Cues' : 'View Tips & Guidance'}</span>
                        {showTips ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {showTips && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-fadeIn">
                          {currentStep.focusCue && (
                            <div className="p-2.5 rounded-md bg-[#07CB6C]/5 border border-[#07CB6C]/20 flex items-start gap-2 text-neutral-300">
                              <Target className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] text-neutral-500 uppercase block font-mono">Focus Cue</span>
                                <span>{currentStep.focusCue}</span>
                              </div>
                            </div>
                          )}

                          {currentStep.pitfallToAvoid && (
                            <div className="p-2.5 rounded-md bg-neutral-900/50 border border-[#1a2824] flex items-start gap-2 text-neutral-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                              <div>
                                <span className="text-[10px] text-neutral-500 uppercase block font-mono">Pitfall</span>
                                <span>{currentStep.pitfallToAvoid}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* External Resource Link (if present) */}
                  {currentStep.resourceUrl && (
                    <div className="pt-0.5">
                      <a
                        href={currentStep.resourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#07CB6C] hover:underline"
                      >
                        <span>{currentStep.resourceTitle || 'Recommended Guide'}</span>
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
                      className="px-3.5 py-1.5 rounded-md border border-[#1a2824] text-xs font-medium text-neutral-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-4 py-1.5 rounded-md bg-[#07CB6C] text-black hover:bg-[#06b560] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:scale-[1.02]"
                    >
                      <span>{currentStepIndex === steps.length - 1 ? 'Complete Session' : 'Next Step'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Fallback if task has no parsed sub-steps */
                <div className="p-6 rounded-xl bg-[#09100d] border border-[#1a2824] space-y-4">
                  <p className="text-sm text-neutral-300">
                    Focus on the primary deliberate practice outcome: <strong>{task.title}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={triggerCompletion}
                    className="px-5 py-2 rounded-md bg-[#07CB6C] text-black font-bold text-xs hover:bg-[#06b560] transition-colors cursor-pointer"
                  >
                    Complete Practice Session
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ===================================================================== */
          /* POST-SESSION ZEN CELEBRATION SCREEN (ZERO SCROLL) */
          /* ===================================================================== */
          <div className="max-w-md mx-auto my-auto text-center space-y-5 py-4 animate-fadeIn">
            {/* Glowing Celebration Badge */}
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-[#07CB6C]/10 border-2 border-[#07CB6C] flex items-center justify-center text-[#07CB6C] shadow-[0_0_25px_rgba(7,203,108,0.3)] animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[11px] font-mono font-bold text-[#07CB6C]">
                <Sparkles className="w-3 h-3" />
                <span>Deliberate Practice Complete</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Day {dayNumber} Mastered
              </h2>
              <p className="text-xs text-neutral-400">
                You showed up and executed your session. Another day closer to 90-day mastery.
              </p>
            </div>

            {/* Quick Stats Summary */}
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="p-3 rounded-lg bg-[#080d0b] border border-[#1a2824]">
                <span className="text-[10px] font-mono text-neutral-500 uppercase block">Time Logged</span>
                <span className="text-base font-bold font-mono text-white">
                  {task.durationMinutes || 30} min
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#080d0b] border border-[#1a2824]">
                <span className="text-[10px] font-mono text-neutral-500 uppercase block">Progress</span>
                <span className="text-base font-bold font-mono text-[#07CB6C]">
                  Day {dayNumber} / 90
                </span>
              </div>
            </div>

            {/* Reflection Note Input */}
            <div className="text-left space-y-1.5">
              <label htmlFor="reflectionInput" className="text-xs font-medium text-neutral-300 block">
                Quick Reflection (Optional):
              </label>
              <input
                id="reflectionInput"
                type="text"
                value={reflectionNote}
                onChange={(e) => setReflectionNote(e.target.value)}
                placeholder="What was your breakthrough today?"
                className="w-full px-3 py-2 rounded-md bg-[#080d0b] border border-[#1a2824] focus:border-[#07CB6C] text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveAndExit();
                  }
                }}
              />
            </div>

            {/* Return Button */}
            <div className="pt-1">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveAndExit}
                className="w-full py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs tracking-wide uppercase transition-all shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save & Return to Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Footer Brand Line */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between text-[11px] font-mono text-neutral-600 shrink-0 pt-2 border-t border-[#1a2824]/40">
        <span>ACHIVII FLOW ENGINE</span>
        <span>ZERO DISTRACTION MODE</span>
      </div>
    </div>
  );
};

export default FocusSessionModal;
