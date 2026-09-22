import type { VelocityTable, VelocityTarget } from './types.js';

/** Week 1 → week 12 is 11 steps. 10% each step is the running-volume ceiling. */
const RUNNING_STEPS = 11;
const MAX_WEEKLY_RUNNING_INCREASE = 1.1;

export const CALORIE_DEFICIT_MIN = 250;
export const CALORIE_DEFICIT_MAX = 600;
/** Weeks 1–3 must not open at a true max. Week 12 may still peak higher. */
export const EARLY_WEEK_MAX_1RM_PERCENT = 80;
export const EARLY_WEEK_MIN_RIR = 3;

export interface ClampEvent {
  metric: string;
  field: 'week1' | 'week12';
  original: number;
  clamped: number;
  rule: string;
}

export interface SafetyClampResult {
  table: VelocityTable;
  events: ClampEvent[];
}

function blob(target: VelocityTarget): string {
  return `${target.metric} ${target.unit}`.toLowerCase();
}

function isRunningVolume(target: VelocityTarget): boolean {
  if (target.direction !== 'higher_is_harder') return false;
  const text = blob(target);
  if (/time|pace|finish|race|min\//.test(text) && !/volume|mileage|per week/.test(text)) return false;
  const volumeUnit = /^(mi|mile|miles|km|kilometer|kilometers)$/i.test(target.unit.trim());
  const volumeMetric = /mileage|weekly distance|run volume|volume|long run|distance/.test(target.metric.toLowerCase());
  return volumeUnit && volumeMetric;
}

function isCalorieDeficit(target: VelocityTarget): boolean {
  const text = blob(target);
  return /deficit/.test(text) || (/kcal|calorie/.test(text) && /cut|restriction|deficit/.test(text));
}

function isPercentOfMax(target: VelocityTarget): boolean {
  const text = blob(target);
  return /1\s*-?\s*rm|one[- ]rep|% of (1rm|max)|percent of max/.test(text);
}

function isRepsInReserve(target: VelocityTarget): boolean {
  return /\brir\b|reps in reserve/.test(blob(target));
}

function roundMetric(value: number, unit: string): number {
  if (/kcal|cal|%|rir|rep/i.test(unit)) return Math.round(value);
  return Math.round(value * 10) / 10;
}

function isTable(value: unknown): value is VelocityTable {
  if (!value || typeof value !== 'object') return false;
  const table = value as VelocityTable;
  return Array.isArray(table.week1Targets) && Array.isArray(table.week12Targets);
}

/**
 * Hard caps on researched numbers. Clamp, do not drop the table.
 * Safe to run twice: a value already inside the cap is left alone.
 * Cache hits must call this on read — a row written before a rule existed is not trusted.
 */
export function applySafetyClamps(
  table: VelocityTable,
  context?: { source?: string; goalId?: string }
): SafetyClampResult {
  if (!isTable(table)) {
    return { table, events: [] };
  }

  const events: ClampEvent[] = [];
  const week12ByMetric = new Map(table.week12Targets.map((target) => [target.metric, { ...target }]));
  const week1Targets = table.week1Targets.map((target) => ({ ...target }));

  for (const start of week1Targets) {
    const end = week12ByMetric.get(start.metric);
    if (!end || start.metric !== end.metric) continue;

    if (isRunningVolume(start) && start.value > 0 && end.value > start.value * MAX_WEEKLY_RUNNING_INCREASE ** RUNNING_STEPS) {
      const original = end.value;
      end.value = roundMetric(start.value * MAX_WEEKLY_RUNNING_INCREASE ** RUNNING_STEPS, end.unit);
      events.push({
        metric: start.metric,
        field: 'week12',
        original,
        clamped: end.value,
        rule: 'running volume week-over-week increase capped at 10%',
      });
    }

    if (isCalorieDeficit(start)) {
      const clampDeficit = (target: VelocityTarget, field: 'week1' | 'week12') => {
        const clamped = Math.min(CALORIE_DEFICIT_MAX, Math.max(CALORIE_DEFICIT_MIN, target.value));
        if (clamped === target.value) return;
        events.push({
          metric: target.metric,
          field,
          original: target.value,
          clamped,
          rule: 'calorie deficit clamped to 250–600 kcal/day',
        });
        target.value = clamped;
      };
      clampDeficit(start, 'week1');
      clampDeficit(end, 'week12');
    }

    if (isPercentOfMax(start) && start.value >= 100) {
      const original = start.value;
      start.value = EARLY_WEEK_MAX_1RM_PERCENT;
      events.push({
        metric: start.metric,
        field: 'week1',
        original,
        clamped: start.value,
        rule: 'weeks 1–3 compound lift capped below 100% 1RM',
      });
    }

    if (isRepsInReserve(start) && start.value <= 0) {
      const original = start.value;
      start.value = EARLY_WEEK_MIN_RIR;
      events.push({
        metric: start.metric,
        field: 'week1',
        original,
        clamped: start.value,
        rule: 'weeks 1–3 minimum 3 reps in reserve',
      });
    }
  }

  const next: VelocityTable = {
    ...table,
    week1Targets,
    week12Targets: table.week12Targets.map((target) => week12ByMetric.get(target.metric) ?? { ...target }),
  };

  if (events.length > 0) {
    console.warn(
      '[SafetyClamp]',
      JSON.stringify({
        source: context?.source ?? 'unknown',
        goalId: context?.goalId ?? null,
        events,
      })
    );
  }

  return { table: next, events };
}

/** Read-path clamp for a cached method object. Does not write the row back. */
export function clampVelocityOnCacheHit<T extends { velocityTable?: unknown }>(
  method: T,
  cacheId?: string
): T {
  if (!method || !isTable(method.velocityTable)) return method;
  const clamped = applySafetyClamps(method.velocityTable, { source: 'cache', goalId: cacheId });
  if (clamped.events.length === 0) return method;
  return { ...method, velocityTable: clamped.table };
}
