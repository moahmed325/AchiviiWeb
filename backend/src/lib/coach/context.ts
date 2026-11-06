import type { DailyTask, Goal, RoadmapWeek } from '@prisma/client';
import { readRoutine, readStoredRoadmap } from '../planV2.js';
import { shapeOf } from '../planLength.js';
import { getUserTodayDateString, normalizeTimezone } from '../timezone.js';

/** The goal as the coach reads it: the stored plan, its weeks and its days. */
export type CoachGoal = Goal & { roadmapWeeks: RoadmapWeek[]; dailyTasks: DailyTask[] };

const DAY_MS = 86_400_000;
const NOTE_MAX = 160;

const dayIndex = (key: string) => Math.floor(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / DAY_MS);
const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text);
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const restLike = (task: DailyTask) => task.isRestDay || task.notOffered;

/** How a day stands today: done, missed (a past practice day not done), today, ahead, or rest. */
function dayState(task: DailyTask, today: string): string {
  if (restLike(task)) return 'rest day';
  if (task.status === 'completed') return 'done';
  if (task.date === today) return 'today, not done yet';
  return task.date < today ? 'missed' : 'ahead';
}

const FEEL_WORDS: Record<string, string> = { too_easy: 'felt too easy', just_right: 'felt just right', too_hard: 'felt too hard' };

/**
 * ND-41: everything the coach knows, as plain text: the goal (the words the person chose), the method and its rules,
 * the phase and this week's focus, the schedule, each day of this week with how it went (feel taps and notes), and
 * the plan's totals. Read only from stored state; the coach never sees another person's data or anything else.
 */
export function coachContext(goal: CoachGoal, firstName: string | null, timezone: string): string {
  const tz = normalizeTimezone(timezone);
  const today = getUserTodayDateString(tz);
  const roadmap = readStoredRoadmap(goal);
  const routine = readRoutine(goal);
  const weeks = shapeOf(goal).weeks;
  const current = goal.currentWeek || 1;
  const week = goal.roadmapWeeks.find((w) => w.weekNumber === current);
  const phase = roadmap?.phases.find((p) => current >= p.startWeek && current <= p.endWeek);
  const nextPhase = roadmap?.phases.find((p) => p.startWeek > current);

  const startKey = goal.startDate.toISOString().slice(0, 10);
  const day = Math.max(1, dayIndex(today) - dayIndex(startKey) + 1);
  const finishKey = new Date(goal.targetDate.getTime() - DAY_MS).toISOString().slice(0, 10);

  const practice = goal.dailyTasks.filter((t) => !restLike(t));
  const done = practice.filter((t) => t.status === 'completed');
  const missed = practice.filter((t) => t.status !== 'completed' && t.date < today);
  const lastDone = done.map((t) => t.date).sort().pop() ?? null;
  // The run of practice days done up to today; a missed practice day ends it.
  let streak = 0;
  for (const task of [...practice].filter((t) => t.date < today || (t.date === today && t.status === 'completed')).sort((a, b) => (a.date < b.date ? -1 : 1))) {
    streak = task.status === 'completed' ? streak + 1 : 0;
  }

  const thisWeek = goal.dailyTasks.filter((t) => t.weekNumber === current).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dayLines = thisWeek.map((t) => {
    const parts = [`${t.dayOfWeek} ${t.date}: ${restLike(t) ? 'rest' : oneLine(t.title)}`];
    if (!restLike(t)) parts.push(`${t.durationMinutes} min`);
    parts.push(dayState(t, today));
    if (t.feel && FEEL_WORDS[t.feel]) parts.push(FEEL_WORDS[t.feel]);
    if (t.notes && oneLine(t.notes)) parts.push(`their note: "${clip(oneLine(t.notes), NOTE_MAX)}"`);
    return '- ' + parts.join(' · ');
  });
  const todayTask = thisWeek.find((t) => t.date === today);

  const lines = [
    `Today is ${today} (their time zone, ${tz}).`,
    firstName ? `Their first name: ${firstName}.` : null,
    `Their goal, in their words: "${oneLine(goal.rawGoal)}".`,
    roadmap?.finalGoal && oneLine(roadmap.finalGoal) !== oneLine(goal.rawGoal) ? `What the plan aims for: ${oneLine(roadmap.finalGoal)}.` : null,
    `The plan: ${weeks} weeks, day ${day} today, week ${current} of ${weeks}; it ends on ${finishKey}.`,
    roadmap?.method?.name ? `Method: ${roadmap.method.name}${roadmap.method.creator ? ` (${roadmap.method.creator})` : ''}. ${oneLine(roadmap.method.summary ?? '')}` : null,
    roadmap?.method?.rules?.length ? `The method's rules: ${roadmap.method.rules.slice(0, 6).map(oneLine).join('; ')}.` : null,
    phase ? `Current phase: ${phase.name} (weeks ${phase.startWeek}-${phase.endWeek}): ${oneLine(phase.purpose)}.` : null,
    nextPhase ? `Next phase: ${nextPhase.name}, from week ${nextPhase.startWeek}.` : null,
    week ? `This week's focus: ${oneLine(week.theme)}. ${oneLine(week.objective)}` : null,
    `Their schedule: about ${routine.dailyMinutes} minutes a practice day${routine.preferredSlot ? `, usually in the ${routine.preferredSlot}` : ''}.`,
    dayLines.length ? `This week, day by day:\n${dayLines.join('\n')}` : 'This week has no days written yet.',
    todayTask && !restLike(todayTask) ? `Today's session: ${oneLine(todayTask.title)} (${todayTask.durationMinutes} min). Why today: ${oneLine(todayTask.whyToday ?? '') || 'not given'}.` : null,
    `So far: ${done.length} sessions done, ${missed.length} practice days missed, current streak ${streak} practice days${lastDone ? `, last session done on ${lastDone}` : ''}.`,
    goal.status !== 'active' ? `The plan's status: ${goal.status}.` : null,
  ];
  return lines.filter((line): line is string => Boolean(line)).join('\n');
}
