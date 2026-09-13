import { DecisionTrace, RescheduleActionType } from '../core/types.js';
import { prisma } from '../../prisma.js';

export interface DecisionTraceParams {
  trigger: string;
  observation: string;
  diagnosis: string;
  assumptions: string[];
  optionsConsidered: string[];
  decision: string;
  tradeOff: string;
  forecastEffect: string;
  nextAction: string;
}

export interface RecordReplanAuditParams {
  userGoalId: string;
  fromTrajectoryId?: string | null;
  toTrajectoryId?: string | null;
  primaryAction: RescheduleActionType | string;
  decisionTrace: DecisionTrace;
}

/**
 * Creates a structured DecisionTrace object following the 9-part architectural model:
 * Trigger -> Observation -> Diagnosis -> Assumptions -> Options -> Decision -> Trade-off -> Forecast Effect -> Next Action
 */
export function createDecisionTrace(params: DecisionTraceParams): DecisionTrace {
  return {
    trigger: params.trigger,
    observation: params.observation,
    diagnosis: params.diagnosis,
    assumptions: params.assumptions || [],
    optionsConsidered: params.optionsConsidered || [],
    decision: params.decision,
    tradeOff: params.tradeOff,
    forecastEffect: params.forecastEffect,
    nextAction: params.nextAction,
  };
}

/**
 * Formats internal algorithmic decisions into a clean, humane, supportive 3-4 sentence user-facing explanation.
 *
 * Example:
 * "You missed two sessions due to illness. I have absorbed the missed work without catch-up debt.
 *  Your key endurance capability is still progressing normally. Projected completion remains Day 88."
 */
export function formatUserFacingExplanation(trace: DecisionTrace): string {
  // 1. Context / Reason (Sentence 1)
  let contextSentence = '';
  const diagLower = trace.diagnosis.toLowerCase();
  const trigLower = trace.trigger.toLowerCase();

  if (diagLower.includes('illness') || trigLower.includes('illness')) {
    contextSentence = 'You missed recent sessions due to illness.';
  } else if (diagLower.includes('capacity') || trigLower.includes('capacity')) {
    contextSentence = 'We observed a sustained change in your available weekly capacity.';
  } else if (diagLower.includes('fatigue') || trigLower.includes('recovery')) {
    contextSentence = 'We detected elevated fatigue threatening your recovery balance.';
  } else if (trigLower.includes('disruption') || diagLower.includes('deviation')) {
    contextSentence = 'We detected a scheduling disruption along your critical path.';
  } else {
    // Cleanly synthesize from diagnosis
    const cleanDiagnosis = trace.diagnosis.replace(/[.\s]+$/, '');
    contextSentence = `${cleanDiagnosis}.`;
  }

  // 2. Action taken + No-Debt guarantee (Sentence 2)
  let actionSentence = '';
  const decLower = trace.decision.toLowerCase();
  if (decLower.includes('remove')) {
    actionSentence = 'I have pruned non-critical supportive work without catch-up debt to strictly protect your primary bottleneck.';
  } else if (decLower.includes('compress')) {
    actionSentence = 'I have compressed essential work into focused, high-density sessions without adding catch-up debt.';
  } else if (decLower.includes('extend')) {
    actionSentence = 'I have extended your projected completion window to protect the standard without cramming unmanageable volume.';
  } else if (decLower.includes('reorder')) {
    actionSentence = 'I have re-sequenced your upcoming sessions to advance parallel skills while your bottleneck recovers.';
  } else if (decLower.includes('replace')) {
    actionSentence = 'I have substituted the current intervention with an equivalent format better suited to your conditions.';
  } else {
    actionSentence = 'I have absorbed the missed volume without catch-up debt so you can resume cleanly.';
  }

  // 3. Status of destination / capability (Sentence 3)
  let capabilitySentence = '';
  if (trace.tradeOff && trace.tradeOff.length > 0) {
    const cleanTradeoff = trace.tradeOff.replace(/[.\s]+$/, '');
    capabilitySentence = `${cleanTradeoff}.`;
  } else {
    capabilitySentence = 'Your core critical capability remains protected.';
  }

  // 4. Forecast effect and next immediate action (Sentence 4)
  let forecastSentence = '';
  const cleanForecast = trace.forecastEffect.replace(/[.\s]+$/, '');
  const cleanNext = trace.nextAction.replace(/[.\s]+$/, '');
  forecastSentence = `${cleanForecast}. Next step: ${cleanNext}.`;

  // Return cohesive, supportive 3-4 sentence paragraph
  return `${contextSentence} ${actionSentence} ${capabilitySentence} ${forecastSentence}`;
}

/**
 * Persists a DecisionTrace audit record into the ReplanAudit table in Prisma.
 */
export async function recordReplanAudit(params: RecordReplanAuditParams) {
  return await prisma.replanAudit.create({
    data: {
      user_goal_id: params.userGoalId,
      from_trajectory_id: params.fromTrajectoryId || null,
      to_trajectory_id: params.toTrajectoryId || null,
      primary_action: params.primaryAction,
      decision_trace: params.decisionTrace as any,
    },
  });
}
