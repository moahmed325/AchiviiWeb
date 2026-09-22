/**
 * Stage 2 trust tiering.
 *
 * Deliberately deterministic code rather than an LLM self-assessment: a model asked to
 * rank its own sources will confidently promote an SEO blog, and the whole point of the
 * Golden Rail is that `high_consensus` cannot be claimed without a real check having run.
 *
 * Heuristics only — this does not need to be perfect on day one, but it must be
 * reproducible and inspectable.
 */

export type TrustTier = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Domains representing named authorities, certification bodies, accredited institutions,
 * peer-reviewed publishers, and primary standards sources.
 */
const HIGH_TRUST_DOMAINS = new Set<string>([
  // Research / medical
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'nih.gov',
  'who.int',
  'cochrane.org',
  'nejm.org',
  'bmj.com',
  'thelancet.com',
  'jamanetwork.com',
  'mayoclinic.org',
  'health.harvard.edu',
  'hopkinsmedicine.org',
  'clevelandclinic.org',
  // Sport / strength certification bodies
  'acsm.org',
  'nsca.com',
  'nasm.org',
  'usada.org',
  'uka.org.uk',
  'worldathletics.org',
  // Nutrition
  'eatright.org',
  'nutrition.org',
  // Language
  'coe.int',
  'cambridgeenglish.org',
  'actfl.org',
  'cervantes.es',
  // Music / chess / other governing bodies
  'abrsm.org',
  'trinitycollege.com',
  'fide.com',
  'uscf.org',
  // Computing standards
  'ietf.org',
  'w3.org',
  'iso.org',
  'ieee.org',
  'acm.org',
  'kubernetes.io',
  'docs.python.org',
  'developer.mozilla.org',
  'postgresql.org',
]);

/**
 * Large established communities and reference works with a sustained track record.
 * Genuinely useful, but not an authority in their own right.
 */
const MEDIUM_TRUST_DOMAINS = new Set<string>([
  'wikipedia.org',
  'britannica.com',
  'stackoverflow.com',
  'stackexchange.com',
  'github.com',
  'arxiv.org',
  'goodreads.com',
  'runnersworld.com',
  'strongerbyscience.com',
  'examine.com',
  'chess.com',
  'lichess.org',
  'duolingo.com',
  'khanacademy.org',
]);

/**
 * Video hosts. LOW for a named-method badge (anyone can upload), but readable as
 * evidence — for many goals a good video *is* the best write-up that exists.
 */
const INSTRUCTIONAL_VIDEO_HOSTS = new Set<string>([
  'youtube.com',
  'youtu.be',
  'vimeo.com',
]);

/**
 * Platforms where anyone can publish under a reputable-looking banner, plus document
 * dumps. Checked FIRST so no other rule can rescue them. Never worth downloading.
 */
const OPEN_PUBLISHING_PLATFORMS = new Set<string>([
  'medium.com',
  'quora.com',
  'reddit.com',
  'answers.com',
  'ehow.com',
  'wikihow.com',
  'buzzfeed.com',
  'substack.com',
  'blogspot.com',
  'wordpress.com',
  'linkedin.com',
  'pinterest.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'steemit.com',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'tiktok.com',
  'instagram.com',
  'scribd.com',
  'slideshare.net',
  'issuu.com',
  'coursehero.com',
  'studocu.com',
  'tumblr.com',
]);

