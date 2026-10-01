import React, { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Play, X } from 'lucide-react';
import type { DailyTask, Goal } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { formatPassIf } from '../../lib/formatters';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  isToday,
  isWeekReviewDue,
  isClosingStretchActive,
  parseSteps,
  parseTaskNotes,
  selectTodayTask,
  serializeTaskNotes,
  weekProgress,
} from '../../lib/today';
import { Badge, Button, Field, IconButton, LoadingState, Skeleton, StepMarker, Textarea, cx } from '../ui';
import { FocusSessionModal } from '../FocusSessionModal';
import { WeeklyReviewModal } from '../review';
import { ClosingStretchView } from './ClosingStretchView';
import { useAuth } from '../../context/AuthContext';
import { useTaskActions } from './useTaskActions';

const NOT_SAVED = "That didn't save. Please check your connection and try again.";

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
const WeekGlance: React.FC<{
  tasks: DailyTask[];
  selectedId?: string;
  now: Date;
  onSelect: (id: string) => void;
  onOpenReview?: () => void;
}> = ({
  tasks,
  selectedId,
  now,
  onSelect,
  onOpenReview,
}) => {
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const [showWeek, setShowWeek] = useState(false);
  return (
    <section aria-labelledby="week-heading" className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h2 id="week-heading" className="text-body font-medium text-text">
            This week
          </h2>
          <p className="tabular text-small text-text-secondary">
            {practiceDone} of {practiceDays} practice {practiceDays === 1 ? 'day' : 'days'} done
          </p>
        </div>
        {onOpenReview && (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={onOpenReview}
            className="min-h-[44px] text-text-secondary hover:text-text"
          >
            Review week
          </Button>
        )}
      </div>
      <div className="mt-3">
        <Button
          type="button"
          variant="quiet"
          size="sm"
          aria-expanded={showWeek}
          aria-controls="week-glance-days"
          onClick={() => setShowWeek((value) => !value)}
        >
          {showWeek ? "Hide week" : "Show week"}
        </Button>
      </div>
      <ul id="week-glance-days" hidden={!showWeek} className="mt-3 grid grid-cols-7 divide-x divide-border overflow-hidden rounded-card border border-border">
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

void WeekGlance;

interface TodayProps {
  goal: Goal;
  apiStatus?: 'online' | 'offline' | 'checking';
}

/**
 * Today for the normal practice day and all OD-9 states (BP §09, BP §18, OD-9):
 * the goal, Day N / 90, today's step or rest day, test day benchmarks, key sessions,
 * recovery guidance, review due prompts, and honest clamped 90-day completion.
 */
export const Today: React.FC<TodayProps> = ({ goal, apiStatus: propApiStatus }) => {
  const { token } = useAuth();
  const goalContext = useGoal();
  const apiStatus = propApiStatus ?? goalContext.apiStatus;
  const [now] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string>();
  const [focusOpen, setFocusOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showMinimum, setShowMinimum] = useState(false);
  const [showWeek, setShowWeek] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const { toggleComplete, saveNote, finishFocus } = useTaskActions();
  const stepsId = useId();
  const minimumId = useId();
  const notesId = useId();

  const tasks = currentWeekTasks(goal);
  const task = selectTodayTask(tasks, now, selectedId);
  const steps = parseSteps(task?.detailedSteps);
  const week = currentRoadmapWeek(goal);
  const day = dayNumber(goal, now);
  const done = task?.status === 'completed';
  const parsedNotes = parseTaskNotes(task?.notes);
  const focusWins = parsedNotes.focusWins;
  const draft = task ? drafts[task.id] : undefined;
  const freeformValue = draft !== undefined ? draft : parsedNotes.freeformNotes;
  const reviewDue = isWeekReviewDue(tasks, now);
  const isClosingStretch = isClosingStretchActive(goal, now);

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
    <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-8 text-left sm:py-12">
      <PathwayNotice />
      {apiStatus === 'offline' && <div role="status" className="mb-8 rounded-2xl border border-border bg-surface px-4 py-3 text-small text-text-secondary"><span className="mr-2 inline-block size-2 rounded-full bg-amber-500" />Offline — changes won't save.</div>}

      <header className="space-y-4">
        <Eyebrow>Today</Eyebrow>
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="max-w-2xl break-words text-h2 font-medium tracking-tight text-text sm:text-h1">{task?.title || 'Your next step'}</h1>
            {task?.whyToday?.trim() && <p className="mt-3 max-w-xl text-small leading-6 text-text-secondary">{task.whyToday}</p>}
          </div>
          <div className="hidden shrink-0 text-right sm:block"><p className="font-ui-mono text-micro uppercase text-text-secondary">Day</p><p className="mt-1 tabular text-h3 text-text">{day}<span className="text-small text-text-secondary"> / 90</span></p></div>
        </div>
      </header>

      <div className="mt-7 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#C9A227]/35 bg-[#C9A227]/[0.07] px-3 py-1 font-ui-mono text-micro uppercase tracking-wider text-[#C9A227]">Week {goal.currentWeek || 1}</span>
        {week?.phase && <span className="text-small text-text-secondary">{week.phase}</span>}
        {task?.isKeySession && <Badge tone="accent">Key session</Badge>}
        {task?.isTestDay && <Badge tone="accent">Test</Badge>}
        {done && <Badge tone="accent">Done</Badge>}
      </div>

      {reviewDue && <section className="mt-8 rounded-2xl border border-[#C9A227]/30 bg-gradient-to-br from-[#C9A227]/10 via-surface to-surface p-5"><p className="font-ui-mono text-micro uppercase text-[#C9A227]">Week complete</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-small text-text-secondary">Your weekly review is ready.</p><Button type="button" variant="primary" onClick={() => setReviewOpen(true)}>Review week</Button></div></section>}

      {isClosingStretch ? <div className="mt-8"><ClosingStretchView goal={goal} apiStatus={apiStatus} /></div> : (
        <section aria-labelledby="step-heading" className={cx('mt-8 rounded-3xl border p-6 sm:p-8', done ? 'border-[#C9A227]/35 bg-gradient-to-br from-[#C9A227]/[0.07] via-surface to-surface' : 'border-border bg-surface')}>
          {task ? <>
            <div className="flex items-center justify-between gap-3"><Eyebrow>{task.isRestDay ? "Today's rest" : "Today's focus"}</Eyebrow><span className="font-ui-mono text-micro text-text-secondary">{task.durationMinutes || 30} min</span></div>
            <h2 id="step-heading" className="mt-3 text-h3 font-medium tracking-tight text-text">{task.isRestDay ? 'Recover well today.' : task.title}</h2>
            {task.isRestDay && <p className="mt-3 max-w-xl text-small leading-6 text-text-secondary">Rest is part of the plan. Recover today so you can execute the next session well.</p>}
            {task.isTestDay && week?.test && <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4"><p className="font-ui-mono text-micro uppercase text-[#C9A227]">{week.test.type || 'Benchmark'}</p>{week.test.instructions && <p className="mt-2 text-small text-text-secondary">{week.test.instructions}</p>}{week.test.passIf && <p className="mt-2 text-small text-text"><span className="text-text-secondary">Pass when: </span>{formatPassIf(week.test.passIf)}</p>}</div>}
            {done && <div className="mt-4 flex items-center gap-2 text-small font-medium text-[#C9A227]"><Check className="size-4" />Completed for today</div>}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {!task.isRestDay && <Button onClick={() => setFocusOpen(true)} leadingIcon={<Play className="size-4" />}>Start session</Button>}
              <Button variant={task.isRestDay ? 'primary' : 'secondary'} loading={busy} onClick={onToggle}>{done ? 'Mark not done' : task.isRestDay ? 'Log recovery' : 'Mark complete'}</Button>
            </div>
            <p role="alert" className="mt-3 text-small text-danger empty:hidden">{actionError ?? ''}</p>

            {steps.length > 0 && <div className="mt-7 border-t border-border pt-4"><Button variant="quiet" size="sm" aria-expanded={showSteps} aria-controls={stepsId} onClick={() => setShowSteps(v => !v)} trailingIcon={<ChevronDown className={cx('size-4', showSteps && 'rotate-180')} />}>{showSteps ? 'Hide session steps' : 'Show session steps'}</Button><ol id={stepsId} hidden={!showSteps} className="mt-3 space-y-3">{steps.map((step,index)=><li key={index} className="rounded-2xl border border-border p-4"><p className="text-small font-medium text-text">{step.stepNumber}. {step.title}</p>{step.instructions&&<p className="mt-2 text-small text-text-secondary">{step.instructions}</p>}</li>)}</ol></div>}

            {task.minimumVersion && <div className="mt-4 border-t border-border pt-4"><Button variant="quiet" size="sm" aria-expanded={showMinimum} aria-controls={minimumId} onClick={() => setShowMinimum(v => !v)} trailingIcon={<ChevronDown className={cx('size-4',showMinimum&&'rotate-180')} />}>{showMinimum ? 'Hide minimum version' : 'Need an easier version?'}</Button><div id={minimumId} hidden={!showMinimum} className="mt-3 rounded-2xl border border-border p-4"><p className="text-small font-medium text-text">{task.minimumVersion.title}</p>{task.minimumVersion.instructions&&<p className="mt-2 text-small text-text-secondary">{task.minimumVersion.instructions}</p>}</div></div>}

            <div className="mt-4 border-t border-border pt-4"><Button variant="quiet" size="sm" aria-expanded={showNotes} aria-controls={notesId} onClick={() => setShowNotes(v => !v)} trailingIcon={<ChevronDown className={cx('size-4',showNotes&&'rotate-180')} />}>{showNotes ? 'Hide notes' : 'Add a note'}</Button><div id={notesId} hidden={!showNotes} className="mt-3"><Field label="Notes for today" error={noteError ?? undefined}><Textarea rows={3} value={freeformValue} placeholder="What felt hard? What clicked?" onChange={e=>setDrafts(prev=>({...prev,[task.id]:e.target.value}))} onBlur={onSaveNote}/></Field><div className="mt-3 flex justify-end"><Button variant="secondary" size="sm" loading={savingNote} onClick={onSaveNote}>Save note</Button></div></div></div>
          </> : <><Eyebrow>Today</Eyebrow><h2 id="step-heading" className="mt-3 text-h3 text-text">No step planned yet.</h2><p className="mt-2 text-small text-text-secondary">Your next session will appear here when it is ready.</p></>}
        </section>
      )}

      {!isClosingStretch && tasks.length > 0 && <section aria-labelledby="week-heading" className="mt-10 border-t border-border pt-7"><div className="flex items-center justify-between"><div><p className="font-ui-mono text-micro uppercase text-[#C9A227]">Your week</p><h2 id="week-heading" className="mt-1 text-body font-medium text-text">The week at a glance</h2></div><Button variant="quiet" size="sm" onClick={()=>setReviewOpen(true)}>Review</Button></div><Button variant="quiet" size="sm" className="mt-2" aria-expanded={showWeek} onClick={()=>setShowWeek(v=>!v)}>{showWeek?'Hide week':'Show week'}<ChevronDown className={cx('ml-1 size-4',showWeek&&'rotate-180')}/></Button><ul hidden={!showWeek} className="mt-3 grid grid-cols-7 overflow-hidden rounded-2xl border border-border">{tasks.map(item=>{const selected=item.id===task?.id;const todayItem=isToday(item,now);return <li key={item.id} className="min-w-0 border-r border-border last:border-r-0"><button type="button" aria-pressed={selected} onClick={()=>selectDay(item.id)} className={cx('flex min-h-16 w-full flex-col items-center justify-center gap-1 py-2 text-small',selected?'bg-[#C9A227]/10 text-text':'text-text-secondary hover:bg-background')}><span className={cx('font-ui-mono text-micro uppercase',todayItem&&'text-[#C9A227]')}>{item.dayOfWeek.slice(0,3)}</span><span>{item.date.slice(8)}</span>{item.status==='completed'?<Check className="size-3.5 text-[#C9A227]"/>:item.isRestDay?<span className="text-micro">Rest</span>:<span className="size-1.5 rounded-full bg-border"/>}</button></li>})}</ul></section>}

      <nav aria-label="More of your plan" className="mt-8 border-t border-border pt-6"><Button asChild variant="quiet" trailingIcon={<ArrowRight className="size-4"/>}><Link to="/roadmap">View roadmap</Link></Button></nav>
      {task && <FocusSessionModal task={task} dayNumber={task.dayNumber} isOpen={focusOpen} onClose={()=>setFocusOpen(false)} onCompleteSession={onFinishFocus}/>}
      <WeeklyReviewModal isOpen={reviewOpen} onClose={()=>setReviewOpen(false)} goal={goal} token={token||''} onGoalUpdated={goalContext.updateActiveGoal} apiStatus={apiStatus}/>
    </main>
  );
};
