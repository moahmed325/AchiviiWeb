import { CertifiedPresetBlueprint, VDOTPacingEntry, BPMPacingEntry, SaaSVelocityEntry, LanguageVelocityEntry, RecompPacingEntry, YouTubeVelocityEntry, WritingVelocityEntry, DeepWorkVelocityEntry, ChessVelocityEntry, SpeechVelocityEntry } from './types.js';
import { run10kPreset } from './run10k.js';
import { guitarPreset } from './guitar.js';
import { saasPreset } from './saas.js';
import { spanishPreset } from './spanish.js';
import { recompPreset } from './recomp.js';
import { youtubePreset } from './youtube.js';
import { bookPreset } from './book.js';
import { deepWorkPreset } from './deepwork.js';
import { chessPreset } from './chess.js';
import { speechPreset } from './speech.js';

export * from './types.js';
export { run10kPreset, guitarPreset, saasPreset, spanishPreset, recompPreset, youtubePreset, bookPreset, deepWorkPreset, chessPreset, speechPreset };

export const CERTIFIED_PRESETS: CertifiedPresetBlueprint[] = [
  run10kPreset,
  guitarPreset,
  saasPreset,
  spanishPreset,
  recompPreset,
  youtubePreset,
  bookPreset,
  deepWorkPreset,
  chessPreset,
  speechPreset
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

/**
 * Helper to look up the BPM metronome pacing entry for a user given their baseline diagnostic answer.
 */
export function getBPMPacingEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): BPMPacingEntry | undefined {
  if (!blueprint.bpmPacingTable || !blueprint.bpmPacingTable.length) return undefined;
  if (!baselineAnswer) return blueprint.bpmPacingTable[0]; // default to complete_beginner

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('complete') || lower.includes('never') || lower.includes('zero') || lower.includes('first chords')) {
    return blueprint.bpmPacingTable.find(b => b.baselineKey === 'complete_beginner') || blueprint.bpmPacingTable[0];
  }
  if (lower.includes('early') || lower.includes('2-3') || lower.includes('pause') || lower.includes('switch')) {
    return blueprint.bpmPacingTable.find(b => b.baselineKey === 'early_beginner') || blueprint.bpmPacingTable[1];
  }
  if (lower.includes('novice') || lower.includes('plateau') || lower.includes('barre') || lower.includes('singing')) {
    return blueprint.bpmPacingTable.find(b => b.baselineKey === 'novice_plateau') || blueprint.bpmPacingTable[2];
  }
  if (lower.includes('rusty') || lower.includes('return') || lower.includes('past') || lower.includes('rebuilding')) {
    return blueprint.bpmPacingTable.find(b => b.baselineKey === 'rusty_returner') || blueprint.bpmPacingTable[3];
  }

  return blueprint.bpmPacingTable[0];
}

/**
 * Helper to look up the SaaS velocity entry for a user given their baseline diagnostic answer.
 */
export function getSaaSVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): SaaSVelocityEntry | undefined {
  if (!blueprint.saasVelocityTable || !blueprint.saasVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.saasVelocityTable[0]; // default to first_time

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('first') || lower.includes('beginner') || lower.includes('learning')) {
    return blueprint.saasVelocityTable.find(s => s.baselineKey === 'first_time') || blueprint.saasVelocityTable[0];
  }
  if (lower.includes('frontend') || lower.includes('react') || lower.includes('ui')) {
    return blueprint.saasVelocityTable.find(s => s.baselineKey === 'frontend_spec') || blueprint.saasVelocityTable[1];
  }
  if (lower.includes('backend') || lower.includes('systems') || lower.includes('sql') || lower.includes('api')) {
    return blueprint.saasVelocityTable.find(s => s.baselineKey === 'backend_spec') || blueprint.saasVelocityTable[2];
  }
  if (lower.includes('full') || lower.includes('experienced') || lower.includes('stack')) {
    return blueprint.saasVelocityTable.find(s => s.baselineKey === 'full_stack') || blueprint.saasVelocityTable[3];
  }

  return blueprint.saasVelocityTable[0];
}

/**
 * Helper to look up the Language velocity entry for a user given their baseline diagnostic answer.
 */
