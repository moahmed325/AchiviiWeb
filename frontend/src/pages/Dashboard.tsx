import React from 'react';
import { ArrowRight, Map, Play, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import { dayNumber, currentRoadmapWeek, currentWeekTasks, selectTodayTask, weekProgress } from '../lib/today';
import { Badge, Button, LoadingState, Skeleton } from '../components/ui';

export const DashboardSkeleton: React.FC = () => (
  <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label="Loading your dashboard">
      <Skeleton className="h-3 w-20" /><Skeleton className="mt-4 h-10 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
    </LoadingState>
  </main>
);

export const Dashboard: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal } = useGoal();
  const [now] = React.useState(() => new Date());
  if (loadingGoal) return <DashboardSkeleton />;
  if (goalLoadFailed && !activeGoal) return (
    <main id="main" className="mx-auto w-full max-w-xl flex-1 px-gutter py-20 text-center">
      <h1 className="text-h2 text-text">We could not load your dashboard</h1>
      <p className="mt-3 text-body text-text-secondary">Your journey is safe. Check your connection and try again.</p>
      <Button className="mt-6" onClick={refreshGoal}>Try again</Button>
    </main>
  );
  if (!activeGoal) return null;

  const tasks = currentWeekTasks(activeGoal);
  const task = selectTodayTask(tasks, now);
  const week = currentRoadmapWeek(activeGoal);
  const day = dayNumber(activeGoal, now);
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const progress = Math.min(100, Math.round((practiceDone / Math.max(practiceDays, 1)) * 100));
  const currentWeek = week?.weekNumber ?? Math.ceil(day / 7);

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-gutter py-8 sm:py-12">
      <header className="relative overflow-hidden border-b border-border pb-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-achievement/10 blur-3xl" />
        <p className="relative font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Your journey</p>
        <div className="relative mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h1 className="text-h1 text-text">Keep moving toward your goal.</h1>
            <p className="mt-3 text-body text-text-secondary">{activeGoal.clarifiedOutcome || activeGoal.rawGoal}</p>
          </div>
          <span className="shrink-0 font-ui-mono text-small text-text-secondary">Day {day} <span className="text-achievement">/ 90</span></span>
        </div>
      </header>

      <section aria-labelledby="next-heading" className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-achievement/30 bg-gradient-to-br from-achievement/10 via-surface to-surface p-6 shadow-[0_18px_55px_-35px_rgba(200,169,107,0.7)] sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-achievement/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="font-ui-mono text-micro uppercase tracking-[0.14em] text-achievement">Next up</p>
              {task?.isKeySession && <Badge tone="accent">Key session</Badge>}
            </div>
            <h2 id="next-heading" className="mt-4 text-h2 text-text">{task?.title || 'Your next session is ready.'}</h2>
            {task?.whyToday && <p className="mt-3 max-w-xl text-small leading-6 text-text-secondary">{task.whyToday}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild leadingIcon={<Play className="size-4 fill-current" />}><Link to="/today">Go to today</Link></Button>
              <Button asChild variant="quiet" trailingIcon={<ArrowRight className="size-4" />}><Link to="/progress">See progress</Link></Button>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-surface p-6 sm:p-7">
          <p className="font-ui-mono text-micro uppercase tracking-[0.14em] text-text-secondary">This week</p>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div><span className="font-ui-mono text-3xl text-achievement">{practiceDone}</span><span className="text-small text-text-secondary"> / {practiceDays} days</span></div>
            <span className="text-small text-text-secondary">{progress}%</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
            <div className="h-full rounded-full bg-achievement shadow-[0_0_12px_1px_rgba(200,169,107,0.3)] transition-all" style={{ width: progress + '%' }} />
          </div>
          <p className="mt-4 text-small text-text-secondary">Week {currentWeek}{week?.phase ? ' · ' + week.phase : ''}</p>
        </div>
      </section>

      <section aria-label="Journey links" className="mt-8 grid gap-3 sm:grid-cols-3">
        <Link to="/today" className="group rounded-2xl border border-border p-5 transition-colors hover:border-achievement/40 hover:bg-achievement/[0.035]">
          <Play className="size-5 text-achievement" /><h2 className="mt-4 text-body font-medium text-text">Today</h2>
          <p className="mt-1 text-small text-text-secondary">Do the work that matters now.</p>
        </Link>
        <Link to="/progress" className="group rounded-2xl border border-border p-5 transition-colors hover:border-achievement/40 hover:bg-achievement/[0.035]">
          <TrendingUp className="size-5 text-achievement" /><h2 className="mt-4 text-body font-medium text-text">Progress</h2>
          <p className="mt-1 text-small text-text-secondary">See what your work is changing.</p>
        </Link>
        <Link to="/roadmap" className="group rounded-2xl border border-border p-5 transition-colors hover:border-achievement/40 hover:bg-achievement/[0.035]">
          <Map className="size-5 text-achievement" /><h2 className="mt-4 text-body font-medium text-text">Roadmap</h2>
          <p className="mt-1 text-small text-text-secondary">See where this journey is going.</p>
        </Link>
      </section>
    </main>
  );
};

export default Dashboard;
