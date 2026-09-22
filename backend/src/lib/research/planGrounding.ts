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

export function formatSpineBlock(grounding: PlanGrounding): string {
  const teachings = grounding.teachings.map((item, index) => `  ${index + 1}. ${item}`).join('\n');
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

  return `
================================================================================
RESEARCHED PLAN SPINE — mandatory grounding. Do not invent a different method.
================================================================================
Kind: ${grounding.methodKind ?? 'technique'}
Badge: ${grounding.methodConfidence}
Method label: ${grounding.methodName ?? '(none)'}
Authority: ${grounding.authority ?? '(none — do not invent one)'}
Primary source: ${grounding.sourceUrl ?? '(none)'}
Who this was written for: ${grounding.assumptions ?? 'not stated — say so in methodologyNotes'}

Teachings the week-1 tasks MUST practise (use this wording, not generic advice):
${teachings}

Numeric trajectory:
${numbers}

Allowed resourceUrl values (copy exactly or omit the field):
${allowed}

RULES:
- Week 1 active days must drill these teachings. Do not replace them with vague motivation.
- methodologyNotes must state the kind and the basis in one or two sentences.
- Never name a coach, program, or URL that is not listed above.
- If a step has no allowed URL, omit resourceUrl. Keep resourceTitle / resourceWhy as text.
================================================================================
`;
}

export function formatMethodologyNotes(grounding: PlanGrounding): string {
  const kindLabel =
    grounding.methodKind === 'named_program'
      ? `Anchored to ${grounding.methodName ?? 'a named program'}${grounding.authority ? ` (${grounding.authority})` : ''}.`
      : grounding.methodKind === 'shared_pattern'
        ? 'Built from common practice — no single official method.'
        : grounding.methodKind === 'single_source'
          ? 'Based on one source — thin evidence.'
          : 'No official program. Built from the technique these sources teach.';

  const teachingLine = grounding.teachings.slice(0, 3).join(' ');
  return `${kindLabel} ${grounding.assumptions ? `Assumes ${grounding.assumptions}` : ''} ${teachingLine}`.trim();
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
