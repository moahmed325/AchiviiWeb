import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { formatGoalTitle } from '../lib/formatters';
import { RoutineSettings } from '../types';

export const RoadmapPage: React.FC = () => {
  const { activeGoal } = useGoal();
  const [showFullGoal, setShowFullGoal] = useState(false);

  if (!activeGoal) return null;

  const currentWeekNum = activeGoal.currentWeek || 1;
  const roadmapWeeks = activeGoal.roadmapWeeks || [];

  // Group weeks by Phase
  const phases = useMemo(() => {
    const p1 = roadmapWeeks.filter((w) => w.weekNumber <= 4);
    const p2 = roadmapWeeks.filter((w) => w.weekNumber > 4 && w.weekNumber <= 8);
    const p3 = roadmapWeeks.filter((w) => w.weekNumber > 8);
    return [
      {
        id: 'p1',
        name: 'Phase 1: Foundation',
        weeksLabel: 'Weeks 1–4',
        weeks: p1,
      },
      {
        id: 'p2',
        name: 'Phase 2: Acceleration',
        weeksLabel: 'Weeks 5–8',
        weeks: p2,
      },
      {
        id: 'p3',
        name: 'Phase 3: Mastery',
        weeksLabel: 'Weeks 9–12',
        weeks: p3,
      },
    ];
  }, [roadmapWeeks]);

  // Determine which phase is currently active
  const currentPhaseId = useMemo(() => {
    if (currentWeekNum <= 4) return 'p1';
    if (currentWeekNum <= 8) return 'p2';
    return 'p3';
  }, [currentWeekNum]);

  // Collapsible phases — active phase defaults to open, others collapsed for calm progressive disclosure
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    [currentPhaseId]: true,
    p1: currentPhaseId === 'p1',
    p2: currentPhaseId === 'p2',
    p3: currentPhaseId === 'p3',
  });

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  // 90-day countdown
  const targetDate = new Date(activeGoal.targetDate);
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const dayNumberCurrent = Math.min(90, Math.max(1, 91 - daysRemaining));

  // Parse routine configuration
  const routine: RoutineSettings | null = useMemo(() => {
    if (!activeGoal.routine) return null;
    try {
      return typeof activeGoal.routine === 'string'
        ? JSON.parse(activeGoal.routine)
        : activeGoal.routine;
    } catch {
      return null;
    }
  }, [activeGoal.routine]);

  // Clean, AI-rewritten title for the goal
  const displayGoalTitle = formatGoalTitle(activeGoal.clarifiedOutcome, activeGoal.rawGoal);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fadeIn">
      {/* Top Header / Breadcrumb */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Today</span>
          </Link>

          <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
            <span className="text-[#07CB6C] font-semibold">Day {dayNumberCurrent}</span>
            <span>/</span>
            <span>90</span>
          </div>
        </div>

        {/* Minimal Header */}
        <div className="border-b border-[#1a2824] pb-5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
              Roadmap
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              Week {currentWeekNum} of 12
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {displayGoalTitle}
            </h1>

            {activeGoal.clarifiedOutcome && activeGoal.clarifiedOutcome !== activeGoal.rawGoal && (
              <button
                type="button"
                onClick={() => setShowFullGoal(!showFullGoal)}
                className="inline-flex items-center gap-1 text-xs text-[#07CB6C] hover:text-[#06b560] self-start sm:self-auto cursor-pointer transition-colors"
              >
                <span>{showFullGoal ? 'Hide details' : 'Goal details'}</span>
                {showFullGoal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {showFullGoal && activeGoal.clarifiedOutcome && (
            <div className="mt-2.5 p-3 rounded-md bg-[#080d0b] border border-[#07CB6C]/20 text-xs text-neutral-300 leading-relaxed animate-fadeIn">
              {activeGoal.clarifiedOutcome}
            </div>
          )}
        </div>

        {/* Daily Routine Cadence — Built around user's schedule */}
        {routine && (
          <div className="p-3.5 rounded-md bg-[#080d0b] border border-[#1a2824] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#07CB6C] shrink-0" />
              <div>
                <span className="font-semibold text-white">Built for your daily routine: </span>
                <span className="text-neutral-300">
                  {routine.dailyMinutes}m sessions • {routine.preferredSlot} slot
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400 bg-[#0c1210] px-2.5 py-1 rounded border border-[#1a2824]">
              <span>Wake: {routine.wakeTime}</span>
              <span>•</span>
              <span>Busy: {routine.busyHours}</span>
              <span>•</span>
              <span>Sleep: {routine.sleepTime}</span>
            </div>
          </div>
        )}
      </div>

      {/* Phase List */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const isCurrentPhase = phase.id === currentPhaseId;
          const isPhaseCompleted =
            phase.id === 'p1' ? currentWeekNum > 4 : phase.id === 'p2' ? currentWeekNum > 8 : false;
          const isExpanded = !!expandedPhases[phase.id];

          return (
            <div
              key={phase.id}
              className={`rounded-md border transition-all ${
                isCurrentPhase
                  ? 'border-[#07CB6C]/40 bg-[#080d0b]'
                  : isPhaseCompleted
                  ? 'border-[#1a2824] bg-[#070b09]'
                  : 'border-[#14201c] bg-[#060908]'
              }`}
            >
              {/* Phase Header Accordion */}
              <button
                type="button"
                onClick={() => togglePhase(phase.id)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left cursor-pointer select-none hover:bg-white/[0.02] transition-colors rounded-md focus-visible:outline-none"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs font-mono font-bold ${
                      isCurrentPhase
                        ? 'border-[#07CB6C]/50 bg-[#07CB6C]/15 text-[#07CB6C]'
                        : isPhaseCompleted
                        ? 'border-[#07CB6C]/30 bg-[#07CB6C]/10 text-[#07CB6C]'
                        : 'border-[#1a2824] bg-neutral-900 text-neutral-500'
                    }`}
                  >
                    {phase.id === 'p1' ? '1' : phase.id === 'p2' ? '2' : '3'}
                  </div>

                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-white">
                      {phase.name}
                    </h2>
                    <span className="text-xs text-neutral-500 font-mono">
                      • {phase.weeksLabel}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      isPhaseCompleted
                        ? 'bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30'
                        : isCurrentPhase
                        ? 'bg-[#07CB6C] text-black font-semibold'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {isPhaseCompleted ? 'Done' : isCurrentPhase ? 'Active' : 'Upcoming'}
                  </span>

                  <div className="text-neutral-400">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </button>

              {/* Collapsible Weeks Grid */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-[#1a2824]/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5">
                    {phase.weeks.map((week) => {
                      const isCurrent = week.weekNumber === currentWeekNum;
                      const isCompleted = week.status === 'completed' || week.weekNumber < currentWeekNum;
                      const isGate =
                        week.weekNumber === 4 || week.weekNumber === 8 || week.weekNumber === 12;

                      return (
                        <div
                          key={week.weekNumber}
                          className={`p-3.5 rounded-md border text-xs space-y-2 transition-all ${
                            isCurrent
                              ? 'bg-[#0f1915] border-[#07CB6C]'
                              : isGate
                              ? isCompleted
                                ? 'bg-[#09120f] border-[#f59e0b]/30'
                                : 'bg-[#0a100d] border-[#f59e0b]/20'
                              : isCompleted
                              ? 'bg-[#09120f] border-[#07CB6C]/20'
                              : 'bg-[#080d0b] border-[#1a2824]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-white text-xs">
                                Week {week.weekNumber}
                              </span>
                              {isGate && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
                                  {week.weekNumber === 12 ? 'Capstone' : 'Milestone'}
                                </span>
                              )}
                            </div>

                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                isCurrent
                                  ? 'bg-[#07CB6C] text-black font-semibold'
                                  : isCompleted
                                  ? 'text-[#07CB6C]'
                                  : 'text-neutral-500'
                              }`}
                            >
                              {isCurrent
                                ? 'Active'
                                : isCompleted
                                ? '✓ Done'
                                : 'Upcoming'}
                            </span>
                          </div>

                          <div className="font-semibold text-neutral-100 text-xs sm:text-sm line-clamp-1">
                            {week.theme}
                          </div>

                          <div
                            className={`pt-1 border-t border-white/5 text-[11px] flex items-center gap-1.5 ${
                              isGate ? 'text-[#f59e0b]' : 'text-neutral-400'
                            }`}
                          >
                            <Award
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isGate ? 'text-[#f59e0b]' : 'text-[#07CB6C]'
                              }`}
                            />
                            <span className="line-clamp-1 font-normal text-neutral-300">
                              {week.keyMilestone}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoadmapPage;
