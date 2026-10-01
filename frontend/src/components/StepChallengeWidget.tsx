import React, { useMemo, useState } from 'react';
import type {
  DetailedStep,
  RepetitionsChallenge,
  ActiveRecallChallenge,
  ChecklistChallenge,
  ExerciseChallenge,
} from '../types';
import { Check, Eye, ArrowRight } from 'lucide-react';
import { inferStepChallenge } from '../lib/stepChallenge';

interface StepChallengeWidgetProps {
  step: DetailedStep;
  className?: string;
  onChallengeComplete?: (isComplete: boolean) => void;
}

export const StepChallengeWidget: React.FC<StepChallengeWidgetProps> = ({
  step,
  className = '',
  onChallengeComplete,
}) => {
  const challenge = useMemo(() => inferStepChallenge(step), [step]);
  const [completedSets, setCompletedSets] = useState<number[]>([]);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [recallRating, setRecallRating] = useState<'mastered' | 'review' | null>(null);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [isCriteriaMet, setIsCriteriaMet] = useState(false);

  const complete = (value: boolean) => onChallengeComplete?.(value);

  if (challenge.type === 'repetitions') {
    const rep = challenge as RepetitionsChallenge;
    const totalSets = Math.max(1, rep.totalSets || 3);
    const done = completedSets.length === totalSets;

    const toggleSet = (idx: number) => {
      const next = completedSets.includes(idx)
        ? completedSets.filter((item) => item !== idx)
        : [...completedSets, idx];
      setCompletedSets(next);
      complete(next.length === totalSets);
    };

    return (
      <section className={`mt-6 w-full max-w-xl ${className}`} aria-label="Practice drill">
        <div className="flex items-center justify-between mb-3">
          <p className="text-small font-medium text-text">Do the drill</p>
          <span className="text-micro font-ui-mono text-text-muted">{completedSets.length}/{totalSets}</span>
        </div>
        <p className="text-small text-text-secondary mb-4">
          {rep.drillName} · {rep.targetCount} {rep.unit} each
        </p>
        <div className="flex gap-2">
          {Array.from({ length: totalSets }, (_, idx) => {
            const active = completedSets.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleSet(idx)}
                aria-label={`Set ${idx + 1}`}
                className={`flex-1 min-h-12 rounded-control border transition-colors focus-ring ${active
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface border-border text-text-secondary hover:border-accent/50'}`}
              >
                {active ? <Check className="size-4 mx-auto" /> : <span className="text-small font-medium">{idx + 1}</span>}
              </button>
            );
          })}
        </div>
        {done && <p className="mt-3 text-micro text-accent">Drill complete.</p>}
      </section>
    );
  }

  if (challenge.type === 'active_recall') {
    const recall = challenge as ActiveRecallChallenge;

    const rate = (rating: 'mastered' | 'review') => {
      setRecallRating(rating);
      complete(rating === 'mastered');
    };

    return (
      <section className={`mt-6 w-full max-w-xl ${className}`} aria-label="Recall challenge">
        <div className="mb-3">
          <p className="text-small font-medium text-text">Recall it</p>
          <p className="mt-2 text-base leading-relaxed text-text">{recall.question}</p>
        </div>
        {recall.hint && !isAnswerRevealed && (
          <p className="mb-4 text-micro text-text-muted">Hint: {recall.hint}</p>
        )}
        {!isAnswerRevealed ? (
          <button
            type="button"
            onClick={() => setIsAnswerRevealed(true)}
            className="min-h-11 w-full rounded-control border border-accent/40 bg-accent/10 px-4 text-small font-medium text-accent hover:bg-accent/15 focus-ring"
          >
            <span className="inline-flex items-center justify-center gap-2"><Eye className="size-4" />Check your answer</span>
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-small leading-relaxed text-text-secondary">{recall.keyTakeaway}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => rate('review')} className={`min-h-11 rounded-control border text-small focus-ring ${recallRating === 'review' ? 'border-caution bg-caution/10 text-caution' : 'border-border bg-surface text-text-secondary'}`}>Review</button>
              <button type="button" onClick={() => rate('mastered')} className={`min-h-11 rounded-control border text-small focus-ring ${recallRating === 'mastered' ? 'border-accent bg-accent/15 text-accent' : 'border-accent/40 bg-accent/10 text-accent'}`}>Got it</button>
            </div>
          </div>
        )}
      </section>
    );
  }

  if (challenge.type === 'checklist') {
    const checklist = challenge as ChecklistChallenge;
    const items = checklist.items || [];
    const completed = items.filter((item) => checkedItems[item.id]).length;
    const done = items.length > 0 && completed === items.length;

    const toggle = (id: string) => {
      const next = { ...checkedItems, [id]: !checkedItems[id] };
      setCheckedItems(next);
      complete(items.length > 0 && items.every((item) => next[item.id]));
    };

    return (
      <section className={`mt-6 w-full max-w-xl ${className}`} aria-label="Action checklist">
        <div className="flex items-center justify-between mb-3">
          <p className="text-small font-medium text-text">Build it</p>
          <span className="text-micro font-ui-mono text-text-muted">{completed}/{items.length}</span>
        </div>
        <div className="h-1 rounded-full bg-surface-elevated overflow-hidden mb-4">
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} />
        </div>
        <div className="space-y-2">
          {items.map((item) => {
            const checked = !!checkedItems[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={`w-full min-h-12 rounded-control border px-3 text-left text-small transition-colors flex items-center gap-3 focus-ring ${checked
                  ? 'border-accent/40 bg-accent/10 text-text-muted'
                  : 'border-border bg-surface text-text hover:border-accent/50'}`}
              >
                <span className={`size-5 shrink-0 rounded-full border flex items-center justify-center ${checked ? 'bg-accent border-accent text-background' : 'border-border-control'}`}>
                  {checked && <Check className="size-3" />}
                </span>
                <span className={checked ? 'line-through' : ''}>{item.label}</span>
              </button>
            );
          })}
        </div>
        {done && <p className="mt-3 text-micro text-accent">Build complete.</p>}
      </section>
    );
  }

  const exercise = challenge as ExerciseChallenge;
  const toggleCriteria = () => {
    const next = !isCriteriaMet;
    setIsCriteriaMet(next);
    complete(next);
  };

  return (
    <section className={`mt-6 w-full max-w-xl ${className}`} aria-label="Practical exercise">
      <div className="mb-3">
        <p className="text-small font-medium text-text">Make it</p>
        <p className="mt-2 text-base leading-relaxed text-text">{exercise.targetDeliverable}</p>
      </div>
      <p className="mb-4 text-small leading-relaxed text-text-secondary">{exercise.prompt}</p>
      <div className="mb-4 rounded-control border-l-2 border-accent bg-accent/5 px-4 py-3">
        <p className="text-micro uppercase tracking-wider text-accent mb-1">Done when</p>
        <p className="text-small leading-relaxed text-text">{exercise.evaluationCriteria}</p>
      </div>
      <button
        type="button"
        onClick={toggleCriteria}
        className={`min-h-12 w-full rounded-control border text-small font-medium transition-colors focus-ring inline-flex items-center justify-center gap-2 ${isCriteriaMet
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/15'}`}
      >
        {isCriteriaMet ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
        {isCriteriaMet ? 'Done' : 'I did it'}
      </button>
    </section>
  );
};

export default StepChallengeWidget;
