import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useGoal } from '../context/GoalContext';
import { dayNumber } from '../lib/today';
import { LoadingState, Skeleton, Surface, Button } from '../components/ui';
import { CompletionOverview, PhaseMilestonesCard, WeekBreakdownList, BenchmarkResultsCard, AdaptationHistoryList } from '../components/progress';

/** Loading skeleton matching the Progress page layout. */
const ProgressSkeleton: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label="Loading your progress">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="mt-8 h-40 w-full" />
      <Skeleton className="mt-6 h-64 w-full" />
    </LoadingState>
  </main>
);

/**
 * M8.2-R2 + M8.3-R3 + M8.4: Progress Page Shell.
 *
 * Dedicated /progress destination (ND-8 Option A).
 * Renders genuine execution metrics, phase milestones, week-by-week
 * breakdown, benchmark results, and adaptation history derived from
 * stored DailyTask, RoadmapWeek, and WeeklyReview records.
 * Visual Level 3: restrained, typographic, large numerals as visual objects.
 * Resilient against network/fetch failures with retry (M8.4).
 */
export const ProgressPage: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal } = useGoal();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshGoal();
    } finally {
      setRetrying(false);
    }
  };

  const now = useMemo(() => new Date(), []);
  const currentDay = useMemo(
    () => (activeGoal ? dayNumber(activeGoal, now) : 1),
    [activeGoal, now],
  );
  const currentWeek = activeGoal ? Math.min(12, Math.max(1, activeGoal.currentWeek || 1)) : 1;

  // Find the active phase name
  const activePhase = useMemo(() => {
    if (!activeGoal?.roadmapWeeks) return '';
    const week = activeGoal.roadmapWeeks.find((w) => w.weekNumber === currentWeek);
    return week?.phase || '';
  }, [activeGoal, currentWeek]);

  if (loadingGoal) {
    return <ProgressSkeleton />;
  }

  // Goal fetch failed: render dedicated error state (M8.4, OD-9, ND-12)
  if (goalLoadFailed && !activeGoal) {
    return (
      <main id="main" className="ui-root mx-auto w-full max-w-xl flex-1 px-gutter py-16 text-center">
        <Surface role="alert" tone="base" padding="lg" radius="card" className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-h2 text-text">
            We couldn't load your progress
          </h1>
          <p className="max-w-md text-body text-text-secondary">
            Your plan is safe, but we had trouble reaching Achivii. Check your connection or try again.
          </p>
          <Button variant="primary" loading={retrying} onClick={handleRetry} className="mt-2">
            Try again
          </Button>
        </Surface>
      </main>
    );
  }

  if (!activeGoal) {
    // No active goal — shouldn't normally happen (ProtectedRoute guards), but handle gracefully
    return (
      <main id="main" className="ui-root mx-auto w-full max-w-xl flex-1 px-gutter py-16 text-center">
        <div className="rounded-card border border-border bg-surface p-8 text-center space-y-4 max-w-md mx-auto my-12">
          <div className="size-12 rounded-full bg-surface-elevated border border-border flex items-center justify-center mx-auto text-accent">
            <TrendingUp className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-text">No Active Journey</h1>
            <p className="text-xs text-text-secondary">
              Start your 90-day journey to see your progress here.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center px-4 py-2 rounded-control bg-accent text-background text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            Create Your Journey
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto w-full max-w-3xl px-gutter py-6 sm:py-10 space-y-10 animate-fadeIn focus:outline-none"
    >
      {/* Header */}
      <header className="space-y-2">
        <p className="font-ui-mono text-micro uppercase text-accent-hover">Your progress</p>
        <h1 className="text-h2 text-text">{activeGoal.rawGoal}</h1>
        <p className="text-body text-text-secondary">{activeGoal.clarifiedOutcome}</p>
        <p className="mt-1 text-small text-text-muted">
          Day {currentDay} of 90 · Week {currentWeek}
          {activePhase ? ` · ${activePhase}` : ''}
        </p>
      </header>

      {/* Layer 1: Core Completion Metrics */}
      <CompletionOverview goal={activeGoal} currentDay={currentDay} />

      {/* Layer 2: Phase & Milestone Progression */}
      <PhaseMilestonesCard goal={activeGoal} />

      {/* Layer 3: Week-by-Week Breakdown */}
      <WeekBreakdownList goal={activeGoal} />

      {/* Layer 4: Benchmark Results (M8.3-R1) — only renders if weeks have tests */}
      <BenchmarkResultsCard goal={activeGoal} />

      {/* Layer 5: Adaptation History (M8.3-R2) — only renders if reviews exist */}
      <AdaptationHistoryList goal={activeGoal} />
    </main>
  );
};

export default ProgressPage;
