import { generateStructuredContent } from '../ai/gemini.js';
import { distillContent } from './distill.js';
import type { ResearchSource, VelocityTable, VelocityTarget } from './types.js';

/**
 * Largest plausible 12-week change in a single metric.
 *
 * A heuristic, not a law. Two data points cannot reveal a discontinuity *between* them, so
 * this catches the failure actually observed in practice: a model emitting an absurd
 * endpoint (0 to 100 miles per week) that no source supports.
 */
const MAX_PROGRESSION_RATIO = 10;

/** Smallest change that still represents progression rather than a flat plan. */
const MIN_PROGRESSION_RATIO = 1.02;

const VELOCITY_SYSTEM_INSTRUCTION = `You extract concrete numeric targets that are already
present in research sources. You never invent numbers.

Return JSON:
{
  "hasNumericDimension": boolean,
  "week1Targets": [{ "metric": string, "value": number, "unit": string, "direction": "higher_is_harder" | "lower_is_harder" }],
  "week12Targets": [{ "metric": string, "value": number, "unit": string, "direction": "higher_is_harder" | "lower_is_harder" }],
  "progressionFormula": string,
  "assumptions": string
}

WHEN TO EXTRACT NUMBERS — this is the normal case:
If the sources state ANY measurable quantity relevant to the goal, you MUST extract it.
Qualifying quantities include pace, distance, weekly volume, session length, sessions per
week, repetitions, sets, vocabulary counts, rating points, word counts, and durations.

WHEN TO SET "hasNumericDimension" TO false — this is rare:
Only when the goal itself has no measurable quantity at all, such as "become more patient"
or "feel more confident". A goal containing a time, distance, score, count or frequency
ALWAYS has a numeric dimension. Never use this because the sources were merely awkward to
read, or because a plan did not run for exactly twelve weeks.

MAPPING SOURCE PLANS ONTO 12 WEEKS:
Published plans are often 6, 8 or 10 weeks long. Do not refuse on that basis. Take the
first week of the source plan as "week1Targets" and its final week as "week12Targets", and
state the original plan length in "assumptions".

Rules:
- Every number must come from the supplied sources. If you cannot find a number for one
  metric, omit that metric — but do not abandon the whole table because one is missing.
- Extract 1-3 metrics. Choose ones that CHANGE as the programme advances: weekly volume,
  long-session distance, session duration, sessions per week, reps, or vocabulary learned.
- NEVER use the goal's own fixed target as a metric. A goal race pace, target finish time
  or desired final score is constant by definition and cannot progress. Use the training
  quantities that build toward it instead.
- "metric" names must match exactly between week1Targets and week12Targets so they can be
  paired. Use the same "unit" for a given metric in both.
- "direction" describes which way is HARDER. Weekly mileage is "higher_is_harder".
  A race finish time or a target pace is "lower_is_harder".
- Week 1 must be the easier end and week 12 the harder end, in the direction given.
- Express a pace or time as a single number in one unit, e.g. 8.05 with unit
  "minutes per mile". Never write "8:03".
- "progressionFormula" is one sentence describing how it ramps.
- "assumptions" states the starting point the sources assume and the source plan's length,
  e.g. "an 8-week plan for an adult already running about 10 miles per week". Be explicit;
  this is shown to users whose starting point may differ.`;

interface VelocityResponse {
  hasNumericDimension: boolean;
  week1Targets: VelocityTarget[];
  week12Targets: VelocityTarget[];
  progressionFormula: string;
  assumptions: string;
}

