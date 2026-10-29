import type { DailyTask, Goal } from '../types';
import { isRestLike } from './today';

/**
 * The person's first practice step: a practice day in week 1, with no other practice day done yet. Before it is done,
 * Today makes starting easy (the 10-minute version is offered); once done, it marks the moment and offers a share card.
 * Only week 1 counts: a first completion after that is a return, not a start.
 */
export function isFirstStep(goal: Pick<Goal, 'currentWeek' | 'dailyTasks'>, task: DailyTask | null | undefined): boolean {
  if (!task || isRestLike(task) || (goal.currentWeek || 1) > 1) return false;
  return !(goal.dailyTasks || []).some((t) => t.id !== task.id && !isRestLike(t) && t.status === 'completed');
}

/** The share line for the first step, as posted to X or passed to the phone's share menu. */
export function firstStepShareText(goalText: string, dayNumber: number): string {
  return `Day ${dayNumber} of 90 done: ${goalText.trim()}. One step a day.`;
}
