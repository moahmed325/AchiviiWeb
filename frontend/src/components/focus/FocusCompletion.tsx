import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Button, Textarea, VisuallyHidden } from '../ui';
import { TASK_NOTES_MAX_LENGTH } from '../../lib/today';

/**
 * ND-28: what finishing this session adds, worked out by Today before it is saved: the session's number over the whole
 * plan and the week with today lit. `new` is the day being finished now.
 */
export interface SessionProgress {
  sessionNumber: number;
  weekDone: number;
  weekDays: number;
  days: Array<{ label: string; state: 'completed' | 'rest' | 'today' | 'upcoming' | 'new' }>;
}

interface FocusCompletionProps {
  dayNumber: number;
  durationMinutes: number;
  isMinimumVersion?: boolean;
  reflectionNote: string;
  onReflectionChange: (val: string) => void;
  onSave: () => void;
  isSubmitting: boolean;
  saveError: string | null;
  progress?: SessionProgress;
}

const weekLine = (p: SessionProgress) =>
  p.weekDays > 0 && p.weekDone >= p.weekDays
    ? 'Week complete. Every session done.'
    : `${p.weekDone} of ${p.weekDays} this week.`;

export const FocusCompletion: React.FC<FocusCompletionProps> = ({
  isMinimumVersion = false, reflectionNote, onReflectionChange, onSave, isSubmitting, saveError, progress,
}) => (
  <section aria-label="Session complete" className="focus-done mx-auto my-auto w-full max-w-lg text-center">
    <span className="focus-done__mark mx-auto" aria-hidden="true">
      <Check strokeWidth={2.25} className="size-8" />
    </span>

    <div className="mt-7 space-y-3">
      <p className="font-ui-mono text-micro uppercase text-achievement">
        {isMinimumVersion ? '10-minute version done' : 'Session complete'}
        {progress ? ` · Session ${progress.sessionNumber}` : ''}
      </p>
      <h2 className="text-h2 text-text">You did the work.</h2>
      {progress ? (
        <p className="text-body-lg text-text-secondary">{weekLine(progress)}</p>
      ) : (
        <p className="text-body text-text-secondary">Take a breath. Leave a note only if it helps.</p>
      )}
    </div>

    {progress && progress.days.length > 0 && (
      <>
        <ol aria-hidden="true" className="mx-auto mt-7 flex max-w-sm items-start justify-between gap-1">
          {progress.days.map((day, index) => (
            <li key={index} className="flex flex-col items-center gap-2">
              <span className="dash-day" data-state={day.state === 'new' ? 'completed' : day.state} data-new={day.state === 'new' || undefined}>
                {(day.state === 'completed' || day.state === 'new') && <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
              </span>
              <span className="font-ui-mono text-micro uppercase text-text-secondary">{day.label}</span>
            </li>
          ))}
        </ol>
        <VisuallyHidden>{`Session ${progress.sessionNumber}. ${weekLine(progress)}`}</VisuallyHidden>
      </>
    )}

    <div className="mt-8 space-y-2 text-left">
      <label htmlFor="reflectionInput" className="text-small font-medium text-text">One thing to remember <span className="font-normal text-text-secondary">(optional)</span></label>
      <Textarea id="reflectionInput" value={reflectionNote} onChange={(e) => onReflectionChange(e.target.value)} placeholder="What mattered today?" rows={3} maxLength={TASK_NOTES_MAX_LENGTH} showCount className="w-full" onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(); }
      }} />
    </div>

    {saveError && (
      <div role="alert" className="mt-4 flex items-start gap-2 rounded-card border border-danger/30 bg-danger/10 p-3 text-left text-small text-danger">
        <AlertTriangle aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
        <span>{saveError}</span>
      </div>
    )}

    <Button variant="gold" size="lg" disabled={isSubmitting} loading={isSubmitting} onClick={onSave} className="mt-5 w-full">
      {isSubmitting ? 'Saving…' : saveError ? 'Try again' : 'Finish & return'}
    </Button>
  </section>
);
