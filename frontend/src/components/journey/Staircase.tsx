import React from 'react';
import type { RoadmapPhase } from '../../types';
import type { TrendPoint } from '../../lib/dashboard';
import { formatMetric, type StairStep } from '../../lib/plan';

const DEFAULT_W = 640;
const H = 230;
const L = 52;
const R = 18;
const T = 26;
const B = 34;

/** A phase name cut to the width its weeks have (11px mono is about 6.7px a character), with an ellipsis when cut. */
const fitText = (text: string, width: number) => {
  const chars = Math.max(1, Math.floor(width / 6.7));
  return text.length <= chars ? text : text.slice(0, Math.max(1, chars - 1)).trimEnd() + '…';
};

export interface StaircaseProps {
  steps: StairStep[];
  start: number | null;
  points: TrendPoint[];
  direction: 'higher_is_better' | 'lower_is_better';
  unit: string;
  totalWeeks: number;
  currentWeek: number;
  phases: RoadmapPhase[];
  summary: string;
}

/**
 * ND-31: the plan's weekly targets as a staircase toward the goal, better always up (a time to beat falls as it
 * improves, so its scale is turned over). The phases sit behind it, the current week is marked, and each recorded
 * check is a dot: filled when it met that week's target, hollow when it didn't. No glow; the steps draw in once.
 */
export const Staircase: React.FC<StaircaseProps> = ({ steps, start, points, direction, unit, totalWeeks, currentWeek, phases, summary }) => {
  // Drawn at the width it is shown at, so its labels stay full size on a phone instead of shrinking with the chart.
  const ref = React.useRef<HTMLDivElement>(null);
  const [W, setW] = React.useState(DEFAULT_W);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const values = [...steps.map((s) => s.target), ...points.map((p) => p.value), ...(start !== null ? [start] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo || 1) * 0.12;
  const min = lo - pad;
  const max = hi + pad;
  const better = direction === 'lower_is_better' ? -1 : 1;
  const col = (W - L - R) / totalWeeks;
  const xAt = (week: number) => L + week * col;
  const y = (value: number) => {
    const t = (value - min) / (max - min);
    return T + (better === 1 ? 1 - t : t) * (H - T - B);
  };
  const targetOf = new Map(steps.map((s) => [s.weekNumber, s.target]));

  let path = '';
  steps.forEach((step, i) => {
    const sy = y(step.target).toFixed(1);
    path += i === 0 ? `M${xAt(step.weekNumber - 1).toFixed(1)} ${sy}` : ` V${sy}`;
    path += ` H${xAt(step.weekNumber).toFixed(1)}`;
  });
  const last = steps[steps.length - 1];
  const nowX = xAt(currentWeek - 0.5);

  return (
    <div ref={ref}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="stair block h-auto w-full">
      {phases.map((phase, i) => (
        <g key={phase.name + phase.startWeek}>
          {i % 2 === 1 && <rect x={xAt(phase.startWeek - 1)} y={T - 10} width={(phase.endWeek - phase.startWeek + 1) * col} height={H - T - B + 10} className="stair__band" />}
          <text x={xAt(phase.startWeek - 1) + 6} y={H - 12} className="stair__phase">
            {fitText(phase.name, (phase.endWeek - phase.startWeek + 1) * col - 12)}
          </text>
        </g>
      ))}

      {start !== null && (
        <text x={L - 8} y={y(start) + 4} textAnchor="end" className="stair__axis">{formatMetric(start, unit)}</text>
      )}
      {last && (
        <text x={L - 8} y={y(last.target) + 4} textAnchor="end" className="stair__axis stair__axis--goal">{formatMetric(last.target, unit)}</text>
      )}

      <line x1={nowX} x2={nowX} y1={T - 12} y2={H - B} className="stair__now" />
      <text x={nowX} y={T - 15} textAnchor="middle" className="stair__now-label">Now</text>

      {path && <path d={path} pathLength={1} className="stair__steps" />}
      {last && (
        <text x={xAt(last.weekNumber) - 2} y={y(last.target) - 9} textAnchor="end" className="stair__goal">Goal ✦</text>
      )}

      {start !== null && (
        <circle cx={L} cy={y(start)} r={4} className="stair__start">
          <title>{'Start: ' + formatMetric(start, unit)}</title>
        </circle>
      )}
      {points.map((point, i) => {
        const target = targetOf.get(point.week);
        const met = target === undefined ? true : better === -1 ? point.value <= target : point.value >= target;
        return (
          <circle
            key={point.week}
            cx={xAt(point.week - 0.5)}
            cy={y(point.value)}
            r={5}
            className={met ? 'stair__dot stair__dot--met' : 'stair__dot'}
            style={{ animationDelay: 900 + i * 120 + 'ms' }}
          >
            <title>{`Week ${point.week}: ${formatMetric(point.value, unit)}${target !== undefined ? ` (target ${formatMetric(target, unit)})` : ''}`}</title>
          </circle>
        );
      })}
    </svg>
    </div>
  );
};
