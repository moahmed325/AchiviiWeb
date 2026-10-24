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
  /**
   * Plan safety limits M1.2 (PSL-5): "lose N <unit>". Met on a body-weight target when week 12 is at or below the
   * starting point minus N, or on a target that counts the amount lost when week 12 is at or above N (`statedTargetMet`).
   */
  change?: 'lose';
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

/** A time frame right after a measure makes it practice time: "a day", "every day", "per week", "daily". */
const PRACTICE_FRAME = /^\s*(?:(?:a|an|every|each|per)\s+(?:day|week|night|morning|evening|session)|(?:on\s+)?most\s+days|daily|weekly|nightly)\b/i;

/** Generic words for people: "100 people" names the same number as "100 users". */
const PEOPLE = new Set(['people', 'persons', 'person', 'folks']);

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

/** M1.2 (PSL-5): one unit written several ways. Never a conversion: kg and lb stay apart, as do km and miles. */
const SAME_UNIT: readonly (readonly string[])[] = [
  ['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers'],
  ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  ['lb', 'lbs', 'pound', 'pounds'],
  ['mi', 'mile', 'miles'],
  ['m', 'metre', 'metres', 'meter', 'meters'],
  ['percent', '%', 'percentage'],
];

/** One unit's other spellings ("km" and "kilometres", "minutes" and "min"). Shared with the weekly update's result reading. */
export function aliasesFor(unit: string): string[] {
  const lower = unit.toLowerCase();
  const aliases = new Set<string>([lower]);
  for (const group of SAME_UNIT) if (group.includes(lower)) for (const alias of group) aliases.add(alias);
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

/** One unit written two ways ("min" and "minutes", "kilometres" and "km"), through `aliasesFor`. Shared with the weekly update. */
export function sameUnit(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || aliasesFor(x).includes(y) || aliasesFor(y).includes(x);
}

function target(
  phrase: string,
  value: number,
  unit: string,
  direction: MetricDirection,
  bound: StatedTarget['bound'],
  change?: StatedTarget['change']
): StatedTarget {
  return { phrase, value, unit, aliases: aliasesFor(unit), direction, bound, ...(change ? { change } : {}) };
}

/** M1.2 (PSL-5): "lose" right before the number. */
const LOSE_BEFORE = /\blos(?:e|ing)\s+$/i;
/** M1.2: a change verb other than "lose" before a body-fat percent ("drop 5% body fat"): not read as a level. */
const OTHER_CHANGE_BEFORE = /\b(?:drop|dropping|cut|cutting|reduce|reducing|shed|shedding|burn|burning|lower|lowering|gain|gaining|add|adding)\s+(?:by\s+)?$/i;
/** M1.2: a distance named as the event, not a result: "a 10 km race", "5 km in 25 minutes", "10 km under an hour". */
const ARTICLE_BEFORE = /\b(?:a|an|the|my|first|your)\s+$/i;
const EVENT_AFTER = /^\s*(?:race|run\b|road|event|fun\s+run|parkrun|trail|in\b|under\b|below\b|sub\b|within\b)/i;
/** M1.2 review: a distance right after a running verb is the event too ("run 10 km without stopping", "run 5km"). */
const RUN_VERB_BEFORE = /\b(?:run|runs|running|ran|jog|jogs|jogging)\s+$/i;
/** B-87: a body weight named as a level ("weigh 70 kg", "a body weight of 150 pounds"): left unread. */
const WEIGH_BEFORE = /\b(?:weigh|weighs|weighing|weight(?:\s+of)?)\s+(?:about\s+|around\s+|under\s+|below\s+)?$/i;
const SHORT_UNIT: Record<string, string> = { kg: 'kg', kgs: 'kg', km: 'km', kms: 'km', lb: 'lb', mi: 'mi' };

/**
 * Pulls a result the user named out of the goal text.
 * "40 words per minute", "under 50 minutes", "3 balls", "three balls".
 * A race name like "10K" and a plan length like "12 weeks" are not targets.
 */
export function extractStatedTargets(text: string): StatedTarget[] {
  // B-33: "10,000 metres" reads as 10000.
  const goal = text.replace(/(\d),(?=\d{3}\b)/g, '$1');
  const found: StatedTarget[] = [];
  const used = new Set<string>();

  const add = (item: StatedTarget) => {
    const key = `${item.bound}:${item.value}:${item.unit}`;
    if (used.has(key)) return;
    used.add(key);
    // The goal and the success answer often name one number two ways ("100 users" ... "100 people using it", "5 song"
    // ... "5 songs"): that is one target, met in either unit. Two different things that share a number ("10 pounds"
    // and "10 pull-ups") stay two targets.
    const same = found.find(
      (other) =>
        other.bound === item.bound &&
        other.value === item.value &&
        (PEOPLE.has(other.unit) || PEOPLE.has(item.unit) || other.aliases.includes(item.unit))
    );
    if (same) {
      same.aliases = [...new Set([...same.aliases, ...item.aliases])];
      return;
    }
    found.push(item);
  };

  const timeUnit = (raw: string): string => (/hour|hr/i.test(raw) ? 'hours' : /sec/i.test(raw) ? 'seconds' : 'minutes');
  /** M1.2: spans a newer reader already took, so the "N <noun>" reader below never reads them a second way. */
  const taken: Array<[number, number]> = [];
  const isTaken = (at: number) => taken.some(([start, end]) => at >= start && at < end);
  const beforeAt = (at: number) => goal.slice(Math.max(0, at - 24), at);
  /**
   * M1.2 review: the one guard pass every reader's match goes through. A number followed by a practice frame ("a day",
   * "every week", "per session") is how much they practise, a plan length is not a result, and "with/using N" is a
   * tool, so none of them is ever a stated target. `at`: where the number starts; `unitEnd`: where its unit ends.
   */
  const notATarget = (at: number, unitEnd: number, unit: string) =>
    PRACTICE_FRAME.test(goal.slice(unitEnd)) || HORIZON.has(unit.toLowerCase()) || /\b(?:with|using)\s+$/i.test(beforeAt(at));

  // M1.2 (PSL-5): "in 25 minutes" is a time to beat, at most, like "under 25 minutes".
  for (const match of goal.matchAll(/\bin\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|seconds?|secs?|hours?|hrs?)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const at = match.index ?? 0;
    const end = at + match[0].length;
    taken.push([at, end]);
    if (notATarget(at + match[0].indexOf(match[1]), end, match[2])) continue;
    const unit = timeUnit(match[2]);
    add(target(`in ${value} ${unit}`, value, unit, 'lower_is_harder', 'at_most'));
  }

  // M1.2 (PSL-5): a body-fat percent. "15% body fat" is a level to reach, at most; "lose 5% body fat" is a change; after
  // another change verb ("drop 5% body fat") the number is not read, since it names neither a level nor a loss we check.
  for (const match of goal.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:body\s*-?\s*fat|bodyfat)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const at = match.index ?? 0;
    taken.push([at, at + match[0].length]);
    if (notATarget(at, at + match[0].length, 'percent')) continue;
    const before = beforeAt(at);
    if (LOSE_BEFORE.test(before)) add(target(`${value}% body fat`, value, 'percent', 'higher_is_harder', 'at_least', 'lose'));
    else if (!OTHER_CHANGE_BEFORE.test(before)) add(target(`${value}% body fat`, value, 'percent', 'lower_is_harder', 'at_most'));
  }

  // M1.2 (PSL-5): two-letter units after a number: kg, km, lb, mi ("squat 100 kg", "run 10 km", "lose 10kg"). A distance
  // named as the event ("a 10 km race", "5 km in 25 minutes") is not a target, as "Run a 10K" is not.
  for (const match of goal.matchAll(/\b(\d+(?:\.\d+)?)\s*(kgs?|kms?|lb|mi)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const at = match.index ?? 0;
    const end = at + match[0].length;
    taken.push([at, end]);
    const unit = SHORT_UNIT[match[2].toLowerCase()];
    if (notATarget(at, end, unit)) continue;
    const before = beforeAt(at);
    if (LOSE_BEFORE.test(before)) {
      add(target(`${value} ${unit}`, value, unit, 'higher_is_harder', 'at_least', 'lose'));
      continue;
    }
    // B-87: "weigh 70 kg" is a level that is at most when losing and at least when gaining; the goal doesn't say which.
    if (WEIGH_BEFORE.test(before)) continue;
    const distance = unit === 'km' || unit === 'mi';
    if (distance && (ARTICLE_BEFORE.test(before) || RUN_VERB_BEFORE.test(before) || EVENT_AFTER.test(goal.slice(end)))) continue;
    add(target(`${value} ${unit}`, value, unit, 'higher_is_harder', 'at_least'));
  }

  // B-33: "1500 m", "swim 400m". Not money or a count ("$1m", "2m followers") and not a named event ("a 100 m sprint").
  for (const match of goal.matchAll(/\b(\d+(?:\.\d+)?)\s*m\b(?!\s*(?:followers|subscribers|users|views|downloads|plays|streams|listeners|readers|members|customers|people|dollars|revenue|sprint|race|dash|event)\b)/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const at = match.index ?? 0;
    const end = at + match[0].length;
    if (/[$£€]\s*$/.test(goal.slice(0, at))) continue;
    taken.push([at, end]);
    if (notATarget(at, end, 'metres') || ARTICLE_BEFORE.test(beforeAt(at))) continue;
    add(target(`${value} metres`, value, 'metres', 'higher_is_harder', 'at_least'));
  }

  for (const match of goal.matchAll(/\b(?:under|below|less than|sub-?)\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|seconds?|secs?|hours?|hrs?)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const at = match.index ?? 0;
    if (notATarget(at + match[0].indexOf(match[1]), at + match[0].length, match[2])) continue;
    const unit = timeUnit(match[2]);
    add(target(`under ${value} ${unit}`, value, unit, 'lower_is_harder', 'at_most'));
  }

  for (const match of goal.matchAll(/\b(\d+(?:\.\d+)?|forty|fifty|sixty|thirty|twenty)\s*(?:words?\s+per\s+minute|wpm)\b/gi)) {
    const value = numberToken(match[1]);
    if (!value) continue;
    const at = match.index ?? 0;
    if (notATarget(at, at + match[0].length, 'words per minute')) continue;
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
    if (isTaken(at)) continue;
    // "20 minutes every day", "2 hours per week": how long they practise, not a result to reach by week 12. The frame is
    // read right after the number's first word.
    if (notATarget(at, at + (/^\S+\s+\S+/.exec(match[0])?.[0].length ?? match[0].length), noun)) continue;
    const before = goal.slice(Math.max(0, at - 16), at);
    if (/\b(?:under|below|less than|sub-?)\s*$/i.test(before)) continue;
    if (/^words?$/.test(noun) && /per\s+minute/i.test(goal.slice(at, at + match[0].length + 16))) continue;
    if (WEIGH_BEFORE.test(before) && aliasesFor('lb').concat(aliasesFor('kg')).includes(noun)) continue;
    // M1.2 (PSL-5): "lose 10 pounds" is a change, checked against the starting point.
    add(target(`${value} ${noun}`, value, noun, 'higher_is_harder', 'at_least', LOSE_BEFORE.test(before) ? 'lose' : undefined));
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
