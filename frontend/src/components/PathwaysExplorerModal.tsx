import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  ArrowRight,
  Clock,
  Award,
  Layers,
  Search,
} from 'lucide-react';
import { CERTIFIED_PATHWAYS, CertifiedPathway } from '../lib/certifiedPresets';

interface PathwaysExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeGoalTitle?: string;
}

export const PathwaysExplorerModal: React.FC<PathwaysExplorerModalProps> = ({
  isOpen,
  onClose,
  activeGoalTitle
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Tech & Career', 'Fitness & Health', 'Creative & Media', 'Mastery & Mind'];

  const filteredPathways = useMemo(() => {
    return CERTIFIED_PATHWAYS.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.badge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleSelectPathway = (pathway: CertifiedPathway) => {
    localStorage.setItem('achivii_draft_goal', pathway.title);
    onClose();
    navigate('/onboarding', {
      state: {
        presetGoal: pathway.title,
        isPreset: true,
        switchGoal: true
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#080d0b] border border-[#1a2824] rounded-lg shadow-2xl flex flex-col overflow-hidden text-left animate-scaleUp">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[#1a2824] flex items-start justify-between gap-4 bg-[#0c1411]">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-xs font-mono text-[#07CB6C]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Certified Master Blueprints</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Explore 90-Day Pathways
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Each pathway features 12 invariant milestones, gold-standard scientific frameworks, and daily session scripts.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar & Search */}
        <div className="p-4 sm:px-6 border-b border-[#1a2824] bg-[#090f0c] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#07CB6C] text-black font-semibold'
                    : 'bg-[#111a17] hover:bg-[#16221e] text-neutral-300 border border-[#1a2824]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search pathways..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#060908] border border-[#1a2824] focus:border-[#07CB6C]/60 rounded-md text-white placeholder-neutral-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Pathways Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredPathways.map((pathway) => {
              const isActive = activeGoalTitle && activeGoalTitle.toLowerCase().includes(pathway.label?.toLowerCase() || pathway.id);

              return (
                <div
                  key={pathway.id}
                  className={`rounded-lg overflow-hidden border text-left transition-all flex flex-col justify-between bg-[#0c1210] group ${
                    isActive ? 'border-[#07CB6C] ring-1 ring-[#07CB6C]/40' : 'border-[#1a2824] hover:border-[#07CB6C]/60'
                  }`}
                >
                  {/* Dedicated Visual Image Banner with Full Clarity */}
                  <div className="relative w-full h-36 sm:h-40 overflow-hidden bg-[#050807]">
                    <img
                      src={pathway.image}
                      alt={pathway.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c1210] via-transparent to-black/30" />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold tracking-wider text-[#07CB6C]">
                      {pathway.tag}
                    </span>
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[10px] font-mono text-neutral-300 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                      <Clock className="w-3 h-3 text-[#07CB6C]" />
                      <span>{pathway.dailyMinutes}m/day</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-[#07CB6C] transition-colors leading-snug">
                        {pathway.title}
                      </h3>
                      <p className="text-xs text-neutral-300 line-clamp-2 leading-relaxed">
                        {pathway.desc}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-neutral-400 pt-0.5">
                        <Award className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{pathway.badge}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-[#1a2824] flex items-center justify-between">
                      <span className="text-[11px] font-mono text-neutral-500">
                        12 Milestones
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectPathway(pathway)}
                        className="px-3.5 py-1.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.98] text-black font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <span>{isActive ? 'Restart Pathway' : 'Select Pathway'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPathways.length === 0 && (
            <div className="py-16 text-center space-y-2">
              <Layers className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-medium text-neutral-400">No pathways match your search</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="text-xs text-[#07CB6C] hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
