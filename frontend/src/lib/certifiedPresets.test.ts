import { describe, expect, it } from 'vitest';
import {
  CERTIFIED_PATHWAYS,
  PATHWAY_DIRECTIONS,
  PATHWAY_GROUPS,
  findPathwayBySlug,
  findPathwayByTitle,
  groupPathways,
  pathwaysInDirection,
} from './certifiedPresets';

describe('pathway catalogue', () => {
  it('uses the six directions of OD-11, in display order', () => {
    expect(PATHWAY_DIRECTIONS).toEqual(['Career', 'Fitness', 'Learning', 'Creative', 'Business', 'Personal']);
    expect(PATHWAY_GROUPS.map((g) => g.direction)).toEqual([...PATHWAY_DIRECTIONS]);
  });

  it('keeps every pathway id, slug and matching title unchanged (ND-5)', () => {
    expect(CERTIFIED_PATHWAYS.map((p) => [p.id, p.title])).toEqual([
      ['saas', 'Build & Ship a SaaS Web App'],
      ['run10k', 'Run a 10K Under 50 Minutes'],
      ['guitar', 'Play 5 Songs on Acoustic Guitar'],
      ['spanish', 'Speak Conversational Spanish'],
      ['recomp', 'Drop 5% Body Fat & Build Lean Muscle'],
      ['youtube', 'Launch a YouTube Channel (12 Videos)'],
      ['book', 'Write & Polish a 30,000-Word Book'],
      ['deepwork', 'Master Deep Work & Double Daily Output'],
      ['chess', 'Climb to a 1200 Rapid Chess Rating'],
      ['speech', 'Deliver a 15-Minute TED-Style Speech'],
    ]);
  });

  it('gives every pathway one of the six directions and one display summary', () => {
    for (const p of CERTIFIED_PATHWAYS) {
      expect(PATHWAY_DIRECTIONS).toContain(p.direction);
      expect(p.summary.trim()).not.toBe('');
      expect(p).not.toHaveProperty('category');
      expect(p).not.toHaveProperty('tag');
    }
  });

  it('places every pathway in exactly one group, so all of them can be found', () => {
    const grouped = PATHWAY_GROUPS.flatMap((g) => g.pathways.map((p) => p.id));
    expect(grouped).toHaveLength(CERTIFIED_PATHWAYS.length);
    expect(new Set(grouped)).toEqual(new Set(CERTIFIED_PATHWAYS.map((p) => p.id)));
  });

  it('never shows an empty group', () => {
    for (const group of PATHWAY_GROUPS) expect(group.pathways.length).toBeGreaterThan(0);

    const withoutPersonal = CERTIFIED_PATHWAYS.filter((p) => p.direction !== 'Personal');
    expect(groupPathways(withoutPersonal).map((g) => g.direction)).toEqual(['Career', 'Fitness', 'Learning', 'Creative', 'Business']);
    expect(groupPathways([])).toEqual([]);
  });

  it('lists a direction’s pathways in catalogue order', () => {
    expect(pathwaysInDirection('Fitness').map((p) => p.id)).toEqual(['run10k', 'recomp']);
    expect(pathwaysInDirection('Career').map((p) => p.id)).toEqual(['speech']);
    expect(pathwaysInDirection(undefined)).toEqual([]);
  });
});

describe('findPathwayByTitle', () => {
  it('matches a goal that is exactly a pathway title, ignoring case and outer spaces', () => {
    expect(findPathwayByTitle('Run a 10K Under 50 Minutes')?.id).toBe('run10k');
    expect(findPathwayByTitle('  speak conversational spanish ')?.id).toBe('spanish');
  });

  it('does not treat a custom goal that mentions a pathway as that pathway', () => {
    expect(findPathwayByTitle('I want to run a 10K under 50 minutes by June')).toBeUndefined();
    expect(findPathwayByTitle('Guitar')).toBeUndefined();
    expect(findPathwayByTitle('')).toBeUndefined();
    expect(findPathwayByTitle(undefined)).toBeUndefined();
  });

  it('agrees with the slug lookup for every pathway', () => {
    for (const p of CERTIFIED_PATHWAYS) expect(findPathwayByTitle(p.title)).toBe(findPathwayBySlug(p.id));
  });
});
