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
      case 'technology':
        return <Code className="w-4 h-4 text-[#07CB6C]" />;
      case 'language & cognitive':
      case 'language':
        return <BookOpen className="w-4 h-4 text-[#07CB6C]" />;
      case 'health & fitness':
      case 'fitness':
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

  const getSchematicLabel = (g: GoalCatalog) => {
    const cat = g.category.toLowerCase();
    const title = g.title.toLowerCase();
    if (cat.includes('tech') || cat.includes('eng') || cat.includes('soft') || title.includes('saas') || title.includes('distributed')) {
      return 'SYSTEM ARCHITECTURE NODE GRAPH';
    }
    if (cat.includes('fit') || cat.includes('endur') || cat.includes('health') || title.includes('marathon') || title.includes('10k')) {
      return 'STEPPED CADENCE SPARKLINE';
    }
    if (cat.includes('lang') || cat.includes('cogn') || title.includes('spanish') || title.includes('learn')) {
      return 'SPACED-REPETITION RETENTION CURVE';
    }
    if (cat.includes('writ') || cat.includes('book') || title.includes('book') || title.includes('publish')) {
      return 'STRUCTURED CHAPTER MATRIX';
    }
    return 'CONTINUOUS CADENCE WAVE';
  };

  const renderSchematic = (g: GoalCatalog) => {
    const cat = g.category.toLowerCase();
    const title = g.title.toLowerCase();

    // Full-Stack / SaaS / Distributed Systems / Engineering
    if (cat.includes('tech') || cat.includes('eng') || cat.includes('soft') || title.includes('saas') || title.includes('distributed')) {
      return (
        <svg viewBox="0 0 320 50" className="w-full h-10 stroke-[#182621] fill-none" preserveAspectRatio="none">
          <line x1="20" y1="25" x2="80" y2="25" stroke="#1f332c" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="80" y1="25" x2="150" y2="15" stroke="#1f332c" strokeWidth="1" />
          <line x1="80" y1="25" x2="150" y2="35" stroke="#1f332c" strokeWidth="1" />
          <line x1="150" y1="15" x2="230" y2="15" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="150" y1="35" x2="230" y2="35" stroke="#1f332c" strokeWidth="1" />
          <line x1="230" y1="15" x2="295" y2="25" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="230" y1="35" x2="295" y2="25" stroke="#1f332c" strokeWidth="1" />
          
          <circle cx="20" cy="25" r="3.5" fill="#0c1210" stroke="#7e8f85" strokeWidth="1" />
          <rect x="72" y="17" width="16" height="16" rx="2" fill="#080d0b" stroke="#1f332c" strokeWidth="1" />
          <circle cx="150" cy="15" r="4" fill="#07CB6C" stroke="#07CB6C" />
          <circle cx="150" cy="35" r="3.5" fill="#080d0b" stroke="#1f332c" strokeWidth="1" />
          <rect x="222" y="7" width="16" height="16" rx="2" fill="#0c1210" stroke="#07CB6C" strokeWidth="1" />
          <rect x="222" y="27" width="16" height="16" rx="2" fill="#080d0b" stroke="#182621" strokeWidth="1" />
          <circle cx="295" cy="25" r="4" fill="#07CB6C" stroke="#07CB6C" />
        </svg>
      );
    }

    // Marathon / Fitness / Endurance
    if (cat.includes('fit') || cat.includes('endur') || cat.includes('health') || title.includes('marathon') || title.includes('10k')) {
      return (
        <svg viewBox="0 0 320 50" className="w-full h-10 stroke-[#182621] fill-none" preserveAspectRatio="none">
          <line x1="15" y1="42" x2="305" y2="42" stroke="#182621" strokeWidth="1" />
          <line x1="90" y1="32" x2="90" y2="42" stroke="#182621" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="170" y1="22" x2="170" y2="42" stroke="#182621" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="250" y1="12" x2="250" y2="42" stroke="#182621" strokeWidth="1" strokeDasharray="2 2" />
          <path
            d="M15 42 L50 42 L50 37 L90 37 L90 32 L130 32 L130 27 L170 27 L170 22 L210 22 L210 17 L250 17 L250 12 L285 12 L285 7 L305 7"
            stroke="#07CB6C"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="170" cy="22" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
          <circle cx="250" cy="12" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
          <circle cx="305" cy="7" r="3.5" fill="#07CB6C" stroke="#07CB6C" />
        </svg>
      );
    }

    // Language / Cognitive
    if (cat.includes('lang') || cat.includes('cogn') || title.includes('spanish') || title.includes('learn')) {
      return (
        <svg viewBox="0 0 320 50" className="w-full h-10 stroke-[#182621] fill-none" preserveAspectRatio="none">
          <line x1="15" y1="42" x2="305" y2="42" stroke="#182621" strokeWidth="1" />
          <path d="M15 12 Q55 32 80 40" stroke="#1f332c" strokeWidth="1" />
          <path d="M80 10 Q125 25 160 34" stroke="#1f332c" strokeWidth="1.2" />
          <path d="M160 8 Q215 18 245 24" stroke="#07CB6C" strokeWidth="1.2" />
          <path d="M245 6 Q285 12 305 14" stroke="#07CB6C" strokeWidth="1.5" />
          <line x1="80" y1="10" x2="80" y2="40" stroke="#182621" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="160" y1="8" x2="160" y2="34" stroke="#182621" strokeWidth="1" strokeDasharray="2 2" />
          <line x1="245" y1="6" x2="245" y2="24" stroke="#182621" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="80" cy="10" r="3" fill="#080d0b" stroke="#1f332c" strokeWidth="1" />
          <circle cx="160" cy="8" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
          <circle cx="245" cy="6" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
          <circle cx="305" cy="14" r="3.5" fill="#07CB6C" stroke="#07CB6C" />
        </svg>
      );
    }

    // Book / Writing
    if (cat.includes('writ') || cat.includes('book') || title.includes('book') || title.includes('publish')) {
      return (
        <svg viewBox="0 0 320 50" className="w-full h-10 stroke-[#182621] fill-none" preserveAspectRatio="none">
          <rect x="15" y="6" width="80" height="36" rx="1.5" fill="#080d0b" stroke="#182621" strokeWidth="1" />
          <rect x="105" y="6" width="105" height="36" rx="1.5" fill="#080d0b" stroke="#182621" strokeWidth="1" />
          <rect x="220" y="6" width="85" height="36" rx="1.5" fill="#080d0b" stroke="#182621" strokeWidth="1" />
          
          <line x1="25" y1="15" x2="75" y2="15" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="25" y1="24" x2="65" y2="24" stroke="#1f332c" strokeWidth="1" />
          <line x1="25" y1="33" x2="80" y2="33" stroke="#1f332c" strokeWidth="1" />

          <line x1="115" y1="15" x2="195" y2="15" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="115" y1="24" x2="180" y2="24" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="115" y1="33" x2="190" y2="33" stroke="#1f332c" strokeWidth="1" />

          <line x1="230" y1="15" x2="290" y2="15" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="230" y1="24" x2="280" y2="24" stroke="#07CB6C" strokeWidth="1.2" />
          <line x1="230" y1="33" x2="295" y2="33" stroke="#07CB6C" strokeWidth="1.2" />
        </svg>
      );
    }

    // Habits / Mindfulness / Default
    return (
      <svg viewBox="0 0 320 50" className="w-full h-10 stroke-[#182621] fill-none" preserveAspectRatio="none">
        <line x1="15" y1="25" x2="305" y2="25" stroke="#182621" strokeWidth="1" strokeDasharray="3 3" />
        <path
          d="M15 25 Q50 8 85 25 T155 25 T225 25 T295 25"
          stroke="#07CB6C"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="85" cy="25" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
        <circle cx="155" cy="25" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
        <circle cx="225" cy="25" r="3" fill="#080d0b" stroke="#07CB6C" strokeWidth="1" />
        <circle cx="295" cy="25" r="3.5" fill="#07CB6C" stroke="#07CB6C" />
      </svg>
    );
  };

  const totalPhases = goal.phases?.length || 3;
  const totalWeeks = goal.phases?.reduce((sum, p) => sum + p.duration_weeks, 0) || 12;

  return (
    <div className="rounded-md bg-[#0c1210] border border-[#182621] hover:border-[#2a443a] transition-colors p-5 flex flex-col justify-between space-y-5 shadow-none group">
      <div className="space-y-4">
        {/* Technical Wireframe Schematic Banner */}
        <div className="w-full rounded-sm bg-[#080d0b] border border-[#182621] p-2.5 flex flex-col justify-between overflow-hidden relative group-hover:border-[#1f332c] transition-colors">
          <div className="flex items-center justify-between text-[8px] font-mono text-[#55675c] uppercase tracking-wider mb-1.5">
            <span>SCHEMATIC // {getSchematicLabel(goal)}</span>
            <span className="text-[#07CB6C]/70">1PX WIREFRAME</span>
          </div>
          {renderSchematic(goal)}
        </div>

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
