import { generateStructuredContent } from '../ai/gemini.js';
import { corroborateMethod } from './corroboration.js';
import { resultKeepsSkill } from './queryPlanner.js';
import { authorityOwnsDomain, countIndependentTrustedSources } from './trustTier.js';
import type {
  CanonResearchResult,
  MethodConfidence,
  MethodKind,
  ResearchSource,
} from './types.js';

const MIN_HOSTS_FOR_NAMED_PROGRAM = 2;

const SPINE_SYSTEM_INSTRUCTION = `You read research pages and write the spine of a training plan.
You never invent a program name, a person, or a URL.

Return JSON:
{
  "methodKind": "named_program" | "shared_pattern" | "technique" | "single_source",
  "methodName": string | null,
  "authority": string | null,
  "sourceUrl": string | null,
  "agreeingSourceUrls": string[],
  "teachings": string[],
  "assumptions": string,
  "reasoning": string
}

How to choose methodKind:
- named_program: two or more of THESE pages name the same real program (e.g. MBSR).
- shared_pattern: pages describe the same shape of practice, but no shared official name
  (e.g. 10K plans that all use easy / speed / long run).
- technique: pages teach how to do the skill, with no curriculum
  (e.g. flat stone, spin, ~20° entry).
- single_source: only one page is usable. Still extract its teachings.

Rules:
- "methodName" is a real name that appears on the pages, or null. Never invent a brand.
- "authority" is a real person or body that appears on the pages, or null.
- Every URL must be copied from the source list. Never guess one.
- "teachings" is 3-7 short, concrete steps a coach could hand to a beginner THIS week.
  Each teaching must be visible in the pages (angle, count, days/week, drill, duration).
  No slogans. No world records as a training target.
- "assumptions" is one sentence: who the sources wrote this for.
- "reasoning" is 1-2 sentences, plain language.`;

