import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { pickMethod, type MethodPickResponse } from '../src/lib/method/pickMethod.js';
import { formatBasisBadge, formatMethodologyNotes } from '../src/lib/research/planGrounding.js';
import type { WorkBlock } from '../src/lib/method/blocks.js';

const input = {
  rawGoal: 'Learn touch typing to 40 words per minute',
  clarifiedOutcome: 'Learn touch typing to 40 words per minute',
  answers: { 'Current speed?': 'About 20 WPM, looking at the keys', 'Time?': 'Evenings only' },
  dailyMinutes: 20,
  activeDaysPerWeek: 5,
};

const scores = (safety = 5, fitToUser = 4) => ({ adherence: 4, safety, fitToUser, evidence: 4, measurability: 5 });

const block = (
  name: string,
  stage: WorkBlock['stage'],
  impact: number,
  kind: WorkBlock['kind'] = 'motor_skill',
  realThing = false
): WorkBlock => ({
  name,
  kind,
  action: 'Type the drill text on screen with your hands covered by a towel.',
  output: 'A speed and accuracy score',
  doneWhen: '95% accuracy on every round',
  realThing,
  stage,
  impact,
  cue: 'Eyes on the screen.',
  pitfall: 'Peeking at the keys.',
});

const BLOCKS: WorkBlock[] = [
  block('Home-row letter runs', 'foundation', 4),
  block('Covered-hands word runs', 'foundation', 5),
  block('Weak-key isolation', 'foundation', 3),
  block('Type one real email blind', 'foundation', 4, 'perform', true),
  block('Common-word bursts', 'build', 4),
  block('Sentence accuracy sprints', 'build', 3),
  block('Timed 1-minute test', 'build', 4, 'perform', true),
  block('Paragraph speed pushes', 'peak', 4),
];

function response(overrides: Partial<MethodPickResponse> = {}): MethodPickResponse {
  return {
    candidates: [
      { name: 'Home-row drilling with accuracy first', creator: '', summary: 'Short daily drills', scores: scores() },
      { name: 'Free typing tests only', creator: '', summary: 'Race tests', scores: scores(5, 3) },
    ],
    chosenIndex: 0,
    whyChosen: 'You have 20 minutes in the evening and still look at the keys, so accuracy drills come first.',
    runnerUpIndex: 1,
    whyNotRunnerUp: 'Racing tests before accuracy locks in the habit of looking down.',
    teachings: [
      'Keep fingers on ASDF JKL; and return after every key.',
      'Cover your hands so you cannot look.',
      'Hold 95% accuracy before trying to go faster.',
      'Drill the weakest keys for 5 minutes each session.',
      'Take one 1-minute test at the end to log speed.',
    ],
    workKinds: ['motor_skill', 'perform'],
    blocks: BLOCKS,
    assumptions: 'An adult at about 20 WPM who looks at the keys.',
    hasNumericDimension: true,
    week1Targets: [{ metric: 'typing speed', value: 20, unit: 'words per minute', direction: 'higher_is_harder' }],
    week12Targets: [{ metric: 'typing speed', value: 40, unit: 'words per minute', direction: 'higher_is_harder' }],
    progressionFormula: 'Add about 2 WPM a week while holding 95% accuracy.',
    ...overrides,
  };
}

describe('pickMethod', () => {
  it('turns a checked pick into grounding with no links and an honest badge', async () => {
    const generate = vi.fn().mockResolvedValue(response());
    const result = await pickMethod(input, generate);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.grounding.methodKind).toBe('model_recommended');
    expect(result.grounding.methodConfidence).toBe('first_principles');
    expect(result.grounding.allowedUrls).toEqual([]);
    expect(result.grounding.runnerUp?.name).toBe('Free typing tests only');
    expect(result.grounding.velocityTable?.week12Targets[0].value).toBe(40);

    const badge = formatBasisBadge(result.grounding);
    expect(badge?.anchored).toBe(false);
    expect(badge?.label).toContain('Recommended method');
    expect(formatMethodologyNotes(result.grounding)).toContain('Runner-up: Free typing tests only');
  });

  it('sends the user answers and time to the model', async () => {
    const generate = vi.fn().mockResolvedValue(response());
    await pickMethod(input, generate);
    const prompt = generate.mock.calls[0][0] as string;
    expect(prompt).toContain('20 minutes a day, 5 days a week');
    expect(prompt).toContain('looking at the keys');
    expect(prompt).toContain('40 words per minute');
  });

  it('retries with the reason when the chosen method is unsafe', async () => {
    const unsafe = response({
      candidates: [
        { name: 'Risky method', creator: '', summary: '', scores: scores(2, 5) },
        { name: 'Safe method', creator: '', summary: '', scores: scores() },
      ],
    });
    const generate = vi.fn().mockResolvedValueOnce(unsafe).mockResolvedValueOnce(response());
    const result = await pickMethod(input, generate);

    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0]).toContain('safety');
  });

  it('keeps the method and sets week 12 from the goal when the numbers stay wrong', async () => {
    const noTarget = response({
      week1Targets: [{ metric: 'practice', value: 10, unit: 'minutes', direction: 'higher_is_harder' }],
      week12Targets: [{ metric: 'practice', value: 20, unit: 'minutes', direction: 'higher_is_harder' }],
    });
    const generate = vi.fn().mockResolvedValue(noTarget);
    const result = await pickMethod(input, generate);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const wpm = result.grounding.velocityTable?.week12Targets.find((row) => /words per minute/.test(row.unit));
    expect(wpm?.value).toBe(40);
  });

  it('fails cleanly when the model never returns a usable method', async () => {
    const generate = vi.fn().mockResolvedValue(response({ teachings: ['Practice.'] }));
    const result = await pickMethod(input, generate);
    expect(result.ok).toBe(false);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it('ranks the work blocks and retries when there is no real thing to do', async () => {
    const onlyPrep = response({ blocks: BLOCKS.map((item) => ({ ...item, realThing: false })) });
    const generate = vi.fn().mockResolvedValueOnce(onlyPrep).mockResolvedValueOnce(response());
    const result = await pickMethod(input, generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][0]).toMatch(/realThing/);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grounding.blocks?.[0].name).toBe('Covered-hands word runs');
    expect(result.grounding.workKinds).toEqual(['motor_skill', 'perform']);
  });

  it('allows goals with nothing to count', async () => {
    const generate = vi.fn().mockResolvedValue(
      response({ hasNumericDimension: false, week1Targets: [], week12Targets: [], progressionFormula: '' })
    );
    const result = await pickMethod({ ...input, rawGoal: 'Become more patient', clarifiedOutcome: 'Become more patient' }, generate);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.grounding.velocityTable).toBeNull();
  });
});
