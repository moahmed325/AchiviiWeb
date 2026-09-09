import React, { useState } from 'react';
import { GoalCatalog } from '../types';
import { Clock, Calendar, ArrowRight, BookOpen, Activity, Code, Database, Cpu, Layers } from 'lucide-react';

interface GoalCardProps {
  goal: GoalCatalog;
  onInspect: (goal: GoalCatalog) => void;
  onSelect: (goal: GoalCatalog) => void;
  hasActiveGoal?: boolean;
  isActiveGoal?: boolean;
}

const BLUEPRINT_IMAGES: Record<string, string> = {
  'build-and-launch-a-saas-mvp': '/images/blueprints/saas-mvp.png',
  'saas-mvp': '/images/blueprints/saas-mvp.png',
  'run-a-10k-half-marathon': '/images/blueprints/half-marathon.png',
  'half-marathon': '/images/blueprints/half-marathon.png',
  'learn-conversational-spanish-to-b1': '/images/blueprints/spanish-b1.png',
  'spanish-b1': '/images/blueprints/spanish-b1.png',
  'master-distributed-systems-architecture': '/images/blueprints/distributed-systems.png',
  'distributed-systems': '/images/blueprints/distributed-systems.png',
  'write-and-publish-a-non-fiction-book': '/images/blueprints/write-book.png',
  'write-book': '/images/blueprints/write-book.png',
  'daily-mindfulness-breathwork-habit': '/images/blueprints/mindfulness.png',
  'mindfulness': '/images/blueprints/mindfulness.png',
};

function getBlueprintImage(goal: GoalCatalog): string | null {
  if (!goal) return null;
  const slug = (goal.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (BLUEPRINT_IMAGES[slug]) return BLUEPRINT_IMAGES[slug];

  const title = (goal.title || '').toLowerCase();
  if (title.includes('saas') || title.includes('mvp')) return '/images/blueprints/saas-mvp.png';
  if (title.includes('marathon') || title.includes('10k')) return '/images/blueprints/half-marathon.png';
  if (title.includes('spanish') || title.includes('conversational')) return '/images/blueprints/spanish-b1.png';
  if (title.includes('distributed') || title.includes('systems')) return '/images/blueprints/distributed-systems.png';
  if (title.includes('book') || title.includes('publish') || title.includes('non-fiction')) return '/images/blueprints/write-book.png';
  if (title.includes('mindfulness') || title.includes('breathwork') || title.includes('habit')) return '/images/blueprints/mindfulness.png';

  return null;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onInspect,
  onSelect,
  hasActiveGoal = false,
  isActiveGoal = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const imageSrc = getBlueprintImage(goal);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'software & technical':
      case 'engineering':
      case 'technology':
        return <Code className="w-3.5 h-3.5 text-[#07CB6C]" />;
      case 'language & cognitive':
      case 'language':
        return <BookOpen className="w-3.5 h-3.5 text-[#07CB6C]" />;
      case 'health & fitness':
      case 'fitness':
      case 'endurance':
        return <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />;
      case 'data & analytics':
        return <Database className="w-3.5 h-3.5 text-[#07CB6C]" />;
      case 'system architecture':
        return <Cpu className="w-3.5 h-3.5 text-[#07CB6C]" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-[#07CB6C]" />;
    }
  };

  const getEffortTag = (hours: number) => {
    if (hours >= 10) return 'INTENSIVE TRACK';
    if (hours >= 5) return 'MODERATE PACING';
    return 'FOUNDATIONAL HABIT';
  };

  const handlePreview = () => {
    onInspect(goal);
  };

  return (
    <div className="rounded-md bg-[#0d1412] border border-[#1a2824] hover:border-[#07CB6C]/40 transition-all duration-300 flex flex-col justify-between shadow-none group overflow-hidden">
      {/* 16:9 Image Header Banner */}
      {imageSrc && !imageError && (
        <div
          onClick={handlePreview}
          className="relative w-full aspect-video overflow-hidden border-b border-[#1a2824] bg-[#0c1210] cursor-pointer"
        >
          <img
            src={imageSrc}
            alt={goal.title}
            loading="lazy"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105 filter brightness-95 contrast-105"
          />
          {/* Subtle dark fade into card body */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1412] via-transparent to-transparent opacity-80 pointer-events-none" />

          {/* Anchored Monospace Telemetry Badge (Top Right) */}
          <div className="absolute top-3 right-3 font-mono text-[10px] tracking-wider px-2 py-0.5 rounded bg-[#080d0b]/90 border border-[#1a2824] text-[#07CB6C] uppercase font-medium">
            12-WK PROTOCOL
          </div>
        </div>
      )}

      {/* Card Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Card Title (Click triggers modal preview) */}
          <h3
            onClick={handlePreview}
            className="text-lg sm:text-xl font-medium text-white tracking-normal mb-2 hover:text-[#07CB6C] transition-colors cursor-pointer"
          >
            {goal.title}
          </h3>

          {/* Plain-Language Outcome Summary */}
          <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2 mb-4">
            {goal.description}
          </p>

          {/* Essential Metrics Strip with Effort Tag */}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#080d0b] border border-[#1a2824] text-xs font-mono text-neutral-300">
              <Clock className="w-3 h-3 text-[#07CB6C]" />
              <span>12 WEEKS</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#080d0b] border border-[#1a2824] text-xs font-mono text-neutral-300">
              <Calendar className="w-3 h-3 text-[#07CB6C]" />
              <span>{goal.est_weekly_hours}H / WK</span>
            </span>
            <span className="inline-flex items-center font-mono text-[10px] text-neutral-400 bg-[#121c18] px-2 py-1 rounded border border-[#1a2824]">
              {getEffortTag(goal.est_weekly_hours)}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#080d0b] border border-[#1a2824] text-xs font-mono text-[#07CB6C]">
              {getCategoryIcon(goal.category)}
              <span>{goal.category.toUpperCase()}</span>
            </span>
          </div>
        </div>

        {/* Card Footer: Single Decisive Full-Width CTA */}
        <div className="pt-4 border-t border-[#1a2824]">
          {isActiveGoal ? (
            <button
              type="button"
              onClick={() => onSelect(goal)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#07CB6C]/15 hover:bg-[#07CB6C] text-[#07CB6C] hover:text-[#080d0b] border border-[#07CB6C]/40 hover:border-[#07CB6C] font-mono font-semibold text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group/btn"
            >
              <span>Go to Active Workbench</span>
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          ) : hasActiveGoal ? (
            <button
              type="button"
              onClick={() => onSelect(goal)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0d1412] hover:bg-[#161f1c] text-neutral-300 hover:text-white border border-[#1a2824] hover:border-amber-500/40 font-mono text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group/btn"
            >
              <span className="text-amber-400 font-semibold">[Active Protocol In Progress]</span>
              <span className="hidden sm:inline">Switch Protocol</span>
              <ArrowRight className="w-4 h-4 text-amber-400 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelect(goal)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#14221c] hover:bg-[#07CB6C] text-neutral-200 hover:text-[#080d0b] border border-[#1a2824] hover:border-[#07CB6C] font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group/btn"
            >
              <span>Select Blueprint</span>
              <ArrowRight className="w-4 h-4 text-[#07CB6C] group-hover/btn:text-[#080d0b] group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
