import type { MetricDirection, VelocityTarget } from './types.js';

export interface StatedTarget {
  /** What the user wrote, for the retry reason. */
  phrase: string;
  value: number;
  unit: string;
  /** Substrings that count as this unit in a metric name or unit field. */
  aliases: string[];
  direction: MetricDirection;
  /** higher targets must reach this by week 12; "under N" must be at or below it. */
  bound: 'at_least' | 'at_most';
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
};

/** Plan length, not a result the user wants by week 12. */
const HORIZON = new Set(['week', 'weeks', 'day', 'days', 'month', 'months', 'year', 'years']);

/** Sits between the number and the noun: "200 common Italian words", "20 consecutive push-ups". */
const MODIFIERS = new Set(['common', 'simple', 'basic', 'good', 'full', 'clean', 'consecutive', 'straight', 'unbroken', 'daily']);

/**
 * Words that follow a count but are never the thing counted: "100 users using it", "5 songs along with the track",
 * "5 standards cleanly" (an adverb).
 */
const NOT_A_UNIT = /^(?:the|on|for|with|without|and|per|in|to|a|along|using|from|into|onto|after|before|while|through|[a-z]+ly)$/;

const MEASURES = new Set([
  'metres',
  'meters',
  'metre',
  'meter',
  'kilometres',
  'kilometers',
  'miles',
  'mile',
  'minutes',
  'minute',
  'hours',
  'hour',
  'seconds',
  'lbs',
  'pounds',
]);

/**
 * "In one steady piece", "in one sitting", "in one set": "one" says how, not how many (B-27). Only a count of
 * one is skipped, so "3 sets" or "10 sessions" stay targets.
 */
const ONE_IS_A_MANNER = new Set([
  'piece',
  'sitting',
  'session',
  'take',
  'attempt',
  'try',
  'shot',
  'breath',
  'stretch',
  'block',
  'set',
  'effort',
  'row',
  'push',
  'pass',
]);

function numberToken(raw: string): number | null {
  const word = NUMBER_WORDS[raw.toLowerCase()];
  if (word) return word;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function aliasesFor(unit: string): string[] {
  const lower = unit.toLowerCase();
  const aliases = new Set<string>([lower]);
  if (lower.endsWith('s') && lower.length > 3) aliases.add(lower.slice(0, -1));
  else aliases.add(`${lower}s`);
  if (lower === 'words per minute') {
    aliases.add('wpm');
    aliases.add('words/minute');
  }
  if (lower === 'minutes' || lower === 'minute') {
    aliases.add('minute');
    aliases.add('minutes');
    aliases.add('min');
  }
  return [...aliases];
}

function target(
  phrase: string,
  value: number,
  unit: string,
  direction: MetricDirection,
  bound: StatedTarget['bound']
): StatedTarget {
  return { phrase, value, unit, aliases: aliasesFor(unit), direction, bound };
}

/**
 * Pulls a result the user named out of the goal text.
 * "40 words per minute", "under 50 minutes", "3 balls", "three balls".
 * A race name like "10K" and a plan length like "12 weeks" are not targets.
 */
export function extractStatedTargets(goal: string): StatedTarget[] {
  const found: StatedTarget[] = [];
  const used = new Set<string>();

  const add = (item: StatedTarget) => {
    const key = `${item.bound}:${item.value}:${item.unit}`;
    if (used.has(key)) return;
    used.add(key);
    // The goal and the success answer often name one number two ways ("100 users" ... "100 people using it"):
    // that is one target, met in either unit, not two that week 12 must both reach.
    const same = found.find((other) => other.bound === item.bound && other.value === item.value);
    if (same) {
      same.aliases = [...new Set([...same.aliases, ...item.aliases])];
      return;
    }
    found.push(item);
  };

  const timeUnit = (raw: string): string => (/hour|hr/i.test(raw) ? 'hours' : /sec/i.test(raw) ? 'seconds' : 'minutes');

  for (const match of goal.matchAll(/\b(?:under|below|less than|sub-?)\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|seconds?|secs?|hours?|hrs?)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const unit = timeUnit(match[2]);
    add(target(`under ${value} ${unit}`, value, unit, 'lower_is_harder', 'at_most'));
  }

  for (const match of goal.matchAll(/\b(\d+(?:\.\d+)?|forty|fifty|sixty|thirty|twenty)\s*(?:words?\s+per\s+minute|wpm)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    add(target(`${value} words per minute`, value, 'words per minute', 'higher_is_harder', 'at_least'));
  }

  const amount = goal.matchAll(
    /\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty)\s+([a-zA-Z][a-zA-Z-]{2,})(?:\s+[a-zA-Z][a-zA-Z-]{2,})?(?:\s+[a-zA-Z][a-zA-Z-]{2,})?\b/gi
  );
  for (const match of amount) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const words = match[0].split(/\s+/).slice(1).map((word) => word.toLowerCase());
    if (/words?\s+per\s+minute|\bwpm\b/i.test(match[0])) continue;
    // A unit of measure right after the number is the unit, whatever follows: "1500 metres freestyle".
    const noun = MEASURES.has(words[0])
      ? words[0]
      : [...words].reverse().find((word) => !MODIFIERS.has(word) && !NOT_A_UNIT.test(word));
    if (!noun || HORIZON.has(noun) || HORIZON.has(words[0])) continue;
    if (value === 1 && ONE_IS_A_MANNER.has(noun)) continue;
    const at = match.index ?? 0;
    const before = goal.slice(Math.max(0, at - 16), at);
    if (/\b(?:under|below|less than|sub-?)\s*$/i.test(before)) continue;
    if (/\b(?:with|using)\s+$/i.test(before)) continue;
    if (/^words?$/.test(noun) && /per\s+minute/i.test(goal.slice(at, at + match[0].length + 16))) continue;
    add(target(`${value} ${noun}`, value, noun, 'higher_is_harder', 'at_least'));
  }

  return found;
}

function blob(row: VelocityTarget): string {
  return `${row.metric} ${row.unit}`.toLowerCase();
}

export function rowMatchesTarget(row: VelocityTarget, item: StatedTarget): boolean {
  return item.aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^a-z])${escaped}(?:[^a-z]|$)`, 'i').test(blob(row));
  });
}