export interface VelocityValidation {
  valid: boolean;
  failures: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Deterministic sanity check on derived numbers.
 *
 * Lives in code rather than in the prompt because its entire purpose is to catch the
 * model being wrong; asking the model to self-certify would defeat it.
 */
export function validateVelocityTable(table: VelocityTable): VelocityValidation {
  const failures: string[] = [];

  if (!Array.isArray(table.week1Targets) || table.week1Targets.length === 0) {
    failures.push('week1Targets is empty.');
  }
  if (!Array.isArray(table.week12Targets) || table.week12Targets.length === 0) {
    failures.push('week12Targets is empty.');
  }
  if (!table.progressionFormula?.trim()) {
    failures.push('progressionFormula is missing.');
  }
  if (!table.assumptions?.trim()) {
    failures.push('assumptions is missing — the starting point the numbers apply to must be stated.');
  }
  if (failures.length > 0) return { valid: false, failures };

  const week12ByMetric = new Map(table.week12Targets.map((target) => [target.metric, target]));

  for (const start of table.week1Targets) {
    const label = start.metric || '(unnamed metric)';

    if (!isFiniteNumber(start.value)) {
      failures.push(`Week 1 "${label}" has a non-numeric value.`);
      continue;
    }

    const end = week12ByMetric.get(start.metric);
    if (!end) {
      failures.push(`Metric "${label}" appears in week 1 but has no week 12 counterpart.`);
      continue;
    }
    if (!isFiniteNumber(end.value)) {
      failures.push(`Week 12 "${label}" has a non-numeric value.`);
      continue;
    }
    if (start.unit !== end.unit) {
      failures.push(`Metric "${label}" changes unit from "${start.unit}" to "${end.unit}".`);
      continue;
    }
    if (start.value <= 0 || end.value <= 0) {
      failures.push(`Metric "${label}" has a non-positive value.`);
      continue;
    }

    const direction = start.direction ?? end.direction;
    if (direction !== 'higher_is_harder' && direction !== 'lower_is_harder') {
      failures.push(`Metric "${label}" has no valid direction.`);
      continue;
    }
    if (end.direction && start.direction && end.direction !== start.direction) {
      failures.push(`Metric "${label}" declares conflicting directions across weeks.`);
      continue;
    }

    // Normalise so the ratio always reads "harder ÷ easier", whichever way the metric runs.
    const easier = direction === 'higher_is_harder' ? start.value : end.value;
    const harder = direction === 'higher_is_harder' ? end.value : start.value;

    if (harder <= easier) {
      failures.push(
        `Metric "${label}" does not progress: week 1 is ${start.value}${start.unit}, week 12 is ${end.value}${end.unit}, and ${direction.replace(/_/g, ' ')}.`
      );
      continue;
    }

    const ratio = harder / easier;
    if (ratio < MIN_PROGRESSION_RATIO) {
      failures.push(`Metric "${label}" barely changes over 12 weeks (ratio ${ratio.toFixed(2)}).`);
    } else if (ratio > MAX_PROGRESSION_RATIO) {
      failures.push(
        `Metric "${label}" jumps ${ratio.toFixed(1)}x in 12 weeks, beyond the ${MAX_PROGRESSION_RATIO}x plausibility ceiling.`
      );
    }
  }

  return { valid: failures.length === 0, failures };
}

export interface VelocityDerivationResult {
  table: VelocityTable | null;
  /** True when the goal legitimately has no numeric dimension — not a failure. */
  skipped: boolean;
  /** Present when derivation failed twice and confidence must be downgraded. */
  failureReason?: string;
  attempts: number;
}

function toTable(response: VelocityResponse): VelocityTable {
  return {
    week1Targets: response.week1Targets ?? [],
    week12Targets: response.week12Targets ?? [],
    progressionFormula: response.progressionFormula ?? '',
    assumptions: response.assumptions ?? '',
  };
}

/**
 * Stage 3 — Velocity Table Derivation. Runs only when Stage 2 found a real method.
 *
 * On a failed sanity check the retry is sent the specific failures. The provider cascade
 * runs at temperature 0, so a bare retry of an identical prompt would return the identical
 * broken table; the feedback is what makes the second attempt meaningfully different.
 */
export async function deriveVelocityTable(
  clarifiedOutcome: string,
  /**
   * The established method, or null when none reached consensus.
   *
   * Numeric grounding does not depend on a method having a name. Goals like "run a sub-50
   * 10K" have many competing plans and so no single named canon, yet their sources state
   * paces and weekly volumes precisely. Requiring a name discarded that evidence.
   */
  methodName: string | null,
  sources: ResearchSource[]
): Promise<VelocityDerivationResult> {
  const sourceBlock = sources
    .map((source, index) => {
      const excerpt = distillContent(source.content, { budget: 3000, preferNumeric: true });
      return `[${index + 1}] TRUST=${source.tier} URL=${source.url}\nTITLE: ${source.title}\nCONTENT: ${excerpt}`;
    })
    .join('\n\n---\n\n');

  let previousFailures: string[] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const correction =
      previousFailures.length > 0
        ? `\n\nYour previous answer was rejected by an automated check for these reasons:\n${previousFailures
            .map((failure) => `- ${failure}`)
            .join('\n')}\nProduce a corrected table. If the sources genuinely do not support
usable numbers, set "hasNumericDimension" to false instead of guessing.`
        : '';

    const header = methodName
      ? `Established method: "${methodName}"\n\nExtract the week 1 and week 12 numeric targets this method prescribes.`
      : `No single named method reached consensus across these sources.\n\nExtract the week 1 and week 12 numeric targets the sources agree on for this goal. Use figures several sources support rather than any one source's outlier.`;

    const prompt = `Goal: "${clarifiedOutcome}"
${header}

Sources:

${sourceBlock}${correction}`;

    let response: VelocityResponse | null = null;
    try {
      const result = await generateStructuredContent<VelocityResponse>(
        prompt,
        VELOCITY_SYSTEM_INSTRUCTION
      );
      if (result.success && result.data) response = result.data;
    } catch (err: any) {
      console.warn(`[Stage3] Velocity derivation attempt ${attempt} failed: ${err.message}`);
    }

    if (!response) {
      previousFailures = ['The model returned no usable JSON.'];
      continue;
    }

    if (response.hasNumericDimension === false) {
      // Not every goal has numbers. Milestone ordering from Stage 2 carries the plan instead.
      return { table: null, skipped: true, attempts: attempt };
    }

    const table = toTable(response);
    const validation = validateVelocityTable(table);

    if (validation.valid) {
      return { table, skipped: false, attempts: attempt };
    }

    console.warn(
      `[Stage3] Sanity check failed on attempt ${attempt}: ${validation.failures.join(' | ')}`
    );
    previousFailures = validation.failures;
  }

  return {
    table: null,
    skipped: false,
    attempts: 2,
    failureReason: `Velocity table failed the sanity check twice (${previousFailures.join(' | ')}). Confidence downgraded to first_principles rather than serving unsound numbers.`,
  };
}
