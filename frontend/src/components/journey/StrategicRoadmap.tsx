import React, { useState } from 'react';
import { Check, ChevronDown, Lock, Sparkles, Target } from 'lucide-react';
import type { JourneyData, JourneyPhase, JourneyWeek } from '../../types/journey';
import { formatPassIf, formatTarget } from '../../lib/formatters';
import { Badge, StepMarker } from '../ui';

export interface StrategicRoadmapProps { journey: JourneyData; }

const weekTitle = (week: JourneyWeek) => week.focus || week.theme || week.title;

export const StrategicRoadmap: React.FC<StrategicRoadmapProps> = ({ journey }) => {
  const { phases, closingStretch, metrics } = journey;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    phases.forEach((phase) => { initial[phase.id] = phase.status === 'active'; });
    return initial;
  });

  const toggle = (id: string) => setExpanded((current) => ({ ...current, [id]: !current[id] }));

  return (
    <section aria-labelledby="roadmap-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">The path</p>
          <h2 id="roadmap-heading" className="mt-3 text-h2 text-text">Your progression</h2>
        </div>
        <span className="hidden text-small text-text-secondary sm:block">Open a phase for detail</span>
      </div>

      <div className="mt-10">
        {phases.map((phase, index) => (
          <PhaseRow
            key={phase.id}
            phase={phase}
            currentWeek={metrics.currentWeek}
            isOpen={Boolean(expanded[phase.id])}
            onToggle={() => toggle(phase.id)}
            delay={index * 90}
          />
        ))}
        <Destination closingStretch={closingStretch} delay={phases.length * 90} />
      </div>
    </section>
  );
};

interface PhaseRowProps {
  phase: JourneyPhase;
  currentWeek: number;
  isOpen: boolean;
  onToggle: () => void;
  delay: number;
}

