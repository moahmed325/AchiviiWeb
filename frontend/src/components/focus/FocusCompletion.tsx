import React from 'react';
import { CheckCircle2, Sparkles, AlertTriangle } from 'lucide-react';
import { Button, Badge, Field, Textarea } from '../ui';

interface FocusCompletionProps {
  dayNumber: number;
  durationMinutes: number;
  reflectionNote: string;
  onReflectionChange: (val: string) => void;
  onSave: () => void;
  isSubmitting: boolean;
  saveError: string | null;
}

export const FocusCompletion: React.FC<FocusCompletionProps> = ({
  dayNumber,
  durationMinutes,
  reflectionNote,
  onReflectionChange,
  onSave,
  isSubmitting,
  saveError,
}) => {
  return (
    <section
      aria-label="Deliberate practice completion"
      className="max-w-md mx-auto my-auto text-center space-y-4 py-4"
    >
      {/* Celebration Badge */}
      <div className="size-14 rounded-full bg-accent/15 border-2 border-accent flex items-center justify-center text-accent mx-auto">
        <CheckCircle2 className="size-7" />
      </div>

      <div className="space-y-1.5">
        <Badge tone="accent" className="mx-auto">
          <Sparkles className="size-3 mr-1.5" />
          <span>Deliberate Practice Complete</span>
        </Badge>
        <h2 className="text-h2 font-semibold text-text tracking-tight">
          Day {dayNumber} Mastered
        </h2>
        <p className="text-small text-text-secondary">
          You showed up and executed your session. Another day closer to 90-day mastery.
        </p>
      </div>

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="p-3 rounded-card bg-surface border border-border">
          <span className="text-micro font-ui-mono text-text-secondary uppercase block">Time Logged</span>
          <span className="text-base font-bold font-ui-mono text-text">
            {durationMinutes} min
          </span>
        </div>
        <div className="p-3 rounded-card bg-surface border border-border">
          <span className="text-micro font-ui-mono text-text-secondary uppercase block">Progress</span>
          <span className="text-base font-bold font-ui-mono text-accent">
            Day {dayNumber} / 90
          </span>
        </div>
      </div>

      {/* Reflection Note Input */}
      <div className="text-left space-y-1.5">
        <Field
          label="Quick Reflection (Optional):"
          id="reflectionInput"
          hint="Press Ctrl+Enter or click below to save."
        >
          <Textarea
            id="reflectionInput"
            value={reflectionNote}
            onChange={(e) => onReflectionChange(e.target.value)}
            placeholder="What was your breakthrough today?"
            rows={2}
            className="w-full resize-none text-small"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                onSave();
              }
            }}
          />
        </Field>
      </div>

      {/* Error Alert on Failed Write */}
      {saveError && (
        <div
          role="alert"
          className="p-3 rounded-control bg-danger/10 border border-danger/30 text-small text-danger text-left flex items-start gap-2"
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Return Button */}
      <div className="pt-1">
        <Button
          variant="primary"
          size="lg"
          disabled={isSubmitting}
          loading={isSubmitting}
          onClick={onSave}
          className="w-full min-h-[44px] uppercase tracking-wide font-medium"
        >
          {isSubmitting ? 'Saving...' : saveError ? 'Try again' : 'Save & Return to Dashboard'}
        </Button>
      </div>
    </section>
  );
};
