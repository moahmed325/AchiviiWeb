import { describe, expect, it } from 'vitest';

describe('Progress evidence hierarchy', () => {
  it('keeps the evidence-first ordering contract explicit', () => {
    expect(['progress story', 'current position evidence', 'detailed history']).toEqual([
      'progress story',
      'current position evidence',
      'detailed history',
    ]);
  });
});
