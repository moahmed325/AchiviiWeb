import { generateStructuredContent } from '../ai/gemini.js';
import type { PlanGrounding } from '../research/planGrounding.js';
import { screenQuery } from '../research/safetyFilter.js';
import { extractStatedTargets, statedTargetFailures } from '../research/statedTarget.js';
import type { VelocityTable, VelocityTarget } from '../research/types.js';
import { forceUserTargets, validateVelocityTable } from '../research/velocityTable.js';
import {
  blockLibraryFailures,
  cleanBlocks,
  cleanWorkKinds,
  WORK_BLOCK_SCHEMA,
  WORK_KIND_LABELS,
  WORK_KINDS,
  type WorkBlock,
  type WorkKind,
} from './blocks.js';

export const FACTORS = ['adherence', 'safety', 'fitToUser', 'evidence', 'measurability'] as const;
type Factor = (typeof FACTORS)[number];

/** A chosen method below this on safety or fit is rejected, whatever its other scores. */
const MIN_GATE_SCORE = 3;
const MIN_TEACHINGS = 4;
const MAX_TEACHINGS = 8;

export interface MethodCandidate {
  name: string;
  creator?: string | null;
  summary: string;
  scores: Record<Factor, number>;
}

export interface MethodPickResponse {
  candidates: MethodCandidate[];
  chosenIndex: number;
  whyChosen: string;
  runnerUpIndex: number;
  whyNotRunnerUp: string;
  teachings: string[];
  workKinds: WorkKind[];
  blocks: WorkBlock[];
  assumptions: string;
  hasNumericDimension: boolean;
  week1Targets: VelocityTarget[];
  week12Targets: VelocityTarget[];
  progressionFormula: string;
}

export interface PickMethodInput {
  rawGoal: string;
  clarifiedOutcome: string;
  answers: Record<string, string>;
  dailyMinutes: number;
  activeDaysPerWeek: number;
}

export type PickMethodResult =
  | { ok: true; grounding: PlanGrounding; attempts: number }
  | { ok: false; reason: string; attempts: number };

type Generate = (prompt: string, system: string, temperature: number) => Promise<MethodPickResponse | null>;

const SYSTEM_INSTRUCTION = `You choose the best-fit method for one person's 12-week goal.

Work in this order:
1. List 2 or 3 real, distinct methods people use for this goal.
2. Score each from 1 (poor) to 5 (strong) for THIS person, using their answers:
   - adherence: how likely this person keeps doing it for 12 weeks with their time and days.
   - safety: injury, burnout, or harm risk at their level.
   - fitToUser: fit to their level, time per day, days per week, equipment, and stated obstacles.
   - evidence: how widely used and proven it is.
   - measurability: whether progress can be checked every week.
3. Choose one. Adherence and fit usually matter most. Never choose a method with safety or fitToUser below 3.
   A method built for a different starting level does not fit. Never give a from-zero program to someone who can
   already do the activity, and never give an advanced program to a complete beginner.
4. Explain the choice in one or two sentences that cite the person's own answers.
5. Name the runner-up and why it lost, in one sentence.
6. Write 5 to 8 teachings: the concrete rules and principles of the chosen method that every week must respect. No motivation lines.
7. Name the kinds of work this goal really involves, 1 to 3 of: ${WORK_KINDS.map((kind) => `"${kind}" (${WORK_KIND_LABELS[kind]})`).join(', ')}.
   Not every goal is repetition: baking is making and comparing, streaming is producing and shipping,
   vocabulary is learning and using, a song is sections and full run-throughs.
8. Build the work blocks: the 10 to 14 best pieces of work in the chosen method for getting THIS person to the goal
   as fast as possible, covering the kinds you named. For each:
   - "name": the action as a short title, 2 to 7 words ("Film 3 side-view attempts", "Bake one test loaf",
     "Write tonight's stream outline").
   - "kind": which kind of work it is.
   - "action": exactly what to do, in one or two sentences a beginner could follow without asking.
   - "output": what the user ends up with (a count, a recording, a photo, a finished piece, a recalled list,
     a published video).
   - "doneWhen": the proof the output is good enough ("18 of 20 recalled without looking", "crumb has no dense streak").
   - "realThing": true when it IS the goal itself end to end at this level (a full cascade attempt, a whole song,
     a real stream, a full loaf), false when it is practice for part of it. At least 2, one of them foundation.
   - "stage": "foundation" (weeks 1-4), "build" (weeks 5-8), "peak" (weeks 9-12). At least 3 foundation blocks,
     doable at this person's current level.
   - "impact": 1 to 5, progress toward the goal per minute spent. Be strict: only what the method's best coaches
     build everything around gets a 5.
   - "cue": the one thing to get right. "pitfall": the most common mistake at this level.
   No warm-ups, reading about it, watching videos, journaling, or app setup: every block moves the goal.
9. State the starting point you assumed for this person.
10. Give week 1 and week 12 numbers if the goal can be measured.

NAMES:
- You may name a program or its creator only if it is well known and you are sure it exists (e.g. "Couch to 5K").
- If you are not sure, describe the method plainly and set "creator" to "". Never invent a person, program, book, or link.
- Do not build a program name around an app or website ("TypeRacer Drills"). Name the method itself; a tool can
  appear in a teaching.

NUMBERS:
- 1 to 3 metrics that change over 12 weeks. Same "metric" and "unit" in week 1 and week 12.
- "direction" is which way is harder: "higher_is_harder" or "lower_is_harder".
- Week 1 is the easier end and every value is above 0. Week 12 is at most 10x week 1.
- Keep ramps realistic for this person, never elite or record numbers.
- If the goal names a result ("40 words per minute", "under 50 minutes", "3 balls"), week 12 must include that exact number and unit.
- Express times as one decimal number in one unit (8.05 "minutes per mile"), never "8:03".
- Set "hasNumericDimension" false only when the goal truly has nothing to count.`;

