import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Award,
  AlertTriangle,
  Flame,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
  Save,
  ExternalLink,
  Compass,
  PlayCircle,
  BookOpen,
  GraduationCap,
  Terminal,
  Zap,
  Sparkles,
  Users,
  ShieldCheck,
  PackageCheck,
  Hourglass,
} from 'lucide-react';
import { Goal, DailyTask, DetailedStep, RoutineSettings, TaskLayerType } from '../types';
import { updateDailyTask, submitWeeklyReview, fetchActiveGoal } from '../lib/api';
import { formatGoalTitle } from '../lib/formatters';
import { FullDayVisualizer } from './FullDayVisualizer';
import { FocusSessionModal } from './FocusSessionModal';
import { StepChallengeWidget } from './StepChallengeWidget';
import { findPathwayByTitle, getGoalImage } from '../lib/certifiedPresets';
import { PathwaysExplorerModal } from './PathwaysExplorerModal';
import { PathwayStrip } from './pathways';
import BasisBadge from './BasisBadge';
import { PlanV2Panel } from './PlanV2Panel';

interface EvidenceLayerConfig {
  label: string;
  badgeClass: string;
  icon: React.ReactNode;
  disclaimer: string;
}

function getEvidenceLayerConfig(layer?: TaskLayerType): EvidenceLayerConfig | null {
  if (!layer) return null;
  switch (layer) {
    case 'mechanism':
      return {
        label: 'Science-backed',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        icon: <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />,
        disclaimer: 'Based on controlled scientific research (e.g. deliberate practice, spaced retrieval, cognitive load theory).'
      };
    case 'adherence':
      return {
        label: 'Proven in practice',
        badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
        icon: <Users className="w-3 h-3 text-purple-400 shrink-0" />,
        disclaimer: 'Based on commonly reported real-world success patterns and habit stacking, not verified laboratory outcome data.'
      };
    case 'safety':
      return {
        label: 'Expert guidance',
        badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
        icon: <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />,
        disclaimer: 'Based on professional practitioner sequencing to prevent injury, burnout, or mechanical strain.'
      };
    default:
      return null;
  }
}

interface StepResourceConfig {
  badgeLabel: string;
  badgeClass: string;
  icon: React.ReactNode;
  actionLabel: string;
  buttonClass: string;
  containerClass: string;
}

function getStepResourceConfig(type?: string): StepResourceConfig {
  const baseButton = 'bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-neutral-200 hover:text-white';
  const baseContainer = 'bg-[#080d0b] border border-[#1a2824] hover:border-[#1a2824]/80';
  const baseBadge = 'bg-[#111a17] text-neutral-400 border border-[#1a2824]';

  switch (type) {
    case 'youtube_video':
    case 'video':
      return {
        badgeLabel: 'Video',
        badgeClass: baseBadge,
        icon: <PlayCircle className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />,
        actionLabel: 'Watch',
        buttonClass: baseButton,
        containerClass: baseContainer
      };
    case 'documentation':
      return {
        badgeLabel: 'Docs',
        badgeClass: baseBadge,
        icon: <BookOpen className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />,
        actionLabel: 'Read',
        buttonClass: baseButton,
        containerClass: baseContainer
      };
    case 'scientific_study':
      return {
        badgeLabel: 'Study',
        badgeClass: baseBadge,
        icon: <GraduationCap className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />,
        actionLabel: 'Read',
        buttonClass: baseButton,
        containerClass: baseContainer
      };
    case 'interactive_tool':
      return {
        badgeLabel: 'Tool',
        badgeClass: baseBadge,
        icon: <Terminal className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />,
        actionLabel: 'Open',
        buttonClass: baseButton,
        containerClass: baseContainer
      };
    case 'guide':
    default:
      return {
        badgeLabel: 'Guide',
        badgeClass: baseBadge,
        icon: <Compass className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />,
        actionLabel: 'Open',
        buttonClass: baseButton,
        containerClass: baseContainer
      };
  }
}

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://www.youtube-nocookie.com/embed/${match[2]}` : null;
}

interface ExecutionDashboardProps {
  goal: Goal;
  token: string;
  onGoalUpdated: (goal: Goal) => void;
  onResetGoal?: () => void;
}

