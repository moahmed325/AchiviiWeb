/**
 * Method-aware recovery, M1.2: the 10 certified pathways' hand-written profiles (RULE-2), keyed by preset id.
 * Each is its domain template. M1.2 read every preset's method text (`lib/ai/presets/*.ts`) and found no place
 * where the method needs the template changed (the misfits M1.1 found were fixed in the templates, MR-20); the
 * reasons are recorded in docs/features/method-aware-recovery/milestones/m1.2-profiles-and-templates.md.
 */
import type { RecoveryProfile, TemplateId } from './profile.js';
import { templateProfile } from './templates.js';

/** Preset id (`CertifiedPresetBlueprint.id`) to its template. */
export const PATHWAY_TEMPLATES: Readonly<Record<string, TemplateId>> = {
  run10k: 'endurance',
  body_recomposition_90day: 'strength',
  spanish_conversation: 'language',
  guitar5songs: 'instrument',
  book_30k_words: 'writing',
  saas_first_customer: 'product',
  ted_speech_15min: 'speaking',
  deep_work_focus: 'habit',
  youtube_12_videos: 'content',
  chess_1200_rating: 'strategy_games',
};

function pathwayProfile(presetId: string): RecoveryProfile {
  return { ...templateProfile(PATHWAY_TEMPLATES[presetId]), pathway: presetId };
}

export const PATHWAY_PROFILES: Readonly<Record<string, RecoveryProfile>> = Object.fromEntries(
  Object.keys(PATHWAY_TEMPLATES).map((presetId) => [presetId, pathwayProfile(presetId)])
);

/** A copy of a pathway's profile, or null for an id that is not a certified pathway. */
export function profileForPathway(presetId: string): RecoveryProfile | null {
  const profile = PATHWAY_PROFILES[presetId];
  return profile ? structuredClone(profile) : null;
}
