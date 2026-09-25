import React, { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ExternalLink, Play, Sparkles, X } from 'lucide-react';
import type { DailyTask, Goal } from '../../types';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  findNextTask,
  isToday,
  parseIntention,
  parseSteps,
  parseTaskNotes,
  selectTodayTask,
  serializeTaskNotes,
  weekProgress,
} from '../../lib/today';
import { Badge, Button, Field, IconButton, LoadingState, Skeleton, StepMarker, Textarea, cx } from '../ui';
import { FocusSessionModal } from '../FocusSessionModal';
import { useTaskActions } from './useTaskActions';

const NOT_SAVED = "That didn't save. Try again.";

const isHttpUrl = (url?: string | null): boolean => Boolean(url && /^https?:\/\//i.test(url.trim()));

/** Loading: the Today layout in outline (OD-9). */
export const TodaySkeleton: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label="Loading your day">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-8 h-16 w-40" />
      <Skeleton className="mt-8 h-40 w-full" />
    </LoadingState>
  </main>
);

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <p className={cx('font-ui-mono text-micro uppercase text-text-secondary', className)}>{children}</p>
);

/** Set by the auth screens when a pathway was chosen but the user already has a goal (ND-4). */
const PathwayNotice: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathwayNotice = (location.state as { pathwayNotice?: string } | null)?.pathwayNotice;
  if (!pathwayNotice) return null;
  return (
    <div role="status" className="mb-10 flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4">
      <p className="text-small text-text-secondary">
        You already have a journey in progress, so we kept it. You can switch to{' '}
        <span className="font-medium text-text">{pathwayNotice}</span> from Pathways whenever you're ready.
      </p>
      <IconButton
        label="Dismiss"
        className="-my-2 -mr-2"
        icon={<X aria-hidden="true" strokeWidth={1.5} className="size-4" />}
        onClick={() => navigate(location.pathname, { replace: true, state: null })}
      />
    </div>
  );
};

const dayLabel = (task: DailyTask, now: Date) => `${task.dayOfWeek.slice(0, 3)} ${task.date.slice(8)}${isToday(task, now) ? ', today' : ''}`;

const dayState = (task: DailyTask, now: Date) =>
  task.status === 'completed' ? 'done' : task.isRestDay ? 'rest day' : isToday(task, now) ? 'to do' : 'not done';

