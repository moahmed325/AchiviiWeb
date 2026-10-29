import React, { useState } from 'react';
import { ArrowRight, CalendarDays, Clock, Sunrise } from 'lucide-react';
import type { RoutineSettings } from '../../types';
import { DAYS_A_WEEK } from '../../lib/schedule';
import { utcDateLabel } from '../../lib/weekClose';
import { Button, Field, Surface, Textarea } from '../ui';
import { StepFooter, StepHeader } from './StepLayout';

const SLOT_LABEL: Record<RoutineSettings['preferredSlot'], string> = {
  morning: 'In the mornings',
  afternoon: 'In the afternoons',
  evening: 'In the evenings',
};

interface StepSummaryProps {
  outcome: string;
  /** What a cleared goal falls back to: clarify's working title, or the goal as typed. */
  defaultOutcome: string;
  onOutcomeChange: (outcome: string) => void;
  routine: RoutineSettings;
  /** 12, or fewer before a fixed date under 12 weeks away (B-109). */
  weeks: number;
  /** The fixed date (`YYYY-MM-DD`), or '' for none. */
  fixedDate: string;
  /** A visitor signs up next; the plan is built straight after. */
  signedIn: boolean;
  onBack: () => void;
  onStart: () => void;
}

/** ND-28: the last page. Short on purpose: where they're going, what it asks of them, and the button to begin. */
export const StepSummary: React.FC<StepSummaryProps> = ({ outcome, defaultOutcome, onOutcomeChange, routine, weeks, fixedDate, signedIn, onBack, onStart }) => {
  const [editing, setEditing] = useState(false);
  const toggleEditing = () => {
    if (editing && !outcome.trim()) onOutcomeChange(defaultOutcome);
    setEditing(!editing);
  };
  const days = routine.planVariant ? DAYS_A_WEEK[routine.planVariant] : 0;
  const sessions = days * weeks;
  const facts = [
    { icon: CalendarDays, text: `${days} days a week` },
    { icon: Clock, text: `${routine.dailyMinutes} min a session` },
    { icon: Sunrise, text: SLOT_LABEL[routine.preferredSlot] },
  ];

  return (
    <div className="flex flex-col">
      <StepHeader eyebrowFromSm eyebrow="Ready when you are" title="Here’s where you’re going" />

      <Surface as="section" aria-labelledby="summary-destination" tone="elevated" radius="panel" padding="lg" className="mt-10 border-l-2 border-l-achievement">
        <div className="flex items-center justify-between gap-4">
          <h2 id="summary-destination" className="font-ui-mono text-micro uppercase text-achievement">
            {fixedDate ? `By ${utcDateLabel(new Date(`${fixedDate}T00:00:00Z`), new Date())}` : 'In 90 days'}
          </h2>
          <Button variant="quiet" size="sm" aria-label={editing ? 'Done' : 'Edit your goal'} onClick={toggleEditing} className="-my-2 -mr-3">
            {editing ? 'Done' : 'Edit'}
          </Button>
        </div>
        {editing ? (
          <Field label="Your 90-day goal" className="mt-5">
            <Textarea rows={2} value={outcome} onChange={(e) => onOutcomeChange(e.target.value)} autoFocus />
          </Field>
        ) : (
          <p className="mt-4 break-words text-h2 text-text">{outcome}</p>
        )}
      </Surface>

      <div aria-hidden="true" className="mt-10">
        <div className="relative flex items-center">
          <span className="relative z-10 size-2.5 shrink-0 rounded-full bg-achievement" />
          <span className="relative h-px flex-1 bg-border-strong">
            <span className="absolute inset-0 origin-left animate-line-fill bg-achievement motion-reduce:animate-none" />
          </span>
          <span className="relative z-10 size-2.5 shrink-0 rounded-full border border-achievement bg-background" />
        </div>
        <div className="mt-3 flex justify-between text-small">
          <span className="text-text">Day 1 · Today</span>
          <span className="text-achievement-hover">{fixedDate ? `Week ${weeks}` : 'Day 90'}</span>
        </div>
      </div>

      <ul aria-label="Your week" className="mt-10 grid gap-3 sm:grid-cols-3">
        {facts.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 rounded-card border border-border px-4 py-3 text-body text-text">
            <Icon aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-achievement" />
            {text}
          </li>
        ))}
      </ul>

      <p className="tabular mt-10 max-w-xl text-body-lg text-text">
        {sessions} sessions, each one small and planned for you. Miss a day and your plan adjusts. You never start over.
      </p>

      <StepFooter onBack={onBack} status={signedIn ? undefined : 'Next, create your account so your plan is saved. It takes a minute.'}>
        <Button size="lg" variant="gold" onClick={onStart} trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}>
          Start my journey
        </Button>
      </StepFooter>
    </div>
  );
};
