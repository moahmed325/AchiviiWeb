import type { DailyTaskPlan, DetailedStep } from '../ai/goalDecomposer.js';

/** What the work of a goal actually looks like. A goal usually mixes 2 or 3. */
export const WORK_KINDS = ['train_body', 'motor_skill', 'recall', 'make', 'perform', 'project', 'solve', 'habit'] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_KIND_LABELS: Record<WorkKind, string> = {
  train_body: 'train the body (sets, holds, runs)',
  motor_skill: 'learn a movement (attempts at one part, film, fix one thing)',
  recall: 'memorise and recall (learn new items, recall from memory, use them for real)',
  make: 'make something (make one piece, compare to a reference, change one variable)',
  perform: 'perform (learn one section, run it end to end, record a full take)',
  project: 'build a project (produce a deliverable, ship it, read the result)',
  solve: 'solve problems (learn one pattern, solve under a condition, review the mistakes)',
  habit: 'build a habit or state (do the session, notice one thing, keep the streak)',
};

export const STAGES = ['foundation', 'build', 'peak'] as const;
export type Stage = (typeof STAGES)[number];

/** One piece of work from the chosen method. A day is built from several, never one repeated. */
export interface WorkBlock {
  /** The action as a short title: "Film 3 side-view attempts". */
  name: string;
  kind: WorkKind;
  /** Exactly what to do. */
  action: string;
  /** What the user ends up with: a count, a recording, a finished piece, a published video. */
  output: string;
  /** The proof the output is good enough. */
  doneWhen: string;
  /** Doing the goal itself end to end (a full run, a whole piece, a real stream), not practice for it. */
  realThing: boolean;
  stage: Stage;
  /** 1-5: how much it moves this person toward the goal per minute spent. */
  impact: number;
  cue: string;
  pitfall: string;
}

export const MIN_BLOCKS = 8;
const MAX_BLOCKS = 16;
const MIN_FOUNDATION = 3;
const MIN_REAL_THING = 2;

export const WORK_BLOCK_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    kind: { type: 'string', enum: [...WORK_KINDS] },
    action: { type: 'string' },
    output: { type: 'string' },
    doneWhen: { type: 'string' },
    realThing: { type: 'boolean' },
    stage: { type: 'string', enum: [...STAGES] },
    impact: { type: 'integer' },
    cue: { type: 'string' },
    pitfall: { type: 'string' },
  },
  required: ['name', 'kind', 'action', 'output', 'doneWhen', 'realThing', 'stage', 'impact', 'cue', 'pitfall'],
};

/** Moves nothing toward the goal on its own. */
const NOT_WORK = /\b(warm[- ]?up|cool[- ]?down|journal\w*|reflect\w*|read about|watch a video|install|set ?up|sign up)\b/i;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function stageForWeek(week: number): Stage {
  return week <= 4 ? 'foundation' : week <= 8 ? 'build' : 'peak';
}

export function cleanWorkKinds(value: unknown): WorkKind[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((kind): kind is WorkKind => WORK_KINDS.includes(kind)))].slice(0, 3);
}

/** Valid, de-duplicated blocks, highest impact first. */
export function cleanBlocks(value: unknown): WorkBlock[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const blocks: WorkBlock[] = [];
  for (const raw of value) {
    const name = text(raw?.name);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || NOT_WORK.test(name)) continue;
    const action = text(raw?.action);
    const output = text(raw?.output);
    const doneWhen = text(raw?.doneWhen);
    if (action.length < 15 || output.length < 4 || doneWhen.length < 8) continue;
    seen.add(key);
    const impact = Math.round(Number(raw?.impact));
    blocks.push({
      name,
      kind: WORK_KINDS.includes(raw?.kind) ? raw.kind : 'motor_skill',
      action,
      output,
      doneWhen,
      realThing: raw?.realThing === true,
      stage: STAGES.includes(raw?.stage) ? raw.stage : 'build',
      impact: Number.isFinite(impact) ? Math.min(5, Math.max(1, impact)) : 3,
      cue: text(raw?.cue) || 'Slow and correct beats fast.',
      pitfall: text(raw?.pitfall) || 'Rushing and skipping the check.',
    });
  }
  return blocks.sort((a, b) => b.impact - a.impact).slice(0, MAX_BLOCKS);
}

