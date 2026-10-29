import { beforeEach, describe, expect, it } from 'vitest';
import { CERTIFIED_PATHWAYS, findPathwayBySlug } from './certifiedPresets';
import { PLAN_PREVIEW_KEY, buildPlanPreview, clearPlanPreview, previewScheduleFor, savePlanPreview, suggestedMinutes } from './planPreview';
import { DAILY_MINUTE_OPTIONS } from './schedule';

const run10k = findPathwayBySlug('run10k')!;

beforeEach(() => localStorage.clear());

describe('plan preview', () => {
  it('counts sessions and hours from the two answers, and shows each phase without its week range', () => {
    const plan = buildPlanPreview(run10k, { dailyMinutes: 45, planVariant: 'steady' });
    expect(plan).toMatchObject({ sessions: 60, hours: 45, daysAWeek: 5 });
    expect(plan.phases.map((p) => p.weeks)).toEqual(['Weeks 1–4', 'Weeks 5–8', 'Weeks 9–12']);
    for (const phase of plan.phases) expect(phase.focus).not.toMatch(/Weeks?/);
  });

  it('suggests a daily time onboarding offers, for every pathway', () => {
    for (const p of CERTIFIED_PATHWAYS) expect(DAILY_MINUTE_OPTIONS).toContain(suggestedMinutes(p));
  });

  it('hands the answers to onboarding only for the same goal, and only while they are valid', () => {
    savePlanPreview(run10k, { dailyMinutes: 60, planVariant: 'accelerated' });
    expect(previewScheduleFor(run10k.title)).toEqual({ dailyMinutes: 60, planVariant: 'accelerated' });
    expect(previewScheduleFor(findPathwayBySlug('spanish')!.title)).toBeNull();
    expect(previewScheduleFor('Bake sourdough bread')).toBeNull();

    localStorage.setItem(PLAN_PREVIEW_KEY, JSON.stringify({ pathwayId: 'run10k', dailyMinutes: 20, planVariant: 'steady' }));
    expect(previewScheduleFor(run10k.title)).toBeNull();
    localStorage.setItem(PLAN_PREVIEW_KEY, JSON.stringify({ pathwayId: 'run10k', dailyMinutes: 30, planVariant: 'constructor' }));
    expect(previewScheduleFor(run10k.title)).toBeNull();
    localStorage.setItem(PLAN_PREVIEW_KEY, '{not json');
    expect(previewScheduleFor(run10k.title)).toBeNull();

    savePlanPreview(run10k, { dailyMinutes: 30, planVariant: 'steady' });
    clearPlanPreview();
    expect(previewScheduleFor(run10k.title)).toBeNull();
  });
});
