import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { generate12WeekPlanWithAI, fillMissingStepLayers, adaptUpcomingWeekTasksWithAI } from '../src/lib/ai/goalDecomposer.js';
import {
  formatSpineBlock,
  formatMethodologyNotes,
  stripUnallowedUrls,
  hasUsableSpine,
} from '../src/lib/research/planGrounding.js';
import type { PlanGrounding } from '../src/lib/research/planGrounding.js';

const mockLlm = generateStructuredContent as unknown as ReturnType<typeof vi.fn>;

const grounding: PlanGrounding = {
  methodKind: 'technique',
  methodConfidence: 'first_principles',
  methodName: 'Get good at competitive stone skipping technique',
  teachings: [
    'Choose a flat stone 3-5 inches across.',
    'Throw sidearm with as much spin as you can.',
    'Aim to hit the water at about 20 degrees.',
  ],
  assumptions: 'A beginner at a lake.',
  allowedUrls: [
    'https://en.wikipedia.org/wiki/Stone_skipping',
    'https://www.outsideonline.com/stone-skipping-kurt-steiner',
  ],
  velocityTable: null,
};

function dummyPlan(extraUrl?: string) {
  const step = (title: string, url?: string) => ({
    stepNumber: 1,
    title,
    durationMinutes: 30,
    instructions: title,
    focusCue: 'focus',
    pitfallToAvoid: 'rushing',
    layer: 'adherence' as const,
    layerReasoning: 'How skippers actually practise the throw.',
    resourceTitle: 'Guide',
    resourceUrl: url,
    resourceType: 'guide' as const,
    resourceWhy: 'Source',
  });

  const task = (day: number, title: string, rest: boolean, url?: string) => ({
    dayNumber: day,
    dayOfWeek: 'Monday',
    title,
    isRestDay: rest,
    durationMinutes: rest ? 10 : 30,
    slotTime: '19:30',
    implementationIntention: 'When: 19:30 | Where: lake | Action: throw',
    detailedSteps: rest ? [] : [step(title, url)],
    resourceUrl: url,
  });

  return {
    clarifiedOutcome: 'Skip stones competitively',
    methodologyNotes: 'notes',
    weeks: Array.from({ length: 12 }, (_, i) => ({
      weekNumber: i + 1,
      phase: (i < 4 ? 'Foundation' : i < 8 ? 'Acceleration' : 'Mastery') as
        | 'Foundation'
        | 'Acceleration'
        | 'Mastery',
      theme: `Week ${i + 1}`,
      objective: 'obj',
      keyMilestone: 'gate',
      targetIntensity: 60,
      plannedMinutes: 30,
    })),
    initialTasks: [
      task(1, 'Flat stone selection', false, 'https://en.wikipedia.org/wiki/Stone_skipping'),
      task(2, 'Spin drill', false, extraUrl),
      task(3, 'Active Recovery & Reflection', true),
      task(4, '20 degree entry', false, 'https://invented.example/fake'),
      task(5, 'Sidearm reps', false),
      task(6, 'Active Recovery & Reflection', true),
      task(7, 'Combine spin and angle', false, 'https://www.outsideonline.com/stone-skipping-kurt-steiner'),
    ],
  };
}

describe('Phase 3 — plan grounding', () => {
  beforeEach(() => {
    mockLlm.mockReset();
  });

  it('formats teachings so the plan writer cannot miss them', () => {
    const block = formatSpineBlock(grounding);
    expect(block).toMatch(/20 degrees/);
    expect(block).toMatch(/en\.wikipedia\.org/);
    expect(block).toMatch(/Do not invent a different method/);
    expect(hasUsableSpine(grounding)).toBe(true);
    expect(formatMethodologyNotes(grounding)).toMatch(/No official program/);
  });

  it('drops invented links and keeps retrieved ones', () => {
    const stripped = stripUnallowedUrls(dummyPlan('https://invented.example/fake'), grounding.allowedUrls);
    const urls = [
      stripped.initialTasks[0].resourceUrl,
      stripped.initialTasks[1].resourceUrl,
      stripped.initialTasks[3].resourceUrl,
      stripped.initialTasks[3].detailedSteps[0].resourceUrl,
      stripped.initialTasks[6].resourceUrl,
    ];
    expect(urls[0]).toBe('https://en.wikipedia.org/wiki/Stone_skipping');
    expect(urls[1]).toBeUndefined();
    expect(urls[2]).toBeUndefined();
    expect(urls[3]).toBeUndefined();
    expect(urls[4]).toBe('https://www.outsideonline.com/stone-skipping-kurt-steiner');
  });

  it('injects the spine into the plan prompt and strips bad URLs from the result', async () => {
    mockLlm.mockImplementation(async (prompt: string) => {
      expect(prompt).toMatch(/20 degrees/);
      expect(prompt).toMatch(/RESEARCHED PLAN SPINE/);
      return { success: true, data: dummyPlan('https://invented.example/fake') };
    });

    const plan = await generate12WeekPlanWithAI(
      'Get good at competitive stone skipping',
      'Get good at competitive stone skipping',
      {},
      { dailyMinutes: 30, preferredSlot: 'evening', planVariant: 'steady' },
      new Date('2026-10-01'),
      { grounding }
    );

    expect(plan.initialTasks[1].title).toMatch(/Spin/i);
    expect(plan.initialTasks[1].resourceUrl).toBeUndefined();
    expect(plan.initialTasks[0].resourceUrl).toBe('https://en.wikipedia.org/wiki/Stone_skipping');
  });

  it('fills missing layer fields so a researched plan is not discarded', () => {
    const [task] = fillMissingStepLayers([
      {
        dayNumber: 1,
        dayOfWeek: 'Monday',
        title: 'Sit and breathe',
        isRestDay: false,
        durationMinutes: 15,
        slotTime: '19:30',
        implementationIntention: 'When: 19:30 | Where: chair | Action: sit',
        detailedSteps: [
          {
            stepNumber: 1,
            title: 'Sit upright',
            durationMinutes: 15,
            instructions: 'Sit',
            focusCue: 'breath',
            pitfallToAvoid: 'judging',
            layer: undefined as unknown as 'adherence',
            layerReasoning: '',
          },
        ],
      },
    ]);
    expect(task.detailedSteps[0].layer).toBe('adherence');
    expect(task.detailedSteps[0].layerReasoning).toMatch(/researched sources/);
  });

  it('keeps a later week on the same teachings and drops a new link', async () => {
    mockLlm.mockImplementation(async (prompt: string) => {
      expect(prompt).toMatch(/20 degrees/);
      expect(prompt).toMatch(/Do not switch programs/);
      return { success: true, data: { tasks: dummyPlan('https://invented.example/fake').initialTasks } };
    });

    const tasks = await adaptUpcomingWeekTasksWithAI(
      'Get good at competitive stone skipping',
      2,
      'Spin and angle',
      'Repeat the same throw',
      90,
      '',
      { dailyMinutes: 30, preferredSlot: 'evening', planVariant: 'steady' },
      new Date('2026-10-12'),
      [],
      grounding
    );

    expect(tasks[0].title).toMatch(/stone/i);
    expect(tasks[1].resourceUrl).toBeUndefined();
    expect(tasks[0].resourceUrl).toBe('https://en.wikipedia.org/wiki/Stone_skipping');
  });
});
