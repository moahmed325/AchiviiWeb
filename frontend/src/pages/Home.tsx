import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Zap,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { formatGoalTitle } from '../lib/formatters';
import { updateDailyTask } from '../lib/api';
import { DailyTask, DetailedStep } from '../types';
import { FocusSessionModal } from '../components/FocusSessionModal';
import { findPathwayByTitle, getGoalImage } from '../lib/certifiedPresets';
import { PathwaysExplorerModal } from '../components/PathwaysExplorerModal';
import { PathwayCustomGoal, PathwayLibrary, PathwayStrip, usePathwayLaunch } from '../components/pathways';
import { Button } from '../components/ui';
import { LandingPage } from '../components/marketing/LandingPage';

export const Home: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, apiStatus, updateActiveGoal } = useGoal();
  const navigate = useNavigate();
  const location = useLocation();

  // Set by the auth screens when a pathway was chosen but the user already has a goal (ND-4)
  const pathwayNotice = (location.state as { pathwayNotice?: string } | null)?.pathwayNotice;
  const dismissPathwayNotice = () => navigate(location.pathname, { replace: true, state: null });

  // Signed-in Dashboard State
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isPathwaysModalOpen, setIsPathwaysModalOpen] = useState(false);
  const [explorePathwayId, setExplorePathwayId] = useState<string | undefined>();
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const { startPathway, startCustomGoal } = usePathwayLaunch();

  const openPathways = (pathwayId?: string) => {
    setExplorePathwayId(pathwayId);
    setIsPathwaysModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // Signed-in Data Derivations
  // --------------------------------------------------------------------------
  const currentWeekNum = activeGoal?.currentWeek || 1;
  const roadmapWeeks = activeGoal?.roadmapWeeks || [];
  const dailyTasks = activeGoal?.dailyTasks || [];

  const currentWeekTasks = useMemo(() => {
    return [...dailyTasks]
      .filter((t) => t.weekNumber === currentWeekNum)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [dailyTasks, currentWeekNum]);

  // Sync selected task to today's task or first pending
  const activeTask = useMemo(() => {
    if (!currentWeekTasks.length) return null;
    if (selectedTaskId) {
      const found = currentWeekTasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTask = currentWeekTasks.find((t) => t.date === todayStr);
    if (todayTask) return todayTask;
    const firstPending = currentWeekTasks.find((t) => t.status === 'pending');
    return firstPending || currentWeekTasks[0];
  }, [currentWeekTasks, selectedTaskId]);

  // Calculate 90-day progress metrics
  const targetDate = activeGoal ? new Date(activeGoal.targetDate) : new Date();
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const dayNumberCurrent = Math.min(90, Math.max(1, 91 - daysRemaining));
  const progressPercent = Math.min(100, Math.max(1, Math.round((dayNumberCurrent / 90) * 100)));

  const currentRoadmapWeek = roadmapWeeks.find((w) => w.weekNumber === currentWeekNum) || roadmapWeeks[0];
  const activeDaysThisWeek = currentWeekTasks.filter((t) => !t.isRestDay);
  const completedDaysThisWeek = activeDaysThisWeek.filter((t) => t.status === 'completed');

  // Toggle Task Completion
  const handleToggleTask = async (task: DailyTask) => {
    if (!token || !activeGoal || isUpdatingTask) return;
    setIsUpdatingTask(true);
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const notes = taskNotes[task.id] !== undefined ? taskNotes[task.id] : task.notes;

    try {
      const updated = await updateDailyTask(task.id, { status: newStatus, notes }, token);
      const updatedTasks = dailyTasks.map((t) => (t.id === task.id ? updated : t));
      updateActiveGoal({ ...activeGoal, dailyTasks: updatedTasks });
    } catch (err) {
      console.error('Failed to toggle task:', err);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // Complete Focus Session
  const handleCompleteFocusSession = async (reflectionNotes?: string) => {
    if (!activeTask || !token || !activeGoal) return;
    try {
      const finalNotes = reflectionNotes?.trim()
        ? activeTask.notes
          ? `${activeTask.notes}\n• Focus win: ${reflectionNotes.trim()}`
          : reflectionNotes.trim()
        : activeTask.notes;

      const updated = await updateDailyTask(activeTask.id, { status: 'completed', notes: finalNotes }, token);
      const updatedTasks = dailyTasks.map((t) => (t.id === activeTask.id ? updated : t));
      updateActiveGoal({ ...activeGoal, dailyTasks: updatedTasks });
    } catch (err) {
      console.error('Failed to complete focus session:', err);
    }
  };

  // Save Session Notes
  const handleSaveNotes = async () => {
    if (!activeTask || !token) return;
    const noteVal = taskNotes[activeTask.id];
    if (noteVal !== undefined && noteVal !== activeTask.notes) {
      try {
        await updateDailyTask(activeTask.id, { notes: noteVal }, token);
        setIsNoteSaved(true);
        setTimeout(() => setIsNoteSaved(false), 2000);
      } catch (err) {
        console.error('Failed to save notes:', err);
      }
    }
  };

  // Parse steps
  const parsedSteps: DetailedStep[] = useMemo(() => {
    if (!activeTask?.detailedSteps) return [];
    try {
      return JSON.parse(activeTask.detailedSteps);
    } catch {
      return [];
    }
  }, [activeTask?.detailedSteps]);

  // Loading State
  if (token && (authLoading || loadingGoal)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-28 space-y-4 animate-fadeIn">
        <div className="w-8 h-8 border-2 border-[#07CB6C]/30 border-t-[#07CB6C] rounded-full animate-spin" />
        <p className="text-xs font-mono text-neutral-400">Loading your space...</p>
      </div>
    );
  }

  // ===========================================================================
  // 1. SIGNED-IN ZEN COMMAND CENTER
  // ===========================================================================
  if (user && token) {
    // No goal yet: the pathway library, with a goal of the user's own as the quieter route (ND-6).
    if (!activeGoal) {
      return (
        <main id="main" className="ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-12 text-left sm:py-16">
          <header className="flex flex-col gap-4">
            <p className="font-ui-mono text-micro uppercase text-accent-hover">Start your journey</p>
            <h1 className="max-w-[20ch] text-h1 text-text">Choose a pathway</h1>
            <p className="max-w-xl text-body-lg text-text-secondary">
              Pick a direction, then a pathway. Each one is a guided 90-day journey, planned around your life.
            </p>
          </header>

          <PathwayLibrary
            className="mt-12"
            action={{ label: 'Start this pathway', onChoose: startPathway }}
            customGoal={
              <PathwayCustomGoal className="mt-16">
                <Button
                  variant="secondary"
                  onClick={startCustomGoal}
                  className="w-full sm:w-auto"
                  trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                >
                  Describe my own goal
                </Button>
              </PathwayCustomGoal>
            }
          />
        </main>
      );
    }

    // User HAS an active goal -> Render the Zen Executive Command Center
    const displayTitle = formatGoalTitle(activeGoal.clarifiedOutcome, activeGoal.rawGoal);
    const activeGoalImage = getGoalImage(activeGoal.rawGoal);

    return (
      <main id="main" className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fadeIn text-left">
        {pathwayNotice && (
          <div role="status" className="flex items-start justify-between gap-3 p-4 rounded-md bg-[#0c1210] border border-[#1a2824]">
            <p className="text-xs leading-relaxed text-neutral-300">
              You already have a journey in progress, so we kept it. You can switch to{' '}
              <span className="font-semibold text-white">{pathwayNotice}</span> from Explore Goals whenever you're ready.
            </p>
            <button
              type="button"
              onClick={dismissPathwayNotice}
              aria-label="Dismiss"
              className="-my-3 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:text-white transition-colors cursor-pointer"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* TOP STATUS & 90-DAY PROGRESS (WITH PROMINENT GOAL IMAGE) */}
        {/* =================================================================== */}
        <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-4 relative overflow-hidden">
          {/* Subtle Ambient Goal Image Backdrop */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none overflow-hidden opacity-25 hidden md:block">
            <img
              src={activeGoalImage}
              alt="Active Goal Backdrop"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0c1210] via-[#0c1210]/70 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {/* Active Goal Visual Image Badge */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-[#07CB6C]/40 shrink-0 relative shadow-md shadow-black/60 bg-[#050807]">
                <img
                  src={activeGoalImage}
                  alt={displayTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                    <span>Day {dayNumberCurrent} of 90</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#111a17] border border-[#1a2824] text-neutral-300 font-medium text-xs">
                    {currentRoadmapWeek?.phase || 'Foundation'} · Week {currentWeekNum}
                  </span>
                  <span className="text-neutral-500 font-mono text-xs hidden sm:inline">
                    {progressPercent}% Complete
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                  {displayTitle}
                </h1>
              </div>
            </div>

            {/* Quick Actions: Explore Goals (10) & View Full 90-Day Roadmap */}
            <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => openPathways()}
                className="px-3.5 py-2 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-semibold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Explore Goals (10)</span>
              </button>
              <Link
                to="/roadmap"
                className="px-3.5 py-2 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-semibold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Full Roadmap</span>
                <ArrowRight className="w-3 h-3 text-neutral-400" />
              </Link>
            </div>
          </div>

          {/* Minimalist Progress Track */}
          <div className="space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-[#111a17] overflow-hidden">
              <div
                className="h-full bg-[#07CB6C] transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
              <span>Day 1 (Kickoff)</span>
              <span>{daysRemaining} days remaining</span>
              <span>Day 90 (Mastery)</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* TODAY'S PRIMARY DIRECTIVE (THE SINGLE THING THAT MATTERS TODAY) */}
        {/* =================================================================== */}
        {activeTask && (
          <div className="p-5 sm:p-6 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-5">
            <div className="flex items-center justify-between text-xs border-b border-[#1a2824] pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span className="font-semibold text-white uppercase tracking-wider text-[11px] font-mono">
                  Today's Session Directive
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-neutral-400">
                  {activeTask.dayOfWeek} · {activeTask.durationMinutes || 30} min
                </span>
                {activeTask.status === 'completed' && (
                  <span className="px-2 py-0.5 rounded bg-[#07CB6C]/15 border border-[#07CB6C]/30 text-[#07CB6C] text-[10px] font-mono font-bold">
                    DONE
                  </span>
                )}
              </div>
            </div>

            {/* Task Headline */}
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                {activeTask.title}
              </h2>
              {activeTask.slotTime && (
                <p className="text-xs text-neutral-400 font-mono">
                  Target Slot: {activeTask.slotTime}
                </p>
              )}
            </div>

            {/* Two Primary Action Buttons: Start Focus Session & Mark Complete */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsFocusModalOpen(true)}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-md font-semibold text-sm bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/60 text-white transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <Zap className="w-4 h-4 text-[#07CB6C] group-hover:scale-110 transition-transform" />
                <span>Start Focus Session ({activeTask.durationMinutes || 30}m)</span>
              </button>

              <button
                type="button"
                disabled={isUpdatingTask}
                onClick={() => handleToggleTask(activeTask)}
                className={`min-h-[44px] px-6 py-2.5 rounded-md font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  activeTask.status === 'completed'
                    ? 'bg-[#07CB6C]/20 border border-[#07CB6C] text-[#07CB6C] hover:bg-[#07CB6C]/30'
                    : 'bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.98] text-black font-bold'
                }`}
              >
                {activeTask.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#07CB6C]" />
                    <span>Completed ✓</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4" />
                    <span>Mark Complete</span>
                  </>
                )}
              </button>
            </div>

            {/* Progressive Disclosure: View Steps & Guidance (Collapsed by default) */}
            {parsedSteps.length > 0 && (
              <div className="pt-2 border-t border-[#1a2824]/60">
                <button
                  type="button"
                  onClick={() => setShowSteps(!showSteps)}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white cursor-pointer transition-colors"
                >
                  <span>{showSteps ? 'Hide steps & guidance' : `View ${parsedSteps.length} steps & drill cues`}</span>
                  {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showSteps && (
                  <div className="mt-3 space-y-2.5 animate-fadeIn">
                    {parsedSteps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md bg-[#080d0b] border border-[#1a2824] text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-neutral-300 font-semibold">
                          <span>
                            {step.stepNumber}. {step.title}
                          </span>
                          <span className="font-mono text-neutral-500 text-[11px]">
                            {step.durationMinutes}m
                          </span>
                        </div>
                        {step.instructions && (
                          <p className="text-neutral-400 leading-relaxed text-[11px]">
                            {step.instructions}
                          </p>
                        )}
                        {step.focusCue && (
                          <div className="text-[11px] text-[#07CB6C] font-mono">
                            Focus: {step.focusCue}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =================================================================== */}
        {/* QUICK ACCESS HUB: 7-DAY SCHEDULE STRIP & QUICK ACTIONS */}
        {/* =================================================================== */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs px-1">
            <div className="flex items-center gap-2 text-neutral-400">
              <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span className="font-semibold text-white">This Week's Schedule</span>
              <span className="text-neutral-500 font-mono">
                ({completedDaysThisWeek.length}/7 completed)
              </span>
            </div>
            <Link
              to="/dashboard"
              className="text-xs text-[#07CB6C] hover:text-[#06b560] font-medium"
            >
              Open Full Day View →
            </Link>
          </div>

          {/* 7-Day Pill Bar */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 p-1.5 rounded-md bg-[#080d0b] border border-[#1a2824]">
            {currentWeekTasks.map((t) => {
              const isSelected = activeTask?.id === t.id;
              const isDone = t.status === 'completed';
              const isRest = t.isRestDay;
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = t.date === todayStr;

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`py-2 px-1 sm:px-2 rounded-md border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'bg-[#0f1f18] border-[#07CB6C] text-[#07CB6C]'
                      : isDone
                      ? 'bg-[#0a1410] border-[#07CB6C]/30 text-neutral-300 hover:border-[#07CB6C]/60'
                      : isToday
                      ? 'bg-[#0d1713] border-neutral-600 text-white hover:border-neutral-500'
                      : 'bg-[#090e0c] border-transparent text-neutral-400 hover:bg-[#0e1612] hover:text-neutral-200'
                  }`}
                >
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      isSelected ? 'text-[#07CB6C] font-bold' : isToday ? 'text-white' : 'text-neutral-500'
                    }`}
                  >
                    {t.dayOfWeek.slice(0, 3)}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-mono font-bold ${
                      isSelected ? 'text-[#07CB6C]' : isToday ? 'text-white' : isDone ? 'text-neutral-300' : 'text-neutral-400'
                    }`}
                  >
                    {t.date.slice(8)}
                  </span>
                  <div className="flex items-center justify-center h-2">
                    {isDone ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                    ) : isToday ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white ring-2 ring-[#07CB6C]/40 animate-pulse" />
                    ) : isRest ? (
                      <span className="text-[9px] font-mono text-neutral-600">zZ</span>
                    ) : (
                      <span className="w-1 h-1 rounded-full bg-neutral-700" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* QUICK SESSION NOTES (COLLAPSIBLE, ZERO CLUTTER) */}
        {/* =================================================================== */}
        {activeTask && (
          <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Session Notes & Logs</span>
                {showNotes ? <ChevronUp className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />}
              </button>
              {isNoteSaved && (
                <span className="text-[11px] text-[#07CB6C] font-mono">Saved ✓</span>
              )}
            </div>

            {showNotes && (
              <div className="pt-2 space-y-2 animate-fadeIn">
                <textarea
                  rows={3}
                  value={
                    taskNotes[activeTask.id] !== undefined
                      ? taskNotes[activeTask.id]
                      : activeTask.notes || ''
                  }
                  onChange={(e) =>
                    setTaskNotes((prev) => ({ ...prev, [activeTask.id]: e.target.value }))
                  }
                  onBlur={handleSaveNotes}
                  placeholder="Record reps, speed, reflections, or breakthroughs for this session..."
                  className="w-full p-3 rounded-md bg-[#080d0b] border border-[#1a2824] text-xs text-white placeholder-neutral-500 focus:border-[#07CB6C] focus:outline-none resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="px-3 py-1.5 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs text-neutral-200 cursor-pointer"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <PathwayStrip
          currentId={findPathwayByTitle(activeGoal.rawGoal)?.id}
          onOpen={(pathway) => openPathways(pathway.id)}
          onExploreAll={() => openPathways()}
        />

        {/* Focus Timer Modal */}
        {activeTask && (
          <FocusSessionModal
            task={activeTask}
            dayNumber={activeTask.dayNumber}
            isOpen={isFocusModalOpen}
            onClose={() => setIsFocusModalOpen(false)}
            onCompleteSession={handleCompleteFocusSession}
          />
        )}

        {/* Pathways Explorer Modal */}
        <PathwaysExplorerModal
          isOpen={isPathwaysModalOpen}
          onClose={() => setIsPathwaysModalOpen(false)}
          activeGoalTitle={activeGoal?.rawGoal}
          initialPathwayId={explorePathwayId}
        />
      </main>
    );
  }

  // ===========================================================================
  // 2. SIGNED-OUT MARKETING LANDING
  // ===========================================================================
  return (
    <LandingPage apiOffline={apiStatus === 'offline'} />
  );
};

export default Home;