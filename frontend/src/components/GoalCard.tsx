import React from 'react';
import { GoalCatalog } from '../types';
import { Clock, Calendar, ChevronRight, Terminal, Cpu, Database, Activity, Code, BookOpen, Layers } from 'lucide-react';

interface GoalCardProps {
  goal: GoalCatalog;
  onInspect: (goal: GoalCatalog) => void;
  onSelect: (goal: GoalCatalog) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onInspect, onSelect }) => {
  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'software & technical':
      case 'engineering':
        return <Code className="w-4 h-4 text-[#07CB6C]" />;
      case 'language & cognitive':
        return <BookOpen className="w-4 h-4 text-[#07CB6C]" />;
      case 'health & fitness':
      case 'endurance':
        return <Activity className="w-4 h-4 text-[#07CB6C]" />;
      case 'data & analytics':
        return <Database className="w-4 h-4 text-[#07CB6C]" />;
      case 'system architecture':
        return <Cpu className="w-4 h-4 text-[#07CB6C]" />;
      default:
        return <Terminal className="w-4 h-4 text-[#07CB6C]" />;
    }
  };

  const totalPhases = goal.phases?.length || 3;
  const totalWeeks = goal.phases?.reduce((sum, p) => sum + p.duration_weeks, 0) || 12;

  return (
    <div className="rounded-md bg-[#0c1210] border border-[#182621] hover:border-[#2a443a] transition-colors p-5 flex flex-col justify-between space-y-5 shadow-none group">
      <div className="space-y-4">
        {/* Technical Header with Monospace Micro-Label */}
        <div className="flex items-start justify-between gap-3 border-b border-[#182621] pb-3.5">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-[#07CB6C] flex items-center gap-1.5">
                {getCategoryIcon(goal.category)}
                <span>SPEC // {goal.category.toUpperCase()}</span>
              </span>
              <span className="px-1.5 py-0.2 rounded-sm bg-[#16221e] border border-[#1f332c] text-[9px] font-mono text-[#a6b8ad]">
                90-DAY
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#e5ebe7] group-hover:text-white transition-colors truncate">
              {goal.title}
            </h3>
          </div>

          <div className="w-8 h-8 rounded-sm bg-[#080d0b] border border-[#182621] text-[#7e8f85] group-hover:text-[#07CB6C] group-hover:border-[#07CB6C]/30 flex items-center justify-center shrink-0 transition-colors">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Blueprint Description */}
        <p className="text-xs text-[#7e8f85] leading-relaxed line-clamp-2 font-mono">
          {goal.description}
        </p>

        {/* Telemetry Metrics Row */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621]">
            <div className="text-[9px] text-[#55675c] uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#07CB6C]" />
              <span>WEEKLY COMMITMENT</span>
            </div>
            <div className="text-xs font-bold text-[#e5ebe7] mt-0.5">
              {goal.est_weekly_hours} HOURS / WK
            </div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#080d0b] border border-[#182621]">
            <div className="text-[9px] text-[#55675c] uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-[#07CB6C]" />
              <span>EXECUTION CADENCE</span>
            </div>
            <div className="text-xs font-bold text-[#e5ebe7] mt-0.5">
              {totalWeeks} WEEKS (3 PHASES)
            </div>
          </div>
        </div>

        {/* Phase Architecture Breakdown */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#7e8f85]">
            <span>PHASE ARCHITECTURE ({totalPhases} STAGES)</span>
            <span className="text-[#07CB6C]">RECOVERY: ADAPTIVE</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {goal.phases?.map((phase, idx) => (
              <div
                key={phase.id}
                className="p-2 rounded-sm bg-[#080d0b] border border-[#182621] text-left space-y-0.5"
              >
                <div className="text-[10px] font-mono font-bold text-[#07CB6C]">
                  0{idx + 1} // P{idx + 1}
                </div>
                <div className="text-[10px] font-mono text-[#a6b8ad] truncate">
                  {phase.title.split(':')[0]}
                </div>
                <div className="text-[9px] font-mono text-[#55675c]">
                  {phase.duration_weeks} WEEKS
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Structured Technical Action Buttons with >= 44px touch targets */}
      <div className="pt-4 border-t border-[#182621] flex items-center gap-2">
        <button
          type="button"
          onClick={() => onInspect(goal)}
          className="min-h-[44px] flex-1 px-3 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] border border-[#182621] hover:border-[#1f332c] text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>INSPECT BLUEPRINT</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#07CB6C]" />
        </button>

        <button
          type="button"
          onClick={() => onSelect(goal)}
          className="min-h-[44px] px-4 py-2 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
        >
          <span>INITIALIZE</span>
        </button>
      </div>
    </div>
  );
};
