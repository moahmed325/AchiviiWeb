import React from 'react';
import { ArrowRight, Check, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import { useUserTimezone } from '../context/AuthContext';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  isClosingStretchActive,
  isWeekReviewDue,
  missNotice,
  selectTodayTask,
  weekProgress,
  type MissNotice,
} from '../lib/today';
import { goalTrend, greetingFor, journeyDays, milestones, nextTestDay, practiceTotals, START_SESSION_STATE, TOTAL_DAYS } from '../lib/dashboard';
import { Badge, Button, LoadingState, Skeleton } from '../components/ui';
import { doneDaysOf, visibleDay } from '../lib/stepLines';
import { GettingReady } from '../components/today/WeekClose';
import { Momentum } from '../components/dashboard/Momentum';
import { JourneyMap } from '../components/dashboard/JourneyMap';
import { GoalProgress } from '../components/dashboard/GoalProgress';

export const DashboardSkeleton: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-16">
    <LoadingState label="Loading your dashboard">
      <div className="flex items-center justify-between gap-8">
        <div className="flex-1"><Skeleton className="h-3 w-32" /><Skeleton className="mt-5 h-10 w-2/3" /><Skeleton className="mt-4 h-4 w-1/2" /></div>
        <Skeleton className="h-28 w-32" />
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      <Skeleton className="mt-5 h-56" />
    </LoadingState>
  </main>
);

const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);

/** Method-aware recovery M3.3 (section 6, MR-35 (3)): the Dashboard's short line for a day that followed the new rules. */
const recoveryStatus = (n: Extract<MissNotice, { kind: 'recovery' }>) => {
  if (!n.day) return "Today's session is set aside. No catching up needed.";
  switch (n.outcome) {
    case 'moved':
    case 'moved_in_order':
      return n.intoToday ? n.day + "'s most important step is part of today's session." : n.day + "'s most important step moved to " + n.toWeekday + '.';
    case 'continued':
      return n.intoToday ? n.day + "'s work picks up again today." : n.day + "'s work picks up again on " + n.toWeekday + '.';
    case 'restarted':
      return n.intoToday ? 'The process starts again today, from its first step.' : 'The process starts again on ' + n.toWeekday + ', from its first step.';
    case 'let_go':
    case 'fixed':
      return n.day + ' slipped past. No catching up needed, just today.';
    case 'due_passed':
      return n.day + "'s deadline has passed, so nothing moves.";
    case 'no_room':
      return n.day + " slipped past. Next week's plan takes it into account.";
    case 'next_week':
      return n.day + ' slipped past. Next week starts with it.';
    case 'left_out':
      return n.day + " slipped past. This was the plan's last week.";
  }
};

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
  if (s.notice?.kind === 'swap_offer') return (s.notice.day ? s.notice.day + "'s key session didn't happen." : "Today's key session is set aside.") + ' Do it ' + s.notice.when + ' instead?';
  if (s.notice?.kind === 'set_aside') return "Today's session is set aside. No catching up needed.";
  if (s.notice?.kind === 'carried' && s.notice.intoToday) return s.notice.day + "'s most important step is part of today's session.";
  if (s.notice?.kind === 'dropped') return s.notice.day + ' slipped past. No catching up needed, just today.';
  if (s.notice?.kind === 'recovery') return recoveryStatus(s.notice);
  if (s.practiceDays > 0 && s.practiceDone === 0) return 'A fresh week. One session at a time.';
  if (s.practiceDays > 0 && left === 1) return 'One session left this week. Finish it and the week is yours.';
  if (s.practiceDays > 0) return s.practiceDone + ' of ' + s.practiceDays + ' sessions done this week. Keep the rhythm.';
  return 'One session at a time.';
};

const EmptyShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main id="main" className="ui-root mx-auto w-full max-w-xl flex-1 px-gutter py-20 text-center">{children}</main>
);

const shortWeekday = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', timeZone: 'UTC' });

