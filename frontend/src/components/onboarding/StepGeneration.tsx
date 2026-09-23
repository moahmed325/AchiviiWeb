import React, { useEffect, useState } from 'react';
import { Button } from '../ui';
import { StepMarker } from '../ui/Progress';
import type { PlanProgressEvent } from '../../lib/api';
import type { OnboardingError } from './requestErrors';
import { STEP_HEADING_ID } from './StepLayout';
import {
  SLOW_AFTER_MS,
  generationAnnouncement,
  generationStages,
  slowCopy,
  type GenerationStage,
  type GenerationStageState,
} from './generationStages';

interface StepGenerationProps {
  planSteps: PlanProgressEvent[];
  generationError: OnboardingError | null;
  onReviewInputs: () => void;
  onRetry: () => void;
}

const STATUS: Record<GenerationStageState, string> = {
  complete: 'Done',
  active: 'Now',
  upcoming: 'Not started',
};

const markerState: Record<GenerationStageState, 'completed' | 'active' | 'upcoming'> = {
  complete: 'completed',
  active: 'active',
  upcoming: 'upcoming',
};

/** Stage story without the ticking seconds, so a live region does not speak again every second. */
const stageStory = (stages: GenerationStage[]) =>
  stages
    .map((stage) =>
      [stage.id, stage.state, stage.methodName ?? '', stage.whyChosen ?? '', stage.slowSeconds !== undefined ? 'slow' : ''].join(':'),
    )
    .join('|');

const SLOW_SENTENCE = 'This is taking longer than usual. Still working.';

/**
 * One polite sentence. The slow fact is added the first time it becomes true, and is not repeated
 * when a later event is also slow or when only the seconds change.
 */
const nextAnnouncement = (stages: GenerationStage[], previous: string) => {
  const slowOn = stages.some((stage) => stage.slowSeconds !== undefined);
  const already = previous.includes(SLOW_SENTENCE);
  if (slowOn && already) {
    const base = generationAnnouncement(stages);
    const previousBase = previous.replace(` ${SLOW_SENTENCE}`, '');
    return previousBase === base ? previous : base;
  }
  return generationAnnouncement(stages, { mentionSlow: slowOn });
};

/**
 * The generation moment (OD-8), including a long wait and a failure.
 * During silence the seconds are the client clock since this attempt started.
 * A stream event with `slow: true` starts from that event's seconds and keeps counting
 * whole client seconds since the event arrived, still as one line on the active stage.
 */
