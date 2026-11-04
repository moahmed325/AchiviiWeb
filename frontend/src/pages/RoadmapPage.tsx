import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Compass, Trophy } from 'lucide-react';
import { useGoal } from '../context/GoalContext';
import { useUserTimezone } from '../context/AuthContext';
import { useJourneyData } from '../hooks/useJourneyData';
import { Badge, Button, ProgressBar, ProgressRing, cx } from '../components/ui';
import { finishDate, weekRows, type WeekRow } from '../lib/plan';
import { planWeeks } from '../lib/planLength';
import { fixedDateLine } from '../lib/fixedDate';
import type { Goal } from '../types';
import type { JourneyData, JourneyPhase } from '../types/journey';

/**
 * ND-33: the plan and the person's progress, calm. A progress card (a ring for the plan's weeks done and plain counts;
 * no weekly checks, ND-35), then the whole plan by phase: each phase and each week's
 * title always shown, a week's details opening on request (this week open), the finish line, and why the plan works.
 * Read only; nothing here writes.
 */
export const RoadmapPage: React.FC = () => {
  const journey = useJourneyData();
  const { activeGoal } = useGoal();

  return (
    <main id="main" tabIndex={-1} className="ui-root relative mx-auto w-full max-w-4xl px-gutter py-10 focus:outline-none sm:py-16">
      {!journey || !activeGoal ? <EmptyRoadmap /> : <RoadmapContent journey={journey} goal={activeGoal} />}
    </main>
  );
};

const EmptyRoadmap: React.FC = () => (
  <div className="dash-panel mx-auto my-16 max-w-md p-8 text-center">
    <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-achievement/30 text-achievement">
      <Compass className="size-5" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <h1 className="mt-5 text-h3 text-text">No active journey</h1>
    <p className="mt-2 text-body text-text-secondary">Choose a goal to build your plan.</p>
    <Button asChild variant="gold" className="mt-6">
      <Link to="/onboarding">Choose a goal</Link>
    </Button>
  </div>
);

const RoadmapContent: React.FC<{ journey: JourneyData; goal: Goal }> = ({ journey, goal }) => {
  const timezone = useUserTimezone();
  const { metrics, phases } = journey;
  const totalWeeks = planWeeks(goal);
  const currentPhase = phases.find((phase) => phase.status === 'active');
  const finish = finishDate(goal);
  const dateLine = fixedDateLine(goal, new Date(), timezone);
  const rows = weekRows(goal, journey);

  return (
    <>
      <header className="animate-rise-in">
        <p className="font-ui-mono text-micro uppercase text-achievement">Roadmap</p>
        <h1 className="mt-3 max-w-3xl break-words text-h2 text-text">{goal.rawGoal}</h1>
        <p className="mt-3 text-body text-text-secondary">
          Week {metrics.currentWeek} of {totalWeeks}
          {currentPhase ? ' · ' + currentPhase.name : ''}
          {finish ? ' · finishes ' + finish : ''}
        </p>
        {dateLine && <p className="mt-1 text-small text-text-secondary">{dateLine}</p>}
        {/* Next plan (NP-8): the plan this one follows. */}
        {goal.previousPlan && (
          <p className="mt-1 text-small text-text-secondary">
            Plan {goal.previousPlan.number}. Plan {goal.previousPlan.number - 1}: {goal.previousPlan.summary}.
          </p>
        )}
      </header>

      <Progress goal={goal} rows={rows} />

      <section aria-labelledby="plan-heading" className="animate-rise-in mt-12" style={{ animationDelay: '200ms' }}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="plan-heading" className="text-h3 text-text">The plan</h2>
          <p className="text-small text-text-secondary">Tap a week for its details</p>
        </div>
        <ol className="mt-6 flex flex-col gap-4">
          {phases.map((phase) => (
            <PhaseCard key={phase.id} phase={phase} rows={rows.filter((row) => row.phaseId === phase.id)} />
          ))}
          <li className="road-phase road-phase--finish p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="road-phase__mark" data-status="finish" aria-hidden="true"><Trophy strokeWidth={1.5} className="size-4" /></span>
              <div className="min-w-0">
                <h3 className="text-body-lg font-medium text-text">Finish line{finish ? ' · ' + finish : ''}</h3>
                <p className="mt-0.5 text-small text-text-secondary">The last day of week {totalWeeks}. No final test: finishing the plan is the finish line.</p>
              </div>
            </div>
          </li>
        </ol>
      </section>

      <WhyThisPlan goal={goal} />
    </>
  );
};

