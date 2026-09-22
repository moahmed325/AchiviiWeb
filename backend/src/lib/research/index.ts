import { runCanonResearch, CanonResearchOptions } from './canonResearch.js';
import { deriveVelocityTable } from './velocityTable.js';
import { applySafetyClamps } from './safetyClamps.js';
import type { CanonResearchResult } from './types.js';

export * from './types.js';
export { runCanonResearch, MAX_EXTRACT_URLS, selectShortlist, scoreCandidate } from './canonResearch.js';
export { deriveVelocityTable, validateVelocityTable } from './velocityTable.js';
export {
  planSearchQueries,
  dropNearDuplicates,
  queryOverlap,
  templateQueries,
  skillTokens,
  queryKeepsSkill,
  resultKeepsSkill,
  namesInventedOrganisation,
} from './queryPlanner.js';
export { screenQuery, screenResults, isBlacklistedDomain } from './safetyFilter.js';
export {
  assessTrust,
  rankSourcesByTrust,
  countIndependentTrustedSources,
  authorityOwnsDomain,
  isInstructionalVideoHost,
  isNeverExtractHost,
} from './trustTier.js';
export { corroborateMethod, mentionsPhrase, mentionsAuthority } from './corroboration.js';

export { buildPlanSpine } from './spine.js';
export { applySafetyClamps, clampVelocityOnCacheHit } from './safetyClamps.js';
export {
  researchToGrounding,
  hasUsableSpine,
  formatSpineBlock,
  formatMethodologyNotes,
  formatBasisBadge,
  stripUnallowedUrls,
} from './planGrounding.js';
export type { PlanGrounding, BasisBadge } from './planGrounding.js';

/**
 * Research plus numbers. The spine from Stage 2 is never thrown away because numbers
 * failed — a plan can still follow teachings. A velocity table is attached only when it
 * passes the sanity check. One-page sources may still yield numbers if they say which
 * page they came from (the table's assumptions field).
 */
export type { CanonResearchOptions } from './canonResearch.js';

export async function researchGoal(
  clarifiedOutcome: string,
  options: CanonResearchOptions = {}
): Promise<CanonResearchResult> {
  const research = await runCanonResearch(clarifiedOutcome, options);

  if (research.sources.length === 0 || research.budget.extractCalls === 0) {
    return research;
  }

  const velocity = await deriveVelocityTable(
    clarifiedOutcome,
    research.methodKind === 'named_program' ? research.methodName ?? null : null,
    research.sources
  );

  if (velocity.table && !velocity.skipped && !velocity.failureReason) {
    const clamped = applySafetyClamps(velocity.table, { source: 'fresh' });
    return { ...research, velocityTable: clamped.table };
  }

  if (velocity.failureReason) {
    return {
      ...research,
      velocityTable: null,
      flaggedForReview: velocity.failureReason,
    };
  }

  return research;
}
