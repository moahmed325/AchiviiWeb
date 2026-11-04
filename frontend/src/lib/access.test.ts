import { describe, expect, it } from 'vitest';
import { trialDaysLeft } from './access';

describe('trialDaysLeft (ND-37)', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  it('counts today, so the last day is 1, and an ended trial 0', () => {
    expect(trialDaysLeft('2026-11-27T12:00:00Z', now)).toBe(7);
    expect(trialDaysLeft('2026-11-20T18:00:00Z', now)).toBe(1);
    expect(trialDaysLeft('2026-11-20T11:00:00Z', now)).toBe(0);
  });
  it('a trial not started yet has all 30 days', () => {
    expect(trialDaysLeft(null, now)).toBe(30);
  });
});
