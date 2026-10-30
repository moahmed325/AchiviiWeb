import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Compass } from 'lucide-react';
import { useGoal } from '../context/GoalContext';
import { useUserTimezone } from '../context/AuthContext';
import { useJourneyData } from '../hooks/useJourneyData';
import { Badge, Button, cx } from '../components/ui';
import { Staircase } from '../components/journey/Staircase';
import { goalTrend, milestones } from '../lib/dashboard';
import { finishDate, formatMetric, stairSteps, weekRows, type WeekRow } from '../lib/plan';
import { planWeeks } from '../lib/planLength';
import { fixedDateLine } from '../lib/fixedDate';
import type { Goal } from '../types';
import type { JourneyData, JourneyPhase } from '../types/journey';

/**
 * ND-31: one page for the plan and how it is going (the Roadmap and Progress pages merged). The goal, the climb (the
 * weekly targets as a staircase, with each recorded check), every week by phase with its dates, target and what was
 * done, the finish line, and why the plan is built the way it is. Read only; nothing here writes.
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

      <Climb goal={goal} journey={journey} />

      <section aria-labelledby="weeks-heading" className="mt-14">
        <h2 id="weeks-heading" className="text-h3 text-text">Week by week</h2>
        <div className="mt-6 flex flex-col gap-10">
          {phases.map((phase) => (
            <PhaseBlock key={phase.id} phase={phase} rows={rows.filter((row) => row.phaseId === phase.id)} />
          ))}
        </div>
      </section>

      <FinishLine goal={goal} journey={journey} finish={finish} />
      <WhyThisPlan goal={goal} />
    </>
  );
};

/** The goal's own measure: the gap closed and the staircase, or the milestones reached for a goal of deliverables. */
const Climb: React.FC<{ goal: Goal; journey: JourneyData }> = ({ goal, journey }) => {
  const trend = goalTrend(goal);
  const steps = stairSteps(goal);
  const checks = milestones(goal);

  if (trend && steps.length > 0) {
    const { unit } = trend;
    const latest = trend.latest;
    const summary =
      `${trend.metric || 'Target'} by week, from ${trend.start !== null ? formatMetric(trend.start, unit) : 'the start'} to ${formatMetric(trend.target, unit)}.` +
      (latest !== null ? ` Latest check ${formatMetric(latest, unit)}.` : ' No check recorded yet.');
    return (
      <section aria-labelledby="climb-heading" className="dash-panel animate-rise-in mt-10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="climb-heading" className="font-ui-mono text-micro uppercase text-text-secondary">{trend.metric || 'Your climb'}</h2>
            {trend.gapClosed !== null ? (
              <p className="mt-3 flex items-baseline gap-2">
                <span className="tabular text-5xl font-semibold tracking-[-0.04em] text-text">{Math.round(trend.gapClosed * 100)}%</span>
                <span className="text-body text-text-secondary">of the gap closed</span>
              </p>
            ) : (
              <p className="mt-3 text-h3 text-text">
                {trend.start !== null ? formatMetric(trend.start, unit) + ' → ' : ''}
                {formatMetric(trend.target, unit)}
              </p>
            )}
          </div>
          <div className="text-right">
            {trend.newBest && <Badge tone="achievement">New best</Badge>}
            <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-small">
              {trend.start !== null && (
                <>
                  <dt className="text-text-secondary">Start</dt>
                  <dd className="tabular text-text">{formatMetric(trend.start, unit)}</dd>
                </>
              )}
              {latest !== null && (
                <>
                  <dt className="text-text-secondary">Latest</dt>
                  <dd className="tabular text-text">{formatMetric(latest, unit)}</dd>
                </>
              )}
              <dt className="text-text-secondary">Goal</dt>
              <dd className="tabular text-achievement">{formatMetric(trend.target, unit)}</dd>
            </dl>
          </div>
        </div>
        <div className="mt-6">
          <Staircase
            steps={steps}
            start={trend.start}
            points={trend.points}
            direction={trend.direction}
            unit={unit}
            totalWeeks={planWeeks(goal)}
            currentWeek={journey.metrics.currentWeek}
            phases={goal.roadmap?.phases ?? []}
            summary={summary}
          />
        </div>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-small text-text-secondary">
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="stair-key stair-key--line" />Weekly target</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="stair-key stair-key--met" />Check that met it</span>
          <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="stair-key" />Check that didn't yet</span>
        </p>
      </section>
    );
  }

  if (checks.total === 0) return null;
  return (
    <section aria-labelledby="climb-heading" className="dash-panel animate-rise-in mt-10 p-6 sm:p-8">
      <h2 id="climb-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Milestones</h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-5xl font-semibold tracking-[-0.04em] text-text">{checks.reached}</span>
        <span className="text-body text-text-secondary">of {checks.total} reached</span>
      </p>
    </section>
  );
};

const phaseState = (phase: JourneyPhase) => (phase.status === 'completed' ? 'Done' : phase.status === 'active' ? 'Now' : null);

