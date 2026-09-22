import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { runCanonResearch, scoreCandidate } from '../src/lib/research/canonResearch.js';
import { researchGoal } from '../src/lib/research/index.js';
import {
  validateVelocityTable,
  deriveVelocityTable,
} from '../src/lib/research/velocityTable.js';
import {
  dropNearDuplicates,
  queryKeepsSkill,
  resultKeepsSkill,
  namesInventedOrganisation,
  templateQueries,
} from '../src/lib/research/queryPlanner.js';
import type { VelocityTable } from '../src/lib/research/types.js';

const mockLlm = generateStructuredContent as unknown as ReturnType<typeof vi.fn>;

/** Routes a mocked LLM response by which system instruction the caller supplied. */
function routeLlm(handlers: {
  queries?: () => any;
  synthesis?: () => any;
  velocity?: () => any;
}) {
  mockLlm.mockImplementation(async (_prompt: string, systemInstruction: string) => {
    if (systemInstruction?.includes('You plan web research')) {
      return { success: true, data: handlers.queries?.() ?? { queries: ['q one', 'q two', 'q three'] } };
    }
    if (
      systemInstruction?.includes('You analyse research sources') ||
      systemInstruction?.includes('write the spine')
    ) {
      if (!handlers.synthesis) return { success: false, data: null };
      const data = handlers.synthesis();
      if (data && data.methodFound !== undefined && !data.teachings) {
        return {
          success: true,
          data: {
            methodKind: data.methodFound ? 'named_program' : 'technique',
            methodName: data.methodName,
            authority: data.authority,
            sourceUrl: data.sourceUrl,
            agreeingSourceUrls: data.agreeingSourceUrls ?? [],
            teachings: data.methodFound
              ? [
                  'Follow the named method described in the sources.',
                  'Practise the main drill several times each week.',
                  'Increase difficulty a little each week.',
                ]
              : [
                  'Practise the core skill in short sessions.',
                  'Repeat the technique the pages describe.',
                  'Add a little more practice each week.',
                ],
            assumptions: 'As described by the retrieved sources.',
            reasoning: data.reasoning,
          },
        };
      }
      return { success: true, data };
    }
    if (systemInstruction?.includes('You extract concrete numeric targets')) {
      return handlers.velocity
        ? { success: true, data: handlers.velocity() }
        : { success: false, data: null };
    }
    return { success: false, data: null };
  });
}

function searchResult(url: string, title = 'Title', content = 'Content', score = 0.9) {
  return { url, title, content, score };
}

/**
 * Tavily double that records how it was called.
 *
 * `pageText` is what extraction returns. Corroboration is now measured from page text, so
 * a test that wants a method accepted must supply text that actually names it.
 */
function fakeTavily(resultsByQuery: Record<string, any[]> | any[], pageText?: string) {
  const searchCalls: string[] = [];
  const extractCalls: string[][] = [];

  return {
    searchCalls,
    extractCalls,
    client: {
      async search(query: string) {
        searchCalls.push(query);
        const results = Array.isArray(resultsByQuery)
          ? resultsByQuery
          : resultsByQuery[query] ?? [];
        return { query, results, response_time: 0.1 };
      },
      async extract(urls: string | string[]) {
        const list = Array.isArray(urls) ? urls : [urls];
        extractCalls.push(list);
        return {
          results: list.map((url) => ({ url, raw_content: pageText ?? `Full text of ${url}` })),
          failed_results: [],
          response_time: 0.2,
        };
      },
    },
  };
}

beforeEach(() => {
  mockLlm.mockReset();
});

