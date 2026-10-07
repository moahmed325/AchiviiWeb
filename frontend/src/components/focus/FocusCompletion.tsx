import React from 'react';
import { CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button, Textarea } from '../ui';

interface FocusCompletionProps {
  dayNumber: number;
  durationMinutes: number;
  isMinimumVersion?: boolean;
  reflectionNote: string;
  onReflectionChange: (val: string) => void;
  onSave: () => void;
  isSubmitting: boolean;
  saveError: string | null;
}

export const FocusCompletion: React.FC<FocusCompletionProps> = ({
  isMinimumVersion = false, reflectionNote, onReflectionChange, onSave, isSubmitting, saveError,
}) => (
  <section aria-label="Session complete" className="max-w-lg mx-auto my-auto text-center">
    <div className="size-16 rounded-full bg-achievement/15 border-2 border-achievement flex items-center justify-center text-achievement mx-auto shadow-[0_0_40px_color-mix(in_srgb,var(--color-achievement)_16%,transparent)]">
      <CheckCircle2 className="size-8" />
    </div>

    <div className="mt-6 space-y-2">
      <div className="inline-flex items-center gap-1.5 text-micro font-ui-mono uppercase tracking-[0.18em] text-achievement">
        <Sparkles className="size-3" /> {isMinimumVersion ? 'Minimum complete' : 'Session complete'}
      </div>
      <h2 className="text-h2 text-text">You did the work.</h2>
      <p className="text-body text-text-secondary">Take a breath. Leave a note only if it helps.</p>
    </div>    <div className="mt-7 text-left space-y-2">
      <label htmlFor="reflectionInput" className="text-small font-medium text-text">One thing to remember <span className="text-text-secondary font-normal">(optional)</span></label>
      <Textarea id="reflectionInput" value={reflectionNote} onChange={(e) => onReflectionChange(e.target.value)} placeholder="What mattered today?" rows={3} className="w-full resize-none text-small" onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(); }
      }} />
    </div>

    {saveError && (
      <div role="alert" className="mt-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-small text-danger text-left flex items-start gap-2">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        <span>{saveError}</span>
      </div>
    )}

    <Button variant="primary" size="lg" disabled={isSubmitting} loading={isSubmitting} onClick={onSave} className="mt-5 w-full shadow-[0_12px_32px_color-mix(in_srgb,var(--color-achievement)_18%,transparent)]">
      {isSubmitting ? 'Saving…' : saveError ? 'Try again' : 'Finish & return'}
    </Button>
  </section>
);
