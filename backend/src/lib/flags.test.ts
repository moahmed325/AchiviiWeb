import { afterEach, describe, expect, it, vi } from 'vitest';
import { flagOn, flagSummary } from './flags.js';

describe('feature switches (B-99 (4))', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on only for exactly "true"', () => {
    for (const value of ['', 'TRUE', '1', 'yes', ' true']) {
      vi.stubEnv('WEEK_CLOSE_ENABLED', value);
      expect(flagOn('WEEK_CLOSE_ENABLED')).toBe(false);
    }
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    expect(flagOn('WEEK_CLOSE_ENABLED')).toBe(true);
  });

  it('names every switch in the startup line', () => {
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
    vi.stubEnv('WEEK_CLOSE_ENABLED', '');
    const line = flagSummary();
    expect(line).toContain('METHOD_RECOVERY_ENABLED=on');
    expect(line).toContain('WEEK_CLOSE_ENABLED=off');
    expect(line.split(' ')).toHaveLength(5);
  });
});
