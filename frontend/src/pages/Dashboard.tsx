import React from 'react';
import { ArrowRight, Check, Clock, Map, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import { useUserTimezone } from '../context/AuthContext';
import { useJourneyData } from '../hooks/useJourneyData';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  isClosingStretchActive,
  isToday,
  isWeekReviewDue,
  missNotice,
  parseSteps,
  selectTodayTask,
  weekProgress,
  type MissNotice,
} from '../lib/today';
import type { DailyTask } from '../types';
import { Badge, Button, LoadingState, Skeleton, StepMarker } from '../components/ui';

export const DashboardSkeleton: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-16">
    <LoadingState label="Loading your dashboard">
      <div className="flex items-center justify-between gap-8">
        <div className="flex-1"><Skeleton className="h-3 w-32" /><Skeleton className="mt-5 h-10 w-2/3" /><Skeleton className="mt-4 h-4 w-1/2" /></div>
        <Skeleton className="size-40 rounded-full" />
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.5fr_1fr]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
    </LoadingState>
  </main>
);

const greetingFor = (now: Date) => {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

type DayState = 'completed' | 'today' | 'rest' | 'upcoming';

const dayStateOf = (task: DailyTask, now: Date, timezone?: string): DayState => {
  if (task.status === 'completed') return 'completed';
  if (task.isRestDay) return 'rest';
  if (isToday(task, now, timezone)) return 'today';
  return 'upcoming';
};

const dayStateLabel: Record<DayState, string> = { completed: 'completed', today: 'today', rest: 'rest day', upcoming: 'upcoming' };

const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

/**
 * One plain sentence about where the week stands, built only from real task state and the same reconcile signals
 * Today reads (ND-19, missed sessions M3.1). Not a chat message and not styled as the Coach.
 */
const statusLine = (s: { closing: boolean; isDone: boolean; isRest: boolean; notice: MissNotice | null; practiceDone: number; practiceDays: number }) => {
  const left = Math.max(0, s.practiceDays - s.practiceDone);
  if (s.closing) return 'The final stretch. Everything so far has led here.';
  if (s.isDone && s.practiceDays > 0 && left === 0) return 'Week complete. You did everything the plan asked of you.';
  if (s.isDone) return plural(left, 'session', 'sessions') + ' left this week. Rest well tonight.';
  if (s.isRest) return 'A rest day is part of the plan. Let the work settle in.';
  if (s.notice?.kind === 'gentle_return') return "Welcome back. Today's a short one to ease in.";
  if (s.notice?.kind === 'carried' && s.notice.intoToday) return s.notice.day + "'s most important step is part of today's session.";
  if (s.notice?.kind === 'dropped') return s.notice.day + ' slipped past. No catching up needed, just today.';
  if (s.practiceDays > 0 && s.practiceDone === 0) return 'A fresh week. One session at a time.';
  if (s.practiceDays > 0 && left === 1) return 'One session left this week. Finish it and the week is yours.';
  if (s.practiceDays > 0) return s.practiceDone + ' of ' + s.practiceDays + ' sessions done this week. Keep the rhythm.';
  return 'One session at a time.';
};

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/** The page's focal point: a gold arc drawn up to today, with a glowing head where the user stands. */
const DayRing: React.FC<{ day: number; total: number }> = ({ day, total }) => {
  const pct = Math.min(1, Math.max(0.02, day / total));
  const theta = pct * 2 * Math.PI;
  const headX = 60 + RING_R * Math.cos(theta);
  const headY = 60 + RING_R * Math.sin(theta);
  const daysToGo = Math.max(0, total - day);
  const style = { '--ring-c': RING_C.toFixed(2), '--ring-offset': (RING_C * (1 - pct)).toFixed(2) } as React.CSSProperties;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative size-40 sm:size-44" role="img" aria-label={'Day ' + day + ' of ' + total} style={style}>
        <svg viewBox="0 0 120 120" className="size-full" aria-hidden="true">
          <g transform="rotate(-90 60 60)">
            <circle cx="60" cy="60" r={RING_R} className="dash-ring__track" />
            <circle cx="60" cy="60" r={RING_R} className="dash-ring__arc" />
            <circle cx={headX} cy={headY} r="3.5" className="dash-ring__head" />
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span className="font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">Day</span>
          <span className="tabular text-4xl font-semibold tracking-[-0.04em] text-text">{day}</span>
          <span className="font-ui-mono text-micro text-text-secondary">of {total}</span>
        </div>
      </div>
      <p className="inline-flex items-center gap-2 font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">
        <StepMarker state="destination" size="sm" />
        {daysToGo > 1 ? daysToGo + ' days to go' : daysToGo === 1 ? '1 day to go' : 'Final day'}
      </p>
    </div>
  );
};

const EmptyShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main id="main" className="ui-root mx-auto w-full max-w-xl flex-1 px-gutter py-20 text-center">{children}</main>
);

export const Dashboard: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal, reconciliation } = useGoal();
  const journey = useJourneyData();
  const timezone = useUserTimezone();
  const [now] = React.useState(() => new Date());
  if (loadingGoal) return <DashboardSkeleton />;
  if (goalLoadFailed && !activeGoal) return (
    <EmptyShell>
      <h1 className="text-2xl font-semibold tracking-tight text-text">We could not load your dashboard</h1>
      <p className="mt-3 text-body text-text-secondary">Your journey is safe. Check your connection and try again.</p>
      <Button className="mt-6" onClick={refreshGoal}>Try again</Button>
    </EmptyShell>
  );
  if (!activeGoal) return null;

  const tasks = currentWeekTasks(activeGoal);
  const task = selectTodayTask(tasks, now, undefined, timezone);
  const week = currentRoadmapWeek(activeGoal);
  const day = dayNumber(activeGoal, now, timezone);
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const currentWeek = week?.weekNumber ?? Math.ceil(day / 7);
  const isDone = task?.status === 'completed';
  const isRest = Boolean(task?.isRestDay) && !isDone;
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const stagger = (ms: number): React.CSSProperties => ({ animationDelay: ms + 'ms' });

  const status = statusLine({ closing: isClosingStretchActive(activeGoal, now, timezone), isDone, isRest, notice: missNotice(reconciliation ?? null, activeGoal, now, timezone), practiceDone, practiceDays });
  const steps = parseSteps(task?.detailedSteps);
  const previewSteps = steps.slice(0, 3);
  const moreSteps = steps.length - previewSteps.length;
  const showSteps = Boolean(task) && !isDone && !isRest && previewSteps.length > 0;
  const meta = task && !isRest && !isDone
    ? [task.durationMinutes > 0 ? task.durationMinutes + ' min' : '', steps.length > 0 ? plural(steps.length, 'step', 'steps') : '', task.slotTime ? 'at ' + task.slotTime : ''].filter(Boolean).join(' \u00b7 ')
    : '';

  const eyebrow = isDone ? 'Done for today' : isRest ? 'Rest day' : 'Next session';
  const heading = isDone ? 'Well done. Today is complete.' : task?.title || 'Your next session is ready.';
  const support = isDone
    ? 'You showed up. Come back when you are ready to continue.'
    : isRest
      ? 'Rest is part of the plan. Nothing is due today.'
      : task?.whyToday;
  const cta = isDone ? 'Review today' : isRest ? 'See today' : 'Begin today';

  const later = tasks.find((t) => t.dayNumber > (task?.dayNumber ?? 0) && !t.isRestDay && t.status === 'pending');
  const nextPhase = journey?.phases.find((phase) => phase.startWeek > currentWeek);
  const cells: ComingUpItem[] = [];
  if (later) {
    cells.push({ marker: <StepMarker state="upcoming" size="sm" />, label: 'Later this week', value: later.dayOfWeek + ' \u00b7 ' + later.title, note: later.isTestDay ? 'Test day' : later.isKeySession ? 'Key session' : undefined });
  } else if (isWeekReviewDue(tasks, now, timezone)) {
    cells.push({ marker: <StepMarker state="upcoming" size="sm" />, label: 'Up next', value: 'Your weekly review' });
  }
  if (week?.keyMilestone) {
    cells.push({ marker: <StepMarker state="milestone" size="sm" />, label: 'Week ' + currentWeek + ' milestone', value: week.keyMilestone });
  } else if (nextPhase) {
    cells.push({ marker: <StepMarker state="milestone" size="sm" />, label: 'Next phase', value: nextPhase.name, note: 'Starts Week ' + nextPhase.startWeek });
  }

  return (
    <main id="main" className="ui-root relative mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-16">
      <div aria-hidden="true" className="dash-glow" />

      <header className="animate-rise-in relative grid items-center gap-10 sm:grid-cols-[1fr_auto]" style={stagger(0)}>
        <div className="min-w-0">
          <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">{dateLabel}</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">{greetingFor(now)}.</h1>
          <p className="mt-4 max-w-xl text-body-lg text-text">{status}</p>
          <p className="mt-6 line-clamp-2 max-w-xl text-small text-text-secondary">
            <span className="mr-2 font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Goal</span>
            {activeGoal.clarifiedOutcome || activeGoal.rawGoal}
          </p>
        </div>
        <div className="justify-self-center sm:justify-self-end"><DayRing day={day} total={90} /></div>
      </header>

      <section aria-labelledby="next-heading" className="relative mt-12 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="dash-card dash-card--glow animate-rise-in p-7 sm:p-10" style={stagger(140)}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">{eyebrow}</p>
            {!isDone && task?.isTestDay ? <Badge tone="achievement">Test day</Badge> : !isDone && task?.isKeySession ? <Badge tone="achievement">Key session</Badge> : null}
          </div>
          <h2 id="next-heading" className="mt-5 max-w-[26ch] text-2xl font-semibold leading-tight tracking-[-0.02em] text-text sm:text-3xl">{heading}</h2>
          {support && <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">{support}</p>}
          {meta && (
            <p className="mt-5 inline-flex items-center gap-2 text-small text-text-secondary">
              <Clock aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />
              {meta}
            </p>
          )}
          {showSteps && (
            <div className="mt-7">
              <ol aria-label="Inside this session" className="divide-y divide-border border-y border-border">
                {previewSteps.map((step) => (
                  <li key={step.stepNumber} className="flex items-baseline gap-4 py-3">
                    <span className="w-5 shrink-0 font-ui-mono text-micro text-achievement">{String(step.stepNumber).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1 truncate text-small text-text">{step.title}</span>
                    {step.durationMinutes > 0 && <span className="shrink-0 font-ui-mono text-micro text-text-secondary">{step.durationMinutes} min</span>}
                  </li>
                ))}
              </ol>
              {moreSteps > 0 && <p className="mt-3 text-small text-text-secondary">+ {plural(moreSteps, 'more step', 'more steps')}</p>}
            </div>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="gold" size="lg" trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}>
              <Link to="/today">{cta}</Link>
            </Button>
          </div>
        </div>

        <div className="dash-panel animate-rise-in flex flex-col p-7 sm:p-8" style={stagger(260)}>
          <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">This week</p>
          <p className="mt-5 flex items-baseline gap-2">
            <span className="tabular text-4xl font-semibold tracking-tight text-achievement">{practiceDone}</span>
            <span className="text-body text-text-secondary">of {practiceDays} sessions</span>
          </p>
          <ol aria-label="Days this week" className="mt-8 flex items-start justify-between gap-1">
            {tasks.map((t) => {
              const state = dayStateOf(t, now, timezone);
              return (
                <li key={t.id} className="flex flex-col items-center gap-2" aria-label={t.dayOfWeek + ', ' + dayStateLabel[state]}>
                  <span className="dash-day" data-state={state}>
                    {state === 'completed' && <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
                  </span>
                  <span aria-hidden="true" className="font-ui-mono text-micro uppercase text-text-secondary">{t.dayOfWeek.slice(0, 3)}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-auto pt-8 text-small leading-6 text-text-secondary">
            Week {currentWeek}{week?.phase ? ' \u00b7 ' + week.phase : ''}
            {week?.theme && <span className="block text-text">{week.theme}</span>}
          </p>
        </div>
      </section>

      {cells.length > 0 && (
        <section
          aria-label="Coming up"
          className={'animate-rise-in relative mt-5 grid gap-px overflow-hidden rounded-panel border border-border bg-border ' + (cells.length > 1 ? 'sm:grid-cols-2' : '')}
          style={stagger(340)}
        >
          {cells.map((cell) => <ComingUpCell key={cell.label} {...cell} />)}
        </section>
      )}

      <nav aria-label="Journey" className="animate-rise-in relative mt-12 flex flex-wrap gap-x-2 gap-y-1 border-t border-border pt-6" style={stagger(420)}>
        <Button asChild variant="quiet" size="sm" leadingIcon={<TrendingUp aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />}>
          <Link to="/progress">Progress</Link>
        </Button>
        <Button asChild variant="quiet" size="sm" leadingIcon={<Map aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />}>
          <Link to="/roadmap">Roadmap</Link>
        </Button>
      </nav>
    </main>
  );
};

interface ComingUpItem { marker: React.ReactNode; label: string; value: string; note?: string }

const ComingUpCell: React.FC<ComingUpItem> = ({ marker, label, value, note }) => (
  <div className="flex gap-4 bg-surface p-5 sm:p-6">
    <span className="mt-0.5 shrink-0">{marker}</span>
    <div className="min-w-0">
      <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">{label}</p>
      <p className="mt-2 line-clamp-2 text-body text-text">{value}</p>
      {note && <p className="mt-1.5 font-ui-mono text-micro uppercase tracking-[0.14em] text-achievement">{note}</p>}
    </div>
  </div>
);

export default Dashboard;
