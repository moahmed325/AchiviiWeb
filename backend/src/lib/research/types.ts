/**
 * Whether a larger or smaller number represents the harder target.
 *
 * Without this, a sanity check cannot tell progress from regression: weekly mileage should
 * rise over 12 weeks, but a 10K finish time should fall. Asserting "week12 > week1" would
 * pass a plan that makes the runner slower.
 */
export type MetricDirection = 'higher_is_harder' | 'lower_is_harder';

export interface VelocityTarget {
  metric: string;
  value: number;
  unit: string;
  direction: MetricDirection;
}

export interface VelocityTable {
  week1Targets: VelocityTarget[];
  week12Targets: VelocityTarget[];
  progressionFormula: string;
  /**
   * Who these numbers are for (e.g. "an adult running roughly 10 miles per week already").
   * Stored on the goal and shown to the plan writer so it can personalise against it.
   */
  assumptions: string;
}
