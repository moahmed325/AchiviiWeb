import type { CanonResearchResult, VelocityTable } from './types.js';

interface UrlBearingStep {
  resourceUrl?: string;
}

interface UrlBearingTask {
  resourceUrl?: string;
  detailedSteps?: UrlBearingStep[];
}

interface UrlBearingPlan {
  initialTasks?: UrlBearingTask[];
}

export interface PlanGrounding {
  methodKind?: string;
  methodConfidence: string;
  methodName?: string;
  authority?: string;
  sourceUrl?: string;
  teachings: string[];
  assumptions?: string;
  allowedUrls: string[];
  velocityTable: VelocityTable | null;
  /** Set when the model chose the method for this person. */
  whyChosen?: string;
  runnerUp?: { name: string; whyNot: string };
}

export function researchToGrounding(research: CanonResearchResult): PlanGrounding {
  return {
    methodKind: research.methodKind,
    methodConfidence: research.methodConfidence,
    methodName: research.methodName,
    authority: research.authority,
    sourceUrl: research.sourceUrl,
    teachings: research.teachings ?? [],
    assumptions: research.assumptions,
    allowedUrls: research.allowedUrls ?? [],
    velocityTable: research.velocityTable,
  };
}

export function hasUsableSpine(grounding?: PlanGrounding | null): boolean {
  return Boolean(grounding && grounding.teachings.length > 0);
}

export interface BasisBadge {
  label: string;
  /** True only for a corroborated named program. Never true for thin evidence. */
  anchored: boolean;
}

/**
 * What we tell the user the plan is based on.
 * A gold / "anchored" line is only for a named program that independent sources agreed on.
 */
export function formatBasisBadge(input: {
  methodKind?: string | null;
  methodConfidence?: string | null;
  methodName?: string | null;
  authority?: string | null;
}): BasisBadge | null {
  if (!input.methodKind && !input.methodConfidence) return null;

  const corroborated =
    input.methodKind === 'named_program' &&
    (input.methodConfidence === 'high_consensus' || input.methodConfidence === 'medium_consensus') &&
    Boolean(input.methodName?.trim());

  if (corroborated) {
    const who = input.authority?.trim() ? ` (${input.authority.trim()})` : '';
    return { label: `Anchored to ${input.methodName!.trim()}${who}`, anchored: true };
  }

  if (input.methodKind === 'model_recommended') {
    const name = input.methodName?.trim();
    const who = input.authority?.trim() ? ` (${input.authority.trim()})` : '';
    return { label: name ? `Recommended method: ${name}${who}` : 'Recommended method for your answers', anchored: false };
  }
  if (input.methodKind === 'shared_pattern') {
    return { label: 'Built from common practice — no single official method', anchored: false };
  }
  if (input.methodKind === 'technique') {
    return { label: 'No official program. Built from these sources', anchored: false };
  }
  if (input.methodKind === 'single_source') {
    return { label: 'Based on this source — thin evidence', anchored: false };
  }

  return { label: 'No single agreed method. Built from what the sources teach', anchored: false };
}

export function formatSpineBlock(grounding: PlanGrounding): string {
  const teachings = grounding.teachings.length
    ? grounding.teachings.map((item, index) => `  ${index + 1}. ${item}`).join('\n')
    : '  (none stored — keep this method; do not invent a new one)';
  const numbers = grounding.velocityTable
    ? [
        `Assumes: ${grounding.velocityTable.assumptions}`,
        `Progression: ${grounding.velocityTable.progressionFormula}`,
        `Week 1: ${grounding.velocityTable.week1Targets.map((t) => `${t.metric} ${t.value} ${t.unit}`).join('; ')}`,
        `Week 12: ${grounding.velocityTable.week12Targets.map((t) => `${t.metric} ${t.value} ${t.unit}`).join('; ')}`,
      ].join('\n')
    : 'No numeric table. Sequence the 12 weeks from the teachings.';

  const allowed =
    grounding.allowedUrls.length > 0
      ? grounding.allowedUrls.map((url) => `- ${url}`).join('\n')
      : '(none — omit every resourceUrl)';

  const why = grounding.whyChosen ? `Why this method for this user: ${grounding.whyChosen}\n` : '';

  return `
================================================================================
PLAN SPINE — mandatory grounding. Do not invent a different method.
================================================================================
Kind: ${grounding.methodKind ?? 'technique'}
Badge: ${grounding.methodConfidence}
Method label: ${grounding.methodName ?? '(none)'}
Authority: ${grounding.authority ?? '(none — do not invent one)'}
Primary source: ${grounding.sourceUrl ?? '(none)'}
Who this was written for: ${grounding.assumptions ?? 'not stated — say so in methodologyNotes'}
${why}
Teachings the week-1 tasks MUST practise (use this wording, not generic advice):
${teachings}

Numeric trajectory:
${numbers}

Allowed resourceUrl values (copy exactly or omit the field):
${allowed}

SAFETY CAPS (already applied to the numbers — do not write a task that exceeds them):
- Running or weekly distance: at most 10% above the previous week.
- Calorie deficit: between 250 and 600 kcal/day.
- Weeks 1–3: no compound lift at 100% of 1RM, and no set at 0 reps in reserve.

RULES:
- Week 1 active days must drill these teachings. Do not replace them with vague motivation.
- Later weeks stay on this same method and these numbers. Do not switch programs.
- methodologyNotes must state the kind and the basis in one or two sentences.
- Never name a coach, program, or URL that is not listed above.
- If a step has no allowed URL, omit resourceUrl. Keep resourceTitle / resourceWhy as text.
================================================================================
`;
}

export function formatMethodologyNotes(grounding: PlanGrounding): string {
  const basis = formatBasisBadge(grounding);
  const teachingLine = grounding.teachings.slice(0, 3).join(' ');
  const assumes = grounding.assumptions ? `Assumes ${grounding.assumptions}` : '';
  const why = grounding.whyChosen ? `Why: ${grounding.whyChosen}` : '';
  const runnerUp = grounding.runnerUp
    ? `Runner-up: ${grounding.runnerUp.name}${grounding.runnerUp.whyNot ? `, ${grounding.runnerUp.whyNot}` : ''}`
    : '';
  const lines = grounding.whyChosen ? [basis?.label, why, runnerUp, assumes] : [basis?.label, assumes, teachingLine];
  return lines.filter(Boolean).join('. ').replace(/\.\./g, '.').trim();
}

function isAllowedUrl(url: string | undefined, allowed: Set<string>): boolean {
  if (!url) return false;
  return allowed.has(url);
}

function stripTaskUrls<T extends UrlBearingTask>(task: T, allowed: Set<string>): T {
  const steps = (task.detailedSteps ?? []).map((step) => {
    if (isAllowedUrl(step.resourceUrl, allowed)) return step;
    const { resourceUrl: _dropped, ...rest } = step;
    return rest;
  });

  const next = { ...task, detailedSteps: steps };
  if (!isAllowedUrl(task.resourceUrl, allowed)) {
    delete next.resourceUrl;
  }
  return next;
}

/** Drops any link that was not retrieved during research. */
export function stripUnallowedUrls<T extends UrlBearingPlan>(plan: T, allowedUrls: string[]): T {
  const allowed = new Set(allowedUrls);
  return {
    ...plan,
    initialTasks: (plan.initialTasks ?? []).map((task) => stripTaskUrls(task, allowed)),
  };
}
