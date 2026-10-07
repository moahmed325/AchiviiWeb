import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, TrendingUp } from 'lucide-react';
import { useGoal } from '../context/GoalContext';
import { useUserTimezone } from '../context/AuthContext';
import { dayNumber } from '../lib/today';
import { LoadingState, Skeleton, Button } from '../components/ui';
import { WeekBreakdownList, BenchmarkResultsCard, AdaptationHistoryList } from '../components/progress';

const ProgressSkeleton: React.FC = () => (
  <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-gutter py-10">
    <LoadingState label="Loading your progress">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-10 w-3/4" />
      <Skeleton className="mt-3 h-2 w-full" />
      <Skeleton className="mt-10 h-24 w-full" />
    </LoadingState>
  </main>
);

export const ProgressPage: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal } = useGoal();
  const [retrying, setRetrying] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try { await refreshGoal(); } finally { setRetrying(false); }
  };

  const timezone = useUserTimezone();
  const now = useMemo(() => new Date(), []);
  const currentDay = activeGoal ? dayNumber(activeGoal, now, timezone) : 1;
  const currentWeek = activeGoal ? Math.min(12, Math.max(1, activeGoal.currentWeek || 1)) : 1;

  const progress = useMemo(() => {
    if (!activeGoal) return { completed: 0, planned: 0, percent: 0 };
    const tasks = activeGoal.dailyTasks || [];
    const planned = tasks.filter((task) => !task.isRestDay && task.weekNumber <= currentWeek).length;
    const completed = tasks.filter((task) => !task.isRestDay && task.weekNumber <= currentWeek && task.status === 'completed').length;
    return { completed, planned, percent: planned ? Math.round((completed / planned) * 100) : 0 };
  }, [activeGoal, currentWeek]);

  const phases = useMemo(() => {
    if (!activeGoal) return [];
    const roadmap = activeGoal.roadmap?.phases;
    if (roadmap && roadmap.length >= 2) return roadmap;
    return [
      { name: 'Foundation', startWeek: 1, endWeek: 4 },
      { name: 'Development', startWeek: 5, endWeek: 8 },
      { name: 'Performance', startWeek: 9, endWeek: 12 },
    ];
  }, [activeGoal]);

  const currentPhase = phases.find((phase) => currentWeek >= phase.startWeek && currentWeek <= phase.endWeek);

  if (loadingGoal) return <ProgressSkeleton />;

  if (goalLoadFailed && !activeGoal) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-gutter py-16">
        <div role="alert" className="w-full text-center">
          <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-accent">Progress</p>
          <h1 className="mt-3 text-h2 text-text">Your progress is safe.</h1>
          <p className="mx-auto mt-3 max-w-md text-body text-text-secondary">We couldn't reach Achivii right now.</p>
          <Button variant="primary" loading={retrying} onClick={handleRetry} className="mt-6">Try again</Button>
        </div>
      </main>
    );
  }

  if (!activeGoal) {
    return (
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-gutter py-16">
        <div className="text-center">
          <TrendingUp className="mx-auto size-7 text-accent" aria-hidden="true" />
          <h1 className="mt-4 text-h2 text-text">No active journey</h1>
          <p className="mt-2 text-body text-text-secondary">Create a journey to start tracking your progress.</p>
          <Link to="/onboarding" className="mt-6 inline-flex min-h-11 items-center rounded-control bg-accent px-5 text-small font-semibold text-background transition-colors hover:bg-accent/90">Create journey</Link>
        </div>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-gutter py-8 sm:py-12 focus:outline-none">
      <header className="relative max-w-2xl border-l border-achievement/40 pl-5 sm:pl-6">
        <div className="absolute -left-px top-0 h-12 w-px bg-achievement shadow-[0_0_18px_2px_color-mix(in_srgb,var(--color-achievement)_28%,transparent)]" />
        <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Progress</p>
        <h1 className="mt-3 text-h2 text-text">{activeGoal.rawGoal}</h1>
        <p className="mt-2 max-w-xl text-body text-text-secondary">{activeGoal.clarifiedOutcome}</p>
      </header>

      <section aria-labelledby="current-progress" className="mt-12 border-t border-border pt-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-ui-mono text-micro uppercase tracking-[0.14em] text-text-secondary">Right now</p>
            <h2 id="current-progress" className="mt-2 text-h3 text-text">{currentPhase?.name || 'Your journey'}</h2>
            <p className="mt-1 text-small text-text-secondary">Week {currentWeek} · Day {currentDay}</p>
          </div>
          <span className="font-ui-mono text-2xl tabular-nums text-achievement drop-shadow-[0_0_14px_color-mix(in_srgb,var(--color-achievement)_18%,transparent)]">{progress.percent}%</span>
        </div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-surface-elevated" aria-label={progress.percent + '% progress'} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
          <div className="h-full rounded-full bg-achievement shadow-[0_0_12px_1px_color-mix(in_srgb,var(--color-achievement)_35%,transparent)] transition-[width] duration-700 ease-out" style={{ width: progress.percent + '%' }} />
        </div>
        <p className="mt-3 text-small text-text-secondary">
          {progress.completed > 0 ? progress.completed + ' practice sessions completed so far.' : 'Your journey is ready. Start with today’s session.'}
        </p>
      </section>

      <section aria-labelledby="journey-heading" className="mt-12 border-t border-border pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="journey-heading" className="text-h3 text-text">Your journey</h2>
          <span className="text-micro text-text-secondary">12 weeks</span>
        </div>
        <div className="mt-7 grid grid-cols-3 gap-2 sm:gap-4">
          {phases.map((phase) => {
            const isCurrent = currentPhase?.name === phase.name;
            const isComplete = currentWeek > phase.endWeek;
            return (
              <div key={phase.name} className={'relative border-t-2 pt-4 transition-colors duration-500 ' + (isCurrent ? 'border-achievement' : isComplete ? 'border-achievement/45' : 'border-border')}>
                <div className="flex items-center gap-2">
                  {isComplete && <Check className="size-3.5 text-achievement" aria-hidden="true" />}
                  {isCurrent && <span className="size-2 rounded-full bg-achievement shadow-[0_0_10px_2px_color-mix(in_srgb,var(--color-achievement)_38%,transparent)]" aria-hidden="true" />}
                  <span className={'text-small font-medium ' + (isCurrent ? 'text-text' : 'text-text-secondary')}>{phase.name}</span>
                </div>
                <p className="mt-1 text-micro text-text-secondary">Weeks {phase.startWeek}–{phase.endWeek}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12 border-t border-border pt-6">
        <button type="button" onClick={() => setShowDetails((value) => !value)} aria-expanded={showDetails} className="flex w-full items-center justify-between py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background">
          <span className="text-small font-medium text-text">Detailed history</span>
          <span className="font-ui-mono text-micro uppercase tracking-[0.12em] text-text-secondary">{showDetails ? 'Hide' : 'View'}</span>
        </button>
        {showDetails && (
          <div className="mt-7 space-y-10">
            <WeekBreakdownList goal={activeGoal} />
            <BenchmarkResultsCard goal={activeGoal} />
            <AdaptationHistoryList goal={activeGoal} />
          </div>
        )}
      </section>
    </main>
  );
};

export default ProgressPage;
