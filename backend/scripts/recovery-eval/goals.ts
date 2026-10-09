/**
 * Method-aware recovery M2.2 (RULE-19, MR-24): the eval's 26 custom goals and the check that keeps them custom.
 * A goal is custom when no certified pathway matches it (`findPresetForGoal`, as goal create checks it) and the
 * unsafe screen does not refuse it (`screenQuery`, as `generateRoadmap` checks it).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPresetForGoal } from '../../src/lib/ai/presets/index.js';
import { screenQuery } from '../../src/lib/research/safetyFilter.js';
import { TEMPLATE_IDS, type TemplateId } from '../../src/lib/recovery/index.js';
import type { PlanAnswer } from '../../src/lib/ai/roadmap.js';

export const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));

export interface EvalGoal {
  id: string;
  /** The template this goal was chosen for (two goals per template). */
  template: TemplateId;
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
    if (!TEMPLATE_IDS.includes(goal.template)) problems.push(`${goal.id}: unknown template "${goal.template}".`);
    if (!goal.domain?.trim()) problems.push(`${goal.id}: no domain.`);
    if (goal.answers.length < 2 || goal.answers.length > 3) problems.push(`${goal.id}: needs 2 to 3 answers.`);
    const preset = findPresetForGoal(goal.rawGoal) || findPresetForGoal(goal.workingTitle);
    if (preset) problems.push(`${goal.id}: matches the pathway ${preset.id}.`);
    const success = goal.answers.find((answer) => answer.id === 'success')?.answer ?? '';
    if (screenQuery(`${goal.rawGoal} ${goal.workingTitle} ${success}`).blocked) problems.push(`${goal.id}: refused by the unsafe screen.`);
  }
  for (const template of TEMPLATE_IDS) {
    const count = goals.filter((goal) => goal.template === template).length;
    if (count !== 2) problems.push(`template ${template}: ${count} goals, needs 2.`);
  }
  return problems;
}
