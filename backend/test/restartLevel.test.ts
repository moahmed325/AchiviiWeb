import { describe, it, expect } from 'vitest';
import { restartLevel } from '../src/lib/weekClose/breaks.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import type { RecoveryProfile, Restart } from '../src/lib/recovery/profile.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Weekly update M3.4 (RULE-16, WU-16, WU-20 (2), WU-59 (1)): the level the first week back restarts at. Pure.

const km = (value: number): WeekTarget => ({ kind: 'number', metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' });
/** 10 km in week 1, up 1 km a week to 21 km. */
const climbing = Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, target: km(10 + i) as unknown, light: false }));
const profile = (restart: Restart): RecoveryProfile => ({ ...RECOVERY_TEMPLATES.language, returnRule: { breaks: [{ length: 'any', restart }], firstWeekBack: 'Easy.' } });

describe('the three restarts', () => {
  it.each([
    ['last level', 5, 14],
    ['back 1 week', 4, 13],
    ['back 2 weeks', 3, 12],
  ] as const)('%s: closing week 5 restarts at week %i\'s target', (restart, week, value) => {
    expect(restartLevel(profile(restart), 10, 5, climbing, 6)).toEqual({ restart, level: km(value), week, fellBack: null });
  });

  it('the entry follows the break length (endurance: back 1 week under 21 days, back 2 weeks from 21)', () => {
    expect(restartLevel(RECOVERY_TEMPLATES.endurance, 20, 6, climbing, 7)).toMatchObject({ restart: 'back 1 week', week: 5, level: km(14) });
    expect(restartLevel(RECOVERY_TEMPLATES.endurance, 21, 6, climbing, 7)).toMatchObject({ restart: 'back 2 weeks', week: 4, level: km(13) });
  });
});

describe('RULE-12: no rule is the last level', () => {
  it('no profile', () => {
    expect(restartLevel(null, 30, 5, climbing, 6)).toEqual({ restart: 'last level', level: km(14), week: 5, fellBack: null });
  });

  it('a profile with no matching entry', () => {
    const onlyShort: RecoveryProfile = { ...RECOVERY_TEMPLATES.endurance, returnRule: { breaks: [{ length: '1-2 weeks', restart: 'back 2 weeks' }], firstWeekBack: 'Easy.' } };
    expect(restartLevel(onlyShort, 30, 5, climbing, 6)).toEqual({ restart: 'last level', level: km(14), week: 5, fellBack: null });
  });
});

describe('WU-20 (2): week 1 is the floor', () => {
  it('a break in week 2 with "back 2 weeks" restarts at week 1', () => {
    expect(restartLevel(profile('back 2 weeks'), 10, 2, climbing, 3)).toEqual({ restart: 'back 2 weeks', level: km(10), week: 1, fellBack: null });
  });
});

describe('a light-test goal: the target the week shows', () => {
  // Weeks 4, 8 and 12 are big (12, 16, 20 km); a light week stores its next big week's target.
  const big: Record<number, number> = { 4: 12, 8: 16, 12: 20 };
  const shows = (week: number) => big[week <= 4 ? 4 : week <= 8 ? 8 : 12];
  const light = Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, target: km(shows(i + 1)) as unknown, light: ![4, 8, 12].includes(i + 1) }));

  it('closing light week 6, "back 2 weeks": week 4\'s 12 km', () => {
    expect(restartLevel(profile('back 2 weeks'), 10, 6, light, 7)).toEqual({ restart: 'back 2 weeks', level: km(12), week: 4, fellBack: null });
  });

  it('closing light week 6, "back 1 week": light week 5 shows week 8\'s 16 km, the same as week 6', () => {
    expect(restartLevel(profile('back 1 week'), 10, 6, light, 7)).toEqual({ restart: 'back 1 week', level: km(16), week: 5, fellBack: null });
  });

  it('closing big week 4, "back 1 week": light week 3 shows week 4\'s 12 km', () => {
    expect(restartLevel(profile('back 1 week'), 10, 4, light, 5)).toEqual({ restart: 'back 1 week', level: km(12), week: 3, fellBack: null });
  });

  it('no restart when next week shows week 12\'s target (closing week 8, or "Do my final week")', () => {
    expect(restartLevel(profile('back 1 week'), 10, 8, light, 9)).toBeNull();
    expect(restartLevel(profile('back 1 week'), 60, 5, climbing, 12)).toBeNull();
  });
});

describe("never harder than week n's target; a kind or unit change uses week n's", () => {
  it('an earlier week that is harder', () => {
    const weeks = climbing.map((week) => (week.weekNumber === 4 ? { ...week, target: km(20) } : week));
    expect(restartLevel(profile('back 1 week'), 10, 5, weeks, 6)).toEqual({ restart: 'back 1 week', level: km(14), week: 5, fellBack: 'harder' });
  });

  it('a lower-is-better target: a slower time is easier, a faster one harder', () => {
    const min = (value: number): WeekTarget => ({ kind: 'number', metric: '5k time', value, unit: 'minutes', direction: 'lower_is_better' });
    const weeks = Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1, target: min(35 - i) as unknown, light: false }));
    expect(restartLevel(profile('back 2 weeks'), 10, 5, weeks, 6)).toMatchObject({ level: min(33), week: 3, fellBack: null });
    const faster = weeks.map((week) => (week.weekNumber === 3 ? { ...week, target: min(25) } : week));
    expect(restartLevel(profile('back 2 weeks'), 10, 5, faster, 6)).toMatchObject({ level: min(31), week: 5, fellBack: 'harder' });
  });

  it('a kind change', () => {
    const weeks = climbing.map((week) => (week.weekNumber === 4 ? { ...week, target: { kind: 'deliverable', description: 'Run the route' } } : week));
    expect(restartLevel(profile('back 1 week'), 10, 5, weeks, 6)).toMatchObject({ level: km(14), week: 5, fellBack: 'kind' });
  });

  it('a unit change (an alias of the same unit is not a change)', () => {
    const miles = climbing.map((week) => (week.weekNumber === 4 ? { ...week, target: { ...km(8), unit: 'mi' } } : week));
    expect(restartLevel(profile('back 1 week'), 10, 5, miles, 6)).toMatchObject({ level: km(14), week: 5, fellBack: 'unit' });
    const alias = climbing.map((week) => (week.weekNumber === 4 ? { ...week, target: { ...km(13), unit: 'kilometers' } } : week));
    expect(restartLevel(profile('back 1 week'), 10, 5, alias, 6)).toMatchObject({ week: 4, fellBack: null });
  });
});

describe('"Keep going" counts back from the closing week', () => {
  it('closing week 3, picking up at week 6, "back 1 week": week 2\'s target', () => {
    expect(restartLevel(profile('back 1 week'), 40, 3, climbing, 6)).toEqual({ restart: 'back 1 week', level: km(11), week: 2, fellBack: null });
  });
});