/** Marketing language that signals SEO content regardless of where it is hosted. */
const SEO_CONTENT_SIGNALS = [
  /\bbest \d+\b/i,
  /\btop \d+\b/i,
  /\bultimate guide\b/i,
  /\byou won'?t believe\b/i,
  /\bone weird trick\b/i,
  /\bsecrets? (that|the) (pros|experts)\b/i,
  /\bbuy now\b/i,
  /\bdiscount code\b/i,
  /\baffiliate\b/i,
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchesDomainSet(host: string, set: Set<string>): boolean {
  if (!host) return false;
  if (set.has(host)) return true;
  return [...set].some((domain) => host.endsWith(`.${domain}`));
}

export interface TrustAssessment {
  tier: TrustTier;
  /** Human-readable justification, surfaced in logs and the synthesis prompt. */
  reason: string;
  host: string;
}

export interface TierableSource {
  url: string;
  title?: string;
  content?: string;
}

/**
 * Assigns a trust tier from the URL and surfaced text.
 *
 * DESIGN NOTE — unknown means unverified, not untrustworthy.
 *
 * An earlier version defaulted unrecognised domains to LOW. Measured against live results
 * that proved unusable: a search for 10K training returned halhigdon.com — the personal
 * site of one of the most published running coaches alive — and the allowlist scored it
 * below a Steemit post. No hand-maintained allowlist can cover running, chess, guitar,
 * Spanish and SaaS at once, so its recall on the long tail is effectively zero.
 *
 * Unrecognised domains therefore default to MEDIUM. Rigour is not abandoned; it moves to
 * the checks that generalise — LOW is now an explicit judgement (open-publishing platform
 * or marketing language), and a named method must additionally be corroborated across
 * independent hosts before any consensus claim stands.
 */
export function assessTrust(source: TierableSource): TrustAssessment {
  const host = hostnameOf(source.url);

  if (!host) {
    return { tier: 'LOW', reason: 'Unparseable URL', host: '' };
  }

  if (matchesDomainSet(host, OPEN_PUBLISHING_PLATFORMS)) {
    return { tier: 'LOW', reason: `Open-publishing platform (${host})`, host };
  }

  if (matchesDomainSet(host, HIGH_TRUST_DOMAINS)) {
    return { tier: 'HIGH', reason: `Recognised authority domain (${host})`, host };
  }

  if (matchesDomainSet(host, MEDIUM_TRUST_DOMAINS)) {
    return { tier: 'MEDIUM', reason: `Established community or reference work (${host})`, host };
  }

  const text = `${source.title || ''} ${source.content || ''}`;
  if (SEO_CONTENT_SIGNALS.some((pattern) => pattern.test(text))) {
    return { tier: 'LOW', reason: 'Listicle/marketing language in title or snippet', host };
  }

  // Institutional TLDs, but only where the path isn't a personal page. "~user" and
  // "/people/" paths on a .edu are student or staff blogs, not institutional positions.
  if (/\.(edu|ac\.[a-z]{2}|gov|mil)$/.test(host)) {
    const isPersonalPage = /\/~|\/people\/|\/blog\//i.test(source.url);
    return isPersonalPage
      ? { tier: 'MEDIUM', reason: `Personal page on an institutional domain (${host})`, host }
      : { tier: 'HIGH', reason: `Accredited institution domain (${host})`, host };
  }

  return { tier: 'MEDIUM', reason: `Independent site, unverified (${host})`, host };
}

/** Letters only, for comparing a person or body's name against a domain. */
function compactLetters(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Whether a domain appears to belong to the named authority itself — "Hal Higdon" and
 * halhigdon.com, "Justin Guitar" and justinguitar.com.
 *
 * This is the allowlist-free way to recognise a primary source: it works for any field
 * without anyone maintaining a list, because publishing authorities overwhelmingly own
 * the domain bearing their name.
 */
export function authorityOwnsDomain(authority: string, host: string): boolean {
  const name = compactLetters(authority);
  // Short names ("ACE", "NHS") collide with ordinary words inside domains.
  if (name.length < 6 || !host) return false;

  const labels = host.split('.').filter((label) => label !== 'www');
  // Drop the public suffix; "halhigdon.com" and "halhigdon.co.uk" both reduce to halhigdon.
  const significant = labels.slice(0, Math.max(1, labels.length - 1));

  return significant.some((label) => {
    const compact = compactLetters(label);
    return compact.length >= 6 && (compact.includes(name) || name.includes(compact));
  });
}

export interface RankedSource<T extends TierableSource> {
  source: T;
  assessment: TrustAssessment;
}

const TIER_ORDER: Record<TrustTier, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/** Ranks sources best-first, preserving the original order within a tier. */
export function rankSourcesByTrust<T extends TierableSource>(sources: T[]): Array<RankedSource<T>> {
  return sources
    .map((source, index) => ({ source, assessment: assessTrust(source), index }))
    .sort((a, b) => {
      const tierDelta = TIER_ORDER[a.assessment.tier] - TIER_ORDER[b.assessment.tier];
      return tierDelta !== 0 ? tierDelta : a.index - b.index;
    })
    .map(({ source, assessment }) => ({ source, assessment }));
}

/**
 * Whether enough independent, sufficiently-trusted sources exist for a consensus claim
 * to even be possible. Independence is approximated by distinct hostname: three articles
 * from one site are one source's opinion, not agreement.
 *
 * This is a precondition only. Whether those sources actually *agree* is the synthesis
 * step's job; this just decides whether that question is worth asking.
 */
export function countIndependentTrustedSources<T extends TierableSource>(
  ranked: Array<RankedSource<T>>
): number {
  const hosts = new Set<string>();
  for (const { assessment } of ranked) {
    if (assessment.tier !== 'LOW' && assessment.host) {
      hosts.add(assessment.host);
    }
  }
  return hosts.size;
}

/** A video we may download as evidence. It cannot, alone, earn a named-method badge. */
export function isInstructionalVideoHost(host: string): boolean {
  return matchesDomainSet(host, INSTRUCTIONAL_VIDEO_HOSTS);
}

/**
 * Open-publishing junk that is never worth paying to download: social posts, dumps,
 * SEO farms. Videos are excluded — they are LOW for badges, but readable.
 */
export function isNeverExtractHost(host: string): boolean {
  if (!host || isInstructionalVideoHost(host)) return false;
  return matchesDomainSet(host, OPEN_PUBLISHING_PLATFORMS);
}
