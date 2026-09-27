import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  RotateCcw,
  Sparkles,
  Target,
} from 'lucide-react';
import type { Goal, WeeklyTestResult, GoalCompletionPayload } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { extractFinalTestEvaluation } from '../../lib/achievement';
import { dayNumber } from '../../lib/today';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { cx } from '../ui/cx';

export interface ClosingStretchViewProps {
  goal: Goal;
  apiStatus?: 'online' | 'offline' | 'checking';
  onComplete?: (completedGoal: Goal) => void;
}

const STORAGE_KEY_PREFIX = 'achivii_closing_reflection_';

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <p className={cx('font-ui-mono text-micro uppercase tracking-wider text-text-secondary', className)}>
    {children}
  </p>
);

/**
 * ClosingStretchView (Days 85–90, OD-2 Option A, BP §34).
 * Terminal deliberate practice state in Today. The 84 planned practice days are complete.
 * Days 85–90 are dedicated to the Capstone Evaluation, 90-day journey reflection,
 * and arrival at the Roman garden destination.
 */
export const ClosingStretchView: React.FC<ClosingStretchViewProps> = ({
  goal,
  apiStatus = 'online',
  onComplete,
}) => {
  const { completeGoal } = useGoal();
  const [now] = useState(() => new Date());
  const currentDay = dayNumber(goal, now);

  const evalData = useMemo(() => extractFinalTestEvaluation(goal), [goal]);
  const storageKey = `${STORAGE_KEY_PREFIX}${goal.id}`;

  const [reflection, setReflection] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  const [testResult, setTestResult] = useState<WeeklyTestResult | null>(() => {
    return evalData?.result || null;
  });

  const [completing, setCompleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reflectionFieldId = useId();
  const testValueFieldId = useId();
  const testNotesFieldId = useId();

  const summitGoal = goal.roadmap?.finalGoal || goal.clarifiedOutcome || goal.rawGoal;

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setReflection(val);
    try {
      localStorage.setItem(storageKey, val);
    } catch {
      // Storage unavailable
    }
  };

  const handlePassedChange = (passed: boolean) => {
    setTestResult((prev) => ({
      value: prev?.value || (passed ? 'Achieved' : 'In Progress'),
      unit: prev?.unit,
      passed,
      note: prev?.note,
    }));
  };

  const handleTestValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val.trim()) {
      setTestResult((prev) => (prev ? { ...prev, value: '' } : null));
      return;
    }
    setTestResult((prev) => ({
      value: val,
      unit: prev?.unit,
      passed: prev?.passed ?? true,
      note: prev?.note,
    }));
  };

  const handleTestNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const note = e.target.value;
    setTestResult((prev) => (prev ? { ...prev, note } : { value: 'Achieved', passed: true, note }));
  };

  const handleSubmit = async (skipTest: boolean = false) => {
    if (completing || apiStatus === 'offline') return;
    setCompleting(true);
    setSubmitError(null);

    const payload: GoalCompletionPayload = {
      finalReflection: reflection.trim() || undefined,
      finalTestResult: skipTest ? null : (testResult && String(testResult.value).trim() ? testResult : null),
    };

    try {
      const updated = await completeGoal(payload);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignored
      }
      onComplete?.(updated);
    } catch (err: unknown) {
      console.error('Failed to complete goal:', err);
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) ||
        (err instanceof Error && /network|offline|failed to fetch/i.test(err.message));

      if (isNetworkError) {
        setSubmitError("You're offline. Reconnect to complete your journey and arrive at the garden.");
      } else {
        const message = err instanceof Error ? err.message : '';
        setSubmitError(
          message || "We couldn't record your completion right now. Your reflection draft is safe; please try again."
        );
      }
    } finally {
      setCompleting(false);
    }
  };

  // 6-day closing stretch approach steps: Days 85 to 90
  const closingDays = [85, 86, 87, 88, 89, 90];

  return (
    <section
      aria-labelledby="closing-stretch-heading"
      className="mt-10 rounded-panel border border-achievement/30 bg-surface p-6 sm:p-8 space-y-8 shadow-sm ring-1 ring-achievement/10"
    >
      {/* Eyebrow & Headline */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow className="text-achievement">DAYS 85–90 · THE CLOSING STRETCH</Eyebrow>
          <Button
            asChild
            variant="quiet"
            size="sm"
            trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            className="text-text-secondary hover:text-text"
          >
            <Link to="/roadmap">Review 90-day staircase</Link>
          </Button>
        </div>
        <h2 id="closing-stretch-heading" className="mt-3 text-h2 font-semibold text-text">
          The Final Evaluation & Arrival
        </h2>
        <p className="mt-2 text-body text-text-secondary max-w-2xl leading-relaxed">
          The 84 planned deliberate practice days are complete. These final six days are dedicated to
          taking your capstone evaluation, reflecting on your 90-day journey, and arriving at the
          destination.
        </p>
      </div>

      {/* 6-Day Approach Progress Indicator */}
      <div className="rounded-card border border-border bg-surface-elevated/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-ui-mono text-micro uppercase tracking-wider text-text-muted">
            Closing Stretch Approach
          </span>
          <span className="font-ui-mono text-micro text-achievement">
            Day {currentDay} of 90
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2 text-center">
          {closingDays.map((d) => {
            const isDone = currentDay > d;
            const isCurrent = currentDay === d;
            return (
              <div
                key={d}
                className={cx(
                  'rounded-control border px-2 py-2.5 transition-colors',
                  isCurrent
                    ? 'border-achievement bg-achievement/15 text-achievement font-semibold ring-1 ring-achievement/30'
                    : isDone
                    ? 'border-border bg-surface text-text'
                    : 'border-border/60 bg-surface/40 text-text-muted'
                )}
              >
                <div className="font-ui-mono text-micro uppercase">
                  {d === 90 ? 'Summit ✦' : `Day ${d}`}
                </div>
                <div className="mt-1 text-micro text-text-secondary">
                  {d === 90 ? 'Arrival' : isDone ? 'Done' : isCurrent ? 'Today' : 'Ahead'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Capstone Evaluation Card */}
      <div className="rounded-card border border-border bg-surface-elevated/70 p-5 sm:p-6 space-y-4 text-left">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
            <Target aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-achievement shrink-0" />
            <span>Capstone Benchmark Verification</span>
          </div>
          <h3 className="text-body font-semibold text-text">
            {evalData?.testType || 'Capstone Benchmark Verification'}
          </h3>
          <p className="text-small text-text-secondary leading-relaxed">
            {evalData?.instructions ||
              'Complete your final capstone verification test under standard conditions.'}
          </p>
        </div>

        {/* Target Deliverable / Pass Mark Banner */}
        {(evalData?.targetDeliverable || evalData?.passCriteria) && (
          <div className="rounded-control border border-border bg-background/50 p-3 space-y-1.5 text-small text-text">
            {evalData.targetDeliverable && (
              <div>
                <span className="font-medium text-text-secondary">Summit Target: </span>
                <span>{evalData.targetDeliverable}</span>
              </div>
            )}
            {evalData.passCriteria && (
              <div>
                <span className="font-medium text-text-secondary">Criteria: </span>
                <span className="text-text-secondary">{evalData.passCriteria}</span>
              </div>
            )}
          </div>
        )}

        {/* Ambition Reminder */}
        {summitGoal && (
          <div className="flex items-start gap-2 rounded-control border border-achievement/20 bg-achievement/5 p-3 text-small text-text">
            <Compass aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-text-secondary">Summit Ambition: </span>
              <span className="text-text">{summitGoal}</span>
            </div>
          </div>
        )}

        {/* Result Input Controls */}
        <div className="pt-2 space-y-4 border-t border-border">
          <div>
            <label className="block text-small font-medium text-text mb-2">
              Capstone Result
            </label>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => handlePassedChange(true)}
                className={cx(
                  'flex items-center gap-2 rounded-control border px-3.5 py-2 text-small font-medium transition-colors cursor-pointer',
                  testResult?.passed === true
                    ? 'border-accent bg-accent/10 text-accent font-semibold ring-1 ring-accent/30'
                    : 'border-border bg-surface hover:bg-surface-elevated text-text-secondary'
                )}
              >
                <CheckCircle2 aria-hidden="true" strokeWidth={1.5} className="size-4" />
                <span>Benchmark achieved</span>
              </button>
              <button
                type="button"
                onClick={() => handlePassedChange(false)}
                className={cx(
                  'flex items-center gap-2 rounded-control border px-3.5 py-2 text-small font-medium transition-colors cursor-pointer',
                  testResult?.passed === false
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300 font-semibold ring-1 ring-amber-500/30'
                    : 'border-border bg-surface hover:bg-surface-elevated text-text-secondary'
                )}
              >
                <RotateCcw aria-hidden="true" strokeWidth={1.5} className="size-4" />
                <span>In progress — Reinforcing</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Recorded Score or Deliverable Output"
              id={testValueFieldId}
              hint="e.g. 48:30 min, Level B2 Passed, 55 wpm"
            >
              <Input
                id={testValueFieldId}
                value={testResult?.value ?? ''}
                placeholder="Result value or deliverable description"
                onChange={handleTestValueChange}
              />
            </Field>

            <Field
              label="Evaluation Notes (optional)"
              id={testNotesFieldId}
              hint="Conditions, what clicked, reflections"
            >
              <Input
                id={testNotesFieldId}
                value={testResult?.note ?? ''}
                placeholder="Optional benchmark observation"
                onChange={handleTestNoteChange}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Final Journey Reflection Textarea */}
      <div className="space-y-2 text-left">
        <Field
          label="Final Journey Reflection"
          id={reflectionFieldId}
          hint="What shifted over these ninety days? What habits, systems, or understanding feel permanent?"
        >
          <Textarea
            id={reflectionFieldId}
            rows={4}
            value={reflection}
            onChange={handleReflectionChange}
            placeholder="Take a quiet moment to reflect on your journey before arriving at the garden..."
            className="leading-relaxed"
          />
        </Field>
      </div>

      {/* Network Alert / Offline Notification */}
      {submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center gap-3 rounded-card border border-destructive/40 bg-destructive/10 p-4 text-small text-destructive text-left"
        >
          <AlertTriangle aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Couldn't record completion</p>
            <p className="text-small text-text-secondary">{submitError}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => handleSubmit(false)}>
            Try again
          </Button>
        </div>
      )}

      {apiStatus === 'offline' && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 text-small text-text-secondary text-left"
        >
          <span className="size-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
          <span>Achivii is offline. Reconnect to complete your journey and arrive at the garden.</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border">
        <Button
          variant="primary"
          size="lg"
          loading={completing}
          disabled={completing || apiStatus === 'offline'}
          onClick={() => handleSubmit(false)}
          trailingIcon={<Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />}
          className="w-full sm:w-auto min-h-12 border-achievement/40 bg-surface-elevated hover:bg-surface text-text hover:border-achievement shadow-lg"
        >
          Complete Journey & Arrive at the Garden
        </Button>

        <Button
          type="button"
          variant="quiet"
          size="sm"
          disabled={completing || apiStatus === 'offline'}
          onClick={() => handleSubmit(true)}
          className="text-text-secondary hover:text-text self-center sm:self-auto min-h-[44px]"
        >
          Arrive without test
        </Button>
      </div>
    </section>
  );
};
