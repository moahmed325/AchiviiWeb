import React, { useMemo } from 'react';
import { RoutineSettings, DailyTask } from '../types';
import {
  Sun,
  Moon,
  Clock,
  Briefcase,
  CheckCircle2,
} from 'lucide-react';

interface DayRoutineTimelineProps {
  routine?: RoutineSettings | null;
  task: DailyTask;
}

export const DayRoutineTimeline: React.FC<DayRoutineTimelineProps> = ({
  routine,
  task,
}) => {
  const wakeTime = routine?.wakeTime || '07:00';
  const sleepTime = routine?.sleepTime || '23:00';
  const busyHours = routine?.busyHours || '09:00 - 17:00';
  const durationMinutes = task.durationMinutes || routine?.dailyMinutes || 30;
  const preferredSlot = routine?.preferredSlot || 'morning';

  // Compute pre-scheduled slot time based on routine if not already explicitly set
  const scheduledTime = useMemo(() => {
    if (task.slotTime && task.slotTime !== 'Anytime') {
      return task.slotTime;
    }
    if (preferredSlot === 'morning') return '07:30 - 08:00';
    if (preferredSlot === 'afternoon') return '13:00 - 13:30';
    return '18:30 - 19:00';
  }, [task.slotTime, preferredSlot]);

  // Parse busy block start and end (e.g. "09:00 - 17:00")
  const [busyStart, busyEnd] = useMemo(() => {
    const parts = busyHours.split('-').map((s) => s.trim());
    return [parts[0] || '09:00', parts[1] || '17:00'];
  }, [busyHours]);

  // Identify which daily section contains the task
  const activeSection = useMemo(() => {
    const lower = scheduledTime.toLowerCase();
    if (preferredSlot === 'morning' || lower.includes('07:') || lower.includes('08:')) return 'morning';
    if (preferredSlot === 'afternoon' || lower.includes('12:') || lower.includes('13:') || lower.includes('14:')) return 'midday';
    return 'evening';
  }, [scheduledTime, preferredSlot]);

  return (
    <div className="rounded-md bg-[#080d0b] border border-[#1a2824] p-4 space-y-3">
      {/* Header with routine parameters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a2824]/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Daily Routine Schedule
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-neutral-400">
          <span className="flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-400" />
            <span>Wake: {wakeTime}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-neutral-400" />
            <span>Busy: {busyHours}</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Moon className="w-3 h-3 text-indigo-400" />
            <span>Sleep: {sleepTime}</span>
          </span>
        </div>
      </div>

      {/* Visual Timeline Strip representing 24h day */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
          <span>{wakeTime} (Wake)</span>
          <span>{busyStart}</span>
          <span className="text-neutral-400 font-semibold">{busyHours} (Work / Busy)</span>
          <span>{busyEnd}</span>
          <span>{sleepTime} (Sleep)</span>
        </div>

        {/* Multi-segment Day Bar with Pre-set Task Position */}
        <div className="h-8 w-full rounded-md bg-[#050807] border border-[#1a2824] flex overflow-hidden relative">
          {/* 1. Morning Window (Wake to Busy Start) */}
          <div
            className="flex-1 bg-amber-950/10 border-r border-[#1a2824] flex items-center justify-center relative"
            title="Morning Focus Window"
          >
            {activeSection === 'morning' ? (
              <div className="w-full h-full bg-[#07CB6C] text-black font-semibold text-[10px] font-mono flex items-center justify-center gap-1 px-1 shadow-sm animate-fadeIn">
                <span className="truncate">⚡ {scheduledTime} ({durationMinutes}m)</span>
              </div>
            ) : (
              <span className="text-[10px] text-amber-400/60 font-mono">Morning Window</span>
            )}
          </div>

          {/* 2. Work / Busy Block */}
          <div
            className="flex-[2] bg-neutral-900/60 border-r border-[#1a2824] flex items-center justify-center relative"
            title={`Busy Block: ${busyHours}`}
          >
            {activeSection === 'midday' ? (
              <div className="w-full h-full bg-[#07CB6C] text-black font-semibold text-[10px] font-mono flex items-center justify-center gap-1 px-1 shadow-sm animate-fadeIn">
                <span className="truncate">⚡ {scheduledTime} ({durationMinutes}m)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-mono">
                <Briefcase className="w-3 h-3 text-neutral-500" />
                <span className="hidden sm:inline">Work / Commute</span>
              </div>
            )}
          </div>

          {/* 3. Evening Window (Busy End to Sleep) */}
          <div
            className="flex-1 bg-indigo-950/10 flex items-center justify-center relative"
            title="Evening Focus Window"
          >
            {activeSection === 'evening' ? (
              <div className="w-full h-full bg-[#07CB6C] text-black font-semibold text-[10px] font-mono flex items-center justify-center gap-1 px-1 shadow-sm animate-fadeIn">
                <span className="truncate">⚡ {scheduledTime} ({durationMinutes}m)</span>
              </div>
            ) : (
              <span className="text-[10px] text-indigo-400/60 font-mono">Evening Window</span>
            )}
          </div>
        </div>
      </div>

      {/* Routine Insight — Pre-scheduled automatically with zero decision fatigue */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-0.5 text-xs">
        <div className="flex items-center gap-1.5 text-neutral-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
          <span>
            Pre-scheduled for your <strong className="text-white capitalize">{preferredSlot}</strong> focus window ({scheduledTime}) around your daily routine.
          </span>
        </div>
        <span className="text-[11px] font-mono text-neutral-400 self-start sm:self-auto">
          {durationMinutes} min session
        </span>
      </div>
    </div>
  );
};

export default DayRoutineTimeline;
