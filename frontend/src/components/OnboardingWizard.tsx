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
  ChevronDown,
  ChevronUp,
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
  Hand,
  Trash2,
  SlidersHorizontal,
  Clock
} from 'lucide-react';
import {
  GoalClarification,
  RoutineSettings,
  CreateGoalResponse,
  Goal,
  CommitmentItem
} from '../types';
import { clarifyGoal, createGoalPlan } from '../lib/api';

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
    defaultTime: '08:00 - 09:00, 17:30 - 18:30',
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
}

const INSPIRATION_GOALS = [
  'Play acoustic guitar well enough to play 5 songs from memory at campfires',
  'Run a 10K under 50 minutes without stopping',
  'Build and ship a full-stack SaaS web app to first paying user',
  'Hold a 15-minute conversational dialogue in Spanish fluently',
  'Master handstand push-ups and bodyweight strength baseline'
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ token, onGoalCreated }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [rawGoal, setRawGoal] = useState(() => {
    const saved = localStorage.getItem('achivii_draft_goal');
    if (saved) {
      localStorage.removeItem('achivii_draft_goal');
      return saved;
    }
    return '';
  });

  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationError, setClarificationError] = useState<string | null>(null);
  const [isWaitingForClarification, setIsWaitingForClarification] = useState(false);
  const [lastClarifiedGoal, setLastClarifiedGoal] = useState<string | null>(null);

  // Clarification AI Output State
  const [clarification, setClarification] = useState<GoalClarification | null>(null);
  const [editedOutcome, setEditedOutcome] = useState('');
  const [isEditingOutcome, setIsEditingOutcome] = useState(false);

  // Diagnostic Question Answers State
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  // Routine / Schedule State (Now Step 2!)
  const [routine, setRoutine] = useState<RoutineSettings>({
    wakeTime: '07:00',
    sleepTime: '23:00',
    busyHours: '09:00 - 17:00',
    preferredSlot: 'evening',
    dailyMinutes: 60,
    planVariant: 'steady',
    commitments: []
  });

  // Universal Draggable & Edge-Resizable Timeline State
  interface ActiveBlockInteraction {
    blockId: string;
    blockType: 'practice' | 'commitment' | 'work' | 'sleep_morning' | 'sleep_night';
    blockTitle: string;
    action: 'move' | 'resize-left' | 'resize-right';
    initialStartMins: number;
    initialEndMins: number;
    initialDurationMins: number;
    startX: number;
    currentStartMins: number;
    currentEndMins: number;
  }

  const [activeInteraction, setActiveInteraction] = useState<ActiveBlockInteraction | null>(null);
  const [customPracticeStartMins, setCustomPracticeStartMins] = useState<number | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingCommitment, setEditingCommitment] = useState<CommitmentItem | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragDistanceRef = useRef(0);
  const dragStartPosRef = useRef(0);

  // Active practice start: use real-time drag hover if currently dragging practice, else custom
  const activePracticeStart =
    activeInteraction && activeInteraction.blockType === 'practice'
      ? activeInteraction.currentStartMins
      : customPracticeStartMins;

  // Dynamically computed non-overlapping day schedule layout
  const daySchedule = useMemo(
    () => computeDaySchedule(routine, activePracticeStart),
    [routine, activePracticeStart]
  );

  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return daySchedule.allBlocks.find((b) => b.id === selectedBlockId) || null;
  }, [selectedBlockId, daySchedule.allBlocks]);

  const handleBlockPointerDown = (
    e: React.PointerEvent,
    block: ScheduledDayBlock,
    action: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragDistanceRef.current = 0;
    dragStartPosRef.current = e.clientX;

    setActiveInteraction({
      blockId: block.id,
      blockType: block.type,
      blockTitle: block.title,
      action,
      initialStartMins: block.startMins,
      initialEndMins: block.endMins,
      initialDurationMins: block.durationMins,
      startX: e.clientX,
      currentStartMins: block.startMins,
      currentEndMins: block.endMins
    });
  };

  const handleBlockPointerMove = (e: React.PointerEvent) => {
    if (!activeInteraction) return;
    e.preventDefault();
    dragDistanceRef.current = Math.abs(e.clientX - dragStartPosRef.current);

    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const deltaPixels = e.clientX - activeInteraction.startX;
    const deltaMins = Math.round(((deltaPixels / rect.width) * 1440) / 15) * 15;

    if (activeInteraction.action === 'move') {
      const dur = activeInteraction.initialDurationMins;
      let proposedStart = activeInteraction.initialStartMins + deltaMins;
      proposedStart = Math.max(0, Math.min(1440 - dur, proposedStart));
      proposedStart = Math.round(proposedStart / 15) * 15;

      // Magnetic bumpers for practice block against sleep & work
      if (activeInteraction.blockType === 'practice') {
        const wakeMins = parseTimeToMinutes(routine.wakeTime, 420);
        const sleepMins = parseTimeToMinutes(routine.sleepTime, 1380);
        const busyParts = (routine.busyHours || '09:00 - 17:00').split('-');
        const busyStartMins = parseTimeToMinutes(busyParts[0]?.trim() || '', 540);
        const busyEndMins = parseTimeToMinutes(busyParts[1]?.trim() || '', 1020);

        proposedStart = Math.max(wakeMins, Math.min(sleepMins - dur, proposedStart));

        if (proposedStart < busyEndMins && proposedStart + dur > busyStartMins) {
          if (proposedStart + dur / 2 < (busyStartMins + busyEndMins) / 2) {
            proposedStart = Math.max(wakeMins, busyStartMins - dur);
          } else {
            proposedStart = Math.min(sleepMins - dur, busyEndMins);
          }
        }
      }

      setActiveInteraction((prev) =>
        prev
          ? {
              ...prev,
              currentStartMins: proposedStart,
              currentEndMins: proposedStart + dur
            }
          : null
      );
    } else if (activeInteraction.action === 'resize-left') {
      // Squeezing / expanding from left edge
      const end = activeInteraction.initialEndMins;
      let proposedStart = activeInteraction.initialStartMins + deltaMins;
      proposedStart = Math.max(0, Math.min(end - 15, proposedStart));
      proposedStart = Math.round(proposedStart / 15) * 15;

      setActiveInteraction((prev) =>
        prev
          ? {
              ...prev,
              currentStartMins: proposedStart,
              currentEndMins: end
            }
          : null
      );
    } else if (activeInteraction.action === 'resize-right') {
      // Squeezing / expanding from right edge
      const start = activeInteraction.initialStartMins;
      let proposedEnd = activeInteraction.initialEndMins + deltaMins;
      proposedEnd = Math.min(1440, Math.max(start + 15, proposedEnd));
      proposedEnd = Math.round(proposedEnd / 15) * 15;

      setActiveInteraction((prev) =>
        prev
          ? {
              ...prev,
              currentStartMins: start,
              currentEndMins: proposedEnd
            }
          : null
      );
    }
  };

  const handleBlockPointerUp = (e: React.PointerEvent) => {
    if (!activeInteraction) return;
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const { blockId, blockType, currentStartMins, currentEndMins } = activeInteraction;
    const isClick = dragDistanceRef.current < 5;

    setActiveInteraction(null);

    if (isClick) {
      if (blockType === 'commitment') {
        const found = (routine.commitments || []).find((c) => c.id === blockId);
        if (found) {
          setEditingCommitment(found);
          setSelectedBlockId(blockId);
          return;
        }
      }
      setSelectedBlockId((prev) => (prev === blockId ? null : blockId));
      return;
    }

    // Apply the drag or edge-squeeze changes
    setSelectedBlockId(blockId);

    if (blockType === 'commitment') {
      setRoutine((prev) => ({
        ...prev,
        commitments: (prev.commitments || []).map((c) => {
          if (c.id !== blockId) return c;
          return {
            ...c,
            time: `${formatMinutesTo24h(currentStartMins)} - ${formatMinutesTo24h(currentEndMins)}`
          };
        })
      }));
    } else if (blockType === 'practice') {
      const newDur = currentEndMins - currentStartMins;
      setCustomPracticeStartMins(currentStartMins);
      const finalSlot =
        currentStartMins < 720 ? 'morning' : currentStartMins < 1020 ? 'afternoon' : 'evening';
      setRoutine((prev) => ({
        ...prev,
        dailyMinutes: newDur,
        preferredSlot: finalSlot
      }));
    } else if (blockType === 'work') {
      setRoutine((prev) => ({
        ...prev,
        busyHours: `${formatMinutesTo24h(currentStartMins)} - ${formatMinutesTo24h(currentEndMins)}`
      }));
    } else if (blockType === 'sleep_morning') {
      setRoutine((prev) => ({
        ...prev,
        wakeTime: formatMinutesTo24h(currentEndMins)
      }));
    } else if (blockType === 'sleep_night') {
      setRoutine((prev) => ({
        ...prev,
        sleepTime: formatMinutesTo24h(currentStartMins)
      }));
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeInteraction) return;
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
    setSelectedBlockId('practice-session');
  };

  // Block Inspector Direct Adjustments
  const handleAdjustCommitmentDuration = (id: string, deltaMins: number) => {
    setRoutine((prev) => {
      const list = prev.commitments || [];
      return {
        ...prev,
        commitments: list.map((c) => {
          if (c.id !== id) return c;
          const currentBlock = daySchedule.allBlocks.find((b) => b.id === id);
          const curStart = currentBlock?.startMins ?? 1080;
          const curDur = currentBlock?.durationMins ?? 60;
          const newDur = Math.max(15, Math.min(360, curDur + deltaMins));
          const newEnd = curStart + newDur;
          return {
            ...c,
            time: `${formatMinutesTo24h(curStart)} - ${formatMinutesTo24h(newEnd)}`
          };
        })
      };
    });
  };

  const handleShiftCommitmentTime = (id: string, deltaMins: number) => {
    setRoutine((prev) => {
      const list = prev.commitments || [];
      return {
        ...prev,
        commitments: list.map((c) => {
          if (c.id !== id) return c;
          const currentBlock = daySchedule.allBlocks.find((b) => b.id === id);
          const curStart = currentBlock?.startMins ?? 1080;
          const curDur = currentBlock?.durationMins ?? 60;
          const newStart = Math.max(0, Math.min(1440 - curDur, curStart + deltaMins));
          const newEnd = newStart + curDur;
          return {
            ...c,
            time: `${formatMinutesTo24h(newStart)} - ${formatMinutesTo24h(newEnd)}`
          };
        })
      };
    });
  };

  const handleAdjustPracticeDuration = (deltaMins: number) => {
    setRoutine((prev) => ({
      ...prev,
      dailyMinutes: Math.max(15, Math.min(180, (prev.dailyMinutes || 60) + deltaMins))
    }));
  };

  const handleShiftPracticeTime = (deltaMins: number) => {
    const currentBlock = daySchedule.allBlocks.find((b) => b.isPractice);
    const curStart = currentBlock?.startMins ?? 1170;
    const practiceDuration = routine.dailyMinutes || 60;
    const newStart = Math.max(0, Math.min(1440 - practiceDuration, curStart + deltaMins));
    setCustomPracticeStartMins(newStart);
    const finalSlot = newStart < 720 ? 'morning' : newStart < 1020 ? 'afternoon' : 'evening';
    setRoutine((prev) => ({ ...prev, preferredSlot: finalSlot }));
  };

  const handleAdjustWorkHours = (field: 'start' | 'end', deltaMins: number) => {
    const busyParts = (routine.busyHours || '09:00 - 17:00').split('-');
    let startMins = parseTimeToMinutes(busyParts[0]?.trim() || '', 540);
    let endMins = parseTimeToMinutes(busyParts[1]?.trim() || '', 1020);
    if (field === 'start') {
      startMins = Math.max(0, Math.min(endMins - 60, startMins + deltaMins));
    } else {
      endMins = Math.max(startMins + 60, Math.min(1440, endMins + deltaMins));
    }
    setRoutine((prev) => ({
      ...prev,
      busyHours: `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(endMins)}`
    }));
  };

  const handleAdjustSleepTime = (field: 'wake' | 'sleep', deltaMins: number) => {
    if (field === 'wake') {
      const cur = parseTimeToMinutes(routine.wakeTime, 420);
      const updated = Math.max(0, Math.min(720, cur + deltaMins));
      setRoutine((prev) => ({ ...prev, wakeTime: formatMinutesTo24h(updated) }));
    } else {
      const cur = parseTimeToMinutes(routine.sleepTime, 1380);
      const updated = Math.max(720, Math.min(1440, cur + deltaMins));
      setRoutine((prev) => ({ ...prev, sleepTime: formatMinutesTo24h(updated) }));
    }
  };

  // Custom Commitment Input State
  const [isCustomDrawerOpen, setIsCustomDrawerOpen] = useState(false);
  const [newCommitmentTitle, setNewCommitmentTitle] = useState('');
  const [newCommitmentTime, setNewCommitmentTime] = useState('');

  const handleTogglePresetCommitment = (preset: PresetCommitment) => {
    const existingIndex = (routine.commitments || []).findIndex(
      (c) => c.title.toLowerCase() === preset.title.toLowerCase()
    );
    if (existingIndex >= 0) {
      setRoutine((prev) => ({
        ...prev,
        commitments: (prev.commitments || []).filter((_, idx) => idx !== existingIndex)
      }));
    } else {
      setRoutine((prev) => ({
        ...prev,
        commitments: [
          ...(prev.commitments || []),
          {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
            title: preset.title,
            time: preset.defaultTime,
            category: preset.category,
            days: preset.defaultDays || ['Mon', 'Wed', 'Fri']
          }
        ]
      }));
    }
  };

  const handleAddCustomCommitment = () => {
    if (!newCommitmentTitle.trim()) return;
    setRoutine((prev) => ({
      ...prev,
      commitments: [
        ...(prev.commitments || []),
        {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
          title: newCommitmentTitle.trim(),
          time: newCommitmentTime.trim() || undefined,
          category: 'other',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        }
      ]
    }));
    setNewCommitmentTitle('');
    setNewCommitmentTime('');
    setIsCustomDrawerOpen(false);
  };

  const handleRemoveCommitment = (id: string) => {
    setRoutine((prev) => ({
      ...prev,
      commitments: (prev.commitments || []).filter((c) => c.id !== id)
    }));
  };

  // Step 5 State (Plan Generation)
  const [generationStage, setGenerationStage] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Methodologies disclosure in Refine step
  const [showMethodologies, setShowMethodologies] = useState(false);

  const generationStages = [
    'Breaking your goal into 3 progressive phases...',
    'Designing your weekly milestones...',
    'Writing your first week of daily sessions...',
    'Personalizing exercises for your level...',
    'Finalizing your schedule...'
  ];

  // --------------------------------------------------------------------------
  // Background AI Clarification Runner
  // --------------------------------------------------------------------------
  const startClarification = (goalText: string) => {
    const textToUse = (goalText || rawGoal).trim();
    if (!textToUse) return;

    if (clarification && lastClarifiedGoal === textToUse) {
      return;
    }

    setIsClarifying(true);
    setClarificationError(null);
    setLastClarifiedGoal(textToUse);

    clarifyGoal(textToUse)
      .then((result) => {
        setClarification(result);
        setEditedOutcome(result.clarifiedOutcome);

        // Pre-seed default answers for questions
        const initialAnswers: Record<string, string> = {};
        result.followUpQuestions.forEach((q) => {
          if (q.options?.length > 0) {
            initialAnswers[q.id] = q.options[0];
          }
        });
        setAnswers(initialAnswers);
      })
      .catch((err: any) => {
        console.error('[OnboardingWizard] Clarification error:', err);
        setClarificationError(err.message || 'Something went wrong while analyzing your goal.');
      })
      .finally(() => {
        setIsClarifying(false);
      });
  };

  // --------------------------------------------------------------------------
  // Step 1: Submit Goal -> Instant 0ms transition to Step 2 (Schedule)
  // --------------------------------------------------------------------------
  const handleStartGoal = (goalText: string) => {
    const textToUse = (goalText || rawGoal).trim();
    if (!textToUse) return;

    setRawGoal(textToUse);
    setEditedOutcome(textToUse);

    // Instant 0ms jump to Schedule while AI starts in background
    setStep(2);
    startClarification(textToUse);
  };

  // --------------------------------------------------------------------------
  // Step 2: From Schedule -> Advance to Step 3 (Refine Outcome)
  // --------------------------------------------------------------------------
  const handleProceedFromSchedule = () => {
    if (isClarifying) {
      // User finished schedule in <2s while AI is still finishing
      setIsWaitingForClarification(true);
    } else if (clarification) {
      setStep(3);
    } else if (clarificationError) {
      // If error occurred, retry analysis
      startClarification(rawGoal);
      setIsWaitingForClarification(true);
    }
  };

  // Auto-advance to Step 3 as soon as clarification resolves if user is waiting
  useEffect(() => {
    if (isWaitingForClarification && !isClarifying && clarification) {
      setIsWaitingForClarification(false);
      setStep(3);
    }
  }, [isWaitingForClarification, isClarifying, clarification]);

  // --------------------------------------------------------------------------
  // Step 4: Final Generation Trigger
  // --------------------------------------------------------------------------
  const handleGeneratePlan = async () => {
    setStep(5);
    setGenerationError(null);

    // Progress animation
    const interval = setInterval(() => {
      setGenerationStage((prev) => (prev + 1) % generationStages.length);
    }, 1800);

    try {
      // Merge custom answers
      const finalizedAnswers: Record<string, string> = {};
      clarification?.followUpQuestions.forEach((q) => {
        if (customAnswers[q.id]?.trim()) {
          finalizedAnswers[q.question] = customAnswers[q.id].trim();
        } else {
          finalizedAnswers[q.question] = answers[q.id] || q.options[0] || '';
        }
      });

      const response: CreateGoalResponse = await createGoalPlan(
        {
          rawGoal,
          clarifiedOutcome: editedOutcome || clarification?.clarifiedOutcome || rawGoal,
          answers: finalizedAnswers,
          routine
        },
        token
      );

      clearInterval(interval);
      const fullGoal: Goal = {
        ...response.goal,
        roadmapWeeks: response.roadmapWeeks || response.goal.roadmapWeeks || [],
        dailyTasks: response.dailyTasks || response.goal.dailyTasks || []
      };
      onGoalCreated(fullGoal);
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setGenerationError(err.message || 'Plan generation failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <span>Step {step} of 5</span>
          <span className="text-[#07CB6C] font-medium">
            {step === 1 && 'Your goal'}
            {step === 2 && 'Your schedule'}
            {step === 3 && 'Quick questions'}
            {step === 4 && 'What success looks like'}
            {step === 5 && 'Building plan'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#111a17] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#07CB6C] transition-all duration-500 ease-out"
            style={{ width: `${(step / 5) * 100}%` }}
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

            {/* Inspiration Chips */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-neutral-500">
                Or try one of these:
              </p>
              <div className="flex flex-wrap gap-2">
                {INSPIRATION_GOALS.map((insp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setRawGoal(insp);
                      handleStartGoal(insp);
                    }}
                    className="text-xs text-neutral-300 bg-[#0c1210] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 px-3 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                  >
                    {insp}
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
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              When works best for you?
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              We'll schedule deliberate practice sessions around your life so they actually stick.
            </p>
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
                  {routine.planVariant === 'minimal' && '4 days / week'}
                  {(!routine.planVariant || routine.planVariant === 'steady') && '5 days / week'}
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
                  const isSelected = (routine.planVariant || 'steady') === variant.id;
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
                  {routine.dailyMinutes} min / day
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 90].map((mins) => {
                  const isRec = mins === 60;
                  const isSelected = routine.dailyMinutes === mins;
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
                {routine.dailyMinutes === 60 && 'Recommended — ideal depth for students and 9-to-5 workers.'}
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
                        onClick={() => handleTogglePresetCommitment(preset)}
                        className="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
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
                      {isAdded && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCommitment(activeC);
                          }}
                          className="pr-2.5 pl-0.5 py-1.5 text-neutral-400 hover:text-[#07CB6C] cursor-pointer"
                          title="Edit days and schedule"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
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
                        onClick={() => setEditingCommitment(customC)}
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

              {/* Visual 24-Hour Day Balance Map */}
              <div className="pt-2 border-t border-[#1a2824]/60 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span className="text-xs font-semibold text-white">
                      Your 24-Hour Day Balance Map
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2.5 py-0.5 rounded border border-[#07CB6C]/30 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C] animate-pulse" />
                    <span>
                      Practice Locked: {daySchedule.practiceTimeLabel} ({routine.dailyMinutes}m)
                    </span>
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
                      const isInteracting = activeInteraction?.blockId === b.id;
                      const isSelected = selectedBlockId === b.id;

                      const startMins = isInteracting ? activeInteraction.currentStartMins : b.startMins;
                      const endMins = isInteracting ? activeInteraction.currentEndMins : b.endMins;
                      const durationMins = endMins - startMins;
                      const timeLabel = `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(endMins)}`;

                      const leftPct = (startMins / 1440) * 100;
                      const widthPct = Math.max(2.6, (durationMins / 1440) * 100);
                      const BlockIcon = b.icon;
                      const canResize = b.type === 'commitment' || b.type === 'work' || b.isPractice;

                      return (
                        <div
                          key={b.id}
                          data-no-track-jump="true"
                          className={`absolute top-0.5 bottom-0.5 ${
                            b.isPractice
                              ? 'bg-[#07CB6C] text-black font-bold z-20 border border-white/60 ring-1 ring-[#040706]'
                              : `${b.bg} border ${b.border} ring-1 ring-[#040706] text-[9px] ${b.color} font-mono z-10`
                          } rounded-md flex items-center justify-between overflow-visible shadow-sm select-none group/block ${
                            isInteracting
                              ? 'shadow-2xl shadow-[#07CB6C]/70 ring-2 ring-white z-40 scale-[1.02]'
                              : isSelected
                              ? 'ring-2 ring-white scale-[1.02] shadow-xl z-30'
                              : 'hover:brightness-110'
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            transition: isInteracting
                              ? 'none'
                              : 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s ease'
                          }}
                        >
                          {/* Floating Real-time Drag / Squeeze Tooltip */}
                          {isInteracting && (
                            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-[#07CB6C] text-black font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-xl shadow-[#07CB6C]/60 border border-white whitespace-nowrap pointer-events-none z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-75">
                              {b.isPractice ? (
                                <Target className="w-3 h-3 text-black" />
                              ) : (
                                <Clock className="w-3 h-3 text-black" />
                              )}
                              <span>
                                {b.title}: {formatMinutesTo12h(startMins)} – {formatMinutesTo12h(endMins)}
                              </span>
                              <span className="opacity-80 font-mono font-normal">({durationMins}m)</span>
                            </div>
                          )}

                          {/* Left Edge Squeeze / Expand Handle */}
                          {canResize && (
                            <div
                              data-action="resize-left"
                              onPointerDown={(e) => handleBlockPointerDown(e, b, 'resize-left')}
                              onPointerMove={handleBlockPointerMove}
                              onPointerUp={handleBlockPointerUp}
                              onPointerCancel={handleBlockPointerUp}
                              className="absolute left-0 top-0 bottom-0 w-3 z-30 cursor-ew-resize hover:bg-white/40 active:bg-white/70 rounded-l-md transition-colors flex items-center justify-center group/leftHandle touch-none select-none"
                              title="Drag left/right to squeeze or expand start time"
                            >
                              <div className="w-0.5 h-3 bg-white/50 rounded-full group-hover/leftHandle:bg-white group-hover/leftHandle:h-4.5 transition-all" />
                            </div>
                          )}

                          {/* Center Body for Drag Move & Tap */}
                          <div
                            data-action="move"
                            onPointerDown={(e) => handleBlockPointerDown(e, b, 'move')}
                            onPointerMove={handleBlockPointerMove}
                            onPointerUp={handleBlockPointerUp}
                            onPointerCancel={handleBlockPointerUp}
                            className="flex-1 h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing px-2.5 select-none touch-none"
                            title={`${b.title} (${timeLabel}) — Drag to move or click to edit`}
                          >
                            <div className="flex items-center gap-1 truncate pointer-events-none select-none">
                              {b.isPractice ? (
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

                          {/* Right Edge Squeeze / Expand Handle */}
                          {canResize && (
                            <div
                              data-action="resize-right"
                              onPointerDown={(e) => handleBlockPointerDown(e, b, 'resize-right')}
                              onPointerMove={handleBlockPointerMove}
                              onPointerUp={handleBlockPointerUp}
                              onPointerCancel={handleBlockPointerUp}
                              className="absolute right-0 top-0 bottom-0 w-3 z-30 cursor-ew-resize hover:bg-white/40 active:bg-white/70 rounded-r-md transition-colors flex items-center justify-center group/rightHandle touch-none select-none"
                              title="Drag left/right to squeeze or expand end time"
                            >
                              <div className="w-0.5 h-3 bg-white/50 rounded-full group-hover/rightHandle:bg-white group-hover/rightHandle:h-4.5 transition-all" />
                            </div>
                          )}
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

                {/* Interactive Block Inspector Panel */}
                {selectedBlock && (
                  <div className="p-3 sm:p-3.5 rounded-lg bg-[#080d0b] border border-[#1a2824] shadow-xl space-y-2.5 transition-all">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${selectedBlock.bg} ${selectedBlock.border} border`}>
                          {selectedBlock.icon && <selectedBlock.icon className={`w-3.5 h-3.5 ${selectedBlock.color}`} />}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{selectedBlock.title}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-neutral-300 border border-neutral-800">
                            {formatMinutesTo12h(selectedBlock.startMins)} – {formatMinutesTo12h(selectedBlock.endMins)}
                          </span>
                          <span className="text-[10px] font-mono text-[#07CB6C] font-semibold">
                            {selectedBlock.durationMins} min
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedBlockId(null)}
                        className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="Close Inspector"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Commitment Block Controls */}
                    {selectedBlock.type === 'commitment' && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Duration:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustCommitmentDuration(selectedBlock.id, -15)}
                            disabled={selectedBlock.durationMins <= 15}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded text-white cursor-pointer transition-colors"
                          >
                            -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustCommitmentDuration(selectedBlock.id, 15)}
                            disabled={selectedBlock.durationMins >= 360}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded text-white cursor-pointer transition-colors"
                          >
                            +15m
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Shift:</span>
                          <button
                            type="button"
                            onClick={() => handleShiftCommitmentTime(selectedBlock.id, -15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            ◀ -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShiftCommitmentTime(selectedBlock.id, 15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            +15m ▶
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const found = (routine.commitments || []).find((c) => c.id === selectedBlock.id);
                            if (found) setEditingCommitment(found);
                          }}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-[#07CB6C]/15 hover:bg-[#07CB6C]/25 border border-[#07CB6C]/40 text-[#07CB6C] rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Days & Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleRemoveCommitment(selectedBlock.id);
                            setSelectedBlockId(null);
                          }}
                          className="px-2.5 py-1 text-[10px] font-medium bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 rounded-md flex items-center gap-1.5 ml-auto cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Remove Commitment</span>
                        </button>
                      </div>
                    )}

                    {/* Practice Block Controls */}
                    {selectedBlock.isPractice && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Duration:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustPracticeDuration(-15)}
                            disabled={(routine.dailyMinutes || 60) <= 15}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded text-white cursor-pointer transition-colors"
                          >
                            -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustPracticeDuration(15)}
                            disabled={(routine.dailyMinutes || 60) >= 180}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 rounded text-white cursor-pointer transition-colors"
                          >
                            +15m
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Shift:</span>
                          <button
                            type="button"
                            onClick={() => handleShiftPracticeTime(-15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            ◀ -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShiftPracticeTime(15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            +15m ▶
                          </button>
                        </div>

                        <span className="text-[10px] text-neutral-400 font-mono ml-auto flex items-center gap-1">
                          <Hand className="w-3 h-3 text-[#07CB6C]" />
                          <span>Tip: Drag practice block on timeline anytime!</span>
                        </span>
                      </div>
                    )}

                    {/* Work / Study Block Controls */}
                    {selectedBlock.type === 'work' && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Work Start:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustWorkHours('start', -30)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            -30m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustWorkHours('start', 30)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            +30m
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Work End:</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustWorkHours('end', -30)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            -30m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustWorkHours('end', 30)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            +30m
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Sleep Block Controls */}
                    {(selectedBlock.type === 'sleep_morning' || selectedBlock.type === 'sleep_night') && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Wake ({routine.wakeTime}):</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustSleepTime('wake', -15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustSleepTime('wake', 15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            +15m
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-[#040706] p-1 rounded-md border border-[#1a2824]">
                          <span className="text-[10px] text-neutral-400 px-1 font-mono">Bedtime ({routine.sleepTime}):</span>
                          <button
                            type="button"
                            onClick={() => handleAdjustSleepTime('sleep', -15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            -15m
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdjustSleepTime('sleep', 15)}
                            className="px-2 py-0.5 text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 rounded text-white cursor-pointer transition-colors"
                          >
                            +15m
                          </button>
                        </div>

                        <span className="text-[10px] text-indigo-400/80 font-mono ml-auto">
                          {((1440 - parseTimeToMinutes(routine.sleepTime, 1380) + parseTimeToMinutes(routine.wakeTime, 420)) / 60).toFixed(1)} hrs sleep
                        </span>
                      </div>
                    )}
                  </div>
                )}

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

                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2 py-0.5 rounded border border-[#07CB6C]/20">
                    <SlidersHorizontal className="w-3 h-3 text-[#07CB6C]" />
                    <span>
                      {selectedBlock
                        ? `Editing: ${selectedBlock.title}`
                        : 'Tap any block to edit hours or drag Practice'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Background Clarification Error (if any) */}
          {clarificationError && (
            <div className="p-3.5 rounded-md bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center justify-between gap-3">
              <span>{clarificationError}</span>
              <button
                type="button"
                onClick={() => startClarification(rawGoal)}
                className="px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded font-medium text-xs cursor-pointer shrink-0"
              >
                Retry Analysis
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              disabled={isClarifying && isWaitingForClarification}
              onClick={handleProceedFromSchedule}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] disabled:bg-[#07CB6C]/50 text-black font-semibold text-sm transition-all cursor-pointer"
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
      )}

      {/* ===================================================================== */}
      {/* STEP 3: DOMAIN CLARIFYING QUESTIONS */}
      {/* ===================================================================== */}
      {step === 3 && clarification && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              A few quick questions
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Calibrate your baseline, equipment, and focus so we can personalize your roadmap.
            </p>
          </div>

          <div className="space-y-5 animate-stagger">
            {clarification.followUpQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3 animate-fadeInUp"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#16221e] border border-[#07CB6C]/30 text-[#07CB6C] text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{q.question}</h3>
                  </div>
                  {q.subtitle && (
                    <p className="text-xs text-neutral-400 pl-7">{q.subtitle}</p>
                  )}
                </div>

                <div className="space-y-2 pl-7">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[q.id] === opt && !customAnswers[q.id];
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                          setCustomAnswers((prev) => ({ ...prev, [q.id]: '' }));
                        }}
                        className={`w-full text-left p-3 rounded-md border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#07CB6C]/10 border-[#07CB6C] text-white'
                            : 'bg-[#080d0b] border-[#1a2824] text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#07CB6C]" />}
                      </button>
                    );
                  })}

                  {q.allowCustom && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Or type your own..."
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => {
                          setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                        }}
                        className="w-full px-3 py-2 text-xs bg-[#080d0b] border border-[#1a2824] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-sm transition-all cursor-pointer shadow-sm"
            >
              <span>Next: What Success Looks Like</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 4: WHAT SUCCESS LOOKS LIKE / FINAL CONFIRMATION */}
      {/* ===================================================================== */}
      {step === 4 && clarification && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/25 text-[#07CB6C] text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{clarification.primaryDomain}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              What success looks like in 90 days
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Review your target outcome, verification benchmark, and schedule before we build your blueprint.
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

            <div className="pt-2 border-t border-[#1a2824] flex items-center gap-2 text-xs text-neutral-400">
              <AwardIcon className="w-4 h-4 text-[#f59e0b] shrink-0" />
              <span>
                <strong className="text-neutral-200">Capstone Proof Benchmark:</strong> {clarification.verificationCriteria}
              </span>
            </div>
          </div>

          {/* Core Capabilities */}
          {clarification.capabilities && clarification.capabilities.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Core Capabilities You'll Master</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {clarification.capabilities.map((cap, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#0c1210] border border-[#1a2824] text-neutral-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personalized Schedule & Routine Confirmation Card */}
          <div className="p-4 rounded-md bg-[#090e0c] border border-[#1a2824] space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Your Personalized Practice Protocol</span>
              </span>
              <span className="text-[10px] font-mono text-[#07CB6C] bg-[#07CB6C]/10 px-2 py-0.5 rounded border border-[#07CB6C]/30">
                100% Conflict Free
              </span>
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
                  onClick={() => setStep(3)}
                  className="text-[11px] text-neutral-400 hover:text-[#07CB6C] transition-colors cursor-pointer"
                >
                  Edit Answers
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {clarification.followUpQuestions.map((q) => {
                  const selectedVal = customAnswers[q.id]?.trim() || answers[q.id] || q.options[0] || 'Default';
                  return (
                    <div key={q.id} className="p-2.5 rounded bg-[#0c1210] border border-[#1a2824] text-xs space-y-0.5">
                      <div className="text-[10px] text-neutral-500 font-mono truncate">{q.question}</div>
                      <div className="text-[#07CB6C] font-medium truncate">{selectedVal}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scientific Frameworks — collapsed by default */}
          {clarification.scientificFrameworks && clarification.scientificFrameworks.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMethodologies(!showMethodologies)}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>{showMethodologies ? 'Hide' : 'View'} research-backed methods we'll use</span>
                {showMethodologies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showMethodologies && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                  {clarification.scientificFrameworks.map((framework, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-1.5 text-left"
                    >
                      <div className="font-medium text-xs text-[#07CB6C]">
                        {framework.name}
                      </div>
                      <p className="text-xs text-neutral-300 leading-snug">
                        {framework.description}
                      </p>
                      <p className="text-[11px] text-neutral-500 italic">
                        ↳ {framework.application}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
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
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[#07CB6C]/20 border-t-[#07CB6C] animate-spin" />
            <Target className="w-8 h-8 text-[#07CB6C] animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Building your plan...
            </h2>
            <p className="text-sm text-[#07CB6C] transition-all duration-300">
              {generationStages[generationStage]}
            </p>
          </div>

          {generationError && (
            <div className="max-w-md mx-auto p-4 rounded-md bg-red-950/40 border border-red-800 text-red-300 text-xs space-y-3">
              <p>{generationError}</p>
              <button
                type="button"
                onClick={handleGeneratePlan}
                className="px-4 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* DETAILED COMMITMENT & RECURRENCE EDITOR MODAL */}
      {/* ===================================================================== */}
      {editingCommitment && (() => {
        const activeEditingC =
          (routine.commitments || []).find((c) => c.id === editingCommitment.id) || editingCommitment;
        const catDetails = getCategoryDetails(activeEditingC.category);
        const CatIcon = catDetails.icon || Sparkles;

        const placedInfo = daySchedule.placedCommitmentsMap[activeEditingC.id];
        let startMins = placedInfo?.startMins ?? 1080;
        let endMins = placedInfo?.endMins ?? 1140;
        if (activeEditingC.time && activeEditingC.time.includes('-')) {
          const parts = activeEditingC.time.split(',')[0].split('-');
          const s = parseTimeToMinutes(parts[0]?.trim() || '', startMins);
          const e = parseTimeToMinutes(parts[1]?.trim() || '', endMins);
          if (e > s) {
            startMins = s;
            endMins = e;
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
          setRoutine((prev) => ({
            ...prev,
            commitments: (prev.commitments || []).map((c) =>
              c.id === activeEditingC.id ? { ...c, days } : c
            )
          }));
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
          setRoutine((prev) => ({
            ...prev,
            commitments: (prev.commitments || []).map((c) =>
              c.id === activeEditingC.id
                ? {
                    ...c,
                    time: `${formatMinutesTo24h(newStart)} - ${formatMinutesTo24h(endMins)}`
                  }
                : c
            )
          }));
        };

        const handleAdjustEnd = (delta: number) => {
          const newEnd = Math.min(1440, Math.max(startMins + 15, endMins + delta));
          setRoutine((prev) => ({
            ...prev,
            commitments: (prev.commitments || []).map((c) =>
              c.id === activeEditingC.id
                ? {
                    ...c,
                    time: `${formatMinutesTo24h(startMins)} - ${formatMinutesTo24h(newEnd)}`
                  }
                : c
            )
          }));
        };

        const handleUpdateTitle = (newTitle: string) => {
          setRoutine((prev) => ({
            ...prev,
            commitments: (prev.commitments || []).map((c) =>
              c.id === activeEditingC.id ? { ...c, title: newTitle } : c
            )
          }));
        };

        const handleDelete = () => {
          handleRemoveCommitment(activeEditingC.id);
          setEditingCommitment(null);
          if (selectedBlockId === activeEditingC.id) {
            setSelectedBlockId(null);
          }
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
            onClick={() => setEditingCommitment(null)}
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
                      Routine / Commitment Name
                    </label>
                    <input
                      type="text"
                      value={activeEditingC.title}
                      onChange={(e) => handleUpdateTitle(e.target.value)}
                      className="w-full bg-transparent font-bold text-white text-base focus:outline-none focus:border-b focus:border-[#07CB6C] pb-0.5 placeholder-neutral-500"
                      placeholder="Commitment name..."
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingCommitment(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer shrink-0"
                  title="Close"
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

                {/* Individual 7 day toggle pills */}
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  {ALL_DAYS.map((d) => {
                    const isSelected = activeDays.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => handleToggleSingleDay(d.key)}
                        title={`${d.full}: click to toggle`}
                        className={`flex-1 py-2 flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#07CB6C] border-[#07CB6C] text-black shadow-md shadow-[#07CB6C]/25'
                            : 'bg-[#040706] border-[#1a2824] text-neutral-400 hover:border-neutral-600 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-bold leading-none">{d.short}</span>
                        <span className={`text-[9px] font-mono leading-tight mt-0.5 ${isSelected ? 'text-black/80 font-medium' : 'text-neutral-500'}`}>
                          {d.key}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Window & Duration Steppers */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#07CB6C]" />
                    <span className="text-xs font-semibold text-white">Time Window & Duration</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#07CB6C] font-bold bg-[#07CB6C]/10 border border-[#07CB6C]/30 px-2 py-0.5 rounded-full">
                    {formatDurLabel(durationMins)} ({durationMins}m)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  💡 You can also squeeze or expand this block by dragging its left or right edges directly on the 24-hour balance map!
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-[#1a2824] gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3.5 py-2 text-xs font-medium bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Delete Commitment</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingCommitment(null)}
                  className="px-5 py-2 text-xs font-bold bg-[#07CB6C] hover:bg-[#06b560] text-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#07CB6C]/20 transition-all ml-auto"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

function AwardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

export default OnboardingWizard;
