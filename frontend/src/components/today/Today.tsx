import React, { useEffect, useId, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Clock, ExternalLink, Flag, Play, X } from 'lucide-react';
import type { DailyTask, Goal } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { formatPassIf } from '../../lib/formatters';
import { isLightTest, nextCheckLine } from '../../lib/lightTest';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  findNextTask,
  isAheadDay,
  isToday,
  isWeekReviewDue,
  reviewOpensOn,
  isClosingStretchActive,
  isRestLike,
  missNotice,
  notOfferedAsRest,
  shortOnTimeOffer,
  parseIntention,
  parseTaskNotes,
  selectTodayTask,
  serializeTaskNotes,
  TASK_NOTES_MAX_LENGTH,
  weekProgress,
  type MissNotice,
} from '../../lib/today';
import { Badge, Button, ErrorState, Field, IconButton, LoadingState, Skeleton, Textarea, cx } from '../ui';
import { FocusSessionModal, type FocusCompletionOptions } from '../FocusSessionModal';
import type { SessionProgress } from '../focus/FocusCompletion';
import { BasisBadge } from '../BasisBadge';
import { WeeklyReviewModal } from '../review';
import { ClosingStretchView } from './ClosingStretchView';
import { LateTestCard } from './LateTestCard';
import { DailyTimeCard, RetestNotice } from './Retest';
import { CheckpointCard } from './Checkpoint';
import { CLOSE_FAILED } from './WeekClose';
import { closeLineWeek } from '../../lib/weekClose';
import { fixedDateLine } from '../../lib/fixedDate';
import { closingStartDay, planDays, planWeeks } from '../../lib/planLength';
import { markCloseLineSeen } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useTaskActions } from './useTaskActions';
import { SwapOfferAnswers, TodayPlanActions } from './PlanActions';
import { useAutoSwap } from './useAutoSwap';
import { StepInstructions } from './StepInstructions';
import { doneDaysOf, movedFrom, movedHereLine, visibleDay } from '../../lib/stepLines';
import { usePlanAction } from './usePlanAction';
import { FirstStepShare } from './FirstStepShare';
import { isFirstStep } from '../../lib/firstStep';

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

/** A resource title, linked when its address is a web address. */
const ResourceLink: React.FC<{ title: string; url?: string | null }> = ({ title, url }) =>
  isHttpUrl(url) ? (
    <a
      href={url!}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring inline-flex items-center gap-1 rounded-block font-medium text-text underline decoration-achievement/50 underline-offset-4 hover:decoration-achievement"
    >
      <span>{title}</span>
      <ExternalLink aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0 text-achievement" />
    </a>
  ) : (
    <span className="font-medium text-text">{title}</span>
  );

/** A guidance note: a thin gold rule and quiet copy, never an alarm. */
const Callout: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="mt-6 flex items-start gap-3 border-l-2 border-achievement/50 py-0.5 pl-4">
    {icon}
    <div className="min-w-0 text-small text-text-secondary">{children}</div>
  </div>
);

/**
 * Method-aware recovery M3.3 (section 6, MR-35 (3)): what follows "{Day}'s session didn't happen." (or "Today's
 * session is set aside.") for a day that followed the new rules.
 */
const recoveryOutcomeLine = (notice: Extract<MissNotice, { kind: 'recovery' }>) => {
  switch (notice.outcome) {
    case 'moved':
      return notice.intoToday
        ? 'We moved its most important step into today, so today stays the same length.'
        : `We moved its most important step to ${notice.toWeekday}, so that day stays the same length.`;
    case 'moved_in_order':
      return notice.intoToday ? 'We moved it into today, and the next ones follow on.' : `We moved it to ${notice.toWeekday}, and the next ones follow on.`;
    case 'continued':
      return `${notice.intoToday ? 'Today' : notice.toWeekday}'s session picks up where you left off.`;
    case 'restarted':
      return `${notice.intoToday ? 'Today' : notice.toWeekday}'s session starts the process again from its first step.`;
    case 'let_go':
      return 'Nothing needs making up: the plan carries on as it is.';
    case 'fixed':
      return 'It was set for that day, so the plan carries on as it is.';
    case 'due_passed':
      return 'Its deadline has passed, so nothing moves and the plan carries on.';
    case 'no_room':
      return "There's no room for it this week without making a day longer, so next week's plan takes it into account.";
    case 'next_week':
      return "There's no room for it this week, so next week starts with it.";
    case 'left_out':
      return "This was the plan's last week, so it's left out.";
  }
};

