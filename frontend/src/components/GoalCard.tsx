import React from 'react';
import { GoalCatalog } from '../types';
import { Rocket, Flame, Clock, Calendar, ChevronRight, Layers, Sparkles, Globe, BookOpen, Server, Heart } from 'lucide-react';

interface GoalCardProps {
  goal: GoalCatalog;
  onInspect: (goal: GoalCatalog) => void;
  onSelect: (goal: GoalCatalog) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, onInspect, onSelect }) => {
  const getIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'rocket':
        return <Rocket className="w-6 h-6 text-indigo-400" />;
      case 'flame':
        return <Flame className="w-6 h-6 text-rose-400" />;
      case 'globe':
        return <Globe className="w-6 h-6 text-sky-400" />;
      case 'bookopen':
        return <BookOpen className="w-6 h-6 text-amber-400" />;
      case 'server':
        return <Server className="w-6 h-6 text-emerald-400" />;
      case 'heart':
        return <Heart className="w-6 h-6 text-pink-400" />;
      default:
        return <Sparkles className="w-6 h-6 text-purple-400" />;
    }
  };

  const totalPhases = goal.phases?.length || 3;
  const totalWeeks = goal.phases?.reduce((sum, p) => sum + p.duration_weeks, 0) || 12;

  return (
    <div className="group glass-panel rounded-2xl p-6 border border-slate-800 hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1">
      <div className="space-y-4">
        {/* Top Header: Category & Est Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 group-hover:border-indigo-500/30 group-hover:bg-indigo-950/20 transition-all">
              {getIcon(goal.icon)}
            </div>
            <div>
              <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-400">
                {goal.category}
              </span>
              <h3 className="text-xl font-bold text-white group-hover:text-indigo-200 transition-colors">
                {goal.title}
              </h3>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
          {goal.description}
        </p>

        {/* Key Metrics Chips */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300">
            <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong className="text-white">{goal.est_weekly_hours}h</strong> / week
            </span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong className="text-white">{totalWeeks}</strong> weeks (3 mo)
            </span>
          </div>
        </div>

        {/* Phase Timeline Progression Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              {totalPhases} Sequential Phases
            </span>
            <span className="text-indigo-300 font-mono text-[10px]">Pre-scoped Blueprints</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {goal.phases?.map((phase, idx) => (
              <div
                key={phase.id}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 group-hover:border-slate-700 text-[10px] text-center"
              >
                <div className="text-indigo-400 font-bold">P{idx + 1}</div>
                <div className="text-slate-400 truncate text-[9px]">{phase.duration_weeks}w</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="pt-6 mt-4 border-t border-slate-800/80 flex items-center gap-2">
        <button
          onClick={() => onInspect(goal)}
          className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <span>Inspect Roadmap</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onSelect(goal)}
          className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
        >
          Select Goal
        </button>
      </div>
    </div>
  );
};