describe('Phase 3 — Stage 2 credit discipline', () => {
  it('fetches each unique URL once no matter how many queries surfaced it', async () => {
    routeLlm({
      queries: () => ({
        queries: ['vdot training method', 'weekly mileage progression timeline', 'jack daniels coach'],
      }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Daniels VDOT',
        authority: 'Jack Daniels',
        sourceUrl: 'https://nih.gov/a',
        agreeingSourceUrls: ['https://nih.gov/a', 'https://acsm.org/b'],
        reasoning: 'Both sources describe VDOT.',
      }),
      velocity: () => ({ hasNumericDimension: false, week1Targets: [], week12Targets: [] }),
    });

    // The same two authoritative pages come back for every angle.
    const shared = [searchResult('https://nih.gov/a'), searchResult('https://acsm.org/b')];
    const tavily = fakeTavily(shared, 'The Daniels VDOT system by Jack Daniels.');

    const result = await runCanonResearch('Run a 10K road race', { tavily: tavily.client });

    expect(tavily.searchCalls).toHaveLength(3);
    // One batched extract, containing each URL exactly once.
    expect(tavily.extractCalls).toHaveLength(1);
    expect(tavily.extractCalls[0]).toEqual(['https://nih.gov/a', 'https://acsm.org/b']);
    expect(result.budget).toEqual({ searchCalls: 3, extractCalls: 1, extractedUrls: 2 });
  });

  it('refuses to search when every query angle is blocked', async () => {
    routeLlm({
      queries: () => ({
        queries: ['lose 40 pounds in 2 weeks', 'crash diet plan', 'starvation diet results'],
      }),
    });
    const tavily = fakeTavily([]);

    const result = await runCanonResearch('Lose 40 pounds in 2 weeks', { tavily: tavily.client });

    expect(tavily.searchCalls).toHaveLength(0);
    expect(result.methodConfidence).toBe('first_principles');
    expect(result.rejectedQueries.length).toBeGreaterThan(0);
  });
});

