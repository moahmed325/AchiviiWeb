import type { MetricDirection, VelocityTable, VelocityTarget } from './types.js';

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
    const noun = [...words].reverse().find((word) => !MODIFIERS.has(word) && !/^(the|on|for|with|and|per|in|to|a)$/.test(word));
    if (!noun || HORIZON.has(noun) || HORIZON.has(words[0])) continue;
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

export function week12MeetsTarget(table: VelocityTable, item: StatedTarget): boolean {
  const row = table.week12Targets.find((candidate) => rowMatchesTarget(candidate, item));
  if (!row || !Number.isFinite(row.value)) return false;
  return item.bound === 'at_most' ? row.value <= item.value : row.value >= item.value;
}

export function statedTargetFailures(table: VelocityTable, targets: StatedTarget[]): string[] {
  return targets
    .filter((item) => !week12MeetsTarget(table, item))
    .map(
      (item) =>
        `Week 12 does not include the user's target (${item.phrase}). Practice or session minutes may be an extra line, but not the only line when the goal names a number.`
    );
}

function easierStart(value: number, direction: MetricDirection): number {
  if (direction === 'higher_is_harder') {
    const start = Math.round(value * 0.5 * 10) / 10;
    if (start > 0 && start < value) return start;
    return value > 1 ? value - 1 : value / 2;
  }
  const start = Math.round(value * 1.2 * 10) / 10;
  return start > value ? start : value + 1;
}

/**
 * Keeps every researched row, and forces week 12 to the number the user asked for
 * when research never included it.
 */
export function enforceStatedTargets(table: VelocityTable, targets: StatedTarget[]): VelocityTable {
  if (targets.length === 0) return table;

  const week1 = table.week1Targets.map((row) => ({ ...row }));
  const week12 = table.week12Targets.map((row) => ({ ...row }));
  const notes: string[] = [];

  for (const item of targets) {
    const endIndex = week12.findIndex((row) => rowMatchesTarget(row, item));
    if (endIndex >= 0) {
      const end = week12[endIndex];
      end.value = item.value;
      end.direction = item.direction;
      const start = week1.find((row) => row.metric === end.metric);
      if (start) {
        start.direction = item.direction;
        start.unit = end.unit;
        const easier = item.direction === 'higher_is_harder' ? start.value < end.value : start.value > end.value;
        if (!easier) start.value = easierStart(item.value, item.direction);
      }
    } else {
      const metric = item.unit;
      week1.push({
        metric,
        value: easierStart(item.value, item.direction),
        unit: item.unit,
        direction: item.direction,
      });
      week12.push({
        metric,
        value: item.value,
        unit: item.unit,
        direction: item.direction,
      });
    }
    notes.push(`Week 12 was set to the user's target (${item.phrase}) because the researched numbers did not include it.`);
  }

  const assumptions = [table.assumptions?.trim(), ...notes].filter(Boolean).join(' ');
  return {
    week1Targets: week1,
    week12Targets: week12,
    progressionFormula: table.progressionFormula?.trim() || 'Ramp from an easier start to the target named in the goal.',
    assumptions,
  };
}
