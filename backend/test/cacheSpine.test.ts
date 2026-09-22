import { describe, it, expect } from 'vitest';
import { groundingFromCachedMethod, methodFromResearch } from '../src/lib/research/cacheSpine.js';
import type { CanonResearchResult } from '../src/lib/research/types.js';

const research = {
  methodKind: 'shared_pattern',
  methodConfidence: 'medium_consensus',
  methodName: 'Home typing practice',
  teachings: ['Keep your fingers on the home row.'],
  assumptions: 'A beginner.',
  allowedUrls: ['https://example.org/typing'],
  velocityTable: {
    week1Targets: [{ metric: 'words per minute', value: 20, unit: 'words per minute', direction: 'higher_is_harder' as const }],
    week12Targets: [{ metric: 'words per minute', value: 40, unit: 'words per minute', direction: 'higher_is_harder' as const }],
    progressionFormula: 'Add speed each week.',
    assumptions: 'A beginner.',
  },
} as Pick<
  CanonResearchResult,
  | 'methodKind'
  | 'methodConfidence'
  | 'methodName'
  | 'authority'
  | 'sourceUrl'
  | 'teachings'
  | 'assumptions'
  | 'allowedUrls'
  | 'velocityTable'
>;

describe('research cache spine', () => {
  it('round-trips a researched spine into grounding', () => {
    const grounding = groundingFromCachedMethod(methodFromResearch(research));
    expect(grounding?.teachings).toEqual(['Keep your fingers on the home row.']);
    expect(grounding?.methodConfidence).toBe('medium_consensus');
    expect(grounding?.velocityTable?.week12Targets[0].value).toBe(40);
    expect(grounding?.allowedUrls).toEqual(['https://example.org/typing']);
  });

  it('ignores a cache row that has no teachings', () => {
    expect(groundingFromCachedMethod({ methodName: 'old row', confidence: 'high_consensus' })).toBeNull();
    expect(groundingFromCachedMethod('not json')).toBeNull();
  });
});
