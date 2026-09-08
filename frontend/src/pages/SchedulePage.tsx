import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { regenerateSchedule } from '../lib/api';
import { ArrowLeft, RefreshCw, Calendar } from 'lucide-react';

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
    <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7] relative">
      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#182621]">
          <div className="space-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#7e8f85] hover:text-[#e5ebe7] transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#e5ebe7] flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#07CB6C]" />
              <span>12-Week Execution Schedule</span>
            </h1>
            <p className="text-[#7e8f85] text-xs sm:text-sm">
              Explore every scheduled session of your 3-month goal plan, adapted to your weekly routine.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              id="btn-regenerate-schedule"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="min-h-[44px] px-3.5 py-2 rounded-sm bg-[#0c1210] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] border border-[#182621] hover:border-[#1f332c] text-xs font-mono flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#07CB6C] ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate Plan</span>
            </button>
          </div>
        </div>

        {regenNotice && (
          <div className="p-3.5 rounded-sm bg-[#07CB6C]/10 border border-[#07CB6C]/25 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
            <span>{regenNotice}</span>
          </div>
        )}

        {/* 12-Week Quick Selector Bar */}
        <div className="p-1.5 rounded-md bg-[#0c1210] border border-[#182621] flex items-center gap-1 overflow-x-auto scrollbar-none">
          {Array.from({ length: 12 }).map((_, idx) => {
            const isSelected = selectedWeekOffset === idx;
            const phaseNumber = idx < 4 ? 1 : idx < 8 ? 2 : 3;
            return (
              <button
                key={idx}
                onClick={() => setSelectedWeekOffset(idx)}
                className={`min-h-[44px] py-1.5 px-3 rounded-sm text-xs font-mono whitespace-nowrap transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#16221e] text-[#e5ebe7] border border-[#1f332c]'
                    : 'text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#080d0b] border border-transparent'
                }`}
              >
                <span>Week {idx + 1}</span>
                <span className={`text-[9px] font-mono ${isSelected ? 'text-[#07CB6C]' : 'text-[#55675c]'}`}>
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
