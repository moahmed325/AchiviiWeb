import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { DailyTask, DetailedStep } from '../types';
import { playSessionStart, playStepTransition, playSessionComplete } from '../lib/audio';
import { FocusHeader } from './focus/FocusHeader';
import { FocusTimer } from './focus/FocusTimer';
import { FocusStepRunner } from './focus/FocusStepRunner';
import { FocusCompletion } from './focus/FocusCompletion';
import { Button } from './ui';

export interface FocusSessionModalProps {
  task: DailyTask;
  dayNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onCompleteSession: (reflectionNotes?: string) => Promise<void> | void;
}

interface FocusSessionContentProps {
  task: DailyTask;
  dayNumber: number;
  steps: DetailedStep[];
  totalDurationSeconds: number;
  onClose: () => void;
  onCompleteSession: (reflectionNotes?: string) => Promise<void> | void;
}

const FocusSessionContent: React.FC<FocusSessionContentProps> = ({
  task,
  dayNumber,
  steps,
  totalDurationSeconds,
  onClose,
  onCompleteSession,
}) => {
  // Timer & UI State initialized cleanly on mount
  const [secondsRemaining, setSecondsRemaining] = useState<number>(totalDurationSeconds);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isMinimumVersion, setIsMinimumVersion] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCelebration, setIsCelebration] = useState<boolean>(false);
  const [showTips, setShowTips] = useState<boolean>(false);
  const [reflectionNote, setReflectionNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll and restore focus on unmount
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    };
  }, []);

  const startSession = useCallback(() => {
    setHasStarted(true);
    setIsActive(true);
    playSessionStart(isMuted);
  }, [isMuted]);

  const triggerCompletion = useCallback(() => {
    setIsActive(false);
    setIsCelebration(true);
    playSessionComplete(isMuted);
  }, [isMuted]);

  // Step transitions
  const handleNextStep = useCallback(() => {
    if (isMinimumVersion) {
      triggerCompletion();
      return;
    }
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setShowTips(false);
      playStepTransition(isMuted);
    } else {
      triggerCompletion();
    }
  }, [currentStepIndex, steps.length, isMuted, isMinimumVersion, triggerCompletion]);

  const handlePrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setShowTips(false);
    }
  }, [currentStepIndex]);

  // Countdown timer loop
  useEffect(() => {
    if (hasStarted && isActive && secondsRemaining > 0) {
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
  }, [hasStarted, isActive, secondsRemaining, triggerCompletion]);

  // Global Keyboard Shortcuts (Space to play/pause, Esc to close) and Focus Trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing reflection notes or in input
      const targetTag = (e.target as HTMLElement).tagName;
      const isInput = targetTag === 'INPUT' || targetTag === 'TEXTAREA';

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        if (!isCelebration) {
          if (!hasStarted) startSession();
          else setIsActive((prev) => !prev);
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        // Focus trap within modal
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, isCelebration, onClose, startSession]);

  // Submit completion to backend
  const handleSaveAndExit = async () => {
    setIsSubmitting(true);
    setSaveError(null);
    try {
      const res = (await onCompleteSession(reflectionNote.trim() ? reflectionNote.trim() : undefined)) as unknown;
      if (res && typeof res === 'object' && 'ok' in res && !(res as { ok: boolean }).ok) {
        throw new Error('Save failed');
      }
      onClose();
    } catch (err) {
      console.error('Failed to complete session:', err);
      setSaveError("That didn't save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = isMinimumVersion ? task.minimumVersion ?? undefined : steps[currentStepIndex];

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-session-heading"
      className="fixed inset-0 z-50 bg-background text-text flex flex-col justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 w-full h-full overflow-y-auto select-none"
    >
      {/* Subtle atmospheric ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_65%_55%_at_50%_40%,rgba(200,169,107,0.07),transparent_76%)]"
        aria-hidden="true"
      />

      {/* Top Controls Bar */}
      <FocusHeader
        dayNumber={dayNumber}
        durationMinutes={task.durationMinutes || 30}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        onClose={onClose}
      />

      {/* Main Focus Stage */}
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col justify-center min-h-0 z-10 py-8 sm:py-10">
        {!isCelebration ? (
          !hasStarted ? (
            <section className="max-w-2xl mx-auto w-full text-center space-y-7">
              <div className="space-y-4">
                <p className="text-micro font-ui-mono uppercase tracking-[0.2em] text-achievement">Focus session</p>
                <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-text">{task.title}</h2>
                {currentStep && <p className="text-base text-text-secondary max-w-xl mx-auto leading-relaxed">{currentStep.instructions}</p>}
              </div>
              <Button
                variant="primary"
                size="lg"
                onClick={startSession}
                className="w-full max-w-md mx-auto min-h-[56px] text-base shadow-[0_14px_40px_rgba(199,167,92,0.2)]"
              >
                Start focused session
              </Button>
              <p className="text-micro text-text-secondary">Press Space to start</p>
            </section>
          ) : (
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-10">
              <FocusTimer
                taskTitle={task.title}
                secondsRemaining={secondsRemaining}
                totalDurationSeconds={totalDurationSeconds}
                isActive={isActive}
                onToggleActive={() => setIsActive(!isActive)}
                currentStepIndex={currentStepIndex}
                totalSteps={steps.length}
              />

              <FocusStepRunner
                currentStep={currentStep}
                currentStepIndex={currentStepIndex}
                totalSteps={steps.length}
                showTips={showTips}
                onToggleTips={() => setShowTips(!showTips)}
                onPrevStep={handlePrevStep}
                onNextStep={handleNextStep}
                onCompleteFallback={triggerCompletion}
                fallbackTitle={task.title}
                minimumVersion={task.minimumVersion}
                onUseMinimumVersion={() => {
                  setIsMinimumVersion(true);
                  setIsActive(true);
                  setShowTips(false);
                }}
                isMinimumVersion={isMinimumVersion}
              />
            </div>
          )
        ) : (
          <FocusCompletion
            dayNumber={dayNumber}
            durationMinutes={task.durationMinutes || 30}
            isMinimumVersion={isMinimumVersion}
            reflectionNote={reflectionNote}
            onReflectionChange={setReflectionNote}
            onSave={handleSaveAndExit}
            isSubmitting={isSubmitting}
            saveError={saveError}
          />
        )}
      </div>

    </div>
  );
};

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

  if (!isOpen) return null;

  return (
    <FocusSessionContent
      key={task.id}
      task={task}
      dayNumber={dayNumber}
      steps={steps}
      totalDurationSeconds={totalDurationSeconds}
      onClose={onClose}
      onCompleteSession={onCompleteSession}
    />
  );
};

export default FocusSessionModal;
