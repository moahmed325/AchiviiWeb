import { describe, expect, it } from 'vitest';
import type { Goal } from '../types';
import { closeLineWeek, fillPlanEnd, planEndLabel } from './weekClose';

// Weekly update M1.4 (section 6, WU-33 (4)): the moved-plan line is stored with `{date}` as written; the app fills in
// the plan's end (day 90: targetDate minus one day, a UTC date) in the viewer's locale, with the year only when it
// isn't this year.

const LINE = 'Your next week starts today. Your plan now ends on {date}.';
const NOW = new Date('2026-10-09T12:00:00Z');
// A plan moved 4 days: targetDate 2026-12-24 at UTC midnight, so day 90 is 23 December.
const goal = { targetDate: '2026-12-24T00:00:00.000Z' } as Pick<Goal, 'targetDate'>;

describe('the plan end in the moved-plan line', () => {
  it('fills {date} with day 90 in the viewer locale (two locales), the exact text kept', () => {
    expect(fillPlanEnd(LINE, goal, NOW, 'en-US')).toBe('Your next week starts today. Your plan now ends on December 23.');
    expect(fillPlanEnd(LINE, goal, NOW, 'en-GB')).toBe('Your next week starts today. Your plan now ends on 23 December.');
  });

  it('adds the year only when it is not this year', () => {
    const nextYear = { targetDate: '2027-01-02T00:00:00.000Z' } as Pick<Goal, 'targetDate'>;
    expect(planEndLabel(nextYear, NOW, 'en-US')).toBe('January 1, 2027');
    expect(planEndLabel(nextYear, NOW, 'en-GB')).toBe('1 January 2027');
    expect(planEndLabel(goal, NOW, 'en-US')).toBe('December 23');
  });

  it('reads the stored date as a UTC date, so no time zone shifts it', () => {
    // 1 January at UTC midnight is still 31 December the evening before in New York; day 90 must stay 31 December.
    const newYear = { targetDate: '2027-01-01T00:00:00.000Z' } as Pick<Goal, 'targetDate'>;
    expect(planEndLabel(newYear, NOW, 'en-US')).toBe('December 31');
  });

  it('leaves other lines alone and never shows the placeholder when the date is unreadable', () => {
    expect(fillPlanEnd('Next week is ready. Your targets stay as planned.', goal, NOW)).toBe('Next week is ready. Your targets stay as planned.');
    expect(fillPlanEnd(LINE, { targetDate: 'nope' } as Pick<Goal, 'targetDate'>, NOW)).toBe('Your next week starts today.');
  });

  it('the line once (closeLineWeek) shows it filled in', () => {
    const closed = {
      ...goal,
      roadmapWeeks: [{ weekNumber: 2, status: 'completed', closedBy: 'auto', closeLineSeenAt: null }],
      weeklyReviews: [{ weekNumber: 2, aiAdaptationInsight: LINE }],
    } as unknown as Goal;
    const line = closeLineWeek(closed, NOW)?.line;
    expect(line).toMatch(/^Your next week starts today\. Your plan now ends on .+\.$/);
    expect(line).not.toContain('{date}');
    expect(line).toContain(planEndLabel(goal, NOW)!);
  });
});