/**
 * ND-27: the Dashboard answers "how am I doing" (ND-19 keeps it an overview; Today is where a step is done). Today's
 * session sits first with one way in; below it, the whole plan as a map of days and the goal's own measure. Every
 * number is real stored state, and the page writes nothing.
 */
export const Dashboard: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal, reconciliation, closingWeek } = useGoal();
  const timezone = useUserTimezone();
  const [now] = React.useState(() => new Date());
  if (closingWeek) return <GettingReady />;
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
  // B-50, B-52: today reads as Today shows it (`visibleDay`): steps from a done day hidden.
  const doneDays = doneDaysOf(activeGoal.dailyTasks);
  const stored = selectTodayTask(tasks, now, undefined, timezone);
  const task = stored ? visibleDay(stored, doneDays) : null;
  const week = currentRoadmapWeek(activeGoal);
  const day = dayNumber(activeGoal, now, timezone);
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const isDone = task?.status === 'completed';
  const isRest = Boolean(task?.isRestDay) && !isDone;
  const reviewDue = (isDone || isRest || !task) && isWeekReviewDue(tasks, now, timezone);
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone });
  const stagger = (ms: number): React.CSSProperties => ({ animationDelay: ms + 'ms' });

  const notice = missNotice(reconciliation ?? null, activeGoal, now, timezone);
  const status = statusLine({ closing: isClosingStretchActive(activeGoal, now, timezone), isDone, isRest, notice, practiceDone, practiceDays });
  // B-1: on a gentle-return day the 10-minute version is the default, so its minutes are the ones shown.
  const gentle = notice?.kind === 'gentle_return';
  const shortMinutes = gentle ? task?.minimumVersion?.durationMinutes : undefined;
  const steps = task?.steps ?? [];
  const meta = task && !isRest && !isDone
    ? [shortMinutes ? shortMinutes + ' min, short version' : task.durationMinutes > 0 ? task.durationMinutes + ' min' : '', !shortMinutes && steps.length > 0 ? plural(steps.length, 'step', 'steps') : '', task.slotTime ? 'at ' + task.slotTime : ''].filter(Boolean).join(' · ')
    : '';

  const totals = practiceTotals(activeGoal, now, timezone);
  const days = journeyDays(activeGoal, now, timezone);
  const trend = goalTrend(activeGoal);
  const test = nextTestDay(activeGoal.dailyTasks ?? [], now, timezone);
  const nextCheck = test ? 'Next check: ' + (test.date === days.find((d) => d.isToday)?.date ? 'today' : shortWeekday(test.date)) + '.' : null;
  const daysLeft = Math.max(0, TOTAL_DAYS - day);
  const mapSummary = totals.daysDone + ' of ' + totals.daysSoFar + ' practice days done so far. Day ' + day + ' of ' + TOTAL_DAYS + '.';

  const checks = milestones(activeGoal);
  // GoalProgress has nothing to show for a goal with no number, no checks and no milestone this week.
  const goalPanel = Boolean(trend) || checks.total > 0 || Boolean(week?.keyMilestone);

  const eyebrow = reviewDue ? 'Weekly review' : isDone ? 'Done for today' : isRest ? 'Rest day' : 'Today';
  const heading = reviewDue
    ? 'Your week is ready to review.'
    : isDone
      ? 'Today is done.'
      : isRest
        ? 'Rest is part of the plan.'
        : task?.title || 'Your next session is ready.';
  const support = reviewDue
    ? 'Two minutes looking back shapes next week.'
    : isDone
      ? 'Session ' + totals.sessionsDone + ' is in the books. Come back tomorrow.'
      : isRest
        ? 'Nothing is due today. Let the work settle in.'
        : task?.whyToday;
  const cta = reviewDue ? 'Review the week' : isDone || isRest ? 'See today' : gentle ? 'Start the 10-minute version' : 'Start session';
  const startsSession = !reviewDue && !isDone && !isRest && Boolean(task);

  return (
    <main id="main" className="ui-root relative mx-auto w-full max-w-5xl flex-1 px-gutter py-10 sm:py-16">
      <div aria-hidden="true" className="dash-glow" />

      <header className="animate-rise-in relative grid items-end gap-8 sm:grid-cols-[1fr_auto]" style={stagger(0)}>
        <div className="min-w-0">
          <p className="font-ui-mono text-micro uppercase text-achievement">{dateLabel}</p>
          <h1 className="mt-4 text-h1 text-text">{greetingFor(now, timezone)}.</h1>
          <p className="mt-5 max-w-xl text-body-lg text-text">{status}</p>
          <p className="mt-2 line-clamp-2 max-w-xl text-small text-text-secondary">{activeGoal.rawGoal}</p>
        </div>
        <Momentum goalId={activeGoal.id} sessions={totals.sessionsDone} minutes={totals.minutesPractised} />
      </header>

      <div className={'relative mt-12 grid gap-5' + (goalPanel ? ' lg:grid-cols-[1.4fr_1fr]' : '')}>
        <section
          aria-labelledby="next-heading"
          className={'dash-card dash-card--glow animate-rise-in flex flex-col p-7 sm:p-10' + (isDone ? ' today-done' : '')}
          style={stagger(120)}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-ui-mono text-micro uppercase text-achievement">{eyebrow}</p>
            {startsSession && task?.isTestDay ? <Badge tone="achievement">Test day</Badge> : startsSession && task?.isKeySession ? <Badge tone="achievement">Key session</Badge> : null}
          </div>
          {isDone && !reviewDue && (
            <span className="dash-done-mark mt-6" aria-hidden="true">
              <Check strokeWidth={2.25} className="size-6" />
            </span>
          )}
          <h2 id="next-heading" className="mt-5 max-w-[26ch] text-h3 text-text sm:text-3xl sm:font-semibold sm:tracking-[-0.02em]">{heading}</h2>
          {support && <p className="mt-3 line-clamp-3 max-w-xl text-body text-text-secondary">{support}</p>}
          {meta && (
            <p className="mt-5 inline-flex items-center gap-2 text-small text-text-secondary">
              <Clock aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />
              {meta}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-8">
            <Button
              asChild
              variant={startsSession || reviewDue ? 'gold' : 'secondary'}
              size="lg"
              trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            >
              <Link to="/" state={startsSession ? START_SESSION_STATE : undefined}>{cta}</Link>
            </Button>
          </div>
        </section>

        {goalPanel && (
          <div className="animate-rise-in flex min-w-0" style={stagger(220)}>
            <GoalProgress trend={trend} milestones={checks} weekMilestone={week?.keyMilestone} nextCheck={nextCheck} />
          </div>
        )}
      </div>

      <section aria-labelledby="map-heading" className="dash-panel animate-rise-in relative mt-5 grid gap-8 p-7 sm:p-8 md:grid-cols-[minmax(0,14rem)_1fr] md:items-center" style={stagger(320)}>
        <div>
          <h2 id="map-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Your 90 days</h2>
          <p className="mt-5 flex items-baseline gap-2">
            <span className="tabular text-5xl font-semibold tracking-[-0.04em] text-text">{totals.daysDone}</span>
            <span className="text-body text-text-secondary">of {totals.daysSoFar} so far</span>
          </p>
          <p className="mt-3 text-small text-text-secondary">
            Day {day} of {TOTAL_DAYS}
            {week?.phase ? ' · ' + week.phase : ''}
            <span className="block">{daysLeft > 1 ? daysLeft + ' days to go' : daysLeft === 1 ? '1 day to go' : 'Final day'}</span>
          </p>
        </div>
        <JourneyMap days={days} phases={activeGoal.roadmap?.phases ?? []} summary={mapSummary} />
      </section>
    </main>
  );
};

export default Dashboard;
