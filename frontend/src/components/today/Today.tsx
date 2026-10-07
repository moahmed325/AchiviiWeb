import React, { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Clock, ExternalLink, Flag, Map as MapIcon, Play, X } from 'lucide-react';
import type { DailyTask, Goal } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { formatPassIf } from '../../lib/formatters';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  findNextTask,
  isToday,
  isWeekReviewDue,
  isClosingStretchActive,
  missNotice,
  shortOnTimeOffer,
  parseIntention,
  parseSteps,
  parseTaskNotes,
  selectTodayTask,
  serializeTaskNotes,
  weekProgress,
  type MissNotice,
} from '../../lib/today';
import { Badge, Button, Field, IconButton, LoadingState, Skeleton, StepMarker, Textarea, cx } from '../ui';
import { FocusSessionModal, type FocusCompletionOptions } from '../FocusSessionModal';
import { BasisBadge } from '../BasisBadge';
import { WeeklyReviewModal } from '../review';
import { ClosingStretchView } from './ClosingStretchView';
import { LateTestCard } from './LateTestCard';
import { useAuth } from '../../context/AuthContext';
import { useTaskActions } from './useTaskActions';

const NOT_SAVED = "That didn't save. Please check your connection and try again.";

const isHttpUrl = (url?: string | null): boolean => Boolean(url && /^https?:\/\//i.test(url.trim()));

const stagger = (ms: number): React.CSSProperties => ({ animationDelay: `${ms}ms` });

/** Loading: the Today layout in outline (OD-9). */
export const TodaySkeleton: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label="Loading your day">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="mt-8 h-24 w-48" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="mt-8 h-72 w-full" />
    </LoadingState>
  </main>
);

/** A mono label. Gold marks the places where the journey speaks; the rest stay quiet. */
const Eyebrow: React.FC<{ children: React.ReactNode; gold?: boolean; className?: string }> = ({ children, gold, className }) => (
  <p className={cx('font-ui-mono text-micro uppercase', gold ? 'text-achievement' : 'text-text-secondary', className)}>{children}</p>
);

/** A labelled line of step detail. Empty values are never passed in, so no stray labels. */
const Line: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <p className="mt-2 text-small text-text">
    <span className="text-text-secondary">{label}: </span>
    {children}
  </p>
);

/** A guidance note: a thin gold rule and quiet copy, never an alarm. */
const Callout: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="mt-6 flex items-start gap-3 border-l-2 border-achievement/50 py-0.5 pl-4">
    {icon}
    <div className="min-w-0 text-small text-text-secondary">{children}</div>
  </div>
);

/** The one line about a day that didn't happen (missed sessions M3.1, M3.2; Feature Definition section 12). */
const missNoticeLine = (notice: MissNotice) =>
  notice.kind === 'gentle_return'
    ? "Welcome back. Today's a short one to ease in."
    : notice.kind === 'dropped'
    ? `${notice.day}'s session didn't happen. Nothing needs making up: the plan carries on as it is.`
    : notice.intoToday
      ? `${notice.day}'s session didn't happen. We moved its most important step into today, so today stays the same length.`
      : `${notice.day}'s session didn't happen. We moved its most important step to ${notice.toWeekday}, so that day stays the same length.`;

/** One quiet row that opens on demand. The panel stays in the document, hidden, so the button can name it. */
const Disclosure: React.FC<{ id: string; open: boolean; label: string; onToggle: () => void; children: React.ReactNode }> = ({
  id,
  open,
  label,
  onToggle,
  children,
}) => (
  <div className="border-b border-border">
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
      className={cx(
        'focus-ring flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-control text-left text-small font-medium',
        'transition-colors duration-(--duration-quick)',
        open ? 'text-text' : 'text-text-secondary hover:text-text',
      )}
    >
      {label}
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.5}
        className={cx('size-4 shrink-0 text-achievement transition-transform duration-(--duration-base) ease-ascend', open && 'rotate-180')}
      />
    </button>
    <div id={id} hidden={!open} className="pb-5">
      {children}
    </div>
  </div>
);

