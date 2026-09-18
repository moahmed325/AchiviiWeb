import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import {
  Target,
  ArrowRight,
  CheckCircle2,
  Circle,
  Zap,
  Clock,
  Calendar,
  Award,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { formatGoalTitle } from '../lib/formatters';
import { updateDailyTask } from '../lib/api';
import { DailyTask, DetailedStep } from '../types';
import { FocusSessionModal } from '../components/FocusSessionModal';

// Interactive Sample Trajectories for Visitor Preview
const SAMPLE_TRAJECTORIES = [
  {
    id: 'run10k',
    label: 'Run a 10K',
    outcome: 'Run a 10K under 50 minutes continuously with aerobic efficiency',
    dailyMinutes: 35,
    image: '/images/goals/run10k.jpg',
    tag: 'FITNESS & ENDURANCE',
    p1: { name: 'Foundation', focus: 'Aerobic base & cadence rhythm (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Threshold intervals & stamina expansion (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Pacing simulation & continuous 10K benchmark (Weeks 9–12)' },
    sampleDay: {
      title: 'Aerobic Base Pace & Cadence Calibration',
      duration: '35m',
      focus: 'Zone 2 heart rate with steady 170 SPM turnover',
      slot: '07:00 – 07:35',
    },
  },
  {
    id: 'saas',
    label: 'Ship a SaaS',
    outcome: 'Build, deploy, and launch a full-stack SaaS to first paying user',
    dailyMinutes: 45,
    image: '/images/goals/saas.jpg',
    tag: 'TECH & STARTUP',
    p1: { name: 'Foundation', focus: 'Domain model, authentication & core pipeline (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Billing integration, user workflows & UX polish (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Distribution channels, landing page & user onboarding (Weeks 9–12)' },
    sampleDay: {
      title: 'Database Schema & Relational API Endpoints',
      duration: '45m',
      focus: 'Implement migrations and write deterministic API integration tests',
      slot: '08:00 – 08:45',
    },
  },
  {
    id: 'guitar',
    label: 'Acoustic Guitar',
    outcome: 'Play 5 complete songs from memory with clean fingerpicking at campfires',
    dailyMinutes: 30,
    image: '/images/goals/guitar.jpg',
    tag: 'MUSIC & MASTERY',
    p1: { name: 'Foundation', focus: 'Chord transitions, finger dexterity & metronome timing (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Fingerstyle patterns, syncopation & barre chords (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Full dynamic arrangement & continuous memory playthrough (Weeks 9–12)' },
    sampleDay: {
      title: 'Clean Open-Chord Transitions & Travis Picking Drill',
      duration: '30m',
      focus: 'Metronome practice at 72 BPM without glancing at fretboard',
      slot: '19:00 – 19:30',
    },
  },
  {
    id: 'spanish',
    label: 'Conversational Spanish',
    outcome: 'Hold 15-minute fluid conversational dialogues in Spanish without hesitation',
    dailyMinutes: 30,
    image: '/images/goals/spanish.png',
    tag: 'LANGUAGE & IMMERSION',
    p1: { name: 'Foundation', focus: 'Core 500 active verbs & high-frequency sentence frames (Weeks 1–4)' },
    p2: { name: 'Acceleration', focus: 'Spontaneous response drills & audio comprehension (Weeks 5–8)' },
    p3: { name: 'Mastery', focus: 'Native dialogue sessions & narrative storytelling (Weeks 9–12)' },
    sampleDay: {
      title: 'Active Recall Sentence Construction & Pronunciation',
      duration: '30m',
      focus: 'Timed audio responses using past tense irregular verbs',
      slot: '07:30 – 08:00',
    },
  },
];

export const Home: React.FC = () => {
  const { user, token, loading: authLoading, openAuthModal } = useAuth();
  const { activeGoal, loadingGoal, updateActiveGoal } = useGoal();
  const navigate = useNavigate();

  // Landing Page Interactive State
  const [selectedTrajectoryId, setSelectedTrajectoryId] = useState('saas');
  const [visitorGoalInput, setVisitorGoalInput] = useState('');

  // Signed-in Dashboard State
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [isNoteSaved, setIsNoteSaved] = useState(false);

  const selectedTrajectory = useMemo(() => {
    return SAMPLE_TRAJECTORIES.find((t) => t.id === selectedTrajectoryId) || SAMPLE_TRAJECTORIES[0];
  }, [selectedTrajectoryId]);

  // Handle Starting Goal from Visitor Input
  const handleStartFromLanding = (e: React.FormEvent) => {
    e.preventDefault();
    if (visitorGoalInput.trim()) {
      localStorage.setItem('achivii_draft_goal', visitorGoalInput.trim());
    }
    openAuthModal('signup');
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
  if (authLoading || (token && loadingGoal)) {
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
    // If no active goal exists yet, display a peaceful goal creation portal
    if (!activeGoal) {
      return (
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 sm:py-16 space-y-8 animate-fadeIn text-left">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-xs font-mono text-[#07CB6C]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
              <span>Workspace Ready</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Choose a goal to achieve
            </h1>
            <p className="text-sm text-neutral-400 max-w-xl leading-relaxed">
              Achivii breaks any goal into a calibrated 3-phase trajectory with daily micro-sessions and automated recovery.
            </p>
          </div>

          {/* Quick Inspiration Options */}
          <div className="space-y-3">
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              Popular 90-Day Pathways
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  title: 'Build & Ship a SaaS Web App',
                  desc: 'From clean schema to first paying user',
                  image: '/images/goals/saas.jpg',
                  tag: 'TECH & STARTUP',
                },
                {
                  title: 'Run a 10K Under 50 Minutes',
                  desc: 'Progressive aerobic base & threshold pacing',
                  image: '/images/goals/run10k.jpg',
                  tag: 'FITNESS & ENDURANCE',
                },
                {
                  title: 'Play 5 Songs on Acoustic Guitar',
                  desc: 'Fingerstyle mechanics & memory playthrough',
                  image: '/images/goals/guitar.jpg',
                  tag: 'MUSIC & MASTERY',
                },
                {
                  title: 'Speak Conversational Spanish',
                  desc: '500 core verbs & spontaneous response drills',
                  image: '/images/goals/spanish.png',
                  tag: 'LANGUAGE & IMMERSION',
                },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    localStorage.setItem('achivii_draft_goal', item.title);
                    navigate('/onboarding');
                  }}
                  className="relative rounded-md overflow-hidden border border-[#1a2824] hover:border-[#07CB6C]/60 text-left transition-all cursor-pointer group flex flex-col justify-end min-h-[140px] sm:min-h-[160px] p-4 bg-[#0c1210]"
                >
                  {/* Background Image with Dark Gradient Overlay */}
                  <div className="absolute inset-0 overflow-hidden">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover opacity-30 group-hover:opacity-45 group-hover:scale-105 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050807] via-[#050807]/80 to-transparent" />
                  </div>

                  {/* Card Content (Crisp, High Contrast, Perfectly Legible) */}
                  <div className="relative z-10 space-y-1">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-[#07CB6C]">
                      {item.tag}
                    </span>
                    <p className="text-sm sm:text-base font-bold text-white group-hover:text-[#07CB6C] transition-colors leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-neutral-300 line-clamp-1">
                      {item.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/onboarding')}
              className="w-full sm:w-auto px-6 py-3 rounded-md bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.98] text-black font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Define Custom 90-Day Goal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </main>
      );
    }

    // User HAS an active goal -> Render the Zen Executive Command Center
    const displayTitle = formatGoalTitle(activeGoal.clarifiedOutcome, activeGoal.rawGoal);

    return (
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 animate-fadeIn text-left">
        {/* =================================================================== */}
        {/* TOP STATUS & 90-DAY PROGRESS */}
        {/* =================================================================== */}
        <div className="p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
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

            {/* Quick 1-Click Action: View Full 90-Day Roadmap */}
            <div className="shrink-0 flex items-center gap-2">
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
      </main>
    );
  }

  // ===========================================================================
  // 2. UNAUTHENTICATED VISITOR LANDING EXPERIENCE (HIGH CRAFT, ZERO NOISE)
  // ===========================================================================
  return (
    <main className="flex-1 flex flex-col justify-start py-10 sm:py-16 animate-fadeIn text-left">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full space-y-12 sm:space-y-16">
        {/* =================================================================== */}
        {/* HERO SECTION */}
        {/* =================================================================== */}
        <div className="text-center space-y-5 max-w-2xl mx-auto">
          {/* Subtle Monospace Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#0c1410] border border-[#07CB6C]/30 text-xs font-mono text-[#07CB6C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
            <span>90-Day Mastery Engine</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Master any ambition in <span className="text-[#07CB6C]">90 days</span>.
          </h1>

          {/* Minimal, punchy subhead */}
          <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
            One deliberate daily session. Zero-guilt adaptive recovery. Built to eliminate cognitive overload.
          </p>

          {/* Quick Start Goal Input Form */}
          <form
            onSubmit={handleStartFromLanding}
            className="pt-2 flex flex-col sm:flex-row items-stretch justify-center gap-2 max-w-md mx-auto"
          >
            <input
              type="text"
              value={visitorGoalInput}
              onChange={(e) => setVisitorGoalInput(e.target.value)}
              placeholder="e.g. Run a 10K, Ship a SaaS, Learn Guitar"
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-md bg-[#0c1210] border border-[#1a2824] focus:border-[#07CB6C] text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.98] text-black font-semibold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Start Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Secondary Quick Action */}
          <div className="flex items-center justify-center gap-4 text-xs text-neutral-500">
            <span>Already have an active plan?</span>
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="text-[#07CB6C] hover:underline cursor-pointer font-medium"
            >
              Sign In →
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* INTERACTIVE 90-DAY TRAJECTORY PREVIEW (LOW NOISE, HIGH ENGAGEMENT) */}
        {/* =================================================================== */}
        <div className="p-5 sm:p-7 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a2824] pb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                Interactive Plan Architecture
              </span>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                How a 90-Day Trajectory Unfolds
              </h2>
            </div>

            {/* Ambition Picker Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {SAMPLE_TRAJECTORIES.map((traj) => (
                <button
                  key={traj.id}
                  type="button"
                  onClick={() => setSelectedTrajectoryId(traj.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                    selectedTrajectoryId === traj.id
                      ? 'bg-[#07CB6C] text-black font-semibold shadow-xs'
                      : 'bg-[#111a17] text-neutral-400 hover:text-white border border-[#1a2824]'
                  }`}
                >
                  {traj.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3 Phases Progression Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { phase: 'Phase 1', weeks: 'Weeks 1–4', ...selectedTrajectory.p1 },
              { phase: 'Phase 2', weeks: 'Weeks 5–8', ...selectedTrajectory.p2 },
              { phase: 'Phase 3', weeks: 'Weeks 9–12', ...selectedTrajectory.p3 },
            ].map((p, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                  <span>{p.phase}</span>
                  <span>{p.weeks}</span>
                </div>
                <h3 className="text-xs font-bold text-white tracking-tight">{p.name}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{p.focus}</p>
              </div>
            ))}
          </div>

          {/* Sample Daily Micro-Session Card */}
          <div className="relative rounded-md overflow-hidden border border-[#07CB6C]/30 p-4 sm:p-5 space-y-3 bg-[#080d0b]">
            {/* Ambient Background Image */}
            {selectedTrajectory.image && (
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                  src={selectedTrajectory.image}
                  alt={selectedTrajectory.label}
                  className="w-full h-full object-cover opacity-20"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#080d0b] via-[#080d0b]/85 to-[#080d0b]/90" />
              </div>
            )}

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
                  <span className="font-mono text-[#07CB6C] font-semibold">
                    Sample Day Directive ({selectedTrajectory.sampleDay.duration})
                  </span>
                </div>
                <span className="font-mono text-neutral-400 text-[11px]">
                  {selectedTrajectory.sampleDay.slot}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-sm sm:text-base font-semibold text-white">
                  {selectedTrajectory.sampleDay.title}
                </p>
                <p className="text-xs text-neutral-300">
                  Focus cue: {selectedTrajectory.sampleDay.focus}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3 CORE ZEN PRINCIPLES (MINIMALIST, NO MARKETING FLUFF) */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-2">
            <div className="w-7 h-7 rounded-md bg-[#111a17] border border-[#1a2824] flex items-center justify-center text-[#07CB6C]">
              <Target className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white">Single Daily Directive</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Never waste willpower deciding what to do. Exactly one high-leverage session scheduled every day.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-2">
            <div className="w-7 h-7 rounded-md bg-[#111a17] border border-[#1a2824] flex items-center justify-center text-[#07CB6C]">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white">Silent Buffer Recovery</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Miss a session? Our algorithm automatically reallocates it to open buffer slots without broken streaks or guilt.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-2">
            <div className="w-7 h-7 rounded-md bg-[#111a17] border border-[#1a2824] flex items-center justify-center text-[#07CB6C]">
              <Award className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white">Weekly Checkpoints</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Quick 5-minute Sunday milestone reviews to calibrate pacing and unlock next week's calibrated exercises.
            </p>
          </div>
        </div>

        {/* =================================================================== */}
        {/* BOTTOM CALL TO ACTION */}
        {/* =================================================================== */}
        <div className="p-6 sm:p-8 rounded-md bg-[#0c1210] border border-[#1a2824] text-center space-y-4">
          <h3 className="text-lg sm:text-2xl font-bold text-white tracking-tight">
            Start your 90-day trajectory today.
          </h3>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto">
            Free to use. Powered by deliberate practice science and adaptive schedule materialization.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="w-full sm:w-auto px-6 py-3 rounded-md bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.98] text-black font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started — Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signin')}
              className="w-full sm:w-auto px-5 py-3 rounded-md bg-[#111a17] hover:bg-[#16221e] border border-[#1a2824] text-neutral-300 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Home;