/** The one line about a day that didn't happen (missed sessions M3.1-M3.3; Feature Definition section 12). */
const missNoticeLine = (notice: MissNotice) =>
  notice.kind === 'recovery'
    ? `${notice.day ? `${notice.day}'s session didn't happen.` : "Today's session is set aside."} ${recoveryOutcomeLine(notice)}`
    : notice.kind === 'gentle_return'
    ? `Welcome back. Today's a short one to ease in.${notice.passedDeadline ? ` The deadline for "${notice.passedDeadline}" passed while you were away.` : ''}`
    : notice.kind === 'swap_offer'
    ? notice.day
      ? `${notice.day}'s key session didn't happen. Do it ${notice.when} instead?`
      : `Today's key session is set aside. Do it ${notice.when} instead?`
    : notice.kind === 'set_aside'
    ? notice.movedTo
      ? `Today's session is set aside. We moved its most important step to ${notice.movedTo}, so that day stays the same length.`
      : "Today's session is set aside. Nothing needs making up: the plan carries on as it is."
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
  task.status === 'completed'
    ? 'done'
    : isRestLike(task)
      ? 'rest day'
      : isToday(task, now, timezone)
        ? 'to do'
        : // B-71: a day still ahead is upcoming, not "not done".
          isAheadDay(task, now, timezone)
          ? 'upcoming'
          : 'not done';

/** Which `dash-day` mark a day gets. Shape carries the state as well as colour. */
const markState = (task: DailyTask, now: Date, timezone?: string) =>
  task.status === 'completed' ? 'completed' : isRestLike(task) ? 'rest' : isToday(task, now, timezone) ? 'today' : 'upcoming';

