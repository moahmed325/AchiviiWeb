import { describe, it, expect } from 'vitest';
import { CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';
import { profileForPathway } from '../src/lib/recovery/pathways.js';
import type { RecoveryKind } from '../src/lib/recovery/profile.js';

// The adherence prose onboarding shows (EvidenceTriad) must describe what the app really does when a day doesn't
// happen, and follow the copy rules (method-aware recovery M4.1, section 6, MR-38; missed sessions M5.2).
const pillars = () =>
  CERTIFIED_PRESETS.flatMap((preset) => {
    const triad = preset.evidenceTriad;
    if (!triad) return [];
    return [triad.science, triad.socialAdherence, triad.proCoaching].flatMap((pillar) => [
      { id: preset.id, field: 'coreRule', text: pillar.coreRule },
      { id: preset.id, field: 'realWorldApplication', text: pillar.realWorldApplication },
    ]);
  });

const socialAdherence = (id: string) => {
  const triad = CERTIFIED_PRESETS.find((preset) => preset.id === id)?.evidenceTriad;
  if (!triad) throw new Error('no evidence triad for ' + id);
  return triad.socialAdherence;
};

const kindOf = (pathway: string, id: string): RecoveryKind => {
  const kind = profileForPathway(pathway)?.kinds.find((k) => k.id === id);
  if (!kind) throw new Error(pathway + ' has no kind ' + id);
  return kind;
};

const RUN10K =
  "If a run doesn't happen, an easy run is let go, and a workout or long run moves to a later day only when it fits with enough rest around it. Nothing piles up and no day gets longer.";
const GUITAR =
  "If a day doesn't happen, short drills are let go, new song sections keep their order (the one you didn't get to comes first in your next learning session), and a play-through moves to a later day. No day gets longer.";
const SAAS =
  "If a day doesn't happen, your next build session picks up where you left off, customer and launch steps move to a later day when they fit, and the daily share-it push is let go. No day gets longer.";

describe('certified preset adherence copy: the copy rules', () => {
  it('no pillar says "missed", "behind", "failed" or "fail", or asks why', () => {
    for (const { id, field, text } of pillars()) {
      // "failure" in a different sense (book: "makes failure impossible"; recomp: "technical failure") is unrelated
      // product copy, listed in missed sessions M5.
      expect(text, id + ' ' + field).not.toMatch(/missed|behind|\bfailed\b|\bfail\b|\bwhy\b/i);
    }
  });

  it('no pillar promises a buffer or a step that shifts by itself (B-4)', () => {
    for (const { id, field, text } of pillars()) {
      expect(text, id + ' ' + field).not.toMatch(/buffer|shifts? (automatically|seamlessly)/i);
    }
  });
});

describe('certified preset adherence copy: the exact words (M4.1 requirements 1 to 4)', () => {
  it('run10k keeps its text around the new line', () => {
    expect(socialAdherence('run10k').realWorldApplication).toBe(
      'Sessions fit around work, commute, and family. ' + RUN10K + ' Never two rest days in a row.'
    );
  });

  it('guitar and saas end with their new lines', () => {
    expect(socialAdherence('guitar5songs').realWorldApplication).toBe(
      'No boring chromatic scales. Day 1 teaches chords to real anthems people love. Short daily sessions fit around work. ' + GUITAR
    );
    expect(socialAdherence('saas_first_customer').realWorldApplication).toBe(
      'Prevents framework rabbit holes and weekend burnout. 45-minute daily sprints fit around work and family. ' + SAAS
    );
  });

  it('the four pillar titles say "Nothing Piles Up" instead of a buffer', () => {
    expect(socialAdherence('run10k').coreRule).toBe('High-Density 35-45m Sessions + 2-Day Rule + Nothing Piles Up.');
    expect(socialAdherence('guitar5songs').coreRule).toBe('Recognizable Riffs on Day 1 + 25-30m Sweet Spot + Nothing Piles Up.');
    expect(socialAdherence('saas_first_customer').coreRule).toBe('Boring Stack Mandate + 45-Minute Time-Boxed Sprints + Nothing Piles Up.');
    expect(socialAdherence('spanish_conversation').coreRule).toBe('Commute-Friendly 30m Audio Sprints + Day 1 Spoken Wins + Nothing Piles Up.');
  });
});

// Each clause of the three lines is a fact about the pathway's profile; a profile change that makes a clause untrue
// fails here (M4.1 requirement 6).
describe('certified preset adherence copy: every clause matches the pathway profile', () => {
  it('run10k: an easy run is let go; a workout or long run moves, is hard, and keeps a rest gap', () => {
    expect(kindOf('run10k', 'easy_session').action).toBe('let_go');
    for (const id of ['quality_session', 'long_session']) {
      expect(kindOf('run10k', id), id).toMatchObject({ action: 'move', hard: true });
    }
    // "with enough rest around it": hard moves keep the profile's rest gap (RULE-14).
    expect(profileForPathway('run10k')!.restGapDays).toBeGreaterThan(0);
  });

  it('guitar: drills are let go, new sections move in order, a play-through moves', () => {
    expect(kindOf('guitar5songs', 'technique_drills').action).toBe('let_go');
    expect(kindOf('guitar5songs', 'new_piece_or_section')).toMatchObject({ action: 'move', inOrder: true });
    expect(kindOf('guitar5songs', 'play_through_or_recording').action).toBe('move');
  });

  it('saas: build work continues, customer and launch steps move (launch in order), the daily push is let go', () => {
    expect(kindOf('saas_first_customer', 'build_work').action).toBe('continue');
    expect(kindOf('saas_first_customer', 'customer_conversations_and_outreach').action).toBe('move');
    expect(kindOf('saas_first_customer', 'launch_or_shipping_step')).toMatchObject({ action: 'move', inOrder: true });
    expect(kindOf('saas_first_customer', 'daily_distribution_sprint').action).toBe('let_go');
  });
});