export function blockLibraryFailures(blocks: WorkBlock[], kinds: WorkKind[]): string[] {
  const failures: string[] = [];
  if (kinds.length === 0) failures.push('"workKinds" must name 1 to 3 kinds of work this goal involves.');
  if (blocks.length < MIN_BLOCKS) {
    failures.push(`Give at least ${MIN_BLOCKS} work blocks, each with an action, an output, and a doneWhen.`);
  }
  if (blocks.filter((block) => block.stage === 'foundation').length < MIN_FOUNDATION) {
    failures.push(`At least ${MIN_FOUNDATION} blocks must be "foundation" so week 1 has real work.`);
  }
  if (blocks.filter((block) => block.realThing).length < MIN_REAL_THING) {
    failures.push(`At least ${MIN_REAL_THING} blocks must be "realThing": doing the goal itself end to end at this level.`);
  }
  if (!blocks.some((block) => block.realThing && block.stage === 'foundation')) {
    failures.push('One "realThing" block must be "foundation": a beginner-sized version of the real thing for week 1.');
  }
  if (kinds.length > 1 && new Set(blocks.map((block) => block.kind)).size < 2) {
    failures.push('The blocks must cover more than one of the listed work kinds.');
  }
  return failures;
}

/** Best blocks for a week: its own stage first, then earlier stages, highest impact first. */
export function blocksForWeek(blocks: WorkBlock[], week: number): WorkBlock[] {
  const order = STAGES.indexOf(stageForWeek(week));
  const rank = (block: WorkBlock) => {
    const stage = STAGES.indexOf(block.stage);
    return stage === order ? 0 : stage < order ? 1 : 2;
  };
  return [...blocks].sort((a, b) => rank(a) - rank(b) || b.impact - a.impact);
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .map((word) => word.replace(/s$/, ''));
}

const TEST_PREFIX = /^(baseline test|retest|light practice|easy)\s*:?\s*/i;
const TEST_STEP = /^(baseline test|retest):/i;

/** The library block a step does, or null when the step is something else. */
export function matchBlock(stepTitle: string, blocks: WorkBlock[]): WorkBlock | null {
  const title = stepTitle.replace(TEST_PREFIX, '');
  const titleWords = new Set(words(title));
  let best: { block: WorkBlock; overlap: number } | null = null;
  for (const block of blocks) {
    if (title.toLowerCase().includes(block.name.toLowerCase())) return block;
    const nameWords = words(block.name);
    if (nameWords.length === 0) continue;
    const overlap = nameWords.filter((word) => titleWords.has(word)).length / nameWords.length;
    if (overlap >= 0.6 && (!best || overlap > best.overlap)) best = { block, overlap };
  }
  return best?.block ?? null;
}

function isWarmUp(step: DetailedStep): boolean {
  return /warm[- ]?up/i.test(step.title) && step.durationMinutes <= 5;
}

function isFlexible(step: DetailedStep): boolean {
  return isWarmUp(step) || TEST_STEP.test(step.title);
}

export function asBlockStep(step: DetailedStep, block: WorkBlock): DetailedStep {
  return {
    ...step,
    title: block.name,
    instructions: block.action,
    output: block.output,
    passMark: block.doneWhen,
    focusCue: block.cue,
    pitfallToAvoid: block.pitfall,
  };
}

function signature(task: DailyTaskPlan, blocks: WorkBlock[]): string {
  return (task.detailedSteps ?? [])
    .filter((step) => !isFlexible(step))
    .map((step) => matchBlock(step.title, blocks)?.name ?? step.title)
    .sort()
    .join('|');
}

/**
 * Keeps the week on the library and varied:
 * - a step that isn't a library block becomes the best block not yet used that day, preferring a kind of work
 *   the day doesn't have yet;
 * - a practice day identical to an earlier one gets its last step swapped;
 * - a week with no "real thing" gets one on its busiest non-test practice day.
 */