/** Set by the auth screens when a pathway was chosen but the user already has a goal (ND-4). */
const PathwayNotice: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathwayNotice = (location.state as { pathwayNotice?: string } | null)?.pathwayNotice;
  if (!pathwayNotice) return null;
  return (
    <div role="status" className="relative mb-10 flex items-start justify-between gap-3 rounded-card border border-border bg-surface p-4">
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

const dayLabel = (task: DailyTask, now: Date, timezone?: string) => `${task.dayOfWeek.slice(0, 3)} ${task.date.slice(8)}${isToday(task, now, timezone) ? ', today' : ''}`;

const dayState = (task: DailyTask, now: Date, timezone?: string) =>
  task.status === 'completed' ? 'done' : task.isRestDay ? 'rest day' : isToday(task, now, timezone) ? 'to do' : 'not done';

/** Which `dash-day` mark a day gets. Shape carries the state as well as colour. */
const markState = (task: DailyTask, now: Date, timezone?: string) =>
  task.status === 'completed' ? 'completed' : task.isRestDay ? 'rest' : isToday(task, now, timezone) ? 'today' : 'upcoming';

const DayMark: React.FC<{ task: DailyTask; now: Date; timezone?: string }> = ({ task, now, timezone }) => {
  const state = markState(task, now, timezone);
  return (
    <span className="dash-day" data-state={state}>
      {state === 'completed' && <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
    </span>
  );
};

/** The current week: done, rest, today and the rest, from real task status. Choosing a day shows its step. */
const WeekGlance: React.FC<{
  tasks: DailyTask[];
  selectedId?: string;
  now: Date;
  timezone?: string;
  onSelect: (id: string) => void;
  onOpenReview: () => void;
}> = ({ tasks, selectedId, now, timezone, onSelect, onOpenReview }) => {
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const [showWeek, setShowWeek] = useState(false);
  return (
    <section aria-labelledby="week-heading" className="dash-panel animate-rise-in relative mt-10 p-6 sm:p-8" style={stagger(240)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="week-heading" className="font-ui-mono text-micro uppercase text-text-secondary">
            This week
          </h2>
          <p className="tabular mt-3 text-body text-text">
            {practiceDone} of {practiceDays} practice {practiceDays === 1 ? 'day' : 'days'} done
          </p>
        </div>
        <div className="-mr-3 flex items-center">
          <Button type="button" variant="quiet" size="sm" onClick={onOpenReview}>
            Review week
          </Button>
          <Button
            type="button"
            variant="quiet"
            size="sm"
            aria-expanded={showWeek}
            aria-controls="week-glance-days"
            onClick={() => setShowWeek((value) => !value)}
          >
            {showWeek ? 'Hide week' : 'Show week'}
          </Button>
        </div>
      </div>

      {!showWeek && (
        <ol aria-hidden="true" className="mt-7 flex items-start justify-between gap-1">
          {tasks.map((task) => (
            <li key={task.id} className="flex flex-col items-center gap-2">
              <DayMark task={task} now={now} timezone={timezone} />
              <span className="font-ui-mono text-micro uppercase text-text-secondary">{task.dayOfWeek.slice(0, 3)}</span>
            </li>
          ))}
        </ol>
      )}

      <ul id="week-glance-days" hidden={!showWeek} className="mt-6 grid grid-cols-7 gap-1">
        {tasks.map((task) => {
          const selected = task.id === selectedId;
          const today = isToday(task, now, timezone);
          return (
            <li key={task.id} className="min-w-0">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${dayLabel(task, now, timezone)}, ${dayState(task, now, timezone)}`}
                onClick={() => onSelect(task.id)}
                className={cx(
                  'focus-ring flex min-h-20 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-control py-2',
                  'transition-colors duration-(--duration-quick)',
                  selected ? 'bg-achievement/[0.09] text-text' : 'text-text-secondary hover:bg-text/[0.05] hover:text-text',
                )}
              >
                <span className={cx('font-ui-mono text-micro uppercase', today && 'text-achievement')}>{task.dayOfWeek.slice(0, 3)}</span>
                <DayMark task={task} now={now} timezone={timezone} />
                <span className="tabular text-small">{task.date.slice(8)}</span>
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
  apiStatus?: 'online' | 'offline' | 'checking';
}

/**
 * Today for the normal practice day and all OD-9 states (BP §09, BP §18, OD-9):
 * the goal, Day N / 90, today's step or rest day, test day benchmarks, key sessions,
 * recovery guidance, review due prompts, and honest clamped 90-day completion.
 *
 * The look is the Dashboard's: one lit surface (the step), gold for the journey and for arrival, quiet everywhere else.
 */
export const Today: React.FC<TodayProps> = ({ goal, apiStatus: propApiStatus }) => {
  const { token, user } = useAuth();
  const timezone = user?.timezone;
  const goalContext = useGoal();
  const apiStatus = propApiStatus ?? goalContext.apiStatus;
  const [now] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string>();
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusStart, setFocusStart] = useState<'full' | 'minimum'>('full');
  const [reviewOpen, setReviewOpen] = useState(false);
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
  const task = selectTodayTask(tasks, now, selectedId, timezone);
  const steps = parseSteps(task?.detailedSteps);
  const intention = parseIntention(task?.implementationIntention);
  const week = currentRoadmapWeek(goal);
  const day = dayNumber(goal, now, timezone);
  const journeyPercent = Math.min(100, Math.max(2, Math.round((day / 90) * 100)));
  const done = task?.status === 'completed';
  const nextTask = task ? findNextTask(tasks, task.id) : null;
  const parsedNotes = parseTaskNotes(task?.notes);
  const focusWins = parsedNotes.focusWins;
  const draft = task ? drafts[task.id] : undefined;
  const freeformValue = draft !== undefined ? draft : parsedNotes.freeformNotes;
  const reviewDue = isWeekReviewDue(tasks, now, timezone);
  const isClosingStretch = isClosingStretchActive(goal, now, timezone);
  // The miss notice belongs to Today's view of today only, never to another selected day (M3.1 R4).
  const viewingToday = Boolean(task && isToday(task, now, timezone));
  const notice = viewingToday ? missNotice(goalContext.reconciliation, goal, now, timezone) : null;
  // M3.2: on a gentle-return day the 10-minute version is the default; when short on time it is one tap away.
  const gentleReturn = notice?.kind === 'gentle_return';
  const shortOnTime = viewingToday && !gentleReturn && shortOnTimeOffer(goalContext.reconciliation, goal, now, timezone);
  const openFocus = (startWith: 'full' | 'minimum') => {
    setFocusStart(startWith);
    setFocusOpen(true);
  };

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

  const onFinishFocus = async (reflection?: string, options?: FocusCompletionOptions) => {
    if (!task) return;
    setActionError(null);
    const result = await finishFocus(task, reflection, options?.usedMinimumVersion);
    if (!result.ok) {
      setActionError(NOT_SAVED);
      throw result.error;
    }
  };

  return (
    <main id="main" className="ui-root relative mx-auto w-full max-w-3xl flex-1 px-gutter py-10 text-left sm:py-14">
      <div aria-hidden="true" className="dash-glow" />
      <PathwayNotice />

      {apiStatus === 'offline' && (
        <div
          role="status"
          className="relative mb-8 flex items-center gap-3 rounded-card border border-caution/35 bg-caution/[0.06] p-4 text-small text-text"
        >
          <span className="size-2 shrink-0 rounded-full bg-caution" aria-hidden="true" />
          <span>Achivii is offline. You can view your plan, but changes cannot be saved until you reconnect.</span>
        </div>
      )}

      <header className="animate-rise-in relative" style={stagger(0)}>
        <Eyebrow gold>
          <span className="tabular">{isClosingStretch ? 'Days 85–90 · Closing Stretch' : `Week ${goal.currentWeek || 1}`}</span>
          {week?.phase && <> · {week.phase}</>}
          {week?.theme && <> · {week.theme}</>}
        </Eyebrow>
        <h1 className="mt-5 max-w-2xl break-words text-h2 text-text">{goal.rawGoal}</h1>
        {goal.clarifiedOutcome?.trim() && (
          <p className="mt-3 max-w-2xl break-words text-body text-text-secondary">
            <span className="font-medium text-text">90-day outcome: </span>
            {goal.clarifiedOutcome}
          </p>
        )}
        {goal.basis?.label && (
          <div className="mt-4">
            <BasisBadge basis={goal.basis} />
          </div>
        )}

        <div className="mt-12">
          <p aria-label={`Day ${day} of 90`} className="flex items-baseline gap-3">
            <span className="today-numeral tabular text-numeral text-text">{day}</span>
            <span className="tabular text-h3 text-text-secondary">/ 90</span>
          </p>
          <div aria-hidden="true" className="mt-6">
            <div className="dash-journey" style={{ '--dash-progress': `${journeyPercent}%` } as React.CSSProperties}>
              <div className="dash-journey__fill" />
            </div>
            <div className="mt-4 flex items-center justify-between font-ui-mono text-micro uppercase">
              <span className="text-text-secondary">Day 1</span>
              <span className="inline-flex items-center gap-2 text-achievement">
                <StepMarker state="destination" size="sm" />
                Day 90
              </span>
            </div>
          </div>
        </div>
      </header>

      {reviewDue && (
        <section
          aria-labelledby="review-due-heading"
          className="dash-panel animate-rise-in relative mt-10 border-achievement/35 p-6 sm:p-8"
          style={stagger(120)}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Badge tone="achievement">Review due</Badge>
              <h2 id="review-due-heading" className="mt-3 text-h3 text-text">
                Week {goal.currentWeek || 1} is ready for review
              </h2>
              <p className="mt-2 max-w-md text-small text-text-secondary">
                {goal.currentWeek && goal.currentWeek >= 12
                  ? "You've reached the end of Week 12. Complete this review to unlock your final closing stretch (days 85–90)."
                  : "You've reached the end of this week's scheduled practice. Reflect on your progress and adapt next week's path."}
              </p>
            </div>
            <Button type="button" variant="primary" className="shrink-0 sm:min-w-44" onClick={() => setReviewOpen(true)}>
              Start weekly review
            </Button>
          </div>
        </section>
      )}

      {/* Missed sessions M4.1: the week's test, still open after test day (self-contained). */}
      <LateTestCard goal={goal} now={now} timezone={timezone} />

      {isClosingStretch ? (
        <ClosingStretchView goal={goal} apiStatus={apiStatus} />
      ) : (
        <section
          aria-labelledby="step-heading"
          className={cx('dash-card animate-rise-in relative mt-10 p-6 sm:p-10', done && 'today-done')}
          style={stagger(160)}
        >
          {task ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow gold className="mr-1">
                  {task.isRestDay
                    ? isToday(task, now, timezone)
                      ? "Today's rest"
                      : `${task.dayOfWeek}'s rest`
                    : isToday(task, now, timezone)
                      ? "Today's step"
                      : `${task.dayOfWeek}'s step`}
                </Eyebrow>
                {done && (
                  <Badge tone="achievement" icon={<Check aria-hidden="true" strokeWidth={2} className="size-3" />}>
                    {task.isRestDay ? 'Rest logged' : 'Done'}
                  </Badge>
                )}
                {task.isRestDay && !done && <Badge>Rest day</Badge>}
                {task.isKeySession && <Badge tone="achievement">Key session</Badge>}
                {task.isTestDay && <Badge tone="achievement">Test day</Badge>}
              </div>

              <h2 id="step-heading" className="mt-6 max-w-[24ch] break-words text-h2 text-text">
                {task.title}
              </h2>
              <p className="tabular mt-4 inline-flex items-center gap-2 text-small text-text-secondary">
                <Clock aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-achievement" />
                {task.durationMinutes || 30} min{task.slotTime ? ` · at ${task.slotTime}` : ''}
              </p>
              {task.isRestDay && (
                <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">
                  Rest is where adaptation happens. Take today to recover so you can execute your next session at full intensity.
                </p>
              )}
              {task.whyToday?.trim() ? <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">{task.whyToday}</p> : null}

              {notice && (
                <Callout>
                  <p className="text-text">{missNoticeLine(notice)}</p>
                </Callout>
              )}

              {task.isKeySession && (
                <Callout icon={<Flag aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-achievement" />}>
                  <span className="text-text">
                    This is your pivotal session for Week {goal.currentWeek || 1}. Focus on execution quality and adherence.
                  </span>
                </Callout>
              )}

              {task.isTestDay && (
                <div className="mt-6 rounded-card border border-border bg-background/50 p-5">
                  <h3 className="font-ui-mono text-micro uppercase text-achievement">
                    {week?.test?.type ? `${week.test.type} Benchmark` : 'Weekly Benchmark'}
                  </h3>
                  {week?.test?.instructions && <p className="mt-3 text-small text-text-secondary">{week.test.instructions}</p>}
                  {week?.test?.passIf && (
                    <p className="mt-3 text-small text-text">
                      <span className="font-medium">Pass mark: </span>
                      <span className="text-text-secondary">{formatPassIf(week.test.passIf)}</span>
                    </p>
                  )}
                </div>
              )}

              {done && (
                <p className="mt-6 flex items-center gap-2 text-small font-medium text-achievement">
                  <Check aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
                  {task.isRestDay ? 'Rest logged. Deliberate recovery recorded for today.' : 'Step completed. Deliberate practice logged for today.'}
                </p>
              )}

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {gentleReturn ? (
                  <>
                    <Button
                      variant="gold"
                      size="lg"
                      onClick={() => openFocus('minimum')}
                      leadingIcon={<Play aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                      className="w-full sm:w-auto sm:min-w-44"
                    >
                      Start the 10-minute version
                    </Button>
                    <Button variant="secondary" onClick={() => openFocus('full')} className="w-full sm:w-auto">
                      Start the full session
                    </Button>
                  </>
                ) : (
                  !task.isRestDay && (
                    <Button
                      variant={done ? 'secondary' : 'gold'}
                      size="lg"
                      onClick={() => openFocus('full')}
                      leadingIcon={<Play aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                      className="w-full sm:w-auto sm:min-w-44"
                    >
                      Start
                    </Button>
                  )
                )}
                {shortOnTime && (
                  <Button variant="secondary" onClick={() => openFocus('minimum')} className="w-full sm:w-auto">
                    Start the 10-minute version
                  </Button>
                )}
                <Button
                  variant={task.isRestDay && !done ? 'primary' : 'secondary'}
                  size={task.isRestDay ? 'lg' : 'md'}
                  loading={busy}
                  onClick={onToggle}
                  leadingIcon={done ? <Check aria-hidden="true" strokeWidth={1.5} className="size-4" /> : undefined}
                  className="w-full sm:w-auto"
                >
                  {done ? 'Mark not done' : task.isRestDay ? 'Log recovery complete' : 'Mark complete'}
                </Button>
              </div>
              {shortOnTime && <p className="mt-3 text-small text-text-secondary">The 10-minute version still counts toward this week.</p>}
              <p role="alert" className="mt-3 text-small text-danger empty:hidden">
                {actionError ?? ''}
              </p>

              {(done || task.isRestDay) && (
                <div className="mt-8 rounded-card border border-border bg-background/50 p-5">
                  {nextTask ? (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-ui-mono text-micro uppercase text-achievement">
                          {nextTask.dayNumber === task.dayNumber + 1 ? `Tomorrow · ${nextTask.dayOfWeek}` : `Next practice · ${nextTask.dayOfWeek}`}
                        </span>
                        <span className="tabular font-ui-mono text-micro text-text-secondary">{nextTask.durationMinutes || 30} min</span>
                      </div>
                      <h3 className="mt-2 text-body font-medium text-text">{nextTask.title}</h3>
                      {nextTask.whyToday ? <p className="mt-1 line-clamp-2 text-small text-text-secondary">{nextTask.whyToday}</p> : null}
                      <div className="-mb-2 mt-3 flex items-center justify-end">
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-small font-medium text-text">Week {goal.currentWeek || 1} practice complete.</p>
                        <p className="mt-0.5 text-small text-text-secondary">Weekly review ready.</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={() => setReviewOpen(true)}>
                        Start weekly review
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-9 border-t border-border">
                {steps.length > 0 && (
                  <Disclosure
                    id={stepsId}
                    open={showSteps}
                    onToggle={() => setShowSteps((value) => !value)}
                    label={showSteps ? 'Hide the steps' : `Show the ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}
                  >
                    <ol className="flex flex-col gap-3">
                      {steps.map((step, index) => (
                        <li key={index} className="rounded-card border border-border bg-background/40 p-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-small font-medium text-text">
                              <span className="tabular text-achievement">{step.stepNumber}.</span> {step.title}
                            </p>
                            {step.durationMinutes ? <span className="tabular shrink-0 text-small text-text-secondary">{step.durationMinutes} min</span> : null}
                          </div>
                          {step.instructions && <p className="mt-2 text-small text-text-secondary">{step.instructions}</p>}
                          {step.timing && <Line label="Timing">{step.timing}</Line>}
                          {step.focusCue && <Line label="Focus">{step.focusCue}</Line>}
                          {step.output && <Line label="Output">{step.output}</Line>}
                          {step.pitfallToAvoid && <Line label="Pitfall">{step.pitfallToAvoid}</Line>}
                          {step.passMark && <Line label="Done when">{step.passMark}</Line>}
                          {step.resourceTitle && (
                            <div className="mt-2 text-small">
                              <span className="text-text-secondary">Resource: </span>
                              {isHttpUrl(step.resourceUrl) ? (
                                <a
                                  href={step.resourceUrl!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="focus-ring inline-flex items-center gap-1 rounded-block font-medium text-text underline decoration-achievement/50 underline-offset-4 hover:decoration-achievement"
                                >
                                  <span>{step.resourceTitle}</span>
                                  <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-achievement" />
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
                  </Disclosure>
                )}

                {task.minimumVersion && (
                  <Disclosure
                    id={minimumId}
                    open={showMinimum}
                    onToggle={() => setShowMinimum((value) => !value)}
                    label={showMinimum ? 'Hide the 10-minute version' : 'The 10-minute version'}
                  >
                    <div className="rounded-card border border-border bg-background/40 p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-small font-medium text-text">{task.minimumVersion.title}</h3>
                        {task.minimumVersion.durationMinutes ? (
                          <span className="tabular shrink-0 text-small text-text-secondary">{task.minimumVersion.durationMinutes} min</span>
                        ) : null}
                      </div>
                      {task.minimumVersion.instructions && <p className="mt-2 text-small text-text-secondary">{task.minimumVersion.instructions}</p>}
                      {task.minimumVersion.passMark && <Line label="Done when">{task.minimumVersion.passMark}</Line>}
                    </div>
                  </Disclosure>
                )}

                {intention && (
                  <Disclosure
                    id={intentionId}
                    open={showIntention}
                    onToggle={() => setShowIntention((value) => !value)}
                    label={showIntention ? 'Hide implementation intention' : 'Implementation intention'}
                  >
                    <div className="rounded-card border border-border bg-background/40 p-4">
                      {'raw' in intention ? (
                        <p className="text-small text-text-secondary">{intention.raw}</p>
                      ) : (
                        <dl className="grid grid-cols-1 gap-4 text-small sm:grid-cols-3">
                          {intention.when ? (
                            <div>
                              <dt className="font-ui-mono text-micro uppercase text-achievement">When</dt>
                              <dd className="mt-1 text-text">{intention.when}</dd>
                            </div>
                          ) : null}
                          {intention.where ? (
                            <div>
                              <dt className="font-ui-mono text-micro uppercase text-achievement">Where</dt>
                              <dd className="mt-1 text-text">{intention.where}</dd>
                            </div>
                          ) : null}
                          {intention.action ? (
                            <div>
                              <dt className="font-ui-mono text-micro uppercase text-achievement">Action</dt>
                              <dd className="mt-1 text-text">{intention.action}</dd>
                            </div>
                          ) : null}
                        </dl>
                      )}
                    </div>
                  </Disclosure>
                )}

                {task.resourceTitle && (
                  <Disclosure
                    id={resourceId}
                    open={showResource}
                    onToggle={() => setShowResource((value) => !value)}
                    label={showResource ? 'Hide resource' : 'Resource'}
                  >
                    <div className="rounded-card border border-border bg-background/40 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        {isHttpUrl(task.resourceUrl) ? (
                          <a
                            href={task.resourceUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focus-ring inline-flex items-center gap-1 rounded-block font-medium text-text underline decoration-achievement/50 underline-offset-4 hover:decoration-achievement"
                          >
                            <span>{task.resourceTitle}</span>
                            <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-achievement" />
                          </a>
                        ) : (
                          <span className="font-medium text-text">{task.resourceTitle}</span>
                        )}
                        {task.resourceType && <Badge>{task.resourceType}</Badge>}
                      </div>
                      {task.resourceWhy && <p className="mt-2 text-small text-text-secondary">{task.resourceWhy}</p>}
                    </div>
                  </Disclosure>
                )}

                <Disclosure id={notesId} open={showNotes} onToggle={() => setShowNotes((value) => !value)} label="Notes">
                  {focusWins.length > 0 && (
                    <div className="mb-5">
                      <span className="block font-ui-mono text-micro uppercase text-text-secondary">Focus wins logged</span>
                      <ul className="mt-3 space-y-2">
                        {focusWins.map((win, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 rounded-card border border-border bg-background/40 p-3 text-small text-text">
                            <Check aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-achievement" />
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
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <p role="status" className="text-small text-text-secondary">
                      {noteSaved ? 'Saved' : ''}
                    </p>
                    <Button variant="secondary" size="sm" loading={savingNote} onClick={onSaveNote}>
                      Save note
                    </Button>
                  </div>
                </Disclosure>
              </div>
            </>
          ) : (
            <>
              <Eyebrow gold>Today's step</Eyebrow>
              <h2 id="step-heading" className="mt-5 text-h3 text-text">
                No step is planned for this week yet.
              </h2>
              <p className="mt-3 text-small text-text-secondary">Your next session will appear here when it is ready.</p>
            </>
          )}
        </section>
      )}

      {!isClosingStretch && tasks.length > 0 && (
        <WeekGlance tasks={tasks} selectedId={task?.id} now={now} timezone={timezone} onSelect={selectDay} onOpenReview={() => setReviewOpen(true)} />
      )}

      <nav
        aria-label="More of your plan"
        className="animate-rise-in relative mt-10 flex flex-wrap gap-x-2 gap-y-1 border-t border-border pt-6"
        style={stagger(320)}
      >
        <Button asChild variant="quiet" size="sm" leadingIcon={<MapIcon aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />}>
          <Link to="/roadmap">Roadmap</Link>
        </Button>
        <Button type="button" variant="quiet" size="sm" onClick={() => setReviewOpen(true)}>
          Weekly review
        </Button>
      </nav>

      {task && (
        <FocusSessionModal
          task={task}
          dayNumber={task.dayNumber}
          isOpen={focusOpen}
          onClose={() => setFocusOpen(false)}
          onCompleteSession={onFinishFocus}
          startWith={focusStart}
        />
      )}

      <WeeklyReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        goal={goal}
        token={token || ''}
        onGoalUpdated={goalContext.updateActiveGoal}
        apiStatus={apiStatus}
      />
    </main>
  );
};