/**
 * How far along the person is, at a glance: one ring for the share of the plan's weeks done and three plain counts.
 * No weekly tests (ND-35): the plan moves on what was done, so that is what this shows.
 */
const Progress: React.FC<{ goal: Goal; rows: WeekRow[] }> = ({ goal, rows }) => {
  const weeksDone = rows.filter((row) => row.state === 'done').length;
  const sessions = (goal.dailyTasks ?? []).filter((task) => task.status === 'completed' && !task.isRestDay).length;
  const daysDone = rows.reduce((sum, row) => sum + (row.sessions?.done ?? 0), 0);
  const daysPlanned = rows.reduce((sum, row) => sum + (row.sessions?.planned ?? 0), 0);
  const percent = Math.round((weeksDone / Math.max(1, rows.length)) * 100);
  const caption = 'of the plan done';

  return (
    <section aria-labelledby="progress-heading" className="dash-panel animate-rise-in mt-10 p-6 sm:p-8" style={{ animationDelay: '100ms' }}>
      <h2 id="progress-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Your progress</h2>
      <div className="mt-6 flex items-center gap-6">
        <ProgressRing label="Progress toward your goal" value={percent} valueText={percent + '% ' + caption} size={9.5}>
          <span className="tabular block text-4xl font-semibold tracking-[-0.03em] text-text">{percent}%</span>
        </ProgressRing>
        <p className="max-w-[14ch] text-small text-text-secondary">{caption}</p>
      </div>
      <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6">
        <div>
          <dt className="text-small text-text-secondary">Weeks done</dt>
          <dd className="tabular mt-1 text-h3 text-text">{weeksDone}<span className="text-body text-text-secondary"> / {rows.length}</span></dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">Sessions</dt>
          <dd className="tabular mt-1 text-h3 text-text">{sessions}</dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">Practice days</dt>
          <dd className="tabular mt-1 text-h3 text-text">
            {daysDone}
            <span className="text-body text-text-secondary"> / {daysPlanned}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
};

const phaseWords: Record<string, string> = { completed: 'Done', active: 'Now', upcoming: 'Ahead', locked: 'Ahead' };

/** A phase: its name, weeks and purpose always shown, a bar of its weeks done, and each week's title as a row that opens. */
const PhaseCard: React.FC<{ phase: JourneyPhase; rows: WeekRow[] }> = ({ phase, rows }) => {
  const done = rows.filter((row) => row.state === 'done' || row.state === 'paused').length;
  const word = phaseWords[phase.status] ?? 'Ahead';
  return (
    <li className="road-phase p-5 sm:p-6" data-status={phase.status}>
      <section aria-labelledby={'phase-' + phase.id}>
        <div className="flex items-start gap-4">
          <span className="road-phase__mark" data-status={phase.status} aria-hidden="true">
            {phase.status === 'completed' ? <Check strokeWidth={2} className="size-4" /> : <span className="tabular text-small">{phase.index}</span>}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 id={'phase-' + phase.id} className="text-body-lg font-medium text-text">{phase.name}</h3>
              <p className="font-ui-mono text-micro uppercase text-text-secondary">
                {phase.weeksLabel} · <span className={phase.status === 'active' ? 'text-achievement' : undefined}>{word}</span>
              </p>
            </div>
            {phase.purpose && <p className="mt-1 text-small text-text-secondary">{phase.purpose}</p>}
            <ProgressBar className="mt-3" tone="achievement" hideLabel label={phase.name + ' weeks done'} value={done} max={Math.max(1, rows.length)} valueText={done + ' of ' + rows.length + ' weeks'} />
          </div>
        </div>
        <ol className="mt-4 flex flex-col">
          {rows.map((row) => (
            <WeekRowItem key={row.weekNumber} row={row} />
          ))}
        </ol>
      </section>
    </li>
  );
};

const weekWords: Record<WeekRow['state'], string> = { done: 'done', current: 'this week', ahead: 'ahead', paused: 'paused' };

/** One week: its number, title and state always shown; dates, days done and the review's line on request. */
const WeekRowItem: React.FC<{ row: WeekRow }> = ({ row }) => {
  const current = row.state === 'current';
  const [open, setOpen] = React.useState(current);
  const id = 'week-detail-' + row.weekNumber;
  return (
    <li className="road-week" data-state={row.state} aria-current={current ? 'step' : undefined}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={'Week ' + row.weekNumber + ': ' + row.title + ', ' + weekWords[row.state]}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left"
      >
        <span className="road-week__mark" data-state={row.state} aria-hidden="true">
          {row.state === 'done' ? <Check strokeWidth={2.25} className="size-3" /> : null}
        </span>
        <span className="tabular w-16 shrink-0 font-ui-mono text-micro uppercase text-text-secondary">Week {row.weekNumber}</span>
        <span className={cx('min-w-0 flex-1 truncate text-body', row.state === 'ahead' ? 'text-text-secondary' : 'text-text')}>{row.title}</span>
        {current && <span className="hidden shrink-0 sm:inline-flex"><Badge tone="achievement">This week</Badge></span>}
        {row.state === 'paused' && <span className="shrink-0 font-ui-mono text-micro uppercase text-text-secondary">Paused</span>}
        <ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-4 shrink-0 text-text-secondary transition-transform duration-(--duration-base)', open && 'rotate-180')} />
      </button>
      <div id={id} hidden={!open} className="road-week__detail">
        <dl className="grid gap-x-6 gap-y-3 text-small sm:grid-cols-2">
          {row.dates && <Detail term="Dates" value={row.dates} />}
          {row.sessions && row.state !== 'ahead' && <Detail term="Days done" value={row.sessions.done + ' of ' + row.sessions.planned} />}
        </dl>
        {row.insight && row.state === 'done' && <p className="mt-3 text-small text-text-secondary">{row.insight}</p>}
      </div>
    </li>
  );
};

const Detail: React.FC<{ term: string; value: string }> = ({ term, value }) => (
  <div>
    <dt className="text-text-secondary">{term}</dt>
    <dd className="mt-0.5 text-text">{value}</dd>
  </div>
);

/** The method the plan is built on, kept from the moment it was chosen: shown on request. */
const WhyThisPlan: React.FC<{ goal: Goal }> = ({ goal }) => {
  const [open, setOpen] = React.useState(false);
  const method = goal.roadmap?.method;
  if (!method?.name?.trim()) return null;
  const rules = (method.rules ?? []).filter((rule) => rule.trim());
  return (
    <section className="mt-8 border-t border-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="why-this-plan"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-control text-left"
      >
        <span>
          <span className="block text-body font-medium text-text">Why this plan works</span>
          <span className="block text-small text-text-secondary">
            Built on {method.name}
            {method.creator ? ' · ' + method.creator : ''}
          </span>
        </span>
        <ChevronDown aria-hidden="true" strokeWidth={1.5} className={cx('size-5 shrink-0 text-text-secondary transition-transform duration-(--duration-base)', open && 'rotate-180')} />
      </button>
      <div id="why-this-plan" hidden={!open} className="pb-6">
        {method.summary && <p className="max-w-2xl text-body text-text-secondary">{method.summary}</p>}
        {method.whyChosen && <p className="mt-3 max-w-2xl text-body text-text">{method.whyChosen}</p>}
        {rules.length > 0 && (
          <ul className="mt-4 flex max-w-2xl flex-col gap-2">
            {rules.map((rule) => (
              <li key={rule} className="flex gap-3 text-small text-text-secondary">
                <Check aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-4 shrink-0 text-achievement" />
                {rule}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default RoadmapPage;
