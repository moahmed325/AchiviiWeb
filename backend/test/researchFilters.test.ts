import { describe, it, expect } from 'vitest';
import {
  screenQuery,
  screenResults,
  isBlacklistedDomain,
} from '../src/lib/research/safetyFilter.js';
import {
  assessTrust,
  rankSourcesByTrust,
  countIndependentTrustedSources,
  authorityOwnsDomain,
  isInstructionalVideoHost,
  isNeverExtractHost,
} from '../src/lib/research/trustTier.js';
import {
  mentionsPhrase,
  mentionsAuthority,
  corroborateMethod,
} from '../src/lib/research/corroboration.js';
import type { ResearchSource } from '../src/lib/research/types.js';

describe('Phase 3 — Stage 2 blacklist filter', () => {
  it('blocks unsafe framings', () => {
    expect(screenQuery('lose 30 pounds in 2 weeks').blocked).toBe(true);
    expect(screenQuery('best 50x leverage crypto strategy').blocked).toBe(true);
    expect(screenQuery('SARMs cycle for cutting').blocked).toBe(true);
    expect(screenQuery('21 day water fast protocol').blocked).toBe(true);
  });

  it('leaves legitimate goals in the same topics alone', () => {
    // The filter must target unsafe framing, not the subject matter. Blocking these
    // would gut research for the majority of real fitness and finance goals.
    expect(screenQuery('sustainable fat loss nutrition guidelines').blocked).toBe(false);
    expect(screenQuery('how to lose weight safely').blocked).toBe(false);
    expect(screenQuery('index fund investing for beginners').blocked).toBe(false);
    expect(screenQuery('intermittent fasting 16:8 evidence').blocked).toBe(false);
    expect(screenQuery('couch to 5k beginner running plan').blocked).toBe(false);
  });

  it('reports which category triggered the block', () => {
    const verdict = screenQuery('crash diet to drop weight fast');
    expect(verdict.blocked).toBe(true);
    expect(verdict.categories).toContain('crash_diet');
  });

  it('blocks blacklisted domains including subdomains', () => {
    expect(isBlacklistedDomain('https://myproana.com/thread/1')).toBe(true);
    expect(isBlacklistedDomain('https://forum.myproana.com/thread/1')).toBe(true);
    expect(isBlacklistedDomain('https://www.mayoclinic.org/healthy-living')).toBe(false);
  });

  it('rejects a page whose title promotes the unsafe thing', () => {
    const { kept, rejected } = screenResults([
      { url: 'https://example-news.com/a', title: 'Lose 40 pounds in 3 weeks', content: '' },
      { url: 'https://mayoclinic.org/b', title: 'Healthy weight loss', content: 'Gradual change.' },
    ]);

    expect(kept).toHaveLength(1);
    expect(kept[0].url).toBe('https://mayoclinic.org/b');
    expect(rejected[0].reason).toBe('content');
  });

  it('keeps a clinical source that mentions a risk in order to warn about it', () => {
    // Verbatim from a live run: this Tulane University MBSR page was discarded for its
    // safeguarding notice, which also cost Stage 3 the "8 weekly 2.5-hour sessions" detail.
    const { kept, rejected } = screenResults([
      {
        url: 'https://care.tulane.edu/mbsr',
        title: 'Mindfulness Based Stress Reduction Course | Wave of Support',
        content:
          'MBSR is an 8-week program. If you are experiencing recent grief or trauma, serious mental or physical health challenges, chemical dependencies, or suicidal feelings, please reach out to the instructor to discuss whether this is the best time to enroll.',
      },
    ]);

    expect(rejected).toHaveLength(0);
    expect(kept).toHaveLength(1);
  });

  it('still rejects a body that advocates harm outright', () => {
    const { kept, rejected } = screenResults([
      { url: 'https://example.com/a', title: 'Training notes', content: 'Best place to buy SARMs online.' },
      { url: 'https://example.com/b', title: 'Trading', content: 'We promise guaranteed returns every month.' },
    ]);

    expect(kept).toHaveLength(0);
    expect(rejected).toHaveLength(2);
  });
});