const PhaseBlock: React.FC<{ phase: JourneyPhase; rows: WeekRow[] }> = ({ phase, rows }) => {
  const state = phaseState(phase);
  return (
    <section aria-labelledby={'phase-' + phase.id} className="road-phase" data-status={phase.status}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={'phase-' + phase.id} className="text-body-lg font-medium text-text">{phase.name}</h3>
        <span className="font-ui-mono text-micro uppercase text-text-secondary">{phase.weeksLabel}</span>
        {state && <span className={cx('font-ui-mono text-micro uppercase', state === 'Now' ? 'text-achievement' : 'text-text-secondary')}>{state}</span>}
      </div>
      {phase.purpose && <p className="mt-1 max-w-2xl text-small text-text-secondary">{phase.purpose}</p>}
      <ol className="mt-4 border-t border-border">
        {rows.map((row) => (
          <WeekLine key={row.weekNumber} row={row} />
        ))}
      </ol>
    </section>
  );
};

const WeekLine: React.FC<{ row: WeekRow }> = ({ row }) => {
  const current = row.state === 'current';
  const ahead = row.state === 'ahead';
  return (
    <li className="road-week-row" data-state={row.state} aria-current={current ? 'step' : undefined}>
      <div className="min-w-0">
        <p className={cx('font-ui-mono text-micro uppercase', current ? 'text-achievement' : 'text-text-secondary')}>
          Week {row.weekNumber}
          {row.dates && <span className="ml-2 normal-case tracking-normal">{row.dates}</span>}
        </p>
        <p className={cx('mt-1 text-body', ahead ? 'text-text-secondary' : 'text-text')}>
          {row.title}
          {current && <Badge tone="achievement" className="ml-2 align-middle">This week</Badge>}
        </p>
        {(row.target || row.test) && (
          <p className="mt-1 text-small text-text-secondary">
            {row.target && <>Target {row.target}</>}
            {row.target && row.test && <span aria-hidden="true"> · </span>}
            {row.test && <>Check: {row.test}</>}
          </p>
        )}
        {row.insight && row.state === 'done' && <p className="mt-2 max-w-2xl text-small text-text-secondary">{row.insight}</p>}
      </div>
      <div className="road-week-row__side">
        {row.state === 'paused' && <span className="font-ui-mono text-micro uppercase text-text-secondary">Paused</span>}
        {row.result && (
          <p className="tabular text-body text-text">
            {row.result.text}
            {row.result.met !== null && (
              <span className={cx('mt-0.5 flex items-center justify-end gap-1 text-small', row.result.met ? 'text-achievement' : 'text-text-secondary')}>
                {row.result.met && <Check aria-hidden="true" strokeWidth={2} className="size-3.5" />}
                {row.result.margin
                  ? row.result.met
                    ? `beat by ${row.result.margin}`
                    : `${row.result.margin} to go`
                  : row.result.met
                    ? 'met'
                    : 'not yet'}
              </span>
            )}
          </p>
        )}
        {row.sessions && row.state !== 'ahead' && (
          <p className="tabular text-small text-text-secondary">
            {row.sessions.done} of {row.sessions.planned} days
          </p>
        )}
      </div>
    </li>
  );
};

const FinishLine: React.FC<{ goal: Goal; journey: JourneyData; finish: string | null }> = ({ goal, journey, finish }) => {
  const finalTest = goal.roadmap?.finalTest?.trim() || null;
  const trend = goalTrend(goal);
  const { closingStretch } = journey;
  return (
    <section aria-labelledby="finish-heading" className="road-finish mt-14 p-6 sm:p-8">
      <p className="font-ui-mono text-micro uppercase text-achievement">✦ Finish line</p>
      <h2 id="finish-heading" className="mt-3 text-h3 text-text">{goal.rawGoal}</h2>
      <dl className="mt-5 grid gap-4 text-small sm:grid-cols-3">
        {finish && (
          <div>
            <dt className="text-text-secondary">Last day</dt>
            <dd className="mt-1 text-body text-text">{finish}</dd>
          </div>
        )}
        {trend && (
          <div>
            <dt className="text-text-secondary">{trend.metric || 'Target'}</dt>
            <dd className="tabular mt-1 text-body text-text">{formatMetric(trend.target, trend.unit)}</dd>
          </div>
        )}
        {closingStretch.startDay <= closingStretch.endDay && (
          <div>
            <dt className="text-text-secondary">Closing stretch</dt>
            <dd className="mt-1 text-body text-text">Days {closingStretch.startDay}–{closingStretch.endDay}</dd>
          </div>
        )}
      </dl>
      {finalTest && <p className="mt-5 max-w-2xl text-body text-text-secondary">Final test: {finalTest}</p>}
      {journey.week12Line && <p className="mt-2 max-w-2xl text-small text-text-secondary">{journey.week12Line}</p>}
    </section>
  );
};

/** The method the plan is built on, kept from the moment it was chosen: shown on request. */
const WhyThisPlan: React.FC<{ goal: Goal }> = ({ goal }) => {
  const [open, setOpen] = React.useState(false);
  const method = goal.roadmap?.method;
  if (!method?.name?.trim()) return null;
  const rules = (method.rules ?? []).filter((rule) => rule.trim());
  return (
    <section className="mt-10 border-t border-border">
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