const PhaseRow: React.FC<PhaseRowProps> = ({ phase, currentWeek, isOpen, onToggle, delay }) => {
  const activeWeek = phase.weeks.find((week) => week.isCurrentWeek);
  const isActive = phase.status === 'active';
  const isComplete = phase.status === 'completed';
  const weeksDone = phase.weeks.filter((week) => week.status === 'completed').length;
  const weeksTotal = phase.weeks.length;
  const comingUp = phase.weeks.filter((week) => week.weekNumber > currentWeek);

  return (
    <div className="road-row animate-rise-in" data-status={phase.status} style={{ animationDelay: delay + 'ms' }}>
      <span className="road-node" aria-hidden="true">
        {isComplete && <Check strokeWidth={2.25} className="size-3.5" />}
      </span>

      <div className="pb-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={'roadmap-phase-' + phase.id}
          className="road-card focus-ring w-full px-5 py-5 text-left sm:px-6"
        >
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-ui-mono text-micro uppercase tracking-[0.14em] text-text-secondary">{phase.weeksLabel}</span>
                {isActive && <Badge tone="achievement">Current</Badge>}
                {isComplete && <span className="font-ui-mono text-micro uppercase tracking-[0.14em] text-achievement">Complete</span>}
              </div>
              <h3 className="mt-2 text-h3 text-text">{phase.name}</h3>
              {!isOpen && phase.purpose && <p className="mt-1.5 line-clamp-1 text-small text-text-secondary">{phase.purpose}</p>}
            </div>
            <ChevronDown aria-hidden="true" strokeWidth={1.5} className={'size-5 shrink-0 transition-transform duration-300 ' + (isOpen ? 'rotate-180 text-achievement' : 'text-text-secondary')} />
          </div>
          {(isActive || isComplete) && weeksTotal > 0 && (
            <div className="mt-5 flex items-center gap-3">
              <div aria-hidden="true" className="h-[3px] flex-1 overflow-hidden rounded-full bg-text/[0.08]">
                <div className="h-full rounded-full bg-achievement" style={{ width: Math.round((weeksDone / weeksTotal) * 100) + '%' }} />
              </div>
              <span className="font-ui-mono text-micro text-text-secondary">{weeksDone} of {weeksTotal} weeks</span>
            </div>
          )}
        </button>

        <div
          id={'roadmap-phase-' + phase.id}
          className={'journey-accordion-content ' + (isOpen ? 'is-open' : 'is-closed')}
          data-state={isOpen ? 'open' : 'closed'}
          aria-hidden={!isOpen}
        >
          <div className="road-detail mt-3 p-5 sm:p-6">
            {!isActive && phase.purpose && <p className="max-w-2xl text-body leading-7 text-text-secondary">{phase.purpose}</p>}
            {activeWeek && isActive ? (
              <>
                <CurrentWeek week={activeWeek} />
                {comingUp.length > 0 && <WeekList title="Coming up" weeks={comingUp} currentWeek={currentWeek} />}
              </>
            ) : (
              <WeekList weeks={phase.weeks} currentWeek={currentWeek} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CurrentWeek: React.FC<{ week: JourneyWeek }> = ({ week }) => (
  <div>
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">This week</p>
        <h4 className="mt-2 text-h3 text-text">{weekTitle(week)}</h4>
      </div>
      <span className="font-ui-mono text-micro uppercase tracking-[0.14em] text-text-secondary">Week {week.weekNumber}</span>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {week.target && <Detail label="Target" icon={<Target aria-hidden="true" strokeWidth={1.5} className="size-3.5" />} value={formatTarget(week.target)} />}
      {(week.test || week.keyMilestone) && (
        <Detail
          label={week.test ? 'Test' : 'Milestone'}
          icon={<Sparkles aria-hidden="true" strokeWidth={1.5} className="size-3.5" />}
          value={week.test ? formatPassIf(week.test.passIf) || week.test.instructions : week.keyMilestone || ''}
        />
      )}
    </div>
  </div>
);

/** Only what the plan actually holds: a theme and, when written, a milestone. Never daily sessions or targets. */
const WeekList: React.FC<{ weeks: JourneyWeek[]; currentWeek: number; title?: string }> = ({ weeks, currentWeek, title }) => (
  <div className={title ? 'mt-6 border-t border-border pt-5' : ''}>
    {title && <p className="mb-1 font-ui-mono text-micro uppercase tracking-[0.16em] text-text-secondary">{title}</p>}
    <ol className="divide-y divide-border">
      {weeks.map((week) => {
        const current = week.weekNumber === currentWeek;
        const name = weekTitle(week);
        const milestone = week.keyMilestone && week.keyMilestone !== name ? week.keyMilestone : null;
        return (
          <li key={week.weekNumber} className="flex items-start gap-4 py-3.5">
            <span className={'w-14 shrink-0 pt-0.5 font-ui-mono text-micro uppercase tracking-[0.1em] ' + (current ? 'text-achievement' : 'text-text-secondary')}>
              {current ? 'Now' : 'Week ' + week.weekNumber}
            </span>
            <div className="min-w-0 flex-1">
              <p className={'text-body ' + (week.status === 'completed' || current ? 'text-text' : 'text-text-secondary')}>{name}</p>
              {milestone && <p className="mt-1 line-clamp-2 text-small text-text-secondary">{milestone}</p>}
            </div>
            {week.status === 'completed' && <Check strokeWidth={2} className="mt-1 size-4 shrink-0 text-achievement" aria-label="Completed" />}
            {week.status === 'locked' && <Lock strokeWidth={1.5} className="mt-1 size-4 shrink-0 text-text-secondary" aria-label="Locked" />}
          </li>
        );
      })}
    </ol>
  </div>
);

const Detail: React.FC<{ label: string; icon: React.ReactNode; value: string }> = ({ label, icon, value }) => (
  <div className="rounded-card border border-border bg-background/40 p-4">
    <div className="flex items-center gap-2 font-ui-mono text-micro uppercase tracking-[0.14em] text-achievement">{icon}{label}</div>
    <p className="mt-2 text-body leading-6 text-text">{value}</p>
  </div>
);

/** The climax of the path: the one star at the end of the rail. */
const Destination: React.FC<{ closingStretch: JourneyData['closingStretch']; delay: number }> = ({ closingStretch, delay }) => (
  <div className="road-row road-row--end animate-rise-in" data-status={closingStretch.status} style={{ animationDelay: delay + 'ms' }}>
    <span className="road-node road-node--destination" aria-hidden="true"><StepMarker state="destination" size="lg" /></span>
    <div className="dash-card p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">Final stretch</p>
        <span className="font-ui-mono text-micro uppercase tracking-[0.14em] text-text-secondary">{'Days ' + closingStretch.startDay + '\u2013' + closingStretch.endDay}</span>
      </div>
      <h3 className="mt-5 max-w-[28ch] text-h2 text-text">{closingStretch.finalGoal}</h3>
      <p className="mt-4 max-w-xl text-body leading-7 text-text-secondary">Your final benchmark: {closingStretch.finalTest}</p>
    </div>
  </div>
);

export default StrategicRoadmap;