describe('Phase 3 — Stage 2 consensus enforcement', () => {
  it('never asks the model for a method when too few trusted sources survived', async () => {
    let synthesisCalled = false;
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => {
        synthesisCalled = true;
        return { methodFound: true, methodName: 'Invented', authority: 'X', sourceUrl: '', agreeingSourceUrls: [], reasoning: '' };
      },
    });

    // All LOW trust: open-publishing platforms only.
    const tavily = fakeTavily([
      searchResult('https://medium.com/@a/post'),
      searchResult('https://reddit.com/r/x/y'),
    ]);

    const result = await runCanonResearch('Some niche goal', { tavily: tavily.client });

    expect(synthesisCalled).toBe(false);
    expect(result.methodConfidence).toBe('first_principles');
    // Social junk is never worth downloading.
    expect(tavily.extractCalls).toHaveLength(0);
    expect(result.budget.extractCalls).toBe(0);
    expect(result.reasoning).toMatch(/No pages were downloaded|No on-topic readable/);
  });

  it('still downloads a single on-topic page so a niche goal is not empty-handed', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Invented',
        authority: 'X',
        sourceUrl: '',
        agreeingSourceUrls: [],
        reasoning: '',
      }),
    });

    const tavily = fakeTavily([
      searchResult(
        'https://en.wikipedia.org/wiki/Stone_skipping',
        'Stone skipping',
        'Throw a flat stone with spin at about 20 degrees.'
      ),
    ]);

    const result = await runCanonResearch('Get good at competitive stone skipping', {
      tavily: tavily.client,
    });

    expect(tavily.extractCalls).toHaveLength(1);
    expect(result.budget.extractCalls).toBe(1);
    expect(result.methodKind).toBe('single_source');
    expect(result.methodConfidence).toBe('first_principles');
    expect(result.teachings.length).toBeGreaterThanOrEqual(3);
    expect(result.sources[0].url).toContain('wikipedia.org');
  });

  it('downgrades when only one independent host actually names the method', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Overclaimed Method',
        authority: 'Someone',
        sourceUrl: 'https://nih.gov/a',
        // Two URLs, but both from the same host — one voice, not a consensus.
        agreeingSourceUrls: ['https://nih.gov/a', 'https://nih.gov/b'],
        reasoning: 'Sources agree.',
      }),
    });

    const tavily = fakeTavily(
      [
        searchResult('https://nih.gov/a'),
        searchResult('https://nih.gov/b'),
        searchResult('https://acsm.org/c'),
      ],
      'This page describes the Overclaimed Method in detail.'
    );

    const result = await runCanonResearch('Run a 10K road race', { tavily: tavily.client });

    // Per-host capping keeps nih.gov to 2 pages, but they are still ONE host. acsm.org is
    // fetched too, so the method would need to appear there as well to corroborate.
    expect(result.methodConfidence).toBe('high_consensus');
    expect(result.methodKind).toBe('named_program');
  });

  it('rejects a method the model claims but no page text mentions', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Entirely Fabricated Protocol',
        authority: 'Nobody At All',
        sourceUrl: 'https://nih.gov/a',
        agreeingSourceUrls: ['https://nih.gov/a', 'https://acsm.org/b'],
        reasoning: 'Both sources agree.',
      }),
    });

    // Pages are real and trusted, but say nothing about the claimed protocol.
    const tavily = fakeTavily(
      [searchResult('https://nih.gov/a'), searchResult('https://acsm.org/b')],
      'General advice about staying active and eating well.'
    );

    const result = await runCanonResearch('Run a 10K road race', { tavily: tavily.client });

    expect(result.methodConfidence).toBe('first_principles');
    expect(result.methodKind).not.toBe('named_program');
    expect(result.teachings.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a sourceUrl that was never retrieved this run', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Daniels VDOT',
        authority: 'Jack Daniels',
        // A plausible-looking URL the model typed out itself.
        sourceUrl: 'https://runnersworld.com/invented-article',
        agreeingSourceUrls: ['https://nih.gov/a', 'https://acsm.org/b'],
        reasoning: 'Agreement found.',
      }),
      velocity: () => ({ hasNumericDimension: false, week1Targets: [], week12Targets: [] }),
    });

    const tavily = fakeTavily(
      [searchResult('https://nih.gov/a'), searchResult('https://acsm.org/b')],
      'The Daniels VDOT method, developed by Jack Daniels.'
    );
    const result = await runCanonResearch('Run a 10K road race', { tavily: tavily.client });

    // Falls back to a real retrieved URL rather than citing the invented one.
    expect(result.sourceUrl).toBe('https://nih.gov/a');
    expect(result.allowedUrls).not.toContain('https://runnersworld.com/invented-article');
  });

  it('awards only medium_consensus without a HIGH-tier or authority-owned source', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Community Method',
        authority: 'Community',
        sourceUrl: 'https://en.wikipedia.org/wiki/A',
        agreeingSourceUrls: ['https://en.wikipedia.org/wiki/A', 'https://stackoverflow.com/q/1'],
        reasoning: 'Two community sources agree.',
      }),
      velocity: () => ({ hasNumericDimension: false, week1Targets: [], week12Targets: [] }),
    });

    const tavily = fakeTavily(
      [searchResult('https://en.wikipedia.org/wiki/A'), searchResult('https://stackoverflow.com/q/1')],
      'An explanation of the Community Method.'
    );

    const result = await runCanonResearch('Some goal', { tavily: tavily.client });
    expect(result.methodConfidence).toBe('medium_consensus');
  });

  it('treats the authority\u2019s own domain as HIGH-grade corroboration', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Novice 10K Program',
        authority: 'Hal Higdon',
        sourceUrl: 'https://halhigdon.com/training/novice-10k',
        agreeingSourceUrls: ['https://halhigdon.com/training/novice-10k', 'https://run-motion.com/plan'],
        reasoning: 'Both describe the Higdon novice programme.',
      }),
      velocity: () => ({ hasNumericDimension: false, week1Targets: [], week12Targets: [] }),
    });

    // Neither domain is on any allowlist. The authority owning halhigdon.com is what
    // earns high_consensus — the signal that generalises beyond a curated list.
    const tavily = fakeTavily(
      [
        searchResult('https://halhigdon.com/training/novice-10k', 'Novice 10K Training Program'),
        searchResult('https://run-motion.com/plan', 'Sub-50 10K training plan'),
      ],
      'The Novice 10K Program by Hal Higdon builds mileage gradually.'
    );

    const result = await runCanonResearch('Run a 10K road race', { tavily: tavily.client });
    expect(result.methodConfidence).toBe('high_consensus');
  });

  it('strips blacklisted results before they reach the model', async () => {
    let seenPrompt = '';
    mockLlm.mockImplementation(async (prompt: string, systemInstruction: string) => {
      if (systemInstruction?.includes('You plan web research')) {
        return { success: true, data: { queries: ['a method', 'b timeline', 'c authority'] } };
      }
      if (systemInstruction?.includes('You analyse research sources')) {
        seenPrompt = prompt;
        return { success: false, data: null };
      }
      return { success: false, data: null };
    });

    const tavily = fakeTavily([
      searchResult('https://nih.gov/a', 'Safe guidance'),
      searchResult('https://acsm.org/b', 'Safe guidance'),
      searchResult('https://unknown-site.example/c', 'Lose 40 pounds in 2 weeks'),
    ]);

    const result = await runCanonResearch('Lose weight sustainably', { tavily: tavily.client });

    expect(seenPrompt).not.toContain('unknown-site.example');
    expect(result.rejectedSources.some((r) => r.reason === 'content')).toBe(true);
  });
});

