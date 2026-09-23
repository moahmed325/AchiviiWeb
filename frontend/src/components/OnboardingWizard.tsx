import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Target,
  ArrowRight,
  ArrowLeft,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
  Edit3,
  Check,
  Plus,
  X,
  Dumbbell,
  GraduationCap,
  Briefcase,
  Car,
  Utensils,
  Flame,
  Heart,
  ShieldCheck,
  Sparkles,
  Calendar,
  GripVertical,
  Trash2,
  Clock,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import {
  FollowUpQuestion,
  GoalClarification,
  RoutineSettings,
  CreateGoalResponse,
  Goal,
  CommitmentItem
} from '../types';
import { clarifyGoal, createGoalPlan, type PlanProgressEvent } from '../lib/api';
import { CERTIFIED_PATHWAYS } from '../lib/certifiedPresets';

interface PresetCommitment {
  id: string;
  category: 'fitness' | 'education' | 'commute' | 'family' | 'sports' | 'work' | 'other';
  title: string;
  defaultTime: string;
  defaultDays: string[];
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  bgColor: string;
  borderColor: string;
}

const PRESET_COMMITMENTS: PresetCommitment[] = [
  {
    id: 'gym',
    category: 'fitness',
    title: 'Gym & Fitness',
    defaultTime: '18:00 - 19:30',
    defaultDays: ['Mon', 'Wed', 'Fri'],
    subtitle: 'Strength, cardio, or mobility',
    icon: Dumbbell,
    accentColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30'
  },
  {
    id: 'university',
    category: 'education',
    title: 'Classes & Study',
    defaultTime: '09:00 - 14:00',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subtitle: 'University, lectures, or school',
    icon: GraduationCap,
    accentColor: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30'
  },
  {
    id: 'commute',
    category: 'commute',
    title: 'Daily Commute',
    defaultTime: '08:00 - 08:45',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subtitle: 'Transit, driving, or cycling',
    icon: Car,
    accentColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30'
  },
  {
    id: 'dinner',
    category: 'family',
    title: 'Dinner & Family',
    defaultTime: '19:30 - 20:30',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    subtitle: 'Evenings, family, or meal prep',
    icon: Utensils,
    accentColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30'
  },
  {
    id: 'sports',
    category: 'sports',
    title: 'Sports & Martial Arts',
    defaultTime: '19:00 - 20:30',
    defaultDays: ['Tue', 'Thu', 'Sat'],
    subtitle: 'Boxing, football, yoga, tennis',
    icon: Flame,
    accentColor: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30'
  },
  {
    id: 'work_shift',
    category: 'work',
    title: 'Part-Time Shift / Job',
    defaultTime: '16:00 - 21:00',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subtitle: 'Evening shift, freelance, or gig',
    icon: Briefcase,
    accentColor: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30'
  }
];

export const formatDaysLabel = (days?: string[]): string => {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekends = ['Sat', 'Sun'];
  if (days.length === 5 && weekdays.every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && weekends.every((d) => days.includes(d))) return 'Weekends';
  return days.join(', ');
};


const getCategoryDetails = (category?: string) => {
  switch (category) {
    case 'fitness':
      return {
        icon: Dumbbell,
        label: 'Fitness',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30'
      };
    case 'education':
      return {
        icon: GraduationCap,
        label: 'Study',
        color: 'text-sky-400',
        bg: 'bg-sky-500/10',
        border: 'border-sky-500/30'
      };
    case 'commute':
      return {
        icon: Car,
        label: 'Commute',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30'
      };
    case 'family':
      return {
        icon: Utensils,
        label: 'Dinner',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30'
      };
    case 'sports':
      return {
        icon: Flame,
        label: 'Sports',
        color: 'text-orange-400',
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30'
      };
    case 'work':
      return {
        icon: Briefcase,
        label: 'Work Shift',
        color: 'text-teal-400',
        bg: 'bg-teal-500/10',
        border: 'border-teal-500/30'
      };
    default:
      return {
        icon: Heart,
        label: 'Personal',
        color: 'text-pink-400',
        bg: 'bg-pink-500/10',
        border: 'border-pink-500/30'
      };
  }
};

