/**
 * Record and replay Stage 2 web research.
 *
 * Tuning the synthesis and velocity prompts takes many iterations, and re-running the real
 * searches each time spends Tavily credits to fetch pages that have not changed. So:
 *
 *   capture — hits Tavily once for real and writes every request/response to a fixture
 *   replay  — re-runs the full pipeline against that fixture, costing nothing
 *
 * The LLM still runs live during replay; only the paid web calls are served from disk.
 *
 *   npm run research:capture -- "Run a 10K road race"
 *   npm run research:replay  -- "Run a 10K road race"
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getTavilyClient, getTavilyCallCount, resetTavilyCallCount } from '../src/lib/tavily.js';
import { researchGoal, deriveVelocityTable } from '../src/lib/research/index.js';
import { assessTrust } from '../src/lib/research/trustTier.js';
import type { ResearchSource } from '../src/lib/research/types.js';
import { getLlmCallCount, resetLlmCallCount } from '../src/lib/ai/gemini.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FIXTURE_DIR = path.resolve(__dirname, '../test/fixtures/research');

interface Fixture {
  goal: string;
  capturedAt: string;
  /** The planned queries, so a replay searches for exactly what was recorded. */
  queries: string[];
  searches: Array<{ query: string; response: any }>;
  extracts: Array<{ urls: string[]; response: any }>;
}

function fixturePath(goal: string): string {
  const slug = goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return path.join(FIXTURE_DIR, `${slug}.json`);
}

/** Wraps the real client, recording every call so it can be replayed later. */
function recordingClient(fixture: Fixture) {
  const real = getTavilyClient();
  return {
    async search(query: string, options?: any) {
      const response = await real.search(query, options);
      fixture.searches.push({ query, response });
      return response;
    },
    async extract(urls: string | string[], options?: any) {
      const response = await real.extract(urls, options);
      fixture.extracts.push({ urls: Array.isArray(urls) ? urls : [urls], response });
      return response;
    },
  };
}

/** Serves recorded responses. Unknown queries return empty rather than silently hitting the network. */
function replayClient(fixture: Fixture) {
  return {
    async search(query: string) {
      const match = fixture.searches.find((entry) => entry.query === query);
      if (!match) {
        console.warn(`[replay] No recorded search for "${query}" — returning no results.`);
        return { query, results: [], response_time: 0 };
      }
      return match.response;
    },
    async extract(urls: string | string[]) {
      const list = Array.isArray(urls) ? urls : [urls];
      const match = fixture.extracts.find(
        (entry) => entry.urls.length === list.length && entry.urls.every((u) => list.includes(u))
      );
      if (match) return match.response;

      // URL set changed since capture (e.g. ranking tweak). Serve what was recorded.
      const recorded = new Map<string, any>();
      for (const entry of fixture.extracts) {
        for (const item of entry.response.results ?? []) recorded.set(item.url, item);
      }
      const results = list.map((url) => recorded.get(url)).filter(Boolean);
      console.warn(
        `[replay] Extract set differs from capture; serving ${results.length}/${list.length} recorded pages.`
      );
      return { results, failed_results: [], response_time: 0 };
    },
  };
}

function report(goal: string, result: any) {
  console.log('\n================================================================');
  console.log(`GOAL: ${goal}`);
  console.log('================================================================');
  console.log(`Confidence:   ${result.methodConfidence}`);
  console.log(`Kind:         ${result.methodKind ?? '(none)'}`);
  console.log(`Method:       ${result.methodName ?? '(none)'}`);
  console.log(`Authority:    ${result.authority ?? '(none)'}`);
  console.log(`Source URL:   ${result.sourceUrl ?? '(none)'}`);
  if (result.assumptions) console.log(`Assumes:      ${result.assumptions}`);
  if (result.teachings?.length) {
    console.log(`\nTeachings (${result.teachings.length}):`);
    result.teachings.forEach((t: string) => console.log(`  - ${t}`));
  }
  console.log(`\nReasoning:    ${result.reasoning}`);
  if (result.flaggedForReview) console.log(`Flagged:      ${result.flaggedForReview}`);

  console.log(`\nQueries used (${result.queries.length}):`);
  result.queries.forEach((q: string) => console.log(`  - ${q}`));

  console.log(`\nSources kept (${result.sources.length}):`);
  result.sources.forEach((s: any) =>
    console.log(`  [${s.tier}] ${s.url}\n        ${s.trustReason} (seen in ${s.queryHits} angle(s))`)
  );

  if (result.rejectedQueries.length > 0) {
    console.log(`\nBlocked queries: ${result.rejectedQueries.length}`);
    result.rejectedQueries.forEach((r: any) => console.log(`  - "${r.query}" (${r.categories.join(', ')})`));
  }

  const rejectedNonDuplicate = result.rejectedSources.filter((r: any) => r.reason !== 'duplicate');
  if (rejectedNonDuplicate.length > 0) {
    console.log(`\nRejected sources: ${rejectedNonDuplicate.length}`);
    rejectedNonDuplicate.forEach((r: any) => console.log(`  - ${r.url} (${r.reason})`));
  }

  if (result.velocityTable) {
    console.log('\nVelocity table:');
    console.log(`  Assumes:     ${result.velocityTable.assumptions}`);
    console.log(`  Progression: ${result.velocityTable.progressionFormula}`);
    console.log('  Week 1:');
    result.velocityTable.week1Targets.forEach((t: any) =>
      console.log(`    ${t.metric}: ${t.value} ${t.unit} (${t.direction})`)
    );
    console.log('  Week 12:');
    result.velocityTable.week12Targets.forEach((t: any) =>
      console.log(`    ${t.metric}: ${t.value} ${t.unit} (${t.direction})`)
    );
  } else {
    console.log('\nVelocity table: none');
  }

  console.log(
    `\nBudget: ${result.budget.searchCalls} search, ${result.budget.extractCalls} extract (${result.budget.extractedUrls} pages)`
  );
  console.log(`Totals: ${getTavilyCallCount()} Tavily call(s), ${getLlmCallCount()} LLM call(s)`);
}

