import { describe, it, expect } from 'vitest';
import { applySafetyClamps, clampVelocityOnCacheHit } from '../src/lib/research/safetyClamps.js';
import { formatBasisBadge, formatMethodologyNotes } from '../src/lib/research/planGrounding.js';
import type { VelocityTable, VelocityTarget } from '../src/lib/research/types.js';

function target(partial: Partial<VelocityTarget> & Pick<VelocityTarget, 'metric' | 'value' | 'unit' | 'direction'>): VelocityTarget {
  return partial;
}

function table(week1: VelocityTarget, week12: VelocityTarget): VelocityTable {
  return {
    week1Targets: [week1],
    week12Targets: [week12],
    progressionFormula: 'Linear ramp.',
    assumptions: 'A beginner.',
  };
}

describe('Phase 4 — safety clamps', () => {
  it('caps a running-volume jump at 10% per week', () => {
    const result = applySafetyClamps(
      table(
        target({ metric: 'weekly mileage', value: 10, unit: 'miles', direction: 'higher_is_harder' }),
        target({ metric: 'weekly mileage', value: 80, unit: 'miles', direction: 'higher_is_harder' })
      )
    );
    const capped = result.table.week12Targets[0].value;
    expect(capped).toBeCloseTo(10 * 1.1 ** 11, 1);
    expect(capped).toBeLessThan(80);
    expect(result.events[0].rule).toMatch(/10%/);
  });

  it('clamps a crash-diet deficit into 250–600 kcal and leaves a safe one', () => {
    const crash = applySafetyClamps(
      table(
        target({ metric: 'daily calorie deficit', value: 100, unit: 'kcal', direction: 'higher_is_harder' }),
        target({ metric: 'daily calorie deficit', value: 1200, unit: 'kcal', direction: 'higher_is_harder' })
      )
    );
    expect(crash.table.week1Targets[0].value).toBe(250);
    expect(crash.table.week12Targets[0].value).toBe(600);

    const safe = applySafetyClamps(
      table(
        target({ metric: 'daily calorie deficit', value: 300, unit: 'kcal', direction: 'higher_is_harder' }),
        target({ metric: 'daily calorie deficit', value: 500, unit: 'kcal', direction: 'higher_is_harder' })
      )
    );
    expect(safe.events).toHaveLength(0);
    expect(safe.table.week12Targets[0].value).toBe(500);
  });

  it('stops a week-1 max lift and a 0-RIR set', () => {
    const lifts = applySafetyClamps(
      table(
        target({ metric: 'squat percent of 1RM', value: 100, unit: '%', direction: 'higher_is_harder' }),
        target({ metric: 'squat percent of 1RM', value: 90, unit: '%', direction: 'higher_is_harder' })
      )
    );
    expect(lifts.table.week1Targets[0].value).toBe(80);
    expect(lifts.table.week12Targets[0].value).toBe(90);

    const rir = applySafetyClamps(
      table(
        target({ metric: 'bench RIR', value: 0, unit: 'rir', direction: 'lower_is_harder' }),
        target({ metric: 'bench RIR', value: 1, unit: 'rir', direction: 'lower_is_harder' })
      )
    );
    expect(rir.table.week1Targets[0].value).toBe(3);
    expect(rir.table.week12Targets[0].value).toBe(1);
  });

  it('does not rewrite a 10K finish time', () => {
    const result = applySafetyClamps(
      table(
        target({ metric: '10K finish time', value: 60, unit: 'min', direction: 'lower_is_harder' }),
        target({ metric: '10K finish time', value: 49, unit: 'min', direction: 'lower_is_harder' })
      )
    );
    expect(result.events).toHaveLength(0);
    expect(result.table.week12Targets[0].value).toBe(49);
  });

  it('clamps a cached table on read without needing a fresh search', () => {
    const method = clampVelocityOnCacheHit({
      methodName: 'crash cut',
      velocityTable: table(
        target({ metric: 'calorie deficit', value: 1500, unit: 'kcal', direction: 'higher_is_harder' }),
        target({ metric: 'calorie deficit', value: 1500, unit: 'kcal', direction: 'higher_is_harder' })
      ),
    });
    expect(method.velocityTable.week1Targets[0].value).toBe(600);
    expect(method.velocityTable.week12Targets[0].value).toBe(600);
  });
});

describe('Phase 4 — honest basis', () => {
  it('never anchors a stone-skipping technique', () => {
    const badge = formatBasisBadge({
      methodKind: 'technique',
      methodConfidence: 'first_principles',
      methodName: 'Get good at competitive stone skipping technique',
    });
    expect(badge?.anchored).toBe(false);
    expect(badge?.label).not.toMatch(/anchored/i);
    expect(badge?.label).not.toMatch(/certified/i);
    expect(badge?.label).toMatch(/No official program/);
  });

  it('may anchor a corroborated named program such as MBSR', () => {
    const badge = formatBasisBadge({
      methodKind: 'named_program',
      methodConfidence: 'high_consensus',
      methodName: 'MBSR',
      authority: 'Jon Kabat-Zinn',
    });
    expect(badge).toEqual({
      label: 'Anchored to MBSR (Jon Kabat-Zinn)',
      anchored: true,
    });
  });

  it('does not anchor a named program that sources did not agree on', () => {
    const badge = formatBasisBadge({
      methodKind: 'named_program',
      methodConfidence: 'first_principles',
      methodName: 'MBSR',
      authority: 'Jon Kabat-Zinn',
    });
    expect(badge?.anchored).toBe(false);
    expect(badge?.label).not.toMatch(/Anchored/);
    expect(formatMethodologyNotes({
      methodKind: 'technique',
      methodConfidence: 'first_principles',
      teachings: ['Aim to hit the water at about 20 degrees.'],
      allowedUrls: [],
      velocityTable: null,
    })).toMatch(/No official program/);
  });
});
