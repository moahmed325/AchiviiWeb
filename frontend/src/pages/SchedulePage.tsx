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
        {/* Top Header & Navigation */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="space-y-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Back to Workbench</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#07CB6C]" />
              <span>Schedule & Timeline</span>
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Your 12-week roadmap and daily calendar, balanced around your real-life commitments.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setViewMode('trajectory')}
                className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'trajectory'
                    ? 'bg-[#07CB6C]/15 text-[#07CB6C] font-semibold border border-[#07CB6C]/30 shadow-sm'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>12-Week Roadmap</span>
              </button>

              <button
                onClick={() => setViewMode('life')}
                className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'life'
                    ? 'bg-[#07CB6C]/15 text-[#07CB6C] font-semibold border border-[#07CB6C]/30 shadow-sm'
                    : 'text-neutral-400 hover:text-white border border-transparent'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Daily Life Rhythm</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'trajectory' ? (
          <>
            {/* Sleek 1-line 12-Week Quick Scrubber */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 text-xs">
              <div className="flex items-center gap-1.5 flex-nowrap">
                <span className="text-xs text-neutral-400 mr-1 hidden sm:inline font-medium">Week:</span>
                {Array.from({ length: 12 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedWeekOffset(i)}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      selectedWeekOffset === i
                        ? 'bg-[#07CB6C] text-black font-bold shadow-sm'
                        : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    W{i + 1}
                  </button>
                ))}
              </div>
              <span className="text-xs text-neutral-400 hidden md:inline shrink-0">
                {selectedWeekOffset < 4 ? 'Phase 1: Foundation' : selectedWeekOffset < 8 ? 'Phase 2: Acceleration' : 'Phase 3: Delivery'}
              </span>
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0a0f0d] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-semibold text-white">
                  Full-Day Rhythm & Routine
                </h3>
                <p className="text-xs text-neutral-400">
                  Your daily schedule showing your fixed commitments alongside your ambition sessions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">
                  {lifeItems.length} items scheduled this week
                </span>
              </div>
            </div>

            {lifeLoading && (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
                <span className="text-xs text-neutral-400">Loading daily schedule...</span>
              </div>
            )}

            {lifeError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{lifeError}</span>
              </div>
            )}

            {!lifeLoading && !lifeError && datesSorted.length === 0 && (
              <div className="p-8 rounded-2xl bg-[#0a0f0d] border border-white/10 text-center space-y-3">
                <Clock className="w-8 h-8 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400">No scheduled items found for the upcoming 7 days.</p>
                <Link
                  to="/onboarding"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#07CB6C] text-black text-xs font-semibold"
                >
                  Setup Ambition Routine
                </Link>
              </div>
            )}

            {!lifeLoading && !lifeError && datesSorted.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                {datesSorted.map((dateStr) => {
                  const dayItems = groupedLifeItems[dateStr];
                  const dayDate = new Date(dateStr + 'T00:00:00');
                  const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                  const monthDay = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={dateStr}
                      className="bg-[#0a0f0d] rounded-2xl border border-white/5 p-3 space-y-2.5 flex flex-col"
                    >
                      <div className="pb-2 border-b border-white/5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{dayName}</span>
                        <span className="text-[11px] font-mono text-neutral-400">{monthDay}</span>
                      </div>

                      <div className="space-y-2 flex-1">
                        {dayItems.map((item) => {
                          const isDose = item.item_type === 'AMBITION_DOSE';
                          const isDone = item.status === 'COMPLETED';

                          return (
                            <div
                              key={item.id}
                              className={`p-2.5 rounded-xl border text-xs space-y-1 transition-all ${
                                isDone
                                  ? 'bg-white/[0.01] border-white/5 text-neutral-500 opacity-60'
                                  : isDose
                                  ? 'bg-[#0a140f] border-[#07CB6C]/30 text-white shadow-sm'
                                  : 'bg-white/[0.02] border-white/5 text-neutral-300'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px]">
                                <span className={isDose ? 'text-[#07CB6C] font-mono font-medium' : 'text-neutral-500 font-mono'}>
                                  {item.start_time} - {item.end_time}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${
                                    isDone
                                      ? 'bg-white/5 text-neutral-400'
                                      : isDose
                                      ? 'bg-[#07CB6C]/15 text-[#07CB6C]'
                                      : 'bg-white/5 text-neutral-400'
                                  }`}
                                >
                                  {isDone ? 'Done' : isDose ? 'Focus' : item.category || 'Routine'}
                                </span>
                              </div>

                              <p className={`text-xs font-medium leading-snug ${isDone ? 'line-through text-neutral-500' : 'text-white'}`}>
                                {item.title}
                              </p>

                              {isDose && item.allocated_minutes && (
                                <div className="text-[10px] text-neutral-400 flex items-center gap-1 pt-0.5">
                                  <Clock className="w-3 h-3 text-[#07CB6C]" />
                                  <span>{item.allocated_minutes}m</span>
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
