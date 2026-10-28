import { describe, it, expect } from 'vitest';
import { formatBasisBadge } from '../src/lib/research/planGrounding.js';

// The goal's basis badge ("Anchored to ...", "Recommended method: ..."). Moved out of the retired clamps' test file
// (plan safety limits M3.1): B-104 deleted that file with these live tests in it.

describe('formatBasisBadge: honest basis', () => {
  it('never anchors a stone-skipping technique', () => {
    const badge = formatBasisBadge({
      methodKind: 'technique',
      methodConfidence: 'first_principles',
      methodName: 'Get good at competitive stone skipping technique',
    });
    expect(badge?.anchored).toBe(false);
    expect(badge?.label).not.toMatch(/anchored/i);
    expect(badge?.label).not.toMatch(/certified/i);
    expect(badge?.label).toMatch(/No official program/);
  });

  it('may anchor a corroborated named program such as MBSR', () => {
    const badge = formatBasisBadge({
      methodKind: 'named_program',
      methodConfidence: 'high_consensus',
      methodName: 'MBSR',
      authority: 'Jon Kabat-Zinn',
    });
    expect(badge).toEqual({
      label: 'Anchored to MBSR (Jon Kabat-Zinn)',
      anchored: true,
    });
  });

  it('does not anchor a named program that sources did not agree on', () => {
    const badge = formatBasisBadge({
      methodKind: 'named_program',
      methodConfidence: 'first_principles',
      methodName: 'MBSR',
      authority: 'Jon Kabat-Zinn',
    });
    expect(badge?.anchored).toBe(false);
    expect(badge?.label).not.toMatch(/Anchored/);
  });

  it('labels a model-chosen method as recommended, never anchored', () => {
    const badge = formatBasisBadge({
      methodKind: 'model_recommended',
      methodConfidence: 'first_principles',
      methodName: 'Keybr drills',
    });
    expect(badge?.anchored).toBe(false);
    expect(badge?.label).toBe('Recommended method: Keybr drills');
  });
});
