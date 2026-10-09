import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import {
  buildProfilePrompt,
  customProfilesEnabled,
  generateRecoveryProfile,
  type ProfileCallInput,
  type RawProfileAnswer,
} from '../src/lib/recovery/profileCall.js';
import { profileFailures, templateProfile, TEMPLATE_IDS, RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Method-aware recovery M1.3b: the profile call (RULE-3, RULE-4, MR-4, MR-14, MR-22) and its switch (O1).

const number: WeekTarget = { kind: 'number', metric: 'Portraits', value: 1, unit: 'portraits', direction: 'higher_is_better' };
const deliverable: WeekTarget = { kind: 'deliverable', description: 'A finished portrait' };

const input = (week12: WeekTarget = number, goalText = 'Draw a realistic portrait'): ProfileCallInput => ({
  goalText,
  domain: 'Drawing',
  answers: [{ id: 'current_level', question: 'Level?', answer: 'Beginner' }],
  method: { name: 'Drawing on the Right Side of the Brain', summary: 'Seeing exercises.', rules: ['Draw what you see'] },
  phases: [{ name: 'Seeing', purpose: 'Learn to see.', startWeek: 1, endWeek: 12 }],
  weeklyTargets: Array.from({ length: 12 }, (_, index) => (index === 11 ? week12 : number)),
});

/** A good answer adapted from the creative template. */
const good = (overrides: Partial<RawProfileAnswer> = {}): RawProfileAnswer => ({
  template: 'creative',
  kinds: [
    { id: 'seeing_drill', name: 'Seeing drill', description: 'A short exercise in seeing edges and shapes.', action: 'let_go', hard: false, inOrder: false, highLoad: false },
    { id: 'master_copy', name: 'Master copy', description: 'Copying a master drawing.', action: 'move', hard: false, inOrder: false, highLoad: false },
    { id: 'portrait', name: 'Portrait', description: 'Working on your own portrait.', action: 'continue', hard: false, inOrder: false, highLoad: false },
    { id: 'catch_all', name: 'Catch-all', description: 'Anything else.', action: 'continue', hard: false, inOrder: false, highLoad: false },
  ],
  catchAll: 'catch_all',
  restGapDays: 0,
  returnRule: { breaks: [{ length: 'any', restart: 'last level' }], firstWeekBack: 'Starts with a seeing drill.' },
  ...overrides,
});

const hardContinue = (): RawProfileAnswer => {
  const answer = good();
  (answer.kinds as Array<Record<string, unknown>>)[2].hard = true;
  return answer;
};

const answers = (...values: Array<RawProfileAnswer | null>) => {
  for (const value of values) {
    vi.mocked(generateStructuredContent).mockResolvedValueOnce(
      value ? ({ success: true, data: value } as never) : ({ success: false, data: null, error: 'quota' } as never)
    );
  }
};

const prompts = () => vi.mocked(generateStructuredContent).mock.calls.map((call) => call[0] as string);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('generateRecoveryProfile', () => {
  it('a good answer is returned checked, with Weekly test and Fixed-time session added by code', async () => {
    answers(good());
    const result = await generateRecoveryProfile(input());
    expect(result.source).toBe('model');
    expect(result.pickedTemplate).toBe('creative');
    expect(profileFailures(result.profile)).toEqual([]);
    expect(result.profile.kinds.map((kind) => kind.id)).toEqual(['seeing_drill', 'master_copy', 'portrait', 'catch_all', 'weekly_test', 'fixed_time_session']);
    expect(result.profile.kinds.slice(-2).every((kind) => kind.action === 'fixed')).toBe(true);
    expect(generateStructuredContent).toHaveBeenCalledTimes(1);
  });

  it('a bad first answer is retried with the reasons', async () => {
    answers(hardContinue(), good());
    const result = await generateRecoveryProfile(input());
    expect(result.source).toBe('model');
    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    expect(prompts()[1]).toMatch(/YOUR PREVIOUS ANSWER WAS REJECTED: .*"portrait" is hard, so it cannot continue/);
  });

  it('two bad answers give the template the model picked, unchanged', async () => {
    answers(hardContinue(), hardContinue());
    const result = await generateRecoveryProfile(input());
    expect(result).toEqual({ profile: templateProfile('creative'), source: 'picked_template', pickedTemplate: 'creative' });
  });

  it('two bad answers with no valid template give the keyword template', async () => {
    answers(good({ template: 'cooking' }), null);
    const result = await generateRecoveryProfile(input());
    expect(result).toEqual({ profile: templateProfile('creative'), source: 'keyword_template', pickedTemplate: null });

    answers(null, null);
    const sourdough = await generateRecoveryProfile({
      ...input(number, 'Bake sourdough bread at home'),
      domain: 'Bread baking',
      method: { name: 'Tartine method', summary: 'Long fermentation.', rules: ['Feed the starter daily'] },
    });
    expect(sourdough).toEqual({ profile: templateProfile('general'), source: 'keyword_template', pickedTemplate: null });
  });

  it('a deliverable goal whose answer has a non-continue catch-all is rejected', async () => {
    const moveCatchAll = () => {
      const answer = good();
      (answer.kinds as Array<Record<string, unknown>>)[3].action = 'move';
      return answer;
    };
    answers(moveCatchAll(), moveCatchAll());
    const result = await generateRecoveryProfile(input(deliverable));
    expect(result.source).toBe('picked_template');
    expect(prompts()[0]).toMatch(/week-12 target is a deliverable, so the catch-all's action must be continue/);
    expect(prompts()[1]).toMatch(/catch-all must continue/);

    // The same answer passes when week 12 is a number.
    answers(moveCatchAll());
    expect((await generateRecoveryProfile(input(number))).source).toBe('model');
  });

  it('a Weekly test or Fixed-time session kind the model writes itself is dropped and added back by code, fixed', async () => {
    const answer = good();
    (answer.kinds as Array<Record<string, unknown>>).push(
      { id: 'weekly_test', name: 'Weekly test', description: 'The test.', action: 'move', hard: false, inOrder: false, highLoad: false },
      { id: 'class', name: 'Fixed-time session', description: 'A class.', action: 'let_go', hard: false, inOrder: false, highLoad: false }
    );
    answers(answer);
    const result = await generateRecoveryProfile(input());
    expect(result.source).toBe('model');
    expect(result.profile.kinds.filter((kind) => kind.id === 'weekly_test')).toEqual([expect.objectContaining({ action: 'fixed' })]);
    expect(result.profile.kinds.some((kind) => kind.id === 'class')).toBe(false);
    expect(result.profile.kinds.filter((kind) => kind.name === 'Fixed-time session')).toHaveLength(1);
  });

  it('an error from the model call falls back without throwing', async () => {
    vi.mocked(generateStructuredContent).mockRejectedValueOnce(new Error('network'));
    const result = await generateRecoveryProfile(input());
    expect(result.source).toBe('keyword_template');
    expect(console.warn).toHaveBeenCalledWith('[Recovery] Profile call failed:', expect.any(Error));
  });
});

describe('the profile prompt', () => {
  it('shows all 13 templates with their kinds, actions, flags, rest gap and return rule, and the goal', () => {
    const prompt = buildProfilePrompt(input());
    for (const id of TEMPLATE_IDS) expect(prompt).toContain(`\n${id}\n`);
    expect(prompt).toContain('quality_session "Quality session": move (hard)');
    expect(prompt).toContain('strength_workout "Strength workout": move (hard, in order)');
    expect(prompt).toContain(`Rest gap: 1 day(s). Return: 1-2 weeks: back 1 week; 3+ weeks: back 2 weeks. First week back: ${RECOVERY_TEMPLATES.endurance.returnRule.firstWeekBack}`);
    expect(prompt).toContain('Draw a realistic portrait');
    expect(prompt).toContain('Domain: Drawing');
    expect(prompt).toMatch(/- Week 12: .*1 portraits/);
    expect(prompt).not.toMatch(/weekly_test|fixed_time_session/);
    // Size reported in the M1.3b report: well inside both providers' limits.
    expect(prompt.length).toBeLessThan(16000);
  });
});

describe('the switch (O1)', () => {
  it('is on only when CUSTOM_RECOVERY_PROFILES_ENABLED is exactly "true"', () => {
    const saved = process.env.CUSTOM_RECOVERY_PROFILES_ENABLED;
    try {
      for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) {
        if (value === undefined) delete process.env.CUSTOM_RECOVERY_PROFILES_ENABLED;
        else process.env.CUSTOM_RECOVERY_PROFILES_ENABLED = value;
        expect(customProfilesEnabled()).toBe(false);
      }
      process.env.CUSTOM_RECOVERY_PROFILES_ENABLED = 'true';
      expect(customProfilesEnabled()).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.CUSTOM_RECOVERY_PROFILES_ENABLED;
      else process.env.CUSTOM_RECOVERY_PROFILES_ENABLED = saved;
    }
  });

  it('is declared in render.yaml with sync: false and no value', () => {
    const yaml = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
    expect(yaml).toMatch(/- key: CUSTOM_RECOVERY_PROFILES_ENABLED\r?\n\s+sync: false/);
    expect(yaml).not.toMatch(/CUSTOM_RECOVERY_PROFILES_ENABLED\r?\n\s+value:/);
  });
});