export function getLanguageVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): LanguageVelocityEntry | undefined {
  if (!blueprint.languageVelocityTable || !blueprint.languageVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.languageVelocityTable[0]; // default to complete_beginner

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('complete') || lower.includes('a0') || lower.includes('scratch') || lower.includes('never')) {
    return blueprint.languageVelocityTable.find(l => l.baselineKey === 'complete_beginner') || blueprint.languageVelocityTable[0];
  }
  if (lower.includes('false') || lower.includes('a1') || lower.includes('scattered') || lower.includes('app')) {
    return blueprint.languageVelocityTable.find(l => l.baselineKey === 'false_beginner') || blueprint.languageVelocityTable[1];
  }
  if (lower.includes('intermediate') || lower.includes('a2') || lower.includes('plateau') || lower.includes('freeze')) {
    return blueprint.languageVelocityTable.find(l => l.baselineKey === 'intermediate_plateau') || blueprint.languageVelocityTable[2];
  }
  if (lower.includes('rusty') || lower.includes('b1') || lower.includes('used to') || lower.includes('refresher')) {
    return blueprint.languageVelocityTable.find(l => l.baselineKey === 'rusty_refresher') || blueprint.languageVelocityTable[3];
  }

  return blueprint.languageVelocityTable[0];
}

/**
 * Helper to look up the Recomp pacing entry for a user given their baseline diagnostic answer.
 */
export function getRecompPacingEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): RecompPacingEntry | undefined {
  if (!blueprint.recompPacingTable || !blueprint.recompPacingTable.length) return undefined;
  if (!baselineAnswer) return blueprint.recompPacingTable[0]; // default to true_beginner

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('beginner') || lower.includes('untrained') || lower.includes('never') || lower.includes('little to no')) {
    return blueprint.recompPacingTable.find(r => r.baselineKey === 'true_beginner') || blueprint.recompPacingTable[0];
  }
  if (lower.includes('skinny') || lower.includes('sedentary') || lower.includes('normal bmi') || lower.includes('abdominal')) {
    return blueprint.recompPacingTable.find(r => r.baselineKey === 'skinny_fat') || blueprint.recompPacingTable[1];
  }
  if (lower.includes('overfat') || lower.includes('intermediate') || lower.includes('20%') || lower.includes('1+')) {
    return blueprint.recompPacingTable.find(r => r.baselineKey === 'overfat_intermediate') || blueprint.recompPacingTable[2];
  }
  if (lower.includes('athletic') || lower.includes('advanced') || lower.includes('single-digit') || lower.includes('cut')) {
    return blueprint.recompPacingTable.find(r => r.baselineKey === 'athletic_cut') || blueprint.recompPacingTable[3];
  }

  return blueprint.recompPacingTable[0];
}

/**
 * Helper to look up the YouTube velocity entry for a user given their baseline diagnostic answer.
 */
export function getYouTubeVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): YouTubeVelocityEntry | undefined {
  if (!blueprint.youtubeVelocityTable || !blueprint.youtubeVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.youtubeVelocityTable[0]; // default to camera_shy_beginner

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('shy') || lower.includes('beginner') || lower.includes('never recorded') || lower.includes('presence')) {
    return blueprint.youtubeVelocityTable.find(y => y.baselineKey === 'camera_shy_beginner') || blueprint.youtubeVelocityTable[0];
  }
  if (lower.includes('expert') || lower.includes('educator') || lower.includes('knowledge') || lower.includes('deep')) {
    return blueprint.youtubeVelocityTable.find(y => y.baselineKey === 'domain_expert') || blueprint.youtubeVelocityTable[1];
  }
  if (lower.includes('casual') || lower.includes('hobbyist') || lower.includes('basic editing') || lower.includes('struggle')) {
    return blueprint.youtubeVelocityTable.find(y => y.baselineKey === 'casual_hobbyist') || blueprint.youtubeVelocityTable[2];
  }
  if (lower.includes('fast') || lower.includes('marketer') || lower.includes('growth') || lower.includes('comfortable')) {
    return blueprint.youtubeVelocityTable.find(y => y.baselineKey === 'fast_track') || blueprint.youtubeVelocityTable[3];
  }

  return blueprint.youtubeVelocityTable[0];
}

/**
 * Helper to look up the Writing velocity entry for a user given their baseline diagnostic answer.
 */
export function getWritingVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): WritingVelocityEntry | undefined {
  if (!blueprint.writingVelocityTable || !blueprint.writingVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.writingVelocityTable[0]; // default to first_time_author

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('first') || lower.includes('aspiring') || lower.includes('never written') || lower.includes('momentum')) {
    return blueprint.writingVelocityTable.find(w => w.baselineKey === 'first_time_author') || blueprint.writingVelocityTable[0];
  }
  if (lower.includes('expert') || lower.includes('professional') || lower.includes('deep domain') || lower.includes('articles')) {
    return blueprint.writingVelocityTable.find(w => w.baselineKey === 'subject_matter_expert') || blueprint.writingVelocityTable[1];
  }
  if (lower.includes('fiction') || lower.includes('story') || lower.includes('novella') || lower.includes('narrative')) {
    return blueprint.writingVelocityTable.find(w => w.baselineKey === 'fiction_novella') || blueprint.writingVelocityTable[2];
  }
  if (lower.includes('prolific') || lower.includes('fast') || lower.includes('1,000') || lower.includes('blogger')) {
    return blueprint.writingVelocityTable.find(w => w.baselineKey === 'prolific_drafter') || blueprint.writingVelocityTable[3];
  }

  return blueprint.writingVelocityTable[0];
}