/** The current week: done, rest, today and the rest, from real task status. Choosing a day shows its step. */
const WeekGlance: React.FC<{ tasks: DailyTask[]; selectedId?: string; now: Date; onSelect: (id: string) => void }> = ({
  tasks,
  selectedId,
  now,
  onSelect,
}) => {
  const { practiceDays, practiceDone } = weekProgress(tasks);
  return (
    <section aria-labelledby="week-heading" className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="week-heading" className="text-body font-medium text-text">
          This week
        </h2>
        <p className="tabular text-small text-text-secondary">
          {practiceDone} of {practiceDays} practice {practiceDays === 1 ? 'day' : 'days'} done
        </p>
      </div>
      <ul className="mt-4 grid grid-cols-7 divide-x divide-border overflow-hidden rounded-card border border-border">
        {tasks.map((task) => {
          const selected = task.id === selectedId;
          const today = isToday(task, now);
          const marker = task.status === 'completed' ? 'completed' : today ? 'active' : 'upcoming';
          return (
            <li key={task.id} className="min-w-0">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${dayLabel(task, now)}, ${dayState(task, now)}`}
                onClick={() => onSelect(task.id)}
                className={cx(
                  'focus-ring-inset flex min-h-16 w-full cursor-pointer flex-col items-center justify-center gap-1.5 py-2',
                  'transition-colors duration-(--duration-quick)',
                  selected ? 'bg-text/[0.08] text-text' : 'text-text-secondary hover:bg-text/[0.04] hover:text-text',
                )}
              >
                <span className={cx('font-ui-mono text-micro uppercase', today && 'text-text')}>{task.dayOfWeek.slice(0, 3)}</span>
                <span className="tabular text-small">{task.date.slice(8)}</span>
                {task.isRestDay && task.status !== 'completed' ? (
                  <span aria-hidden="true" className="flex h-4 items-center text-micro text-text-secondary">
                    Rest
                  </span>
                ) : (
                  <StepMarker state={marker} size="sm" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

interface TodayProps {
  goal: Goal;
}

/**
 * Today for the normal practice day (BP §09): the goal, Day N / 90, today's step, its duration, Start, a glance at
 * the week, the way to the Roadmap. Other OD-9 states render plainly until M5.7 designs them.
 */
export const Today: React.FC<TodayProps> = ({ goal }) => {
  const [now] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string>();
  const [focusOpen, setFocusOpen] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showMinimum, setShowMinimum] = useState(false);
  const [showIntention, setShowIntention] = useState(false);
  const [showResource, setShowResource] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const { toggleComplete, saveNote, finishFocus } = useTaskActions();
  const stepsId = useId();
  const minimumId = useId();
  const intentionId = useId();
  const resourceId = useId();
  const notesId = useId();

  const tasks = currentWeekTasks(goal);
  const task = selectTodayTask(tasks, now, selectedId);
  const steps = parseSteps(task?.detailedSteps);
  const intention = parseIntention(task?.implementationIntention);
  const week = currentRoadmapWeek(goal);
  const day = dayNumber(goal, now);
  const done = task?.status === 'completed';
  const nextTask = task ? findNextTask(tasks, task.id) : null;
  const parsedNotes = parseTaskNotes(task?.notes);
  const focusWins = parsedNotes.focusWins;
  const draft = task ? drafts[task.id] : undefined;
  const freeformValue = draft !== undefined ? draft : parsedNotes.freeformNotes;

  const selectDay = (id: string) => {
    setSelectedId(id);
    setActionError(null);
    setNoteError(null);
  };

  const onToggle = async () => {
    if (!task || busy) return;
    setBusy(true);
    setActionError(null);
    const serializedDraft = draft !== undefined ? serializeTaskNotes(draft, focusWins) : undefined;
    const result = await toggleComplete(task, serializedDraft);
    setBusy(false);
    if (!result.ok) setActionError(NOT_SAVED);
  };

  const onSaveNote = async () => {
    if (!task || draft === undefined || savingNote) return;
    setSavingNote(true);
    setNoteError(null);
    const serialized = serializeTaskNotes(draft, focusWins);
    const result = await saveNote(task, serialized);
    setSavingNote(false);
    if (!result) return;
    if (!result.ok) {
      setNoteError(NOT_SAVED);
      return;
    }
    setNoteSaved(true);
    window.setTimeout(() => setNoteSaved(false), 2000);
  };

  const onFinishFocus = async (reflection?: string) => {
    if (!task) return;
    setActionError(null);
    const result = await finishFocus(task, reflection);
    if (!result.ok) {
      setActionError(NOT_SAVED);
      throw result.error;
    }
  };

  return (
    <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 text-left sm:py-14">
      <PathwayNotice />

      <header>
        <Eyebrow>Your goal</Eyebrow>
        <h1 className="mt-3 break-words text-h2 text-text">{goal.rawGoal}</h1>
        {goal.clarifiedOutcome?.trim() && (
          <p className="mt-3 break-words text-small text-text-secondary">
            <span className="font-medium">90-day outcome: </span>
            {goal.clarifiedOutcome}
          </p>
        )}
      </header>

      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-2">
        <p aria-label={`Day ${day} of 90`} className="flex items-baseline gap-2">
          <span className="tabular text-numeral text-text">{day}</span>
          <span className="tabular text-h3 text-text-secondary">/ 90</span>
        </p>
        <p className="pb-2 text-small text-text-secondary">
          <span className="tabular">Week {goal.currentWeek || 1}</span>
          {week?.phase && <> · {week.phase}</>}
          {week?.theme && <> · {week.theme}</>}
        </p>
      </div>

      <section
        aria-labelledby="step-heading"
        className={cx(
          'mt-10 rounded-panel border p-5 sm:p-7 transition-all duration-(--duration-normal)',
          done
            ? 'border-accent/40 bg-surface/95 shadow-sm ring-1 ring-accent/20'
            : 'border-border bg-surface',
        )}
      >
        {task ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow>{isToday(task, now) ? "Today's step" : `${task.dayOfWeek}'s step`}</Eyebrow>
              {done && <StepMarker state="completed" size="sm" />}
              {done && <Badge tone="accent">Done</Badge>}
              {task.isRestDay && <Badge>Rest day</Badge>}
              {task.isKeySession && <Badge>Key session</Badge>}
              {task.isTestDay && <Badge>Test day</Badge>}
            </div>
            <h2 id="step-heading" className="mt-3 break-words text-h3 text-text">
              {task.title}
            </h2>
            <p className="tabular mt-2 text-small text-text-secondary">
              {task.durationMinutes || 30} min{task.slotTime ? ` · at ${task.slotTime}` : ''}
            </p>
            {task.whyToday?.trim() ? (
              <p className="mt-2 text-small text-text-secondary">
                {task.whyToday}
              </p>
            ) : null}

            {done && (
              <div className="mt-3 flex items-center gap-2 text-small font-medium text-accent">
                <Check aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
                <span>Step completed. Deliberate practice logged for today.</span>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => setFocusOpen(true)}
                leadingIcon={<Play aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                className="sm:min-w-44"
              >
                Start
              </Button>
              <Button
                variant="secondary"
                loading={busy}
                onClick={onToggle}
                leadingIcon={done ? <Check aria-hidden="true" strokeWidth={1.5} className="size-4" /> : undefined}
              >
                {done ? 'Mark not done' : 'Mark complete'}
              </Button>
            </div>
            <p role="alert" className="mt-3 text-small text-danger empty:hidden">
              {actionError ?? ''}
            </p>

            {done && (
              <div className="mt-6 rounded-card border border-border bg-background/50 p-4 sm:p-5">
                {nextTask ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-ui-mono text-micro uppercase text-text-secondary">
                        {nextTask.dayNumber === task.dayNumber + 1 ? `Tomorrow · ${nextTask.dayOfWeek}` : `Next practice · ${nextTask.dayOfWeek}`}
                      </span>
                      <span className="tabular font-ui-mono text-micro text-text-secondary">
                        {nextTask.durationMinutes || 30} min
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-small font-medium text-text">
                      {nextTask.title}
                    </h3>
                    {nextTask.whyToday ? (
                      <p className="mt-1 text-small text-text-secondary line-clamp-2">
                        {nextTask.whyToday}
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center justify-end">
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => selectDay(nextTask.id)}
                        trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-3.5" />}
                      >
                        View {nextTask.dayOfWeek}'s step
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-small font-medium text-text">
                        Week {goal.currentWeek || 1} practice complete.
                      </p>
                      <p className="mt-0.5 text-small text-text-secondary">
                        Weekly review ready in the full day view.
                      </p>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link to="/dashboard">Open week review</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {steps.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <Button
                  variant="quiet"
                  size="sm"
                  aria-expanded={showSteps}
                  aria-controls={stepsId}
                  onClick={() => setShowSteps((value) => !value)}
                  trailingIcon={<ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4', showSteps && 'rotate-180')} />}
                  className="-ml-4"
                >
                  {showSteps ? 'Hide the steps' : `Show the ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}
                </Button>
                <ol id={stepsId} hidden={!showSteps} className="mt-3 flex flex-col gap-3">
                  {steps.map((step, index) => (
                    <li key={index} className="rounded-card border border-border p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-small font-medium text-text">
                          <span className="tabular text-text-secondary">{step.stepNumber}.</span> {step.title}
                        </p>
                        {step.durationMinutes ? <span className="tabular shrink-0 text-small text-text-secondary">{step.durationMinutes} min</span> : null}
                      </div>
                      {step.instructions && <p className="mt-2 text-small text-text-secondary">{step.instructions}</p>}
                      {step.timing && (
                        <p className="mt-2 text-small text-text">
                          <span className="text-text-secondary">Timing: </span>
                          {step.timing}
                        </p>
                      )}
                      {step.focusCue && (
                        <p className="mt-2 text-small text-text">
                          <span className="text-text-secondary">Focus: </span>
                          {step.focusCue}
                        </p>
                      )}
                      {step.output && (
                        <p className="mt-2 text-small text-text">
                          <span className="text-text-secondary">Output: </span>
                          {step.output}
                        </p>
                      )}
                      {step.pitfallToAvoid && (
                        <p className="mt-2 text-small text-text">
                          <span className="text-text-secondary">Pitfall: </span>
                          {step.pitfallToAvoid}
                        </p>
                      )}
                      {step.passMark && (
                        <p className="mt-2 text-small text-text">
                          <span className="text-text-secondary">Done when: </span>
                          {step.passMark}
                        </p>
                      )}
                      {step.resourceTitle && (
                        <div className="mt-2 text-small">
                          <span className="text-text-secondary">Resource: </span>
                          {isHttpUrl(step.resourceUrl) ? (
                            <a
                              href={step.resourceUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-text underline hover:text-text"
                            >
                              <span>{step.resourceTitle}</span>
                              <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" />
                            </a>
                          ) : (
                            <span className="font-medium text-text">{step.resourceTitle}</span>
                          )}
                          {step.resourceWhy && <p className="mt-1 text-small text-text-secondary">{step.resourceWhy}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {task.minimumVersion && (
              <div className={cx('border-t border-border pt-4', steps.length > 0 ? 'mt-4' : 'mt-6')}>
                <Button
                  variant="quiet"
                  size="sm"
                  aria-expanded={showMinimum}
                  aria-controls={minimumId}
                  onClick={() => setShowMinimum((value) => !value)}
                  trailingIcon={<ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4', showMinimum && 'rotate-180')} />}
                  className="-ml-4"
                >
                  {showMinimum ? 'Hide the 10-minute version' : 'The 10-minute version'}
                </Button>
                <div id={minimumId} hidden={!showMinimum} className="mt-3 rounded-card border border-border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-small font-medium text-text">{task.minimumVersion.title}</h3>
                    {task.minimumVersion.durationMinutes ? (
                      <span className="tabular shrink-0 text-small text-text-secondary">{task.minimumVersion.durationMinutes} min</span>
                    ) : null}
                  </div>
                  {task.minimumVersion.instructions && (
                    <p className="mt-2 text-small text-text-secondary">{task.minimumVersion.instructions}</p>
                  )}
                  {task.minimumVersion.passMark && (
                    <p className="mt-2 text-small text-text">
                      <span className="text-text-secondary">Done when: </span>
                      {task.minimumVersion.passMark}
                    </p>
                  )}
                </div>
              </div>
            )}

            {intention && (
              <div className={cx('border-t border-border pt-4', steps.length > 0 || task.minimumVersion ? 'mt-4' : 'mt-6')}>
                <Button
                  variant="quiet"
                  size="sm"
                  aria-expanded={showIntention}
                  aria-controls={intentionId}
                  onClick={() => setShowIntention((value) => !value)}
                  trailingIcon={<ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4', showIntention && 'rotate-180')} />}
                  className="-ml-4"
                >
                  {showIntention ? 'Hide implementation intention' : 'Implementation intention'}
                </Button>
                <div id={intentionId} hidden={!showIntention} className="mt-3 rounded-card border border-border p-4">
                  {'raw' in intention ? (
                    <p className="text-small text-text-secondary">{intention.raw}</p>
                  ) : (
                    <dl className="grid grid-cols-1 gap-3 text-small sm:grid-cols-3">
                      {intention.when ? (
                        <div>
                          <dt className="text-micro font-ui-mono uppercase text-text-secondary">When</dt>
                          <dd className="mt-1 text-text">{intention.when}</dd>
                        </div>
                      ) : null}
                      {intention.where ? (
                        <div>
                          <dt className="text-micro font-ui-mono uppercase text-text-secondary">Where</dt>
                          <dd className="mt-1 text-text">{intention.where}</dd>
                        </div>
                      ) : null}
                      {intention.action ? (
                        <div>
                          <dt className="text-micro font-ui-mono uppercase text-text-secondary">Action</dt>
                          <dd className="mt-1 text-text">{intention.action}</dd>
                        </div>
                      ) : null}
                    </dl>
                  )}
                </div>
              </div>
            )}

            {task.resourceTitle && (
              <div
                className={cx(
                  'border-t border-border pt-4',
                  steps.length > 0 || task.minimumVersion || intention ? 'mt-4' : 'mt-6',
                )}
              >
                <Button
                  variant="quiet"
                  size="sm"
                  aria-expanded={showResource}
                  aria-controls={resourceId}
                  onClick={() => setShowResource((value) => !value)}
                  trailingIcon={<ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4', showResource && 'rotate-180')} />}
                  className="-ml-4"
                >
                  {showResource ? 'Hide resource' : 'Resource'}
                </Button>
                <div id={resourceId} hidden={!showResource} className="mt-3 rounded-card border border-border p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    {isHttpUrl(task.resourceUrl) ? (
                      <a
                        href={task.resourceUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-text underline hover:text-text"
                      >
                        <span>{task.resourceTitle}</span>
                        <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="font-medium text-text">{task.resourceTitle}</span>
                    )}
                    {task.resourceType && <Badge>{task.resourceType}</Badge>}
                  </div>
                  {task.resourceWhy && <p className="mt-2 text-small text-text-secondary">{task.resourceWhy}</p>}
                </div>
              </div>
            )}

            <div
              className={cx(
                'border-t border-border pt-4',
                steps.length > 0 || task.minimumVersion || intention || task.resourceTitle ? 'mt-4' : 'mt-6',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="quiet"
                  size="sm"
                  aria-expanded={showNotes}
                  aria-controls={notesId}
                  onClick={() => setShowNotes((value) => !value)}
                  trailingIcon={<ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4', showNotes && 'rotate-180')} />}
                  className="-ml-4"
                >
                  Notes
                </Button>
                <p role="status" className="text-small text-text-secondary">
                  {noteSaved ? 'Saved' : ''}
                </p>
              </div>
              <div id={notesId} hidden={!showNotes} className="mt-3">
                {focusWins.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <span className="font-ui-mono text-micro uppercase text-text-secondary block">
                      Focus wins logged
                    </span>
                    <ul className="space-y-2">
                      {focusWins.map((win, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 rounded-card border border-border bg-background p-3 text-small text-text"
                        >
                          <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-accent mt-0.5" />
                          <span>{win}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Field label="Notes for this step" error={noteError ?? undefined}>
                  <Textarea
                    rows={3}
                    value={freeformValue}
                    placeholder="Reps, times, what felt hard, what clicked."
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [task.id]: event.target.value }))}
                    onBlur={onSaveNote}
                  />
                </Field>
                <div className="mt-3 flex justify-end">
                  <Button variant="secondary" size="sm" loading={savingNote} onClick={onSaveNote}>
                    Save note
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <Eyebrow>Today's step</Eyebrow>
            <h2 id="step-heading" className="mt-3 text-h3 text-text">
              No step is planned for this week yet.
            </h2>
          </>
        )}
      </section>

      {tasks.length > 0 && <WeekGlance tasks={tasks} selectedId={task?.id} now={now} onSelect={selectDay} />}

      <nav aria-label="More of your plan" className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild variant="secondary" trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
          <Link to="/roadmap">Roadmap</Link>
        </Button>
        <Button asChild variant="quiet">
          <Link to="/dashboard">Open full day view</Link>
        </Button>
      </nav>
      <p className="mt-3 text-small text-text-secondary">
        The full day view shows the week review, plan panel and routine visualiser when your plan has them.
      </p>

      {task && (
        <FocusSessionModal
          task={task}
          dayNumber={task.dayNumber}
          isOpen={focusOpen}
          onClose={() => setFocusOpen(false)}
          onCompleteSession={onFinishFocus}
        />
      )}
    </main>
  );
};

