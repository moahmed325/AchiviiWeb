import type { ResearchSource } from './types.js';

/**
 * Deterministic corroboration of a named method against the retrieved page text.
 *
 * The synthesis model reports which sources agree with it. That report is a claim, not
 * evidence — it can list URLs that never mention the method at all. This module recounts
 * the agreement from the content itself.
 *
 * It also turned out to be the signal that actually generalises. Live results for a 10K
 * goal surfaced "Jack Daniels" across four unrelated sites, none of which appeared in any
 * hand-written authority allowlist. Recurrence of the same name across independent hosts
 * is what distinguishes an established method from one source's opinion.
 */

/** Words too generic to prove a method is being discussed. */
const GENERIC_METHOD_WORDS = new Set([
  'the', 'and', 'for', 'with', 'plan', 'plans', 'method', 'methods', 'training', 'program',
  'programme', 'approach', 'system', 'technique', 'formula', 'guide', 'framework', 'model',
  'course', 'routine', 'schedule', 'week', 'weeks', 'beginner', 'advanced', 'intermediate',
]);

function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distinctive words from a method or authority name. */
export function distinctiveTokens(phrase: string): string[] {
  return normalize(phrase)
    .split(' ')
    .filter((token) => token.length > 2 && !GENERIC_METHOD_WORDS.has(token));
}

/**
 * Whether `text` discusses `phrase`.
 *
 * Verbatim match first, then a token-overlap fallback so "Jack Daniels' Running Formula"
 * is still recognised in a page that writes "the Daniels formula". Requiring every token
 * would miss the majority of real phrasings.
 */
export function mentionsPhrase(text: string, phrase: string): boolean {
  const haystack = normalize(text);
  if (!haystack) return false;

  const needle = normalize(phrase);
  if (needle && haystack.includes(needle)) return true;

  const tokens = distinctiveTokens(phrase);
  if (tokens.length === 0) return false;

  const present = tokens.filter((token) => haystack.includes(token)).length;
  // A single distinctive token is too weak on its own; require it to be the whole name.
  if (tokens.length === 1) return present === 1 && haystack.includes(tokens[0]);

  return present / tokens.length >= 0.6;
}

/**
 * Whether a phrase is a person's name, as opposed to a method title.
 *
 * Restricted to two or three purely alphabetic words so that "Novice 10K Program" and
 * one-word labels like "Community" cannot reach the surname rule below.
 */
function looksLikePersonalName(phrase: string): boolean {
  const words = normalize(phrase).split(' ').filter(Boolean);
  return words.length >= 2 && words.length <= 3 && words.every((word) => /^[a-z]+$/.test(word));
}

/**
 * Whether `text` refers to a named authority.
 *
 * Separate from `mentionsPhrase` because people are routinely referred to by surname
 * alone: live 10K pages say "the Daniels formula", never "the Jack Daniels formula".
 * Token-overlap scoring rejects those, so a personal name additionally matches on its
 * surname — a licence deliberately NOT extended to method titles, where a single shared
 * word like "running" would match almost any page in the field.
 */
export function mentionsAuthority(text: string, authority: string): boolean {
  if (mentionsPhrase(text, authority)) return true;
  if (!looksLikePersonalName(authority)) return false;

  const words = normalize(authority).split(' ').filter(Boolean);
  const surname = words[words.length - 1];
  // Short surnames ("Ali", "Fox") collide with ordinary words too easily.
  if (surname.length < 5 || GENERIC_METHOD_WORDS.has(surname)) return false;

  return normalize(text).includes(surname);
}

export interface CorroborationResult {
  /** Distinct hostnames whose retrieved text genuinely discusses the method. */
  hosts: string[];
  /** Hosts that the model claimed agreed but whose text does not mention the method. */
  unsupportedHosts: string[];
}

/**
 * Recounts, from page text, which independent hosts actually discuss the named method.
 *
 * LOW-tier sources are excluded: a forum post repeating a name is not corroboration.
 */
export function corroborateMethod(
  sources: ResearchSource[],
  methodName?: string,
  authority?: string
): CorroborationResult {
  const hasMethod = typeof methodName === 'string' && methodName.trim().length > 0;
  const hasAuthority = typeof authority === 'string' && authority.trim().length > 0;

  if (!hasMethod && !hasAuthority) return { hosts: [], unsupportedHosts: [] };

  const hosts = new Set<string>();
  const unsupported = new Set<string>();

  for (const source of sources) {
    if (source.tier === 'LOW') continue;

    let host: string;
    try {
      host = new URL(source.url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      continue;
    }

    // Title counts as well as body: extraction sometimes returns navigation chrome only.
    const text = `${source.title} ${source.content}`;
    const matched =
      (hasMethod && mentionsPhrase(text, methodName as string)) ||
      (hasAuthority && mentionsAuthority(text, authority as string));

    if (matched) {
      hosts.add(host);
    } else {
      unsupported.add(host);
    }
  }

  for (const host of hosts) unsupported.delete(host);

  return { hosts: [...hosts], unsupportedHosts: [...unsupported] };
}
