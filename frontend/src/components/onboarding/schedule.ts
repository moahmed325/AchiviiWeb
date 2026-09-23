import type { ComponentType } from 'react';
import { Briefcase, Car, Dumbbell, Flame, GraduationCap, Heart, Moon, Target, Utensils } from 'lucide-react';
import type { CommitmentItem, RoutineSettings } from '../../types';

type IconComponent = ComponentType<{ className?: string }>;

export interface PresetCommitment {
  id: string;
  category: 'fitness' | 'education' | 'commute' | 'family' | 'sports' | 'work' | 'other';
  title: string;
  defaultTime: string;
  defaultDays: string[];
  subtitle: string;
  icon: IconComponent;
}

export const PRESET_COMMITMENTS: PresetCommitment[] = [
  {
    id: 'gym',
    category: 'fitness',
    title: 'Gym & Fitness',
    defaultTime: '18:00 - 19:30',
    defaultDays: ['Mon', 'Wed', 'Fri'],
    subtitle: 'Strength, cardio, or mobility',
    icon: Dumbbell
  },
  {
    id: 'university',
    category: 'education',
    title: 'Classes & Study',
    defaultTime: '09:00 - 14:00',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subtitle: 'University, lectures, or school',
    icon: GraduationCap
  },
  {
    id: 'commute',
    category: 'commute',
    title: 'Daily Commute',
    defaultTime: '08:00 - 08:45',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subtitle: 'Transit, driving, or cycling',
    icon: Car
  },
  {
    id: 'dinner',
    category: 'family',
    title: 'Dinner & Family',
    defaultTime: '19:30 - 20:30',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    subtitle: 'Evenings, family, or meal prep',
    icon: Utensils
  },
  {
    id: 'sports',
    category: 'sports',
    title: 'Sports & Martial Arts',
    defaultTime: '19:00 - 20:30',
    defaultDays: ['Tue', 'Thu', 'Sat'],
    subtitle: 'Boxing, football, yoga, tennis',
    icon: Flame
  },
  {
    id: 'work_shift',
    category: 'work',
    title: 'Part-Time Shift / Job',
    defaultTime: '16:00 - 21:00',
    defaultDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    subtitle: 'Evening shift, freelance, or gig',
    icon: Briefcase
  }
];

export const newCommitmentId = () => Date.now().toString() + Math.random().toString(36).substring(2, 5);

export const formatDaysLabel = (days?: string[]): string => {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weekends = ['Sat', 'Sun'];
  if (days.length === 5 && weekdays.every((d) => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && weekends.every((d) => days.includes(d))) return 'Weekends';
  return days.join(', ');
};

export const getCategoryDetails = (category?: string) => {
  switch (category) {
    case 'fitness':
      return { icon: Dumbbell, label: 'Fitness' };
    case 'education':
      return { icon: GraduationCap, label: 'Study' };
    case 'commute':
      return { icon: Car, label: 'Commute' };
    case 'family':
      return { icon: Utensils, label: 'Dinner' };
    case 'sports':
      return { icon: Flame, label: 'Sports' };
    case 'work':
      return { icon: Briefcase, label: 'Work Shift' };
    default:
      return { icon: Heart, label: 'Personal' };
  }
};

export const parseTimeToMinutes = (timeStr: string, fallback: number): number => {
  if (!timeStr) return fallback;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

export const formatMinutesTo12h = (mins: number): string => {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${h12}:${mStr} ${ampm}`;
};

export const formatMinutesTo24h = (mins: number): string => {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const m = normalized % 60;
  const hStr = h24 < 10 ? `0${h24}` : `${h24}`;
  const mStr = m < 10 ? `0${m}` : `${m}`;
  return `${hStr}:${mStr}`;
};

/** "45m", "2h", "1h 30m". */
export const formatDuration = (m: number): string => {
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
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
  icon?: IconComponent;
  isPractice?: boolean;
  days?: string[];
}

export type PlacedCommitments = Record<string, { startMins: number; endMins: number; timeLabel: string }>;

export interface EditingCommitmentSession {
  item: CommitmentItem;
  isNew: boolean;
}

/** The inline "Add Other" form. */
export interface CustomCommitmentDraft {
  isOpen: boolean;
  title: string;
  time: string;
}

export const EMPTY_COMMITMENT_DRAFT: CustomCommitmentDraft = { isOpen: false, title: '', time: '' };

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
  const placedCommitmentsMap: PlacedCommitments = {};

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
      icon: Moon
    },
    {
      id: 'work',
      type: 'work' as const,
      title: routine.busyHours ? 'Work / Study' : 'Work',
      startMins: busyStartMins,
      endMins: busyEndMins,
      durationMins: busyEndMins - busyStartMins,
      timeLabel: `${formatMinutesTo24h(busyStartMins)} - ${formatMinutesTo24h(busyEndMins)}`,
      icon: Briefcase
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
      icon: Moon
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
