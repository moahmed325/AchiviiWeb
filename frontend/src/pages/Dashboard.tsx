import React from 'react';
import { ArrowRight, Check, Clock, Map, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import { currentRoadmapWeek, currentWeekTasks, dayNumber, isToday, selectTodayTask, weekProgress } from '../lib/today';
import type { DailyTask } from '../types';
import { Badge, Button, LoadingState, Skeleton, StepMarker } from '../components/ui';

export const DashboardSkeleton: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-16">
    <LoadingState label="Loading your dashboard">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-5 h-12 w-2/3" />
      <Skeleton className="mt-4 h-4 w-1/2" />
      <Skeleton className="mt-12 h-px w-full" />
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.5fr_1fr]"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
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

const dayStateOf = (task: DailyTask, now: Date): DayState => {
  if (task.status === 'completed') return 'completed';
  if (task.isRestDay) return 'rest';
  if (isToday(task, now)) return 'today';
  return 'upcoming';
};

const dayStateLabel: Record<DayState, string> = {
  completed: 'completed',
  today: 'today',
  rest: 'rest day',
  upcoming: 'upcoming',
};

const EmptyShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main id="main" className="ui-root mx-auto w-full max-w-xl flex-1 px-gutter py-20 text-center">{children}</main>
);

export const Dashboard: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal } = useGoal();
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
  const task = selectTodayTask(tasks, now);
  const week = currentRoadmapWeek(activeGoal);
  const day = dayNumber(activeGoal, now);
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const currentWeek = week?.weekNumber ?? Math.ceil(day / 7);
  const journeyPercent = Math.min(100, Math.max(2, Math.round((day / 90) * 100)));
  const isDone = task?.status === 'completed';
  const isRest = Boolean(task?.isRestDay) && !isDone;
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const stagger = (ms: number): React.CSSProperties => ({ animationDelay: ms + 'ms' });

  const eyebrow = isDone ? 'Done for today' : isRest ? 'Rest day' : 'Next session';
  const heading = isDone ? 'Well done. Today is complete.' : task?.title || 'Your next session is ready.';
  const support = isDone
    ? 'You showed up. Come back when you are ready to continue.'
    : isRest
      ? 'Rest is part of the plan. Nothing is due today.'
      : task?.whyToday;
  const cta = isDone ? 'Review today' : isRest ? 'See today' : 'Begin today';

  return (
    <main id="main" className="ui-root relative mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-16">
      <div aria-hidden="true" className="dash-glow" />

      <header className="animate-rise-in relative" style={stagger(0)}>
        <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">{dateLabel}</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-text sm:text-4xl">{greetingFor(now)}.</h1>
        <p className="mt-4 line-clamp-2 max-w-2xl text-body-lg text-text-secondary">{activeGoal.clarifiedOutcome || activeGoal.rawGoal}</p>

        <div className="mt-12" role="img" aria-label={'Day ' + day + ' of 90'}>
          <div className="mb-4 flex items-center justify-between font-ui-mono text-micro uppercase tracking-[0.16em]">
            <span className="text-text">Day {day}</span>
            <span className="inline-flex items-center gap-2 text-achievement"><StepMarker state="destination" size="sm" />Day 90</span>
          </div>
          <div className="dash-journey" style={{ '--dash-progress': journeyPercent + '%' } as React.CSSProperties}>
            <div className="dash-journey__fill" />
          </div>
        </div>
      </header>

      <section aria-labelledby="next-heading" className="relative mt-12 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="dash-card animate-rise-in p-7 sm:p-10" style={stagger(140)}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">{eyebrow}</p>
            {task?.isKeySession && !isDone && <Badge tone="achievement">Key session</Badge>}
          </div>
          <h2 id="next-heading" className="mt-5 max-w-[26ch] text-2xl font-semibold leading-tight tracking-[-0.02em] text-text sm:text-3xl">{heading}</h2>
          {support && <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">{support}</p>}
          {task && !isRest && !isDone && task.durationMinutes > 0 && (
            <p className="mt-6 inline-flex items-center gap-2 text-small text-text-secondary">
              <Clock aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />
              {task.durationMinutes} min{task.slotTime ? ' · ' + task.slotTime : ''}
            </p>
          )}
          <div className="mt-9 flex flex-wrap items-center gap-3">
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
              const state = dayStateOf(t, now);
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
            Week {currentWeek}{week?.phase ? ' · ' + week.phase : ''}
            {week?.theme && <span className="block text-text">{week.theme}</span>}
          </p>
        </div>
      </section>

      <nav aria-label="Journey" className="animate-rise-in relative mt-12 flex flex-wrap gap-x-2 gap-y-1 border-t border-border pt-6" style={stagger(380)}>
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

export default Dashboard;
