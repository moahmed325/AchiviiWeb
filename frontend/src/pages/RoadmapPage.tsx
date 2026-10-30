import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Compass } from 'lucide-react';
import { useGoal } from '../context/GoalContext';
import { useUserTimezone } from '../context/AuthContext';
import { useJourneyData } from '../hooks/useJourneyData';
import { Button, ProgressBar, VisuallyHidden, cx } from '../components/ui';
import { finishDate, weekRows, type WeekRow } from '../lib/plan';
import { planWeeks } from '../lib/planLength';
import { fixedDateLine } from '../lib/fixedDate';
import type { Goal } from '../types';
import type { JourneyData, JourneyPhase } from '../types/journey';

/**
 * ND-32: the plan at a glance, kept calm. Where the plan stands, the practice days done so far, every week as one cell
 * under its phase, this week's focus, the finish line, and (on request) why the plan works. Read
 * only; nothing here writes.
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
  const thisWeek = rows.find((row) => row.state === 'current') ?? null;

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

      <Progress rows={rows} />
      <Weeks phases={phases} rows={rows} />
      {thisWeek && <ThisWeek row={thisWeek} />}

      <section aria-labelledby="finish-heading" className="animate-rise-in mt-12 border-t border-border pt-8" style={{ animationDelay: '360ms' }}>
        <h2 id="finish-heading" className="font-ui-mono text-micro uppercase text-achievement">
          ✦ Finish line{finish ? ' · ' + finish : ''}
        </h2>
        <p className="mt-3 max-w-2xl text-body text-text">The last day of week {totalWeeks}. No final test: finishing the plan is the finish line.</p>
      </section>

      <WhyThisPlan goal={goal} />
    </>
  );
};

/**
 * The practice days done so far, out of the days written. No weekly tests (ND-33): the plan moves on what was done, so
 * that is what this shows. Nothing before the first day is written.
 */
const Progress: React.FC<{ rows: WeekRow[] }> = ({ rows }) => {
  const done = rows.reduce((sum, row) => sum + (row.sessions?.done ?? 0), 0);
  const planned = rows.reduce((sum, row) => sum + (row.sessions?.planned ?? 0), 0);
  if (planned === 0) return null;
  return (
    <section aria-labelledby="progress-heading" className="dash-panel animate-rise-in mt-10 p-6 sm:p-8" style={{ animationDelay: '120ms' }}>
      <h2 id="progress-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Practice days</h2>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="tabular text-5xl font-semibold tracking-[-0.04em] text-text">{done}</span>
        <span className="text-body text-text-secondary">of {planned} done so far</span>
      </p>
      <ProgressBar className="mt-6" tone="achievement" hideLabel label="Practice days done" value={done} max={planned} valueText={done + ' of ' + planned} />
    </section>
  );
};

const stateWords: Record<WeekRow['state'], string> = { done: 'done', current: 'this week', ahead: 'ahead', paused: 'paused' };

/** Every week as one quiet cell, grouped under its phase: done weeks filled, this week ringed, a paused week dashed. */
const Weeks: React.FC<{ phases: JourneyPhase[]; rows: WeekRow[] }> = ({ phases, rows }) => (
  <section aria-labelledby="weeks-heading" className="animate-rise-in mt-12" style={{ animationDelay: '220ms' }}>
    <h2 id="weeks-heading" className="font-ui-mono text-micro uppercase text-text-secondary">Your {rows.length} weeks</h2>
    <div className="road-phases mt-5">
      {phases.map((phase) => {
        const weeks = rows.filter((row) => row.phaseId === phase.id);
        if (weeks.length === 0) return null;
        return (
          <div key={phase.id} className="road-phases__phase" style={{ flexGrow: weeks.length }} data-status={phase.status}>
            <ol className="road-cells" aria-label={phase.name}>
              {weeks.map((row) => (
                <li key={row.weekNumber} className="road-cell" data-state={row.state} aria-current={row.state === 'current' ? 'step' : undefined}>
                  <span aria-hidden="true">{row.weekNumber}</span>
                  <VisuallyHidden>{'Week ' + row.weekNumber + ', ' + stateWords[row.state]}</VisuallyHidden>
                </li>
              ))}
            </ol>
            <p className={cx('mt-3 truncate text-small', phase.status === 'active' ? 'text-text' : 'text-text-secondary')} aria-hidden="true">
              {phase.name}
            </p>
          </div>
        );
      })}
    </div>
  </section>
);

/** The week being lived: what it is about and the days done so far. */
const ThisWeek: React.FC<{ row: WeekRow }> = ({ row }) => (
  <section aria-labelledby="this-week-heading" className="dash-panel animate-rise-in mt-8 p-6 sm:p-8" style={{ animationDelay: '300ms' }}>
    <div className="flex items-center justify-between gap-3">
      <p className="font-ui-mono text-micro uppercase text-achievement">This week · Week {row.weekNumber}</p>
      {row.sessions && (
        <p className="tabular text-small text-text-secondary">
          {row.sessions.done} of {row.sessions.planned} days
        </p>
      )}
    </div>
    <h2 id="this-week-heading" className="mt-3 text-h3 text-text">{row.title}</h2>
  </section>
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
