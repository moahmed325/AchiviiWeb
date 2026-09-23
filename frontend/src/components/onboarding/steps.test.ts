import { describe, expect, it } from 'vitest';
import type { FollowUpQuestion } from '../../types';
import { STEP_ORDER, isFlowStep, nextStep, previousStep, splitQuestions } from './steps';

const q = (id: string): FollowUpQuestion => ({ id, question: `${id}?`, subtitle: '', options: ['A'], allowCustom: true });

describe('onboarding steps', () => {
  it('a pathway follows the spec order and a custom goal asks for the schedule first (ND-13)', () => {
    expect(STEP_ORDER.pathway).toEqual(['goal', 'starting', 'success', 'schedule', 'review']);
    expect(STEP_ORDER.custom).toEqual(['goal', 'schedule', 'starting', 'success', 'review']);
    expect(nextStep('pathway', 'schedule')).toBe('review');
    expect(nextStep('custom', 'schedule')).toBe('starting');
    expect(previousStep('custom', 'review')).toBe('success');
    expect(nextStep('custom', 'review')).toBeUndefined();
  });

  it('the success question joins the outcome and the rest describe the starting point, in clarify order (ND-14)', () => {
    const groups = splitQuestions([q('current_level'), q('success'), q('equipment'), q('obstacle')]);
    expect(groups.starting.map((x) => x.id)).toEqual(['current_level', 'equipment', 'obstacle']);
    expect(groups.success.map((x) => x.id)).toEqual(['success']);

    const preset = splitQuestions([q('baseline5k'), q('environment'), q('injury_history')]);
    expect(preset.success).toEqual([]);
    expect(preset.starting).toHaveLength(3);
  });

  it('only step names count as history entries', () => {
    expect(isFlowStep('schedule')).toBe(true);
    expect(isFlowStep('generation')).toBe(false);
    expect(isFlowStep(2)).toBe(false);
    expect(isFlowStep(undefined)).toBe(false);
  });
});