const parseTimeToMinutes = (timeStr: string, fallback: number): number => {
  if (!timeStr) return fallback;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

const formatMinutesTo12h = (mins: number): string => {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${h12}:${mStr} ${ampm}`;
};

const formatMinutesTo24h = (mins: number): string => {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const hStr = h24 < 10 ? `0${h24}` : `${h24}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}:${mStr}`;
};

export interface ScheduledDayBlock {
  id: string;
  type: 'sleep_morning' | 'work' | 'commitment' | 'practice' | 'sleep_night';
  title: string;
  category?: string;
  startMins: number;
  endMins: number;
  durationMins: number;
  timeLabel: string;
  icon?: any;
  color: string;
  bg: string;
  border: string;
  isPractice?: boolean;
  days?: string[];
}

export const computeDaySchedule = (
  routine: RoutineSettings,
  customPracticeStartMins?: number | null
) => {
  const wakeMins = parseTimeToMinutes(routine.wakeTime, 420);
  const sleepMins = parseTimeToMinutes(routine.sleepTime, 1380);
  const busyParts = (routine.busyHours || '09:00 - 17:00').split('-');
  const busyStartMins = parseTimeToMinutes(busyParts[0]?.trim() || '', 540);
  const busyEndMins = parseTimeToMinutes(busyParts[1]?.trim() || '', 1020);

  // List of occupied intervals that blocks must not overlap with
  const occupied: Array<{ start: number; end: number; id: string }> = [
    { start: 0, end: wakeMins, id: 'sleep_morning' },
    { start: busyStartMins, end: busyEndMins, id: 'work' },
    { start: sleepMins, end: 1440, id: 'sleep_night' }
  ];

  const isFree = (s: number, e: number): boolean => {
    return !occupied.some((o) => Math.max(s, o.start) < Math.min(e, o.end));
  };

  // Find the closest non-overlapping slot in [winMin, winMax]
  const findSlot = (
    targetStart: number,
    duration: number,
    winMin: number,
    winMax: number
  ): { start: number; end: number } => {
    // 1. Direct placement if cleanly free
    if (targetStart >= winMin && targetStart + duration <= winMax && isFree(targetStart, targetStart + duration)) {
      return { start: targetStart, end: targetStart + duration };
    }

    // 2. Discover all contiguous free gaps within window
    const sorted = [...occupied]
      .filter((o) => o.end > winMin && o.start < winMax)
      .sort((a, b) => a.start - b.start);

    const gaps: Array<{ start: number; end: number; len: number }> = [];
    let cur = winMin;
    for (const o of sorted) {
      const gStart = cur;
      const gEnd = Math.min(o.start, winMax);
      if (gEnd > gStart) {
        gaps.push({ start: gStart, end: gEnd, len: gEnd - gStart });
      }
      cur = Math.max(cur, o.end);
    }
    if (cur < winMax) {
      gaps.push({ start: cur, end: winMax, len: winMax - cur });
    }

    // Find gaps that fit the requested duration
    const validGaps = gaps.filter((g) => g.len >= duration);
    if (validGaps.length > 0) {
      let bestGap = validGaps[0];
      let bestDist = Math.abs(bestGap.start - targetStart);
      for (const g of validGaps) {
        const dist = Math.abs(g.start - targetStart);
        if (dist < bestDist) {
          bestDist = dist;
          bestGap = g;
        }
      }
      const s = Math.max(bestGap.start, Math.min(targetStart, bestGap.end - duration));
      return { start: s, end: s + duration };
    }

    // Fallback to largest available gap if full duration cannot fit
    if (gaps.length > 0) {
      const largest = gaps.reduce((max, g) => (g.len > max.len ? g : max), gaps[0]);
      return { start: largest.start, end: largest.end };
    }

    const fallbackEnd = Math.min(winMax, winMin + Math.max(15, duration));
    return { start: winMin, end: fallbackEnd };
  };

  // Dynamically allocate non-overlapping slots for commitments
  const placedCommitments: ScheduledDayBlock[] = [];
  const placedCommitmentsMap: Record<string, { startMins: number; endMins: number; timeLabel: string }> = {};

  (routine.commitments || []).forEach((c) => {
    const cat = getCategoryDetails(c.category);
    let preferredStart = 1080; // 18:00 default
    let duration = 60;

    if (c.time && c.time.includes('-')) {
      const parts = c.time.split(',')[0].split('-');
      const s = parseTimeToMinutes(parts[0]?.trim() || '', 1080);
      const e = parseTimeToMinutes(parts[1]?.trim() || '', s + 60);
      if (e > s) {
        duration = e - s;
        preferredStart = s;
      }
    } else {
      if (c.category === 'fitness' || c.category === 'sports') {
        duration = 90;
        preferredStart = 1080; // 18:00
      } else if (c.category === 'education') {
        duration = 180;
        preferredStart = 540; // 09:00
      } else if (c.category === 'commute') {
        duration = 45;
        preferredStart = busyEndMins; // right after work
      } else if (c.category === 'family') {
        duration = 60;
        preferredStart = 1170; // 19:30
      } else {
        duration = 60;
        preferredStart = 1080;
      }
    }

    const inMorning = preferredStart < busyStartMins;
    const winMin = inMorning ? wakeMins : busyEndMins;
    const winMax = inMorning ? busyStartMins : sleepMins;

    const slot = findSlot(preferredStart, duration, winMin, winMax);
    occupied.push({ start: slot.start, end: slot.end, id: c.id });

    const timeLabel = `${formatMinutesTo24h(slot.start)} - ${formatMinutesTo24h(slot.end)}`;
    placedCommitmentsMap[c.id] = {
      startMins: slot.start,
      endMins: slot.end,
      timeLabel
    };

    placedCommitments.push({
      id: c.id,
      type: 'commitment',
      title: c.title,
      category: c.category,
      startMins: slot.start,
      endMins: slot.end,
      durationMins: slot.end - slot.start,
      timeLabel,
      icon: cat.icon,
      color: cat.color,
      bg: cat.bg,
      border: cat.border,
      days: c.days
    });
  });

  // Dynamically allocate practice session (or respect user's dragged/tapped time) without overlapping
  const practiceDuration = routine.dailyMinutes || 60;
  let practiceSlot: { start: number; end: number };

  if (typeof customPracticeStartMins === 'number') {
    let target = Math.round(customPracticeStartMins / 15) * 15;
    target = Math.max(wakeMins, Math.min(sleepMins - practiceDuration, target));

    // Magnetic bumper around busy hours
    if (target < busyEndMins && target + practiceDuration > busyStartMins) {
      if (target + practiceDuration / 2 < (busyStartMins + busyEndMins) / 2) {
        target = Math.max(wakeMins, busyStartMins - practiceDuration);
      } else {
        target = Math.min(sleepMins - practiceDuration, busyEndMins);
      }
    }

    practiceSlot = findSlot(target, practiceDuration, wakeMins, sleepMins);
  } else {
    let practiceWinMin = busyEndMins;
    let practiceWinMax = sleepMins;
    let practiceTargetStart = 1170; // 19:30 default evening

    if (routine.preferredSlot === 'morning') {
      practiceWinMin = wakeMins;
      practiceWinMax = busyStartMins;
      practiceTargetStart = wakeMins + 15;
    } else if (routine.preferredSlot === 'afternoon') {
      practiceWinMin = busyStartMins;
      practiceWinMax = busyEndMins;
      practiceTargetStart = 840; // 14:00
    }

    practiceSlot = findSlot(practiceTargetStart, practiceDuration, practiceWinMin, practiceWinMax);

    // If preferred window is completely full, gracefully seek an open slot in the other active window
    if (practiceSlot.end - practiceSlot.start < Math.min(30, practiceDuration)) {
      if (routine.preferredSlot === 'evening') {
        practiceSlot = findSlot(wakeMins + 15, practiceDuration, wakeMins, busyStartMins);
      } else {
        practiceSlot = findSlot(1170, practiceDuration, busyEndMins, sleepMins);
      }
    }
  }

  occupied.push({ start: practiceSlot.start, end: practiceSlot.end, id: 'practice' });

  const practiceBlock: ScheduledDayBlock = {
    id: 'practice-session',
    type: 'practice',
    title: 'Achivii Practice',
    startMins: practiceSlot.start,
    endMins: practiceSlot.end,
    durationMins: practiceSlot.end - practiceSlot.start,
    timeLabel: `${formatMinutesTo24h(practiceSlot.start)} - ${formatMinutesTo24h(practiceSlot.end)}`,
    icon: Target,
    color: 'text-black',
    bg: 'bg-[#07CB6C]',
    border: 'border-white/40',
    isPractice: true
  };

  const slotPeriod =
    practiceSlot.start < 720 ? 'Morning' : practiceSlot.start < 1020 ? 'Afternoon' : 'Evening';
  const practiceTimeLabel = `${slotPeriod} ~${formatMinutesTo12h(practiceSlot.start)}`;

  // Assemble full 24-hour non-overlapping timeline
  const allBlocks: ScheduledDayBlock[] = [
    {
      id: 'sleep_morning',
      type: 'sleep_morning' as const,
      title: 'Sleep',
      startMins: 0,
      endMins: wakeMins,
      durationMins: wakeMins,
      timeLabel: `00:00 - ${formatMinutesTo24h(wakeMins)}`,
      icon: Moon,
      color: 'text-indigo-300',
      bg: 'bg-indigo-950/60',
      border: 'border-indigo-800/40'
    },
    {
      id: 'work',
      type: 'work' as const,
      title: routine.busyHours ? 'Work / Study' : 'Work',
      startMins: busyStartMins,
      endMins: busyEndMins,
      durationMins: busyEndMins - busyStartMins,
      timeLabel: `${formatMinutesTo24h(busyStartMins)} - ${formatMinutesTo24h(busyEndMins)}`,
      icon: Briefcase,
      color: 'text-neutral-300',
      bg: 'bg-neutral-800/80',
      border: 'border-neutral-700/60'
    },
    ...placedCommitments,
    practiceBlock,
    {
      id: 'sleep_night',
      type: 'sleep_night' as const,
      title: 'Sleep',
      startMins: sleepMins,
      endMins: 1440,
      durationMins: 1440 - sleepMins,
      timeLabel: `${formatMinutesTo24h(sleepMins)} - 24:00`,
      icon: Moon,
      color: 'text-indigo-300',
      bg: 'bg-indigo-950/60',
      border: 'border-indigo-800/40'
    }
  ].sort((a, b) => a.startMins - b.startMins);

  return {
    allBlocks,
    practiceBlock,
    practiceTimeLabel,
    placedCommitments,
    placedCommitmentsMap
  };
};

interface OnboardingWizardProps {
  token: string;
  onGoalCreated: (goal: Goal) => void;
  initialGoal?: string;
  isPreset?: boolean;
}

interface WizardStepItem {
  id: 1 | 2 | 3 | 4;
  title: string;
  short: string;
  subtitle: string;
}

const WIZARD_STEPS: WizardStepItem[] = [
  { id: 1, title: 'Your Goal', short: 'Goal', subtitle: 'Target outcome' },
  { id: 2, title: 'Schedule & Routine', short: 'Schedule', subtitle: '24h balance map' },
  { id: 3, title: 'Diagnostic Quiz', short: 'Quiz', subtitle: 'Calibrate profile' },
  { id: 4, title: 'Success Blueprint', short: 'Review', subtitle: 'Final pre-flight' }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  token,
  onGoalCreated,
  initialGoal: propInitialGoal,
  isPreset: propIsPreset
}) => {
  // Determine if a preset or draft goal was provided
  const [initialDraft] = useState(() => {
    if (propInitialGoal && propInitialGoal.trim()) {
      return propInitialGoal.trim();
    }
    const saved = localStorage.getItem('achivii_draft_goal');
    if (saved && saved.trim()) {
      localStorage.removeItem('achivii_draft_goal');
      return saved.trim();
    }
    return '';
  });

  const isPresetGoal = Boolean(propIsPreset || initialDraft);

  // If a preset goal was selected, skip Step 1 ("What goal do you want to achieve?") and start directly on Step 2 ("Schedule")
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(() => {
    return isPresetGoal && initialDraft ? 2 : 1;
  });
  const [maxStepReached, setMaxStepReached] = useState<number>(() => {
    return isPresetGoal && initialDraft ? 2 : 1;
  });
  const [rawGoal, setRawGoal] = useState(initialDraft);

  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationError, setClarificationError] = useState<string | null>(null);
  const [isWaitingForClarification, setIsWaitingForClarification] = useState(false);
  const [lastClarifiedGoal, setLastClarifiedGoal] = useState<string | null>(null);

  // Clarification AI Output State
  const [clarification, setClarification] = useState<GoalClarification | null>(null);
  const [editedOutcome, setEditedOutcome] = useState(initialDraft);
  const [isEditingOutcome, setIsEditingOutcome] = useState(false);

  // Diagnostic Question Answers State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  // 1 = skipped once (the question is shown again, reworded), 2 = skipped for good.
  const [skipCounts, setSkipCounts] = useState<Record<string, number>>({});
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(true);

  const questionList = clarification?.followUpQuestions || [];

  /** A typed answer only counts once it says something; otherwise the picked option (if any) stands. */
  const answerFor = (q: FollowUpQuestion): string | undefined => {
    const typed = customAnswers[q.id]?.trim();
    if (typed) return typed.length >= 2 ? typed : undefined;
    return answers[q.id] || undefined;
  };
  const isSkipped = (q: FollowUpQuestion) => !answerFor(q) && (skipCounts[q.id] || 0) >= 2;
  const isResolved = (q: FollowUpQuestion) => Boolean(answerFor(q)) || isSkipped(q);
  const allQuestionsResolved = questionList.length > 0 && questionList.every(isResolved);
  const shownQuestion = (q: FollowUpQuestion) =>
    (skipCounts[q.id] || 0) >= 1 && q.retry ? q.retry : { question: q.question, subtitle: q.subtitle };

  // Centralized Navigation with browser history support
  const goToStep = (targetStep: 1 | 2 | 3 | 4 | 5, pushHistory: boolean = true) => {
    if (step === 5) return; // Locked during plan creation
    if (targetStep === step) return;

    if (pushHistory && typeof window !== 'undefined') {
      window.history.pushState({ wizardStep: targetStep }, '', window.location.pathname);
    }

    if (targetStep > maxStepReached && targetStep <= 4) {
      setMaxStepReached(targetStep);
    }

    if (targetStep === 3) {
      setActiveQuestionIndex(0);
      setIsQuestionModalOpen(true);
    }

    setStep(targetStep);
  };

  const canJumpToStep = (targetStep: number): boolean => {
    if (step === 5) return false;
    if (targetStep === 1) return true;
    if (targetStep === 2) return rawGoal.trim().length > 0 || maxStepReached >= 2;
    if (targetStep === 3) return Boolean(clarification) && scheduleChosen;
    if (targetStep === 4) return Boolean(clarification) && scheduleChosen && allQuestionsResolved;
    return false;
  };

  // Browser History Navigation (Back / Forward button support)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!window.history.state || typeof window.history.state.wizardStep !== 'number') {
      window.history.replaceState({ wizardStep: step }, '', window.location.pathname);
    }

    const handlePopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.wizardStep === 'number') {
        const target = e.state.wizardStep as 1 | 2 | 3 | 4 | 5;
        if (target >= 1 && target <= 4) {
          goToStep(target, false);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [step]);

  useEffect(() => {
    if (step > maxStepReached && step <= 4) {
      setMaxStepReached(step);
    }
  }, [step, maxStepReached]);

  // Routine / Schedule State (Now Step 2!)
  const [routine, setRoutine] = useState<RoutineSettings>({
    wakeTime: '07:00',
    sleepTime: '23:00',
    busyHours: '09:00 - 17:00',
    preferredSlot: 'evening',
    dailyMinutes: 0,
    planVariant: undefined,
    commitments: []
  });
  const scheduleChosen = routine.dailyMinutes > 0 && Boolean(routine.planVariant);

  // Practice Drag & 24-Hour Day Balance State
  interface ActivePracticeDrag {
    initialStartMins: number;
    durationMins: number;
    startX: number;
    currentStartMins: number;
  }

  interface EditingCommitmentSession {
    item: CommitmentItem;
    isNew: boolean;
  }

  const [activePracticeDrag, setActivePracticeDrag] = useState<ActivePracticeDrag | null>(null);
  const [customPracticeStartMins, setCustomPracticeStartMins] = useState<number | null>(null);
  const [editingCommitment, setEditingCommitment] = useState<EditingCommitmentSession | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Active practice start: use real-time drag hover if currently dragging practice, else custom
  const activePracticeStart = activePracticeDrag
    ? activePracticeDrag.currentStartMins
    : customPracticeStartMins;

  // Dynamically computed non-overlapping day schedule layout
  const daySchedule = useMemo(
    () => computeDaySchedule(routine, activePracticeStart),
    [routine, activePracticeStart]
  );

  // Free discretionary buffer calculation
  const freeDiscretionaryMins = useMemo(() => {
    const totalOccupied = daySchedule.allBlocks.reduce((acc, b) => acc + b.durationMins, 0);
    return Math.max(0, 1440 - totalOccupied);
  }, [daySchedule.allBlocks]);

  const freeTimeDisplay = useMemo(() => {
    const hrs = Math.floor(freeDiscretionaryMins / 60);
    const mins = freeDiscretionaryMins % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  }, [freeDiscretionaryMins]);

  // Practice Block Pointer Handlers
  const handlePracticePointerDown = (
    e: React.PointerEvent,
    practiceBlock: ScheduledDayBlock
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setActivePracticeDrag({
      initialStartMins: practiceBlock.startMins,
      durationMins: practiceBlock.durationMins,
      startX: e.clientX,
      currentStartMins: practiceBlock.startMins
    });
  };

  const handlePracticePointerMove = (e: React.PointerEvent) => {
    if (!activePracticeDrag) return;
    e.preventDefault();

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const deltaPixels = e.clientX - activePracticeDrag.startX;
    const deltaMins = Math.round(((deltaPixels / rect.width) * 1440) / 15) * 15;

    const dur = activePracticeDrag.durationMins;
    let proposedStart = activePracticeDrag.initialStartMins + deltaMins;

    const wakeMins = parseTimeToMinutes(routine.wakeTime, 420);
    const sleepMins = parseTimeToMinutes(routine.sleepTime, 1380);
    const busyParts = (routine.busyHours || '09:00 - 17:00').split('-');
    const busyStartMins = parseTimeToMinutes(busyParts[0]?.trim() || '', 540);
    const busyEndMins = parseTimeToMinutes(busyParts[1]?.trim() || '', 1020);

    // Bumper: keep practice within waking hours
    proposedStart = Math.max(wakeMins, Math.min(sleepMins - dur, proposedStart));

    // Bumper: deflect practice outside busy hours
    if (proposedStart < busyEndMins && proposedStart + dur > busyStartMins) {
      if (proposedStart + dur / 2 < (busyStartMins + busyEndMins) / 2) {
        proposedStart = Math.max(wakeMins, busyStartMins - dur);
      } else {
        proposedStart = Math.min(sleepMins - dur, busyEndMins);
      }
    }

    proposedStart = Math.round(proposedStart / 15) * 15;

    setActivePracticeDrag((prev) =>
      prev ? { ...prev, currentStartMins: proposedStart } : null
    );
  };

  const handlePracticePointerUp = (e: React.PointerEvent) => {
    if (!activePracticeDrag) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const finalStart = activePracticeDrag.currentStartMins;
    setActivePracticeDrag(null);

    setCustomPracticeStartMins(finalStart);
    const finalSlot = finalStart < 720 ? 'morning' : finalStart < 1020 ? 'afternoon' : 'evening';
    setRoutine((prev) => ({ ...prev, preferredSlot: finalSlot }));
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activePracticeDrag) return;
    if ((e.target as HTMLElement).closest('[data-no-track-jump]')) {
      return;
    }
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawMins = ratio * 1440;
    const practiceDuration = routine.dailyMinutes || 60;
    let target = Math.round((rawMins - practiceDuration / 2) / 15) * 15;

    const wakeMins = parseTimeToMinutes(routine.wakeTime, 420);
    const sleepMins = parseTimeToMinutes(routine.sleepTime, 1380);
    const busyParts = (routine.busyHours || '09:00 - 17:00').split('-');
    const busyStartMins = parseTimeToMinutes(busyParts[0]?.trim() || '', 540);
    const busyEndMins = parseTimeToMinutes(busyParts[1]?.trim() || '', 1020);

    target = Math.max(wakeMins, Math.min(sleepMins - practiceDuration, target));

    if (target < busyEndMins && target + practiceDuration > busyStartMins) {
      if (target + practiceDuration / 2 < (busyStartMins + busyEndMins) / 2) {
        target = Math.max(wakeMins, busyStartMins - practiceDuration);
      } else {
        target = Math.min(sleepMins - practiceDuration, busyEndMins);
      }
    }

    setCustomPracticeStartMins(target);
    const finalSlot = target < 720 ? 'morning' : target < 1020 ? 'afternoon' : 'evening';
    setRoutine((prev) => ({ ...prev, preferredSlot: finalSlot }));
  };

  // Custom Commitment Input State
  const [isCustomDrawerOpen, setIsCustomDrawerOpen] = useState(false);
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentTime, setNewCommitmentTime] = useState('');

  const handleTogglePresetCommitment = (preset: PresetCommitment) => {
    const existing = (routine.commitments || []).find(
      (c) => c.title.toLowerCase() === preset.title.toLowerCase()
    );
    if (existing) {
      setEditingCommitment({ item: { ...existing }, isNew: false });
    } else {
      const newCommitment: CommitmentItem = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        title: preset.title,
        time: preset.defaultTime,
        category: preset.category,
        days: preset.defaultDays || ['Mon', 'Wed', 'Fri']
      };
      // Prompt the user to decide when they do this routine; only added after clicking Done
      setEditingCommitment({ item: newCommitment, isNew: true });
    }
  };

  const handleAddCustomCommitment = () => {
    if (!newCommitmentTitle.trim()) return;
    const newCommitment: CommitmentItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      title: newCommitmentTitle.trim(),
      time: newCommitmentTime.trim() || '18:00 - 19:00',
      category: 'other',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    };
    setNewCommitmentTitle('');
    setNewCommitmentTime('');
    setIsCustomDrawerOpen(false);
    // Prompt the user to decide when they do this routine; only added after clicking Done
    setEditingCommitment({ item: newCommitment, isNew: true });
  };

  const handleRemoveCommitment = (id: string) => {
    setRoutine((prev) => ({
      ...prev,
      commitments: (prev.commitments || []).filter((c) => c.id !== id)
    }));
  };

  // Step 5 State (Plan Generation)
  const [planSteps, setPlanSteps] = useState<PlanProgressEvent[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const PLAN_STEPS: Array<{ id: PlanProgressEvent['id']; pending: string }> = [
    { id: 'search', pending: 'Search sources' },
    { id: 'method', pending: 'Choose the method' },
    { id: 'plan', pending: 'Write the first week' },
  ];

  // --------------------------------------------------------------------------
  // Background AI Clarification Runner
  // --------------------------------------------------------------------------
  const startClarification = (goalText: string, force: boolean = false) => {
    const textToUse = (goalText || rawGoal).trim();
    if (!textToUse) return;

    if (!force && clarification && lastClarifiedGoal === textToUse) {
      return;
    }

    setIsClarifying(true);
    setClarificationError(null);
    setLastClarifiedGoal(textToUse);

    clarifyGoal(textToUse)
      .then((result) => {
        setClarification(result);
        setEditedOutcome(result.clarifiedOutcome);
        setAnswers({});
        setCustomAnswers({});
        setSkipCounts({});
      })
      .catch((err: any) => {
        console.error('[OnboardingWizard] Clarification error:', err);
        setClarification(null);
        setClarificationError(err.message || "Couldn't generate your plan right now. AI services are temporarily unavailable. Please retry.");
        setIsWaitingForClarification(false);
      })
      .finally(() => {
        setIsClarifying(false);
      });
  };

  // Automatically trigger AI clarification in the background if a preset goal was selected
  useEffect(() => {
    if (initialDraft) {
      startClarification(initialDraft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------------------------------------------------------------------
  // Step 1: Submit Goal -> Instant 0ms transition to Step 2 (Schedule)
  // --------------------------------------------------------------------------
  const handleStartGoal = (goalText: string) => {
    const textToUse = (goalText || rawGoal).trim();
    if (!textToUse) return;

    setRawGoal(textToUse);
    setEditedOutcome(textToUse);

    // Instant 0ms jump to Schedule while AI starts in background
    goToStep(2);
    startClarification(textToUse);
  };

  // --------------------------------------------------------------------------
  // Step 2: From Schedule -> Advance to Step 3 (Refine Outcome)
  // --------------------------------------------------------------------------
  const handleProceedFromSchedule = () => {
    if (!scheduleChosen) return;
    if (isClarifying) {
      // User finished schedule in <2s while AI is still finishing
      setIsWaitingForClarification(true);
    } else if (clarification) {
      goToStep(3);
    } else if (clarificationError) {
      // If error occurred, retry analysis
      startClarification(rawGoal, true);
      setIsWaitingForClarification(true);
    } else {
      startClarification(rawGoal, true);
      setIsWaitingForClarification(true);
    }
  };

  // Auto-advance to Step 3 as soon as clarification resolves if user is waiting
  useEffect(() => {
    if (isWaitingForClarification && !isClarifying && clarification) {
      setIsWaitingForClarification(false);
      goToStep(3);
    }
  }, [isWaitingForClarification, isClarifying, clarification]);

  // --------------------------------------------------------------------------
  // Step 4: Final Generation Trigger
  // --------------------------------------------------------------------------
  const handleGeneratePlan = async () => {
    if (!scheduleChosen) {
      goToStep(2);
      return;
    }
    if (!allQuestionsResolved) {
      goToStep(3);
      return;
    }
    setStep(5);
    setGenerationError(null);
    setPlanSteps([]);

    try {
      // Merge custom answers
      const finalizedAnswers: Record<string, string> = {};
      questionList.forEach((q) => {
        finalizedAnswers[q.question] = answerFor(q) || 'Skipped';
      });
      const answerList = questionList.map((q) => ({ id: q.id, question: q.question, answer: answerFor(q) || 'Skipped' }));

      const response: CreateGoalResponse = await createGoalPlan(
        {
          rawGoal,
          clarifiedOutcome: editedOutcome || clarification?.clarifiedOutcome || rawGoal,
          answers: finalizedAnswers,
          answerList,
          domain: clarification?.primaryDomain,
          routine
        },
        token,
        (event) => {
          setPlanSteps((prev) => [...prev.filter((step) => step.id !== event.id), event]);
        }
      );

      const fullGoal: Goal = {
        ...response.goal,
        roadmapWeeks: response.roadmapWeeks || response.goal.roadmapWeeks || [],
        dailyTasks: response.dailyTasks || response.goal.dailyTasks || []
      };
      onGoalCreated(fullGoal);
    } catch (err: any) {
      console.error(err);
      setGenerationError(err.message || 'Plan generation failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Interactive Step Navigator */}
      <div className="mb-8 select-none">
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-2.5">
          {WIZARD_STEPS.map((s) => {
            const isCurrent = step === s.id;
            const isCompleted = step > s.id;
            const isClickable = canJumpToStep(s.id) && step !== 5;

            return (
              <button
                key={s.id}
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && goToStep(s.id as 1 | 2 | 3 | 4)}
                className={`group relative text-left p-2 sm:p-3 rounded-xl border transition-all ${
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                } ${
                  isCurrent
                    ? 'bg-[#07CB6C]/10 border-[#07CB6C] shadow-lg shadow-[#07CB6C]/15 ring-1 ring-[#07CB6C]/50'
                    : isCompleted
                    ? 'bg-[#0a120e] border-[#1a2824] hover:border-[#07CB6C]/50 hover:bg-[#0e1a14]'
                    : isClickable
                    ? 'bg-[#080d0b] border-[#1a2824] hover:border-neutral-600 hover:bg-[#0d1511]'
                    : 'bg-[#050807] border-[#121c18]'
                }`}
                title={isClickable ? `Jump to Step ${s.id}: ${s.title}` : `Complete previous steps to unlock Step ${s.id}`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full text-xs font-mono font-bold flex items-center justify-center shrink-0 transition-all ${
                      isCurrent
                        ? 'bg-[#07CB6C] text-black shadow-md shadow-[#07CB6C]/40'
                        : isCompleted
                        ? 'bg-[#07CB6C]/20 border border-[#07CB6C]/40 text-[#07CB6C]'
                        : 'bg-[#121a17] text-neutral-500 border border-[#1a2824]'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : s.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold truncate transition-colors ${
                          isCurrent
                            ? 'text-white font-bold'
                            : isCompleted
                            ? 'text-neutral-200 group-hover:text-white'
                            : 'text-neutral-400'
                        }`}
                      >
                        <span className="hidden sm:inline">{s.title}</span>
                        <span className="sm:hidden">{s.short}</span>
                      </span>
                      {isCompleted && (
                        <span className="text-[9px] font-mono text-[#07CB6C] font-semibold hidden md:inline ml-1">
                          EDIT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-neutral-500 truncate block hidden md:block mt-0.5">
                      {s.subtitle}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Continuous Progress Fill Line */}
        <div className="w-full h-1.5 bg-[#111a17] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#07CB6C]/80 via-[#07CB6C] to-[#10b981] transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, (step / 4) * 100)}%` }}
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* STEP 1: GOAL INPUT */}
      {/* ===================================================================== */}
      {step === 1 && (
        <div className="space-y-6 animate-fadeInUp">
          <div className="space-y-2 text-left">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              What goal do you want to achieve?
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Describe what you want to achieve in the next 90 days. Be as specific as you like.
            </p>
          </div>

          <div className="space-y-4 text-left">
            <textarea
              rows={4}
              placeholder="e.g. Play acoustic guitar well enough to play 5 songs from memory, or Run a 10K under 50 minutes..."
              value={rawGoal}
              onChange={(e) => setRawGoal(e.target.value)}
              className="w-full p-4 rounded-md bg-[#0c1210] border border-[#1a2824] text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C] transition-all resize-none text-sm leading-relaxed"
            />

            {/* 10 Certified Blueprints Quick-Select */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#07CB6C] font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Certified 90-Day Master Pathways (10 Available)</span>
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  1-Click Select
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {CERTIFIED_PATHWAYS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setRawGoal(p.title);
                      handleStartGoal(p.title);
                    }}
                    className="p-2.5 rounded-lg bg-[#0a120e] hover:bg-[#101e17] border border-[#1a2824] hover:border-[#07CB6C]/60 text-left transition-all cursor-pointer group flex items-center gap-3"
                  >
                    <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 border border-[#1a2824] group-hover:border-[#07CB6C]/40 relative bg-[#050807]">
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-mono font-bold text-[#07CB6C] tracking-wider">
                          {p.tag}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          {p.dailyMinutes}m/day
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white group-hover:text-[#07CB6C] transition-colors leading-snug truncate">
                        {p.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 line-clamp-1 leading-relaxed">
                        {p.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={!rawGoal.trim()}
              onClick={() => handleStartGoal(rawGoal)}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-[#07CB6C] hover:bg-[#06b560] disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-semibold text-sm transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: ROUTINE / SCHEDULE CAPTURE (Zero Wait!) */}
      {/* ===================================================================== */}
      {step === 2 && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1a2824]/60">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                When works best for you?
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400">
                We'll schedule deliberate practice sessions around your life so they actually stick.
              </p>
            </div>

            {rawGoal && (
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center flex-wrap">
                {isPresetGoal && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[10px] font-mono font-semibold text-[#07CB6C]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span>Certified Blueprint</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c1410] border border-[#1a2824]">
                  <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
                  <span className="text-xs font-semibold text-white truncate max-w-[180px] sm:max-w-xs">
                    {rawGoal}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="text-[11px] font-mono text-[#07CB6C] hover:underline cursor-pointer pl-1"
                    title="Change goal"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Roadmap Plan Variant Selector */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400 font-medium">
                    How many days per week?
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] font-semibold border border-[#07CB6C]/30">
                    Recommended: 5 days
                  </span>
                </div>
                <span className="text-xs text-[#07CB6C] font-medium">
                  {!routine.planVariant && <span className="text-neutral-500">Choose one</span>}
                  {routine.planVariant === 'minimal' && '4 days / week'}
                  {routine.planVariant === 'steady' && '5 days / week'}
                  {routine.planVariant === 'accelerated' && '6 days / week'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'minimal',
                    title: 'Light',
                    days: '4 days / week',
                    badge: 'Flexible',
                    desc: '4 sessions with 3 rest days. Great if you have a busy schedule.'
                  },
                  {
                    id: 'steady',
                    title: 'Steady',
                    days: '5 days / week',
                    badge: 'Recommended',
                    desc: '5 sessions with 2 rest days. The sweet spot for consistent progress.'
                  },
                  {
                    id: 'accelerated',
                    title: 'Intensive',
                    days: '6 days / week',
                    badge: 'Fast track',
                    desc: '6 sessions with 1 rest day. For when you want to move fast.'
                  }
                ].map((variant) => {
                  const isSelected = routine.planVariant === variant.id;
                  const isRec = variant.id === 'steady';
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() =>
                        setRoutine((prev) => ({
                          ...prev,
                          planVariant: variant.id as any
                        }))
                      }
                      className={`p-3.5 rounded-md border text-left transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#07CB6C]/10 border-[#07CB6C] text-white'
                          : 'bg-[#080d0b] border-[#1a2824] text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{variant.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                            isSelected
                              ? 'bg-[#07CB6C] text-black'
                              : isRec
                              ? 'bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30'
                              : 'bg-[#16221e] text-neutral-400 border border-[#1a2824]'
                          }`}
                        >
                          {variant.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-300 font-mono">{variant.days}</div>
                      <p className="text-[11px] text-neutral-500 leading-snug">{variant.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferred Focus Window */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs text-neutral-400 font-medium">
                  When's your best focus time?
                </label>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] font-semibold border border-[#07CB6C]/30">
                  Recommended: Evening
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'morning', label: 'Morning', icon: Sun, time: '~7:30 AM' },
                  { id: 'afternoon', label: 'Afternoon', icon: Sunset, time: '~2:00 PM' },
                  { id: 'evening', label: 'Evening', icon: Moon, time: '~7:30 PM', badge: 'Recommended' }
                ].map((slot) => {
                  const Icon = slot.icon;
                  const isSelected = routine.preferredSlot === slot.id;
                  const isRec = slot.id === 'evening';
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setCustomPracticeStartMins(null);
                        setRoutine((prev) => ({
                          ...prev,
                          preferredSlot: slot.id as any
                        }));
                      }}
                      className={`p-3 rounded-md border text-center transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#07CB6C]/10 border-[#07CB6C] text-white'
                          : 'bg-[#080d0b] border-[#1a2824] text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-center min-h-[18px] mb-1">
                        {isRec ? (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isSelected
                              ? 'bg-[#07CB6C] text-black'
                              : 'bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30'
                          }`}>
                            Recommended
                          </span>
                        ) : null}
                      </div>
                      <Icon
                        className={`w-5 h-5 mx-auto mb-1.5 ${
                          isSelected ? 'text-[#07CB6C]' : 'text-neutral-400'
                        }`}
                      />
                      <div className="text-xs font-medium">{slot.label}</div>
                      <div className="text-[10px] text-neutral-500">{slot.time}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Commitment Minutes */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-neutral-400 font-medium">
                    How much time per day?
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] font-semibold border border-[#07CB6C]/30">
                    Recommended: 60 min
                  </span>
                </div>
                <span className="text-xs text-[#07CB6C] font-medium">
                  {routine.dailyMinutes > 0
                    ? `${routine.dailyMinutes} min / day`
                    : <span className="text-neutral-500">Choose one</span>}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 90].map((mins) => {
                  const isSelected = routine.dailyMinutes === mins;
                  const isRec = mins === 60;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setRoutine((prev) => ({ ...prev, dailyMinutes: mins }))
                      }
                      className={`py-2 px-2.5 rounded-md border text-xs font-medium transition-all cursor-pointer flex flex-col items-center justify-center ${
                        isSelected
                          ? 'bg-[#07CB6C] text-black font-semibold border-[#07CB6C]'
                          : 'bg-[#080d0b] border-[#1a2824] text-neutral-300 hover:border-neutral-700'
                      }`}
                    >
                      <span className="text-xs">{mins} min</span>
                      {isRec && (
                        <span className={`text-[9px] font-mono ${isSelected ? 'text-black/80 font-bold' : 'text-[#07CB6C] font-semibold'}`}>
                          Recommended
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500">
                {routine.dailyMinutes === 30 && 'Great for building a light baseline habit.'}
                {routine.dailyMinutes === 45 && 'A balanced sweet spot for steady progress.'}
                {routine.dailyMinutes === 60 && 'Enough depth for a full session on a busy workday.'}
                {routine.dailyMinutes >= 90 && 'Intensive immersion — for faster sprints.'}
              </p>
            </div>

            {/* Schedule Bounds */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="mb-1">
                  <label className="block text-neutral-400 font-medium">Wake time</label>
                </div>
                <input
                  type="time"
                  value={routine.wakeTime}
                  onChange={(e) =>
                    setRoutine((prev) => ({ ...prev, wakeTime: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 bg-[#080d0b] border border-[#1a2824] rounded-md text-white focus:outline-none focus:border-[#07CB6C]"
                />
              </div>

              <div>
                <div className="mb-1">
                  <label className="block text-neutral-400 font-medium">Sleep time</label>
                </div>
                <input
                  type="time"
                  value={routine.sleepTime}
                  onChange={(e) =>
                    setRoutine((prev) => ({ ...prev, sleepTime: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 bg-[#080d0b] border border-[#1a2824] rounded-md text-white focus:outline-none focus:border-[#07CB6C]"
                />
              </div>

              <div>
                <div className="mb-1">
                  <label className="block text-neutral-400 font-medium">Busy hours (work/classes)</label>
                </div>
                <input
                  type="text"
                  value={routine.busyHours}
                  onChange={(e) =>
                    setRoutine((prev) => ({ ...prev, busyHours: e.target.value }))
                  }
                  placeholder="e.g. 09:00 - 17:00"
                  className="w-full px-2.5 py-1.5 bg-[#080d0b] border border-[#1a2824] rounded-md text-white focus:outline-none focus:border-[#07CB6C]"
                />
              </div>
            </div>

            {/* Recurring Commitments & 24-Hour Day Balance */}
            <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-white font-semibold flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#07CB6C]" />
                      <span>Recurring Commitments</span>
                    </label>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      (Optional)
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                    Protect your regular gym sessions, commute, or dinners. Practice automatically fits around them.
                  </p>
                </div>

                {routine.commitments && routine.commitments.length > 0 && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#07CB6C]/15 text-[#07CB6C] font-mono font-semibold border border-[#07CB6C]/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{routine.commitments.length} protected</span>
                  </span>
                )}
              </div>

              {/* Quick Routine Toggle Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {PRESET_COMMITMENTS.map((preset) => {
                  const Icon = preset.icon;
                  const activeC = routine.commitments?.find(
                    (c) => c.title.toLowerCase() === preset.title.toLowerCase()
                  );
                  const isAdded = !!activeC;
                  return (
                    <div
                      key={preset.id}
                      className={`inline-flex items-center rounded-full text-xs font-medium transition-all border ${
                        isAdded
                          ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-white shadow-sm shadow-[#07CB6C]/20'
                          : 'bg-[#080d0b] hover:bg-[#14201a] border-[#1a2824] hover:border-neutral-600 text-neutral-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isAdded && activeC) {
                            setEditingCommitment({ item: { ...activeC }, isNew: false });
                          } else {
                            handleTogglePresetCommitment(preset);
                          }
                        }}
                        className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
                        title={isAdded ? `Click to adjust days & times for ${preset.title}` : `Add ${preset.title}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isAdded ? 'text-[#07CB6C]' : 'text-neutral-400'}`} />
                        <span>{preset.title}</span>
                        {isAdded ? (
                          <>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              ({formatDaysLabel(activeC.days)})
                            </span>
                            <span className="w-3.5 h-3.5 rounded-full bg-[#07CB6C] text-black flex items-center justify-center text-[9px] font-bold ml-0.5">
                              ✓
                            </span>
                          </>
                        ) : (
                          <span className="text-neutral-500 text-[11px] ml-0.5">+</span>
                        )}
                      </button>
                      {isAdded && activeC && (
                        <div className="flex items-center pr-1.5 gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCommitment({ item: { ...activeC }, isNew: false });
                            }}
                            className="p-1 text-neutral-400 hover:text-[#07CB6C] cursor-pointer transition-colors"
                            title="Edit days and schedule"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveCommitment(activeC.id);
                            }}
                            className="p-1 text-neutral-400 hover:text-red-400 cursor-pointer transition-colors"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Custom User Added Commitments as Active Pills with Edit and Remove 'X' */}
                {routine.commitments
                  ?.filter(
                    (c) => !PRESET_COMMITMENTS.some((p) => p.title.toLowerCase() === c.title.toLowerCase())
                  )
                  .map((customC) => (
                    <span
                      key={customC.id}
                      className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 bg-[#07CB6C]/15 border border-[#07CB6C] text-white shadow-sm"
                    >
                      <Sparkles className="w-3 h-3 text-[#07CB6C]" />
                      <span>{customC.title}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        ({formatDaysLabel(customC.days)})
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingCommitment({ item: { ...customC }, isNew: false })}
                        className="hover:text-[#07CB6C] text-neutral-400 ml-0.5 cursor-pointer"
                        title="Edit details & days"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCommitment(customC.id)}
                        className="hover:text-red-400 text-neutral-400 ml-0.5 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                {/* Add Custom Button */}
                {!isCustomDrawerOpen && (
                  <button
                    type="button"
                    onClick={() => setIsCustomDrawerOpen(true)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 border border-dashed border-[#1a2824] hover:border-[#07CB6C]/60 bg-[#080d0b] hover:bg-[#121c17] text-neutral-400 hover:text-white transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span>Add Other</span>
                  </button>
                )}
              </div>

              {/* Simple Inline Custom Input (Appears only when "Add Other" is clicked) */}
              {isCustomDrawerOpen && (
                <div className="p-2.5 rounded-md bg-[#080d0b] border border-[#1a2824] flex flex-wrap items-center gap-2 animate-fadeIn">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Routine name (e.g. Boxing, Yoga, Study)..."
                    value={newCommitmentTitle}
                    onChange={(e) => setNewCommitmentTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCommitment();
                      }
                    }}
                    className="flex-1 min-w-[170px] px-3 py-1.5 bg-[#0c1210] border border-[#1a2824] rounded-md text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                  />
                  <input
                    type="text"
                    placeholder="Time: e.g. 19:00 - 20:30 (optional)"
                    value={newCommitmentTime}
                    onChange={(e) => setNewCommitmentTime(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomCommitment();
                      }
                    }}
                    className="w-44 px-3 py-1.5 bg-[#0c1210] border border-[#1a2824] rounded-md text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomCommitment}
                    disabled={!newCommitmentTitle.trim()}
                    className="px-3 py-1.5 bg-[#07CB6C] hover:bg-[#06b560] disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-semibold text-xs rounded-md transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomDrawerOpen(false);
                      setNewCommitmentTitle('');
                      setNewCommitmentTime('');
                    }}
                    className="p-1 text-neutral-400 hover:text-white cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Visual 24-Hour Day Balance Map (Magical Mirror) */}
              <div className="pt-2 border-t border-[#1a2824]/60 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span className="text-xs font-semibold text-white">
                      Your 24-Hour Day Balance Map
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2.5 py-0.5 rounded-full border border-[#07CB6C]/30 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                      <span>
                        {routine.dailyMinutes > 0
                          ? `Practice: ${daySchedule.practiceTimeLabel} (${routine.dailyMinutes}m)`
                          : 'Practice: choose your time per day'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/90 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-800/40 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>
                        Free Buffer: ~{freeTimeDisplay}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 24-Hour Visual Bar */}
                <div className="space-y-1.5">
                  <div
                    ref={timelineRef}
                    onClick={handleTimelineClick}
                    className="h-10 w-full bg-[#040706] border border-[#1a2824] rounded-lg relative flex items-center shadow-inner select-none cursor-pointer"
                    title="Click anywhere on the timeline to place Practice session"
                  >
                    {/* Hour ticks */}
                    <div className="absolute inset-0 flex justify-between px-2 pointer-events-none opacity-20 overflow-hidden rounded-lg">
                      <div className="w-px h-full bg-neutral-500" />
                      <div className="w-px h-full bg-neutral-500" />
                      <div className="w-px h-full bg-neutral-500" />
                      <div className="w-px h-full bg-neutral-500" />
                      <div className="w-px h-full bg-neutral-500" />
                    </div>

                    {/* Non-overlapping blocks that dynamically make space for each other */}
                    {daySchedule.allBlocks.map((b) => {
                      const isPractice = b.isPractice;
                      if (isPractice && !routine.dailyMinutes) return null;
                      const isDraggingPractice = isPractice && !!activePracticeDrag;

                      const startMins = isDraggingPractice
                        ? activePracticeDrag.currentStartMins
                        : b.startMins;
                      const endMins = isDraggingPractice
                        ? activePracticeDrag.currentStartMins + b.durationMins
                        : b.endMins;
                      const durationMins = b.durationMins;
                      const timeLabel = `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(endMins)}`;

                      const leftPct = (startMins / 1440) * 100;
                      const widthPct = Math.max(2.6, (durationMins / 1440) * 100);
                      const BlockIcon = b.icon;

                      return (
                        <div
                          key={b.id}
                          data-no-track-jump="true"
                          onPointerDown={isPractice ? (e) => handlePracticePointerDown(e, b) : undefined}
                          onPointerMove={isPractice ? handlePracticePointerMove : undefined}
                          onPointerUp={isPractice ? handlePracticePointerUp : undefined}
                          onPointerCancel={isPractice ? handlePracticePointerUp : undefined}
                          onClick={() => {
                            if (b.type === 'commitment') {
                              const found = (routine.commitments || []).find((c) => c.id === b.id);
                              if (found) setEditingCommitment({ item: { ...found }, isNew: false });
                            }
                          }}
                          className={`absolute top-0.5 bottom-0.5 ${
                            isPractice
                              ? 'bg-[#07CB6C] text-black font-bold z-20 border border-white/70 shadow-lg shadow-[#07CB6C]/30 cursor-grab active:cursor-grabbing touch-none select-none'
                              : b.type === 'commitment'
                              ? `${b.bg} border ${b.border} ring-1 ring-[#040706] text-[9px] ${b.color} font-mono z-10 cursor-pointer hover:brightness-125 hover:scale-[1.02] transition-all`
                              : `${b.bg} border ${b.border} ring-1 ring-[#040706] text-[9px] ${b.color} font-mono z-10 cursor-default select-none`
                          } rounded-md flex items-center justify-center overflow-visible shadow-sm ${
                            isDraggingPractice
                              ? 'shadow-2xl shadow-[#07CB6C]/70 ring-2 ring-white z-40 scale-[1.02]'
                              : ''
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            transition: isDraggingPractice
                              ? 'none'
                              : 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s ease'
                          }}
                          title={
                            isPractice
                              ? `🎯 Achivii Practice (${timeLabel}) — Drag along timeline to set time`
                              : b.type === 'commitment'
                              ? `${b.title} (${timeLabel}${b.days ? ` • ${formatDaysLabel(b.days)}` : ''}) — Click to customize schedule`
                              : `${b.title} (${timeLabel})`
                          }
                        >
                          {/* Floating Real-time Drag Tooltip for Practice */}
                          {isDraggingPractice && (
                            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#07CB6C] text-black font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xl shadow-[#07CB6C]/60 border border-white whitespace-nowrap pointer-events-none z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-75">
                              <Target className="w-3 h-3 text-black" />
                              <span>
                                Practice: {formatMinutesTo12h(startMins)} – {formatMinutesTo12h(endMins)}
                              </span>
                              <span className="opacity-80 font-mono font-normal">({durationMins}m)</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1 truncate px-2 pointer-events-none select-none">
                            {isPractice ? (
                              <>
                                <GripVertical className="w-2.5 h-2.5 text-black/70 shrink-0" />
                                <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse shrink-0" />
                                <span className="truncate font-bold text-black text-[10px]">Practice</span>
                              </>
                            ) : (
                              <>
                                {BlockIcon && <BlockIcon className="w-2.5 h-2.5 shrink-0 opacity-85" />}
                                <span className="truncate font-medium text-[9px]">{b.title}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Time scale tick labels */}
                  <div className="flex justify-between text-[10px] text-neutral-500 font-mono px-0.5">
                    <span>12 AM</span>
                    <span>6 AM</span>
                    <span>12 PM</span>
                    <span>6 PM</span>
                    <span>12 AM</span>
                  </div>
                </div>

                {/* Legend & Interactive Reposition Hint */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400 pt-0.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>Sleep</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-neutral-600" />
                      <span>Work/Study</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Commitments</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium text-white">
                      <span className="w-2 h-2 rounded-full bg-[#07CB6C] animate-pulse" />
                      <span className="text-[#07CB6C]">Practice Slot</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2.5 py-0.5 rounded border border-[#07CB6C]/20">
                    <GripVertical className="w-3 h-3 text-[#07CB6C]" />
                    <span>Drag Practice to set time • Tap any routine to edit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Background Clarification Error (if any) */}
          {clarificationError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/80 text-red-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-red-950/20 animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-medium">{clarificationError}</span>
              </div>
              <button
                type="button"
                onClick={() => startClarification(rawGoal, true)}
                className="px-3.5 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-lg font-semibold text-xs cursor-pointer shrink-0 transition-colors shadow"
              >
                Retry Analysis
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Goal</span>
            </button>

            <div className="flex items-center gap-3">
              {!scheduleChosen && (
                <span className="text-[11px] text-neutral-500">
                  Choose your days per week and time per day
                </span>
              )}
              <button
                type="button"
                disabled={!scheduleChosen || (isClarifying && isWaitingForClarification)}
                onClick={handleProceedFromSchedule}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] disabled:bg-[#07CB6C]/50 disabled:cursor-not-allowed text-black font-semibold text-sm transition-all cursor-pointer"
              >
                {isClarifying && isWaitingForClarification ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                    <span>Personalizing your path...</span>
                  </>
                ) : (
                  <>
                    <span>Next: Quick Questions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: DOMAIN CLARIFYING QUESTIONS (DIAGNOSTIC QUIZ) */}
      {/* ===================================================================== */}
      {step === 3 && clarification && (() => {
        const questions = questionList;
        const totalQuestions = questions.length;
        const safeIdx = Math.min(Math.max(0, activeQuestionIndex), totalQuestions - 1);
        const currentQ = questions[safeIdx];
        const currentShown = currentQ ? shownQuestion(currentQ) : null;
        const currentSkips = currentQ ? skipCounts[currentQ.id] || 0 : 0;

        const firstUnresolved = (exceptId?: string) =>
          questions.findIndex((q) => q.id !== exceptId && !isResolved(q));

        const moveOn = (fromIdx: number, justResolvedId?: string) => {
          if (fromIdx < totalQuestions - 1) {
            setActiveQuestionIndex(fromIdx + 1);
            return;
          }
          const pending = firstUnresolved(justResolvedId);
          if (pending >= 0) {
            setActiveQuestionIndex(pending);
            return;
          }
          setIsQuestionModalOpen(false);
          goToStep(4);
        };

        const skipCurrent = () => {
          if (!currentQ) return;
          setAnswers((prev) => {
            const next = { ...prev };
            delete next[currentQ.id];
            return next;
          });
          setCustomAnswers((prev) => ({ ...prev, [currentQ.id]: '' }));
          if (currentSkips === 0) {
            setSkipCounts((prev) => ({ ...prev, [currentQ.id]: 1 }));
            return;
          }
          setSkipCounts((prev) => ({ ...prev, [currentQ.id]: 2 }));
          moveOn(safeIdx, currentQ.id);
        };

        const goToSummary = () => {
          const pending = firstUnresolved();
          if (pending >= 0) {
            setActiveQuestionIndex(pending);
            setIsQuestionModalOpen(true);
            return;
          }
          goToStep(4);
        };

        return (
          <div className="space-y-6 text-left animate-fadeInUp">
            {/* Ambient Step 3 Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/25 text-[#07CB6C] text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Step 3 • Diagnostic Calibration</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Personalizing your 90-day roadmap
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400">
                  Calibrate your starting baseline, gear, and focus so your daily sessions fit you perfectly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(true)}
                className="self-start sm:self-center px-4 py-2 rounded-xl bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#07CB6C]/20 transition-all cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                <span>Open Question Quiz</span>
              </button>
            </div>

            {/* Question Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              {questions.map((q, idx) => {
                const isCurrent = idx === safeIdx;
                const answer = answerFor(q);
                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setActiveQuestionIndex(idx);
                      setIsQuestionModalOpen(true);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-2.5 group relative overflow-hidden ${
                      isCurrent
                        ? 'bg-[#07CB6C]/10 border-[#07CB6C] shadow-lg shadow-[#07CB6C]/10 scale-[1.01]'
                        : 'bg-[#0c1210] border-[#1a2824] hover:border-neutral-600 hover:bg-[#111a17]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center border ${
                        isCurrent
                          ? 'bg-[#07CB6C] text-black border-[#07CB6C]'
                          : 'bg-[#16241f] border-[#07CB6C]/30 text-[#07CB6C]'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400 group-hover:text-[#07CB6C] flex items-center gap-1 transition-colors">
                        <span>Edit</span>
                        <Edit3 className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                      {shownQuestion(q).question}
                    </div>

                    <div
                      className={`text-xs font-medium bg-[#040706] p-2 rounded-lg border border-[#1a2824] truncate ${
                        answer ? 'text-[#07CB6C]' : 'text-neutral-500'
                      }`}
                    >
                      {answer ? `✓ ${answer}` : isSkipped(q) ? 'Skipped' : 'Not answered yet'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step 3 Base Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1a2824]">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Schedule</span>
              </button>

              <button
                type="button"
                onClick={goToSummary}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg shadow-[#07CB6C]/25"
              >
                <span>{allQuestionsResolved ? 'Next: Review Your Plan' : 'Answer the Remaining Questions'}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* ================================================================= */}
            {/* DEDICATED VISUALLY APPEALING QUESTION MODAL (QUIZ) */}
            {/* ================================================================= */}
            {isQuestionModalOpen && currentQ && (
              <div
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
                onClick={() => setIsQuestionModalOpen(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-xl bg-[#080d0b] border border-[#1a2824] rounded-2xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl shadow-black/95 space-y-5 animate-in zoom-in-95 duration-200 overflow-hidden"
                >
                  {/* Ambient Light Beam */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#07CB6C] to-transparent opacity-80" />
                  <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-[#07CB6C]/10 blur-3xl pointer-events-none rounded-full" />

                  {/* Modal Header */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1a2824]">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#07CB6C]/15 border border-[#07CB6C]/30 text-[#07CB6C]">
                        <Sparkles className="w-3 h-3 text-[#07CB6C]" />
                        <span>{clarification.primaryDomain || 'Diagnostic Calibration'}</span>
                      </span>
                      <span className="text-xs font-mono text-neutral-400">
                        Question <strong className="text-white">{safeIdx + 1}</strong> of {totalQuestions}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsQuestionModalOpen(false)}
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer"
                      title="Close quiz view"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Segmented Glowing Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {questions.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveQuestionIndex(idx)}
                          className={`h-2 flex-1 rounded-full transition-all cursor-pointer ${
                            idx < safeIdx
                              ? 'bg-[#07CB6C]'
                              : idx === safeIdx
                              ? 'bg-[#07CB6C] shadow-[0_0_12px_#07CB6C]'
                              : 'bg-[#15221d] hover:bg-[#1e332b]'
                          }`}
                          title={`Go to Question ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Question Content (Single Question Focus) */}
                  <div key={currentQ.id} className="space-y-4 pt-1 animate-in fade-in duration-200">
                    <div className="space-y-1 text-left">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#07CB6C]/20 border border-[#07CB6C]/40 text-[#07CB6C] text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {safeIdx + 1}
                        </span>
                        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
                          {currentShown?.question}
                        </h3>
                      </div>
                      {currentShown?.subtitle && (
                        <p className="text-xs sm:text-sm text-neutral-400 pl-8 leading-relaxed">
                          {currentShown.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Option Cards Stack */}
                    <div className="space-y-2.5 pt-1">
                      {currentQ.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isSelected = answers[currentQ.id] === opt && !customAnswers[currentQ.id];
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              setAnswers((prev) => ({ ...prev, [currentQ.id]: opt }));
                              setCustomAnswers((prev) => ({ ...prev, [currentQ.id]: '' }));
                            }}
                            className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between cursor-pointer group ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#07CB6C]/15 via-[#07CB6C]/5 to-transparent border-[#07CB6C] text-white shadow-lg shadow-[#07CB6C]/10 scale-[1.01]'
                                : 'bg-[#040706] border-[#1a2824] text-neutral-300 hover:border-neutral-600 hover:bg-[#0c1411]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all shrink-0 ${
                                  isSelected
                                    ? 'bg-[#07CB6C] text-black font-extrabold shadow-sm shadow-[#07CB6C]/40'
                                    : 'bg-[#0c1310] border border-[#1a2824] text-neutral-400 group-hover:text-white group-hover:border-neutral-500'
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="text-xs sm:text-sm font-medium leading-relaxed">{opt}</span>
                            </div>
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-[#07CB6C] flex items-center justify-center shrink-0 ml-2 shadow-sm shadow-[#07CB6C]/50 animate-in zoom-in-75">
                                <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-neutral-700 group-hover:border-neutral-500 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}

                      {/* Custom Input */}
                      {currentQ.allowCustom && (
                        <div className="pt-1">
                          <div
                            className={`p-3 rounded-xl border transition-all ${
                              customAnswers[currentQ.id]?.trim()
                                ? 'border-[#07CB6C] bg-[#07CB6C]/5 shadow-sm shadow-[#07CB6C]/10'
                                : 'border-[#1a2824] bg-[#040706]'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5 text-[11px] font-semibold text-neutral-400">
                              <Edit3 className={`w-3.5 h-3.5 ${customAnswers[currentQ.id]?.trim() ? 'text-[#07CB6C]' : 'text-neutral-500'}`} />
                              <span>Or type your custom answer:</span>
                            </div>
                            <input
                              type="text"
                              placeholder="Describe your specific situation..."
                              value={customAnswers[currentQ.id] || ''}
                              onChange={(e) => {
                                setCustomAnswers((prev) => ({ ...prev, [currentQ.id]: e.target.value }));
                              }}
                              className="w-full px-3 py-2 text-xs sm:text-sm bg-[#080d0b] border border-[#1a2824] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-all"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-[11px] text-neutral-500">
                          {isSkipped(currentQ)
                            ? "Skipped. We'll plan from a safe starting point."
                            : ''}
                        </span>
                        {!answerFor(currentQ) && !isSkipped(currentQ) && (
                          <button
                            type="button"
                            onClick={skipCurrent}
                            className="text-xs text-neutral-400 hover:text-white underline underline-offset-2 cursor-pointer transition-colors"
                          >
                            {currentSkips === 0 ? 'Skip this' : 'Skip anyway'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#1a2824] gap-2">
                    {safeIdx > 0 ? (
                      <button
                        type="button"
                        onClick={() => setActiveQuestionIndex((prev) => prev - 1)}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsQuestionModalOpen(false);
                          goToStep(2);
                        }}
                        className="px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Schedule</span>
                      </button>
                    )}

                    {/* Stepper Dots */}
                    <div className="flex items-center gap-1.5">
                      {questions.map((qItem, idx) => {
                        const isCurrent = idx === safeIdx;
                        const hasAnswer = isResolved(qItem);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveQuestionIndex(idx)}
                            className={`w-7 h-7 rounded-full text-[11px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer border ${
                              isCurrent
                                ? 'bg-[#07CB6C] text-black border-[#07CB6C] shadow-md shadow-[#07CB6C]/30 scale-110'
                                : hasAnswer
                                ? 'bg-[#07CB6C]/15 border-[#07CB6C]/40 text-[#07CB6C] hover:bg-[#07CB6C]/25'
                                : 'bg-[#040706] border-[#1a2824] text-neutral-500 hover:text-neutral-300'
                            }`}
                            title={`Question ${idx + 1}`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Next / Finish Button */}
                    <button
                      type="button"
                      disabled={!isResolved(currentQ)}
                      onClick={() => moveOn(safeIdx)}
                      className="px-5 py-2.5 rounded-xl bg-[#07CB6C] hover:bg-[#06b560] disabled:bg-[#07CB6C]/40 disabled:cursor-not-allowed text-black font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#07CB6C]/20 transition-all ml-auto"
                    >
                      <span>
                        {safeIdx < totalQuestions - 1 || firstUnresolved(currentQ.id) >= 0
                          ? 'Next Question'
                          : 'Review Your Plan'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ===================================================================== */}
      {/* STEP 4: WHAT SUCCESS LOOKS LIKE / FINAL CONFIRMATION */}
      {/* ===================================================================== */}
      {step === 4 && clarification && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {isPresetGoal && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#07CB6C]/15 border border-[#07CB6C]/30 text-[#07CB6C] text-[11px] font-mono font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Certified Master Blueprint</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/25 text-[#07CB6C] text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{clarification.primaryDomain}</span>
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white pt-1">
              What success looks like in 90 days
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Review your goal, answers, and schedule before we build your plan.
            </p>
          </div>

          {/* Outcome Card */}
          <div className="p-5 rounded-md bg-[#0c1210] border border-[#07CB6C]/30 space-y-3 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-[#07CB6C] tracking-wider">
                Clarified Target Outcome
              </span>
              <button
                type="button"
                onClick={() => setIsEditingOutcome(!isEditingOutcome)}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingOutcome ? 'Done' : 'Edit Outcome'}</span>
              </button>
            </div>

            {isEditingOutcome ? (
              <textarea
                value={editedOutcome}
                onChange={(e) => setEditedOutcome(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[#080d0b] border border-[#1a2824] rounded-md text-white text-sm focus:outline-none focus:border-[#07CB6C]"
              />
            ) : (
              <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                "{editedOutcome}"
              </p>
            )}
          </div>

          {/* Personalized Schedule & Routine Confirmation Card */}
          <div className="p-4 rounded-md bg-[#090e0c] border border-[#1a2824] space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Your Personalized Practice Protocol</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2 py-0.5 rounded border border-[#07CB6C]/30">
                  100% Conflict Free
                </span>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-[11px] text-neutral-400 hover:text-[#07CB6C] transition-colors cursor-pointer"
                >
                  Edit Schedule
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-[#0c1210] border border-[#1a2824]">
                <div className="text-[10px] text-neutral-500 font-mono">TRACK PACING</div>
                <div className="text-white font-medium capitalize mt-0.5">
                  {routine.planVariant === 'minimal' ? '4 days / wk' : routine.planVariant === 'accelerated' ? '6 days / wk' : '5 days / wk'}
                </div>
              </div>
              <div className="p-2 rounded bg-[#0c1210] border border-[#1a2824]">
                <div className="text-[10px] text-neutral-500 font-mono">FOCUS WINDOW</div>
                <div className="text-[#07CB6C] font-medium capitalize mt-0.5">
                  {daySchedule.practiceTimeLabel}
                </div>
              </div>
              <div className="p-2 rounded bg-[#0c1210] border border-[#1a2824]">
                <div className="text-[10px] text-neutral-500 font-mono">DAILY SESSION</div>
                <div className="text-white font-medium mt-0.5">
                  {routine.dailyMinutes} minutes
                </div>
              </div>
              <div className="p-2 rounded bg-[#0c1210] border border-[#1a2824]">
                <div className="text-[10px] text-neutral-500 font-mono">PROTECTED BLOCKS</div>
                <div className="text-neutral-300 font-medium truncate mt-0.5">
                  {routine.commitments && routine.commitments.length > 0
                    ? `${routine.commitments.length} routines`
                    : 'Work & Sleep'}
                </div>
              </div>
            </div>
            {routine.commitments && routine.commitments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {routine.commitments.map((c) => (
                  <span
                    key={c.id}
                    className="text-[10px] px-2 py-0.5 rounded bg-[#080d0b] border border-[#1a2824] text-neutral-300 font-mono flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                    <span>{c.title}</span>
                    {c.time && <span className="text-neutral-500">({c.time.split(',')[0]})</span>}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Calibrated Diagnostics Summary */}
          {clarification.followUpQuestions && clarification.followUpQuestions.length > 0 && (
            <div className="p-4 rounded-md bg-[#090e0c] border border-[#1a2824] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#07CB6C]" />
                  <span>Calibrated For Your Profile</span>
                </span>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="text-[11px] text-neutral-400 hover:text-[#07CB6C] transition-colors cursor-pointer"
                >
                  Edit Answers
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {questionList.map((q) => {
                  const answer = answerFor(q);
                  return (
                    <div key={q.id} className="p-2.5 rounded bg-[#0c1210] border border-[#1a2824] text-xs space-y-0.5">
                      <div className="text-[10px] text-neutral-500 font-mono truncate">{q.question}</div>
                      <div className={`font-medium truncate ${answer ? 'text-[#07CB6C]' : 'text-neutral-500'}`}>
                        {answer || 'Skipped'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* THE ACHIVII TRIAD: CERTIFIED GROUNDING (SCIENCE x ADHERENCE x SAFETY) */}
          {/* =================================================================== */}
          {clarification.evidenceTriad && (() => {
            const activeTriad = clarification.evidenceTriad;

            return (
              <div className="p-4 sm:p-5 rounded-md bg-[#090e0c] border border-[#1a2824] space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a2824]/70 pb-3">
                  <div className="space-y-0.5 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#07CB6C] bg-[#07CB6C]/10 border border-[#07CB6C]/25 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        The Achivii Triad
                      </span>
                      <span className="text-[11px] text-neutral-400 font-medium">3-Pillar Balanced Engine</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white pt-0.5">
                      Built for Real Lives, Not Academic Lab Rats
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Why generic roadmaps fail: they push lab theory until busy schedules break or injuries strike. Achivii balances all three filters.
                    </p>
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono shrink-0 sm:text-right">
                    Mechanism × Adherence × Craft
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
                  {/* Pillar 1: Laboratory Science */}
                  <div className="p-3.5 rounded bg-[#0c1210] border border-[#1a2824] hover:border-[#07CB6C]/40 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20 font-semibold">
                        {activeTriad.science.tag || 'LAB SCIENCE'}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-[#07CB6C]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{activeTriad.science.title}</h4>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{activeTriad.science.subtitle}</div>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {activeTriad.science.coreRule}
                    </p>
                    <div className="pt-2 border-t border-[#1a2824]/60 text-[11px] text-neutral-400">
                      <span className="text-[#07CB6C] font-mono text-[9px] uppercase tracking-wider block mb-0.5 font-semibold">
                        In Your Roadmap
                      </span>
                      <span className="text-neutral-300">{activeTriad.science.realWorldApplication}</span>
                    </div>
                  </div>

                  {/* Pillar 2: Social Reality (Adherence) */}
                  <div className="p-3.5 rounded bg-[#0c1210] border border-[#1a2824] hover:border-sky-500/40 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                        {activeTriad.socialAdherence.tag || 'REAL-WORLD ADHERENCE'}
                      </span>
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{activeTriad.socialAdherence.title}</h4>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{activeTriad.socialAdherence.subtitle}</div>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {activeTriad.socialAdherence.coreRule}
                    </p>
                    <div className="pt-2 border-t border-[#1a2824]/60 text-[11px] text-neutral-400">
                      <span className="text-sky-400 font-mono text-[9px] uppercase tracking-wider block mb-0.5 font-semibold">
                        In Your Roadmap
                      </span>
                      <span className="text-neutral-300">{activeTriad.socialAdherence.realWorldApplication}</span>
                    </div>
                  </div>

                  {/* Pillar 3: Professional Coaching (Safety & Craft) */}
                  <div className="p-3.5 rounded bg-[#0c1210] border border-[#1a2824] hover:border-amber-500/40 transition-colors space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        {activeTriad.proCoaching.tag || 'PRO COACH CRAFT'}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{activeTriad.proCoaching.title}</h4>
                      <div className="text-[10px] text-neutral-400 font-mono mt-0.5 truncate">{activeTriad.proCoaching.subtitle}</div>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                      {activeTriad.proCoaching.coreRule}
                    </p>
                    <div className="pt-2 border-t border-[#1a2824]/60 text-[11px] text-neutral-400">
                      <span className="text-amber-400 font-mono text-[9px] uppercase tracking-wider block mb-0.5 font-semibold">
                        In Your Roadmap
                      </span>
                      <span className="text-neutral-300">{activeTriad.proCoaching.realWorldApplication}</span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#0c1210] border border-[#1a2824] flex items-start sm:items-center gap-2 text-[11px] text-neutral-400 text-left">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] shrink-0 mt-1 sm:mt-0" />
                  <p>
                    <strong className="text-neutral-200 font-semibold">Conflict Resolution Protocol:</strong> When lab volume fights your schedule, adherence wins (35–45m max sessions). Professional safety strictly overrides both at all times.
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Questions</span>
            </button>

            <button
              type="button"
              onClick={handleGeneratePlan}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-sm transition-all cursor-pointer shadow-md shadow-[#07CB6C]/20 hover:scale-[1.01]"
            >
              <span>Generate 90-Day Blueprint</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: PLAN GENERATION / LOADING */}
      {/* ===================================================================== */}
      {step === 5 && (
        <div className="py-16 text-center space-y-6 animate-fadeInUp">
          {generationError ? (
            <div className="max-w-md mx-auto space-y-6 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-950/50 border border-red-800 flex items-center justify-center text-red-400 shadow-xl shadow-red-950/30">
                <AlertCircle className="w-8 h-8 text-red-400 stroke-[2]" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Couldn't generate your plan right now
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Both AI providers were temporarily unavailable to assemble your custom blueprint. No degraded or generic plan was created.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs text-left font-mono">
                {generationError}
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Review Inputs
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  className="px-5 py-2 bg-[#07CB6C] hover:bg-[#06b560] text-black rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg shadow-[#07CB6C]/20"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#07CB6C]/20 border-t-[#07CB6C] animate-spin" />
                <Target className="w-8 h-8 text-[#07CB6C] animate-pulse" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Building your plan...
                </h2>
                <ol className="max-w-md mx-auto text-left space-y-2 pt-2">
                  {PLAN_STEPS.map((item, index) => {
                    const seen = planSteps.find((step) => step.id === item.id);
                    const active = planSteps[planSteps.length - 1]?.id === item.id;
                    const done = Boolean(seen) && !active;
                    return (
                      <li
                        key={item.id}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-2 ${
                          active
                            ? 'border-[#07CB6C]/50 bg-[#07CB6C]/10'
                            : done
                            ? 'border-[#1a2824] bg-[#0a120e]'
                            : 'border-[#121c18] bg-[#050807] opacity-60'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          done || active ? 'bg-[#07CB6C] text-black' : 'bg-[#121a17] text-neutral-500'
                        }`}>
                          {done ? <Check className="h-3 w-3" /> : index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className={`block text-sm ${active ? 'text-white' : 'text-neutral-300'}`}>
                            {seen?.label || item.pending}
                          </span>
                          {seen?.detail && (
                            <span className="block text-[11px] text-neutral-500">{seen.detail}</span>
                          )}
                          {active && seen?.slow && (
                            <span className="block text-[11px] text-amber-300">
                              This is taking longer than usual. Still working ({Math.round(seen.elapsedMs / 1000)}s).
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* DETAILED COMMITMENT & RECURRENCE EDITOR MODAL */}
      {/* ===================================================================== */}
      {editingCommitment && (() => {
        const activeEditingC = editingCommitment.item;
        const isNew = editingCommitment.isNew;
        const catDetails = getCategoryDetails(activeEditingC.category);
        const CatIcon = catDetails.icon || Sparkles;

        let startMins = 1080;
        let endMins = 1140;
        if (activeEditingC.time && activeEditingC.time.includes('-')) {
          const parts = activeEditingC.time.split(',')[0].split('-');
          const s = parseTimeToMinutes(parts[0]?.trim() || '', 1080);
          const e = parseTimeToMinutes(parts[1]?.trim() || '', s + 60);
          if (e > s) {
            startMins = s;
            endMins = e;
          }
        } else if (!isNew) {
          const placedInfo = daySchedule.placedCommitmentsMap[activeEditingC.id];
          if (placedInfo) {
            startMins = placedInfo.startMins;
            endMins = placedInfo.endMins;
          }
        }
        const durationMins = endMins - startMins;

        const ALL_DAYS: Array<{ key: string; short: string; full: string }> = [
          { key: 'Mon', short: 'M', full: 'Monday' },
          { key: 'Tue', short: 'T', full: 'Tuesday' },
          { key: 'Wed', short: 'W', full: 'Wednesday' },
          { key: 'Thu', short: 'T', full: 'Thursday' },
          { key: 'Fri', short: 'F', full: 'Friday' },
          { key: 'Sat', short: 'S', full: 'Saturday' },
          { key: 'Sun', short: 'S', full: 'Sunday' }
        ];

        const activeDays =
          activeEditingC.days && activeEditingC.days.length > 0
            ? activeEditingC.days
            : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

        const isWeekdays =
          activeDays.length === 5 &&
          ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].every((d) => activeDays.includes(d));
        const isWeekends =
          activeDays.length === 2 &&
          ['Sat', 'Sun'].every((d) => activeDays.includes(d));
        const isEveryday = activeDays.length === 7;

        const handleSetDays = (days: string[]) => {
          setEditingCommitment((prev) =>
            prev ? { ...prev, item: { ...prev.item, days } } : null
          );
        };

        const handleToggleSingleDay = (dayKey: string) => {
          let updated: string[];
          if (activeDays.includes(dayKey)) {
            if (activeDays.length <= 1) return;
            updated = activeDays.filter((d) => d !== dayKey);
          } else {
            updated = [...activeDays, dayKey];
          }
          updated.sort(
            (a, b) =>
              ALL_DAYS.findIndex((item) => item.key === a) -
              ALL_DAYS.findIndex((item) => item.key === b)
          );
          handleSetDays(updated);
        };

        const handleAdjustStart = (delta: number) => {
          const newStart = Math.max(0, Math.min(endMins - 15, startMins + delta));
          const newTime = `${formatMinutesTo24h(newStart)} - ${formatMinutesTo24h(endMins)}`;
          setEditingCommitment((prev) =>
            prev ? { ...prev, item: { ...prev.item, time: newTime } } : null
          );
        };

        const handleAdjustEnd = (delta: number) => {
          const newEnd = Math.min(1440, Math.max(startMins + 15, endMins + delta));
          const newTime = `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(newEnd)}`;
          setEditingCommitment((prev) =>
            prev ? { ...prev, item: { ...prev.item, time: newTime } } : null
          );
        };

        const handleUpdateTitle = (newTitle: string) => {
          setEditingCommitment((prev) =>
            prev ? { ...prev, item: { ...prev.item, title: newTitle } } : null
          );
        };

        const handleDelete = () => {
          if (!isNew) {
            handleRemoveCommitment(activeEditingC.id);
          }
          setEditingCommitment(null);
        };

        const handleClose = () => {
          // Closes without saving to routine.commitments (if new, discarded without adding to calendar)
          setEditingCommitment(null);
        };

        const handleSave = () => {
          const finalItem: CommitmentItem = {
            ...activeEditingC,
            time: `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(endMins)}`,
            days: activeDays
          };
          if (isNew) {
            setRoutine((prev) => ({
              ...prev,
              commitments: [...(prev.commitments || []), finalItem]
            }));
          } else {
            setRoutine((prev) => ({
              ...prev,
              commitments: (prev.commitments || []).map((c) =>
                c.id === finalItem.id ? finalItem : c
              )
            }));
          }
          setEditingCommitment(null);
        };

        const formatDurLabel = (m: number) => {
          const hrs = Math.floor(m / 60);
          const mins = m % 60;
          if (hrs === 0) return `${mins}m`;
          if (mins === 0) return `${hrs}h`;
          return `${hrs}h ${mins}m`;
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={handleClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#080d0b] border border-[#1a2824] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#1a2824]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${catDetails.bg} ${catDetails.border} border shrink-0`}>
                    <CatIcon className={`w-5 h-5 ${catDetails.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      {isNew ? 'New Routine / Commitment' : 'Routine / Commitment'}
                    </label>
                    <input
                      type="text"
                      value={activeEditingC.title}
                      onChange={(e) => handleUpdateTitle(e.target.value)}
                      className="w-full bg-transparent font-bold text-white text-base focus:outline-none focus:border-b focus:border-[#07CB6C] pb-0.5 placeholder-neutral-500"
                      placeholder="Commitment name..."
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Set the days and hours for this routine so Achivii protects your goal time.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer shrink-0"
                  title="Cancel and close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recurrence: Days of the Week */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span className="text-xs font-semibold text-white">Active Days</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#07CB6C] font-medium">
                    {formatDaysLabel(activeDays)}
                  </span>
                </div>

                {/* Preset shortcuts */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer text-center ${
                      isWeekdays
                        ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-[#07CB6C] font-semibold shadow-sm'
                        : 'bg-[#040706] border-[#1a2824] text-neutral-400 hover:text-white hover:border-neutral-600'
                    }`}
                  >
                    Weekdays (M-F)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetDays(['Sat', 'Sun'])}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer text-center ${
                      isWeekends
                        ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-[#07CB6C] font-semibold shadow-sm'
                        : 'bg-[#040706] border-[#1a2824] text-neutral-400 hover:text-white hover:border-neutral-600'
                    }`}
                  >
                    Weekends (S-S)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer text-center ${
                      isEveryday
                        ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-[#07CB6C] font-semibold shadow-sm'
                        : 'bg-[#040706] border-[#1a2824] text-neutral-400 hover:text-white hover:border-neutral-600'
                    }`}
                  >
                    Every day
                  </button>
                </div>

                {/* 7 Day of Week Circles */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {ALL_DAYS.map((d) => {
                    const isSelected = activeDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => handleToggleSingleDay(d.key)}
                        title={d.full}
                        className={`w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[#07CB6C] text-black border-[#07CB6C] shadow-md shadow-[#07CB6C]/25 scale-105'
                            : 'bg-[#040706] border-[#1a2824] text-neutral-400 hover:text-white hover:border-neutral-600'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Window & Duration Stepper */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span className="text-xs font-semibold text-white">Time Window & Duration</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-white bg-neutral-800 px-2 py-0.5 rounded">
                    {formatDurLabel(durationMins)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Start Time Stepper */}
                  <div className="bg-[#040706] border border-[#1a2824] rounded-xl p-3 space-y-2">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Starts At
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold font-mono text-white">
                        {formatMinutesTo12h(startMins)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustStart(-15)}
                          disabled={startMins <= 0}
                          className="px-2 py-1 text-[11px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-md text-white cursor-pointer transition-colors"
                          title="15 minutes earlier"
                        >
                          -15m
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustStart(15)}
                          disabled={startMins >= endMins - 15}
                          className="px-2 py-1 text-[11px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-md text-white cursor-pointer transition-colors"
                          title="15 minutes later"
                        >
                          +15m
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* End Time Stepper */}
                  <div className="bg-[#040706] border border-[#1a2824] rounded-xl p-3 space-y-2">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                      Ends At
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold font-mono text-white">
                        {formatMinutesTo12h(endMins)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAdjustEnd(-15)}
                          disabled={endMins <= startMins + 15}
                          className="px-2 py-1 text-[11px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-md text-white cursor-pointer transition-colors"
                          title="15 minutes earlier"
                        >
                          -15m
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustEnd(15)}
                          disabled={endMins >= 1440}
                          className="px-2 py-1 text-[11px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded-md text-white cursor-pointer transition-colors"
                          title="15 minutes later"
                        >
                          +15m
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-neutral-400 pt-1 leading-relaxed">
                  💡 Adjust start and end times here. Achivii automatically balances your day to protect your goal practice time.
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#1a2824] gap-2">
                {!isNew ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-3.5 py-2 text-xs font-medium bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Delete Commitment</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  {!isNew && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-white rounded-xl cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-5 py-2 text-xs font-bold bg-[#07CB6C] hover:bg-[#06b560] text-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#07CB6C]/20 transition-all"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default OnboardingWizard;
