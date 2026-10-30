import React from 'react';
import type { GoalTrend, Milestones } from '../../lib/dashboard';
import { Badge, StepMarker } from '../ui';

const W = 300;
const H = 120;
const PAD_X = 10;
const PAD_Y = 14;

const valueText = (value: number, unit: string) => {
  const rounded = Math.round(value * 100) / 100;
  return unit ? rounded + ' ' + unit : String(rounded);
};

/**
 * Start, every recorded check, and the target, drawn so that better is always up (a time to beat falls as it
 * improves, so its scale is turned over). One series: no legend, the start and the goal are labelled on the line.
 */
const TrendChart: React.FC<{ trend: GoalTrend }> = ({ trend }) => {
  const series = [...(trend.start !== null ? [{ week: 0, value: trend.start }] : []), ...trend.points];
  const values = [...series.map((p) => p.value), trend.target];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const up = trend.direction === 'lower_is_better' ? -1 : 1;
  const x = (week: number) => PAD_X + (week / trend.targetWeek) * (W - PAD_X * 2);
  const y = (value: number) => {
    const t = (value - lo) / span;
    return PAD_Y + (up === 1 ? 1 - t : t) * (H - PAD_Y * 2);
  };
  const last = series[series.length - 1];
  const line = series.map((p, i) => (i === 0 ? 'M' : 'L') + x(p.week).toFixed(1) + ' ' + y(p.value).toFixed(1)).join(' ');
  const ty = y(trend.target);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dash-trend mt-6 block h-auto w-full overflow-visible" aria-hidden="true">
      <line x1={PAD_X} x2={W - PAD_X} y1={ty} y2={ty} className="dash-trend__goal-line" />
      {last && <line x1={x(last.week)} y1={y(last.value)} x2={x(trend.targetWeek)} y2={ty} className="dash-trend__ahead" />}
      {series.length > 1 && <path d={line} pathLength={1} className="dash-trend__line" />}
      {series.map((p, i) => (
        <circle key={p.week} cx={x(p.week)} cy={y(p.value)} r={i === series.length - 1 ? 5 : 3.5} className={i === series.length - 1 ? 'dash-trend__now' : 'dash-trend__dot'}>
          <title>{(p.week === 0 ? 'Start' : 'Week ' + p.week) + ': ' + valueText(p.value, trend.unit)}</title>
        </circle>
      ))}
      <text x={x(trend.targetWeek)} y={ty - 9} textAnchor="end" className="dash-trend__label">Goal ✦</text>
    </svg>
  );
};

/** What the goal's own measure says. A number goal shows the gap closed; a deliverable goal shows milestones reached. */
export const GoalProgress: React.FC<{ trend: GoalTrend | null; milestones: Milestones; weekMilestone?: string; nextCheck?: string | null }> = ({
  trend,
  milestones,
  weekMilestone,
  nextCheck,
}) => {
  // A goal with no number and no checks yet: this week's milestone is the thing to reach.
  if (!trend && milestones.total === 0) {
    if (!weekMilestone) return null;
    return (
      <section aria-labelledby="goal-progress-heading" className="dash-panel flex w-full min-w-0 flex-col p-7 sm:p-8">
        <h2 id="goal-progress-heading" className="font-ui-mono text-micro uppercase text-text-secondary">This week's milestone</h2>
        <p className="mt-6 flex items-start gap-3 text-h3 text-text">
          <StepMarker state="milestone" size="md" className="mt-1" />
          <span>{weekMilestone}</span>
        </p>
        {nextCheck && <p className="mt-auto pt-6 text-small text-text-secondary">{nextCheck}</p>}
      </section>
    );
  }

  let headline: string;
  let caption: string;
  if (trend && trend.gapClosed !== null) {
    headline = Math.round(trend.gapClosed * 100) + '%';
    caption = 'of the gap to your goal closed';
  } else if (trend) {
    headline = trend.start !== null ? valueText(trend.start, trend.unit) : valueText(trend.target, trend.unit);
    caption = trend.start !== null ? 'where you started. The goal: ' + valueText(trend.target, trend.unit) + '.' : 'your goal';
  } else {
    headline = milestones.reached + ' of ' + milestones.total;
    caption = milestones.total === 1 ? 'milestone reached' : 'milestones reached';
  }

  return (
    <section aria-labelledby="goal-progress-heading" className="dash-panel flex w-full min-w-0 flex-col p-7 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 id="goal-progress-heading" className="font-ui-mono text-micro uppercase text-text-secondary">
          {trend ? trend.metric || 'Toward your goal' : 'Milestones'}
        </h2>
        {trend?.newBest && <Badge tone="achievement">New best</Badge>}
      </div>
      <p className="mt-5 tabular text-5xl font-semibold tracking-[-0.04em] text-text">{headline}</p>
      <p className="mt-2 text-small text-text-secondary">{caption}</p>
      {trend && trend.latest !== null && trend.start !== null && (
        <p className="mt-1 text-small text-text-secondary">
          {valueText(trend.start, trend.unit)} → <span className="text-text">{valueText(trend.latest, trend.unit)}</span> · goal {valueText(trend.target, trend.unit)}
        </p>
      )}
      {trend && (trend.start !== null || trend.points.length > 0) && <TrendChart trend={trend} />}
      {!trend && weekMilestone && (
        <p className="mt-6 flex items-start gap-3 text-body text-text">
          <StepMarker state="milestone" size="sm" className="mt-1" />
          <span>
            <span className="block text-small text-text-secondary">This week</span>
            {weekMilestone}
          </span>
        </p>
      )}
      {nextCheck && <p className="mt-auto pt-6 text-small text-text-secondary">{nextCheck}</p>}
    </section>
  );
};
