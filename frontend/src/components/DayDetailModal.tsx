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
  Moon
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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-amber-400" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-neutral-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-neutral-400" />;
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
      title: b.label || 'Routine Commitment',
      startTime: b.start_time,
      endTime: b.end_time,
    });
  }

  for (const s of sessions) {
    timelineItems.push({
      type: 'session',
      title: s.task_template?.title || 'Goal Session',
      startTime: s.start_time || '09:00',
      endTime: s.end_time || '10:00',
      session: s,
    });
  }

  timelineItems.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-[#1a2824] shadow-2xl z-10 space-y-5 max-h-[85vh] flex flex-col justify-between my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#1a2824]">
          <div className="space-y-1 min-w-0 pr-6">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400 block">
              CHRONO TELEMETRY // {dayName.toUpperCase()}
            </span>
            <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight truncate">
              {formattedDate}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer shrink-0"
            title="Close timeline"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chronological Timeline List */}
        <div className="overflow-y-auto overscroll-contain space-y-2.5 flex-1 pr-1">
          {timelineItems.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 space-y-2">
              <CalendarIcon className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs font-mono text-neutral-300">NO SESSIONS OR COMMITMENTS SCHEDULED</p>
              <p className="text-[11px] font-mono text-neutral-500">Entire 24h window is unreserved buffer capacity.</p>
            </div>
          ) : (
            timelineItems.map((item, idx) => {
              if (item.type === 'busy') {
                return (
                  <div
                    key={`busy-${idx}`}
                    className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#131f1b] text-neutral-400 flex items-center justify-center shrink-0">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-neutral-300 truncate">{item.title}</div>
                        <div className="text-[10px] font-mono text-neutral-500">ROUTINE BUSY BLOCK</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-neutral-400 px-2.5 py-1 rounded-lg bg-[#0a0f0d] border border-[#1a2824] shrink-0">
                      {item.startTime} – {item.endTime}
                    </span>
                  </div>
                );
              }

              const s = item.session!;
              const isDone = s.status === 'DONE';
              const isMissed = s.status === 'MISSED';
              const isRescheduled = s.status === 'RESCHEDULED';

              const sessionTier = s.tier || (
                s.task_template?.title?.toLowerCase().includes('reflect') ? 'reflect' :
                isRescheduled ? 'buffer' : 'core'
              );

              return (
                <div
                  key={`session-${s.id}`}
                  onClick={() => onSelectSession(s)}
                  className={`min-h-[44px] p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                    isDone
                      ? 'bg-[#0a0f0d] border-[#1a2824] text-neutral-500 opacity-80'
                      : sessionTier === 'core'
                      ? 'bg-[#0d1412] border-[#07CB6C]/40 hover:border-[#07CB6C]'
                      : sessionTier === 'buffer'
                      ? 'bg-[#0d1412] border-dashed border-[#1a2824] hover:border-[#2a3e38]'
                      : 'bg-[#0d1412] border-[#1a2824] hover:border-[#07CB6C]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-[#07CB6C]/10 text-[#07CB6C]'
                        : sessionTier === 'core'
                        ? 'bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30'
                        : 'bg-[#131f1b] text-neutral-400'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : getTimeIcon(s.task_template?.preferred_time_of_day)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                          sessionTier === 'core' ? 'text-[#07CB6C]' : sessionTier === 'reflect' ? 'text-neutral-300' : 'text-neutral-400'
                        }`}>
                          [{sessionTier.toUpperCase()}]
                        </span>
                        <span className={`font-medium truncate ${isDone ? 'line-through text-neutral-500' : 'text-white'}`}>
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1.5 mt-0.5">
                        <span>{s.task_template?.session_duration_minutes || 60}M SESSION</span>
                        <span>·</span>
                        <span>{s.task_template?.phase?.title?.split(':')[0] || 'PHASE 1'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span className="font-mono text-xs text-neutral-300 px-2.5 py-1 rounded-lg bg-[#0a0f0d] border border-[#1a2824]">
                      {item.startTime} – {item.endTime}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded uppercase border ${
                        isDone
                          ? 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                          : isMissed
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : isRescheduled
                          ? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                          : 'bg-[#131f1b] text-neutral-400 border-[#1a2824]'
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
        <div className="pt-4 border-t border-[#1a2824] flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-[#0d1412] hover:bg-[#131f1b] text-neutral-400 hover:text-white text-xs font-mono border border-[#1a2824] transition-colors cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
