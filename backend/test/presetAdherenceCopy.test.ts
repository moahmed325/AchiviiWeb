import { describe, it, expect } from 'vitest';
import { CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';

// Missed sessions M5.2: the adherence prose onboarding shows (EvidenceTriad) must describe what the app really does
// when a day doesn't happen, and follow the copy rules (Feature Definition section 12).
const adherence = () =>
  CERTIFIED_PRESETS.map((preset) => ({ id: preset.id, text: preset.evidenceTriad?.socialAdherence.realWorldApplication ?? '' }));

describe('certified preset adherence copy', () => {
  it('never says "missed", "behind" or "failed", and never asks why', () => {
    for (const { id, text } of adherence()) {
      // "failure" in a different sense (book: "makes failure impossible") is unrelated product copy, listed in M5.
      expect(text, id).not.toMatch(/missed|behind|\bfailed\b|\bwhy\b/i);
    }
  });

  it('promises no weekend buffer: nothing moves into the weekend', () => {
    for (const { id, text } of adherence()) {
      expect(text, id).not.toMatch(/weekend buffer|shifts? (automatically|seamlessly)/i);
    }
  });

  it('says what happens: the step moves if it fits, a run is never doubled up, and no day gets longer', () => {
    const byId = Object.fromEntries(adherence().map(({ id, text }) => [id, text]));
    const run10k = CERTIFIED_PRESETS.find((p) => /10k/i.test(p.id))!.id;
    const guitar = CERTIFIED_PRESETS.find((p) => /guitar/i.test(p.id))!.id;
    const saas = CERTIFIED_PRESETS.find((p) => /saas/i.test(p.id))!.id;
    for (const id of [guitar, saas]) {
      expect(byId[id], id).toContain("If a day doesn't happen, its most important step moves to your next practice day if it fits, and no day gets longer.");
    }
    // run10k steps are high-load (M2.1), so they are dropped, never carried (RULE-10).
    expect(byId[run10k]).toContain("If a run doesn't happen, nothing piles up: there is no catching up, and no day gets longer.");
    expect(byId[run10k]).not.toMatch(/moves to/);
  });
});