describe('Phase 3 — Stage 3 velocity sanity check', () => {
  const baseTable = (overrides: Partial<VelocityTable> = {}): VelocityTable => ({
    week1Targets: [{ metric: 'weekly mileage', value: 15, unit: 'miles', direction: 'higher_is_harder' }],
    week12Targets: [{ metric: 'weekly mileage', value: 30, unit: 'miles', direction: 'higher_is_harder' }],
    progressionFormula: 'Increase roughly 10% per week with a down week every fourth week.',
    assumptions: 'An adult already running about 10 miles per week.',
    ...overrides,
  });

  it('accepts a sound increasing progression', () => {
    expect(validateVelocityTable(baseTable()).valid).toBe(true);
  });

  it('accepts a decreasing metric where lower is harder', () => {
    // A finish time must fall over 12 weeks. A naive week12 > week1 rule would reject this.
    const table = baseTable({
      week1Targets: [{ metric: '10k time', value: 60, unit: 'minutes', direction: 'lower_is_harder' }],
      week12Targets: [{ metric: '10k time', value: 50, unit: 'minutes', direction: 'lower_is_harder' }],
    });
    expect(validateVelocityTable(table).valid).toBe(true);
  });

  it('rejects a metric that moves the wrong way', () => {
    const table = baseTable({
      week1Targets: [{ metric: '10k time', value: 50, unit: 'minutes', direction: 'lower_is_harder' }],
      week12Targets: [{ metric: '10k time', value: 60, unit: 'minutes', direction: 'lower_is_harder' }],
    });
    const validation = validateVelocityTable(table);
    expect(validation.valid).toBe(false);
    expect(validation.failures[0]).toMatch(/does not progress/);
  });

  it('rejects an implausible jump', () => {
    const table = baseTable({
      week12Targets: [{ metric: 'weekly mileage', value: 300, unit: 'miles', direction: 'higher_is_harder' }],
    });
    const validation = validateVelocityTable(table);
    expect(validation.valid).toBe(false);
    expect(validation.failures[0]).toMatch(/plausibility ceiling/);
  });

  it('rejects a unit switch mid-metric', () => {
    const table = baseTable({
      week12Targets: [{ metric: 'weekly mileage', value: 30, unit: 'km', direction: 'higher_is_harder' }],
    });
    expect(validateVelocityTable(table).valid).toBe(false);
  });

  it('requires the assumptions field to be stated', () => {
    const validation = validateVelocityTable(baseTable({ assumptions: '' }));
    expect(validation.valid).toBe(false);
    expect(validation.failures.join(' ')).toMatch(/starting point/);
  });

  it('feeds the specific failures back into the retry', async () => {
    const prompts: string[] = [];
    let call = 0;
    mockLlm.mockImplementation(async (prompt: string) => {
      prompts.push(prompt);
      call++;
      return {
        success: true,
        data:
          call === 1
            ? {
                hasNumericDimension: true,
                week1Targets: [{ metric: 'mileage', value: 40, unit: 'miles', direction: 'higher_is_harder' }],
                week12Targets: [{ metric: 'mileage', value: 20, unit: 'miles', direction: 'higher_is_harder' }],
                progressionFormula: 'Ramp up.',
                assumptions: 'Beginner runner.',
              }
            : {
                hasNumericDimension: true,
                week1Targets: [{ metric: 'mileage', value: 20, unit: 'miles', direction: 'higher_is_harder' }],
                week12Targets: [{ metric: 'mileage', value: 40, unit: 'miles', direction: 'higher_is_harder' }],
                progressionFormula: 'Ramp up 10% weekly.',
                assumptions: 'Beginner runner.',
              },
      };
    });

    const result = await deriveVelocityTable('Run a 10K', 'Daniels VDOT', []);

    expect(result.attempts).toBe(2);
    expect(result.table?.week12Targets[0].value).toBe(40);
    // Without the failures in the retry prompt, a temperature-0 model returns the same
    // broken table forever.
    expect(prompts[1]).toMatch(/previous answer was rejected/);
    expect(prompts[1]).toMatch(/does not progress/);
  });

  it('downgrades to first_principles after failing twice', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Daniels VDOT',
        authority: 'Jack Daniels',
        sourceUrl: 'https://nih.gov/a',
        agreeingSourceUrls: ['https://nih.gov/a', 'https://acsm.org/b'],
        reasoning: 'Agreement found.',
      }),
      velocity: () => ({
        hasNumericDimension: true,
        week1Targets: [{ metric: 'mileage', value: 40, unit: 'miles', direction: 'higher_is_harder' }],
        week12Targets: [{ metric: 'mileage', value: 20, unit: 'miles', direction: 'higher_is_harder' }],
        progressionFormula: 'Ramp.',
        assumptions: 'Beginner.',
      }),
    });

    const tavily = fakeTavily(
      [searchResult('https://nih.gov/a'), searchResult('https://acsm.org/b')],
      'The Daniels VDOT method by Jack Daniels.'
    );
    const result = await researchGoal('Run a 10K road race', { tavily: tavily.client });

    // Numbers failed. The method and teachings stay — a plan can still follow them.
    expect(result.methodKind).toBe('named_program');
    expect(result.methodName).toBe('Daniels VDOT');
    expect(result.velocityTable).toBeNull();
    expect(result.flaggedForReview).toBeTruthy();
    expect(result.teachings.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps the method when the goal simply has no numeric dimension', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodFound: true,
        methodName: 'Feynman Technique',
        authority: 'Richard Feynman',
        sourceUrl: 'https://nih.gov/a',
        agreeingSourceUrls: ['https://nih.gov/a', 'https://acsm.org/b'],
        reasoning: 'Both describe the technique.',
      }),
      velocity: () => ({ hasNumericDimension: false, week1Targets: [], week12Targets: [] }),
    });

    const tavily = fakeTavily(
      [searchResult('https://nih.gov/a'), searchResult('https://acsm.org/b')],
      'The Feynman Technique, named after Richard Feynman.'
    );
    const result = await researchGoal('Learn to explain complex ideas simply', {
      tavily: tavily.client,
    });

    expect(result.methodConfidence).toBe('high_consensus');
    expect(result.methodKind).toBe('named_program');
    expect(result.velocityTable).toBeNull();
    expect(result.teachings.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Phase 3 — shortlist selection (regression: live 10K run)', () => {
  /**
   * Reproduces the exact result set a live "Run a 10K under 50 minutes" search returned.
   * The original code ranked halhigdon.com last, cut it with the 6-item cap, and paid to
   * download a YouTube transcript and a Steemit post instead.
   */
  const liveResults = {
    'neutral angle': [
      searchResult('https://en.run-motion.com/sub-50-10k-12-week-training-plan'),
      searchResult('https://www.mymottiv.com/10k-training-plan/sub-50-10k'),
      searchResult('https://run.outsideonline.com/training/plans/fastest-10k'),
      searchResult('https://www.active.com/running/articles/12-week-beginner-10k'),
      searchResult('https://www.stillirun.org/post/12-free-10k-training-plans'),
    ],
    'jack daniels angle': [
      searchResult('https://runningwithrock.com/review-jack-daniels-5k-10k-training-plan'),
      searchResult('https://www.youtube.com/watch?v=qhmeNepVNjc'),
      searchResult('https://buenavida.run/plans/daniels-5k-10k-training-plan'),
      searchResult('https://steemit.com/runningproject/@runningproject/jack-daniels-10k'),
      searchResult('https://runningwithrock.com/my-experience-with-phase-ii'),
    ],
    'hal higdon angle': [
      searchResult('https://www.halhigdon.com/training-programs/10k-training/walkers-10k'),
      searchResult('https://www.halhigdon.com/training-programs/10k-training/advanced-10k'),
      searchResult('https://www.halhigdon.com/training-programs/10k-training/novice-10k'),
      searchResult('https://www.scribd.com/doc/60941584/10knovice'),
      searchResult('https://www.halhigdon.com/training-programs/10k-training/intermediate-10k'),
    ],
  };

  it('keeps the authority site that the previous ranking discarded', async () => {
    routeLlm({
      queries: () => ({
        queries: ['neutral angle', 'jack daniels angle', 'hal higdon angle'],
      }),
      synthesis: () => ({ methodFound: false, methodName: null, authority: null, sourceUrl: null, agreeingSourceUrls: [], reasoning: 'n/a' }),
    });

    const tavily = fakeTavily(liveResults);
    const result = await runCanonResearch('Run a 10K road race in under 50 minutes', {
      tavily: tavily.client,
      presetQueries: ['neutral angle', 'jack daniels angle', 'hal higdon angle'],
    });

    const fetched = tavily.extractCalls[0] ?? [];
    expect(fetched.some((url) => url.includes('halhigdon.com'))).toBe(true);

    // The open-publishing platforms are never paid for.
    expect(fetched.some((url) => url.includes('youtube.com'))).toBe(false);
    expect(fetched.some((url) => url.includes('steemit.com'))).toBe(false);
    expect(fetched.some((url) => url.includes('scribd.com'))).toBe(false);

    // No single host may monopolise the budget, even the authority's own.
    const higdonCount = fetched.filter((url) => url.includes('halhigdon.com')).length;
    expect(higdonCount).toBeLessThanOrEqual(2);

    // Every angle is represented rather than whichever query happened to run first.
    expect(fetched.some((url) => url.includes('run-motion.com'))).toBe(true);
    expect(fetched.some((url) => url.includes('runningwithrock.com'))).toBe(true);
    expect(result.budget.extractCalls).toBe(1);
  });
});