describe('Phase 3 — Stage 2 trust tiering', () => {
  it('ranks recognised authorities HIGH', () => {
    expect(assessTrust({ url: 'https://pubmed.ncbi.nlm.nih.gov/12345' }).tier).toBe('HIGH');
    expect(assessTrust({ url: 'https://www.acsm.org/guidelines' }).tier).toBe('HIGH');
    expect(assessTrust({ url: 'https://kubernetes.io/docs/concepts/' }).tier).toBe('HIGH');
  });

  it('ranks established communities MEDIUM', () => {
    expect(assessTrust({ url: 'https://en.wikipedia.org/wiki/VO2_max' }).tier).toBe('MEDIUM');
    expect(assessTrust({ url: 'https://stackoverflow.com/questions/1' }).tier).toBe('MEDIUM');
  });

  it('ranks open-publishing platforms LOW even though they look reputable', () => {
    expect(assessTrust({ url: 'https://medium.com/@someone/my-method' }).tier).toBe('LOW');
    expect(assessTrust({ url: 'https://www.reddit.com/r/running/comments/x' }).tier).toBe('LOW');
    expect(assessTrust({ url: 'https://www.youtube.com/watch?v=abc' }).tier).toBe('LOW');
    expect(assessTrust({ url: 'https://steemit.com/@user/post' }).tier).toBe('LOW');
    expect(isInstructionalVideoHost('youtube.com')).toBe(true);
    expect(isNeverExtractHost('youtube.com')).toBe(false);
    expect(isNeverExtractHost('reddit.com')).toBe(true);
    expect(isNeverExtractHost('steemit.com')).toBe(true);
    expect(assessTrust({ url: 'https://www.scribd.com/doc/123/plan' }).tier).toBe('LOW');
  });

  it('treats an unrecognised domain as unverified, not untrustworthy', () => {
    // Regression: a live 10K search ranked halhigdon.com — one of the most published
    // running coaches alive — below a Steemit post, because it was not on any allowlist.
    // No hand-written list can cover every goal domain this product accepts.
    expect(assessTrust({ url: 'https://www.halhigdon.com/training-programs/10k' }).tier).toBe('MEDIUM');
    expect(assessTrust({ url: 'https://en.run-motion.com/sub-50-10k-plan' }).tier).toBe('MEDIUM');
    expect(assessTrust({ url: 'https://buenavida.run/plans/daniels' }).tier).toBe('MEDIUM');
  });

  it('does not let an institutional TLD launder a personal page', () => {
    expect(assessTrust({ url: 'https://stanford.edu/dept/guidelines' }).tier).toBe('HIGH');
    expect(assessTrust({ url: 'https://stanford.edu/~jdoe/my-running-blog' }).tier).toBe('MEDIUM');
  });

  it('caps unverified .org domains at MEDIUM', () => {
    // Anyone can register a .org, so it must not reach HIGH on the TLD alone.
    expect(assessTrust({ url: 'https://some-random-charity.org/advice' }).tier).toBe('MEDIUM');
  });

  it('recognises an authority that owns the domain bearing its name', () => {
    expect(authorityOwnsDomain('Hal Higdon', 'halhigdon.com')).toBe(true);
    expect(authorityOwnsDomain('Hal Higdon', 'www.halhigdon.com')).toBe(true);
    expect(authorityOwnsDomain('Justin Sandercoe', 'justinguitar.com')).toBe(false);
    expect(authorityOwnsDomain('Jack Daniels', 'runningwithrock.com')).toBe(false);
    // Short names collide with ordinary words inside domains.
    expect(authorityOwnsDomain('ACE', 'racehorses.com')).toBe(false);
  });

  it('demotes listicle and marketing language on unknown domains', () => {
    const assessment = assessTrust({
      url: 'https://fitnessblog.example/post',
      title: 'Top 10 secrets that the pros use',
    });
    expect(assessment.tier).toBe('LOW');
  });

  it('orders sources best-first', () => {
    const ranked = rankSourcesByTrust([
      { url: 'https://medium.com/@a/post' },
      { url: 'https://nih.gov/study' },
      { url: 'https://en.wikipedia.org/wiki/Topic' },
    ]);
    expect(ranked.map((r) => r.assessment.tier)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
  });

  it('counts independent sources by host, not by article', () => {
    // Three pages from one site are one source's position, not a consensus.
    const ranked = rankSourcesByTrust([
      { url: 'https://nih.gov/a' },
      { url: 'https://nih.gov/b' },
      { url: 'https://nih.gov/c' },
    ]);
    expect(countIndependentTrustedSources(ranked)).toBe(1);

    const varied = rankSourcesByTrust([
      { url: 'https://nih.gov/a' },
      { url: 'https://acsm.org/b' },
      { url: 'https://medium.com/@x/c' },
    ]);
    // LOW sources cannot contribute to a consensus count.
    expect(countIndependentTrustedSources(varied)).toBe(2);
  });
});

describe('Phase 3 — corroboration from page text', () => {
  const source = (url: string, content: string, tier: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'): ResearchSource => ({
    url,
    title: '',
    tier,
    trustReason: '',
    content,
    queryHits: 1,
  });

  it('matches an authority referred to by surname alone', () => {
    // Live 10K pages say "the Daniels formula", never "the Jack Daniels formula".
    expect(mentionsAuthority('We follow the Daniels formula for pacing.', 'Jack Daniels')).toBe(true);
    expect(mentionsAuthority('Nothing relevant here at all.', 'Jack Daniels')).toBe(false);
  });

  it('does not extend surname matching to method titles', () => {
    // "Running" appears on nearly every page in the field; a method title must not match
    // on one shared word the way a person's surname legitimately can.
    expect(mentionsPhrase('A general running article.', "Jack Daniels' Running Formula")).toBe(false);
  });

  it('will not match on a surname short enough to be an ordinary word', () => {
    expect(mentionsAuthority('A story about a fox in the garden.', 'Megan Fox')).toBe(false);
    expect(mentionsAuthority('Notes from Higdon on pacing.', 'Hal Higdon')).toBe(true);
  });

  it('ignores generic words so any training page does not count as a match', () => {
    expect(mentionsPhrase('A 12 week training plan and program guide.', 'Some Training Program')).toBe(false);
  });

  it('counts corroborating hosts, excluding LOW-tier repetition', () => {
    const result = corroborateMethod(
      [
        source('https://halhigdon.com/a', 'The Novice 10K Program by Hal Higdon.'),
        source('https://run-motion.com/b', 'Based on Hal Higdon novice plans.'),
        source('https://reddit.com/r/x', 'Hal Higdon is great', 'LOW'),
        source('https://unrelated.com/c', 'A completely different topic.'),
      ],
      'Novice 10K Program',
      'Hal Higdon'
    );

    expect(result.hosts.sort()).toEqual(['halhigdon.com', 'run-motion.com']);
    expect(result.unsupportedHosts).toEqual(['unrelated.com']);
  });

  it('reports nothing when the method name appears nowhere', () => {
    const result = corroborateMethod(
      [source('https://nih.gov/a', 'General advice.'), source('https://acsm.org/b', 'More advice.')],
      'Entirely Fabricated Protocol',
      'Nobody At All'
    );
    expect(result.hosts).toHaveLength(0);
  });
});
