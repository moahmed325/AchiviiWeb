import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import {
  ArrowLeft,
  Award,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
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
        <div className="border-b border-[#1a2824] pb-4 space-y-2">
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

          {/* Daily Routine Cadence — Quiet inline subtitle */}
          {routine && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400 pt-1">
              <span className="inline-flex items-center gap-1 text-[#07CB6C] font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>{routine.dailyMinutes}m daily sessions</span>
              </span>
              <span className="text-neutral-600">•</span>
              <span>{routine.preferredSlot} slot</span>
              <span className="text-neutral-600">•</span>
              <span className="font-mono text-[11px] text-neutral-500">
                Wake {routine.wakeTime} · Busy {routine.busyHours} · Sleep {routine.sleepTime}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 90-Day Vertical Trajectory Stream */}
      <div className="border-l border-[#1a2824] ml-3 sm:ml-4 pl-4 sm:pl-7 space-y-8 relative pt-2">
        {phases.map((phase) => {
          const isCurrentPhase = phase.id === currentPhaseId;
          const isPhaseCompleted =
            phase.id === 'p1' ? currentWeekNum > 4 : phase.id === 'p2' ? currentWeekNum > 8 : false;
          const isExpanded = !!expandedPhases[phase.id];

          return (
            <div key={phase.id} className="relative space-y-4">
              {/* Node Marker on Hairline */}
              <span
                className={`absolute -left-[21px] sm:-left-[33px] top-1.5 w-3 h-3 rounded-full border-2 border-[#050807] transition-all ${
                  isCurrentPhase
                    ? 'bg-[#07CB6C] ring-4 ring-[#07CB6C]/25'
                    : isPhaseCompleted
                    ? 'bg-[#07CB6C]'
                    : 'bg-neutral-800'
                }`}
              />

              {/* Phase Header Bar */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => togglePhase(phase.id)}
                  className="flex items-center gap-2.5 text-left cursor-pointer group focus-visible:outline-none"
                >
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight group-hover:text-[#07CB6C] transition-colors">
                    {phase.name}
                  </h2>
                  <span className="text-xs text-neutral-500 font-mono">
                    ({phase.weeksLabel})
                  </span>
                  <span className="text-neutral-500 group-hover:text-white transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </button>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                    isPhaseCompleted
                      ? 'text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/25'
                      : isCurrentPhase
                      ? 'bg-[#07CB6C] text-black font-semibold'
                      : 'text-neutral-500 bg-[#0c1210] border border-[#1a2824]'
                  }`}
                >
                  {isPhaseCompleted ? 'Completed' : isCurrentPhase ? 'In Progress' : 'Upcoming'}
                </span>
              </div>

              {/* Collapsible Weeks */}
              {isExpanded && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  {phase.weeks.map((week) => {
                    const isCurrent = week.weekNumber === currentWeekNum;
                    const isCompleted = week.status === 'completed' || week.weekNumber < currentWeekNum;
                    const isGate = week.weekNumber === 4 || week.weekNumber === 8 || week.weekNumber === 12;

                    return (
                      <div
                        key={week.weekNumber}
                        className={`p-3.5 rounded-md border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-[#0c1612] border-[#07CB6C]/50 ring-1 ring-[#07CB6C]/20'
                            : isCompleted
                            ? 'bg-[#080e0c] border-[#1a2824] hover:border-[#1a2824]/80'
                            : 'bg-[#070b09] border-[#15201c] hover:border-neutral-800'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-xs font-bold ${isCurrent ? 'text-[#07CB6C]' : 'text-neutral-300'}`}>
                              Week {week.weekNumber}
                            </span>
                            {isGate && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium uppercase tracking-wider bg-amber-400/10 text-amber-400/90 border border-amber-400/20">
                                {week.weekNumber === 12 ? 'Capstone' : 'Milestone Gate'}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#07CB6C] text-black">
                                ACTIVE
                              </span>
                            )}
                          </div>

                          <h3 className="text-sm font-semibold text-white">
                            {week.theme}
                          </h3>

                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Award className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                            <span className="line-clamp-1">{week.keyMilestone}</span>
                          </div>
                        </div>

                        <div className="self-end sm:self-center shrink-0">
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-[#07CB6C]">
                              <Check className="w-3.5 h-3.5" />
                              <span>Done</span>
                            </span>
                          ) : isCurrent ? (
                            <span className="text-xs font-mono font-medium text-[#07CB6C]">
                              Current Focus
                            </span>
                          ) : (
                            <span className="text-xs font-mono text-neutral-600">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
