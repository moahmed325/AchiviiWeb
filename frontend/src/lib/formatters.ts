/**
 * Formats task and session titles to be concise, punchy, and to the point (2 to 5 words max).
 * Strips robotic prefixes like "Core Adaptation Session:", "Consolidation Practice:",
 * "Supportive Continuity:", "Targeted Focus Scaffolding:", etc.
 */
export function formatTaskTitle(rawTitle: string | null | undefined): string {
  if (!rawTitle) return 'Ambition Focus Dose';
  const cleaned = rawTitle
    .replace(/^(Core Adaptation Session|Consolidation Practice|Supportive Continuity|Targeted Focus Scaffolding):\s*/i, '')
    .trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 5) return cleaned;
  return words.slice(0, 4).join(' ');
}

/**
 * Formats a goal or outcome statement into a concise, punchy headline (2 to 4 words).
 * E.g., "By Day 90, you will confidently hold basic conversations in Amharic..." -> "Conversational Amharic"
 */
export function formatGoalTitle(
  goal: {
    outcome_statement?: string | null;
    goal_catalog?: { title?: string | null } | null;
    title?: string | null;
  } | null | undefined
): string {
  if (!goal) return 'Daily Execution';

  const catTitle = goal.goal_catalog?.title || goal.title;
  const outcome = goal.outcome_statement || '';

  // Detect mismatched fallback catalogs (e.g. SaaS MVP catalog on an Amharic language goal)
  const isMismatchedCatalog = Boolean(
    catTitle && (
      (/saas|software|mvp/i.test(catTitle) && /amharic|language|spanish|french|german/i.test(outcome)) ||
      (/marathon|running|fitness/i.test(catTitle) && /code|saas|software/i.test(outcome))
    )
  );

  if (catTitle && !isMismatchedCatalog && !catTitle.toLowerCase().includes('custom goal')) {
    return catTitle;
  }

  // Derive punchy title from outcome statement
  if (outcome) {
    if (/amharic/i.test(outcome)) return 'Conversational Amharic';
    if (/spanish/i.test(outcome)) return 'Conversational Spanish';
    if (/french/i.test(outcome)) return 'Conversational French';
    if (/german/i.test(outcome)) return 'Conversational German';
    if (/saas|software|mvp|app/i.test(outcome)) return 'Build & Launch SaaS';
    if (/marathon|half marathon/i.test(outcome)) return 'Marathon Finish';
    if (/10k|5k/i.test(outcome)) return 'Endurance Running';

    // Strip "By Day X, you will..."
    const stripped = outcome
      .replace(/^By Day \d+,\s*(you will\s*(confidently\s*)?)?/i, '')
      .replace(/^You will\s*(confidently\s*)?/i, '')
      .replace(/^[a-z]/, (c) => c.toUpperCase())
      .trim();

    const firstClause = stripped.split(/,|\.|;/)[0].trim();
    const words = firstClause.split(/\s+/).slice(0, 4).join(' ');
    if (words) return words;
  }

  return catTitle || 'Daily Execution';
}

/**
 * Converts "HH:mm" time string into minutes from midnight (0 - 1439).
 */
export function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Converts minutes from midnight into "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
