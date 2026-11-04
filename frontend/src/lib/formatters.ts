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
