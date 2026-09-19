import { CertifiedPresetBlueprint, VDOTPacingEntry } from './types.js';
import { run10kPreset } from './run10k.js';

export * from './types.js';
export { run10kPreset };

export const CERTIFIED_PRESETS: CertifiedPresetBlueprint[] = [
  run10kPreset
];

/**
 * Match a user's raw goal text to a certified preset blueprint if one exists.
 */
export function findPresetForGoal(goalText: string): CertifiedPresetBlueprint | null {
  if (!goalText || !goalText.trim()) return null;
  const normalized = goalText.trim().toLowerCase();

  for (const preset of CERTIFIED_PRESETS) {
    // Check direct ID or title equality
    if (normalized === preset.id.toLowerCase() || normalized === preset.title.toLowerCase()) {
      return preset;
    }

    // Check regex matching patterns
    for (const pattern of preset.matchingPatterns) {
      if (pattern.test(normalized)) {
        return preset;
      }
    }
  }

  return null;
}

/**
 * Helper to look up the VDOT pacing entry for a user given their baseline diagnostic answer.
 */
export function getVDOTPacingEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): VDOTPacingEntry | undefined {
  if (!blueprint.vdotPacingTable || !blueprint.vdotPacingTable.length) return undefined;
  if (!baselineAnswer) return blueprint.vdotPacingTable[1]; // default to 24_27 (middle)

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('sub-24') || lower.includes('< 24') || lower.includes('under 24')) {
    return blueprint.vdotPacingTable.find(v => v.baselineKey === 'under_24') || blueprint.vdotPacingTable[0];
  }
  if (lower.includes('24 to 27') || lower.includes('24-27') || lower.includes('25') || lower.includes('26')) {
    return blueprint.vdotPacingTable.find(v => v.baselineKey === '24_27') || blueprint.vdotPacingTable[1];
  }
  if (lower.includes('27 to 30') || lower.includes('27-30') || lower.includes('28') || lower.includes('29')) {
    return blueprint.vdotPacingTable.find(v => v.baselineKey === '27_30') || blueprint.vdotPacingTable[2];
  }
  if (lower.includes('over 30') || lower.includes('> 30') || lower.includes('untimed')) {
    return blueprint.vdotPacingTable.find(v => v.baselineKey === 'over_30') || blueprint.vdotPacingTable[3];
  }

  return blueprint.vdotPacingTable[1];
}
