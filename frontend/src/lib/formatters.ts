/**
 * Formats and simplifies AI-rewritten goals into a clean, punchy, active goal title.
 * Strips robotic prefixes ("By Day 90, I will have successfully designed, developed, and deployed...")
 * and secondary specification run-on clauses (", complete with user authentication..."),
 * leaving a clean, beautiful, action-oriented title.
 */
export function formatGoalTitle(outcome?: string, rawGoal?: string): string {
  if (!outcome || !outcome.trim()) {
    return rawGoal?.trim() || 'Your 90-Day Plan';
  }

  let text = outcome.trim();

  // Strip formulaic robotic prefixes
  text = text.replace(
    /^By Day \d+,\s*(I will have successfully|I will successfully|I will have|I will|achieve full mastery and consistent execution of|achieve)\s*/i,
    (_match, p1) => {
      if (/achieve full mastery/i.test(p1)) return 'Master ';
      if (/achieve/i.test(p1)) return 'Achieve ';
      return '';
    }
  );
  text = text.replace(/^By Day \d+[:,\s]*/i, '');

  // Convert past-tense participle chains into active imperative verbs
  text = text.replace(/^designed,\s*developed,\s*and\s*deployed\s*/i, 'Design, develop, and deploy ');
  text = text.replace(/^designed\s*and\s*deployed\s*/i, 'Design and deploy ');
  text = text.replace(/^built\s*and\s*deployed\s*/i, 'Build and deploy ');
  text = text.replace(/^built\s*and\s*launched\s*/i, 'Build and launch ');
  text = text.replace(/^developed\s*and\s*deployed\s*/i, 'Develop and deploy ');
  text = text.replace(/^created\s*and\s*launched\s*/i, 'Create and launch ');
  text = text.replace(/^mastered\s*/i, 'Master ');
  text = text.replace(/^learned\s*/i, 'Learn ');

  // Cut off long run-on secondary specifications
  const specDelimiters = [
    /,\s*complete with\b.*/i,
    /,\s*featuring\b.*/i,
    /,\s*accessible via\b.*/i,
    /,\s*demonstrating\b.*/i,
    /,\s*including\b.*/i,
    /\s+with measurable proof of performance\b.*/i,
  ];

  for (const delim of specDelimiters) {
    text = text.replace(delim, '');
  }

  // Clean filler words like "a fully functional"
  text = text.replace(/\ba fully functional\s+/i, 'a ');

  // Capitalize first character
  text = text.trim();
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Strip trailing punctuation
  text = text.replace(/[.,;:]+$/, '');

  return text || rawGoal?.trim() || 'Your 90-Day Plan';
}

/** Formats passIf standard, avoiding duplicate terminal punctuation. */
export function formatPassIf(passIf?: string | null): string {
  if (!passIf) return '';
  const trimmed = passIf.trim();
  if (!trimmed) return '';
  if (/[.!?]$/.test(trimmed)) return `Pass if ${trimmed}`;
  return `Pass if ${trimmed}.`;
}

function metricRepeatsUnit(metric: string, unit: string): boolean {
  const m = metric.toLowerCase().trim();
  const u = unit.toLowerCase().trim();
  const initials = m.split(/\s+/).map((word) => word[0]).join('');
  return !m || m === u || m.includes(u) || u.includes(m) || initials === u.replace(/[^a-z]/g, '');
}

export function formatTarget(target: { kind: string; metric?: string; value?: number; unit?: string; direction?: string; description?: string }): string {
  if (target.kind === 'deliverable') return target.description || '';
  const value = target.value ?? 0;
  const unit = target.unit || '';
  const amount = `${Math.round(value * 100) / 100} ${unit}`;
  const suffix = target.direction === 'lower_is_better' ? ' or less' : '';
  const metric = target.metric || '';
  return metricRepeatsUnit(metric, unit) ? `${amount}${suffix}` : `${metric}: ${amount}${suffix}`;
}

