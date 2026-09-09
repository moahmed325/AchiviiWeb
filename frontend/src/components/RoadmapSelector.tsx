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
      return { label: 'Micro-Habit Rhythm', color: 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30' };
    }
    return { label: 'Balanced Progression', color: 'bg-sky-500/10 text-sky-300 border-sky-500/30' };
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/20 text-[#07CB6C] text-xs font-mono font-medium uppercase tracking-wider">
          <Compass className="w-3.5 h-3.5" />
          <span>AI Execution Roadmaps</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Choose How You Want to Pace This Goal
        </h2>
        <p className="text-neutral-400 text-sm max-w-xl mx-auto leading-relaxed">
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
              className={`relative flex flex-col justify-between p-6 rounded-2xl border transition-all duration-200 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] ${
                isSelected
                  ? 'bg-[#07CB6C]/5 border-[#07CB6C] shadow-2xl shadow-[#07CB6C]/5'
                  : 'bg-[#0a0f0d] border-[#1a2824] hover:border-[#2a3e38]'
              }`}
            >
              {/* Selected Tag */}
              {isSelected && (
                <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-[#07CB6C] text-[#080d0b] text-[10px] font-mono font-semibold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Selected
                </div>
              )}

              {/* Card Header */}
              <div className="space-y-4">
                <div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-2 flex items-center gap-2">
                    {roadmap.name}
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                    {roadmap.description}
                  </p>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 py-3 px-3 rounded-xl bg-[#0d1412] border border-[#1a2824]">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                      <Calendar className="w-3 h-3 text-[#07CB6C]" />
                      Days/Week
                    </div>
                    <div className="text-base font-semibold text-white">
                      {roadmap.days_per_week} days
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Session Length
                    </div>
                    <div className="text-xs font-semibold text-neutral-200 mt-0.5">
                      {getVarianceText(roadmap.daily_minutes_variance)}
                    </div>
                  </div>
                </div>

                {/* Trade-offs Section (Decision Log D5) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
                    <Scale className="w-3.5 h-3.5 text-neutral-400" />
                    Trade-offs & Reality Check:
                  </div>
                  <p className="text-xs text-neutral-400 bg-[#0d1412] p-3 rounded-xl border border-[#1a2824] leading-relaxed italic">
                    &ldquo;{roadmap.trade_offs || 'Steady baseline pace adhering directly to catalog recommendations.'}&rdquo;
                  </p>
                </div>
              </div>

              {/* Radio Indicator */}
              <div className="mt-6 pt-4 border-t border-[#1a2824] flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">
                  {isSelected ? 'Active Selection' : 'Click to select'}
                </span>
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'border-[#07CB6C] bg-[#07CB6C] text-[#080d0b]'
                      : 'border-[#1a2824] bg-[#0d1412]'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-[#080d0b]" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#1a2824]">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#1a2824] bg-[#0d1412] text-neutral-300 hover:bg-[#131f1b] hover:text-white text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Routine</span>
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedRoadmapId || isSubmitting}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] font-mono font-medium text-xs shadow-[0_0_15px_rgba(7,203,108,0.25)] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
