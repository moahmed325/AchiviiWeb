import React, { useState, useMemo } from 'react';
import type {
  DetailedStep,
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

import { inferStepChallenge } from '../lib/stepChallenge';

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
      <div className={`p-3.5 rounded-card bg-surface-elevated border border-border space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-control bg-accent/10 text-accent border border-accent/20">
              <Dumbbell className="size-3.5" />
            </span>
            <span className="text-micro font-ui-mono font-bold uppercase tracking-wider text-text">
              Interactive Rep Drill
            </span>
          </div>

          <span className="text-micro font-ui-mono text-text-secondary">
            {completedSets.length}/{totalSets} sets done
          </span>
        </div>

        {/* Set Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {setsArray.map((idx) => {
            const isDone = completedSets.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleSet(idx)}
                className={`min-h-[44px] py-2 px-2.5 rounded-control border text-micro font-ui-mono font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer focus-ring ${
                  isDone
                    ? 'bg-accent/15 border-accent text-accent shadow-sm'
                    : 'bg-surface border-border text-text-secondary hover:border-border-control hover:text-text'
                }`}
              >
                <div
                  className={`size-4 rounded-full flex items-center justify-center text-[10px] border ${
                    isDone ? 'bg-accent text-background border-accent font-bold' : 'border-border-control text-text-muted'
                  }`}
                >
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
          <div className="flex items-center justify-center gap-1.5 text-micro font-ui-mono text-accent pt-1 animate-fadeIn">
            <Flame className="size-3.5" />
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
      <div className={`p-3.5 rounded-card bg-surface-elevated border border-border space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-control bg-accent/10 text-accent border border-accent/20">
              <Brain className="size-3.5" />
            </span>
            <span className="text-micro font-ui-mono font-bold uppercase tracking-wider text-text">
              Active Recall Self-Test
            </span>
          </div>

          <span className="text-micro font-ui-mono text-text-secondary">
            Cognitive Retrieval
          </span>
        </div>

        {/* Question Prompt */}
        <div className="space-y-1 text-small">
          <p className="font-medium text-text leading-snug">
            {recallChallenge.question}
          </p>
          {recallChallenge.hint && (
            <p className="text-micro text-text-muted italic">
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
              className="min-h-[44px] w-full py-2.5 px-3 rounded-control bg-surface hover:bg-surface-elevated border border-border hover:border-border-control text-small font-medium text-text transition-colors flex items-center justify-center gap-2 cursor-pointer focus-ring"
            >
              <Eye className="size-4 text-accent" />
              <span>Reveal Key Takeaway to Verify</span>
            </button>
          ) : (
            <div className="p-3 rounded-control bg-surface border border-accent/30 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between text-micro font-ui-mono text-text-secondary">
                <span className="text-accent font-medium">Verified Takeaway:</span>
                <button
                  type="button"
                  onClick={() => setIsAnswerRevealed(false)}
                  className="hover:text-text inline-flex items-center gap-1 min-h-[32px] px-2 rounded-control focus-ring"
                >
                  <EyeOff className="size-3.5" />
                  <span>Hide</span>
                </button>
              </div>

              <p className="text-small text-text-secondary leading-relaxed">
                {recallChallenge.keyTakeaway}
              </p>

              {/* Self-Rating Verification */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-small">
                <span className="text-text-secondary text-micro">How was your recall?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRate('review')}
                    className={`min-h-[38px] px-3 py-1 rounded-control text-micro font-ui-mono transition-colors cursor-pointer border focus-ring ${
                      recallRating === 'review'
                        ? 'bg-caution/20 text-caution border-caution/40 font-medium'
                        : 'bg-surface-elevated text-text-secondary border-border hover:text-text'
                    }`}
                  >
                    Need Review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate('mastered')}
                    className={`min-h-[38px] px-3 py-1 rounded-control text-micro font-ui-mono transition-colors cursor-pointer border focus-ring ${
                      recallRating === 'mastered'
                        ? 'bg-accent/20 text-accent border-accent/40 font-medium'
                        : 'bg-surface-elevated text-text-secondary border-border hover:text-text'
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
      <div className={`p-3.5 rounded-card bg-surface-elevated border border-border space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-control bg-accent/10 text-accent border border-accent/20">
              <ListChecks className="size-3.5" />
            </span>
            <span className="text-micro font-ui-mono font-bold uppercase tracking-wider text-text">
              Milestone Checklist
            </span>
          </div>

          <span className="text-micro font-ui-mono text-text-secondary">
            {completedCount}/{totalCount} completed
          </span>
        </div>

        {/* Micro-Progress Bar */}
        <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-border">
          <div
            className="bg-accent h-full transition-all duration-300"
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
                className={`min-h-[44px] w-full p-2.5 rounded-control border text-left text-small transition-colors flex items-start gap-2.5 cursor-pointer focus-ring ${
                  isDone
                    ? 'bg-surface border-accent/30 text-text-muted line-through'
                    : 'bg-surface border-border text-text hover:border-border-control'
                }`}
              >
                <span
                  className={`size-4 rounded mt-0.5 shrink-0 border flex items-center justify-center text-[10px] transition-colors ${
                    isDone
                      ? 'bg-accent border-accent text-background font-bold'
                      : 'border-border-control bg-surface'
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
          <div className="flex items-center justify-center gap-1.5 text-micro font-ui-mono text-accent pt-1 animate-fadeIn">
            <Sparkles className="size-3.5" />
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
    <div className={`p-3.5 rounded-card bg-surface-elevated border border-border space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-control bg-accent/10 text-accent border border-accent/20">
            <Target className="size-3.5" />
          </span>
          <span className="text-micro font-ui-mono font-bold uppercase tracking-wider text-text">
            Challenge Target
          </span>
        </div>

        <span className="text-micro font-ui-mono text-text-secondary">
          Targeted Exercise
        </span>
      </div>

      <div className="p-3 rounded-control bg-surface border border-border text-small space-y-1">
        <span className="text-micro font-ui-mono text-text-secondary uppercase block">Evaluation Benchmark</span>
        <p className="text-text leading-relaxed font-medium">
          {exerciseChallenge.evaluationCriteria}
        </p>
      </div>

      <button
        type="button"
        onClick={toggleCriteria}
        className={`min-h-[44px] w-full py-2.5 px-3 rounded-control border text-small font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer focus-ring ${
          isCriteriaMet
            ? 'bg-accent/15 border-accent text-accent shadow-sm'
            : 'bg-surface border-border hover:border-border-control text-text-secondary hover:text-text'
        }`}
      >
        <div
          className={`size-4 rounded-full border flex items-center justify-center text-[10px] ${
            isCriteriaMet ? 'bg-accent border-accent text-background font-bold' : 'border-border-control'
          }`}
        >
          {isCriteriaMet ? <Check className="size-3 text-background" /> : null}
        </div>
        <span>{isCriteriaMet ? 'Benchmark Criteria Mastered ✓' : 'Mark Benchmark Criteria Met'}</span>
      </button>
    </div>
  );
};

export default StepChallengeWidget;