const targetSchema = {
  type: 'object',
  properties: {
    metric: { type: 'string' },
    value: { type: 'number' },
    unit: { type: 'string' },
    direction: { type: 'string', enum: ['higher_is_harder', 'lower_is_harder'] },
  },
  required: ['metric', 'value', 'unit', 'direction'],
};

export const METHOD_PICK_SCHEMA = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          creator: { type: 'string' },
          summary: { type: 'string' },
          scores: {
            type: 'object',
            properties: Object.fromEntries(FACTORS.map((factor) => [factor, { type: 'integer' }])),
            required: [...FACTORS],
          },
        },
        required: ['name', 'summary', 'scores'],
      },
    },
    chosenIndex: { type: 'integer' },
    whyChosen: { type: 'string' },
    runnerUpIndex: { type: 'integer' },
    whyNotRunnerUp: { type: 'string' },
    teachings: { type: 'array', items: { type: 'string' } },
    workKinds: { type: 'array', items: { type: 'string', enum: [...WORK_KINDS] } },
    blocks: { type: 'array', items: WORK_BLOCK_SCHEMA },
    assumptions: { type: 'string' },
    hasNumericDimension: { type: 'boolean' },
    week1Targets: { type: 'array', items: targetSchema },
    week12Targets: { type: 'array', items: targetSchema },
    progressionFormula: { type: 'string' },
  },
  required: [
    'candidates',
    'chosenIndex',
    'whyChosen',
    'runnerUpIndex',
    'whyNotRunnerUp',
    'teachings',
    'workKinds',
    'blocks',
    'assumptions',
    'hasNumericDimension',
    'week1Targets',
    'week12Targets',
    'progressionFormula',
  ],
};

function buildPrompt(input: PickMethodInput, targetPhrases: string[], failures: string[]): string {
  const answers = Object.entries(input.answers)
    .filter(([, answer]) => typeof answer === 'string' && answer.trim())
    .map(([question, answer]) => `- ${question}: ${answer}`)
    .join('\n');
  const targets = targetPhrases.length
    ? `\nResults the user named (week 12 must include each):\n${targetPhrases.map((item) => `- ${item}`).join('\n')}\n`
    : '';
  const correction = failures.length
    ? `\nYour previous answer was rejected by an automated check:\n${failures.map((item) => `- ${item}`).join('\n')}\nFix these.\n`
    : '';
  return `Goal as the user wrote it: "${input.rawGoal}"
Clarified goal: "${input.clarifiedOutcome}"
Time: ${input.dailyMinutes} minutes a day, ${input.activeDaysPerWeek} days a week, for 12 weeks.
Their answers:
${answers || '- (none given; assume a motivated beginner and say so in "assumptions")'}
${targets}${correction}`;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanTeachings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(cleanText)
    .filter((item) => item.length > 0 && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()))
    .slice(0, MAX_TEACHINGS);
}

function tableFrom(response: MethodPickResponse): VelocityTable {
  return {
    week1Targets: Array.isArray(response.week1Targets) ? response.week1Targets : [],
    week12Targets: Array.isArray(response.week12Targets) ? response.week12Targets : [],
    progressionFormula: cleanText(response.progressionFormula),
    assumptions: cleanText(response.assumptions),
  };
}

function score(candidate: MethodCandidate | undefined, factor: Factor): number {
  const value = Number(candidate?.scores?.[factor]);
  return Number.isFinite(value) ? value : 0;
}

export interface MethodCheck {
  failures: string[];
  /** Failures only in the numbers. The method itself is still usable. */
  numbersOnly: boolean;
  table: VelocityTable | null;
}

