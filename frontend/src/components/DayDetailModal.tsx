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

  const isToday = dayDate.toDateString() === new Date().toDateString();
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  let hasRenderedNowLine = false;

  const renderNowLine = () => (
    <div
      key="live-now-line"
      className="relative py-1.5 flex items-center gap-2 my-1 z-10 animate-in fade-in duration-300"
      title={`Current Time: ${currentTime}`}
    >
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#07CB6C] text-black text-[9px] font-mono font-bold shrink-0 shadow-[0_0_12px_rgba(7,203,108,0.5)]">
        <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
        <span>{currentTime} NOW</span>
      </div>
      <div className="h-[2px] flex-1 bg-gradient-to-r from-[#07CB6C] via-[#07CB6C]/70 to-transparent shadow-[0_0_8px_rgba(7,203,108,0.4)]" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-white/10 shadow-2xl z-10 space-y-5 max-h-[85vh] flex flex-col justify-between my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/5">
          <div className="space-y-1 min-w-0 pr-6">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#07CB6C]">
                Daily Timeline • {dayName}
              </span>
              {isToday && (
                <span className="px-2 py-0.5 rounded-full bg-[#07CB6C]/20 text-[#07CB6C] text-[10px] font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                  Today • {currentTime}
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
              {formattedDate}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Close timeline"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chronological Timeline List */}
        <div className="overflow-y-auto overscroll-contain space-y-2.5 flex-1 pr-1">
          {timelineItems.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 space-y-2">
              {isToday && renderNowLine()}
              <CalendarIcon className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs font-medium text-neutral-300">No sessions or commitments scheduled</p>
              <p className="text-[11px] text-neutral-500">Entire 24h window is unreserved buffer capacity.</p>
            </div>
          ) : (
            <>
              {timelineItems.map((item, idx) => {
                let nowLineBefore = false;
                if (isToday && !hasRenderedNowLine && currentTime < item.startTime) {
                  nowLineBefore = true;
                  hasRenderedNowLine = true;
                }

                const isHappeningNow =
                  isToday &&
                  item.startTime <= currentTime &&
                  item.endTime > currentTime;

                if (item.type === 'busy') {
                  return (
                    <React.Fragment key={`busy-${idx}`}>
                      {nowLineBefore && renderNowLine()}
                      <div
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                          isHappeningNow
                            ? 'bg-[#07CB6C]/10 border-[#07CB6C]/40 text-white shadow-[0_0_10px_rgba(7,203,108,0.1)]'
                            : 'bg-white/[0.02] border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isHappeningNow ? 'bg-[#07CB6C]/20 text-[#07CB6C]' : 'bg-white/5 text-neutral-400'
                          }`}>
                            <Briefcase className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-200 truncate flex items-center gap-1.5">
                              <span>{item.title}</span>
                              {isHappeningNow && (
                                <span className="text-[10px] font-mono text-[#07CB6C] font-semibold">• Happening Now</span>
                              )}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono">Routine Commitment</div>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-neutral-300 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 shrink-0">
                          {item.startTime} – {item.endTime}
                        </span>
                      </div>
                    </React.Fragment>
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
                  <React.Fragment key={`session-${s.id}`}>
                    {nowLineBefore && renderNowLine()}
                    <div
                      onClick={() => onSelectSession(s)}
                      className={`min-h-[44px] p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                        isDone
                          ? 'bg-white/[0.01] border-white/5 text-neutral-500 opacity-80'
                          : isHappeningNow
                          ? 'bg-[#0a1811] border-[#07CB6C] shadow-[0_0_15px_rgba(7,203,108,0.18)]'
                          : sessionTier === 'core'
                          ? 'bg-white/[0.03] border-[#07CB6C]/40 hover:border-[#07CB6C]'
                          : sessionTier === 'buffer'
                          ? 'bg-white/[0.02] border-dashed border-white/10 hover:border-white/20'
                          : 'bg-white/[0.02] border-white/10 hover:border-[#07CB6C]/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-[#07CB6C]/10 text-[#07CB6C]'
                            : isHappeningNow
                            ? 'bg-[#07CB6C]/20 text-[#07CB6C]'
                            : sessionTier === 'core'
                            ? 'bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30'
                            : 'bg-white/5 text-neutral-400'
                        }`}>
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : getTimeIcon(s.task_template?.preferred_time_of_day)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-wider ${
                              sessionTier === 'core' ? 'text-[#07CB6C]' : sessionTier === 'reflect' ? 'text-indigo-400' : 'text-neutral-400'
                            }`}>
                              [{sessionTier.toUpperCase()}]
                            </span>
                            <span className={`font-medium truncate ${isDone ? 'line-through text-neutral-500' : 'text-white'}`}>
                              {item.title}
                            </span>
                            {isHappeningNow && (
                              <span className="text-[9px] font-mono font-bold text-[#07CB6C] bg-[#07CB6C]/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-[#07CB6C] animate-ping" />
                                Live Now
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{s.task_template?.session_duration_minutes || 60}m session</span>
                            <span>•</span>
                            <span>{s.task_template?.phase?.title?.split(':')[0] || 'Phase 1'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <span className={`font-mono text-xs px-2.5 py-1 rounded-lg border ${
                          isHappeningNow
                            ? 'bg-[#07CB6C]/10 border-[#07CB6C]/40 text-[#07CB6C] font-semibold'
                            : 'bg-white/5 border-white/5 text-neutral-300'
                        }`}>
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
                              : 'bg-white/5 text-neutral-400 border-white/10'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              {isToday && !hasRenderedNowLine && renderNowLine()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="min-h-[40px] px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/10 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