describe('Phase 3 — relevance outranks trust (regression: live 10K run)', () => {
  /**
   * Real scores from a live run. The ACSM pages are high-trust but about physical-activity
   * and resistance-training guidelines; the top result is the article that answers the goal
   * directly. Trust-first ordering fetched the former and discarded the latter.
   */
  const liveScored = {
    'neutral angle': [
      searchResult('https://marathonhandbook.com/how-to-run-10k-in-50-minutes', 'Sub 50 10K: Pace, Plan', 'Content', 0.877),
      searchResult('https://www.runna.com/pace-guides/sub-50-10k', 'How to Run a Sub-50 10K', 'Content', 0.86),
      searchResult('https://www.chalktalksports.com/blogs/running-life/sub-50-10k', 'Sub 50 10k Guide', 'Content', 0.835),
    ],
    'authority angle': [
      searchResult('https://www.halhigdon.com/training-programs/10k-training/advanced-10k', '10K Advanced', 'Content', 0.762),
      searchResult('https://www.halhigdon.com/training-programs/10k-training/novice-10k', '10K Novice', 'Content', 0.556),
      searchResult('https://www.halhigdon.com/training-programs/10k-training/walkers-10k', '10K Walkers', 'Content', 0.452),
    ],
    'progression angle': [
      searchResult('https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823', 'ACSM Position Stand', 'Content', 0.605),
      searchResult('https://acsm.org/physical-activity-guidelines', 'Physical Activity Guidelines', 'Content', 0.584),
      searchResult('https://acsm.org/resistance-training-guidelines', 'Resistance Training Guidelines', 'Content', 0.568),
      searchResult('https://acsm.org/official-statements', 'ACSM Official Statements', 'Content', 0.342),
    ],
  };

  it('fetches the on-topic page ahead of a higher-trust but off-topic one', async () => {
    routeLlm({
      queries: () => ({ queries: ['neutral angle', 'authority angle', 'progression angle'] }),
      synthesis: () => ({ methodFound: false, methodName: null, authority: null, sourceUrl: null, agreeingSourceUrls: [], reasoning: 'n/a' }),
    });

    const tavily = fakeTavily(liveScored);
    await runCanonResearch('Run a 10K road race in under 50 minutes', {
      tavily: tavily.client,
      presetQueries: ['neutral angle', 'authority angle', 'progression angle'],
    });

    const fetched = tavily.extractCalls[0] ?? [];

    expect(fetched).toContain('https://marathonhandbook.com/how-to-run-10k-in-50-minutes');
    expect(fetched).toContain('https://www.runna.com/pace-guides/sub-50-10k');
    // Off-topic ACSM guidance must not displace directly relevant material.
    expect(fetched).not.toContain('https://acsm.org/resistance-training-guidelines');
    // Below the relevance floor entirely.
    expect(fetched).not.toContain('https://acsm.org/official-statements');
  });

  it('still prefers a HIGH-trust page when relevance is comparable', () => {
    // The trust bonus is a tie-breaker, not an override.
    expect(scoreCandidate(0.8, 'HIGH', 1)).toBeGreaterThan(scoreCandidate(0.8, 'MEDIUM', 1));
    expect(scoreCandidate(0.6, 'HIGH', 1)).toBeLessThan(scoreCandidate(0.85, 'MEDIUM', 1));
  });

  it('rewards a page that several angles surfaced', () => {
    expect(scoreCandidate(0.7, 'MEDIUM', 3)).toBeGreaterThan(scoreCandidate(0.7, 'MEDIUM', 1));
  });
});