export function enforceBlocks(tasks: DailyTaskPlan[], blocks: WorkBlock[], week: number): DailyTaskPlan[] {
  if (blocks.length === 0) return tasks;
  const ranked = blocksForWeek(blocks, week);

  const pickFor = (usedNames: Set<string>, usedKinds: Set<WorkKind>, onlyRealThing = false): WorkBlock => {
    const pool = ranked.filter((block) => !usedNames.has(block.name) && (!onlyRealThing || block.realThing));
    return (
      pool.find((block) => !usedKinds.has(block.kind)) ??
      pool[0] ??
      (onlyRealThing ? ranked.find((block) => block.realThing) : undefined) ??
      ranked[0]
    );
  };

  const out = tasks.map((task) => {
    if (task.isRestDay) return task;
    const steps = task.detailedSteps ?? [];
    const usedNames = new Set<string>();
    const usedKinds = new Set<WorkKind>();
    for (const step of steps) {
      const match = matchBlock(step.title, ranked);
      if (match) {
        usedNames.add(match.name);
        usedKinds.add(match.kind);
      }
    }
    return {
      ...task,
      detailedSteps: steps.map((step) => {
        if (isFlexible(step)) return step;
        const match = matchBlock(step.title, ranked);
        if (match) return { ...step, output: step.output?.trim() ? step.output : match.output };
        const pick = pickFor(usedNames, usedKinds);
        usedNames.add(pick.name);
        usedKinds.add(pick.kind);
        return asBlockStep(step, pick);
      }),
    };
  });

  const seen = new Set<string>();
  for (const task of out) {
    if (task.isRestDay) continue;
    const sig = signature(task, ranked);
    if (sig && seen.has(sig)) {
      const steps = task.detailedSteps;
      const index = steps.map((step, i) => (isFlexible(step) ? -1 : i)).filter((i) => i >= 0).pop();
      if (index !== undefined) {
        const original = steps[index];
        const used = new Set(steps.map((step) => matchBlock(step.title, ranked)?.name).filter(Boolean) as string[]);
        const kinds = new Set(steps.map((step) => matchBlock(step.title, ranked)?.kind).filter(Boolean) as WorkKind[]);
        const candidates = ranked
          .filter((block) => !used.has(block.name))
          .sort((a, b) => Number(kinds.has(a.kind)) - Number(kinds.has(b.kind)));
        for (const candidate of candidates) {
          steps[index] = asBlockStep(original, candidate);
          if (!seen.has(signature(task, ranked))) break;
        }
      }
    }
    seen.add(signature(task, ranked));
  }

  const practice = out.filter((task) => !task.isRestDay && (task.detailedSteps ?? []).length > 0);
  const hasRealThing = practice.some((task) => task.detailedSteps.some((step) => matchBlock(step.title, ranked)?.realThing));
  if (!hasRealThing && practice.length > 0) {
    const host = practice.length > 2 ? practice[practice.length - 2] : practice[practice.length - 1];
    const candidates = host.detailedSteps.map((step, i) => (isFlexible(step) ? -1 : i)).filter((i) => i >= 0);
    const index = candidates.sort((a, b) => host.detailedSteps[b].durationMinutes - host.detailedSteps[a].durationMinutes)[0];
    const real = ranked.find((block) => block.realThing);
    if (index !== undefined && real) host.detailedSteps[index] = asBlockStep(host.detailedSteps[index], real);
  }

  return out;
}

/** What is still wrong with the week after enforcement. Empty when it sticks to the library and varies. */
export function blockWeekFailures(tasks: DailyTaskPlan[], blocks: WorkBlock[]): string[] {
  if (blocks.length === 0) return [];
  const failures: string[] = [];
  const signatures = new Map<string, number>();
  let realThing = false;
  for (const task of tasks) {
    if (task.isRestDay) continue;
    for (const step of task.detailedSteps ?? []) {
      if (isFlexible(step)) continue;
      const match = matchBlock(step.title, blocks);
      if (!match) failures.push(`Day ${task.dayNumber} step "${step.title}" is not a block from the library.`);
      if (match?.realThing) realThing = true;
    }
    const sig = signature(task, blocks);
    if (sig && signatures.has(sig)) {
      failures.push(`Day ${task.dayNumber} repeats Day ${signatures.get(sig)} step for step.`);
    }
    if (sig) signatures.set(sig, task.dayNumber);
  }
  if (!realThing) failures.push('No practice day does the real thing (a full run, a whole piece, a real attempt).');
  return failures;
}

export function formatBlockLibrary(blocks: WorkBlock[], kinds: WorkKind[]): string {
  if (blocks.length === 0) return '';
  const lines = blocks.map(
    (block, index) =>
      `  ${index + 1}. [${block.stage}, ${block.kind}${block.realThing ? ', REAL THING' : ''}, impact ${block.impact}/5] ${block.name}: ${block.action} You end with: ${block.output}. Done when: ${block.doneWhen}. Cue: ${block.cue}. Avoid: ${block.pitfall}.`
  );
  const kindLine = kinds.length ? `This goal's work is: ${kinds.map((kind) => WORK_KIND_LABELS[kind]).join('; ')}.\n` : '';
  return `
WORK BLOCKS — the best pieces of work for this person, highest impact first:
${kindLine}${lines.join('\n')}
BLOCK RULES:
- Every practice step is one of these blocks. Start the step "title" with the block name exactly as written.
  Only exceptions: one warm-up of at most 5 minutes, and the "Baseline test:" / "Retest:" steps.
- Build each day from different blocks, mixing the kinds of work. No two practice days are the same steps.
- Most practice days include a REAL THING block: doing the goal itself at today's level, not just prep for it.
- Weeks 1-4 use foundation blocks, weeks 5-8 build, weeks 9-12 peak. An earlier-stage block may stay as a
  second step. The highest-impact blocks of the stage get the most minutes.
- Adjust each block to today: say how much or how far (count, length, difficulty) in "instructions",
  and raise it through the week toward this week's numbers.
`;
}
