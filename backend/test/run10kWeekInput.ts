import type { WeekCallInput } from '../src/lib/ai/weekPlan.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';

// Plan safety limits M2.1: a run10k week 1 as goal create sends it, for the load prompt fixtures.
export const RUN10K_WEEK1: WeekCallInput = {
  finalGoal: 'Run 10 km in under 55 minutes',
  answers: [{ id: 'current_level', question: 'How far can you run today?', answer: '5 km in 32 minutes' }],
  dailyMinutes: 40,
  planVariant: 'steady',
  slotTime: '07:30',
  method: { name: '80/20 Polarized Training', creator: '', rules: ['Keep 80% of running easy', 'Never two hard days in a row'] },
  weekNumber: 1,
  totalWeeks: 12,
  phase: { name: 'Base', purpose: 'Build easy running time.' },
  focus: 'Easy aerobic running',
  weekStart: new Date('2026-09-21T12:00:00Z'),
  highLoadGoal: true,
  recovery: PATHWAY_PROFILES.run10k,
};