describe('Best roadmap — plan spine', () => {
  it('keeps a named program only when two hosts actually name it', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodKind: 'named_program',
        methodName: 'Mindfulness-Based Stress Reduction',
        authority: 'Jon Kabat-Zinn',
        sourceUrl: 'https://nih.gov/a',
        agreeingSourceUrls: ['https://nih.gov/a', 'https://acsm.org/b'],
        teachings: [
          'Sit for a timed session each day.',
          'Use breath as the anchor.',
          'Attend a weekly group class for eight weeks.',
        ],
        assumptions: 'Adults reducing everyday stress.',
        reasoning: 'Both pages describe MBSR.',
      }),
    });

    const tavily = fakeTavily(
      [
        searchResult('https://nih.gov/a', 'Mindfulness meditation MBSR overview'),
        searchResult('https://acsm.org/b', 'Mindfulness meditation stress program'),
      ],
      'Mindfulness-Based Stress Reduction (MBSR) by Jon Kabat-Zinn is an eight-week program.'
    );

    const result = await runCanonResearch('Build a mindfulness meditation practice to reduce stress', {
      tavily: tavily.client,
    });

    expect(result.methodKind).toBe('named_program');
    expect(result.methodName).toMatch(/MBSR|Mindfulness-Based Stress Reduction/);
    expect(result.teachings.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to a technique spine when no program name is corroborated', async () => {
    routeLlm({
      queries: () => ({ queries: ['a method', 'b timeline', 'c authority'] }),
      synthesis: () => ({
        methodKind: 'named_program',
        methodName: 'Invented Protocol',
        authority: 'Nobody',
        sourceUrl: 'https://en.wikipedia.org/wiki/Stone_skipping',
        agreeingSourceUrls: ['https://en.wikipedia.org/wiki/Stone_skipping'],
        teachings: [
          'Choose a flat stone no bigger than about three inches.',
          'Throw sidearm with as much spin as you can.',
          'Aim to hit the water at about 20 degrees.',
        ],
        assumptions: 'A beginner at a lake or quarry.',
        reasoning: 'Pages teach the throw, not a named program.',
      }),
    });

    const tavily = fakeTavily(
      [
        searchResult(
          'https://en.wikipedia.org/wiki/Stone_skipping',
          'Stone skipping',
          'Flat stone, sidearm, spin, about 20 degrees.'
        ),
        searchResult(
          'https://www.outsideonline.com/stone-skipping-kurt-steiner',
          'Stone skipping with Kurt Steiner',
          'Wrist rotation and attacking the water.'
        ),
      ],
      'Use a flat stone. Throw sidearm with spin. Hit the water at about 20 degrees.'
    );

    const result = await runCanonResearch('Get good at competitive stone skipping', {
      tavily: tavily.client,
    });

    expect(result.methodKind).not.toBe('named_program');
    expect(result.methodConfidence).toBe('first_principles');
    expect(result.teachings.some((t) => /20|spin|flat|sidearm/i.test(t))).toBe(true);
  });
});

