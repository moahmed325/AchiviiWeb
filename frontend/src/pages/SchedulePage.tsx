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
  const [isConfirmingRegen, setIsConfirmingRegen] = useState<boolean>(false);
  const [regenNotice, setRegenNotice] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!token) return;
    if (!isConfirmingRegen) {
      setIsConfirmingRegen(true);
      return;
    }

    setIsRegenerating(true);
    setIsConfirmingRegen(false);
    setRegenNotice(null);
    setRegenError(null);
    try {
      const res = await regenerateSchedule(token);
      setRegenNotice(`Successfully generated ${res.sessionCount} sessions across all 12 weeks!`);
      // Trigger re-render
      setSelectedWeekOffset((prev) => prev);
    } catch (err: any) {
      setRegenError(err.message || 'Failed to regenerate schedule.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white relative min-h-screen">
      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2824]">
          <div className="space-y-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Back to Workbench</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight flex items-center gap-2.5">
              <Calendar className="w-6 h-6 text-[#07CB6C]" />
              <span>12-Week Execution Schedule</span>
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Explore every scheduled session of your 3-month goal plan, adapted to your weekly routine.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {isConfirmingRegen && (
              <button
                onClick={() => setIsConfirmingRegen(false)}
                className="px-3 py-2 rounded-lg text-neutral-400 hover:text-white border border-[#1a2824] hover:bg-[#131f1b] text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              id="btn-regenerate-schedule"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-mono flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                isConfirmingRegen
                  ? 'bg-amber-500 text-black font-semibold hover:bg-amber-400'
                  : 'bg-[#0d1412] hover:bg-[#131f1b] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-[#2a3e38]'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isConfirmingRegen ? 'text-black' : 'text-[#07CB6C]'} ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>{isConfirmingRegen ? 'Confirm Regenerate Plan?' : 'Regenerate Plan'}</span>
            </button>
          </div>
        </div>

        {regenNotice && (
          <div className="p-3.5 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
            <span>{regenNotice}</span>
          </div>
        )}

        {regenError && (
          <div className="p-3.5 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            <span>{regenError}</span>
          </div>
        )}

        {/* 12-Week Quick Selector Bar */}
        <div className="p-1.5 rounded-xl bg-[#0a0f0d] border border-[#1a2824] flex items-center gap-1 overflow-x-auto scrollbar-none">
          {Array.from({ length: 12 }).map((_, idx) => {
            const isSelected = selectedWeekOffset === idx;
            const phaseNumber = idx < 4 ? 1 : idx < 8 ? 2 : 3;
            return (
              <button
                key={idx}
                onClick={() => setSelectedWeekOffset(idx)}
                className={`min-h-[44px] py-1.5 px-3.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#131f1b] text-white border border-[#07CB6C]/40'
                    : 'text-neutral-400 hover:text-white hover:bg-[#0d1412] border border-transparent'
                }`}
              >
                <span>Week {idx + 1}</span>
                <span className={`text-[10px] font-mono ${isSelected ? 'text-[#07CB6C]' : 'text-neutral-500'}`}>
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
