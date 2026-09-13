import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { fetchWeekSchedule, DailyScheduleItem } from '../lib/lifeApi';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Clock,
  AlertCircle,
  Loader2,
  CalendarDays,
} from 'lucide-react';

export const SchedulePage: React.FC = () => {
  const { token } = useAuth();
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'trajectory' | 'life'>('trajectory');
  const [lifeItems, setLifeItems] = useState<DailyScheduleItem[]>([]);
  const [lifeLoading, setLifeLoading] = useState<boolean>(false);
  const [lifeError, setLifeError] = useState<string | null>(null);

  useEffect(() => {
    if (viewMode === 'life' && token) {
      setLifeLoading(true);
      setLifeError(null);
      fetchWeekSchedule(token)
        .then((res) => {
          setLifeItems(res.items || []);
        })
        .catch((err) => {
          setLifeError(err.message || 'Failed to load life schedule.');
        })
        .finally(() => {
          setLifeLoading(false);
        });
    }
  }, [viewMode, token]);

  // Group life items by date
  const groupedLifeItems = lifeItems.reduce((acc, item) => {
    const dStr = item.date ? item.date.split('T')[0] : 'Unknown';
    if (!acc[dStr]) acc[dStr] = [];
    acc[dStr].push(item);
    return acc;
  }, {} as Record<string, DailyScheduleItem[]>);

  const datesSorted = Object.keys(groupedLifeItems).sort();

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white relative min-h-screen">
      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2824]">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Back to Today's Workbench</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#07CB6C]" />
              <span>Execution Trajectory & Life Schedule</span>
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Explore your dynamic 90-day trajectory alongside your integrated weekly routine blocks and ambition doses.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-[#0a0f0d] p-1 rounded-lg border border-[#1a2824]">
              <button
                onClick={() => setViewMode('trajectory')}
                className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'trajectory'
                    ? 'bg-[#131f1b] text-white border border-[#07CB6C]/40 font-bold'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>12-Week Trajectory</span>
              </button>

              <button
                onClick={() => setViewMode('life')}
                className={`min-h-[36px] px-3 py-1 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'life'
                    ? 'bg-[#131f1b] text-white border border-[#07CB6C]/40 font-bold'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Integrated Life Schedule</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'trajectory' ? (
          <>
            {/* 3-Phase Roadmap Milestone Ribbon */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  order: 1,
                  name: 'Foundation',
                  weeks: 'Weeks 1–4',
                  desc: 'Core architecture, prerequisites & habit baseline',
                  activeWeeks: [0, 1, 2, 3],
                },
                {
                  order: 2,
                  name: 'Acceleration',
                  weeks: 'Weeks 5–8',
                  desc: 'Endurance build, feature delivery & velocity flow',
                  activeWeeks: [4, 5, 6, 7],
                },
                {
                  order: 3,
                  name: 'Delivery',
                  weeks: 'Weeks 9–12',
                  desc: 'Capstone deliverables, launch readiness & graduation',
                  activeWeeks: [8, 9, 10, 11],
                },
              ].map((phase) => {
                const isCurrentPhase = phase.activeWeeks.includes(selectedWeekOffset);
                return (
                  <div
                    key={phase.order}
                    onClick={() => setSelectedWeekOffset(phase.activeWeeks[0])}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isCurrentPhase
                        ? 'bg-[#0f1d17] border-[#07CB6C] shadow-[0_0_15px_rgba(7,203,108,0.15)]'
                        : 'bg-[#0a0f0d] border-[#1a2824] hover:border-[#2a3e38] opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                          isCurrentPhase ? 'text-[#07CB6C]' : 'text-neutral-400'
                        }`}
                      >
                        Phase {phase.order}: {phase.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          isCurrentPhase
                            ? 'bg-[#07CB6C]/20 text-[#07CB6C] border border-[#07CB6C]/30 font-bold'
                            : 'bg-[#131f1b] text-neutral-500'
                        }`}
                      >
                        {phase.weeks}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 line-clamp-1">{phase.desc}</p>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 pt-1 border-t border-[#1a2824]">
                      <span>Active in view:</span>
                      <span className={isCurrentPhase ? 'text-[#07CB6C] font-semibold' : 'text-neutral-500'}>
                        {isCurrentPhase
                          ? `Week ${selectedWeekOffset + 1} (${(selectedWeekOffset % 4) + 1}/4)`
                          : 'Inactive'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 12-Week Quick Selector Bar with Explicit Phase Boundaries */}
            <div className="p-2 rounded-xl bg-[#0a0f0d] border border-[#1a2824] flex flex-col sm:flex-row items-stretch sm:items-center gap-2 overflow-x-auto scrollbar-none">
              {[
                { phase: 1, name: 'Foundation', weeks: [0, 1, 2, 3] },
                { phase: 2, name: 'Acceleration', weeks: [4, 5, 6, 7] },
                { phase: 3, name: 'Delivery', weeks: [8, 9, 10, 11] },
              ].map((group, gIdx) => (
                <React.Fragment key={group.phase}>
                  <div className="flex-1 flex items-center gap-1 bg-[#0c1210] p-1.5 rounded-lg border border-[#16221e]">
                    <div className="hidden lg:flex flex-col justify-center px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-neutral-500 border-r border-[#1a2824] shrink-0">
                      <span className="font-bold text-neutral-400">P{group.phase}</span>
                      <span className="text-[8px] text-neutral-600">{group.name}</span>
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-1">
                      {group.weeks.map((idx) => {
                        const isSelected = selectedWeekOffset === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedWeekOffset(idx)}
                            className={`min-h-[44px] py-1.5 px-2 rounded-md text-xs font-mono whitespace-nowrap transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                              isSelected
                                ? 'bg-[#131f1b] text-white border border-[#07CB6C] shadow-[0_0_8px_rgba(7,203,108,0.2)] font-bold'
                                : 'text-neutral-400 hover:text-white hover:bg-[#0d1412] border border-transparent'
                            }`}
                          >
                            <span>W{idx + 1}</span>
                            <span
                              className={`text-[9px] font-mono ${
                                isSelected ? 'text-[#07CB6C]' : 'text-neutral-500'
                              }`}
                            >
                              Phase {group.phase}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {gIdx < 2 && (
                    <div className="hidden sm:flex items-center justify-center text-neutral-600 text-xs px-0.5">
                      →
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Calendar Week View */}
            <CalendarWeekView
              key={selectedWeekOffset}
              initialWeekOffset={selectedWeekOffset}
              onWeekChange={(newOffset) => setSelectedWeekOffset(newOffset)}
            />
          </>
        ) : (
          /* Integrated Daily Life Schedule (7 Days) */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#0a0f0d] border border-[#1a2824] flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                  LIFE INTEGRATION ENGINE // 7-DAY REAL-TIME SCHEDULE
                </span>
                <p className="text-xs text-neutral-400 font-mono">
                  Your daily life schedule materialized directly from waking/sleep boundaries, hard routine blocks, and adaptive ambition doses.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-neutral-400">
                  {lifeItems.length} items scheduled this week
                </span>
              </div>
            </div>

            {lifeLoading && (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
                <span className="text-xs font-mono text-neutral-400">Loading integrated life schedule...</span>
              </div>
            )}

            {lifeError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-mono text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{lifeError}</span>
              </div>
            )}

            {!lifeLoading && !lifeError && datesSorted.length === 0 && (
              <div className="p-8 rounded-xl bg-[#0a0f0d] border border-[#1a2824] text-center space-y-2">
                <Clock className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="text-xs font-mono text-neutral-400">No scheduled items found for the upcoming 7 days.</p>
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#07CB6C] text-[#080d0b] text-xs font-mono font-bold"
                >
                  Setup Ambition Protocol
                </Link>
              </div>
            )}

            {!lifeLoading && !lifeError && datesSorted.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {datesSorted.map((dateStr) => {
                  const dayItems = groupedLifeItems[dateStr];
                  const dayDate = new Date(dateStr + 'T00:00:00');
                  const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                  const monthDay = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={dateStr}
                      className="bg-[#0a0f0d] rounded-xl border border-[#1a2824] p-3 space-y-2 flex flex-col"
                    >
                      <div className="pb-2 border-b border-[#1a2824] flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white">{dayName}</span>
                        <span className="text-[10px] font-mono text-neutral-500">{monthDay}</span>
                      </div>

                      <div className="space-y-2 flex-1">
                        {dayItems.map((item) => {
                          const isDose = item.item_type === 'AMBITION_DOSE';
                          const isDone = item.status === 'COMPLETED';

                          return (
                            <div
                              key={item.id}
                              className={`p-2 rounded-lg border text-xs font-mono space-y-1 transition-all ${
                                isDone
                                  ? 'bg-[#07CB6C]/5 border-[#07CB6C]/30 text-neutral-300'
                                  : isDose
                                  ? 'bg-[#0f1d17] border-[#07CB6C]/50 text-white shadow-[0_0_8px_rgba(7,203,108,0.1)]'
                                  : 'bg-[#0d1412] border-[#1a2824] text-neutral-400'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={isDose ? 'text-[#07CB6C] font-bold' : 'text-neutral-500'}>
                                  {item.start_time} - {item.end_time}
                                </span>
                                <span
                                  className={`px-1 rounded text-[9px] font-bold uppercase ${
                                    isDone
                                      ? 'bg-[#07CB6C]/20 text-[#07CB6C]'
                                      : isDose
                                      ? 'bg-[#07CB6C]/10 text-[#07CB6C]'
                                      : 'bg-neutral-800 text-neutral-400'
                                  }`}
                                >
                                  {isDone ? 'DONE' : isDose ? 'DOSE' : item.category || 'ROUTINE'}
                                </span>
                              </div>

                              <p className={`text-[11px] leading-tight font-medium ${isDone ? 'line-through text-neutral-500' : 'text-white'}`}>
                                {item.title}
                              </p>

                              {isDose && item.allocated_minutes && (
                                <div className="text-[9px] text-neutral-400 flex items-center gap-1 pt-0.5">
                                  <Clock className="w-2.5 h-2.5 text-[#07CB6C]" />
                                  <span>{item.allocated_minutes}m target</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default SchedulePage;
