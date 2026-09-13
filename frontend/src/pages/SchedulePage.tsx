import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { CalendarWeekView } from '../components/CalendarWeekView';
import { ArrowLeft, Calendar, Activity } from 'lucide-react';

export const SchedulePage: React.FC = () => {
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number>(0);

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
              <span>12-Week Execution Trajectory</span>
            </h1>
            <p className="text-neutral-400 text-xs sm:text-sm">
              Explore your dynamic 90-day capability trajectory, continuously synchronized with your execution telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-xs font-mono text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
              <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Adaptive Continuous Trajectory</span>
            </div>
          </div>
        </div>

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
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isCurrentPhase ? 'text-[#07CB6C]' : 'text-neutral-400'
                  }`}>
                    Phase {phase.order}: {phase.name}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    isCurrentPhase
                      ? 'bg-[#07CB6C]/20 text-[#07CB6C] border border-[#07CB6C]/30 font-bold'
                      : 'bg-[#131f1b] text-neutral-500'
                  }`}>
                    {phase.weeks}
                  </span>
                </div>
                <p className="text-xs text-neutral-300 line-clamp-1">
                  {phase.desc}
                </p>
                <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 pt-1 border-t border-[#1a2824]">
                  <span>Active in view:</span>
                  <span className={isCurrentPhase ? 'text-[#07CB6C] font-semibold' : 'text-neutral-500'}>
                    {isCurrentPhase ? `Week ${selectedWeekOffset + 1} (${(selectedWeekOffset % 4) + 1}/4)` : 'Inactive'}
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
                        <span className={`text-[9px] font-mono ${isSelected ? 'text-[#07CB6C]' : 'text-neutral-500'}`}>
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
      </main>
    </div>
  );
};