export const StepGeneration: React.FC<StepGenerationProps> = ({ planSteps, generationError, onReviewInputs, onRetry }) => {
  const [clock, setClock] = useState(() => {
    const t = Date.now();
    return { startedAt: t, now: t };
  });
  const [silence, setSilence] = useState(false);

  const waitingKey =
    planSteps.length === 0 ? 'start' : planSteps.map((step) => `${step.id}:${step.elapsedMs}:${step.slow}`).join('|');
  const latestIsSlow = planSteps.length > 0 && planSteps[planSteps.length - 1].slow;
  const [seenKey, setSeenKey] = useState(waitingKey);
  const [sinceSlow, setSinceSlow] = useState(0);
  if (waitingKey !== seenKey) {
    setSeenKey(waitingKey);
    setSilence(false);
    setSinceSlow(0);
  }

  const fresh = planSteps.length === 0 && !generationError;

  useEffect(() => {
    if (generationError) return;
    const timeout = window.setTimeout(() => {
      setClock((prev) => ({ ...prev, now: Date.now() }));
      setSilence(true);
    }, SLOW_AFTER_MS);
    return () => window.clearTimeout(timeout);
  }, [waitingKey, generationError]);

  useEffect(() => {
    if (!silence || generationError) return;
    const interval = window.setInterval(() => {
      setClock((prev) => ({ ...prev, now: Date.now() }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [silence, generationError]);

  useEffect(() => {
    if (!latestIsSlow || generationError) return;
    const arrivedAt = Date.now();
    const interval = window.setInterval(() => {
      setSinceSlow(Math.max(0, Math.round((Date.now() - arrivedAt) / 1000)));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [latestIsSlow, generationError, waitingKey]);

  useEffect(() => {
    if (!fresh) return;
    const timeout = window.setTimeout(() => {
      const t = Date.now();
      setClock({ startedAt: t, now: t });
      setSilence(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [fresh]);

  useEffect(() => {
    if (!generationError) return;
    document.getElementById(STEP_HEADING_ID)?.focus({ preventScroll: true });
  }, [generationError]);

  const silenceSeconds =
    silence && !generationError ? Math.max(0, Math.round((clock.now - clock.startedAt) / 1000)) : undefined;
  const sinceSlowEventSeconds = latestIsSlow && !generationError ? sinceSlow : undefined;
  const stages = generationStages(planSteps, silenceSeconds, sinceSlowEventSeconds).map((stage) =>
    generationError ? { ...stage, slowSeconds: undefined } : stage,
  );
  const story = stageStory(stages);
  const [live, setLive] = useState({ key: '', text: '' });
  if (!generationError && story !== live.key) {
    setLive({ key: story, text: nextAnnouncement(stages, live.text) });
  }

  const stageList = (
    <ol aria-label="Building your path" className={generationError ? 'mt-8 flex flex-col' : 'mt-10 flex flex-col'}>
      {stages.map((stage, index) => (
        <li key={stage.id} aria-current={stage.state === 'active' ? 'step' : undefined} className="flex min-w-0 gap-4">
          <div className="flex flex-col items-center">
            <StepMarker state={markerState[stage.state]} />
            {index < stages.length - 1 && <span aria-hidden="true" className="my-1 w-px flex-1 bg-border" />}
          </div>
          <div className={`min-w-0 flex-1 ${index < stages.length - 1 ? 'pb-8' : ''}`}>
            <p className="text-body text-text">{stage.title}</p>
            <p className="mt-1 text-small text-text-secondary">{STATUS[stage.state]}</p>
            {stage.methodName && <p className="mt-3 break-words text-h3 text-text">{stage.methodName}</p>}
            {stage.whyChosen && <p className="mt-2 break-words text-small text-text-secondary">{stage.whyChosen}</p>}
            {stage.slowSeconds !== undefined && (
              <p className="mt-2 text-small text-text-secondary">{slowCopy(stage.slowSeconds)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );

  const errorPanel = generationError && (
    <div role="alert" className={`flex max-w-xl flex-col gap-4 ${planSteps.length > 0 ? 'mt-10 border-t border-border pt-8' : ''}`}>
      {planSteps.length > 0 ? (
        <h2 id={STEP_HEADING_ID} tabIndex={-1} className="text-h2 text-text outline-none">
          {generationError.title}
        </h2>
      ) : (
        <h1 id={STEP_HEADING_ID} tabIndex={-1} className="text-h1 text-text outline-none">
          {generationError.title}
        </h1>
      )}
      <p className="text-body text-text-secondary">{generationError.message}</p>
      {generationError.kind === 'server' && (
        <p className="text-body text-text-secondary">
          No plan was made, and your current journey, if you have one, is unchanged.
        </p>
      )}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Button variant="secondary" fullWidth className="sm:w-auto" onClick={onReviewInputs}>
          Review your answers
        </Button>
        <Button variant="primary" fullWidth className="sm:w-auto" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );

  if (generationError && planSteps.length === 0) {
    return errorPanel;
  }

  return (
    <div className="flex max-w-xl flex-col">
      <p className="font-ui-mono text-micro uppercase text-text-secondary">90 days</p>
      <h1
        id={generationError ? undefined : STEP_HEADING_ID}
        tabIndex={-1}
        className="mt-3 text-h1 text-text outline-none"
      >
        Building your path
      </h1>
      {!generationError && (
        <p className="mt-3 text-body text-text-secondary">Achivii is writing the journey from what you told us.</p>
      )}
      {!generationError && (
        <p className="sr-only" role="status" aria-live="polite">
          {live.text}
        </p>
      )}
      {stageList}
      {errorPanel}
    </div>
  );
};
