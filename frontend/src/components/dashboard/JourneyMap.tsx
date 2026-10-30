import React from 'react';
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
export const JourneyMap: React.FC<{ days: MapDay[]; summary: string }> = ({ days, summary }) => {
  // A column per week; a 12-week plan's closing six days make a thirteenth (B-109: shorter plans have fewer).
  const columns = Math.max(1, Math.ceil(days.length / 7));
  const style = { '--map-cols': columns } as React.CSSProperties;
  let lit = 0;
  return (
    <div className="min-w-0 overflow-x-auto">
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
    </div>
  );
};