const DayMark: React.FC<{ task: DailyTask; now: Date; timezone?: string }> = ({ task, now, timezone }) => {
  const state = markState(task, now, timezone);
  return (
    <span className="dash-day" data-state={state}>
      {state === 'completed' && <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
    </span>
  );
};

/**
 * The current week: done, rest, today and the rest, from real task status. Each day is a button; choosing one shows its
 * step (ND-30: no separate "Show week" row).
 */
const WeekGlance: React.FC<{
  tasks: DailyTask[];
  selectedId?: string;
  now: Date;
  timezone?: string;
  onSelect: (id: string) => void;
}> = ({ tasks, selectedId, now, timezone, onSelect }) => {
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const complete = practiceDays > 0 && practiceDone >= practiceDays;
  return (
    <section aria-labelledby="week-heading" className="dash-panel animate-rise-in relative mt-6 p-5 sm:p-8" style={stagger(240)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="week-heading" className="font-ui-mono text-micro uppercase text-text-secondary">
          This week
        </h2>
        <p className={cx('tabular text-small', complete ? 'text-achievement' : 'text-text-secondary')}>
          {complete ? 'Every session done' : `${practiceDone} of ${practiceDays} practice ${practiceDays === 1 ? 'day' : 'days'} done`}
        </p>
      </div>
      {/* The day buttons reach into the card's side padding on a phone, so each stays a 44 px target at 360 px. */}
      <ul className="-mx-5 mt-4 grid grid-cols-7 sm:mx-0 sm:mt-5 sm:gap-1">
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
  const [showMore, setShowMore] = useState(false);
  const [openSteps, setOpenSteps] = useState<ReadonlySet<number>>(new Set());
  const [showNotes, setShowNotes] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [retryingClose, setRetryingClose] = useState(false);
  const { toggleComplete, saveNote, finishFocus } = useTaskActions();
  const planAction = usePlanAction();
  const stepsId = useId();
  const moreId = useId();
  const notesId = useId();

  // Weekly update M1.2b (WU-28): the automatic close's line, once. Dismissing it hides it here at once and records it
  // on the server, so no device shows it again; if that save fails, the next load shows it again.
  const closeLine = closeLineWeek(goal);
  const dateLine = fixedDateLine(goal, new Date(), timezone);
  const dismissCloseLine = (weekNumber: number) => {
    const seenAt = new Date().toISOString();
    goalContext.updateActiveGoal({
      ...goal,
      roadmapWeeks: goal.roadmapWeeks?.map((w) => (w.weekNumber === weekNumber ? { ...w, closeLineSeenAt: seenAt } : w)),
    });
    if (token) markCloseLineSeen(weekNumber, token).catch((err) => console.warn('Failed to save the close line as seen:', err));
  };
  const retryClose = async () => {
    setRetryingClose(true);
    try {
      await goalContext.retryClose();
    } finally {
      setRetryingClose(false);
    }
  };

  const tasks = currentWeekTasks(goal);
  // B-50, B-52: a continue line, a reorder's copy or a moved step whose day is done is not shown; the day reads as
  // `visibleDay` shows it (its minutes, and its text when the hidden step led it). Actions still use `task` as stored.
  const doneDays = useMemo(() => doneDaysOf(goal.dailyTasks), [goal.dailyTasks]);
  const selected = selectTodayTask(tasks, now, selectedId, timezone);
  // Weekly update M1.4 (WU-13, WU-33): a day not offered opens as a rest day does, with nothing to start or complete
  // (its in-order steps were queued onto later days, so doing it here would do them twice).
  const task = selected?.notOffered ? notOfferedAsRest(selected) : selected;
  const shown = task ? visibleDay(task, doneDays) : null;
  const steps = shown?.steps ?? [];
  // Where the plan bent: steps that moved onto this day (a carry, a swap or a reorder) say which day they came from.
  const movedHere = task ? movedHereLine(steps, task.id) : null;
  const intention = parseIntention(shown?.implementationIntention);
  const week = currentRoadmapWeek(goal);
  const day = dayNumber(goal, now, timezone);
  const journeyPercent = Math.min(100, Math.max(2, Math.round((day / planDays(goal)) * 100)));
  // A day not offered is never done here (the server never classifies it done).
  const done = task?.status === 'completed' && !task.notOffered;
  const nextTask = task ? findNextTask(tasks, task.id) : null;
  const shownNext = nextTask ? visibleDay(nextTask, doneDays) : null;
  const todayTask = tasks.find((t) => isToday(t, now, timezone)) ?? null;
  // ND-30: the done line counts every practice session so far, this one included.
  const sessionNumber = (goal.dailyTasks ?? []).filter((t) => t.status === 'completed' && !isRestLike(t)).length;
  const moreParts = [shown?.minimumVersion ? 'The 10-minute version' : '', intention ? 'When and where' : '', task?.resourceTitle ? 'Resource' : ''].filter(Boolean);
  const hasMore = moreParts.length > 0;
  const weekCount = weekProgress(tasks);
  // ND-30: what finishing this session adds, for the focus completion screen; none for a day already done or a rest.
  const sessionProgress: SessionProgress | undefined =
    task && !done && !isRestLike(task)
      ? {
          sessionNumber: sessionNumber + 1,
          weekDone: weekCount.practiceDone + (tasks.some((t) => t.id === task.id) ? 1 : 0),
          weekDays: weekCount.practiceDays,
          days: tasks.map((t) => ({ label: t.dayOfWeek.slice(0, 3), state: t.id === task.id ? 'new' : markState(t, now, timezone) })),
        }
      : undefined;
  const moreLabel = moreParts.join(' · ');
  const parsedNotes = parseTaskNotes(task?.notes);
  const focusWins = parsedNotes.focusWins;
  const draft = task ? drafts[task.id] : undefined;
  const freeformValue = draft !== undefined ? draft : parsedNotes.freeformNotes;
  const reviewDue = isWeekReviewDue(tasks, now, timezone);
  const reviewOpensDay = reviewOpensOn(tasks, now, timezone);
  const isClosingStretch = isClosingStretchActive(goal, now, timezone);
  // The miss notice belongs to Today's view of today only, never to another selected day (M3.1 R4).
  const viewingToday = Boolean(task && isToday(task, now, timezone));
  // A day still ahead can be read but not started or completed until its date (the server refuses it, `not_yet`).
  const ahead = Boolean(task && isAheadDay(task, now, timezone));
  const notice = viewingToday ? missNotice(goalContext.reconciliation, goal, now, timezone) : null;
  // ND-25: a missed key session is moved onto its receiving day without asking; the question shows only if that fails.
  const autoSwap = useAutoSwap(notice, goal, planAction);
  // M3.2: on a gentle-return day the 10-minute version is the default; when short on time it is one tap away.
  const gentleReturn = notice?.kind === 'gentle_return';
  const shortOnTime = viewingToday && !gentleReturn && shortOnTimeOffer(goalContext.reconciliation, goal, now, timezone);
  // The first practice step: starting is made easy (the 10-minute version is offered) and finishing it is marked.
  const firstStep = isFirstStep(goal, task);
  const firstStepToday = firstStep && viewingToday && !done && !gentleReturn;
  const offerMinimum = shortOnTime || (firstStepToday && Boolean(shown?.minimumVersion));
  const openFocus = (startWith: 'full' | 'minimum') => {
    setFocusStart(startWith);
    setFocusOpen(true);
  };

  // ND-29: the Dashboard's Start link arrives with `startSession`; the session opens at once when today's step can be
  // started here (not ahead, not done, not a rest day, no swap question waiting). Either way the request is used once.
  const location = useLocation();
  const navigate = useNavigate();
  const startRequested = Boolean((location.state as { startSession?: boolean } | null)?.startSession);
  const canStartNow = Boolean(task) && viewingToday && !ahead && !done && !task?.isRestDay && !(notice?.kind === 'swap_offer' && autoSwap.status === 'ask');
  useEffect(() => {
    if (!startRequested || autoSwap.status === 'moving') return;
    navigate(location.pathname + location.search, { replace: true, state: null });
    if (canStartNow) {
      setFocusStart(gentleReturn ? 'minimum' : 'full');
      setFocusOpen(true);
    }
  }, [startRequested, autoSwap.status, canStartNow, gentleReturn, navigate, location.pathname, location.search]);

  const selectDay = (id: string) => {
    setSelectedId(id);
    setOpenSteps(new Set());
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

      {/* ND-30: one line of where you are; the Dashboard holds the progress story, so the step comes first here. */}
      <header className="animate-rise-in relative" style={stagger(0)}>
        <p className="tabular font-ui-mono text-micro uppercase text-achievement">
          <span aria-label={`Day ${day} of ${planDays(goal)}`}>Day {day} of {planDays(goal)}</span>
          <span aria-hidden="true"> · </span>
          {isClosingStretch ? 'Closing stretch' : `Week ${goal.currentWeek || 1}`}
          {week?.phase && !isClosingStretch && <> · {week.phase}</>}
        </p>
        <h1 className="mt-3 max-w-2xl break-words text-h3 text-text-secondary">{goal.rawGoal}</h1>
        <div aria-hidden="true" className="today-thread mt-5">
          <div className="dash-journey" style={{ '--dash-progress': `${journeyPercent}%` } as React.CSSProperties}>
            <div className="dash-journey__fill" />
          </div>
        </div>
        {/* B-106: a goal with a fixed date shows it next to the plan's end. */}
        {dateLine && <p className="mt-3 text-small text-text-secondary">{dateLine}</p>}
        {goal.basis?.label && (
          <div className="mt-4">
            <BasisBadge basis={goal.basis} />
          </div>
        )}
      </header>

      {/* Weekly update M1.2b (RULE-9): the close couldn't write next week; the plan shows as stored. */}
      {goalContext.closeFailed && <ErrorState className="relative mt-10" title={CLOSE_FAILED} onRetry={retryClose} retrying={retryingClose} />}

      {/* Checkpoints (RULE-7): the week 4 or 8 offer, first among Today's cards; not while the close failed. */}
      {!goalContext.closeFailed && <CheckpointCard checkpoint={goal.checkpoint} />}

      {closeLine && (
        <Callout>
          <div className="flex items-center justify-between gap-3">
            <p role="status">{closeLine.line}</p>
            <IconButton
              label="Dismiss"
              icon={<X aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              onClick={() => dismissCloseLine(closeLine.weekNumber)}
            />
          </div>
        </Callout>
      )}

      {/* Weekly update M3.3b (AC-4): why the week starts with a re-test, and its result entry (self-contained). */}
      <RetestNotice goal={goal} now={now} timezone={timezone} />

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
                {goal.currentWeek && goal.currentWeek >= planWeeks(goal)
                  ? `You've reached the end of Week ${planWeeks(goal)}. Complete this review to unlock your final closing stretch${
                      closingStartDay(goal) <= planDays(goal) ? ` (days ${closingStartDay(goal)}–${planDays(goal)})` : ''
                    }.`
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

      {/* Weekly update M3.3b (AC-5): the daily-time question after two hard weeks, once. */}
      <DailyTimeCard check={goal.dailyTimeCheck} />

      {isClosingStretch ? (
        <ClosingStretchView goal={goal} apiStatus={apiStatus} />
      ) : (
        <section
          aria-labelledby="step-heading"
          className={cx('dash-card animate-rise-in relative mt-10 p-6 sm:p-10', done && 'today-done')}
          style={stagger(160)}
        >
          {task && shown ? (
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
                {task.isKeySession && !done && <Badge tone="achievement">Key session</Badge>}
                {task.isTestDay && !done && <Badge tone="achievement">Test day</Badge>}
                {movedHere && <Badge>{movedHere}</Badge>}
                {!viewingToday && todayTask && (
                  <Button variant="quiet" size="sm" className="-my-2 ml-auto" onClick={() => selectDay(todayTask.id)}>
                    Back to today
                  </Button>
                )}
              </div>

              {done && !task.isRestDay && (
                <div className="today-done-banner mt-7 flex items-center gap-4">
                  <span className="dash-done-mark" aria-hidden="true">
                    <Check strokeWidth={2.25} className="size-6" />
                  </span>
                  <p className="text-body-lg text-text">
                    {sessionNumber ? `Session ${sessionNumber} is in the books.` : 'This session is in the books.'}
                  </p>
                </div>
              )}

              <h2 id="step-heading" className={cx('max-w-[24ch] break-words text-h2 text-text', done && !task.isRestDay ? 'mt-6' : 'mt-6')}>
                {shown.title}
              </h2>
              {/* B-72: a rest day stores 0 minutes; it shows none, not the 30-minute fallback. */}
              {!task.isRestDay && (
                <p className="tabular mt-4 inline-flex items-center gap-2 text-small text-text-secondary">
                  <Clock aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0 text-achievement" />
                  {[
                    `${(gentleReturn && shown.minimumVersion?.durationMinutes) || shown.durationMinutes || 30} min`,
                    steps.length > 0 ? `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}` : '',
                    task.slotTime ? `at ${task.slotTime}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {task.isRestDay && (
                <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">
                  Nothing to do today. Rest is part of the plan: it's when the practice settles in.
                </p>
              )}
              {shown.whyToday?.trim() ? <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">{shown.whyToday}</p> : null}

              {autoSwap.status === 'moved' ? (
                <Callout>
                  <p className="text-text">
                    {autoSwap.day}'s key session didn't happen, so we moved it to {autoSwap.when}. It takes the place of the session planned
                    for {autoSwap.when === 'today' ? 'today' : 'that day'}.
                  </p>
                </Callout>
              ) : autoSwap.status === 'moving' && notice?.kind === 'swap_offer' ? (
                <Callout>
                  <p className="text-text">
                    {notice.day}'s key session didn't happen. Moving it to {notice.when}…
                  </p>
                </Callout>
              ) : (
                notice && (
                  <Callout>
                    <p className="text-text">{missNoticeLine(notice)}</p>
                    {notice.kind === 'swap_offer' && <SwapOfferAnswers notice={notice} goal={goal} action={planAction} />}
                  </Callout>
                )
              )}

              {task.isTestDay && (
                <div className="mt-6 rounded-card border border-achievement/25 bg-achievement/[0.04] p-5">
                  <h3 className="flex items-center gap-2 font-ui-mono text-micro uppercase text-achievement">
                    <Flag aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                    {isLightTest(week?.test) ? "Today's light check" : "Today's check"}
                  </h3>
                  {week?.test?.instructions && <p className="mt-3 text-body text-text">{week.test.instructions}</p>}
                  {/* M2.1: a light week shows the next check it builds toward, not a pass mark against the target. */}
                  {isLightTest(week?.test) && week?.target && (
                    <p className="mt-2 text-small text-text-secondary">{nextCheckLine(week.weekNumber, week.target, goal)}</p>
                  )}
                  {week?.test?.passIf && !isLightTest(week.test) && (
                    <p className="mt-2 text-small text-text-secondary">{formatPassIf(week.test.passIf)}</p>
                  )}
                </div>
              )}

              {firstStepToday && (
                <Callout>
                  <p className="text-text">Your first step. Start whenever you’re ready; it only has to be today’s.</p>
                </Callout>
              )}

              {steps.length > 0 && !done && !task.isRestDay && (
                <ol aria-label="Steps in this session" className="today-steps mt-8">
                  {steps.map((step, index) => {
                    const open = openSteps.has(index);
                    const from = movedFrom(step, task.id);
                    return (
                      <li key={index} className="today-step" data-open={open || undefined}>
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`${stepsId}-${index}`}
                          onClick={() =>
                            setOpenSteps((prev) => {
                              const next = new Set(prev);
                              if (open) next.delete(index);
                              else next.add(index);
                              return next;
                            })
                          }
                          className="focus-ring group flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-control py-3 text-left"
                        >
                          <span className="today-step__num tabular" aria-hidden="true">{step.stepNumber}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-body text-text">{step.title}</span>
                            {from && <span className="block text-small text-text-secondary">From {from}</span>}
                          </span>
                          {step.durationMinutes ? <span className="tabular shrink-0 text-small text-text-secondary">{step.durationMinutes} min</span> : null}
                          <ChevronDown
                            aria-hidden="true"
                            strokeWidth={1.5}
                            className={cx('size-4 shrink-0 text-text-secondary transition-transform duration-(--duration-base) ease-ascend group-hover:text-achievement', open && 'rotate-180 text-achievement')}
                          />
                        </button>
                        <div id={`${stepsId}-${index}`} hidden={!open} className="pb-5 pl-11">
                          <StepInstructions step={step} doneDays={doneDays} className="text-small text-text-secondary" />
                          {step.timing && <Line label="Timing">{step.timing}</Line>}
                          {step.focusCue && <Line label="Focus">{step.focusCue}</Line>}
                          {step.output && <Line label="Output">{step.output}</Line>}
                          {step.pitfallToAvoid && <Line label="Watch out for">{step.pitfallToAvoid}</Line>}
                          {step.passMark && <Line label="Done when">{step.passMark}</Line>}
                          {step.resourceTitle && (
                            <div className="mt-2 text-small">
                              <span className="text-text-secondary">Resource: </span>
                              <ResourceLink title={step.resourceTitle} url={step.resourceUrl} />
                              {step.resourceWhy && <p className="mt-1 text-small text-text-secondary">{step.resourceWhy}</p>}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {!done && (!task.isRestDay || gentleReturn) && (
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {ahead && !done && (
                  <p className="text-small text-text-secondary">This step opens on {task.dayOfWeek}. You can read it now and do it on the day.</p>
                )}
                {!done &&
                  (gentleReturn ? (
                    <>
                      <Button
                        variant="gold"
                        size="lg"
                        onClick={() => openFocus('minimum')}
                        leadingIcon={<Play aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                        className="w-full sm:w-auto sm:min-w-56"
                      >
                        Start the 10-minute version
                      </Button>
                      <Button variant="secondary" onClick={() => openFocus('full')} className="w-full sm:w-auto">
                        Start the full session
                      </Button>
                    </>
                  ) : (
                    !task.isRestDay &&
                    !ahead && (
                      <Button
                        variant="gold"
                        size="lg"
                        onClick={() => openFocus('full')}
                        leadingIcon={<Play aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                        className="w-full sm:w-auto sm:min-w-56"
                      >
                        Start
                      </Button>
                    )
                  ))}
                {offerMinimum && !done && (
                  <Button variant="secondary" onClick={() => openFocus('minimum')} className="w-full sm:w-auto">
                    Start the 10-minute version
                  </Button>
                )}
              </div>
              )}
              {offerMinimum && !done && <p className="mt-3 text-small text-text-secondary">The 10-minute version still counts toward this week.</p>}
              {/* The quiet way: a step done without the timer, a rest day logged, or a done day undone. */}
              {!task.notOffered && !(ahead && !done) && (
                <div
                  className={cx(
                    'flex flex-wrap items-center gap-x-1 gap-y-2 text-small text-text-secondary',
                    done || task.isRestDay ? '-ml-3 mt-7' : 'mt-4',
                  )}
                >
                  {done && !task.isRestDay && (
                    <Button variant="quiet" size="sm" onClick={() => openFocus('full')} leadingIcon={<Play aria-hidden="true" strokeWidth={1.5} className="size-3.5" />}>
                      Do it again
                    </Button>
                  )}
                  {!done && !task.isRestDay && <span>Already did it?</span>}
                  <Button variant="quiet" size="sm" loading={busy} onClick={onToggle}>
                    {done ? 'Mark not done' : task.isRestDay ? 'Log your rest' : 'Mark complete'}
                  </Button>
                </div>
              )}
              <p role="alert" className="mt-3 text-small text-danger empty:hidden">
                {actionError ?? ''}
              </p>
              {viewingToday && <TodayPlanActions goal={goal} action={planAction} now={now} timezone={timezone} />}

              {done && firstStep && <FirstStepShare goalText={goal.rawGoal} dayNumber={task.dayNumber} />}
              {(done || task.isRestDay) && (
                <div className="today-next mt-8 rounded-card border border-border bg-background/50 p-5 sm:p-6">
                  {nextTask && shownNext ? (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-ui-mono text-micro uppercase text-achievement">
                          {nextTask.dayNumber === task.dayNumber + 1 ? `Tomorrow · ${nextTask.dayOfWeek}` : `Next practice · ${nextTask.dayOfWeek}`}
                        </span>
                        <span className="flex items-center gap-2">
                          {nextTask.isTestDay && <Badge tone="achievement">Test day</Badge>}
                          {nextTask.isKeySession && !nextTask.isTestDay && <Badge tone="achievement">Key session</Badge>}
                          <span className="tabular font-ui-mono text-micro text-text-secondary">{shownNext.durationMinutes || 30} min</span>
                        </span>
                      </div>
                      <h3 className="mt-3 text-h3 text-text">{shownNext.title}</h3>
                      {shownNext.whyToday ? <p className="mt-2 line-clamp-2 text-small text-text-secondary">{shownNext.whyToday}</p> : null}
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
                        <p className="text-body font-medium text-text">Week {goal.currentWeek || 1} practice complete.</p>
                        <p className="mt-0.5 text-small text-text-secondary">
                          {reviewOpensDay ? `Weekly review opens on ${reviewOpensDay}.` : 'Weekly review ready.'}
                        </p>
                      </div>
                      {!reviewOpensDay && !reviewDue && (
                        <Button type="button" variant="secondary" size="sm" onClick={() => setReviewOpen(true)}>
                          Start weekly review
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="mt-9 border-t border-border">
                {done && steps.length > 0 && (
                  <Disclosure
                    id={stepsId}
                    open={showSteps}
                    onToggle={() => setShowSteps((value) => !value)}
                    label={showSteps ? 'Hide the steps' : `Show the ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}
                  >
                    <ol className="flex flex-col gap-2">
                      {steps.map((step, index) => (
                        <li key={index} className="flex items-baseline gap-3 text-small">
                          <span className="tabular text-achievement">{step.stepNumber}.</span>
                          <span className="min-w-0 flex-1 text-text">{step.title}</span>
                          {step.durationMinutes ? <span className="tabular shrink-0 text-text-secondary">{step.durationMinutes} min</span> : null}
                        </li>
                      ))}
                    </ol>
                  </Disclosure>
                )}
                {hasMore && (
                  <Disclosure id={moreId} open={showMore} onToggle={() => setShowMore((value) => !value)} label={showMore ? 'Less' : moreLabel}>
                    <div className="flex flex-col gap-6">
                      {shown.minimumVersion && (
                        <div>
                          <Eyebrow>The 10-minute version</Eyebrow>
                          <div className="mt-2 flex items-baseline justify-between gap-3">
                            <h3 className="text-small font-medium text-text">{shown.minimumVersion.title}</h3>
                            {shown.minimumVersion.durationMinutes ? (
                              <span className="tabular shrink-0 text-small text-text-secondary">{shown.minimumVersion.durationMinutes} min</span>
                            ) : null}
                          </div>
                          <StepInstructions step={shown.minimumVersion} doneDays={doneDays} className="mt-2 text-small text-text-secondary" />
                          {shown.minimumVersion.passMark && <Line label="Done when">{shown.minimumVersion.passMark}</Line>}
                        </div>
                      )}
                      {intention && (
                        <div>
                          <Eyebrow>When and where</Eyebrow>
                          {'raw' in intention ? (
                            <p className="mt-2 text-small text-text-secondary">{intention.raw}</p>
                          ) : (
                            <dl className="mt-2 grid grid-cols-1 gap-4 text-small sm:grid-cols-3">
                              {intention.when ? (
                                <div>
                                  <dt className="text-text-secondary">When</dt>
                                  <dd className="mt-1 text-text">{intention.when}</dd>
                                </div>
                              ) : null}
                              {intention.where ? (
                                <div>
                                  <dt className="text-text-secondary">Where</dt>
                                  <dd className="mt-1 text-text">{intention.where}</dd>
                                </div>
                              ) : null}
                              {intention.action ? (
                                <div>
                                  <dt className="text-text-secondary">Action</dt>
                                  <dd className="mt-1 text-text">{intention.action}</dd>
                                </div>
                              ) : null}
                            </dl>
                          )}
                        </div>
                      )}
                      {task.resourceTitle && (
                        <div>
                          <Eyebrow>Resource</Eyebrow>
                          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-small">
                            <ResourceLink title={task.resourceTitle} url={task.resourceUrl} />
                            {task.resourceType && <Badge>{task.resourceType}</Badge>}
                          </div>
                          {task.resourceWhy && <p className="mt-2 text-small text-text-secondary">{task.resourceWhy}</p>}
                        </div>
                      )}
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
                      maxLength={TASK_NOTES_MAX_LENGTH}
                      showCount
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
        <WeekGlance tasks={tasks} selectedId={task?.id} now={now} timezone={timezone} onSelect={selectDay} />
      )}

      {task && (
        <FocusSessionModal
          task={task}
          dayNumber={task.dayNumber}
          isOpen={focusOpen}
          onClose={() => setFocusOpen(false)}
          onCompleteSession={onFinishFocus}
          startWith={focusStart}
          doneDays={doneDays}
          progress={sessionProgress}
          isFirstStep={firstStep}
        />
      )}

      <WeeklyReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        goal={goal}
        token={token || ''}
        onGoalUpdated={goalContext.updateActiveGoal}
        onWeekClosed={() => void goalContext.refreshGoal()}
        onChoiceNeeded={() => void goalContext.reloadPlan()}
        timezone={timezone}
        apiStatus={apiStatus}
      />
    </main>
  );
};
