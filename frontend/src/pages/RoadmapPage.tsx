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
  Target,
} from 'lucide-react';
import { formatGoalTitle } from '../lib/formatters';
import { formatTarget } from '../components/PlanV2Panel';
import { RoutineSettings } from '../types';
import { getGoalImage } from '../lib/certifiedPresets';
import BasisBadge from '../components/BasisBadge';

export const RoadmapPage: React.FC = () => {
  const { activeGoal } = useGoal();
  const [showFullGoal, setShowFullGoal] = useState(false);

  if (!activeGoal) return null;

  const currentWeekNum = activeGoal.currentWeek || 1;
  const roadmapWeeks = activeGoal.roadmapWeeks || [];

  const isV2 = activeGoal.planVersion === 2 && Boolean(activeGoal.roadmap);

  // v2 goals use the method's own phases; older goals keep the fixed three.
  const phases = useMemo(() => {
    const ranges = isV2
      ? activeGoal.roadmap!.phases.map((p) => ({ name: p.name, startWeek: p.startWeek, endWeek: p.endWeek, purpose: p.purpose }))
      : [
          { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: '' },
          { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: '' },
          { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: '' },
        ];
    return ranges.map((range, index) => ({
      id: `p${index + 1}`,
      name: `Phase ${index + 1}: ${range.name}`,
      weeksLabel: range.startWeek === range.endWeek ? `Week ${range.startWeek}` : `Weeks ${range.startWeek}–${range.endWeek}`,
      startWeek: range.startWeek,
      endWeek: range.endWeek,
      purpose: range.purpose,
      weeks: roadmapWeeks.filter((w) => w.weekNumber >= range.startWeek && w.weekNumber <= range.endWeek),
    }));
  }, [roadmapWeeks, isV2, activeGoal.roadmap]);

  // Determine which phase is currently active
  const currentPhaseId = useMemo(
    () => phases.find((p) => currentWeekNum >= p.startWeek && currentWeekNum <= p.endWeek)?.id ?? phases[phases.length - 1]?.id,
    [phases, currentWeekNum]
  );

  // Collapsible phases — active phase defaults to open, others collapsed for calm progressive disclosure
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    [currentPhaseId]: true,
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
  const activeGoalImage = getGoalImage(activeGoal.clarifiedOutcome || activeGoal.rawGoal);

  return (
    <main id="main" className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fadeIn">
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

        {/* Minimal Header with Goal Visual */}
        <div className="relative overflow-hidden border border-[#1a2824] rounded-lg p-5 bg-[#0c1210] space-y-3">
          {activeGoalImage && (
            <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full overflow-hidden pointer-events-none opacity-20 blur-2xl">
              <img src={activeGoalImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {activeGoalImage && (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-[#07CB6C]/40 shrink-0 relative shadow-md shadow-black/60 bg-[#050807]">
                  <img
                    src={activeGoalImage}
                    alt={displayGoalTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </div>
              )}

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
                    Roadmap
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    Week {currentWeekNum} of 12
                  </span>
                  <BasisBadge basis={activeGoal.basis} />
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                  {displayGoalTitle}
                </h1>
              </div>
            </div>

            {activeGoal.clarifiedOutcome && activeGoal.clarifiedOutcome !== activeGoal.rawGoal && (
              <button
                type="button"
                onClick={() => setShowFullGoal(!showFullGoal)}
                className="inline-flex items-center gap-1 text-xs text-[#07CB6C] hover:text-[#06b560] self-start sm:self-auto cursor-pointer transition-colors shrink-0"
              >
                <span>{showFullGoal ? 'Hide details' : 'Goal details'}</span>
                {showFullGoal ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {showFullGoal && activeGoal.clarifiedOutcome && (
            <div className="relative z-10 mt-2.5 p-3 rounded-md bg-[#080d0b] border border-[#07CB6C]/20 text-xs text-neutral-300 leading-relaxed animate-fadeIn">
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
          const isPhaseCompleted = currentWeekNum > phase.endWeek;
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

              {phase.purpose && <p className="text-xs text-neutral-400 -mt-2">{phase.purpose}</p>}

              {/* Collapsible Weeks */}
              {isExpanded && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  {phase.weeks.map((week) => {
                    const isCurrent = week.weekNumber === currentWeekNum;
                    const isCompleted = week.status === 'completed' || week.weekNumber < currentWeekNum;
                    const isGate = isV2 ? week.weekNumber === 12 : week.weekNumber === 4 || week.weekNumber === 8 || week.weekNumber === 12;

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
                                {week.weekNumber === 12 ? (isV2 ? 'Final test' : 'Capstone') : 'Milestone Gate'}
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

                          {week.target && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-200">
                              <Target className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                              <span>{formatTarget(week.target)}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            <Award className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                            <span className="line-clamp-1">
                              {week.test ? `Test: ${week.test.instructions}` : week.keyMilestone}
                            </span>
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
    </main>
  );
};

export default RoadmapPage;
