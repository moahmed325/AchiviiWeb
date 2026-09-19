import { describe, it, expect } from 'vitest';
import {
  clarifyGoalWithAI,
  generate12WeekPlanWithAI,
  adaptUpcomingWeekTasksWithAI
} from '../src/lib/ai/goalDecomposer.js';

describe('Goal Decomposer & 12-Week Architecture', () => {
  it('clarifies goal with 5-8 capabilities, scientific frameworks, and capstone criteria', async () => {
    const clarification = await clarifyGoalWithAI('Master watercolor landscape painting');

    expect(clarification).toBeDefined();
    expect(clarification.clarifiedOutcome).toContain('90');
    expect(clarification.primaryDomain).toBeDefined();
    expect(clarification.capabilities).toBeDefined();
    expect(clarification.capabilities.length).toBeGreaterThanOrEqual(5);
    expect(clarification.scientificFrameworks.length).toBeGreaterThanOrEqual(2);
    expect(clarification.verificationCriteria).toBeDefined();
    expect(clarification.followUpQuestions.length).toBeGreaterThanOrEqual(3);
  });

  it('correctly matches and clarifies guitarPreset for acoustic guitar goals', async () => {
    const clarification = await clarifyGoalWithAI('Play 5 iconic guitar songs from memory');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Acoustic Guitar');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('guitar songs');
  });

  it('correctly matches and clarifies saasPreset for full-stack SaaS goals', async () => {
    const clarification = await clarifyGoalWithAI('Build and ship a SaaS to first paying user');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Software Engineering');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('SaaS');
  });

  it('correctly matches and clarifies spanishPreset for Spanish conversational goals', async () => {
    const clarification = await clarifyGoalWithAI('Hold a 15-minute conversational dialogue in Spanish');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Language Acquisition');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('dialogue in Spanish');
  });

  it('correctly matches and clarifies recompPreset for body recomposition and fat loss goals', async () => {
    const clarification = await clarifyGoalWithAI('Drop 5% body fat and build lean muscle');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Physique Transformation');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('body fat');
  });

  it('correctly matches and clarifies youtubePreset for content creation and YouTube goals', async () => {
    const clarification = await clarifyGoalWithAI('Launch a YouTube channel and publish 12 videos');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Audience Building');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('YouTube');
  });

  it('correctly matches and clarifies bookPreset for writing and publishing goals', async () => {
    const clarification = await clarifyGoalWithAI('Write and publish a 30,000-word book');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Creative Writing');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('manuscript');
  });

  it('correctly matches and clarifies deepWorkPreset for focus and productivity goals', async () => {
    const clarification = await clarifyGoalWithAI('Master deep work and double daily cognitive output');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Cognitive Performance');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(5);
    expect(clarification.clarifiedOutcome).toContain('deep work');
  });

  it('generates a full 12-week Deep Work plan with ultradian focus blocks and shutdown ritual gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Master deep work and double daily cognitive output',
      'Eliminate digital distractions, master 4 hours of daily unbroken deep work, and double high-leverage cognitive output',
      { baseline: 'Scattered Multitasker' },
      {
        dailyMinutes: 60,
        preferredSlot: 'morning',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[11].keyMilestone).toContain('Capstone');
    expect(plan.initialTasks.length).toBe(7);

    // Verify deep focus repetition challenges and Newport/Huberman resources
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(activeTasks[1].detailedSteps[1].challenge.type).toBe('repetitions');
    expect(activeTasks[1].detailedSteps[1].resourceTitle).toContain('Huberman');
  });

  it('correctly matches and clarifies chessPreset for chess rating goals', async () => {
    const clarification = await clarifyGoalWithAI('Climb from beginner to a 1200 chess rating');
    expect(clarification).toBeDefined();
    expect(clarification.primaryDomain).toContain('Chess Mastery');
    expect(clarification.scientificFrameworks.length).toBe(3);
    expect(clarification.followUpQuestions.length).toBe(3);
    expect(clarification.capabilities.length).toBe(6);
    expect(clarification.clarifiedOutcome).toContain('1200+');
  });

  it('generates a full 12-week Chess plan with Woodpecker tactical loops and rating milestone gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Climb from beginner to a 1200 chess rating',
      'Climb from beginner/unrated to a verified 1200+ Chess.com (or 1500+ Lichess) Rapid rating through deliberate tactical pattern recognition, blunder elimination, and fundamental endgame mechanics',
      { baseline: 'Absolute Beginner (<600 Chess.com / Unrated)' },
      {
        dailyMinutes: 45,
        preferredSlot: 'evening',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('800+ Rapid rating');
    expect(plan.weeks[7].keyMilestone).toContain('1000+ Rapid rating');
    expect(plan.weeks[11].keyMilestone).toContain('1200+ Rapid Rating');
    expect(plan.initialTasks.length).toBe(7);

    // Verify tactical repetition challenges and Woodpecker resources
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(activeTasks[0].detailedSteps[0].challenge.type).toBe('repetitions');
    expect(activeTasks[0].detailedSteps[0].resourceTitle).toContain('Woodpecker');

    // Verify active recovery master study on rest days
    const restTasks = plan.initialTasks.filter(t => t.isRestDay);
    expect(restTasks.length).toBe(2);
    expect(restTasks[0].detailedSteps[0].challenge.type).toBe('checklist');
  });

  it('generates a full 12-week Body Recomposition plan with mechanical tension and refeed gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Drop 5% body fat and build lean muscle',
      'Drop 5% body fat while preserving and building lean skeletal muscle mass through progressive overload and caloric deficit calibration',
      { baseline: 'Beginner / Untrained' },
      {
        dailyMinutes: 60,
        preferredSlot: 'morning',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[11].keyMilestone).toContain('Capstone');
    expect(plan.initialTasks.length).toBe(7);

    // Verify resistance repetitions and hypertrophy resources
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(activeTasks[0].detailedSteps[1].challenge.type).toBe('repetitions');
    expect(activeTasks[0].detailedSteps[1].resourceTitle).toContain('Hypertrophy');
  });

  it('generates a full 12-week Book writing plan with closed-door drafting and editing gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Write and publish a 30,000-word book',
      'Write, developmental-edit, and format a complete, polished 30,000-word non-fiction book manuscript ready for publishing',
      { baseline: 'First-Time Aspiring Author' },
      {
        dailyMinutes: 60,
        preferredSlot: 'morning',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[11].keyMilestone).toContain('Capstone');
    expect(plan.initialTasks.length).toBe(7);

    // Verify drafting word quota repetition challenges
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(activeTasks[2].detailedSteps[1].challenge.type).toBe('repetitions');
    expect(activeTasks[2].detailedSteps[1].resourceTitle).toContain('Pressfield');
  });

  it('generates a full 12-week YouTube plan with batching and 4-hour editing gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Launch a YouTube channel and publish 12 videos',
      'Launch an active YouTube channel, establish a weekly production pipeline, and publish 12 high-retention videos with custom packaging',
      { baseline: 'Camera-Shy Beginner' },
      {
        dailyMinutes: 60,
        preferredSlot: 'afternoon',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[11].keyMilestone).toContain('Capstone');
    expect(plan.initialTasks.length).toBe(7);

    // Verify creator checklist challenges and packaging resources
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(activeTasks[0].detailedSteps[0].challenge.type).toBe('checklist');
    expect(activeTasks[0].detailedSteps[0].resourceTitle).toContain('Retention');
  });

  it('generates a full 12-week SaaS plan with vertical slice and monetization gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Build and ship a SaaS to first paying user',
      'Build, deploy, and launch a full-stack SaaS web application to production and acquire your first paying customer',
      { baseline: 'Full-stack developer' },
      {
        dailyMinutes: 45,
        preferredSlot: 'morning',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[11].keyMilestone).toContain('Capstone');
    expect(plan.initialTasks.length).toBe(7);
  });

  it('generates a full 12-week Spanish conversational plan with comprehensible input and verbal gates', async () => {
    const plan = await generate12WeekPlanWithAI(
      'Hold a 15-minute conversational dialogue in Spanish',
      'Hold an unscripted 15-minute fluid conversational dialogue in Spanish with a native speaker without translation hesitation',
      { baseline: 'Complete beginner (A0)' },
      {
        dailyMinutes: 30,
        preferredSlot: 'evening',
        planVariant: 'steady'
      },
      new Date('2026-10-01')
    );

    expect(plan.weeks.length).toBe(12);
    expect(plan.weeks[3].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[7].keyMilestone).toContain('Milestone Gate');
    expect(plan.weeks[11].keyMilestone).toContain('Capstone');
    expect(plan.initialTasks.length).toBe(7);

    // Verify verbal challenges and resources
    const activeTasks = plan.initialTasks.filter(t => !t.isRestDay);
    expect(activeTasks.length).toBe(5);
    expect(activeTasks[0].detailedSteps[0].challenge.type).toBe('active_recall');
    expect(activeTasks[0].detailedSteps[0].resourceTitle).toContain('Notes in Spanish');
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

