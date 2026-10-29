import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { ChoiceCard, ChoiceGroup, DialogContent } from '../ui';
import { Button } from './Button';
import type { CertifiedPathway } from '../../lib/certifiedPresets';
import { buildPlanPreview, savePlanPreview, suggestedMinutes, type PlanPreviewAnswers } from '../../lib/planPreview';
import { DAILY_MINUTE_OPTIONS, PLAN_VARIANT_OPTIONS } from '../../lib/schedule';

type Step = 'time' | 'days' | 'plan';

const STEP_EYEBROW: Record<Step, string> = { time: 'Question 1 of 2', days: 'Question 2 of 2', plan: 'Your plan' };

/** The visitor's 90 days for one free goal, from two answers. Nothing here is generated; see lib/planPreview. */
const PlanView: React.FC<{ pathway: CertifiedPathway; answers: PlanPreviewAnswers }> = ({ pathway, answers }) => {
  const plan = buildPlanPreview(pathway, answers);
  return (
    <div className="space-y-7">
      <p className="tabular text-body-lg text-text">
        {plan.sessions} sessions over 12 weeks, about {plan.hours} hours of practice.
        <span className="mt-1 block text-small text-text-secondary">
          {answers.dailyMinutes} min a day · {plan.daysAWeek} days a week
        </span>
      </p>

      <div aria-label="From day 1 to day 90" role="group">
        <div className="relative flex items-center">
          <span className="relative z-10 size-2.5 shrink-0 rounded-full bg-achievement" />
          <span className="relative h-px flex-1 bg-border-strong">
            <span className="absolute inset-0 origin-left animate-line-fill bg-achievement motion-reduce:animate-none" />
          </span>
          <span className="relative z-10 size-2.5 shrink-0 rounded-full border border-achievement bg-surface-elevated" />
        </div>
        <div className="mt-3 flex justify-between gap-6 text-small">
          <p className="text-text-secondary">
            <span className="block text-text">Day 1</span>
            {plan.dayOne}
          </p>
          <p className="text-right text-text-secondary">
            <span className="block text-achievement-hover">Day 90 goal</span>
            {plan.dayNinety}
          </p>
        </div>
      </div>

      <ol aria-label="The three phases" className="border-t border-border">
        {plan.phases.map((phase) => (
          <li key={phase.weeks} className="grid gap-1 border-b border-border py-3.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <span className="text-small text-text-secondary">{phase.weeks}</span>
            <span className="text-small text-text">
              <span className="font-medium">{phase.name}.</span> <span className="text-text-secondary">{phase.focus}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="rounded-card border-l-2 border-achievement bg-background px-5 py-4">
        <p className="flex items-center gap-2 text-small text-text-secondary">
          Your first session
          <span aria-hidden="true">·</span>
          <Clock aria-hidden="true" className="size-4" strokeWidth={1.5} />
          <span className="tabular">{answers.dailyMinutes} min</span>
        </p>
        <p className="mt-2 text-body-lg font-medium text-text">{plan.firstSession.title}</p>
        <p className="mt-1 text-small text-text-secondary">{plan.firstSession.focus}</p>
      </div>

      <p className="text-small text-text-secondary">
        Built on {pathway.coach}. After you sign up, Achivii asks where you’re starting from and writes your first week
        around it. Your answers here are already filled in.
      </p>
    </div>
  );
};

/**
 * Try before signing up: two questions, one per screen, then the shape of the visitor's plan, then sign-up. Mounted
 * fresh for each goal opened, so it always starts at the first question.
 */
export const PlanPreviewDialog: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => {
  const [step, setStep] = useState<Step>('time');
  const [minutes, setMinutes] = useState(suggestedMinutes(pathway));
  const [variant, setVariant] = useState<PlanPreviewAnswers['planVariant']>('steady');
  const answers = { dailyMinutes: minutes, planVariant: variant };

  const footer =
    step === 'plan' ? (
      <>
        <Button variant="quiet" onClick={() => setStep('time')}>
          Change answers
        </Button>
        <Button
          variant="gold"
          withArrow
          to={`/signup?pathway=${encodeURIComponent(pathway.id)}`}
          onClick={() => savePlanPreview(pathway, answers)}
        >
          Save my plan, free
        </Button>
      </>
    ) : (
      <>
        {step === 'days' && (
          <Button variant="quiet" onClick={() => setStep('time')}>
            Back
          </Button>
        )}
        <Button variant="primary" withArrow onClick={() => setStep(step === 'time' ? 'days' : 'plan')}>
          {step === 'time' ? 'Next' : 'Show my plan'}
        </Button>
      </>
    );

  return (
    <DialogContent size="lg" eyebrow={STEP_EYEBROW[step]} title={pathway.title} footer={footer} aria-describedby={undefined}>
      {step === 'time' && (
        <ChoiceGroup
          legend="How much time can you give it on a training day?"
          description="You can change it later."
          value={String(minutes)}
          onChange={(value) => setMinutes(Number(value))}
          columns={2}
        >
          {DAILY_MINUTE_OPTIONS.map((option) => (
            <ChoiceCard
              key={option}
              value={String(option)}
              title={`${option} min`}
              meta={option === suggestedMinutes(pathway) ? 'Suggested for this goal' : undefined}
            />
          ))}
        </ChoiceGroup>
      )}
      {step === 'days' && (
        <ChoiceGroup
          legend="How many days a week?"
          description="Rest days are part of the plan."
          value={variant}
          onChange={(value) => setVariant(value as PlanPreviewAnswers['planVariant'])}
        >
          {PLAN_VARIANT_OPTIONS.map((option) => (
            <ChoiceCard key={option.id} value={option.id} title={option.title} meta={option.meta} description={option.desc} />
          ))}
        </ChoiceGroup>
      )}
      {step === 'plan' && (
        <div className="animate-rise-in motion-reduce:animate-none">
          <PlanView pathway={pathway} answers={answers} />
        </div>
      )}
    </DialogContent>
  );
};
