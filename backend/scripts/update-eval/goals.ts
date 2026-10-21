/**
 * Weekly update M3.2: the eval's 12 goals (all 10 pathways, a custom number goal and a custom deliverable goal) and the
 * check that each one is what it says: a pathway goal matches its pathway (`findPresetForGoal`, as goal create checks
 * it), a custom goal matches none, and the unsafe screen refuses none (`screenQuery`, as `generateRoadmap` checks it).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CERTIFIED_PRESETS, findPresetForGoal } from '../../src/lib/ai/presets/index.js';
import { screenQuery } from '../../src/lib/research/safetyFilter.js';
import type { PlanAnswer } from '../../src/lib/ai/roadmap.js';

export const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));

export interface EvalGoal {
  id: string;
  /** The pathway this goal was chosen for; null for the two custom goals. */
  pathway: string | null;
  rawGoal: string;
  /** Stands in for clarify's clarified outcome. */
  workingTitle: string;
  /** Clarify's short domain. */
  domain: string;
  answers: PlanAnswer[];
}

export function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(EVAL_DIR, name), 'utf8')) as T;
}

export function writeJson(name: string, value: unknown): void {
  writeFileSync(path.join(EVAL_DIR, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function loadGoals(): EvalGoal[] {
  return readJson<EvalGoal[]>('goals.json');
}

/** Every reason the goal set breaks the eval's shape; empty when it is fine. */
export function goalSetProblems(goals: EvalGoal[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const goal of goals) {
    if (ids.has(goal.id)) problems.push(`${goal.id}: id used twice.`);
    ids.add(goal.id);
    if (!goal.domain?.trim()) problems.push(`${goal.id}: no domain.`);
    if (goal.answers.length < 2 || goal.answers.length > 3) problems.push(`${goal.id}: needs 2 to 3 answers.`);
    const preset = findPresetForGoal(goal.rawGoal) || findPresetForGoal(goal.workingTitle);
    if ((preset?.id ?? null) !== goal.pathway) problems.push(`${goal.id}: matches ${preset?.id ?? 'no pathway'}, expected ${goal.pathway ?? 'none'}.`);
    const success = goal.answers.find((answer) => answer.id === 'success')?.answer ?? '';
    if (screenQuery(`${goal.rawGoal} ${goal.workingTitle} ${success}`).blocked) problems.push(`${goal.id}: refused by the unsafe screen.`);
  }
  for (const preset of CERTIFIED_PRESETS) {
    if (!goals.some((goal) => goal.pathway === preset.id)) problems.push(`pathway ${preset.id}: no goal.`);
  }
  const custom = goals.filter((goal) => goal.pathway === null).length;
  if (custom !== 2) problems.push(`${custom} custom goals, needs 2.`);
  return problems;
}
