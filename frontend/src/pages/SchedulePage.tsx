import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { regenerateSchedule } from '../lib/api';
import { ArrowLeft, RefreshCw, Calendar, Sparkles } from 'lucide-react';

export const SchedulePage: React.FC = () => {
  const { token } = useAuth();
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [regenNotice, setRegenNotice] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!token) return;
    const confirm = window.confirm('Regenerate entire 12-week schedule based on your current routine?');
    if (!confirm) return;

    setIsRegenerating(true);
    setRegenNotice(null);
    try {
      const res = await regenerateSchedule(token);
      setRegenNotice(`Successfully generated ${res.sessionCount} sessions across all 12 weeks!`);
      // Trigger re-render
      setSelectedWeekOffset((prev) => prev);
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate schedule.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="space-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-3xl font-black text-white flex items-center gap-2.5">
              <Calendar className="w-7 h-7 text-indigo-400" />
              <span>12-Week Time-Blocked Schedule</span>
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Explore every scheduled session of your 3-month goal plan, adapted to your weekly routine.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-regenerate-schedule"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate Plan</span>
            </button>
          </div>
        </div>

        {regenNotice && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{regenNotice}</span>
          </div>
        )}

        {/* 12-Week Quick Selector Bar */}
        <div className="p-2 rounded-2xl glass-panel border border-slate-800 flex items-center gap-1 overflow-x-auto scrollbar-none">
          {Array.from({ length: 12 }).map((_, idx) => {
            const isSelected = selectedWeekOffset === idx;
            const phaseNumber = idx < 4 ? 1 : idx < 8 ? 2 : 3;
            return (
              <button
                key={idx}
                onClick={() => setSelectedWeekOffset(idx)}
                className={`py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex flex-col items-center gap-0.5 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>Week {idx + 1}</span>
                <span className={`text-[9px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                  Phase {phaseNumber}
                </span>
              </button>
            );
          })}
        </div>

        {/* Calendar Week View */}
        <CalendarWeekView
          key={selectedWeekOffset}
          initialWeekOffset={selectedWeekOffset}
          onWeekChange={(newOffset) => setSelectedWeekOffset(newOffset)}
        />
      </main>
    </div>
  );
};
