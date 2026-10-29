import type { RoutineSettings } from '../types';
import { findPathwayByTitle, PATHWAY_ARCS, type CertifiedPathway } from './certifiedPresets';
import { DAILY_MINUTE_OPTIONS, DAYS_A_WEEK, type PlanVariant } from './schedule';

/**
 * The landing page's plan preview: a visitor picks a free goal and answers two schedule questions, and sees the
 * shape of their 90 days before signing up. Everything shown comes from the pathway's own data and the two answers;
 * nothing is generated. The answers are kept so onboarding starts with them filled in.
 */
export const PLAN_PREVIEW_KEY = 'achivii_plan_preview';

const WEEKS = 12;

export interface PlanPreviewAnswers {
  dailyMinutes: number;
  planVariant: PlanVariant;
}

export interface PlanPreviewPhase {
  weeks: string;
  name: string;
  focus: string;
}

export interface PlanPreview {
  sessions: number;
  hours: number;
  daysAWeek: number;
  dayOne: string;
  dayNinety: string;
  firstSession: { title: string; focus: string };
  phases: PlanPreviewPhase[];
}

/** The pathway's suggested daily time, or the nearest choice onboarding offers. */
export function suggestedMinutes(pathway: CertifiedPathway): number {
  return DAILY_MINUTE_OPTIONS.reduce((best, option) =>
    Math.abs(option - pathway.dailyMinutes) < Math.abs(best - pathway.dailyMinutes) ? option : best,
  );
}

/** "Aerobic base & cadence rhythm (Weeks 1–4)" without the week range, which the preview shows on its own. */
const phaseFocus = (focus: string) => focus.replace(/\s*\(Weeks?[^)]*\)\s*$/, '');

export function buildPlanPreview(pathway: CertifiedPathway, answers: PlanPreviewAnswers): PlanPreview {
  const arc = PATHWAY_ARCS[pathway.id];
  const daysAWeek = DAYS_A_WEEK[answers.planVariant];
  const sessions = daysAWeek * WEEKS;
  return {
    sessions,
    hours: Math.round((sessions * answers.dailyMinutes) / 60),
    daysAWeek,
    dayOne: arc?.dayOne ?? pathway.summary,
    dayNinety: arc?.dayNinety ?? pathway.outcome,
    firstSession: { title: arc?.weekOneSession ?? pathway.sampleDay.title, focus: pathway.sampleDay.focus },
    phases: [
      { weeks: 'Weeks 1–4', name: pathway.p1.name, focus: phaseFocus(pathway.p1.focus) },
      { weeks: 'Weeks 5–8', name: pathway.p2.name, focus: phaseFocus(pathway.p2.focus) },
      { weeks: 'Weeks 9–12', name: pathway.p3.name, focus: phaseFocus(pathway.p3.focus) },
    ],
  };
}

interface StoredPreview extends PlanPreviewAnswers {
  pathwayId: string;
}

const isVariant = (value: unknown): value is PlanVariant => typeof value === 'string' && Object.prototype.hasOwnProperty.call(DAYS_A_WEEK, value);

/** Kept across the sign-up, including an email confirmation in another tab. Storage may be unavailable; that's fine. */
export function savePlanPreview(pathway: CertifiedPathway, answers: PlanPreviewAnswers) {
  try {
    localStorage.setItem(PLAN_PREVIEW_KEY, JSON.stringify({ pathwayId: pathway.id, ...answers } satisfies StoredPreview));
  } catch {
    // Without storage, onboarding simply asks again.
  }
}

export function clearPlanPreview() {
  try {
    localStorage.removeItem(PLAN_PREVIEW_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The schedule a visitor chose in the preview, if it was for this goal (a pathway goal's text is its title).
 * Anything unreadable, or for another goal, is ignored.
 */
export function previewScheduleFor(goalText: string): Pick<RoutineSettings, 'dailyMinutes' | 'planVariant'> | null {
  const pathway = findPathwayByTitle(goalText);
  if (!pathway) return null;
  let stored: Partial<StoredPreview> | null;
  try {
    stored = JSON.parse(localStorage.getItem(PLAN_PREVIEW_KEY) ?? 'null');
  } catch {
    return null;
  }
  if (!stored || stored.pathwayId !== pathway.id) return null;
  if (!DAILY_MINUTE_OPTIONS.includes(Number(stored.dailyMinutes)) || !isVariant(stored.planVariant)) return null;
  return { dailyMinutes: Number(stored.dailyMinutes), planVariant: stored.planVariant };
}
