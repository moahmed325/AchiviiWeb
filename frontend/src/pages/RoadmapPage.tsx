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
  <div className="dash-panel mx-auto my-16 max-w-md p-8 text-center">
    <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-achievement/30 bg-achievement/10 text-achievement">
      <Compass className="size-5" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <h1 className="mt-5 text-h3 text-text">No Active Journey</h1>
    <p className="mt-2 text-body text-text-secondary">Create a 90-day goal to build your roadmap.</p>
    <Button asChild variant="gold" className="mt-6"><Link to="/onboarding">Create Your Journey</Link></Button>
  </div>
);

const stagger = (ms: number): React.CSSProperties => ({ animationDelay: ms + 'ms' });

const RoadmapContent: React.FC<{ journey: NonNullable<ReturnType<typeof useJourneyData>> }> = ({ journey }) => {
  const title = formatGoalTitle(journey.clarifiedOutcome, journey.rawGoal);
  const { metrics, phases } = journey;
  const activePhase = phases.find((phase) => phase.status === 'active') || phases[0];
  const daysToGo = Math.max(0, metrics.totalDays - metrics.currentDay);
  const stats = [
    { label: 'Day', value: metrics.currentDay, of: metrics.totalDays, gold: true },
    { label: 'Week', value: metrics.currentWeek, of: metrics.totalWeeks, gold: false },
    { label: 'Days to go', value: daysToGo, of: null, gold: false },
  ];

  return (
    <>
      <div aria-hidden="true" className="dash-glow" />

      <header className="animate-rise-in relative" style={stagger(0)}>
        <Link to="/" className="focus-ring -ml-1 inline-flex items-center gap-2 rounded-md px-1 py-1 text-small text-text-secondary transition-colors hover:text-text">
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Today
        </Link>
        <p className="mt-8 font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Your roadmap</p>
        <h1 className="mt-4 max-w-3xl text-h2 text-text sm:text-h1">{title}</h1>
        {journey.methodName && <p className="mt-4 text-body text-text-secondary">{journey.methodName}{journey.methodAuthor ? ' \u00b7 ' + journey.methodAuthor : ''}</p>}

        <dl className="mt-10 grid grid-cols-3 divide-x divide-border">
          {stats.map((stat, index) => (
            <div key={stat.label} className={index === 0 ? 'pr-4 sm:pr-8' : 'px-4 sm:px-8'}>
              <dt className="font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">{stat.label}</dt>
              <dd className="mt-2 flex items-baseline gap-2">
                <span className={'tabular text-h2 ' + (stat.gold ? 'text-achievement' : 'text-text')}>{stat.value}</span>
                {stat.of !== null && <span className="font-ui-mono text-small text-text-secondary">/ {stat.of}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-9" role="img" aria-label={'Week ' + metrics.currentWeek + ' of ' + metrics.totalWeeks}>
          <div className="flex gap-3">
            {phases.map((phase) => (
              <div key={phase.id} className="flex gap-1" style={{ flex: phase.weeks.length + ' 1 0%' }}>
                {phase.weeks.map((week) => (
                  <span key={week.weekNumber} className="road-week flex-1" data-state={week.status === 'completed' ? 'completed' : week.isCurrentWeek ? 'current' : 'upcoming'} />
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

      <section aria-label="Current position" className="dash-card animate-rise-in relative mt-12 p-7 sm:p-10" style={stagger(140)}>
        <div className="flex items-center gap-3">
          <span className="size-2 shrink-0 rounded-full bg-achievement" style={{ boxShadow: '0 0 14px 2px color-mix(in oklab, var(--color-achievement) 55%, transparent)' }} aria-hidden="true" />
          <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">You are here</p>
        </div>
        <h2 className="mt-5 max-w-[24ch] text-h2 text-text">{activePhase?.name || 'Current phase'}</h2>
        {activePhase?.purpose && <p className="mt-4 max-w-2xl text-body leading-7 text-text-secondary">{activePhase.purpose}</p>}
        <div className="mt-8">
          <Button asChild variant="gold" trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}>
            <Link to="/">Continue your session</Link>
          </Button>
        </div>
      </section>

      <div className="relative mt-16">
        <StrategicRoadmap journey={journey} />
      </div>
    </>
  );
};

export default RoadmapPage;
