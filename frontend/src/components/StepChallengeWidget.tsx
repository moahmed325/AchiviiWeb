import React, { useState, useMemo } from 'react';
import {
  DetailedStep,
  StepChallenge,
  RepetitionsChallenge,
  ActiveRecallChallenge,
  ChecklistChallenge,
  ExerciseChallenge,
} from '../types';
import {
  Dumbbell,
  Brain,
  ListChecks,
  Target,
  Check,
  Eye,
  EyeOff,
  Flame,
  Sparkles,
} from 'lucide-react';

interface StepChallengeWidgetProps {
  step: DetailedStep;
  className?: string;
  onChallengeComplete?: (isComplete: boolean) => void;
}

/**
 * Intelligent Fallback Inference Engine
 * If a task doesn't have an explicit challenge (legacy tasks or custom plans),
 * this automatically classifies the step into the ideal challenge modality.
 */
export function inferStepChallenge(step: DetailedStep): StepChallenge {
  if (step.challenge) {
    return step.challenge;
  }

  const combinedText = `${step.title} ${step.instructions} ${step.focusCue || ''}`.toLowerCase();

  // 1. Repetitions / Sets / Physical / Musical motor drills
  if (/\b(reps|sets|bpm|tempo|scale|chord|hold|run|pushup|squat|drill|rounds|cadence|interval|metronome)\b/i.test(combinedText)) {
    const repMatch = combinedText.match(/(\d+)\s*(reps|times|rounds|seconds|sec)/i);
    const targetCount = repMatch ? parseInt(repMatch[1], 10) : 10;
    const unit = combinedText.includes('hold') || combinedText.includes('second') ? 'seconds' : 'reps';

    return {
      type: 'repetitions',
      drillName: step.title,
      targetCount: Math.min(50, Math.max(3, targetCount)),
      totalSets: 3,
      unit,
    };
  }

  // 2. Active Recall / Cognitive / Languages / Conceptual
  if (/\b(memorize|concept|recall|vocab|definition|understand|formula|rule|why|principle|theory|grammar)\b/i.test(combinedText)) {
    return {
      type: 'active_recall',
      question: `Self-test: What is the core rule or mechanism of "${step.title}"?`,
      hint: step.focusCue || 'Recall the foundational mechanics without looking at the instructions.',
      keyTakeaway: step.instructions,
    };
  }

  // 3. Technical / Coding / Building / Setup deliverables
  if (/\b(build|create|write|setup|install|configure|code|implement|deploy|commit|test|draft|design)\b/i.test(combinedText)) {
    return {
      type: 'checklist',
      items: [
        { id: 'c1', label: `Prepare environment & inspect targets for ${step.title}` },
        { id: 'c2', label: 'Execute core build steps without skipping checks' },
        { id: 'c3', label: 'Audit result and verify zero syntax or mechanical errors' },
      ],
    };
  }

  // 4. Default: Targeted Exercise Challenge
  return {
    type: 'exercise',
    prompt: step.instructions,
    targetDeliverable: step.title,
    evaluationCriteria: step.focusCue || 'Execute with focused concentration and zero rushing.',
  };
}

