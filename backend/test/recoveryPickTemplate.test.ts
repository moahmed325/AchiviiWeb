import { describe, it, expect } from 'vitest';
import { pickTemplate, PATHWAY_TEMPLATES } from '../src/lib/recovery/index.js';
import { CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';
import { presetMethod } from '../src/lib/ai/roadmap.js';

// Method-aware recovery M1.2: the keyword table picks a template with no model call (RULE-3, MR-13, MR-14).

describe('pickTemplate', () => {
  for (const preset of CERTIFIED_PRESETS) {
    const expected = PATHWAY_TEMPLATES[preset.id];
    it(`picks ${expected} for the ${preset.id} pathway`, () => {
      expect(pickTemplate({ goalText: preset.title })).toBe(expected);
      expect(pickTemplate({ goalText: preset.clarifiedOutcome })).toBe(expected);
      expect(pickTemplate({ domain: preset.primaryDomain })).toBe(expected);
      expect(pickTemplate({ domain: preset.primaryDomain, goalText: preset.clarifiedOutcome, methodName: presetMethod(preset).name })).toBe(expected);
    });
  }

  it('B-38: gives the process template for sourdough and fermenting; General practice when nothing matches', () => {
    expect(pickTemplate({ goalText: 'Bake sourdough bread at home' })).toBe('process');
    expect(pickTemplate({ goalText: 'Brew my own kombucha' })).toBe('process');
    expect(pickTemplate({ goalText: 'Get better at securing my home network' })).not.toBe('process');
    expect(pickTemplate({ domain: 'Paper folding', goalText: 'Fold origami cranes at home', methodName: 'Yoshizawa method' })).toBe('general');
  });

  it('gives General practice with nothing to go on', () => {
    expect(pickTemplate({})).toBe('general');
    expect(pickTemplate({ domain: null, goalText: '', methodName: null })).toBe('general');
  });

  it('matches on the domain alone', () => {
    expect(pickTemplate({ domain: 'Drawing', goalText: 'Get much better this year' })).toBe('creative');
    expect(pickTemplate({ domain: 'Live streaming', goalText: 'Grow my audience' })).toBe('content');
    expect(pickTemplate({ domain: 'Exam preparation' })).toBe('exam');
  });

  it('lets the domain outweigh the goal text', () => {
    // The goal text says "run"; the domain says it is a business.
    expect(pickTemplate({ domain: 'Software product', goalText: 'Run my first startup launch' })).toBe('product');
  });

  it('matches on the method name when nothing else does', () => {
    expect(pickTemplate({ goalText: 'Get better at my hobby', methodName: 'Couch to 5K running plan' })).toBe('endurance');
  });
});