/**
 * Runs Stage 3 alone against recorded page text.
 *
 * Stage 3 only executes when Stage 2 establishes a method, so goals that legitimately end
 * at first_principles leave the velocity derivation completely unexercised against real
 * content. This drives it directly, for free, with a method name supplied by hand.
 */
async function runVelocityProbe(goal: string, methodName: string, fixture: Fixture) {
  const sources: ResearchSource[] = [];
  for (const extract of fixture.extracts) {
    for (const item of extract.response.results ?? []) {
      const assessment = assessTrust({ url: item.url, content: item.raw_content });
      sources.push({
        url: item.url,
        title: '',
        tier: assessment.tier,
        trustReason: assessment.reason,
        content: (item.raw_content ?? '').slice(0, 6000),
        queryHits: 1,
      });
    }
  }

  console.log(`[velocity] ${sources.length} recorded page(s); method "${methodName}"`);
  const result = await deriveVelocityTable(goal, methodName, sources);

  console.log(`\nAttempts:  ${result.attempts}`);
  console.log(`Skipped:   ${result.skipped} (goal reported as having no numeric dimension)`);
  if (result.failureReason) console.log(`Failure:   ${result.failureReason}`);

  if (result.table) {
    console.log(`\nAssumes:     ${result.table.assumptions}`);
    console.log(`Progression: ${result.table.progressionFormula}`);
    console.log('Week 1:');
    result.table.week1Targets.forEach((t) =>
      console.log(`  ${t.metric}: ${t.value} ${t.unit} (${t.direction})`)
    );
    console.log('Week 12:');
    result.table.week12Targets.forEach((t) =>
      console.log(`  ${t.metric}: ${t.value} ${t.unit} (${t.direction})`)
    );
  }
  console.log(`\nLLM calls: ${getLlmCallCount()}`);
}

async function main() {
  const mode = process.argv[2];
  const rest = process.argv.slice(3);

  if (mode === 'velocity') {
    const separator = rest.indexOf('--method');
    if (separator === -1) {
      console.error('Usage: research-fixture.ts velocity "<goal>" --method "<method name>"');
      process.exit(1);
    }
    const goalText = rest.slice(0, separator).join(' ').trim();
    const methodName = rest.slice(separator + 1).join(' ').trim();
    const loaded: Fixture = JSON.parse(await fs.readFile(fixturePath(goalText), 'utf8'));
    resetLlmCallCount();
    await runVelocityProbe(goalText, methodName, loaded);
    return;
  }

  const goal = rest.join(' ').trim();

  if (mode !== 'capture' && mode !== 'replay') {
    console.error('Usage: research-fixture.ts <capture|replay|velocity> "<goal>"');
    process.exit(1);
  }
  if (!goal) {
    console.error('A goal is required.');
    process.exit(1);
  }

  resetTavilyCallCount();
  resetLlmCallCount();

  const target = fixturePath(goal);

  if (mode === 'capture') {
    const fixture: Fixture = {
      goal,
      capturedAt: new Date().toISOString(),
      queries: [],
      searches: [],
      extracts: [],
    };

    console.log(`[capture] Running REAL Tavily calls for: "${goal}"`);
    const result = await researchGoal(goal, { tavily: recordingClient(fixture) as any });
    fixture.queries = result.queries;

    await fs.mkdir(FIXTURE_DIR, { recursive: true });
    await fs.writeFile(target, JSON.stringify(fixture, null, 2), 'utf8');
    console.log(`[capture] Saved ${fixture.searches.length} search(es) and ${fixture.extracts.length} extract(s)`);
    console.log(`[capture] Fixture: ${path.relative(process.cwd(), target)}`);

    report(goal, result);
    return;
  }

  let fixture: Fixture;
  try {
    fixture = JSON.parse(await fs.readFile(target, 'utf8'));
  } catch {
    console.error(`No fixture found at ${target}. Run capture first.`);
    process.exit(1);
    return;
  }

  console.log(`[replay] Using fixture captured ${fixture.capturedAt} — no Tavily credits used.`);
  if (!fixture.queries?.length) {
    console.warn('[replay] Fixture predates query recording; re-capture for a faithful replay.');
  }
  const result = await researchGoal(goal, {
    tavily: replayClient(fixture) as any,
    presetQueries: fixture.queries,
  });
  report(goal, result);
}

main()
  .catch((err) => {
    console.error('Research fixture run failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma.js');
    await prisma.$disconnect();
  });
