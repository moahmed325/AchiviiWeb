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
