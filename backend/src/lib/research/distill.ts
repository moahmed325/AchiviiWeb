/**
 * Reduces an extracted page to the part worth sending to a model.
 *
 * Tavily returns pages as markdown including the full navigation chrome. Taking the first
 * N characters therefore captures the logo and menu and discards the article.
 *
 * Measured on a live capture: the first 3000 characters of a marathonhandbook.com page on
 * running a sub-50 10K contained zero numeric mentions, while the remainder contained 61.
 * Stage 3 reported the goal had "no numeric dimension" — a correct reading of a navigation
 * menu. Truncation, not the prompt, was the cause.
 */

/** Lines that are navigation, consent banners, or subscription prompts. */
const BOILERPLATE_PATTERNS = [
  /^\s*!\[/,
  /\bcookie(s)? (policy|settings|consent)\b/i,
  /\b(subscribe|sign up) (to|for) (our )?newsletter\b/i,
  /\ball rights reserved\b/i,
  /\b(privacy policy|terms of (use|service))\b/i,
  /^\s*(share|tweet|pin it|follow us)\s*$/i,
];

/** Fraction of a line that must survive link-stripping for it to count as prose. */
const MIN_PROSE_RATIO = 0.4;

function isNavigationLine(line: string): boolean {
  const linkCount = (line.match(/\]\(/g) || []).length;
  if (linkCount === 0) return false;

  const withoutLinks = line.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  const bare = withoutLinks.replace(/[*+\-\s|>#]/g, '');
  const original = line.replace(/\s/g, '');
  if (original.length === 0) return true;

  // A menu is many links wrapping little text; a paragraph that cites a source is not.
  return linkCount >= 2 && bare.length / original.length < MIN_PROSE_RATIO;
}

/** Removes navigation, images and consent furniture, preserving document order. */
export function stripBoilerplate(raw: string): string[] {
  return (raw || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .filter((line) => !BOILERPLATE_PATTERNS.some((pattern) => pattern.test(line)))
    .filter((line) => !isNavigationLine(line));
}

const NUMBER_WITH_UNIT =
  /\b\d+(\.\d+)?\s*(%|x|mi|km|m|miles?|kilometers?|metres?|meters?|minutes?|mins?|hours?|hrs?|seconds?|secs?|weeks?|days?|sessions?|reps?|sets?|words?|pages?|lbs?|kg|mph|bpm)\b/i;

function scoreLine(line: string, preferNumeric: boolean): number {
  let score = 0;
  if (/^#{1,6}\s/.test(line)) score += 2;
  if (preferNumeric) {
    if (NUMBER_WITH_UNIT.test(line)) score += 4;
    else if (/\d/.test(line)) score += 2;
    // Markdown tables commonly hold week-by-week schedules.
    if (line.includes('|') && /\d/.test(line)) score += 2;
  }
  return score;
}

export interface DistillOptions {
  /** Maximum characters to return. */
  budget: number;
  /** Bias selection toward lines carrying quantities. Used by Stage 3. */
  preferNumeric?: boolean;
}

/**
 * Returns the most informative excerpt of a page within a character budget.
 *
 * Selected lines are emitted in their original order so the excerpt still reads as a
 * document rather than a bag of fragments.
 */
export function distillContent(raw: string, options: DistillOptions): string {
  const { budget, preferNumeric = false } = options;
  const lines = stripBoilerplate(raw);
  if (lines.length === 0) return '';

  const indexed = lines.map((line, index) => ({
    line,
    index,
    score: scoreLine(line, preferNumeric),
  }));

  // High-signal lines first, then the remaining prose in order, so a page with no numbers
  // still yields a readable excerpt rather than nothing.
  const ordered = [...indexed].sort((a, b) => b.score - a.score || a.index - b.index);

  const chosen = new Set<number>();
  let used = 0;
  for (const entry of ordered) {
    const cost = entry.line.length + 1;
    if (used + cost > budget) continue;
    chosen.add(entry.index);
    used += cost;
  }

  return indexed
    .filter((entry) => chosen.has(entry.index))
    .map((entry) => entry.line)
    .join('\n');
}
