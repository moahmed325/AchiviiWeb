import {
  DiagnosticCategory,
  DiagnosticRecord,
  RescheduleActionType,
} from '../core/types.js';
import { DeviationReport } from './deviationDetector.js';
import { prisma } from '../../prisma.js';

export interface DiagnosticOption {
  id: string;
  category: DiagnosticCategory;
  label: string;
  description: string;
}

export interface DiagnosticQuestionItem {
  category: DiagnosticCategory;
  title: string;
  question: string;
  options: DiagnosticOption[];
}

export interface DiagnosticQuestions {
  userGoalId: string;
  triggerReason: string;
  questions: DiagnosticQuestionItem[];
}

export interface DiagnosticSubmission {
  primaryCategory: DiagnosticCategory;
  details: string;
  isPersistent: boolean;
  selectedOptionIds?: string[];
  updatedAvailableHours?: number;
}

/**
 * Generates tailored root-cause diagnostic questions across 6 categories:
 * Capacity, Capability, Recovery, Friction, Motivation, External.
 */
export function generateDiagnosticPrompt(
  userGoalId: string,
  deviation: DeviationReport
): DiagnosticQuestions {
  const questions: DiagnosticQuestionItem[] = [
    {
      category: 'CAPACITY',
      title: 'Time & Availability',
      question: 'Did unexpected life or work commitments reduce your available hours?',
      options: [
        {
          id: 'cap-opt-1',
          category: 'CAPACITY',
          label: 'Temporary busy spell',
          description: 'A brief spike in commitments (1-3 days); normal capacity resuming soon.',
        },
        {
          id: 'cap-opt-2',
          category: 'CAPACITY',
          label: 'Ongoing schedule reduction',
          description: 'My sustainable weekly time has dropped for the foreseeable future.',
        },
        {
          id: 'cap-opt-3',
          category: 'CAPACITY',
          label: 'Time was not the issue',
          description: 'I had the time available.',
        },
      ],
    },
    {
      category: 'CAPABILITY',
      title: 'Difficulty & Clarity',
      question: 'Was the planned session too difficult or unclear?',
      options: [
        {
          id: 'diff-opt-1',
          category: 'CAPABILITY',
          label: 'Task felt too difficult',
          description: 'Felt beyond current physical or technical baseline.',
        },
        {
          id: 'diff-opt-2',
          category: 'CAPABILITY',
          label: 'Unclear what to do',
          description: 'Ambiguous starting point or instructions.',
        },
        {
          id: 'diff-opt-3',
          category: 'CAPABILITY',
          label: 'Difficulty was appropriate',
          description: 'I understood what to do and could handle the demand.',
        },
      ],
    },
    {
      category: 'RECOVERY',
      title: 'Energy, Illness & Fatigue',
      question: 'Were you dealing with acute fatigue, illness, or excessive soreness?',
      options: [
        {
          id: 'rec-opt-1',
          category: 'RECOVERY',
          label: 'Acute illness / flu',
          description: 'Sickness or fever made execution counterproductive.',
        },
        {
          id: 'rec-opt-2',
          category: 'RECOVERY',
          label: 'Excessive physical fatigue / injury niggle',
          description: 'Body needed recovery to prevent breakdown.',
        },
        {
          id: 'rec-opt-3',
          category: 'RECOVERY',
          label: 'High mental depletion / sleep deprivation',
          description: 'Completely drained after demanding days.',
        },
      ],
    },
    {
      category: 'FRICTION',
      title: 'Execution & Setup Friction',
      question: 'Did setup friction, travel, or initiation difficulty prevent getting started?',
      options: [
        {
          id: 'fric-opt-1',
          category: 'FRICTION',
          label: 'Initiation paralysis / Procrastination',
          description: 'Could have done it, but struggled to initiate the start action.',
        },
        {
          id: 'fric-opt-2',
          category: 'FRICTION',
          label: 'Equipment or gym access unavailable',
          description: 'Logistical hurdle blocked planned method.',
        },
        {
          id: 'fric-opt-3',
          category: 'FRICTION',
          label: 'Scheduled time was inconvenient',
          description: 'Wrong time of day for high-focus work.',
        },
      ],
    },
    {
      category: 'MOTIVATION',
      title: 'Alignment & Purpose',
      question: 'Has this goal or method felt less inspiring or misaligned?',
      options: [
        {
          id: 'mot-opt-1',
          category: 'MOTIVATION',
          label: 'Goal still feels critical',
          description: 'Commitment remains high.',
        },
        {
          id: 'mot-opt-2',
          category: 'MOTIVATION',
          label: 'Questioning priority',
          description: 'Other life priorities feel more pressing right now.',
        },
        {
          id: 'mot-opt-3',
          category: 'MOTIVATION',
          label: 'Bored of the specific exercises',
          description: 'The method is becoming tedious.',
        },
      ],
    },
    {
      category: 'EXTERNAL',
      title: 'External Disruptions',
      question: 'Did external travel or unforeseen emergencies interfere?',
      options: [
        {
          id: 'ext-opt-1',
          category: 'EXTERNAL',
          label: 'Travel / Vacation',
          description: 'Away from normal execution environment.',
        },
        {
          id: 'ext-opt-2',
          category: 'EXTERNAL',
          label: 'Family / Personal emergency',
          description: 'Unforeseen external crisis took priority.',
        },
      ],
    },
  ];

  return {
    userGoalId,
    triggerReason: deviation.explanation,
    questions,
  };
}

/**
 * Submits a diagnostic result, determining whether the cause is TEMPORARY or PERSISTENT,
 * and produces a proposed RescheduleActionType for the Adaptive Rescheduler.
 */
export async function submitDiagnosis(
  userGoalId: string,
  input: DiagnosticSubmission
): Promise<DiagnosticRecord> {
  let proposedAction: RescheduleActionType = 'RESUME';

  if (input.isPersistent && input.primaryCategory === 'CAPACITY') {
    // Permanent time loss requires removing supportive work or compressing
    proposedAction = 'REMOVE';
    if (typeof input.updatedAvailableHours === 'number' && input.updatedAvailableHours > 0) {
      await prisma.userGoal.update({
        where: { id: userGoalId },
        data: {
          sustainable_weekly_capacity_hours: input.updatedAvailableHours,
        },
      });
    }
  } else if (input.primaryCategory === 'RECOVERY') {
    // Excessive fatigue requires compression/deloading rather than piling on catch-up debt
    proposedAction = 'COMPRESS';
  } else if (input.primaryCategory === 'CAPABILITY') {
    // Task was too difficult -> replace intervention with alternative or lower barrier
    proposedAction = 'REPLACE';
  } else if (input.primaryCategory === 'FRICTION') {
    // Setup friction -> reorder timing window or substitute home-based alternative
    proposedAction = 'REORDER';
  } else if (!input.isPersistent) {
    // Temporary 2-day disruption -> compress essential work and resume
    proposedAction = 'COMPRESS';
  }

  // Persist DiagnosticEvent record in Prisma
  await prisma.diagnosticEvent.create({
    data: {
      user_goal_id: userGoalId,
      trigger_reason: `Diagnostic triggered for category: ${input.primaryCategory}`,
      category: input.primaryCategory,
      root_cause_details: input.details,
      is_persistent: input.isPersistent,
      resolved_at: new Date(),
    },
  });

  return {
    triggerReason: `Diagnosed root cause: ${input.primaryCategory}`,
    category: input.primaryCategory,
    details: input.details,
    isPersistent: input.isPersistent,
    proposedAction,
  };
}
