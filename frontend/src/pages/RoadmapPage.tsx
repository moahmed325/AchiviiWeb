import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useJourneyData } from '../hooks/useJourneyData';
import { StrategicRoadmap } from '../components/journey/StrategicRoadmap';
import { formatGoalTitle } from '../lib/formatters';

export const RoadmapPage: React.FC = () => {
  const journey = useJourneyData();

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 focus:outline-none">
      {!journey ? <EmptyRoadmap /> : <RoadmapContent journey={journey} />}
    </main>
  );
};

const EmptyRoadmap: React.FC = () => (
  <div className="mx-auto my-16 max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-raised">
    <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 text-[#E7C65C]">
      <Compass className="size-5" aria-hidden="true" />
    </div>
    <h1 className="mt-5 text-xl font-semibold tracking-tight text-text">No Active Journey</h1>
    <p className="mt-2 text-sm leading-6 text-text-secondary">Create a 90-day goal to build your roadmap.</p>
    <Link to="/onboarding" className="mt-6 inline-flex rounded-xl bg-[#C9A227] px-5 py-2.5 text-sm font-semibold text-[#11100C] transition hover:bg-[#E7C65C]">
      Create Your Journey
    </Link>
  </div>
);

const RoadmapContent: React.FC<{ journey: NonNullable<ReturnType<typeof useJourneyData>> }> = ({ journey }) => {
  const title = formatGoalTitle(journey.clarifiedOutcome, journey.rawGoal);
  const { metrics } = journey;
  const activePhase = journey.phases.find((phase) => phase.status === 'active') || journey.phases[0];

  return (
    <div className="space-y-8">
      <header className="space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-text-secondary transition hover:text-text">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Today
        </Link>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-ui-mono uppercase tracking-[0.18em] text-[#C9A227]">Your roadmap</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.02em] text-text sm:text-4xl">{title}</h1>
            {journey.methodName && <p className="mt-3 text-sm text-text-secondary">{journey.methodName}{journey.methodAuthor ? ' · ' + journey.methodAuthor : ''}</p>}
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xs text-text-secondary">Current position</p>
            <p className="mt-1 font-ui-mono text-sm font-medium text-text">Week {metrics.currentWeek} <span className="text-text-secondary">of {metrics.totalWeeks}</span></p>
          </div>
        </div>
        <div className="h-px bg-border"><div className="h-px bg-[#C9A227] transition-all duration-700" style={{ width: metrics.percentComplete + '%' }} /></div>
      </header>

      <section className="rounded-3xl border border-[#C9A227]/25 bg-gradient-to-br from-[#C9A227]/10 via-surface to-surface p-5 shadow-raised sm:p-7">
        <div className="flex items-start gap-4">
          <span className="mt-1 size-2.5 shrink-0 rounded-full bg-[#E7C65C] shadow-[0_0_18px_rgba(231,198,92,0.55)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[11px] font-ui-mono uppercase tracking-[0.16em] text-[#C9A227]">You are here</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text">{activePhase?.name || 'Current phase'}</h2>
            {activePhase?.purpose && <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{activePhase.purpose}</p>}
          </div>
        </div>
      </section>

      <StrategicRoadmap journey={journey} />
    </div>
  );
};

export default RoadmapPage;