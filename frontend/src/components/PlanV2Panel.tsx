import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Flag, Map as MapIcon, Target } from 'lucide-react';
import type { DailyTask, GoalRoadmap, RoadmapWeek, WeekTarget } from '../types';

function metricRepeatsUnit(metric: string, unit: string): boolean {
  const m = metric.toLowerCase().trim();
  const u = unit.toLowerCase().trim();
  const initials = m.split(/\s+/).map((word) => word[0]).join('');
  return !m || m === u || m.includes(u) || u.includes(m) || initials === u.replace(/[^a-z]/g, '');
}

export function formatTarget(target: WeekTarget): string {
  if (target.kind === 'deliverable') return target.description;
  const amount = `${Math.round(target.value * 100) / 100} ${target.unit}`;
  const suffix = target.direction === 'lower_is_better' ? ' or less' : '';
  return metricRepeatsUnit(target.metric, target.unit) ? `${amount}${suffix}` : `${target.metric}: ${amount}${suffix}`;
}

function amount(target: WeekTarget | null | undefined, value: number | null): string {
  if (!target || target.kind !== 'number' || value === null) return '';
  return `${Math.round(value * 100) / 100} ${target.unit}`;
}

/** How far this week's target sits on the climb from the starting point to week 12, 0-100. */
function climbPercent(start: number | null, current: WeekTarget | null | undefined, final: WeekTarget | null | undefined, week: number): number {
  if (start !== null && current?.kind === 'number' && final?.kind === 'number' && final.value !== start) {
    const share = (current.value - start) / (final.value - start);
    return Math.round(Math.min(1, Math.max(0, share)) * 100);
  }
  return Math.round((week / 12) * 100);
}

interface PlanV2PanelProps {
  roadmap: GoalRoadmap;
  weeks: RoadmapWeek[];
  currentWeek: number;
  weekTasks: DailyTask[];
}

export const PlanV2Panel: React.FC<PlanV2PanelProps> = ({ roadmap, weeks, currentWeek, weekTasks }) => {
  const [showMethod, setShowMethod] = useState(false);
  const week = weeks.find((w) => w.weekNumber === currentWeek);
  const finalWeek = weeks.find((w) => w.weekNumber === 12);
  const testDay = weekTasks.find((t) => t.isTestDay);
  const percent = climbPercent(roadmap.startingPoint.value, week?.target, finalWeek?.target, currentWeek);
  const startLabel = amount(finalWeek?.target, roadmap.startingPoint.value) || roadmap.startingPoint.description || 'Where you started';
  const goalLabel = finalWeek?.target ? (finalWeek.target.kind === 'number' ? amount(finalWeek.target, finalWeek.target.value) : 'Final goal') : 'Final goal';
  const { method } = roadmap;

  return (
    <div className="p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span>This week's target · Week {currentWeek} of 12</span>
          </div>
          <p className="text-base font-bold text-white leading-snug">
            {week?.target ? formatTarget(week.target) : week?.objective}
          </p>
          {week?.test && (
            <p className="text-xs text-neutral-400 leading-relaxed">
              <span className="text-neutral-200 font-medium">Test{testDay ? ` on ${testDay.dayOfWeek}` : ''}:</span>{' '}
              {week.test.instructions} <span className="text-neutral-500">Pass if {week.test.passIf}.</span>
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span>Final goal · Day 90</span>
          </div>
          <p className="text-sm font-semibold text-neutral-100 leading-snug">{roadmap.finalGoal}</p>
          <p className="text-[11px] text-neutral-500">{roadmap.finalTest}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-[#080d0b] border border-[#1a2824] overflow-hidden">
          <div className="h-full bg-[#07CB6C] transition-all" style={{ width: `${percent}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-neutral-500">
          <span>Start: {startLabel}</span>
          <span className="text-[#07CB6C]">This week</span>
          <span>Goal: {goalLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-[#1a2824]">
        <button
          type="button"
          onClick={() => setShowMethod(!showMethod)}
          className="inline-flex items-center gap-1 text-xs text-[#07CB6C] hover:text-[#06b560] cursor-pointer transition-colors pt-2"
        >
          <span>How this plan works: {method.name}</span>
          {showMethod ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <Link
          to="/roadmap"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors pt-2 ml-auto"
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Full plan</span>
        </Link>
      </div>

      {showMethod && (
        <div className="p-3.5 rounded-md bg-[#080d0b] border border-[#07CB6C]/25 text-xs space-y-3 animate-fadeIn">
          <div className="space-y-1">
            <p className="text-white font-semibold">
              {method.name}
              {method.creator && <span className="text-neutral-400 font-normal"> · {method.creator}</span>}
            </p>
            {method.summary && <p className="text-neutral-400 leading-relaxed">{method.summary}</p>}
          </div>
          {method.whyChosen && (
            <p className="text-neutral-200 leading-relaxed">
              <strong className="text-white font-semibold">Why this method:</strong> {method.whyChosen}
            </p>
          )}
          {method.runnerUp?.name && (
            <p className="text-neutral-400 leading-relaxed">
              <strong className="text-neutral-200 font-semibold">Runner-up:</strong> {method.runnerUp.name}. {method.runnerUp.whyLost}
            </p>
          )}
          {method.rules.length > 0 && (
            <div className="space-y-1">
              <p className="text-neutral-200 font-semibold">Rules every week follows</p>
              <ul className="list-disc pl-4 space-y-0.5 text-neutral-400">
                {method.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-1">
            <p className="text-neutral-200 font-semibold">Phases</p>
            <ul className="space-y-0.5 text-neutral-400">
              {roadmap.phases.map((phase) => {
                const isCurrent = currentWeek >= phase.startWeek && currentWeek <= phase.endWeek;
                return (
                  <li key={phase.name} className={isCurrent ? 'text-[#07CB6C]' : ''}>
                    Weeks {phase.startWeek}-{phase.endWeek}: <span className="font-medium">{phase.name}</span>. {phase.purpose}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanV2Panel;
