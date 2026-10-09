import { describe, expect, it } from 'vitest';
import { isDeliverableTarget, profileFailures, type RecoveryProfile } from '../../src/lib/recovery/index.js';
import { loadGoals, readJson } from './goals.js';
import type { RoadmapEntry } from './run.js';
import type { EvalAnswer } from './score.js';

describe('recovery eval answers (M2.2, MR-24)', () => {
  const goals = loadGoals();
  const roadmaps = readJson<RoadmapEntry[]>('roadmaps.json');
  const answers = readJson<EvalAnswer[]>('answers.json');

  it('has one answer per goal, on the goal template', () => {
    expect(answers.map((answer) => answer.goalId)).toEqual(goals.map((goal) => goal.id));
    for (const answer of answers) expect(answer.template).toBe(goals.find((goal) => goal.id === answer.goalId)!.template);
  });

  it('passes profileFailures with each goal deliverable fact, and every change says why', () => {
    for (const answer of answers) {
      const entry = roadmaps.find((item) => item.goalId === answer.goalId)!;
      const deliverableGoal = isDeliverableTarget(entry.profileInput.weeklyTargets[11]);
      expect(profileFailures(answer.profile as RecoveryProfile, { deliverableGoal }), answer.goalId).toEqual([]);
      for (const change of answer.changes) expect(change.why.trim(), answer.goalId).not.toBe('');
    }
  });
});
