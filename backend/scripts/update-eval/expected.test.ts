import { describe, expect, it } from 'vitest';
import { readJson } from './goals.js';
import type { EvalCase } from './cases.js';
import type { Expected } from './score.js';

const cases = readJson<EvalCase[]>('cases.json');

describe('update eval expected answers', () => {
  it('has one expected answer per case, in the allowed values', () => {
    const expected = readJson<Expected[]>('expected.json');
    expect(expected.map((row) => row.caseId).sort()).toEqual(cases.map((c) => c.id).sort());
    for (const row of expected) {
      expect(['on_track', 'a_bit_behind', 'far_behind'], row.caseId).toContain(row.status);
      expect(['raise', 'hold', 'lower'], row.caseId).toContain(row.direction);
      expect(row.holds.every((hold) => ['far_behind', 'not_logged', 'week_behind'].includes(hold)), row.caseId).toBe(true);
      expect(row.lower.every((week) => week > cases.find((c) => c.id === row.caseId)!.week && week <= 12), row.caseId).toBe(true);
    }
  });
});
