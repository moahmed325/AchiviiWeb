import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Compass } from 'lucide-react';
import { useJourneyData } from '../hooks/useJourneyData';
import { StrategicRoadmap } from '../components/journey/StrategicRoadmap';
import { Button, StepMarker } from '../components/ui';
import { formatGoalTitle } from '../lib/formatters';

export const RoadmapPage: React.FC = () => {
  const journey = useJourneyData();

  return (
    <main id="main" tabIndex={-1} className="ui-root relative mx-auto w-full max-w-5xl px-gutter py-10 focus:outline-none sm:py-16">
      {!journey ? <EmptyRoadmap /> : <RoadmapContent journey={journey} />}
    </main>
  );
};

const EmptyRoadmap: React.FC = () => (
  <div className="dash-card mx-auto my-16 max-w-md p-8 text-center">
    <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-achievement/30 bg-achievement/10 text-achievement">
      <Compass className="size-5" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <h1 className="mt-6 text-h3 text-text">No Active Journey</h1>
    <p className="mt-2 text-body text-text-secondary">Create a 90-day goal to build your roadmap.</p>
    <Button asChild variant="gold" className="mt-7">
      <Link to="/onboarding">Create Your Journey</Link>
    </Button>
  </div>
);

const RoadmapContent: React.FC<{ journey: NonNullable<ReturnType<typeof useJourneyData>> }> = ({ journey }) => {
  const title = formatGoalTitle(journey.clarifiedOutcome, journey.rawGoal);
  const { metrics, phases } = journey;
  const activePhase = phases.find((phase) => phase.status === 'active') || phases[0];
  const daysToGo = Math.max(0, metrics.totalDays - metrics.currentDay);
  const stagger = (ms: number): React.CSSProperties => ({ animationDelay: ms + 'ms' });

  return (
    <>
      <div aria-hidden="true" className="dash-glow" />
      <div className="relative space-y-12">
        <header className="animate-rise-in space-y-8" style={stagger(0)}>
          <Link to="/" className="focus-ring -ml-2 inline-flex items-center gap-2 rounded-control px-2 py-1 text-small text-text-secondary transition hover:text-text">
            <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
            Today
          </Link>

          <div className="min-w-0">
            <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Your roadmap</p>
            <h1 className="mt-4 max-w-3xl text-h2 text-text sm:text-h1">{title}</h1>
            {journey.methodName && (
              <p className="mt-4 text-small text-text-secondary">{journey.methodName}{journey.methodAuthor ? ' \u00b7 ' + journey.methodAuthor : ''}</p>
            )}
          </div>

          <dl className="grid grid-cols-3 divide-x divide-border border-y border-border py-6">
            <Stat label="Day" value={metrics.currentDay} suffix={'of ' + metrics.totalDays} gold />
            <Stat label="Week" value={metrics.currentWeek} suffix={'of ' + metrics.totalWeeks} />
            <Stat label="Days to go" value={daysToGo} />
          </dl>

          <div>
            <div role="img" aria-label={'Week ' + metrics.currentWeek + ' of ' + metrics.totalWeeks} className="flex gap-3">
              {phases.map((phase) => (
                <div key={phase.id} className="flex gap-1" style={{ flex: phase.weeks.length + ' 1 0%' }}>
                  {phase.weeks.map((week) => (
                    <span
                      key={week.weekNumber}
                      className="road-week flex-1"
                      data-state={week.status === 'completed' ? 'completed' : week.isCurrentWeek ? 'current' : 'upcoming'}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">
              <span>Week 1</span>
              <span className="inline-flex items-center gap-2 text-achievement"><StepMarker state="destination" size="sm" />Day {metrics.totalDays}</span>
            </div>
          </div>
        </header>

        <section aria-label="Where you are" className="dash-card animate-rise-in p-7 sm:p-10" style={stagger(140)}>
          <div className="flex items-center gap-3">
            <span className="size-2.5 shrink-0 rounded-full bg-achievement shadow-[0_0_18px_2px] shadow-achievement/50" aria-hidden="true" />
            <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">You are here</p>
          </div>
          <h2 className="mt-5 max-w-[24ch] text-h2 text-text">{activePhase?.name || 'Current phase'}</h2>
          {activePhase?.purpose && <p className="mt-4 max-w-2xl text-body leading-7 text-text-secondary">{activePhase.purpose}</p>}
          <Button asChild variant="gold" size="lg" className="mt-8" trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}>
            <Link to="/">Continue your session</Link>
          </Button>
        </section>

        <div className="animate-rise-in" style={stagger(260)}>
          <StrategicRoadmap journey={journey} />
        </div>
      </div>
    </>
  );
};

const Stat: React.FC<{ label: string; value: number; suffix?: string; gold?: boolean }> = ({ label, value, suffix, gold }) => (
  <div className="px-4 first:pl-0 sm:px-8 sm:first:pl-0">
    <dt className="font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">{label}</dt>
    <dd className="mt-3 flex flex-wrap items-baseline gap-x-2">
      <span className={'tabular text-h2 ' + (gold ? 'text-achievement' : 'text-text')}>{value}</span>
      {suffix && <span className="text-small text-text-secondary">{suffix}</span>}
    </dd>
  </div>
);

export default RoadmapPage;
