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

  it('compares years on one clock near New Year (UTC), whatever the device time zone', () => {
    const march = { targetDate: '2027-03-02T00:00:00.000Z' } as Pick<Goal, 'targetDate'>;
    // Just after midnight UTC on 1 January 2027 (still 2026 in the Americas): this year is 2027, so no year.
    expect(planEndLabel(march, new Date('2027-01-01T00:30:00Z'), 'en-US')).toBe('March 1');
    // Just before it: still 2026, so the year shows.
    expect(planEndLabel(march, new Date('2026-12-31T23:30:00Z'), 'en-US')).toBe('March 1, 2027');
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

  it('M1.5a: the welcome-back line gets the same fill, and loses only its date sentence when the date is unreadable', () => {
    const welcome = 'Welcome back. Your plan picks up from here and now ends on {date}.';
    expect(fillPlanEnd(welcome, goal, NOW, 'en-US')).toBe('Welcome back. Your plan picks up from here and now ends on December 23.');
    expect(fillPlanEnd(welcome, { targetDate: 'nope' } as Pick<Goal, 'targetDate'>, NOW)).toBe('Welcome back.');
    const closed = {
      ...goal,
      roadmapWeeks: [{ weekNumber: 2, status: 'completed', closedBy: 'auto', closeLineSeenAt: null }],
      weeklyReviews: [{ weekNumber: 2, aiAdaptationInsight: welcome }],
    } as unknown as Goal;
    expect(closeLineWeek(closed, NOW)?.line).toBe(`Welcome back. Your plan picks up from here and now ends on ${planEndLabel(goal, NOW)}.`);
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
