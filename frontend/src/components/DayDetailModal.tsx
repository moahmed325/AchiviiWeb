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
        return <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-[#a6b8ad]" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[#7e8f85]" />;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-none">
      {/* Solid Dim Backdrop - NO glassmorphism */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0c1210] rounded-md p-5 sm:p-6 border border-[#182621] shadow-none z-10 space-y-5 max-h-[85vh] flex flex-col justify-between">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#182621]">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7e8f85]">
              CHRONO TELEMETRY // {dayName.toUpperCase()}
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-[#e5ebe7] truncate">
              {formattedDate}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#182621] transition-colors cursor-pointer shrink-0"
            title="Close timeline"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chronological Timeline List */}
        <div className="overflow-y-auto overscroll-contain space-y-2.5 flex-1 pr-1">
          {timelineItems.length === 0 ? (
            <div className="p-8 text-center text-[#7e8f85] space-y-2">
              <CalendarIcon className="w-8 h-8 text-[#182621] mx-auto" />
              <p className="text-xs font-mono">NO SESSIONS OR COMMITMENTS SCHEDULED</p>
              <p className="text-[11px] font-mono text-[#55675c]">Entire 24h window is unreserved buffer capacity.</p>
            </div>
          ) : (
            timelineItems.map((item, idx) => {
              if (item.type === 'busy') {
                return (
                  <div
                    key={`busy-${idx}`}
                    className="p-3 rounded-sm bg-[#080d0b] border border-[#182621] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-sm bg-[#182621] text-[#7e8f85] flex items-center justify-center shrink-0">
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono font-medium text-[#a6b8ad] truncate">{item.title}</div>
                        <div className="text-[10px] font-mono text-[#55675c]">ROUTINE BUSY BLOCK</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-[#7e8f85] px-2 py-1 rounded-sm bg-[#111a17] border border-[#182621] shrink-0">
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
                  className={`min-h-[44px] p-3 rounded-sm border transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                    isDone
                      ? 'bg-[#080d0b] border-[#182621] text-[#55675c]'
                      : sessionTier === 'core'
                      ? 'bg-[#0c1210] border-[#07CB6C]/40 hover:border-[#07CB6C]'
                      : sessionTier === 'buffer'
                      ? 'bg-[#0c1210] border-dashed border-[#182621] hover:border-[#2a443a]'
                      : 'bg-[#0c1210] border-[#1f332c] hover:border-[#07CB6C]/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 ${
                      isDone
                        ? 'bg-[#0a1711] text-[#07CB6C]'
                        : sessionTier === 'core'
                        ? 'bg-[#0a1711] text-[#07CB6C] border border-[#07CB6C]/30'
                        : 'bg-[#182621] text-[#7e8f85]'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : getTimeIcon(s.task_template?.preferred_time_of_day)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                          sessionTier === 'core' ? 'text-[#07CB6C]' : sessionTier === 'reflect' ? 'text-[#a6b8ad]' : 'text-[#7e8f85]'
                        }`}>
                          [{sessionTier.toUpperCase()}]
                        </span>
                        <span className={`font-bold truncate ${isDone ? 'line-through text-[#55675c]' : 'text-[#e5ebe7]'}`}>
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#7e8f85] flex items-center gap-1.5 mt-0.5">
                        <span>{s.task_template?.session_duration_minutes || 60}M SESSION</span>
                        <span>·</span>
                        <span>{s.task_template?.phase?.title?.split(':')[0] || 'PHASE 1'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <span className="font-mono text-xs text-[#e5ebe7] px-2 py-1 rounded-sm bg-[#080d0b] border border-[#182621]">
                      {item.startTime} – {item.endTime}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm uppercase border ${
                        isDone
                          ? 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                          : isMissed
                          ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                          : isRescheduled
                          ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
                          : 'bg-[#182621] text-[#a6b8ad] border-[#182621]'
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
        <div className="pt-3 border-t border-[#182621] flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] text-xs font-mono border border-[#182621] transition-colors cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
