import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Compass, Sparkles } from 'lucide-react';
import type { Goal, GoalCompletionPayload } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { useUserTimezone } from '../../context/AuthContext';
import { dayNumber, isRestLike } from '../../lib/today';
import { lastDaysLine } from '../../lib/fixedDate';
import { closingStartDay, planDays, planLengthLabel, planWeeks } from '../../lib/planLength';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { cx } from '../ui/cx';

export interface ClosingStretchViewProps {
  goal: Goal;
  apiStatus?: 'online' | 'offline' | 'checking';
  onComplete?: (completedGoal: Goal) => void;
}

const STORAGE_KEY_PREFIX = 'achivii_closing_reflection_';

/** B-109: the closing stretch's grid, one column per day (a shorter plan may have 1 to 6). */
const GRID_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

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
 * Terminal deliberate practice state in Today. The 84 planned practice days are complete. No weekly tests
 * (2026-10-30): no final test; the days after the last week are for looking back (what they did, a reflection) and
 * arriving.
 */
export const ClosingStretchView: React.FC<ClosingStretchViewProps> = ({
  goal,
  apiStatus = 'online',
  onComplete,
}) => {
  const { completeGoal } = useGoal();
  const timezone = useUserTimezone();
  const [now] = useState(() => new Date());
  const currentDay = dayNumber(goal, now, timezone);

  const storageKey = `${STORAGE_KEY_PREFIX}${goal.id}`;

  const [reflection, setReflection] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  });

  const [completing, setCompleting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reflectionFieldId = useId();

  const summitGoal = goal.roadmap?.finalGoal || goal.clarifiedOutcome || goal.rawGoal;
  // What they did: practice sessions done of those planned (rest days and days not offered left out).
  const practice = (goal.dailyTasks ?? []).filter((task) => !isRestLike(task));
  const sessionsDone = practice.filter((task) => task.status === 'completed').length;

  const handleReflectionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setReflection(val);
    try {
      localStorage.setItem(storageKey, val);
    } catch {
      // Storage unavailable
    }
  };

  const handleSubmit = async () => {
    if (completing || apiStatus === 'offline') return;
    setCompleting(true);
    setSubmitError(null);

    const payload: GoalCompletionPayload = { finalReflection: reflection.trim() || undefined };

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

  // 6-day closing stretch approach steps: Days 85 to 90. B-109: a shorter plan's days after its last week (0 to 6).
  const lastDay = planDays(goal);
  const firstDay = closingStartDay(goal);
  const closingDays = Array.from({ length: Math.max(0, lastDay - firstDay + 1) }, (_, index) => firstDay + index);
  const shortPlan = planWeeks(goal) !== 12;
  const restLine = lastDaysLine(goal, now, timezone);

  return (
    <section
      aria-labelledby="closing-stretch-heading"
      className="mt-10 rounded-panel border border-achievement/30 bg-surface p-6 sm:p-8 space-y-8 shadow-sm ring-1 ring-achievement/10"
    >
      {/* Eyebrow & Headline */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow className="text-achievement">
            {closingDays.length > 0 ? `DAYS ${firstDay}–${lastDay} · ` : ''}THE CLOSING STRETCH
          </Eyebrow>
          <Button
            asChild
            variant="quiet"
            size="sm"
            trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            className="text-text-secondary hover:text-text"
          >
            <Link to="/roadmap">Review {planLengthLabel(goal)} staircase</Link>
          </Button>
        </div>
        <h2 id="closing-stretch-heading" className="mt-3 text-h2 font-semibold text-text">
          Look back and arrive
        </h2>
        <p className="mt-2 text-body text-text-secondary max-w-2xl leading-relaxed">
          {shortPlan
            ? `The ${firstDay - 1} planned practice days are complete. Look back on your ${planLengthLabel(goal)} journey and arrive at your date rested.`
            : 'The 84 planned practice days are complete. These final days are for looking back on your 90-day journey and arriving at your goal.'}
        </p>
        {/* B-109: a shorter plan's last days before the date (Mo, choice d). */}
        {restLine && <p className="mt-3 text-body text-text">{restLine}</p>}
      </div>

      {/* 6-Day Approach Progress Indicator */}
      {closingDays.length > 0 && <div className="rounded-card border border-border bg-surface-elevated/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
            Closing Stretch Approach
          </span>
          <span className="font-ui-mono text-micro text-achievement">
            Day {currentDay} of {lastDay}
          </span>
        </div>
        <div className={cx('grid gap-2 text-center', GRID_COLUMNS[closingDays.length] ?? 'grid-cols-6')}>
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
                    : 'border-border/60 bg-surface/40 text-text-secondary'
                )}
              >
                <div className="font-ui-mono text-micro uppercase">
                  {d === lastDay ? 'Summit ✦' : `Day ${d}`}
                </div>
                <div className="mt-1 text-micro text-text-secondary">
                  {d === lastDay ? 'Arrival' : isDone ? 'Done' : isCurrent ? 'Today' : 'Ahead'}
                </div>
              </div>
            );
          })}
        </div>
      </div>}

      {/* What they did, and the goal they worked toward. */}
      <div className="rounded-card border border-border bg-surface-elevated/70 p-5 sm:p-6 space-y-4 text-left">
        {practice.length > 0 && (
          <div>
            <Eyebrow>What you did</Eyebrow>
            <p className="mt-2 text-h3 text-text tabular">
              {sessionsDone} of {practice.length} sessions
            </p>
          </div>
        )}
        {summitGoal && (
          <div className="flex items-start gap-2 rounded-control border border-achievement/20 bg-achievement/5 p-3 text-small text-text">
            <Compass aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-text-secondary">Your goal: </span>
              <span className="text-text">{summitGoal}</span>
            </div>
          </div>
        )}
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
          <Button variant="secondary" size="sm" onClick={() => handleSubmit()}>
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
          onClick={() => handleSubmit()}
          trailingIcon={<Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />}
          className="w-full sm:w-auto min-h-12 border-achievement/40 bg-surface-elevated hover:bg-surface text-text hover:border-achievement shadow-lg"
        >
          Complete my journey
        </Button>

      </div>
    </section>
  );
};
