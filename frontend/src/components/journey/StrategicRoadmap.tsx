import React, { useState } from 'react';
import { ChevronDown, Check, Lock, Target, Sparkles } from 'lucide-react';
import type { JourneyData, JourneyPhase, JourneyWeek } from '../../types/journey';
import { formatTarget, formatPassIf } from '../../lib/formatters';

export interface StrategicRoadmapProps { journey: JourneyData; }

export const StrategicRoadmap: React.FC<StrategicRoadmapProps> = ({ journey }) => {
  const { phases, closingStretch, metrics } = journey;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    phases.forEach((phase) => { initial[phase.id] = phase.status === 'active'; });
    return initial;
  });

  const toggle = (id: string) => setExpanded((current) => ({ ...current, [id]: !current[id] }));

  return (
    <section aria-labelledby="roadmap-heading" className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-ui-mono uppercase tracking-[0.16em] text-[#C9A227]">The path</p>
          <h2 id="roadmap-heading" className="mt-1 text-xl font-semibold tracking-tight text-text sm:text-2xl">Your progression</h2>
        </div>
        <span className="hidden text-xs text-text-secondary sm:block">Open a phase for detail</span>
      </div>

      <div className="relative">
        <div className="absolute bottom-7 left-[9px] top-7 w-px bg-border" aria-hidden="true" />
        <div className="space-y-2">
          {phases.map((phase) => (
            <PhaseRow
              key={phase.id}
              phase={phase}
              metrics={metrics}
              isOpen={Boolean(expanded[phase.id])}
              onToggle={() => toggle(phase.id)}
            />
          ))}
        </div>
      </div>

      <ClosingStretch closingStretch={closingStretch} />
    </section>
  );
};

interface PhaseRowProps {
  phase: JourneyPhase;
  metrics: JourneyData['metrics'];
  isOpen: boolean;
  onToggle: () => void;
}

const PhaseRow: React.FC<PhaseRowProps> = ({ phase, metrics, isOpen, onToggle }) => {
  const activeWeek = phase.weeks.find((week) => week.isCurrentWeek);
  const isActive = phase.status === 'active';
  const isComplete = phase.status === 'completed';

  return (
    <div className={'relative pl-8 ' + (isOpen ? 'pb-2' : '')}>
      <span
        className={'absolute left-0 top-5 z-10 flex size-[19px] items-center justify-center rounded-full border-2 bg-background ' +
          (isActive ? 'border-[#E7C65C] shadow-[0_0_0_4px_rgba(201,162,39,0.12)]' :
           isComplete ? 'border-[#C9A227] bg-[#C9A227]' : 'border-border')}
        aria-hidden="true"
      >
        {isComplete && <Check className="size-3.5 text-[#11100C]" />}
      </span>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={'roadmap-phase-' + phase.id}
        className={'w-full rounded-2xl border px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ' +
          (isActive ? 'border-[#C9A227]/35 bg-[#C9A227]/[0.06] shadow-sm' :
           'border-border bg-surface hover:border-border-strong hover:bg-surface-elevated/40')}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-ui-mono uppercase tracking-[0.14em] text-text-secondary">{phase.weeksLabel}</span>
              {isActive && <span className="rounded-full bg-[#C9A227] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#11100C]">Current</span>}
              {isComplete && <span className="text-[10px] font-ui-mono text-[#C9A227]">Complete</span>}
            </div>
            <h3 className="mt-1 text-sm font-semibold text-text sm:text-base">{phase.name}</h3>
            {!isOpen && phase.purpose && <p className="mt-1 line-clamp-1 text-xs text-text-secondary">{phase.purpose}</p>}
          </div>
          <ChevronDown className={'size-4 shrink-0 text-text-secondary transition-transform duration-200 ' + (isOpen ? 'rotate-180 text-[#C9A227]' : '')} aria-hidden="true" />
        </div>
      </button>

      <div
        id={'roadmap-phase-' + phase.id}
        className={'journey-accordion-content ' + (isOpen ? 'is-open' : 'is-closed')}
        data-state={isOpen ? 'open' : 'closed'}
        aria-hidden={!isOpen}
      >
        <div className="ml-1 mt-2 rounded-2xl border border-border bg-surface/70 p-4 sm:p-5">
          {phase.purpose && <p className="max-w-2xl text-sm leading-6 text-text-secondary">{phase.purpose}</p>}
          {activeWeek && isActive ? <CurrentWeek week={activeWeek} /> : <PhaseWeeks weeks={phase.weeks} currentWeek={metrics.currentWeek} />}
        </div>
      </div>
    </div>
  );
};

const CurrentWeek: React.FC<{ week: JourneyWeek }> = ({ week }) => (
  <div className="mt-5 border-t border-border pt-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <p className="text-[10px] font-ui-mono uppercase tracking-[0.14em] text-[#C9A227]">This week</p>
        <h4 className="mt-1 text-lg font-semibold text-text">{week.focus || week.theme || week.title}</h4>
      </div>
      <span className="text-xs font-ui-mono text-text-secondary">Week {week.weekNumber}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {week.target && <Detail label="Target" icon={<Target className="size-3.5" />} value={formatTarget(week.target)} />}
      {(week.test || week.keyMilestone) && (
        <Detail
          label={week.test ? 'Test' : 'Milestone'}
          icon={<Sparkles className="size-3.5" />}
          value={week.test ? formatPassIf(week.test.passIf) || week.test.instructions : week.keyMilestone || ''}
        />
      )}
    </div>
  </div>
);

const PhaseWeeks: React.FC<{ weeks: JourneyWeek[]; currentWeek: number }> = ({ weeks, currentWeek }) => (
  <div className="mt-4 divide-y divide-border border-t border-border">
    {weeks.map((week) => {
      const current = week.weekNumber === currentWeek;
      return (
        <div key={week.weekNumber} className={'flex items-center gap-4 py-3 ' + (current ? 'text-text' : 'text-text-secondary')}>
          <span className={'w-12 shrink-0 font-ui-mono text-[10px] uppercase ' + (current ? 'text-[#C9A227]' : '')}>{current ? 'Now' : 'Week ' + week.weekNumber}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{week.focus || week.theme || week.title}</span>
          {week.status === 'completed' && <Check className="size-3.5 text-[#C9A227]" aria-label="Completed" />}
          {week.status === 'locked' && <Lock className="size-3.5 text-text-secondary" aria-label="Locked" />}
        </div>
      );
    })}
  </div>
);

const Detail: React.FC<{ label: string; icon: React.ReactNode; value: string }> = ({ label, icon, value }) => (
  <div className="rounded-xl border border-border bg-background/40 p-3">
    <div className="flex items-center gap-1.5 text-[10px] font-ui-mono uppercase tracking-wider text-[#C9A227]">{icon}{label}</div>
    <p className="mt-1.5 text-sm leading-5 text-text">{value}</p>
  </div>
);

const ClosingStretch: React.FC<{ closingStretch: JourneyData['closingStretch'] }> = ({ closingStretch }) => (
  <div className="rounded-2xl border border-[#C9A227]/30 bg-gradient-to-r from-[#C9A227]/10 via-surface to-surface p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-[#E7C65C]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10px] font-ui-mono uppercase tracking-[0.15em] text-[#C9A227]">Final stretch</p>
        <h3 className="mt-1 text-base font-semibold text-text">{closingStretch.finalGoal}</h3>
        <p className="mt-1.5 text-xs leading-5 text-text-secondary">Your final benchmark: {closingStretch.finalTest}</p>
      </div>
    </div>
  </div>
);

export default StrategicRoadmap;
