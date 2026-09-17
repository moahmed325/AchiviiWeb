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

  const isMorningSlot =
    preferredSlot === 'morning' ||
    scheduledTime.toLowerCase().includes('07:') ||
    scheduledTime.toLowerCase().includes('08:');

  // Render the session card
  const renderSessionCard = () => (
    <div className="relative">
      {/* Node Dot on Timeline */}
      <span
        className={`absolute -left-[21px] sm:-left-[29px] top-6 w-3 h-3 rounded-full border-2 border-[#050807] transition-all ${
          task.status === 'completed'
            ? 'bg-[#07CB6C] ring-4 ring-[#07CB6C]/20'
            : 'bg-[#07CB6C] ring-4 ring-[#07CB6C]/30 animate-pulse'
        }`}
      />

      <div
        className={`rounded-md border transition-all ${
          isExpanded
            ? 'border-[#07CB6C] bg-[#0c1410] ring-1 ring-[#07CB6C]/30 shadow-md'
            : task.status === 'completed'
            ? 'border-[#07CB6C]/30 bg-[#09120f] hover:border-[#07CB6C]/60'
            : 'border-[#1a2824] bg-[#0a120e] hover:border-[#07CB6C]/60 hover:bg-[#0d1813]'
        }`}
      >
        {/* Clickable Header */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left cursor-pointer focus-visible:outline-none"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                task.status === 'completed'
                  ? 'bg-[#07CB6C]/20 border-[#07CB6C] text-[#07CB6C]'
                  : 'bg-[#07CB6C] text-black font-bold border-[#07CB6C]'
              }`}
            >
              {task.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Target className="w-3.5 h-3.5" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="font-bold text-[#07CB6C]">
                  {scheduledTime}
                </span>
                <span className="text-neutral-600">•</span>
                <span className="text-neutral-400">
                  {durationMinutes} min practice
                </span>
                {task.isRestDay && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-neutral-800 text-neutral-400">
                    Rest Day
                  </span>
                )}
              </div>

              <h4 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                {task.title}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                task.status === 'completed'
                  ? 'text-[#07CB6C]'
                  : 'text-neutral-400'
              }`}
            >
              {task.status === 'completed' ? '✓ Completed' : 'Pending'}
            </span>

            <div className="inline-flex items-center gap-1 text-xs text-[#07CB6C] font-semibold hover:text-[#06b560]">
              <span>{isExpanded ? 'Hide details' : 'View session'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
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
    </div>
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Quiet Header */}
      <div className="flex items-center justify-between text-xs text-neutral-400 pb-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
          <span className="font-semibold text-white">
            {task.dayOfWeek}, {task.date}
          </span>
        </div>
        <span className="font-mono text-[11px] text-neutral-500">
          Daily Routine Stream
        </span>
      </div>

      {/* Vertical Timeline Stream */}
      <div className="border-l border-[#1a2824] ml-3 sm:ml-4 pl-4 sm:pl-6 space-y-6 relative py-1">
        {/* 1. Wake Up Milestone */}
        <div className="relative flex items-center justify-between text-xs text-neutral-400">
          <span className="absolute -left-[21px] sm:-left-[29px] w-2.5 h-2.5 rounded-full bg-amber-400/80 border-2 border-[#050807]" />
          <div className="flex items-center gap-2">
            <Sun className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
            <span className="font-mono font-medium text-neutral-300">{wakeTime}</span>
            <span className="text-neutral-500">•</span>
            <span>Wake Up & Morning Window</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 hidden sm:inline">Start</span>
        </div>

        {/* 2. Morning Session (If morning slot) */}
        {isMorningSlot && renderSessionCard()}

        {/* 3. Work / Committed Hours */}
        <div className="relative flex items-center justify-between text-xs text-neutral-500">
          <span className="absolute -left-[21px] sm:-left-[29px] w-2.5 h-2.5 rounded-full bg-neutral-700 border-2 border-[#050807]" />
          <div className="flex items-center gap-2">
            <Briefcase className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
            <span className="font-mono font-medium text-neutral-400">{busyHours}</span>
            <span className="text-neutral-600">•</span>
            <span>Work & Committed Hours</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 hidden sm:inline">Busy Block</span>
        </div>

        {/* 4. Afternoon / Evening Session (If not morning slot) */}
        {!isMorningSlot && renderSessionCard()}

        {/* 5. Evening Free Time */}
        <div className="relative flex items-center justify-between text-xs text-neutral-400">
          <span className="absolute -left-[21px] sm:-left-[29px] w-2.5 h-2.5 rounded-full bg-orange-400/60 border-2 border-[#050807]" />
          <div className="flex items-center gap-2">
            <Sunset className="w-3.5 h-3.5 text-orange-400/70 shrink-0" />
            <span className="font-mono font-medium text-neutral-300">{busyEnd} – {sleepTime}</span>
            <span className="text-neutral-500">•</span>
            <span>Evening Personal Time</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 hidden sm:inline">Wind Down</span>
        </div>

        {/* 6. Sleep Milestone */}
        <div className="relative flex items-center justify-between text-xs text-neutral-400">
          <span className="absolute -left-[21px] sm:-left-[29px] w-2.5 h-2.5 rounded-full bg-indigo-400/80 border-2 border-[#050807]" />
          <div className="flex items-center gap-2">
            <Moon className="w-3.5 h-3.5 text-indigo-400/80 shrink-0" />
            <span className="font-mono font-medium text-neutral-300">{sleepTime}</span>
            <span className="text-neutral-500">•</span>
            <span>Sleep & Recovery</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-600 hidden sm:inline">Night Rest</span>
        </div>
      </div>
    </div>
  );
};

export default FullDayVisualizer;
