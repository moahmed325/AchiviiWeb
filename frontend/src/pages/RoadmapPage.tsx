import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useJourneyData } from '../hooks/useJourneyData';
import { JourneyHeader } from '../components/journey/JourneyHeader';
import { DesktopStaircase } from '../components/journey/DesktopStaircase';
import { StrategicRoadmap } from '../components/journey/StrategicRoadmap';

export const RoadmapPage: React.FC = () => {
  const journey = useJourneyData();

  return (
    <main
      id="main"
      tabIndex={-1}
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 animate-fadeIn focus:outline-none w-full min-w-0 overflow-x-hidden"
    >
      {!journey ? (
        <div className="rounded-card border border-border bg-surface p-8 text-center space-y-4 max-w-md mx-auto my-12">
          <div className="size-12 rounded-full bg-surface-elevated border border-border flex items-center justify-center mx-auto text-accent">
            <Compass className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-text">No Active Journey</h1>
            <p className="text-xs text-text-secondary">
              Set your 90-day ambition to generate your personalized roadmap.
            </p>
          </div>
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center px-4 py-2 rounded-control bg-accent text-background text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            Create Your Journey
          </Link>
        </div>
      ) : (
        <>
          {/* Layer 1 — Quick Numerical Progress Header */}
          <JourneyHeader journey={journey} />

          {/* Layer 2 — The Emotional Staircase */}
          <DesktopStaircase journey={journey} />

          {/* Layer 3 — The Strategic Roadmap */}
          <StrategicRoadmap journey={journey} />
        </>
      )}
    </main>
  );
};

export default RoadmapPage;
