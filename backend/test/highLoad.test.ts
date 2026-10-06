import { describe, it, expect } from 'vitest';
import { HIGH_LOAD_PRESET_IDS, isHighLoadGoal, isHighLoadStep } from '../src/lib/highLoad.js';
import { CERTIFIED_PRESETS, recompPreset, run10kPreset } from '../src/lib/ai/presets/index.js';

const goal = (rawGoal: string, clarifiedOutcome = '') => ({ rawGoal, clarifiedOutcome });
const RUN_10K = goal('Run a 10K under 50 minutes', 'Finish a 10 km race in under 50:00');
const CUSTOM = goal('Type 40 words per minute', 'Type 40 wpm at 95% accuracy on keybr.com');

describe('HIGH_LOAD_PRESET_IDS (ND-5)', () => {
  it('names exactly the run10k and recomp presets, by their real ids', () => {
    expect([...HIGH_LOAD_PRESET_IDS].sort()).toEqual([recompPreset.id, run10kPreset.id].sort());
    const ids = CERTIFIED_PRESETS.map((preset) => preset.id);
    for (const id of HIGH_LOAD_PRESET_IDS) expect(ids).toContain(id);
  });
});

describe('isHighLoadGoal', () => {
  it('is true for a run10k goal found by its raw goal', () => {
    expect(isHighLoadGoal(goal('Run a 10K under 50 minutes', 'Something unrelated'))).toBe(true);
  });

  it('is true for a recomp goal found by its clarified outcome only', () => {
    expect(isHighLoadGoal(goal('Get in better shape this summer', 'Lose fat and build muscle in a body recomposition'))).toBe(true);
  });

  it('is false for a non-physical preset (guitar)', () => {
    expect(isHighLoadGoal(goal('Learn guitar', 'Play 5 songs on guitar from memory'))).toBe(false);
  });

  it('is false for a custom goal', () => {
    expect(isHighLoadGoal(CUSTOM)).toBe(false);
  });

  it('is false for empty text', () => {
    expect(isHighLoadGoal(goal('', ''))).toBe(false);
    expect(isHighLoadGoal(goal('   ', '   '))).toBe(false);
  });
});

describe('isHighLoadStep', () => {
  it('counts a stored step without the flag on a run10k goal as high-load (goals written before M2.1)', () => {
    expect(isHighLoadStep({}, RUN_10K)).toBe(true);
    expect(isHighLoadStep({ highLoad: false }, RUN_10K)).toBe(true);
  });

  it('counts a step without the flag on a custom goal as normal', () => {
    expect(isHighLoadStep({}, CUSTOM)).toBe(false);
    expect(isHighLoadStep({ highLoad: false }, CUSTOM)).toBe(false);
  });

  it('counts highLoad: true on a custom goal as high-load', () => {
    expect(isHighLoadStep({ highLoad: true }, CUSTOM)).toBe(true);
  });
});
