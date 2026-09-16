import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Zap,
  Minimize2,
  Headphones,
  Volume2,
  VolumeX,
  ListChecks,
  ExternalLink,
  Copy,
  Check,
  Youtube,
  AlertTriangle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { DailyScheduleItem } from '../lib/lifeApi';
import { soundscape, SoundscapeType } from '../lib/soundscapeEngine';
import { formatTaskTitle, getTaskExecutionGuide } from '../lib/formatters';
import { useAuth } from '../context/AuthContext';
import { getSessionFieldManual } from '../lib/adaptiveApi';
import { TaskFieldManual } from '../types/adaptive';

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
  const { token } = useAuth();

  const nominalMins = item.allocated_minutes || 45;
  const reducedMins = Math.max(15, Math.round(nominalMins * 0.65));
  const mvsMins = item.minimum_viable_minutes || 15;
  const substituteMins = 10;

  // Fallback hierarchy state (Section 9.9)
  const [fallbackLevel, setFallbackLevel] = useState<1 | 2 | 3 | 4>(1);
  const [isMvs, setIsMvs] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(nominalMins * 60);
  const [totalSeconds, setTotalSeconds] = useState<number>(nominalMins * 60);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Field Manual & Interactive Checklist state
  const [fieldManual, setFieldManual] = useState<TaskFieldManual | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [copiedResourceIndex, setCopiedResourceIndex] = useState<number | null>(null);

  const fallbackGuide = getTaskExecutionGuide(item);

  // Soundscape state
  const [soundscapeType, setSoundscapeType] = useState<SoundscapeType>('off');
  const [soundscapeVol, setSoundscapeVol] = useState<number>(0.5);
  const [isSoundMenuOpen, setIsSoundMenuOpen] = useState<boolean>(false);

  const handleClose = () => {
    soundscape.stop();
    setSoundscapeType('off');
    setIsSoundMenuOpen(false);
    onClose();
  };

  const handleSoundscapeChange = async (type: SoundscapeType) => {
    setSoundscapeType(type);
    if (type === 'off') {
      soundscape.stop();
    } else {
      await soundscape.play(type, soundscapeVol);
    }
  };

  const handleVolumeChange = (vol: number) => {
    setSoundscapeVol(vol);
    soundscape.setVolume(vol);
  };

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      soundscape.stop();
    };
  }, []);

  // Fetch Field Manual and initialize duration
  useEffect(() => {
    if (isOpen) {
      setFallbackLevel(1);
      setIsMvs(false);
      setSecondsLeft(nominalMins * 60);
      setTotalSeconds(nominalMins * 60);
      setIsRunning(true);
      setNotes('');
      setCompletedSteps({});
      setCopiedResourceIndex(null);

      if (token && item.id) {
        getSessionFieldManual(token, item.id)
          .then((manual) => {
            if (manual) {
              setFieldManual(manual);
            }
          })
          .catch((err) => {
            console.warn('Field manual load error, using standard guide:', err);
          });
      }
    } else {
      soundscape.stop();
      setSoundscapeType('off');
    }
  }, [isOpen, item.id, token]);

  // Handle ESC key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Switch Fallback Hierarchy (Section 9.9)
  const selectFallbackLevel = (level: 1 | 2 | 3 | 4) => {
    setFallbackLevel(level);
    let targetMins = nominalMins;
    let mvsMode = false;

    if (level === 1) targetMins = nominalMins;
    else if (level === 2) targetMins = reducedMins;
    else if (level === 3) {
      targetMins = mvsMins;
      mvsMode = true;
    } else if (level === 4) {
      targetMins = substituteMins;
      mvsMode = true;
    }

    setIsMvs(mvsMode);
    setSecondsLeft(targetMins * 60);
    setTotalSeconds(targetMins * 60);
    setIsRunning(true);
  };

  const resetTimer = () => {
    let targetMins = nominalMins;
    if (fallbackLevel === 2) targetMins = reducedMins;
    if (fallbackLevel === 3) targetMins = mvsMins;
    if (fallbackLevel === 4) targetMins = substituteMins;

    setSecondsLeft(targetMins * 60);
    setIsRunning(false);
  };

  const toggleChecklistStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const handleCopyResource = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedResourceIndex(index);
      setTimeout(() => setCopiedResourceIndex(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await onComplete(notes, isMvs);
      handleClose();
    } catch (e) {
      console.error('Failed to complete session:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = Math.max(0, Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100));

  // Determine active checklist steps
  const activeSteps = fieldManual?.checklist && fieldManual.checklist.length > 0
    ? fieldManual.checklist
    : fallbackGuide.steps.map((s) => ({
        step_number: s.step,
        action: `${s.title}: ${s.instruction}`,
        duration_minutes: parseInt(s.duration, 10) || 10,
        is_checkpoint: s.step === 2,
      }));

  const completedCount = activeSteps.filter((s) => completedSteps[s.step_number]).length;

  return (
    <div className="fixed inset-0 z-50 bg-[#070b09]/95 backdrop-blur-xl text-white flex flex-col justify-between p-4 sm:p-8 select-none animate-in fade-in duration-200 overflow-y-auto">
      {/* ─── Top Header Bar ─── */}
      <div className="flex items-center justify-between max-w-4xl w-full mx-auto pb-2">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#07CB6C] animate-pulse" />
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">
            Focus Session Active
          </span>
          <span className="text-neutral-600">•</span>
          <span className="text-xs font-mono text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/20 px-2 py-0.5 rounded-full">
            {fallbackLevel === 1 && `Level 1 Standard (${nominalMins}m)`}
            {fallbackLevel === 2 && `Level 2 Reduced (${reducedMins}m)`}
            {fallbackLevel === 3 && `Level 3 MVS (${mvsMins}m)`}
            {fallbackLevel === 4 && `Level 4 Substitute (${substituteMins}m)`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Soundscape Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSoundMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                soundscapeType !== 'off'
                  ? 'bg-[#07CB6C]/15 border-[#07CB6C]/40 text-[#07CB6C] shadow-[0_0_12px_rgba(7,203,108,0.15)]'
                  : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
              }`}
              title="Ambient Focus Soundscapes"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>
                {soundscapeType === 'off' && 'Sound: Off'}
                {soundscapeType === 'brown' && 'Brown Noise'}
                {soundscapeType === 'rain' && 'Soft Rain'}
                {soundscapeType === 'binaural' && '10Hz Alpha'}
              </span>
            </button>

            {isSoundMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0c120f] border border-white/10 shadow-2xl p-3 z-50 space-y-3">
                <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider font-semibold">
                  Focus Soundscapes
                </div>

                <div className="space-y-1">
                  {[
                    { type: 'off' as const, label: 'Mute / Off' },
                    { type: 'brown' as const, label: 'Brown Noise (Deep)' },
                    { type: 'rain' as const, label: 'Soft Rain (Calm)' },
                    { type: 'binaural' as const, label: '10Hz Alpha Waves' },
                  ].map((s) => (
                    <button
                      key={s.type}
                      onClick={() => handleSoundscapeChange(s.type)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                        soundscapeType === s.type
                          ? 'bg-[#07CB6C]/15 text-[#07CB6C] font-semibold'
                          : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{s.label}</span>
                      {soundscapeType === s.type && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                      )}
                    </button>
                  ))}
                </div>

                {soundscapeType !== 'off' && (
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                      <span className="flex items-center gap-1">
                        {soundscapeVol === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        Volume
                      </span>
                      <span>{Math.round(soundscapeVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={soundscapeVol}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#07CB6C]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white text-xs font-mono transition-colors cursor-pointer"
            title="Minimize Focus Mode (Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Exit (Esc)</span>
          </button>
        </div>
      </div>

      {/* ─── Center Focus Content ─── */}
      <div className="max-w-3xl w-full mx-auto text-center space-y-5 my-auto py-2">
        {/* Task Title & Objective */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#07CB6C] font-semibold">
            {item.category ? `${item.category} • Target Outcome` : 'Target Outcome'}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white max-w-2xl mx-auto">
            {formatTaskTitle(item.title)}
          </h2>
          <p className="text-xs text-neutral-400 max-w-xl mx-auto leading-relaxed">
            {fieldManual?.objective || item.description || 'Complete today\'s planned adaptation stimulus with continuous concentration.'}
          </p>
        </div>

        {/* Big Minimalist Timer Display */}
        <div className="relative inline-flex flex-col items-center justify-center">
          <div className="text-6xl sm:text-7xl font-mono font-bold tracking-tighter text-white select-none tabular-nums drop-shadow-[0_0_35px_rgba(7,203,108,0.2)]">
            {formatTime(secondsLeft)}
          </div>

          {/* Minimalist Progress Track */}
          <div className="w-48 sm:w-64 h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#07CB6C] to-emerald-300 transition-all duration-1000 ease-linear shadow-[0_0_8px_rgba(7,203,108,0.5)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Timer Controls & Section 9.9 Fallback Hierarchy */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRunning((prev) => !prev)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 font-semibold text-xs transition-all shadow-lg cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-black" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Resume</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={resetTimer}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-5 w-px bg-white/10 hidden sm:block" />

          {/* Section 9.9 Fallback Hierarchy Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => selectFallbackLevel(1)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                fallbackLevel === 1 ? 'bg-white/10 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Level 1: Full Standard Session"
            >
              L1: Full ({nominalMins}m)
            </button>
            <button
              type="button"
              onClick={() => selectFallbackLevel(2)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                fallbackLevel === 2 ? 'bg-white/15 text-white font-bold' : 'text-neutral-400 hover:text-white'
              }`}
              title="Level 2: Reduced Volume Session"
            >
              L2: Reduced ({reducedMins}m)
            </button>
            <button
              type="button"
              onClick={() => selectFallbackLevel(3)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                fallbackLevel === 3 ? 'bg-[#07CB6C]/20 text-[#07CB6C] font-bold border border-[#07CB6C]/30' : 'text-neutral-400 hover:text-white'
              }`}
              title="Level 3: Minimum Viable Session (No-Debt)"
            >
              <Zap className="w-2.5 h-2.5 text-[#07CB6C]" />
              <span>L3: MVS ({mvsMins}m)</span>
            </button>
            <button
              type="button"
              onClick={() => selectFallbackLevel(4)}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                fallbackLevel === 4 ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30' : 'text-neutral-400 hover:text-white'
              }`}
              title="Level 4: Equivalent Substitute / Review"
            >
              L4: Sub ({substituteMins}m)
            </button>
          </div>
        </div>

        {/* Predefined Fallback Instruction (Section 9.9) */}
        {fieldManual?.fallbacks && (
          <div className="text-[11px] font-mono text-neutral-400 max-w-xl mx-auto bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/5">
            <span className="text-[#07CB6C] font-semibold">Current Protocol: </span>
            {fallbackLevel === 1 && fieldManual.fallbacks.level_1_standard}
            {fallbackLevel === 2 && fieldManual.fallbacks.level_2_reduced}
            {fallbackLevel === 3 && fieldManual.fallbacks.level_3_mvs}
            {fallbackLevel === 4 && fieldManual.fallbacks.level_4_substitute}
          </div>
        )}

        {/* ─── Interactive Checklist & Field Manual ─── */}
        <div className="max-w-2xl mx-auto rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-left space-y-3.5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-semibold text-[#07CB6C] uppercase tracking-wider flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" />
              <span>Interactive Checklist • Step-by-Step</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              {completedCount} of {activeSteps.length} completed ({Math.round((completedCount / activeSteps.length) * 100)}%)
            </span>
          </div>

          <div className="space-y-2">
            {activeSteps.map((st) => {
              const isChecked = !!completedSteps[st.step_number];
              return (
                <div
                  key={st.step_number}
                  onClick={() => toggleChecklistStep(st.step_number)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-white'
                      : 'bg-black/40 border-white/5 text-neutral-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 text-neutral-400 hover:text-[#07CB6C] transition-colors"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[#07CB6C]" />
                    ) : (
                      <Square className="w-4 h-4 text-neutral-500" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold text-[#07CB6C]">
                        Step {st.step_number}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {st.duration_minutes}m
                      </span>
                      {st.is_checkpoint && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Checkpoint
                        </span>
                      )}
                    </div>
                    <div className={`text-xs leading-snug ${isChecked ? 'line-through text-neutral-400' : 'text-neutral-200'}`}>
                      {st.action}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Curated Resources Row */}
          {fieldManual?.resources && fieldManual.resources.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1.5">
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider font-semibold">
                Curated Task Resources & AI Prompts
              </div>
              <div className="flex flex-wrap gap-2">
                {fieldManual.resources.map((res, idx) => {
                  const isCopied = copiedResourceIndex === idx;
                  if (res.type === 'PROMPT' || res.type === 'TEMPLATE') {
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleCopyResource(res.url_or_payload, idx)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                            : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10 hover:text-white'
                        }`}
                        title={res.why_recommended}
                      >
                        {isCopied ? <Check className="w-3 h-3 text-purple-400" /> : <Copy className="w-3 h-3 text-purple-400" />}
                        <span>{isCopied ? 'Copied to Clipboard!' : res.title}</span>
                      </button>
                    );
                  }

                  return (
                    <a
                      key={idx}
                      href={res.url_or_payload}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        res.type === 'YOUTUBE'
                          ? 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20'
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-300 hover:bg-blue-500/20'
                      }`}
                      title={res.why_recommended}
                    >
                      {res.type === 'YOUTUBE' ? (
                        <Youtube className="w-3 h-3 text-red-400" />
                      ) : (
                        <ExternalLink className="w-3 h-3 text-blue-400" />
                      )}
                      <span>{res.title}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 9.10 Behavioral Friction & Antidote */}
          {fieldManual?.pitfall_guardrail && (
            <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-[11px] text-neutral-300 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/15">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-amber-300 font-semibold">Common Beginner Trap: </span>
                <span className="text-neutral-400">{fieldManual.pitfall_guardrail.trap} </span>
                <span className="text-[#07CB6C] font-semibold">Antidote: </span>
                <span className="text-neutral-200">{fieldManual.pitfall_guardrail.antidote}</span>
              </div>
            </div>
          )}
        </div>

        {/* Proof of Work Input */}
        <div className="max-w-md mx-auto pt-1">
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Quick takeaway or proof of work (optional)..."
            className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]/50 transition-colors"
          />
        </div>
      </div>

      {/* ─── Bottom Footer Bar ─── */}
      <div className="max-w-4xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-white/10">
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
