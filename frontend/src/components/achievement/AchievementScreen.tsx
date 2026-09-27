import React, { useState, useRef, useMemo } from 'react';
import { Sparkles, BarChart2, BookOpen } from 'lucide-react';
import type { Goal, AchievementCelebrationState } from '../../types';
import { computeAchievementSummary } from '../../lib/achievement';
import { AchievementHero } from './AchievementHero';
import { AchievementResults } from './AchievementResults';
import { AchievementJourney } from './AchievementJourney';
import { NewJourneyDialog } from './NewJourneyDialog';
import { cx } from '../ui';

interface AchievementScreenProps {
  goal: Goal;
  onBeginAnotherJourney?: () => void;
  initialTab?: AchievementCelebrationState['activeTab'];
  className?: string;
}

type TabKey = AchievementCelebrationState['activeTab'];

const TABS: { id: TabKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'achievement', label: 'The Arrival', icon: Sparkles },
  { id: 'results', label: 'Your Results', icon: BarChart2 },
  { id: 'journey', label: 'What You Accomplished', icon: BookOpen },
];

/**
 * Visual Level 4 Cinematic Achievement Screen (BP §34, VDS §17–18, §26–27).
 * Hosts the Roman garden arrival, verified metrics breakdown, and journey accomplishments.
 */
export const AchievementScreen: React.FC<AchievementScreenProps> = ({
  goal,
  onBeginAnotherJourney,
  initialTab = 'achievement',
  className,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [isNewJourneyDialogOpen, setIsNewJourneyDialogOpen] = useState(false);
  const tabRefs = useRef<{ [key in TabKey]?: HTMLButtonElement | null }>({});

  const summary = useMemo(() => computeAchievementSummary(goal), [goal]);

  const handleBeginAnotherJourney = () => {
    if (onBeginAnotherJourney) {
      onBeginAnotherJourney();
    } else {
      setIsNewJourneyDialogOpen(true);
    }
  };

  // Keyboard navigation for accessible tabs (ARIA Authoring Practices Guide)
  const handleKeyDown = (e: React.KeyboardEvent, currentTab: TabKey) => {
    const currentIndex = TABS.findIndex((t) => t.id === currentTab);
    let nextIndex = -1;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      const nextTab = TABS[nextIndex].id;
      setActiveTab(nextTab);
      tabRefs.current[nextTab]?.focus();
    }
  };

  return (
    <main
      id="main"
      className={cx(
        'ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-8 sm:py-12 lg:py-16 text-left',
        'motion-safe:animate-rise-in',
        className
      )}
    >
      {/* 1. Accessible Tab Navigation Strip */}
      <div className="mb-8 flex justify-center sm:justify-start">
        <div
          role="tablist"
          aria-label="Achievement sections"
          className="inline-flex rounded-control border border-border bg-surface p-1 shadow-sm"
        >
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                id={`tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isSelected}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className={cx(
                  'focus-ring flex min-h-11 items-center gap-2 rounded-control px-4 py-2 text-small font-medium',
                  'transition-all duration-(--duration-quick)',
                  isSelected
                    ? 'bg-achievement text-background shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text hover:bg-surface-elevated'
                )}
              >
                <Icon className={cx('size-4', isSelected ? 'text-background' : 'text-achievement')} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Tab Panels */}
      <div className="w-full">
        {activeTab === 'achievement' && (
          <div
            id="panel-achievement"
            role="tabpanel"
            aria-labelledby="tab-achievement"
            tabIndex={0}
            className="focus:outline-none"
          >
            <AchievementHero
              goal={goal}
              summary={summary}
              onViewResults={() => setActiveTab('results')}
              onBeginAnotherJourney={handleBeginAnotherJourney}
            />
          </div>
        )}

        {activeTab === 'results' && (
          <div
            id="panel-results"
            role="tabpanel"
            aria-labelledby="tab-results"
            tabIndex={0}
            className="focus:outline-none"
          >
            <AchievementResults goal={goal} summary={summary} />
          </div>
        )}

        {activeTab === 'journey' && (
          <div
            id="panel-journey"
            role="tabpanel"
            aria-labelledby="tab-journey"
            tabIndex={0}
            className="focus:outline-none"
          >
            <AchievementJourney goal={goal} summary={summary} />
          </div>
        )}
      </div>

      <NewJourneyDialog
        open={isNewJourneyDialogOpen}
        onOpenChange={setIsNewJourneyDialogOpen}
        goal={goal}
      />
    </main>
  );
};