export const ExecutionDashboard: React.FC<ExecutionDashboardProps> = ({
  goal,
  token,
  onGoalUpdated,
  onResetGoal: _onResetGoal
}) => {
  const currentWeekNum = goal.currentWeek || 1;
  const roadmapWeeks = goal.roadmapWeeks || [];
  const dailyTasks = goal.dailyTasks || [];

  // Filter tasks for the current week, sorted by day number
  const currentWeekTasks = useMemo(() => {
    return [...dailyTasks]
      .filter((t) => t.weekNumber === currentWeekNum)
      .sort((a, b) => a.dayNumber - b.dayNumber);
  }, [dailyTasks, currentWeekNum]);

  // Selected day for deep-dive (default to today's task, first pending task, or day 1)
  const [selectedTaskId, setSelectedTaskId] = useState<string>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTask = currentWeekTasks.find((t) => t.date === todayStr);
    if (todayTask) return todayTask.id;
    const firstPending = currentWeekTasks.find((t) => t.status === 'pending');
    return firstPending?.id || currentWeekTasks[0]?.id || '';
  });

  // UI Toggles
  const [showFullOutcome, setShowFullOutcome] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [isNoteSaved, setIsNoteSaved] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewReflection, setReviewReflection] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [activeVideoStep, setActiveVideoStep] = useState<string | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isPathwaysModalOpen, setIsPathwaysModalOpen] = useState(false);
  const [explorePathwayId, setExplorePathwayId] = useState<string | undefined>();
  const openPathways = (pathwayId?: string) => {
    setExplorePathwayId(pathwayId);
    setIsPathwaysModalOpen(true);
  };
  const [milestoneGateModal, setMilestoneGateModal] = useState<{
    completedPhase: string;
    nextPhase: string;
    title: string;
    benchmarkMet: boolean;
  } | null>(null);

  // Auto-hydration: if dailyTasks or roadmapWeeks are missing, fetch fresh data
  useEffect(() => {
    if ((!goal.dailyTasks || goal.dailyTasks.length === 0 || !goal.roadmapWeeks || goal.roadmapWeeks.length === 0) && token) {
      fetchActiveGoal(token)
        .then((freshGoal) => {
          if (freshGoal && freshGoal.dailyTasks && freshGoal.dailyTasks.length > 0) {
            onGoalUpdated(freshGoal);
          }
        })
        .catch(console.error);
    }
  }, [goal.dailyTasks, goal.roadmapWeeks, token, onGoalUpdated]);

  // Keep selectedTaskId in sync whenever currentWeekTasks loads or updates
  useEffect(() => {
    if (currentWeekTasks.length > 0 && (!selectedTaskId || !currentWeekTasks.some((t) => t.id === selectedTaskId))) {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTask = currentWeekTasks.find((t) => t.date === todayStr);
      const firstPending = currentWeekTasks.find((t) => t.status === 'pending');
      setSelectedTaskId(todayTask?.id || firstPending?.id || currentWeekTasks[0].id);
    }
  }, [currentWeekTasks, selectedTaskId]);

  const selectedTask = currentWeekTasks.find((t) => t.id === selectedTaskId) || currentWeekTasks[0];

  // Calculate 90-day countdown
  const targetDate = new Date(goal.targetDate);
  const today = new Date();
  const diffTime = targetDate.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const dayNumberCurrent = Math.min(90, Math.max(1, 91 - daysRemaining));

  // Current Roadmap Week data
  const currentRoadmapWeek = roadmapWeeks.find((w) => w.weekNumber === currentWeekNum) || roadmapWeeks[0];
  const isV2 = goal.planVersion === 2;

  // Execution score for current week
  const activeDaysThisWeek = currentWeekTasks.filter((t) => !t.isRestDay);
  const completedDaysThisWeek = activeDaysThisWeek.filter((t) => t.status === 'completed');
  const weekScorePercent = activeDaysThisWeek.length > 0
    ? Math.round((completedDaysThisWeek.length / activeDaysThisWeek.length) * 100)
    : 0;

  // --------------------------------------------------------------------------
  // Toggle Task Completion
  // --------------------------------------------------------------------------
  const handleToggleTask = async (task: DailyTask) => {
    if (isUpdatingTask) return;
    setIsUpdatingTask(true);

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const notes = taskNotes[task.id] !== undefined ? taskNotes[task.id] : task.notes;

    try {
      const updated = await updateDailyTask(task.id, { status: newStatus, notes }, token);
      const updatedTasks = dailyTasks.map((t) => (t.id === task.id ? updated : t));
      onGoalUpdated({ ...goal, dailyTasks: updatedTasks });
    } catch (err) {
      console.error('Failed to toggle task:', err);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // User's configured daily routine
  const userRoutine: RoutineSettings | null = useMemo(() => {
    if (!goal.routine) return null;
    try {
      return typeof goal.routine === 'string' ? JSON.parse(goal.routine) : goal.routine;
    } catch {
      return null;
    }
  }, [goal.routine]);

  // --------------------------------------------------------------------------
  // Save Session Notes
  // --------------------------------------------------------------------------
  const handleSaveNotes = async () => {
    if (!selectedTask) return;
    const noteVal = taskNotes[selectedTask.id];
    if (noteVal !== undefined && noteVal !== selectedTask.notes) {
      try {
        await updateDailyTask(selectedTask.id, { notes: noteVal }, token);
        setIsNoteSaved(true);
        setTimeout(() => setIsNoteSaved(false), 2000);
      } catch (err) {
        console.error('Failed to save notes:', err);
      }
    }
  };

  // --------------------------------------------------------------------------
  // Complete Focus Session
  // --------------------------------------------------------------------------
  const handleCompleteFocusSession = async (reflectionNotes?: string) => {
    if (!selectedTask) return;
    try {
      const finalNotes = reflectionNotes?.trim()
        ? selectedTask.notes
          ? `${selectedTask.notes}\n• Focus win: ${reflectionNotes.trim()}`
          : reflectionNotes.trim()
        : selectedTask.notes;

      const updated = await updateDailyTask(
        selectedTask.id,
        { status: 'completed', notes: finalNotes },
        token
      );
      const updatedTasks = dailyTasks.map((t) => (t.id === selectedTask.id ? updated : t));
      onGoalUpdated({ ...goal, dailyTasks: updatedTasks });
    } catch (err) {
      console.error('Failed to complete focus session:', err);
      throw err;
    }
  };

  // --------------------------------------------------------------------------
  // Submit Weekly Review
  // --------------------------------------------------------------------------
  const handleSubmitReview = async () => {
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      const response = await submitWeeklyReview(currentWeekNum, reviewReflection, token);

      const updatedRoadmap = roadmapWeeks.map((w) => {
        if (w.weekNumber === currentWeekNum) {
          return { ...w, status: 'completed' as const, executionScore: response.scorePercentage };
        }
        if (response.nextWeekNumber && w.weekNumber === response.nextWeekNumber) {
          return { ...w, status: 'active' as const };
        }
        return w;
      });

      const updatedTasks = [
        ...dailyTasks.filter((t) => t.weekNumber !== response.nextWeekNumber),
        ...(response.nextWeekTasks || [])
      ];

      onGoalUpdated({
        ...goal,
        currentWeek: response.nextWeekNumber || currentWeekNum,
        roadmapWeeks: updatedRoadmap,
        dailyTasks: updatedTasks
      });

      if ((response as any).isMilestoneCheckpoint && (response as any).milestoneGateTransition) {
        setMilestoneGateModal((response as any).milestoneGateTransition);
      }

      setShowReviewModal(false);
      setReviewReflection('');
    } catch (err) {
      console.error('Review failed:', err);
      setReviewError(err instanceof Error ? err.message : 'Could not submit the review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };



  // Parse steps from detailedSteps JSON
  const parsedSteps: DetailedStep[] = useMemo(() => {
    if (!selectedTask?.detailedSteps) return [];
    try {
      return JSON.parse(selectedTask.detailedSteps);
    } catch {
      return [];
    }
  }, [selectedTask?.detailedSteps]);

  // Parse implementation intention parts
  const parsedIntention = useMemo(() => {
    if (!selectedTask?.implementationIntention) return null;
    const str = selectedTask.implementationIntention;
    const parts = str.split('|').map((p) => p.trim());
    let when = '';
    let where = '';
    let action = '';

    parts.forEach((part) => {
      if (part.toLowerCase().startsWith('when:')) {
        when = part.replace(/^when:\s*/i, '');
      } else if (part.toLowerCase().startsWith('where:')) {
        where = part.replace(/^where:\s*/i, '');
      } else if (part.toLowerCase().startsWith('action:')) {
        action = part.replace(/^action:\s*/i, '');
      }
    });

    if (!when && !where && !action) {
      return { raw: str };
    }
    return { when, where, action };
  }, [selectedTask?.implementationIntention]);

  const activeGoalImage = getGoalImage(goal.clarifiedOutcome || goal.rawGoal);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-5 text-left animate-fadeInUp">
      {/* ===================================================================== */}
      {/* 1. COMPACT HEADER */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-4">
        {/* Ambient goal background glow */}
        {activeGoalImage && (
          <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full overflow-hidden pointer-events-none opacity-20 blur-2xl">
            <img src={activeGoalImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl min-w-0">
            {/* Visual Goal Badge */}
            {activeGoalImage && (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-[#07CB6C]/40 shrink-0 relative shadow-md shadow-black/60 bg-[#050807] mt-0.5">
                <img
                  src={activeGoalImage}
                  alt={formatGoalTitle(goal.clarifiedOutcome, goal.rawGoal)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Minimal meta badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                  <span>Day {dayNumberCurrent} of 90</span>
                </div>

                <span className="px-2.5 py-0.5 rounded-md bg-[#111a17] border border-[#1a2824] text-neutral-300 font-medium text-xs">
                  {currentRoadmapWeek?.phase || 'Foundation'} · Week {currentWeekNum}
                </span>
                <BasisBadge basis={goal.basis} />
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                {formatGoalTitle(goal.clarifiedOutcome, goal.rawGoal)}
              </h1>

              {/* Progressive Disclosure: Toggle full goal details */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowFullOutcome(!showFullOutcome)}
                  className="inline-flex items-center gap-1 text-xs text-[#07CB6C] hover:text-[#06b560] cursor-pointer transition-colors"
                >
                  <span>{showFullOutcome ? 'Hide details' : 'View full goal'}</span>
                  {showFullOutcome ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showFullOutcome && (
                  <div className="mt-2.5 p-3.5 rounded-md bg-[#080d0b] border border-[#07CB6C]/25 text-xs space-y-2 animate-fadeIn">
                    <p className="text-neutral-200 leading-relaxed">
                      <strong className="text-white font-semibold">Target:</strong> {goal.clarifiedOutcome}
                    </p>
                    {goal.methodologyNotes && (
                      <p className="text-[11px] text-neutral-400">
                        {goal.methodologyNotes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              type="button"
              onClick={() => openPathways()}
              className="px-3.5 py-2 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-semibold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Explore Goals (10)</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="px-3.5 py-2 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-semibold text-neutral-200 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Week Review</span>
            </button>
          </div>
        </div>
      </div>

      {isV2 && goal.roadmap && (
        <PlanV2Panel roadmap={goal.roadmap} weeks={roadmapWeeks} currentWeek={currentWeekNum} weekTasks={currentWeekTasks} />
      )}

      {/* ===================================================================== */}
      {/* 2. 7-DAY SCHEDULE STRIP (Sleek Zen Pill Bar) */}
      {/* ===================================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5 text-xs">
          <div className="flex items-center gap-2 text-neutral-400">
            <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span className="font-semibold text-white">
              Week {currentWeekNum}: {currentRoadmapWeek?.theme || 'Active Focus'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-500">
            {currentWeekTasks.filter((t) => t.status === 'completed').length}/7 days completed
          </span>
        </div>

        {/* 7-Day Pill Bar */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 p-1.5 rounded-lg bg-[#080d0b] border border-[#1a2824]">
          {currentWeekTasks.map((t) => {
            const isSelected = selectedTask?.id === t.id;
            const isDone = t.status === 'completed';
            const isRest = t.isRestDay;
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = t.date === todayStr;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTaskId(t.id)}
                className={`py-2 px-1 sm:px-2.5 rounded-md border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-[#0f1f18] border-[#07CB6C] text-[#07CB6C] shadow-sm'
                    : isDone
                    ? 'bg-[#0a1410] border-[#07CB6C]/30 text-neutral-300 hover:border-[#07CB6C]/60'
                    : isToday
                    ? 'bg-[#0d1713] border-neutral-600 text-white hover:border-neutral-500'
                    : 'bg-[#090e0c] border-transparent text-neutral-400 hover:bg-[#0e1612] hover:text-neutral-200'
                }`}
              >
                {/* Day name & date number */}
                <div className="flex flex-col items-center leading-none gap-0.5">
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      isSelected
                        ? 'text-[#07CB6C] font-bold'
                        : isToday
                        ? 'text-white font-semibold'
                        : 'text-neutral-500'
                    }`}
                  >
                    {t.dayOfWeek.slice(0, 3)}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-mono font-bold ${
                      isSelected
                        ? 'text-[#07CB6C]'
                        : isToday
                        ? 'text-white'
                        : isDone
                        ? 'text-neutral-200'
                        : 'text-neutral-400'
                    }`}
                  >
                    {t.date.slice(8)}
                  </span>
                </div>

                {(t.isTestDay || t.isKeySession) && (
                  <span
                    className={`text-[8px] font-mono font-bold uppercase tracking-wider leading-none ${
                      t.isTestDay ? 'text-amber-400' : 'text-[#07CB6C]'
                    }`}
                  >
                    {t.isTestDay ? 'Test' : 'Key'}
                  </span>
                )}

                {/* Status Dot */}
                <div className="flex items-center justify-center h-2">
                  {isDone ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" title="Completed" />
                  ) : isToday ? (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-white ring-2 ring-[#07CB6C]/40 animate-pulse"
                      title="Today"
                    />
                  ) : isRest ? (
                    <span className="text-[9px] font-mono text-neutral-600 font-medium">zZ</span>
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-neutral-700" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. TODAY'S SESSION — FULL DAY VISUALIZER */}
      {/* ===================================================================== */}
      {selectedTask ? (
        <FullDayVisualizer
          routine={userRoutine}
          task={selectedTask}
          isExpanded={isTaskExpanded}
          onToggleExpand={() => setIsTaskExpanded(!isTaskExpanded)}
          onStartFocusSession={() => setIsFocusModalOpen(true)}
        >
          {/* Action Header when expanded */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1a2824] pb-5">
            <div className="space-y-1">
              {(selectedTask.isTestDay || selectedTask.isKeySession) && (
                <span
                  className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                    selectedTask.isTestDay
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                  }`}
                >
                  {selectedTask.isTestDay ? 'Test day' : 'Key session'}
                </span>
              )}
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {selectedTask.title}
              </h3>
              <p className="text-xs text-neutral-400">
                {selectedTask.whyToday || 'Follow the deliberate practice steps below or enter distraction-free focus mode.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {/* Focus Mode Button */}
              <button
                type="button"
                onClick={() => setIsFocusModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-semibold text-xs bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/50 text-neutral-200 hover:text-white transition-all cursor-pointer shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-[#07CB6C] fill-[#07CB6C]" />
                <span>Focus Mode ({selectedTask.durationMinutes || 30}m)</span>
              </button>

              {/* Complete Toggle */}
              <button
                type="button"
                disabled={isUpdatingTask}
                onClick={() => handleToggleTask(selectedTask)}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  selectedTask.status === 'completed'
                    ? 'bg-[#07CB6C]/20 border border-[#07CB6C] text-[#07CB6C] hover:bg-[#07CB6C]/30'
                    : 'bg-[#07CB6C] hover:bg-[#06b560] text-black hover:scale-[1.02]'
                }`}
              >
                {selectedTask.status === 'completed' ? (
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
          </div>

          {/* Session Plan (When/Where/Action) */}
          {parsedIntention && !isV2 && (
            <div className="space-y-2 text-xs">
              {'raw' in parsedIntention ? (
                <p className="text-neutral-200 p-3 rounded-md bg-[#080d0b] border border-[#1a2824]">{parsedIntention.raw}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {parsedIntention.where && (
                    <div className="p-2.5 rounded-md bg-[#080d0b] border border-[#1a2824] flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase block">Where</span>
                        <span className="text-neutral-200 font-medium">{parsedIntention.where}</span>
                      </div>
                    </div>
                  )}

                  {parsedIntention.when && (
                    <div className="p-2.5 rounded-md bg-[#080d0b] border border-[#1a2824] flex items-start gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase block">When</span>
                        <span className="text-neutral-200 font-medium">{parsedIntention.when}</span>
                      </div>
                    </div>
                  )}

                  {parsedIntention.action && (
                    <div className="p-2.5 rounded-md bg-[#080d0b] border border-[#1a2824] flex items-start gap-2">
                      <Target className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase block">Focus</span>
                        <span className="text-neutral-200 font-medium">{parsedIntention.action}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recommended Resource */}
          {selectedTask.resourceTitle && (() => {
            const dailyConfig = getStepResourceConfig(selectedTask.resourceType);
            const dailyYtEmbed = selectedTask.resourceUrl ? getYouTubeEmbedUrl(selectedTask.resourceUrl) : null;
            const isDailyVideoOpen = activeVideoStep === `daily_${selectedTask.id}`;

            return (
              <div className={`p-4 rounded-md border ${dailyConfig.containerClass} space-y-2.5`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <a
                      href={selectedTask.resourceUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-white hover:underline transition-colors inline-flex items-center gap-1.5 group cursor-pointer"
                    >
                      {dailyConfig.icon}
                      <span>{selectedTask.resourceTitle}</span>
                      <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-white shrink-0" />
                    </a>
                    {selectedTask.resourceWhy && (
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        {selectedTask.resourceWhy}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {dailyYtEmbed && (
                      <button
                        type="button"
                        onClick={() => setActiveVideoStep(isDailyVideoOpen ? null : `daily_${selectedTask.id}`)}
                        className="px-3 py-1.5 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-xs font-semibold text-neutral-200 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlayCircle className="w-3.5 h-3.5 text-[#07CB6C]" />
                        <span>{isDailyVideoOpen ? 'Close' : 'Watch'}</span>
                      </button>
                    )}
                    {selectedTask.resourceUrl && (
                      <a
                        href={selectedTask.resourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${dailyConfig.buttonClass}`}
                      >
                        <span>{dailyConfig.actionLabel}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {dailyYtEmbed && isDailyVideoOpen && (
                  <div className="mt-2 aspect-video w-full rounded-md overflow-hidden border border-[#1a2824] bg-black">
                    <iframe
                      src={dailyYtEmbed}
                      title={selectedTask.resourceTitle}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Steps</span>
              </h3>
              <span className="text-[11px] text-neutral-500">
                {parsedSteps.length} {parsedSteps.length === 1 ? 'step' : 'steps'}
              </span>
            </div>

            <div className="space-y-3">
              {parsedSteps.length > 0 ? (
                parsedSteps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className="p-4 rounded-md bg-[#080d0b] border border-[#1a2824] hover:border-[#1a2824]/80 space-y-3 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#121c17] border border-[#07CB6C]/40 text-[#07CB6C] text-xs flex items-center justify-center font-mono font-bold">
                          {step.stepNumber}
                        </span>
                        <h4 className="text-sm font-semibold text-white">
                          {step.title}
                        </h4>
                      </div>

                      <span className="text-xs text-neutral-300 bg-[#121c17] px-2.5 py-1 rounded-md border border-[#1a2824]">
                        {step.durationMinutes} min
                      </span>
                    </div>

                    {/* Evidence Layer Badge & Reasoning */}
                    {step.layer && (() => {
                      const layerConfig = getEvidenceLayerConfig(step.layer);
                      if (!layerConfig) return null;
                      return (
                        <div className="pl-8 flex flex-wrap items-center gap-2 pt-0.5">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${layerConfig.badgeClass} group relative cursor-help`}>
                            {layerConfig.icon}
                            <span>{layerConfig.label}</span>
                            <span className="text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">ⓘ</span>

                            {/* One-line tooltip modal/popover */}
                            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-30 w-72 p-2.5 rounded-md bg-[#0d1411] border border-[#1a2824] shadow-2xl text-[11px] text-neutral-300 pointer-events-none leading-relaxed">
                              <p className="font-semibold text-white mb-0.5 flex items-center gap-1.5">
                                {layerConfig.icon}
                                <span>{layerConfig.label}</span>
                              </p>
                              <p className="text-neutral-400">{layerConfig.disclaimer}</p>
                            </div>
                          </div>

                          {step.layerReasoning && (
                            <span className="text-[11px] text-neutral-400 italic">
                              — {step.layerReasoning}
                            </span>
                          )}
                        </div>
                      );
                    })()}

                    {step.timing && (
                      <div className="ml-8 flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                        <Hourglass className="w-3 h-3 shrink-0" />
                        {step.timing}
                      </div>
                    )}

                    <p className="text-xs sm:text-sm text-neutral-300 pl-8 leading-relaxed">
                      {step.instructions}
                    </p>

                    {step.output && (
                      <div className="ml-8 flex items-start gap-2 text-xs text-neutral-300">
                        <PackageCheck className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-semibold text-sky-400">You'll have: </span>
                          {step.output}
                        </span>
                      </div>
                    )}

                    {step.passMark && (
                      <div className="ml-8 flex items-start gap-2 rounded-md border border-[#07CB6C]/30 bg-[#07CB6C]/10 px-2.5 py-1.5 text-xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                        <span className="text-neutral-200">
                          <span className="font-semibold text-[#07CB6C]">Done when: </span>
                          {step.passMark}
                        </span>
                      </div>
                    )}

                    {/* Interactive Challenge Widget */}
                    <div className="pl-8 pt-1">
                      <StepChallengeWidget step={step} />
                    </div>

                    {/* Tips — simplified */}
                    {(step.focusCue || step.pitfallToAvoid) && (
                      <div className="pl-8 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        {step.focusCue && (
                          <div className="p-2.5 rounded-md bg-[#07CB6C]/5 border border-[#07CB6C]/20 flex items-start gap-2">
                            <Target className="w-3.5 h-3.5 text-[#07CB6C] shrink-0 mt-0.5" />
                            <span className="text-neutral-300">{step.focusCue}</span>
                          </div>
                        )}

                        {step.pitfallToAvoid && (
                          <div className="p-2.5 rounded-md bg-neutral-900/40 border border-[#1a2824] flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0 mt-0.5" />
                            <span className="text-neutral-300">{step.pitfallToAvoid}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Step-level Resource */}
                    {step.resourceTitle && (() => {
                      const stepKey = `${selectedTask.id}_step_${step.stepNumber}`;
                      const config = getStepResourceConfig(step.resourceType);
                      const ytEmbed = step.resourceUrl ? getYouTubeEmbedUrl(step.resourceUrl) : null;
                      const isVideoOpen = activeVideoStep === stepKey;

                      return (
                        <div className="pl-8 pt-1">
                          <div className={`p-3 rounded-md border ${config.containerClass} space-y-2 transition-all`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <a
                                href={step.resourceUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-bold text-white hover:underline inline-flex items-center gap-1.5 group cursor-pointer"
                              >
                                {config.icon}
                                <span>{step.resourceTitle}</span>
                                <ExternalLink className="w-3 h-3 text-neutral-400 group-hover:text-white shrink-0" />
                              </a>

                              <div className="flex items-center gap-2">
                                {ytEmbed && (
                                  <button
                                    type="button"
                                    onClick={() => setActiveVideoStep(isVideoOpen ? null : stepKey)}
                                    className="px-2.5 py-1 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 text-[11px] font-semibold text-neutral-200 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <PlayCircle className="w-3.5 h-3.5 text-[#07CB6C]" />
                                    <span>{isVideoOpen ? 'Close' : 'Watch'}</span>
                                  </button>
                                )}

                                {step.resourceUrl && (
                                  <a
                                    href={step.resourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${config.buttonClass}`}
                                  >
                                    <span>{config.actionLabel}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>

                            {step.resourceWhy && (
                              <p className="text-[11px] text-neutral-400 leading-relaxed">
                                {step.resourceWhy}
                              </p>
                            )}

                            {ytEmbed && isVideoOpen && (
                              <div className="mt-2 aspect-video w-full rounded-md overflow-hidden border border-red-500/30 bg-black">
                                <iframe
                                  src={ytEmbed}
                                  title={step.resourceTitle}
                                  className="w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-md bg-[#080d0b] border border-[#1a2824] text-xs text-neutral-300">
                  {selectedTask.isRestDay ? 'Rest day. Nothing planned today.' : selectedTask.detailedSteps}
                </div>
              )}
            </div>
          </div>

          {selectedTask.minimumVersion && (
            <div className="p-3.5 rounded-md bg-[#080d0b] border border-dashed border-[#1a2824] space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                  Short on time? Do the {selectedTask.minimumVersion.durationMinutes}-minute version
                </span>
              </div>
              <p className="text-neutral-200 font-medium">{selectedTask.minimumVersion.title}</p>
              <p className="text-neutral-400 leading-relaxed">{selectedTask.minimumVersion.instructions}</p>
              {selectedTask.minimumVersion.passMark && (
                <p className="text-neutral-400">
                  <span className="font-semibold text-[#07CB6C]">Done when: </span>
                  {selectedTask.minimumVersion.passMark}
                </p>
              )}
            </div>
          )}

          {/* Expandable Session Notes */}
          <div className="pt-2 border-t border-[#1a2824]/60">
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white cursor-pointer transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>{showNotes ? 'Hide notes' : selectedTask.notes ? 'Edit notes' : 'Add notes'}</span>
              {showNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showNotes && (
              <div className="mt-2 space-y-2 animate-fadeIn">
                <textarea
                  placeholder="How did it go? Any thoughts to capture..."
                  rows={2}
                  value={taskNotes[selectedTask.id] ?? (selectedTask.notes || '')}
                  onChange={(e) =>
                    setTaskNotes((prev) => ({
                      ...prev,
                      [selectedTask.id]: e.target.value
                    }))
                  }
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-[#080d0b] border border-[#1a2824] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] text-xs text-neutral-200 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span>{isNoteSaved ? 'Saved!' : 'Save'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </FullDayVisualizer>
      ) : (
        <div className="p-8 rounded-md bg-[#0c1210] border border-[#1a2824] text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#07CB6C]/30 border-t-[#07CB6C] rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400">Loading schedule...</p>
        </div>
      )}



      {/* ===================================================================== */}
      {/* 5. MODAL: WEEKLY REVIEW */}
      {/* ===================================================================== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c1210] border border-[#1a2824] rounded-md p-6 space-y-6 text-left shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a2824] pb-3">
              <h2 className="text-lg font-bold text-white">
                Week {currentWeekNum} Review
              </h2>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Card */}
            <div className="p-4 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-2 text-center">
              <div className="text-xs text-neutral-400">
                This week
              </div>
              <div
                className={`text-4xl font-extrabold font-mono ${
                  weekScorePercent >= 85 ? 'text-[#07CB6C]' : 'text-[#f59e0b]'
                }`}
              >
                {weekScorePercent}%
              </div>
              <div className="text-xs text-neutral-400">
                {completedDaysThisWeek.length} of {activeDaysThisWeek.length} sessions completed
              </div>

              <div className="pt-2 text-xs">
                {weekScorePercent >= 85 ? (
                  <p className="text-[#07CB6C] font-semibold flex items-center justify-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    <span>Great week! Next week will build on this momentum.</span>
                  </p>
                ) : (
                  <p className="text-[#f59e0b] font-medium">
                    Next week will adapt to help you build consistency.
                  </p>
                )}
              </div>
            </div>

            {/* Reflection Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-300 block">
                What worked? What could be better?
              </label>
              <textarea
                value={reviewReflection}
                onChange={(e) => setReviewReflection(e.target.value)}
                placeholder="e.g. Morning sessions went well. Got distracted Thursday..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-[#080d0b] border border-[#1a2824] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
              />
            </div>

            {reviewError && (
              <p role="alert" className="text-xs text-amber-400 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/25">{reviewError}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-3 py-2 text-xs text-neutral-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleSubmitReview}
                className="px-5 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:bg-neutral-800 disabled:text-neutral-500"
              >
                {isSubmittingReview ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                    <span>Preparing week {currentWeekNum + 1}...</span>
                  </>
                ) : (
                  <>
                    <span>{reviewError ? 'Try again' : `Start Week ${currentWeekNum + 1}`}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MODAL: MILESTONE GATE */}
      {/* ===================================================================== */}
      {milestoneGateModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c1210] border border-[#f59e0b]/50 rounded-md p-6 space-y-5 text-left shadow-2xl relative overflow-hidden">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#f59e0b]/15 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-semibold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              <span>Milestone Reached</span>
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-white">
                {milestoneGateModal.title}
              </h2>
              <p className="text-xs text-neutral-400">
                You've completed the {milestoneGateModal.completedPhase} phase and unlocked {milestoneGateModal.nextPhase}!
              </p>
            </div>

            <div className="p-4 rounded-md bg-[#111a17] border border-[#1a2824] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Transition</span>
                <span className="font-semibold text-white">
                  {milestoneGateModal.completedPhase} → {milestoneGateModal.nextPhase}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Benchmark</span>
                <span className={`font-semibold ${milestoneGateModal.benchmarkMet ? 'text-[#07CB6C]' : 'text-[#f59e0b]'}`}>
                  {milestoneGateModal.benchmarkMet ? 'Passed ✓' : 'Adapted'}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setMilestoneGateModal(null)}
                className="w-full py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-xs transition-all cursor-pointer text-center"
              >
                Continue to {milestoneGateModal.nextPhase}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. FULLSCREEN ZEN FOCUS SESSION MODAL */}
      {/* ===================================================================== */}
      {selectedTask && (
        <FocusSessionModal
          task={selectedTask}
          dayNumber={dayNumberCurrent}
          isOpen={isFocusModalOpen}
          onClose={() => setIsFocusModalOpen(false)}
          onCompleteSession={handleCompleteFocusSession}
        />
      )}

      <PathwayStrip
        currentId={findPathwayByTitle(goal.rawGoal)?.id}
        onOpen={(pathway) => openPathways(pathway.id)}
        onExploreAll={() => openPathways()}
      />

      <PathwaysExplorerModal
        isOpen={isPathwaysModalOpen}
        onClose={() => setIsPathwaysModalOpen(false)}
        activeGoalTitle={goal.rawGoal}
        initialPathwayId={explorePathwayId}
      />
    </div>
  );
};

export default ExecutionDashboard;

