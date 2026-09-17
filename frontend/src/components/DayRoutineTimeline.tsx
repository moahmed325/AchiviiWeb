import React, { useMemo } from 'react';
import { RoutineSettings, DailyTask } from '../types';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  Briefcase,
} from 'lucide-react';

interface DayRoutineTimelineProps {
  routine?: RoutineSettings | null;
  task: DailyTask;
  onSlotChange?: (slotTime: string) => void;
  isUpdating?: boolean;
}

export const DayRoutineTimeline: React.FC<DayRoutineTimelineProps> = ({
  routine,
  task,
  onSlotChange,
  isUpdating = false,
}) => {
  // Fallbacks if routine is not set or partially missing
  const wakeTime = routine?.wakeTime || '07:00';
  const sleepTime = routine?.sleepTime || '23:00';
  const busyHours = routine?.busyHours || '09:00 - 17:00';
  const durationMinutes = task.durationMinutes || routine?.dailyMinutes || 30;
  const currentSlot = task.slotTime || '07:30 - 08:00';

  // Parse busy start and end (e.g. "09:00 - 17:00" -> ["09:00", "17:00"])
  const [busyStart, busyEnd] = useMemo(() => {
    const parts = busyHours.split('-').map((s) => s.trim());
    return [parts[0] || '09:00', parts[1] || '17:00'];
  }, [busyHours]);

  // Pre-calculated available routine slots where a task can comfortably fit
  const availableSlots = useMemo(() => {
    return [
      {
        id: 'morning',
        label: 'Morning Slot',
        time: '07:30 - 08:00',
        window: 'Morning',
        icon: <Sun className="w-3 h-3 text-amber-400" />,
        isPreferred: routine?.preferredSlot === 'morning',
        tag: 'Recommended',
      },
      {
        id: 'midday',
        label: 'Lunch Break',
        time: '12:30 - 13:00',
        window: 'Midday',
        icon: <Clock className="w-3 h-3 text-sky-400" />,
        isPreferred: routine?.preferredSlot === 'afternoon',
        tag: 'Quick Break',
      },
      {
        id: 'evening',
        label: 'Evening Focus',
        time: '18:00 - 18:30',
        window: 'Evening',
        icon: <Sunset className="w-3 h-3 text-orange-400" />,
        isPreferred: routine?.preferredSlot === 'evening',
        tag: 'After Work',
      },
      {
        id: 'night',
        label: 'Night Session',
        time: '20:30 - 21:00',
        window: 'Night',
        icon: <Moon className="w-3 h-3 text-indigo-400" />,
        isPreferred: false,
        tag: 'Quiet Hours',
      },
    ];
  }, [routine]);

  // Determine current active slot match
  const activeSlotId = useMemo(() => {
    const matched = availableSlots.find(
      (s) => s.time.toLowerCase() === currentSlot.toLowerCase()
    );
    if (matched) return matched.id;
    if (currentSlot.toLowerCase().includes('07:') || currentSlot.toLowerCase().includes('08:')) return 'morning';
    if (currentSlot.toLowerCase().includes('12:') || currentSlot.toLowerCase().includes('13:')) return 'midday';
    if (currentSlot.toLowerCase().includes('17:') || currentSlot.toLowerCase().includes('18:')) return 'evening';
    if (currentSlot.toLowerCase().includes('20:') || currentSlot.toLowerCase().includes('21:')) return 'night';
    return 'morning';
  }, [availableSlots, currentSlot]);

  return (
    <div className="rounded-md bg-[#080d0b] border border-[#1a2824] p-4 space-y-4">
      {/* Header with routine parameters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a2824]/60 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Daily Routine Cadence
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

        {/* Multi-segment Day Bar */}
        <div className="h-8 w-full rounded-md bg-[#050807] border border-[#1a2824] flex overflow-hidden relative">
          {/* 1. Morning Window (Wake to Busy Start) */}
          <div
            className="flex-1 bg-amber-950/10 border-r border-[#1a2824] flex items-center justify-center relative group"
            title="Morning Free Window"
          >
            {activeSlotId === 'morning' ? (
              <div className="w-full h-full bg-[#07CB6C] text-black font-semibold text-[10px] font-mono flex items-center justify-center gap-1 px-1 shadow-sm animate-fadeIn">
                <span className="truncate">⚡ {currentSlot} ({durationMinutes}m)</span>
              </div>
            ) : (
              <span className="text-[10px] text-amber-400/60 font-mono">Morning Window</span>
            )}
          </div>

          {/* 2. Work / Busy Block */}
          <div
            className="flex-[2] bg-neutral-900/60 border-r border-[#1a2824] flex items-center justify-center relative pattern-stripes"
            title={`Busy Block: ${busyHours}`}
          >
            {activeSlotId === 'midday' ? (
              <div className="w-full h-full bg-[#07CB6C] text-black font-semibold text-[10px] font-mono flex items-center justify-center gap-1 px-1 shadow-sm animate-fadeIn">
                <span className="truncate">⚡ {currentSlot} ({durationMinutes}m)</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-mono">
                <Briefcase className="w-3 h-3 text-neutral-500" />
                <span className="hidden sm:inline">Work / Commute</span>
              </div>
            )}
          </div>

          {/* 3. Evening Window (Busy End to Sleep) */}
          <div
            className="flex-1 bg-indigo-950/10 flex items-center justify-center relative group"
            title="Evening Free Window"
          >
            {activeSlotId === 'evening' || activeSlotId === 'night' ? (
              <div className="w-full h-full bg-[#07CB6C] text-black font-semibold text-[10px] font-mono flex items-center justify-center gap-1 px-1 shadow-sm animate-fadeIn">
                <span className="truncate">⚡ {currentSlot} ({durationMinutes}m)</span>
              </div>
            ) : (
              <span className="text-[10px] text-indigo-400/60 font-mono">Evening Window</span>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Slot Selector: See where the task can go */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Select where today's session fits best into your schedule:
          </p>
          <span className="text-[10px] font-mono text-[#07CB6C]">
            Target: {durationMinutes} min
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {availableSlots.map((slot) => {
            const isCurrent = activeSlotId === slot.id;

            return (
              <button
                key={slot.id}
                type="button"
                disabled={isUpdating}
                onClick={() => onSlotChange && onSlotChange(slot.time)}
                className={`p-2.5 rounded-md border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-[#0f1915] border-[#07CB6C] text-white shadow-xs'
                    : 'bg-[#0c1210] border-[#1a2824] text-neutral-300 hover:border-neutral-600 hover:bg-[#111a17]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {slot.icon}
                    <span className="text-xs font-semibold">{slot.label}</span>
                  </div>
                  {isCurrent && (
                    <span className="w-4 h-4 rounded-full bg-[#07CB6C] text-black flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono">
                  <span className={isCurrent ? 'text-[#07CB6C] font-semibold' : 'text-neutral-400'}>
                    {slot.time}
                  </span>
                  <span className="text-[9px] text-neutral-500">
                    {slot.tag}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DayRoutineTimeline;
