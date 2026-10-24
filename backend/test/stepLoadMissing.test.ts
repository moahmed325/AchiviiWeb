import { describe, it, expect } from 'vitest';
import { loadNeed, missingLoad } from '../src/lib/safety/stepLoad.js';

describe('missingLoad: hardRun only when running is named (B-93)', () => {
  it('does not ask a 0-running load (a walk) for hardRun', () => {
    expect(missingLoad({ runMinutes: 0, kcalDeficit: 300 }, 'any')).toBeNull();
    expect(missingLoad({ runKm: 0 }, null)).toBeNull();
  });

  it('still asks a load with running above 0 for hardRun', () => {
    expect(missingLoad({ runMinutes: 20 }, 'any')).toBe('hardRun');
    expect(missingLoad({ runKm: 3 }, null)).toBe('hardRun');
  });

  it('keeps a run step needing a running number and hardRun', () => {
    expect(missingLoad({ runMinutes: 0, hardRun: false }, 'run')).toBeNull();
    expect(missingLoad({}, 'run')).toBe('runMinutes or runKm, and hardRun');
  });
});

describe('loadNeed: a profile kind marked highLoad (B-89)', () => {
  it('asks a step of such a kind for a load, even unflagged', () => {
    expect(loadNeed({ kind: 'tempo_run', highLoad: false }, false, { running: true, highLoadKinds: ['tempo_run'] })).toBe('any');
    expect(loadNeed({ kind: 'tempo_run', highLoad: false }, false, { running: true })).toBeNull();
  });
});
