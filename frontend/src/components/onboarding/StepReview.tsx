import React from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { FollowUpQuestion, GoalClarification, RoutineSettings } from '../../types';
import { findPathwayByTitle } from '../../lib/certifiedPresets';
import { Button, StepMarker, Surface, cx } from '../ui';
import { EvidenceTriad } from './EvidenceTriad';
import { StepFooter, StepHeader } from './StepLayout';

const PLAN: Record<NonNullable<RoutineSettings['planVariant']>, { title: string; days: number }> = {
  minimal: { title: 'Light', days: 4 },
  steady: { title: 'Steady', days: 5 },
  accelerated: { title: 'Intensive', days: 6 },
};

const TREADS = 12;

interface StepReviewProps {
  rawGoal: string;
  clarification: GoalClarification;
  displayOutcome: string;
  startingQuestions: FollowUpQuestion[];
  successQuestions: FollowUpQuestion[];
  answerFor: (q: FollowUpQuestion) => string | undefined;
  routine: RoutineSettings;
  practiceTimeLabel: string;
  onEditOutcome: () => void;
  onEditStartingPoint: () => void;
  onEditSchedule: () => void;
  onChangeGoal: () => void;
  onBack: () => void;
  onGenerate: () => void;
}

const ReviewSection: React.FC<{
  title: string;
  editLabel: string;
  onEdit: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ title, editLabel, onEdit, className, children }) => (
  <Surface as="section" padding="md" className={cx('flex flex-col gap-4', className)}>
    <div className="flex items-center justify-between gap-4">
      <h2 className="font-ui-mono text-micro uppercase text-text-secondary">{title}</h2>
      <Button variant="quiet" size="sm" onClick={onEdit} className="-my-2 -mr-3">
        Edit<span className="sr-only"> {editLabel}</span>
      </Button>
    </div>
    {children}
  </Surface>
);

const Answer: React.FC<{ question: string; answer: string | undefined }> = ({ question, answer }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-small text-text-secondary">{question}</dt>
    <dd className={cx('text-body', answer ? 'text-text' : 'text-text-secondary')}>{answer || 'Skipped'}</dd>
  </div>
);

/** Arrival: everything the path will be built from, in one place, and the moment of commitment. */
export const StepReview: React.FC<StepReviewProps> = ({
  rawGoal,
  clarification,
  displayOutcome,
  startingQuestions,
  successQuestions,
  answerFor,
  routine,
  practiceTimeLabel,
  onEditOutcome,
  onEditStartingPoint,
  onEditSchedule,
  onChangeGoal,
  onBack,
  onGenerate,
}) => {
  const pathway = findPathwayByTitle(rawGoal);
  const plan = routine.planVariant ? PLAN[routine.planVariant] : undefined;
  const commitments = routine.commitments || [];

  return (
    <div className="flex flex-col">
      <StepHeader
        eyebrow="Review"
        title="Before we build your path"
        description="Check where you're going, where you're starting and the time you'll give it. You can change anything now."
      />

      <Surface as="section" aria-labelledby="review-destination" tone="elevated" radius="panel" padding="lg" className="mt-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <StepMarker state="destination" size="sm" />
            <h2 id="review-destination" className="font-ui-mono text-micro uppercase text-achievement">
              Your destination
            </h2>
          </div>
          <Button variant="quiet" size="sm" onClick={onEditOutcome} className="-my-2 -mr-3">
            Edit<span className="sr-only"> destination</span>
          </Button>
        </div>
        <p className="mt-5 break-words text-h2 text-text">{displayOutcome}</p>
        {successQuestions.length > 0 && (
          <dl className="mt-6 flex flex-col gap-4 border-t border-border pt-5">
            {successQuestions.map((q) => (
              <Answer key={q.id} question={q.question} answer={answerFor(q)} />
            ))}
          </dl>
        )}
      </Surface>

      <figure className="mt-10" aria-labelledby="journey-shape">
        <div aria-hidden="true" className="flex h-20 items-end gap-1">
          {Array.from({ length: TREADS }, (_, i) => (
            <div
              key={i}
              className={cx(
                'flex-1 animate-rise-in rounded-t-block',
                i === 0 ? 'bg-accent' : i === TREADS - 1 ? 'bg-achievement' : 'bg-text/[0.1]'
              )}
              style={{ height: `${((i + 1) / TREADS) * 100}%`, animationDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
        <figcaption id="journey-shape" className="mt-3 flex justify-between gap-4 text-small">
          <span className="text-text-secondary">Day 1: where you are today</span>
          <span className="text-right text-achievement">Day 90: your destination</span>
        </figcaption>
      </figure>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <ReviewSection title="Starting point" editLabel="starting point" onEdit={onEditStartingPoint} className="sm:col-span-2">
          {startingQuestions.length > 0 ? (
            <dl className="grid gap-5 sm:grid-cols-2">
              {startingQuestions.map((q) => (
                <Answer key={q.id} question={q.question} answer={answerFor(q)} />
              ))}
            </dl>
          ) : (
            <p className="text-body text-text-secondary">Nothing to add.</p>
          )}
        </ReviewSection>

        <ReviewSection title="Your time" editLabel="schedule" onEdit={onEditSchedule}>
          <ul className="flex flex-col gap-1.5 text-body text-text">
            {plan && (
              <li>
                {plan.title}: {plan.days} days a week
              </li>
            )}
            <li>{routine.dailyMinutes} min a day</li>
            <li>{practiceTimeLabel}</li>
          </ul>
          <p className="text-small text-text-secondary">
            Planned around your day: up at {routine.wakeTime}, busy {routine.busyHours || 'no fixed hours'}, asleep by {routine.sleepTime}
            {commitments.length > 0 && `, plus ${commitments.map((c) => c.title).join(', ')}`}.
          </p>
        </ReviewSection>

        <ReviewSection title="Approach" editLabel="goal" onEdit={onChangeGoal}>
          {pathway ? (
            <>
              <p className="text-body text-text">Certified pathway: {pathway.title}</p>
              <p className="text-small text-text-secondary">Built on {pathway.badge}</p>
            </>
          ) : (
            <>
              <p className="text-body text-text">A journey shaped around your goal</p>
              <p className="text-small text-text-secondary">{clarification.primaryDomain}</p>
            </>
          )}
        </ReviewSection>
      </div>

      {clarification.evidenceTriad && (
        <details className="group mt-6 rounded-card border border-border">
          <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 text-body font-medium text-text [&::-webkit-details-marker]:hidden">
            How this pathway is built
            <ChevronDown aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-text-secondary transition-transform duration-(--duration-base) group-open:rotate-180" />
          </summary>
          <div className="px-5 pb-5">
            <EvidenceTriad triad={clarification.evidenceTriad} />
          </div>
        </details>
      )}

      <p className="mt-12 max-w-xl text-body-lg text-text">
        When you're ready, Achivii builds your path: every week pointed at your destination, and every session planned around your time.
      </p>

      <StepFooter onBack={onBack}>
        <Button size="lg" onClick={onGenerate} trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}>
          Build my 90-day path
        </Button>
      </StepFooter>
    </div>
  );
};