/**
 * Helper to look up the Deep Work velocity entry for a user given their baseline diagnostic answer.
 */
export function getDeepWorkVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): DeepWorkVelocityEntry | undefined {
  if (!blueprint.deepWorkVelocityTable || !blueprint.deepWorkVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.deepWorkVelocityTable[0]; // default to scattered_multitasker

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('scattered') || lower.includes('multitasker') || lower.includes('30') || lower.includes('struggle')) {
    return blueprint.deepWorkVelocityTable.find(d => d.baselineKey === 'scattered_multitasker') || blueprint.deepWorkVelocityTable[0];
  }
  if (lower.includes('novice') || lower.includes('60') || lower.includes('interrupted') || lower.includes('notifications')) {
    return blueprint.deepWorkVelocityTable.find(d => d.baselineKey === 'novice_deep_worker') || blueprint.deepWorkVelocityTable[1];
  }
  if (lower.includes('structured') || lower.includes('professional') || lower.includes('2-hour') || lower.includes('meeting')) {
    return blueprint.deepWorkVelocityTable.find(d => d.baselineKey === 'structured_professional') || blueprint.deepWorkVelocityTable[2];
  }
  if (lower.includes('advanced') || lower.includes('elite') || lower.includes('4-hour') || lower.includes('ceiling')) {
    return blueprint.deepWorkVelocityTable.find(d => d.baselineKey === 'advanced_focus') || blueprint.deepWorkVelocityTable[3];
  }

  return blueprint.deepWorkVelocityTable[0];
}

/**
 * Helper to look up the Chess velocity entry for a user given their baseline diagnostic answer.
 */
export function getChessVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): ChessVelocityEntry | undefined {
  if (!blueprint.chessVelocityTable || !blueprint.chessVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.chessVelocityTable[0]; // default to under_600

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('<600') || lower.includes('under 600') || lower.includes('beginner') || lower.includes('unrated')) {
    return blueprint.chessVelocityTable.find(c => c.baselineKey === 'under_600') || blueprint.chessVelocityTable[0];
  }
  if (lower.includes('600') || lower.includes('novice') || lower.includes('700') || lower.includes('800')) {
    return blueprint.chessVelocityTable.find(c => c.baselineKey === '600_800') || blueprint.chessVelocityTable[1];
  }
  if (lower.includes('club') || lower.includes('aspirant') || lower.includes('900') || lower.includes('1000')) {
    return blueprint.chessVelocityTable.find(c => c.baselineKey === '800_1000') || blueprint.chessVelocityTable[2];
  }
  if (lower.includes('advanced') || lower.includes('1100') || lower.includes('1200')) {
    return blueprint.chessVelocityTable.find(c => c.baselineKey === '1000_1200') || blueprint.chessVelocityTable[3];
  }

  return blueprint.chessVelocityTable[0];
}

/**
 * Helper to look up the Speech velocity entry for a user given their baseline diagnostic answer.
 */
export function getSpeechVelocityEntry(
  baselineAnswer: string | undefined,
  blueprint: CertifiedPresetBlueprint
): SpeechVelocityEntry | undefined {
  if (!blueprint.speechVelocityTable || !blueprint.speechVelocityTable.length) return undefined;
  if (!baselineAnswer) return blueprint.speechVelocityTable[0]; // default to stage_fright_novice

  const lower = baselineAnswer.toLowerCase();
  if (lower.includes('fright') || lower.includes('anxiety') || lower.includes('novice') || lower.includes('avoid')) {
    return blueprint.speechVelocityTable.find(s => s.baselineKey === 'stage_fright_novice') || blueprint.speechVelocityTable[0];
  }
  if (lower.includes('technical') || lower.includes('slides') || lower.includes('meetings') || lower.includes('robotic')) {
    return blueprint.speechVelocityTable.find(s => s.baselineKey === 'technical_presenter') || blueprint.speechVelocityTable[1];
  }
  if (lower.includes('experienced') || lower.includes('regularly') || lower.includes('groups') || lower.includes('elevate')) {
    return blueprint.speechVelocityTable.find(s => s.baselineKey === 'experienced_speaker') || blueprint.speechVelocityTable[2];
  }
  if (lower.includes('keynote') || lower.includes('tedx') || lower.includes('conference') || lower.includes('all-hands')) {
    return blueprint.speechVelocityTable.find(s => s.baselineKey === 'keynote_aspirant') || blueprint.speechVelocityTable[3];
  }

  return blueprint.speechVelocityTable[0];
}