/** Everything the model returned is checked here, not trusted. */
export function checkMethodPick(response: MethodPickResponse, goalText: string): MethodCheck {
  const methodFailures: string[] = [];
  const candidates = Array.isArray(response.candidates) ? response.candidates : [];
  const chosen = candidates[response.chosenIndex];

  if (candidates.length < 2) methodFailures.push('List at least 2 candidate methods.');
  if (!chosen || !cleanText(chosen.name)) methodFailures.push('"chosenIndex" must point at a named candidate.');
  if (chosen && score(chosen, 'safety') < MIN_GATE_SCORE) {
    methodFailures.push(`The chosen method scored ${score(chosen, 'safety')} on safety. Choose a safer one.`);
  }
  if (chosen && score(chosen, 'fitToUser') < MIN_GATE_SCORE) {
    methodFailures.push(`The chosen method scored ${score(chosen, 'fitToUser')} on fit. Choose one that fits this person.`);
  }
  if (!cleanText(response.whyChosen)) methodFailures.push('"whyChosen" is empty.');
  if (cleanTeachings(response.teachings).length < MIN_TEACHINGS) {
    methodFailures.push(`Give at least ${MIN_TEACHINGS} concrete teachings.`);
  }
  methodFailures.push(...blockLibraryFailures(cleanBlocks(response.blocks), cleanWorkKinds(response.workKinds)));

  const targets = extractStatedTargets(goalText);
  const table = tableFrom(response);
  const wantsNumbers = response.hasNumericDimension !== false || targets.length > 0;
  const numberFailures = wantsNumbers
    ? [...validateVelocityTable(table).failures, ...statedTargetFailures(table, targets)]
    : [];

  return {
    failures: [...methodFailures, ...numberFailures],
    numbersOnly: methodFailures.length === 0 && numberFailures.length > 0,
    table: wantsNumbers && numberFailures.length === 0 ? table : null,
  };
}

export function groundingFromPick(response: MethodPickResponse, table: VelocityTable | null): PlanGrounding {
  const candidates = response.candidates ?? [];
  const chosen = candidates[response.chosenIndex];
  const runnerUp = response.runnerUpIndex !== response.chosenIndex ? candidates[response.runnerUpIndex] : undefined;
  return {
    methodKind: 'model_recommended',
    methodConfidence: 'first_principles',
    methodName: cleanText(chosen?.name),
    authority: cleanText(chosen?.creator) || undefined,
    teachings: cleanTeachings(response.teachings),
    workKinds: cleanWorkKinds(response.workKinds),
    blocks: cleanBlocks(response.blocks),
    assumptions: cleanText(response.assumptions) || undefined,
    allowedUrls: [],
    velocityTable: table,
    whyChosen: cleanText(response.whyChosen),
    runnerUp: runnerUp?.name
      ? { name: cleanText(runnerUp.name), whyNot: cleanText(response.whyNotRunnerUp) }
      : undefined,
  };
}

const defaultGenerate: Generate = async (prompt, system, temperature) => {
  const result = await generateStructuredContent<MethodPickResponse>(prompt, system, undefined, {
    responseSchema: METHOD_PICK_SCHEMA,
    temperature,
  });
  return result.success ? result.data : null;
};

/**
 * One model call picks the method for this person. A failed check retries once with the
 * reasons. If only the numbers are still wrong, the method is kept and week 12 is taken
 * from the goal text, or the plan runs on the teachings alone.
 */
export async function pickMethod(
  input: PickMethodInput,
  generate: Generate = defaultGenerate
): Promise<PickMethodResult> {
  const goalText = `${input.rawGoal} ${input.clarifiedOutcome}`;
  const verdict = screenQuery(goalText);
  if (verdict.blocked) {
    return { ok: false, reason: 'This goal is outside what Achivii can plan safely.', attempts: 0 };
  }

  const targets = extractStatedTargets(input.clarifiedOutcome);
  const targetPhrases = targets.map((item) => item.phrase);
  let failures: string[] = [];
  let usable: { response: MethodPickResponse; table: VelocityTable } | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    let response: MethodPickResponse | null = null;
    try {
      response = await generate(buildPrompt(input, targetPhrases, failures), SYSTEM_INSTRUCTION, attempt === 1 ? 0 : 0.4);
    } catch (err: any) {
      console.warn(`[Method] Attempt ${attempt} failed: ${err?.message || err}`);
    }
    if (!response) {
      failures = ['The model returned no usable JSON.'];
      continue;
    }

    const check = checkMethodPick(response, input.clarifiedOutcome);
    if (check.failures.length === 0) {
      return { ok: true, grounding: groundingFromPick(response, check.table), attempts: attempt };
    }
    console.warn(`[Method] Check failed on attempt ${attempt}: ${check.failures.join(' | ')}`);
    if (check.numbersOnly) usable = { response, table: tableFrom(response) };
    failures = check.failures;
  }

  if (usable) {
    const forced = targets.length > 0 ? forceUserTargets(usable.table, targets) : null;
    const table =
      forced && validateVelocityTable(forced).valid && statedTargetFailures(forced, targets).length === 0 ? forced : null;
    return { ok: true, grounding: groundingFromPick(usable.response, table), attempts: 2 };
  }

  return {
    ok: false,
    reason: 'Could not choose a method for this goal right now. Please retry in a moment.',
    attempts: 2,
  };
}
