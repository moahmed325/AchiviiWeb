import React from 'react';
import { Session, AvailabilitySlot } from '../types';
import { 
  X, 
  Clock, 
  Calendar as CalendarIcon, 
  Briefcase, 
  CheckCircle2, 
  Sun, 
  Sunset, 
  Moon,
  Sparkles
} from 'lucide-react';

interface DayDetailModalProps {
  dayDate: Date | null;
  dayName: string;
  sessions: Session[];
  busySlots: AvailabilitySlot[];
  onClose: () => void;
  onSelectSession: (session: Session) => void;
}

export const DayDetailModal: React.FC<DayDetailModalProps> = ({
  dayDate,
  dayName,
  sessions,
  busySlots,
  onClose,
  onSelectSession,
}) => {
  if (!dayDate) return null;

  const formattedDate = dayDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-orange-400" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Combine busy slots and sessions into a unified chronological timeline
  const timelineItems: {
    type: 'busy' | 'session';
    title: string;
    startTime: string;
    endTime: string;
    session?: Session;
  }[] = [];

  for (const b of busySlots) {
    timelineItems.push({
      type: 'busy',
      title: b.label || 'Busy Commitment',
      startTime: b.start_time,
      endTime: b.end_time,
    });
  }

  for (const s of sessions) {
    timelineItems.push({
      type: 'session',
      title: s.task_template?.title || 'Goal Session',
      startTime: s.start_time,
      endTime: s.end_time,
      session: s,
    });
  }

  timelineItems.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 border border-slate-800 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 space-y-6 max-h-[85vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Day Timeline Detail
            </span>
            <h3 className="text-xl font-bold text-white">{dayName}</h3>
            <p className="text-xs text-slate-400 font-mono">{formattedDate}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chronological Timeline List */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          {timelineItems.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm">No events or sessions scheduled for this day.</p>
              <p className="text-xs text-slate-400">Entire day is open buffer time.</p>
            </div>
          ) : (
            timelineItems.map((item, idx) => {
              if (item.type === 'busy') {
                return (
                  <div
                    key={`busy-${idx}`}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-800 text-slate-400">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-300">{item.title}</div>
                        <div className="text-[11px] text-slate-400">Recurring Routine Commitment</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-slate-400 px-2 py-0.5 rounded bg-slate-800">
                      {item.startTime} – {item.endTime}
                    </span>
                  </div>
                );
              }

              const s = item.session!;
              const isDone = s.status === 'DONE';

              return (
                <div
                  key={`session-${s.id}`}
                  onClick={() => onSelectSession(s)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs hover:scale-[1.01] ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70'
                      : 'glass-panel bg-gradient-to-r from-indigo-950/30 to-purple-950/30 border-indigo-500/40 hover:border-indigo-500/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{item.title}</div>
                      <div className="text-[11px] text-indigo-300 flex items-center gap-1.5 mt-0.5">
                        {getTimeIcon(s.task_template?.preferred_time_of_day)}
                        <span>{s.task_template?.session_duration_minutes || 60}m session</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-white font-semibold px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">
                      {item.startTime} – {item.endTime}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : s.status === 'MISSED'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
