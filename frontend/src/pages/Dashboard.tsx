import React from 'react';
import { ArrowRight, CalendarCheck, Check, CircleCheck, Clock, Flag, Flame, Target, Timer, Trophy, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import { useFirstName, useUserTimezone } from '../context/AuthContext';
import {
  currentWeekTasks,
  dayNumber,
  isClosingStretchActive,
  missNotice,
  selectTodayTask,
  todayKey,
  weekProgress,
  type MissNotice,
} from '../lib/today';
import { goalTrend, greetingFor, journeyDays, milestones, practiceStreak, practiceTimeLabel, practiceTotals, START_SESSION_STATE } from '../lib/dashboard';
import { comingUp, formatMetric } from '../lib/plan';
import { Badge, Button, LoadingState, ProgressRing, Skeleton } from '../components/ui';
import type { Goal } from '../types';
import { doneDaysOf, visibleDay } from '../lib/stepLines';
import { GettingReady } from '../components/today/WeekClose';
import { Momentum } from '../components/dashboard/Momentum';
import { JourneyMap } from '../components/dashboard/JourneyMap';
import { NameForm } from '../components/dashboard/NameForm';
import { planDays } from '../lib/planLength';

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

/**
 * ND-29: the Dashboard answers "how am I doing" (ND-19 keeps it an overview; Today is where a step is done). Today's
 * session sits first with one way in; below it, the whole plan as a map of days (the goal's own measure is on the Plan page). Every
 * number is real stored state, and the page writes nothing.
 */
export const Dashboard: React.FC = () => {
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal, reconciliation, closingWeek } = useGoal();
  const timezone = useUserTimezone();
  const { firstName, setFirstName } = useFirstName();
  const [naming, setNaming] = React.useState(false);
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
  const day = dayNumber(activeGoal, now, timezone);
  const { practiceDays, practiceDone } = weekProgress(tasks);
  const isDone = task?.status === 'completed';
  const isRest = Boolean(task?.isRestDay) && !isDone;
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
  const totalDays = planDays(activeGoal);
  const mapSummary = totals.daysDone + ' of ' + totals.daysSoFar + ' practice days done so far. Day ' + day + ' of ' + totalDays + '.';

  const eyebrow = isDone ? 'Done for today' : isRest ? 'Rest day' : 'Today';
  const heading = isDone
      ? 'Today is done.'
      : isRest
        ? 'Rest is part of the plan.'
        : task?.title || 'Your next session is ready.';
  const support = isDone
      ? 'Session ' + totals.sessionsDone + ' is in the books. Come back tomorrow.'
      : isRest
        ? 'Nothing is due today. Let the work settle in.'
        : task?.whyToday;
  const cta = isDone || isRest ? 'See today' : gentle ? 'Start the 10-minute version' : 'Start session';
  const startsSession = !isDone && !isRest && Boolean(task);

  const streak = practiceStreak(days);
  const today = todayKey(now, timezone);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weekDots = tasks.map((t) => ({ id: t.id, label: t.dayOfWeek.slice(0, 1), state: byDate.get(t.date)?.state ?? 'quiet' }));
  const upcoming = comingUp(activeGoal, today);

  return (
    <main id="main" className="ui-root relative mx-auto w-full max-w-6xl flex-1 px-gutter py-10 sm:py-14">
      <header className="animate-rise-in" style={stagger(0)}>
        <p className="font-ui-mono text-micro uppercase text-text-secondary">{dateLabel}</p>
        <h1 className="mt-3 text-h2 text-text">
          {greetingFor(now, timezone)}
          {firstName ? ', ' + firstName : ''}.
        </h1>
        {!firstName && setFirstName && (
          naming ? (
            <div className="mt-4 max-w-sm"><NameForm label="What should we call you?" onSaved={() => setNaming(false)} /></div>
          ) : (
            <Button variant="quiet" size="sm" className="-ml-4 mt-1" onClick={() => setNaming(true)}>Add your name</Button>
          )
        )}
        <p className="mt-3 max-w-2xl text-body-lg text-text-secondary">{status}</p>
      </header>

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="next-heading"
          className={'dash-card animate-rise-in flex flex-col p-7 sm:p-9' + (isDone ? ' today-done' : '')}
          style={stagger(80)}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-ui-mono text-micro uppercase text-achievement">{eyebrow} · Day {day}</p>
            {startsSession && task?.isTestDay ? <Badge tone="achievement">Test day</Badge> : startsSession && task?.isKeySession ? <Badge tone="achievement">Key session</Badge> : null}
          </div>
          {isDone && (
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
              variant={startsSession ? 'gold' : 'secondary'}
              size="lg"
              trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            >
              <Link to="/" state={startsSession ? START_SESSION_STATE : undefined}>{cta}</Link>
            </Button>
          </div>
        </section>

        <GoalCard goal={activeGoal} day={day} totalDays={totalDays} stagger={stagger(160)} />
      </div>

      <section aria-label="Your numbers" className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={Flame} label="Streak" stagger={stagger(220)}>
          <p className="tabular dash-tile__value text-text">
            {streak.current}
            <span className="ml-1.5 text-body font-normal tracking-normal text-text-secondary">{streak.current === 1 ? 'day' : 'days'}</span>
          </p>
          <p className="mt-2 text-small text-text-secondary">{streak.best > streak.current ? 'Best: ' + plural(streak.best, 'day', 'days') : streak.current > 0 ? 'Your best yet' : 'Starts with today'}</p>
        </Tile>
        <Tile icon={CircleCheck} label="Sessions" stagger={stagger(260)}>
          <Momentum goalId={activeGoal.id} sessions={totals.sessionsDone} minutes={totals.minutesPractised} />
        </Tile>
        <Tile icon={Timer} label="Practice time" stagger={stagger(300)}>
          <p className="tabular dash-tile__value text-text">{practiceTimeLabel(totals.minutesPractised)}</p>
          <p className="mt-2 text-small text-text-secondary">practised so far</p>
        </Tile>
        <Tile icon={CalendarCheck} label="This week" stagger={stagger(340)}>
          <p className="tabular dash-tile__value text-text">
            {practiceDone}
            <span className="ml-1 text-body font-normal tracking-normal text-text-secondary">of {practiceDays}</span>
          </p>
          <ol className="mt-3 flex gap-1.5" aria-label={practiceDone + ' of ' + practiceDays + ' sessions done this week'}>
            {weekDots.map((dot) => (
              <li key={dot.id} className="dash-week-dot" data-state={dot.state} aria-hidden="true" />
            ))}
          </ol>
        </Tile>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <section aria-labelledby="map-heading" className="dash-panel animate-rise-in p-7" style={stagger(400)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="map-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Your {totalDays} days</h2>
            <p className="tabular text-small text-text-secondary">
              <span className="text-text">{totals.daysDone}</span> of {totals.daysSoFar} practice days done
            </p>
          </div>
          <div className="mt-6"><JourneyMap days={days} summary={mapSummary} /></div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-small text-text-secondary" aria-label="Map key">
            <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="dash-key" data-state="done" />Done</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="dash-key" data-state="missed" />Not done</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="dash-key" data-state="rest" />Rest</li>
            <li className="inline-flex items-center gap-2"><span aria-hidden="true" className="dash-key" data-state="ahead" />Ahead</li>
          </ul>
        </section>

        <section aria-labelledby="next-up-heading" className="dash-panel animate-rise-in p-7" style={stagger(460)}>
          <h2 id="next-up-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Coming up</h2>
          <ol className="mt-5 flex flex-col">
            {upcoming.map((item) => {
              const Icon = item.kind === 'check' ? Target : item.kind === 'phase' ? Flag : Trophy;
              return (
                <li key={item.kind} className="flex gap-4 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
                  <span className="dash-upcoming__icon" data-kind={item.kind} aria-hidden="true">
                    <Icon strokeWidth={1.5} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-body font-medium text-text">{item.title}</p>
                      <p className="shrink-0 text-small text-text-secondary">{item.when}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-small text-text-secondary">{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <Button asChild variant="quiet" size="sm" className="-ml-4 mt-4" trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}>
            <Link to="/roadmap">See the whole roadmap</Link>
          </Button>
        </section>
      </div>
    </main>
  );
};

const Tile: React.FC<{ icon: LucideIcon; label: string; stagger: React.CSSProperties; children: React.ReactNode }> = ({ icon: Icon, label, stagger, children }) => (
  <div className="dash-panel animate-rise-in p-5 sm:p-6" style={stagger}>
    <p className="flex items-center gap-2 text-small text-text-secondary">
      <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 text-achievement" />
      {label}
    </p>
    <div className="mt-4">{children}</div>
  </div>
);

/**
 * The goal at a glance: one ring for how far along the person is (the goal's own measure when it has a number, the
 * milestones reached for a goal of deliverables, else the days of the plan), with now and the goal beneath.
 */
const GoalCard: React.FC<{ goal: Goal; day: number; totalDays: number; stagger: React.CSSProperties }> = ({ goal, day, totalDays, stagger }) => {
  const trend = goalTrend(goal);
  const checks = milestones(goal);
  let share: number;
  let caption: string;
  if (trend && trend.gapClosed !== null) {
    share = trend.gapClosed;
    caption = 'of the way to ' + formatMetric(trend.target, trend.unit);
  } else if (!trend && checks.total > 0) {
    share = checks.reached / checks.total;
    caption = checks.reached + ' of ' + checks.total + ' milestones';
  } else {
    share = Math.min(1, day / Math.max(1, totalDays));
    caption = 'of the plan · day ' + day + ' of ' + totalDays;
  }
  const percent = Math.round(share * 100);
  return (
    <section aria-labelledby="goal-heading" className="dash-panel animate-rise-in flex flex-col p-7" style={stagger}>
      <h2 id="goal-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Your goal</h2>
      <p className="mt-2 line-clamp-2 text-body text-text">{goal.rawGoal}</p>
      <div className="mt-6 flex items-center gap-6">
        <ProgressRing label="Progress toward your goal" value={percent} valueText={percent + '% ' + caption} size={8.5}>
          <span className="tabular block text-3xl font-semibold tracking-[-0.03em] text-text">{percent}%</span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-small text-text-secondary">{caption}</p>
          {trend && (
            <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-small">
              {(trend.latest ?? trend.start) !== null && (
                <>
                  <dt className="text-text-secondary">{trend.latest !== null ? 'Now' : 'Start'}</dt>
                  <dd className="tabular text-text">{formatMetric((trend.latest ?? trend.start)!, trend.unit)}</dd>
                </>
              )}
              <dt className="text-text-secondary">Goal</dt>
              <dd className="tabular text-achievement">{formatMetric(trend.target, trend.unit)}</dd>
            </dl>
          )}
          {trend?.newBest && <Badge tone="achievement" className="mt-3">New best</Badge>}
        </div>
      </div>
    </section>
  );
};

export default Dashboard;