interface SpineResponse {
  methodKind?: MethodKind;
  methodName: string | null;
  authority: string | null;
  sourceUrl: string | null;
  agreeingSourceUrls: string[];
  teachings: string[];
  assumptions: string;
  reasoning: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function independentHostCount(sources: ResearchSource[]): number {
  return countIndependentTrustedSources(
    sources.map((source) => ({
      source,
      assessment: { tier: source.tier, reason: source.trustReason, host: hostOf(source.url) },
    }))
  );
}

function plainLabel(goal: string, kind: MethodKind): string {
  const trimmed = goal.replace(/\.$/, '').trim();
  if (kind === 'shared_pattern') return `${trimmed} — common practice`;
  if (kind === 'single_source') return `${trimmed} — based on one source`;
  return `${trimmed} technique`;
}

function fallbackTeachings(goal: string, sources: ResearchSource[]): string[] {
  const lines: string[] = [];
  for (const source of sources) {
    const sentences = source.content.split(/(?<=[.!?])\s+|\n/);
    for (const raw of sentences) {
      const line = raw
        .replace(/!\[.*?\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^[#>*\-\s]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (line.length < 40 || line.length > 200) continue;
      if (/https?:\/\//i.test(line)) continue;
      if (!resultKeepsSkill(line, goal)) continue;
      if (lines.some((existing) => existing.toLowerCase() === line.toLowerCase())) continue;
      lines.push(line);
      if (lines.length >= 5) return lines;
    }
  }
  return lines;
}

function sanitizeTeachings(teachings: unknown, goal: string, sources: ResearchSource[]): string[] {
  const fromModel = Array.isArray(teachings)
    ? teachings
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.replace(/!\[.*?\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim())
        .filter((item) => item.length >= 12 && item.length <= 240 && !/https?:\/\//i.test(item))
    : [];

  if (fromModel.length >= 3) return fromModel.slice(0, 7);

  const fallback = fallbackTeachings(goal, sources);
  const merged = [...fromModel];
  for (const line of fallback) {
    if (merged.length >= 3) break;
    if (!merged.some((existing) => existing.toLowerCase() === line.toLowerCase())) {
      merged.push(line);
    }
  }
  return merged.slice(0, 7);
}

export interface BuiltSpine {
  methodKind: MethodKind;
  methodConfidence: MethodConfidence;
  methodName?: string;
  authority?: string;
  sourceUrl?: string;
  teachings: string[];
  assumptions?: string;
  reasoning: string;
}

/**
 * Turns retrieved pages into a plan spine. Always returns teachings when any page exists.
 * A named program is kept only if the name appears on two independent non-LOW hosts.
 */
export async function buildPlanSpine(
  goal: string,
  sources: ResearchSource[]
): Promise<BuiltSpine> {
  const hosts = independentHostCount(sources);
  const allowed = new Set(sources.map((source) => source.url));

  const sourceBlock = sources
    .map(
      (source, index) =>
        `[${index + 1}] TRUST=${source.tier} URL=${source.url}\nTITLE: ${source.title}\nCONTENT: ${source.content.slice(0, 2500)}`
    )
    .join('\n\n---\n\n');

  let raw: SpineResponse | null = null;
  try {
    const result = await generateStructuredContent<SpineResponse>(
      `Goal: "${goal}"\n\nSources:\n\n${sourceBlock}`,
      SPINE_SYSTEM_INSTRUCTION
    );
    if (result.success && result.data) raw = result.data;
  } catch (err: any) {
    console.warn(`[Spine] Synthesis failed: ${err.message}`);
  }

  const teachings = sanitizeTeachings(raw?.teachings, goal, sources);
  const assumptions = raw?.assumptions?.trim() || undefined;

  let kind: MethodKind =
    hosts <= 1
      ? 'single_source'
      : raw?.methodKind === 'named_program' || raw?.methodKind === 'shared_pattern' || raw?.methodKind === 'technique'
        ? raw.methodKind
        : teachings.length > 0
          ? 'technique'
          : 'shared_pattern';

  let methodName = raw?.methodName?.trim() || undefined;
  let authority = raw?.authority?.trim() || undefined;
  const claimedUrls = (raw?.agreeingSourceUrls ?? []).filter((url) => allowed.has(url));

  if (kind === 'named_program' && methodName) {
    const corroboration = corroborateMethod(sources, methodName, authority);
    if (corroboration.hosts.length < MIN_HOSTS_FOR_NAMED_PROGRAM) {
      kind = hosts <= 1 ? 'single_source' : 'shared_pattern';
      methodName = undefined;
      authority = undefined;
    }
  } else if (kind === 'named_program') {
    kind = hosts <= 1 ? 'single_source' : 'shared_pattern';
  }

  if (kind !== 'named_program') {
    methodName = plainLabel(goal, kind);
    authority = undefined;
  }

  let hasHighTierAgreement = false;
  if (kind === 'named_program' && methodName) {
    const corroboration = corroborateMethod(sources, methodName, authority);
    for (const source of sources) {
      if (!corroboration.hosts.includes(hostOf(source.url))) continue;
      if (source.tier === 'HIGH') hasHighTierAgreement = true;
      if (authority && authorityOwnsDomain(authority, hostOf(source.url))) {
        hasHighTierAgreement = true;
      }
    }
  }

  const methodConfidence: MethodConfidence =
    kind === 'named_program'
      ? hasHighTierAgreement
        ? 'high_consensus'
        : 'medium_consensus'
      : 'first_principles';

  const sourceUrl =
    (raw?.sourceUrl && allowed.has(raw.sourceUrl) ? raw.sourceUrl : undefined) ??
    claimedUrls[0] ??
    sources[0]?.url;

  const kindReason =
    kind === 'named_program'
      ? `Named program verified on the pages.`
      : kind === 'shared_pattern'
        ? 'No single official method. Spine is the shared practice pattern.'
        : kind === 'single_source'
          ? 'Thin evidence: spine is from one usable source.'
          : 'No official program. Spine is the technique the pages teach.';

  return {
    methodKind: kind,
    methodConfidence,
    methodName,
    authority,
    sourceUrl,
    teachings,
    assumptions,
    reasoning: `${raw?.reasoning ?? 'Built from the retrieved pages.'} ${kindReason}`.trim(),
  };
}

export function emptySpineFields(): Pick<
  CanonResearchResult,
  'teachings' | 'methodKind' | 'assumptions'
> {
  return { teachings: [] };
}
