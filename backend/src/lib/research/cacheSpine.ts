import type { CachedMethodData } from '../cache/researchCache.js';
import type { PlanGrounding } from './planGrounding.js';
import type { CanonResearchResult, VelocityTable } from './types.js';

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function asTable(value: unknown): VelocityTable | null {
  if (!value || typeof value !== 'object') return null;
  const table = value as VelocityTable;
  if (!Array.isArray(table.week1Targets) || !Array.isArray(table.week12Targets)) return null;
  return table;
}

/** What we store after a research miss, so the next person skips search. */
export function methodFromResearch(
  research: Pick<
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
  >
): CachedMethodData {
  return {
    methodName: research.methodName,
    authority: research.authority,
    sourceUrl: research.sourceUrl,
    confidence: research.methodConfidence,
    methodKind: research.methodKind,
    teachings: research.teachings,
    assumptions: research.assumptions,
    allowedUrls: research.allowedUrls,
    velocityTable: research.velocityTable,
  };
}

/** A cache row only counts when it still has teachings to build a week from. */
export function groundingFromCachedMethod(method: unknown): PlanGrounding | null {
  let parsed = method;
  if (typeof method === 'string') {
    try {
      parsed = JSON.parse(method);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const teachings = asStringList(record.teachings);
  if (teachings.length === 0) return null;

  const confidence =
    typeof record.confidence === 'string'
      ? record.confidence
      : typeof record.methodConfidence === 'string'
        ? record.methodConfidence
        : 'first_principles';

  return {
    methodKind: typeof record.methodKind === 'string' ? record.methodKind : undefined,
    methodConfidence: confidence,
    methodName: typeof record.methodName === 'string' ? record.methodName : undefined,
    authority: typeof record.authority === 'string' ? record.authority : undefined,
    sourceUrl: typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined,
    teachings,
    assumptions: typeof record.assumptions === 'string' ? record.assumptions : undefined,
    allowedUrls: asStringList(record.allowedUrls),
    velocityTable: asTable(record.velocityTable),
  };
}