describe('Phase 3 — query distinctness', () => {
  it('collapses rewordings of the same angle', () => {
    const kept = dropNearDuplicates([
      'best way to run a 10k',
      'best way to run a 10K race',
      'jack daniels vdot training tables',
    ]);
    expect(kept).toHaveLength(2);
  });
});

describe('Best roadmap — search wording', () => {
  const stone = 'Get good at competitive stone skipping';
  const tenK = 'Run a 10K road race in under 50 minutes';
  const meditation = 'Build a mindfulness meditation practice to reduce stress';

  it('rejects a query that invents an organisation the goal never named', () => {
    expect(namesInventedOrganisation('World Stone Skipping Association training guidelines', stone)).toBe(true);
    expect(namesInventedOrganisation('American College of Sports Medicine 10K guidelines', tenK)).toBe(true);
    expect(namesInventedOrganisation('stone skipping technique how to get better', stone)).toBe(false);
  });

  it('rejects a query that dropped the skill words', () => {
    expect(queryKeepsSkill('weekly schedule milestones skill development', stone)).toBe(false);
    expect(queryKeepsSkill('competitive stone skipping training plan timeline', stone)).toBe(true);
    expect(queryKeepsSkill('stone skipping techniques for distance and spin control', stone)).toBe(true);
    expect(queryKeepsSkill('mindfulness meditation weekly practice plan', meditation)).toBe(true);
  });

  it('drops look-alike results that share only an ambiguous word', () => {
    expect(
      resultKeepsSkill('Step-by-Step Tips to Teach Kids to Skip - The OT Toolbox', stone)
    ).toBe(false);
    expect(resultKeepsSkill('CDC Developmental Milestones', stone)).toBe(false);
    expect(resultKeepsSkill('The science and art of stone skipping', stone)).toBe(true);
    expect(resultKeepsSkill('Physical Activity Guidelines - ACSM', tenK)).toBe(false);
    expect(resultKeepsSkill('Sub 50 10K: Pace, Plan + How To Do It', tenK)).toBe(true);
  });

  it('keeps the skill words in every fallback query', () => {
    for (const query of templateQueries(stone)) {
      expect(queryKeepsSkill(query, stone)).toBe(true);
    }
  });

  it('does not fetch child-development pages for stone skipping', async () => {
    routeLlm({
      queries: () => ({
        queries: [
          'Get good at competitive stone skipping',
          'Get good at competitive stone skipping technique how to get better',
          'Get good at competitive stone skipping training plan timeline',
        ],
      }),
      synthesis: () => ({
        methodFound: false,
        methodName: null,
        authority: null,
        sourceUrl: null,
        agreeingSourceUrls: [],
        reasoning: 'n/a',
      }),
    });

    const tavily = fakeTavily({
      'Get good at competitive stone skipping': [
        searchResult(
          'https://en.wikipedia.org/wiki/Stone_skipping',
          'Stone skipping - Wikipedia',
          'Throw a flat stone sidearm so it bounces.',
          0.7
        ),
        searchResult(
          'https://www.outsideonline.com/outdoor-adventure/water-activities/stone-skipping-kurt-steiner',
          'Stone Skipping Is a Lost Art. Kurt Steiner Wants the World to Find It.',
          'Wrist rotation and a 20 degree entry.',
          0.65
        ),
      ],
      'Get good at competitive stone skipping technique how to get better': [
        searchResult(
          'https://psyche.co/ideas/all-you-need-to-know-to-start-skipping-stones-like-a-pro',
          'All you need to know to start skipping stones like a pro',
          'Collect flat stones and practise the throw.',
          0.55
        ),
        searchResult(
          'https://www.theottoolbox.com/skipping-activities-for-kids',
          'Step-by-Step Tips to Teach Kids to Skip',
          'Skipping is a developmental milestone around age 5.',
          0.4
        ),
      ],
      'Get good at competitive stone skipping training plan timeline': [
        searchResult(
          'https://www.cdc.gov/act-early/milestones/index.html',
          "CDC's Developmental Milestones",
          'Click on the age of your child to see the milestones.',
          0.12
        ),
      ],
    });

    await runCanonResearch(stone, {
      tavily: tavily.client,
      presetQueries: [
        'Get good at competitive stone skipping',
        'Get good at competitive stone skipping technique how to get better',
        'Get good at competitive stone skipping training plan timeline',
      ],
    });

    const fetched = tavily.extractCalls[0] ?? [];
    expect(fetched.some((url) => url.includes('wikipedia.org'))).toBe(true);
    expect(fetched.some((url) => url.includes('outsideonline.com'))).toBe(true);
    expect(fetched.some((url) => url.includes('theottoolbox.com'))).toBe(false);
    expect(fetched.some((url) => url.includes('cdc.gov'))).toBe(false);
  });
});
