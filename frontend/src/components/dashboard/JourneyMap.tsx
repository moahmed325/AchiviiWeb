import React from 'react';
import type { RoadmapPhase } from '../../types';
import type { MapDay, MapDayState } from '../../lib/dashboard';

const stateLabel: Record<MapDayState, string> = {
  done: 'done',
  today: 'today',
  missed: 'not done',
  rest: 'rest day',
  ahead: 'ahead',
  quiet: 'no practice planned',
};

const shortDate = (date: string) =>
  new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * The whole plan as one grid: a column per week, a cell per day. Done days are lit; a day that didn't happen is only
 * an empty cell, never a warning colour. The cells light up in order on arrival (reduced motion: at once, globally).
 */
export const JourneyMap: React.FC<{ days: MapDay[]; phases: RoadmapPhase[]; summary: string }> = ({ days, phases, summary }) => {
  // A column per week; a 12-week plan's closing six days make a thirteenth (B-109: shorter plans have fewer).
  const columns = Math.max(1, Math.ceil(days.length / 7));
  const lastPhaseWeek = phases.reduce((last, phase) => Math.max(last, phase.endWeek), 0);
  const closingColumn = columns > lastPhaseWeek ? columns : null;
  const style = { '--map-cols': columns } as React.CSSProperties;
  let lit = 0;
  return (
    <div className="min-w-0">
      <div role="img" aria-label={summary} className="dash-map" style={style}>
        {days.map((day) => {
          const order = day.state === 'done' ? lit++ : 0;
          return (
            <span
              key={day.day}
              className="dash-map__cell"
              data-state={day.state}
              data-today={day.isToday || undefined}
              style={day.state === 'done' ? ({ '--i': order } as React.CSSProperties) : undefined}
              title={'Day ' + day.day + ', ' + shortDate(day.date) + ': ' + stateLabel[day.state]}
            />
          );
        })}
      </div>
      {phases.length > 0 && (
        <div aria-hidden="true" className="dash-map__phases mt-3" style={style}>
          {phases.map((phase) => (
            <div key={phase.name + phase.startWeek} className="min-w-0" style={{ gridColumn: `${phase.startWeek} / ${phase.endWeek + 1}` }}>
              <span className="block h-px bg-border-strong" />
              <span className="mt-2 block truncate pr-2 text-small text-text-secondary">{phase.name}</span>
            </div>
          ))}
          {closingColumn && (
            <div className="min-w-0 text-center" style={{ gridColumn: `${closingColumn} / ${closingColumn + 1}` }}>
              <span className="block h-px bg-achievement/60" />
              <span className="mt-1.5 block text-small text-achievement">✦</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