export const StepChallengeWidget: React.FC<StepChallengeWidgetProps> = ({
  step,
  className = '',
  onChallengeComplete,
}) => {
  const challenge = useMemo(() => inferStepChallenge(step), [step]);

  // Repetitions State
  const [completedSets, setCompletedSets] = useState<number[]>([]);

  // Active Recall State
  const [isAnswerRevealed, setIsAnswerRevealed] = useState<boolean>(false);
  const [recallRating, setRecallRating] = useState<'mastered' | 'review' | null>(null);

  // Checklist State
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Exercise State
  const [isCriteriaMet, setIsCriteriaMet] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 1. REPETITIONS / SETS CHALLENGE
  // --------------------------------------------------------------------------
  if (challenge.type === 'repetitions') {
    const repChallenge = challenge as RepetitionsChallenge;
    const totalSets = repChallenge.totalSets || 3;
    const setsArray = Array.from({ length: totalSets }, (_, idx) => idx);
    const isAllDone = completedSets.length === totalSets;

    const toggleSet = (setIdx: number) => {
      const nextSets = completedSets.includes(setIdx)
        ? completedSets.filter((s) => s !== setIdx)
        : [...completedSets, setIdx];

      setCompletedSets(nextSets);
      if (onChallengeComplete) {
        onChallengeComplete(nextSets.length === totalSets);
      }
    };

    return (
      <div className={`p-3.5 rounded-lg bg-[#070c09] border border-[#1a2824] space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
              <Dumbbell className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
              Interactive Rep Drill
            </span>
          </div>

          <span className="text-[11px] font-mono text-neutral-400">
            {completedSets.length}/{totalSets} sets done
          </span>
        </div>

        {/* Set Pills */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {setsArray.map((idx) => {
            const isDone = completedSets.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleSet(idx)}
                className={`py-2 px-2.5 rounded-md border text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isDone
                    ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-[#07CB6C] shadow-sm'
                    : 'bg-[#0b1310] border-[#1a2824] text-neutral-400 hover:border-neutral-600 hover:text-white'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] border ${
                  isDone ? 'bg-[#07CB6C] text-black border-[#07CB6C]' : 'border-neutral-600'
                }`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <span>
                  Set {idx + 1}: {repChallenge.targetCount} {repChallenge.unit}
                </span>
              </button>
            );
          })}
        </div>

        {isAllDone && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#07CB6C] pt-1 animate-fadeIn">
            <Flame className="w-3.5 h-3.5" />
            <span>All {totalSets} sets executed with deliberate precision!</span>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. ACTIVE RECALL / MICRO-QUIZ CHALLENGE
  // --------------------------------------------------------------------------
  if (challenge.type === 'active_recall') {
    const recallChallenge = challenge as ActiveRecallChallenge;

    const handleRate = (rating: 'mastered' | 'review') => {
      setRecallRating(rating);
      if (onChallengeComplete) {
        onChallengeComplete(rating === 'mastered');
      }
    };

    return (
      <div className={`p-3.5 rounded-lg bg-[#070c09] border border-[#1a2824] space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
              <Brain className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
              Active Recall Self-Test
            </span>
          </div>

          <span className="text-[10px] font-mono text-neutral-500">
            Cognitive Retrieval
          </span>
        </div>

        {/* Question Prompt */}
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-white leading-snug">
            {recallChallenge.question}
          </p>
          {recallChallenge.hint && (
            <p className="text-[11px] text-neutral-500 italic">
              Hint: {recallChallenge.hint}
            </p>
          )}
        </div>

        {/* Reveal Answer Toggle */}
        <div className="pt-1">
          {!isAnswerRevealed ? (
            <button
              type="button"
              onClick={() => setIsAnswerRevealed(true)}
              className="w-full py-2 px-3 rounded-md bg-[#101915] hover:bg-[#15221c] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-semibold text-neutral-300 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Reveal Key Takeaway to Verify</span>
            </button>
          ) : (
            <div className="p-3 rounded-md bg-[#09120e] border border-[#07CB6C]/30 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                <span className="text-[#07CB6C] font-semibold">Verified Takeaway:</span>
                <button
                  type="button"
                  onClick={() => setIsAnswerRevealed(false)}
                  className="hover:text-white inline-flex items-center gap-1"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Hide</span>
                </button>
              </div>

              <p className="text-xs text-neutral-200 leading-relaxed">
                {recallChallenge.keyTakeaway}
              </p>

              {/* Self-Rating Verification */}
              <div className="flex items-center justify-between pt-1 border-t border-[#1a2824]/60 text-xs">
                <span className="text-neutral-400 text-[11px]">How was your recall?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate('review')}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                      recallRating === 'review'
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                        : 'bg-[#101714] text-neutral-400 border-[#1a2824] hover:text-white'
                    }`}
                  >
                    Need Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('mastered')}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer border ${
                      recallRating === 'mastered'
                        ? 'bg-[#07CB6C]/20 text-[#07CB6C] border-[#07CB6C]/40'
                        : 'bg-[#101714] text-neutral-400 border-[#1a2824] hover:text-white'
                    }`}
                  >
                    Nailed It ✓
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 3. CHECKLIST / SUB-DELIVERABLE CHALLENGE
  // --------------------------------------------------------------------------
  if (challenge.type === 'checklist') {
    const checkChallenge = challenge as ChecklistChallenge;
    const items = checkChallenge.items || [];
    const totalCount = items.length;
    const completedCount = items.filter((it) => checkedItems[it.id]).length;
    const isAllChecked = totalCount > 0 && completedCount === totalCount;

    const toggleItem = (id: string) => {
      const nextChecked = { ...checkedItems, [id]: !checkedItems[id] };
      setCheckedItems(nextChecked);

      const nextCompletedCount = items.filter((it) => nextChecked[it.id]).length;
      if (onChallengeComplete) {
        onChallengeComplete(nextCompletedCount === totalCount);
      }
    };

    return (
      <div className={`p-3.5 rounded-lg bg-[#070c09] border border-[#1a2824] space-y-2.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
              <ListChecks className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
              Milestone Checklist
            </span>
          </div>

          <span className="text-[11px] font-mono text-neutral-400">
            {completedCount}/{totalCount} completed
          </span>
        </div>

        {/* Micro-Progress Bar */}
        <div className="w-full bg-[#111a17] h-1 rounded-full overflow-hidden border border-[#1a2824]">
          <div
            className="bg-[#07CB6C] h-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        {/* Items List */}
        <div className="space-y-1.5 pt-1">
          {items.map((item) => {
            const isDone = !!checkedItems[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleItem(item.id)}
                className={`w-full p-2 rounded-md border text-left text-xs transition-all flex items-start gap-2 cursor-pointer ${
                  isDone
                    ? 'bg-[#0a1410] border-[#07CB6C]/30 text-neutral-400 line-through'
                    : 'bg-[#0b1310] border-[#1a2824] text-neutral-200 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded mt-0.5 shrink-0 border flex items-center justify-center text-[10px] transition-colors ${
                    isDone
                      ? 'bg-[#07CB6C] border-[#07CB6C] text-black font-bold'
                      : 'border-neutral-600 bg-black/40'
                  }`}
                >
                  {isDone && '✓'}
                </span>
                <span className="leading-snug">{item.label}</span>
              </button>
            );
          })}
        </div>

        {isAllChecked && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-[#07CB6C] pt-1 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5" />
            <span>All sub-milestones checked off!</span>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 4. EXERCISE / CRITERIA CHALLENGE
  // --------------------------------------------------------------------------
  const exerciseChallenge = challenge as ExerciseChallenge;

  const toggleCriteria = () => {
    const nextVal = !isCriteriaMet;
    setIsCriteriaMet(nextVal);
    if (onChallengeComplete) {
      onChallengeComplete(nextVal);
    }
  };

  return (
    <div className={`p-3.5 rounded-lg bg-[#070c09] border border-[#1a2824] space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
            <Target className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300">
            Challenge Target
          </span>
        </div>

        <span className="text-[10px] font-mono text-neutral-500">
          Targeted Exercise
        </span>
      </div>

      <div className="p-2.5 rounded-md bg-[#09120e] border border-[#1a2824] text-xs space-y-1">
        <span className="text-[10px] font-mono text-neutral-500 uppercase block">Evaluation Benchmark</span>
        <p className="text-neutral-200 leading-relaxed font-medium">
          {exerciseChallenge.evaluationCriteria}
        </p>
      </div>

      <button
        type="button"
        onClick={toggleCriteria}
        className={`w-full py-2 px-3 rounded-md border text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
          isCriteriaMet
            ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-[#07CB6C] shadow-sm'
            : 'bg-[#0f1714] border-[#1a2824] hover:border-[#07CB6C]/40 text-neutral-300 hover:text-white'
        }`}
      >
        <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
          isCriteriaMet ? 'bg-[#07CB6C] border-[#07CB6C] text-black font-bold' : 'border-neutral-600'
        }`}>
          {isCriteriaMet ? <Check className="w-3 h-3 text-black" /> : null}
        </div>
        <span>{isCriteriaMet ? 'Benchmark Criteria Mastered ✓' : 'Mark Benchmark Criteria Met'}</span>
      </button>
    </div>
  );
};

export default StepChallengeWidget;
