import React from 'react';
import { Roadmap } from '../types';
import {
  Compass,
  CheckCircle2,
  Calendar,
  Clock,
  Zap,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Info,
  Scale,
} from 'lucide-react';

interface RoadmapSelectorProps {
  roadmaps: Roadmap[];
  selectedRoadmapId: string | null;
  onSelectRoadmap: (roadmap: Roadmap) => void;
  onConfirm: () => Promise<void> | void;
  onBack: () => void;
  isSubmitting: boolean;
  error?: string | null;
}

export const RoadmapSelector: React.FC<RoadmapSelectorProps> = ({
  roadmaps,
  selectedRoadmapId,
  onSelectRoadmap,
  onConfirm,
  onBack,
  isSubmitting,
  error,
}) => {
  const getPacingBadge = (days: number, variance: number) => {
    if (days <= 3 && variance > 0) {
      return { label: 'Focused Deep Work', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' };
    }
    if (days >= 5 || variance < 0) {
      return { label: 'Micro-Habit Rhythm', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    }
    return { label: 'Balanced Progression', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' };
  };

  const getVarianceText = (variance: number) => {
    if (variance === 0) return 'Standard duration';
    if (variance > 0) return `+${variance}m per session`;
    return `${variance}m lighter sessions`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold uppercase tracking-wider">
          <Compass className="w-3.5 h-3.5" />
          AI Execution Roadmaps
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Choose How You Want to Pace This Goal
        </h2>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto">
          Achivii’s Planner generated these structural roadmap variants tailored to your routine and availability.
          Pick the rhythm that matches your energy and lifestyle.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <Info className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div
        role="radiogroup"
        aria-label="Available Roadmap Pacing Variants"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {roadmaps.map((roadmap, index) => {
          const isSelected = selectedRoadmapId === roadmap.id;
          const badge = getPacingBadge(roadmap.days_per_week, roadmap.daily_minutes_variance);

          return (
            <div
              key={roadmap.id}
              onClick={() => onSelectRoadmap(roadmap)}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${roadmap.name}, ${roadmap.days_per_week} days per week, ${getVarianceText(roadmap.daily_minutes_variance)}. ${roadmap.description}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectRoadmap(roadmap);
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextIndex = (index + 1) % roadmaps.length;
                  onSelectRoadmap(roadmaps[nextIndex]);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prevIndex = (index - 1 + roadmaps.length) % roadmaps.length;
                  onSelectRoadmap(roadmaps[prevIndex]);
                }
              }}
              className={`relative flex flex-col justify-between p-6 rounded-md border transition-all duration-200 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] ${
                isSelected
                  ? 'bg-[#0a1711] border-[#07CB6C] shadow-none'
                  : 'bg-[#0c1210] border-[#182621] hover:border-[#1f332c]'
              }`}
            >
              {/* Selected Tag */}
              {isSelected && (
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-sm bg-[#07CB6C] text-[#050807] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 shadow-none">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Selected
                </div>
              )}

              {/* Card Header */}
              <div className="space-y-4">
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2 flex items-center gap-2">
                    {roadmap.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {roadmap.description}
                  </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 py-3 px-3 rounded-xl bg-zinc-950/50 border border-zinc-800/80">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                      <Calendar className="w-3 h-3 text-indigo-400" />
                      Days/Week
                    </div>
                    <div className="text-base font-bold text-white">
                      {roadmap.days_per_week} days
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-400">
                      <Clock className="w-3 h-3 text-purple-400" />
                      Session Length
                    </div>
                    <div className="text-xs font-semibold text-zinc-200 mt-0.5">
                      {getVarianceText(roadmap.daily_minutes_variance)}
                    </div>
                  </div>
                </div>

                {/* Trade-offs Section (Decision Log D5) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Scale className="w-3.5 h-3.5 text-zinc-400" />
                    Trade-offs & Reality Check:
                  </div>
                  <p className="text-xs text-zinc-400 bg-zinc-900/90 p-3 rounded-lg border border-zinc-800/80 leading-relaxed italic">
                    "{roadmap.trade_offs || 'Steady baseline pace adhering directly to catalog recommendations.'}"
                  </p>
                </div>
              </div>

              {/* Radio Indicator */}
              <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">
                  {isSelected ? 'Active Selection' : 'Click to select'}
                </span>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-zinc-700 bg-zinc-950'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Routine
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedRoadmapId || isSubmitting}
          className="w-full sm:w-auto min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.99] text-[#050807] font-mono font-bold text-xs shadow-none transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating Schedule with Roadmap...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Confirm Roadmap & Generate Schedule</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
