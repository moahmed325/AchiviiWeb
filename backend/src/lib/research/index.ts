import { runCanonResearch, CanonResearchOptions } from './canonResearch.js';
import { deriveVelocityTable } from './velocityTable.js';
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

/** Independent non-LOW hosts whose text was actually retrieved. */
function independentSourcedHosts(research: CanonResearchResult): number {
  const hosts = new Set<string>();
  for (const source of research.sources) {
    if (source.tier === 'LOW' || !source.content?.trim()) continue;
    try {
      hosts.add(new URL(source.url).hostname.toLowerCase().replace(/^www\./, ''));
    } catch {
      /* ignore unparseable */
    }
  }
  return hosts.size;
}

/**
 * Stages 2 and 3 together: research the goal, then derive its numeric trajectory.
 *
 * A named method and numeric grounding are deliberately decoupled. "Run a 10K in under 50
 * minutes" has many competing published plans, so no single method reaches consensus — yet
 * its sources state paces and weekly volumes precisely. Tying Stage 3 to a method name
 * threw that evidence away for an entire class of goals. methodConfidence still reports
 * first_principles, because no authority was established; only the numbers are retained,
 * and only when they pass the same sanity check as any other table.
 */
export type { CanonResearchOptions } from './canonResearch.js';

export async function researchGoal(
  clarifiedOutcome: string,
  options: CanonResearchOptions = {}
): Promise<CanonResearchResult> {
  const research = await runCanonResearch(clarifiedOutcome, options);

  if (research.methodConfidence === 'first_principles' || !research.methodName) {
    // Nothing was downloaded, so there is no text to derive numbers from.
    if (research.budget.extractCalls === 0 || independentSourcedHosts(research) < 2) {
      return research;
    }

    const unnamed = await deriveVelocityTable(clarifiedOutcome, null, research.sources);
    if (unnamed.table && !unnamed.skipped && !unnamed.failureReason) {
      return {
        ...research,
        velocityTable: unnamed.table,
        reasoning: `${research.reasoning} No named method reached consensus, but ${independentSourcedHosts(research)} independent sources supported a numeric trajectory, which is retained as grounding.`,
      };
    }

    return research;
  }

  const velocity = await deriveVelocityTable(
    clarifiedOutcome,
    research.methodName,
    research.sources
  );

  if (velocity.failureReason) {
    // The method itself may well be real, but numbers that failed validation twice cannot
    // be served, and a named method with no trajectory is not what high/medium_consensus
    // promises downstream. Downgrade and keep the evidence for review.
    return {
      ...research,
      methodConfidence: 'first_principles',
      velocityTable: null,
      reasoning: `${research.reasoning} ${velocity.failureReason}`,
      flaggedForReview: velocity.failureReason,
    };
  }

  if (velocity.skipped) {
    return {
      ...research,
      velocityTable: null,
      reasoning: `${research.reasoning} This goal has no natural numeric dimension, so milestone ordering carries the plan instead of a velocity table.`,
    };
  }

  return { ...research, velocityTable: velocity.table };
}
