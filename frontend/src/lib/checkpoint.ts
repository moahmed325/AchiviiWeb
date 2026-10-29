import type { Checkpoint } from '../types';

/**
 * Checkpoints (RULE-7, section 6): the card's words, word for word. Every amount comes from the server as the card shows
 * it ("6 km", "52 min or less"); nothing here works out a number.
 */
export const CHECKPOINT_NOT_SAVED = "Couldn't save your choice. Please try again.";

export interface CheckpointCopy {
  title: string;
  body: string;
  /** Null for line only, which has no accept button. */
  accept: string | null;
  keep: string;
}

/** B-109: "day 90" on a 12-week plan; a shorter plan's final week. */
const byWhen = (checkpoint: Checkpoint) => (checkpoint.finalWeek === undefined ? 'day 90' : `the end of week ${checkpoint.finalWeek}`);
const targetName = (checkpoint: Checkpoint) => (checkpoint.finalWeek === undefined ? 'day-90 target' : 'final target');

export function checkpointCopy(checkpoint: Checkpoint): CheckpointCopy {
  const { kind, target, offered, last, toFullGoal } = checkpoint;
  const by = byWhen(checkpoint);
  const name = targetName(checkpoint);
  if (kind === 'raise') {
    return {
      title: "You've caught up",
      body: toFullGoal ? `At this pace you'll reach ${offered} by ${by}.` : `At this pace you'll reach about ${offered} by ${by}. Your ${name} is ${target}.`,
      accept: `Aim for ${offered}`,
      keep: `Keep ${target}`,
    };
  }
  const title = last ? 'Last check on your pace' : 'A check on your pace';
  if (kind === 'line_only' || offered === null) {
    return {
      title,
      body: `Your result hasn't improved yet. Your ${name} stays at ${target}, and the next weeks build toward it.`,
      accept: null,
      keep: 'Got it',
    };
  }
  return {
    title,
    body: `At this pace you'll reach about ${offered} by ${by}. Your ${name} is ${target}.`,
    accept: `Aim for ${offered}`,
    keep: 'Keep my goal',
  };
}

/** Section 6: the line after an accepted offer. */
export function acceptedLine(checkpoint: Checkpoint): string {
  const name = targetName(checkpoint);
  const line = checkpoint.kind === 'raise' && checkpoint.toFullGoal ? `is back to ${checkpoint.offered}` : `is now ${checkpoint.offered}`;
  return `Your ${name} ${line}.`;
}
