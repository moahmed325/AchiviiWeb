import { describe, it, expect } from 'vitest';
import {
  clarifyGoalWithAI,
  generate12WeekPlanWithAI,
  adaptUpcomingWeekTasksWithAI
} from '../src/lib/ai/goalDecomposer.js';

describe('Goal Decomposer & 12-Week Architecture', () => {
  it('clarifies goal with 5-8 capabilities, scientific frameworks, and capstone criteria', async () => {
    const clarification = await clarifyGoalWithAI('Master acoustic guitar campfire songs');

    expect(clarification).toBeDefined();
    expect(clarification.clarifiedOutcome).toContain('90');
    expect(clarification.primaryDomain).toBeDefined();
    expect(clarification.capabilities).toBeDefined();
    expect(clarification.capabilities.length).toBeGreaterThanOrEqual(5);
    expect(clarification.scientificFrameworks.length).toBeGreaterThanOrEqual(2);
    expect(clarification.verificationCriteria).toBeDefined();
    expect(clarification.followUpQuestions.length).toBeGreaterThanOrEqual(3);
  });

  it('generates 12 weeks with progressive overload and milestone gates at weeks 4, 8, and 12', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Master acoustic guitar campfire songs',
      'By Day 90, I will play 5 campfire songs fluently from memory without stopping',
      { baseline: 'Complete beginner' },
      {
        dailyMinutes: 30,
        preferredSlot: 'morning',
        planVariant: 'steady' // 5 active days, 2 rest days
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);

    // Progressive overload phases
    expect(plan.weeks[0].phase).toBe('Foundation');
    expect(plan.weeks[4].phase).toBe('Acceleration');
    expect(plan.weeks[8].phase).toBe('Mastery');

    // Milestone Gates
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate'); // Week 4
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate'); // Week 8
    expect(plan.weeks[11].keyMilestone).toContain('Capstone'); // Week 12

    // Week 1 tasks match Steady variant (5 active, 2 rest)
    expect(plan.initialTasks.length).toBe(7);
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    const restTasks = plan.initialTasks.filter(t => t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(restTasks.length).toBe(2);

    // The 2-Day Rule: verify no two consecutive rest days
    for (let i = 0; i < plan.initialTasks.length - 1; i++) {
      if (plan.initialTasks[i].isRestDay) {
        expect(plan.initialTasks[i + 1].isRestDay).toBe(false);
      }
    }

    // Three Evidence Layers: verify every step in initial tasks has valid layer and reasoning
    const validLayers = ['mechanism', 'adherence', 'safety'];
    for (const task of plan.initialTasks) {
      expect(task.detailedSteps.length).toBeGreaterThan(0);
      for (const step of task.detailedSteps) {
        expect(validLayers).toContain(step.layer);
        expect(typeof step.layerReasoning).toBe('string');
        expect(step.layerReasoning.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('generates Minimal Viable plan with 4 active and 3 rest days obeying the 2-day rule', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Learn Spanish conversational fluency',
      'By Day 90, I will hold a 15-minute conversation with a native speaker',
      {},
      {
        dailyMinutes: 45,
        preferredSlot: 'evening',
        planVariant: 'minimal' // 4 active days, 3 rest days
      },
      new Date('2026-10-01')
    );

    expect(plan.initialTasks.length).toBe(7);
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    const restTasks = plan.initialTasks.filter(t => t.isRestDay);
    expect(activeTasks.length).toBe(4);
    expect(restTasks.length).toBe(3);

    // The 2-day rule: never 2 consecutive rest days
    for (let i = 0; i < plan.initialTasks.length - 1; i++) {
      if (plan.initialTasks[i].isRestDay) {
        expect(plan.initialTasks[i + 1].isRestDay).toBe(false);
      }
    }

    // Verify Three Evidence Layers on Minimal track
    const validLayers = ['mechanism', 'adherence', 'safety'];
    for (const task of plan.initialTasks) {
      for (const step of task.detailedSteps) {
        expect(validLayers).toContain(step.layer);
        expect(typeof step.layerReasoning).toBe('string');
        expect(step.layerReasoning.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('adapts upcoming week tasks grounded in previous week audit and score with evidence layer tagging', async () => {
    const adaptedTasks = await adaptUpcomingWeekTasksWithAI(
      'Master acoustic guitar campfire songs',
      2,
      'Week 2: Mechanics & Foundation Setup',
      'Lock in smooth transitions between G, C, and D chords',
      71, // Below 85% target
      'F chord transition was buzzing and rushed',
      { dailyMinutes: 30, preferredSlot: 'morning', planVariant: 'steady' },
      new Date('2026-10-08'),
      [
        {
          dayNumber: 1,
          dayOfWeek: 'Monday',
          title: 'Mechanical Calibration',
          isRestDay: false,
          status: 'completed',
          stepTitles: ['Posture setup', 'Finger position']
        },
        {
          dayNumber: 2,
          dayOfWeek: 'Tuesday',
          title: 'Chord transitions',
          isRestDay: false,
          status: 'completed',
          notes: 'Finger pain on index finger'
        },
        {
          dayNumber: 3,
          dayOfWeek: 'Wednesday',
          title: 'Pacing drill',
          isRestDay: false,
          status: 'pending' // Skipped
        }
      ]
    );

    expect(adaptedTasks.length).toBe(7);
    // Verified 2-day rule holds
    for (let i = 0; i < adaptedTasks.length - 1; i++) {
      if (adaptedTasks[i].isRestDay) {
        expect(adaptedTasks[i + 1].isRestDay).toBe(false);
      }
    }

    // Verify Three Evidence Layers on adapted tasks
    const validLayers = ['mechanism', 'adherence', 'safety'];
    for (const task of adaptedTasks) {
      expect(task.detailedSteps.length).toBeGreaterThan(0);
      for (const step of task.detailedSteps) {
        expect(validLayers).toContain(step.layer);
        expect(typeof step.layerReasoning).toBe('string');
        expect(step.layerReasoning.trim().length).toBeGreaterThan(10);
      }
    }
  });

  it('supports custom commitments and defaults to 60m evening routine for busy students and professionals', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Learn full-stack web development',
      'By Day 90, I will build and ship a full-stack SaaS application',
      {},
      {
        commitments: [
          { title: 'Gym Workout', time: '18:00 - 19:30' },
          { title: 'University Classes', time: '09:00 - 14:00' }
        ]
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    // Verified 60 min default plannedMinutes
    expect(plan.weeks[0].plannedMinutes).toBe(60);
    expect(plan.initialTasks.length).toBe(7);
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5); // Default steady
    expect(activeTasks[0].durationMinutes).toBe(60);
    expect(activeTasks[0].slotTime).toBe('19:30'); // Default evening slot
  });
});

