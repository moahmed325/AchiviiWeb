import React, { useMemo } from 'react';
import { RoutineSettings, DailyTask } from '../types';
import {
  Sun,
  Sunset,
  Moon,
  Briefcase,
  Target,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
} from 'lucide-react';

interface FullDayVisualizerProps {
  routine?: RoutineSettings | null;
  task: DailyTask;
  isExpanded: boolean;
  onToggleExpand: () => void;
  children: React.ReactNode;
}

export const FullDayVisualizer: React.FC<FullDayVisualizerProps> = ({
  routine,
  task,
  isExpanded,
  onToggleExpand,
  children,
}) => {
  const wakeTime = routine?.wakeTime || '07:00';
  const sleepTime = routine?.sleepTime || '23:00';
  const busyHours = routine?.busyHours || '09:00 - 17:00';
  const durationMinutes = task.durationMinutes || routine?.dailyMinutes || 30;
  const preferredSlot = routine?.preferredSlot || 'morning';

  // Compute scheduled slot time based on routine if not explicitly set
  const scheduledTime = useMemo(() => {
    if (task.slotTime && task.slotTime !== 'Anytime') {
      return task.slotTime;
    }
    if (preferredSlot === 'morning') return '07:30 - 08:00';
    if (preferredSlot === 'afternoon') return '13:00 - 13:30';
    return '18:30 - 19:00';
  }, [task.slotTime, preferredSlot]);

  // Parse busy hours end
  const busyEnd = useMemo(() => {
    const parts = busyHours.split('-').map((s) => s.trim());
    return parts[1] || '17:00';
  }, [busyHours]);

  const isMorningSlot = preferredSlot === 'morning' || scheduledTime.toLowerCase().includes('07:') || scheduledTime.toLowerCase().includes('08:');

  return (
    <div className="rounded-md bg-[#0c1210] border border-[#1a2824] p-5 sm:p-6 space-y-5 animate-fadeIn">
      {/* Schedule Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a2824] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#07CB6C]" />
            <h3 className="text-base font-bold text-white tracking-tight">
              {task.dayOfWeek} Schedule
            </h3>
            <span className="text-xs font-mono text-neutral-400">
              ({task.date})
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Your daily timeline built around your routine. Click your focus session to view steps.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/20 px-2.5 py-1 rounded-md self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5" />
          <span>{scheduledTime} ({durationMinutes}m)</span>
        </div>
      </div>

      {/* Chronological Day Timeline */}
      <div className="space-y-3">
        {/* 1. Wake Up */}
        <div className="p-3 rounded-md bg-[#080d0b] border border-[#14201c] flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-amber-950/30 border border-amber-500/20 flex items-center justify-center">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div>
              <span className="font-mono font-semibold text-neutral-200">{wakeTime}</span>
              <span className="ml-2 text-neutral-400">Wake Up & Morning Window</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Day Start</span>
        </div>

        {/* 2. Morning Focus Task (If morning slot) */}
        {isMorningSlot && (
          <div
            className={`rounded-md border transition-all ${
              isExpanded
                ? 'border-[#07CB6C] bg-[#0c1511] ring-1 ring-[#07CB6C]/30 shadow-lg'
                : task.status === 'completed'
                ? 'border-[#07CB6C]/40 bg-[#09120f] hover:border-[#07CB6C]/60'
                : 'border-[#07CB6C]/70 bg-[#09140f] hover:border-[#07CB6C]'
            }`}
          >
            {/* Clickable Task Block Header */}
            <button
              type="button"
              onClick={onToggleExpand}
              className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left cursor-pointer focus-visible:outline-none"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                    task.status === 'completed'
                      ? 'bg-[#07CB6C]/20 border-[#07CB6C] text-[#07CB6C]'
                      : 'bg-[#07CB6C] text-black font-bold border-[#07CB6C]'
                  }`}
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Target className="w-4 h-4" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#07CB6C]">
                      ⚡ {scheduledTime}
                    </span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-xs font-mono text-neutral-300">
                      {durationMinutes} min practice
                    </span>
                    {task.isRestDay && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-950/40 text-blue-400 border border-blue-800/40">
                        Recovery Day
                      </span>
                    )}
                  </div>

                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    {task.title}
                  </h4>
                </div>
              </div>

              {/* Status & Click Indicator */}
              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                    task.status === 'completed'
                      ? 'bg-[#07CB6C]/20 text-[#07CB6C]'
                      : 'bg-[#07CB6C] text-black'
                  }`}
                >
                  {task.status === 'completed' ? '✓ Completed' : 'Ready'}
                </span>

                <div className="inline-flex items-center gap-1 text-xs text-[#07CB6C] font-semibold">
                  <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </button>

            {/* Revealed Details on Click */}
            {isExpanded && (
              <div className="border-t border-[#1a2824] p-5 sm:p-6 space-y-6 animate-fadeIn">
                {children}
              </div>
            )}
          </div>
        )}

        {/* 3. Work / Busy Block */}
        <div className="p-3.5 rounded-md bg-[#070b09] border border-[#14201c] flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-neutral-900 border border-white/5 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-neutral-500" />
            </div>
            <div>
              <span className="font-mono font-semibold text-neutral-300">{busyHours}</span>
              <span className="ml-2 text-neutral-400">Work & Committed Hours</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Busy Window</span>
        </div>

        {/* 4. Midday / Evening Focus Task (If not morning slot) */}
        {!isMorningSlot && (
          <div
            className={`rounded-md border transition-all ${
              isExpanded
                ? 'border-[#07CB6C] bg-[#0c1511] ring-1 ring-[#07CB6C]/30 shadow-lg'
                : task.status === 'completed'
                ? 'border-[#07CB6C]/40 bg-[#09120f] hover:border-[#07CB6C]/60'
                : 'border-[#07CB6C]/70 bg-[#09140f] hover:border-[#07CB6C]'
            }`}
          >
            {/* Clickable Task Block Header */}
            <button
              type="button"
              onClick={onToggleExpand}
              className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left cursor-pointer focus-visible:outline-none"
            >
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                    task.status === 'completed'
                      ? 'bg-[#07CB6C]/20 border-[#07CB6C] text-[#07CB6C]'
                      : 'bg-[#07CB6C] text-black font-bold border-[#07CB6C]'
                  }`}
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Target className="w-4 h-4" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#07CB6C]">
                      ⚡ {scheduledTime}
                    </span>
                    <span className="text-neutral-600">•</span>
                    <span className="text-xs font-mono text-neutral-300">
                      {durationMinutes} min practice
                    </span>
                    {task.isRestDay && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-950/40 text-blue-400 border border-blue-800/40">
                        Recovery Day
                      </span>
                    )}
                  </div>

                  <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
                    {task.title}
                  </h4>
                </div>
              </div>

              {/* Status & Click Indicator */}
              <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                <span
                  className={`px-2.5 py-1 rounded text-xs font-mono font-semibold ${
                    task.status === 'completed'
                      ? 'bg-[#07CB6C]/20 text-[#07CB6C]'
                      : 'bg-[#07CB6C] text-black'
                  }`}
                >
                  {task.status === 'completed' ? '✓ Completed' : 'Ready'}
                </span>

                <div className="inline-flex items-center gap-1 text-xs text-[#07CB6C] font-semibold">
                  <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </button>

            {/* Revealed Details on Click */}
            {isExpanded && (
              <div className="border-t border-[#1a2824] p-5 sm:p-6 space-y-6 animate-fadeIn">
                {children}
              </div>
            )}
          </div>
        )}

        {/* 5. Evening Free Time */}
        <div className="p-3 rounded-md bg-[#080d0b] border border-[#14201c] flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-center">
              <Sunset className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <span className="font-mono font-semibold text-neutral-200">{busyEnd} – {sleepTime}</span>
              <span className="ml-2 text-neutral-400">Evening Free Time & Wind Down</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Free Time</span>
        </div>

        {/* 6. Sleep */}
        <div className="p-3 rounded-md bg-[#080d0b] border border-[#14201c] flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-purple-950/30 border border-purple-500/20 flex items-center justify-center">
              <Moon className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <span className="font-mono font-semibold text-neutral-200">{sleepTime}</span>
              <span className="ml-2 text-neutral-400">Sleep & Full Recovery</span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-neutral-500">Rest</span>
        </div>
      </div>
    </div>
  );
};

export default FullDayVisualizer;
