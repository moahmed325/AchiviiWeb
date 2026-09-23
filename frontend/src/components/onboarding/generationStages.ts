import type { PlanProgressEvent } from '../../lib/api';

/** OD-8 stage ids. These are frontend labels, not stream ids. */
export type GenerationStageId = 'understand' | 'choose' | 'build' | 'design';

export type GenerationStageState = 'complete' | 'active' | 'upcoming';

export interface GenerationStage {
  id: GenerationStageId;
  title: string;
  state: GenerationStageState;
  /** Streamed method name. Present only after a `method` event. */
  methodName?: string;
  /** Streamed whyChosen (`detail`). Present only after a `method` event. */
  whyChosen?: string;
  /**
   * Whole seconds on the still-working line.
   * Silence: the client clock, after 20 seconds with no new event.
   * A `slow: true` event: that event's seconds, plus whole client seconds since it arrived.
   */
  slowSeconds?: number;
}

/** The server stamps `slow` when `elapsedMs` passes this. The client uses the same wait during silence. */
export const SLOW_AFTER_MS = 20_000;

const TITLES: Record<GenerationStageId, string> = {
  understand: 'Understanding your goal',
  choose: 'Choosing your method',
  build: 'Building your 90-day journey',
  design: 'Designing your first steps',
};

/**
 * Map the create stream onto the OD-8 stages.
 * Understanding is already done (clarify ran). Building appears only when `method` arrives.
 * On the v1 path (`plan` with no `method`) that stage is omitted: no pending row, no invented name.
 *
 * `silenceSeconds` is whole seconds since this generation attempt started, counted on the client.
 * It is shown only while the latest event did not already arrive with `slow: true`, so the
 * "still working" line is never drawn twice. An event with `slow: true` starts from
 * `Math.round(elapsedMs / 1000)` and then keeps moving: `sinceSlowEventSeconds` is whole
 * client seconds since that event arrived. A later event clears it.
 */
export function generationStages(
  planSteps: PlanProgressEvent[],
  silenceSeconds?: number,
  sinceSlowEventSeconds?: number,
): GenerationStage[] {
  const search = planSteps.find((step) => step.id === 'search');
  const method = planSteps.find((step) => step.id === 'method');
  const plan = planSteps.find((step) => step.id === 'plan');
  const v1 = Boolean(plan) && !method;
  const last = planSteps[planSteps.length - 1];
  const eventSlow = last?.slow
    ? Math.round(last.elapsedMs / 1000) + Math.max(0, sinceSlowEventSeconds ?? 0)
    : undefined;
  const slowOn = (id: PlanProgressEvent['id']) => (last?.id === id ? eventSlow : undefined);

  const choose: GenerationStageState = method || v1 ? 'complete' : search ? 'active' : 'upcoming';
  const design: GenerationStageState = plan ? 'active' : 'upcoming';

  const stages: GenerationStage[] = [
    { id: 'understand', title: TITLES.understand, state: 'complete' },
    { id: 'choose', title: TITLES.choose, state: choose, slowSeconds: slowOn('search') },
  ];

  if (method) {
    stages.push({
      id: 'build',
      title: TITLES.build,
      state: 'complete',
      methodName: method.label,
      whyChosen: method.detail,
      slowSeconds: slowOn('method'),
    });
  }

  stages.push({ id: 'design', title: TITLES.design, state: design, slowSeconds: slowOn('plan') });

  if (silenceSeconds !== undefined && !last?.slow) {
    const waiting = stages.find((stage) => stage.state === 'active') ?? stages.find((stage) => stage.state === 'upcoming');
    if (waiting) waiting.slowSeconds = silenceSeconds;
  }

  return stages;
}

/**
 * Polite announcement when the active stage changes. The method name is included only once it has arrived.
 * The slow sentence has no ticking number: the visible line carries the seconds, and this sentence is said once.
 */
export function generationAnnouncement(stages: GenerationStage[], options?: { mentionSlow?: boolean }): string {
  const mentionSlow = options?.mentionSlow ?? false;
  const build = stages.find((stage) => stage.id === 'build' && stage.methodName);
  const active = stages.find((stage) => stage.state === 'active');
  const parts: string[] = [];
  if (build?.methodName) {
    parts.push(`Method chosen: ${build.methodName}.`);
    if (build.whyChosen) parts.push(build.whyChosen);
  }
  parts.push(active ? `${active.title}, in progress.` : 'Understanding your goal, complete.');
  if (mentionSlow && stages.some((stage) => stage.slowSeconds !== undefined)) {
    parts.push('This is taking longer than usual. Still working.');
  }
  return parts.join(' ');
}

/** Visible slow line. One sentence, whether the seconds came from the stream or from silence. */
export function slowCopy(seconds: number): string {
  return `This is taking longer than usual. Still working (${seconds}s).`;
}
