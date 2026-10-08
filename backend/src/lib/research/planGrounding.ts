export interface BasisBadge {
  label: string;
  /** True only for a corroborated named program. Never true for thin evidence. */
  anchored: boolean;
}

/**
 * What we tell the user the plan is based on.
 * A gold / "anchored" line is only for a named program that independent sources agreed on.
 */
export function formatBasisBadge(input: {
  methodKind?: string | null;
  methodConfidence?: string | null;
  methodName?: string | null;
  authority?: string | null;
}): BasisBadge | null {
  if (!input.methodKind && !input.methodConfidence) return null;

  const corroborated =
    input.methodKind === 'named_program' &&
    (input.methodConfidence === 'high_consensus' || input.methodConfidence === 'medium_consensus') &&
    Boolean(input.methodName?.trim());

  if (corroborated) {
    const who = input.authority?.trim() ? ` (${input.authority.trim()})` : '';
    return { label: `Anchored to ${input.methodName!.trim()}${who}`, anchored: true };
  }

  if (input.methodKind === 'model_recommended') {
    const name = input.methodName?.trim();
    const who = input.authority?.trim() ? ` (${input.authority.trim()})` : '';
    return { label: name ? `Recommended method: ${name}${who}` : 'Recommended method for your answers', anchored: false };
  }
  if (input.methodKind === 'shared_pattern') {
    return { label: 'Built from common practice — no single official method', anchored: false };
  }
  if (input.methodKind === 'technique') {
    return { label: 'No official program. Built from these sources', anchored: false };
  }
  if (input.methodKind === 'single_source') {
    return { label: 'Based on this source — thin evidence', anchored: false };
  }

  return { label: 'No single agreed method. Built from what the sources teach', anchored: false };
}
