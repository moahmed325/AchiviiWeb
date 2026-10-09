import { describe, it, expect } from 'vitest';
import {
  actionOf,
  FIXED_TIME_KIND,
  PATHWAY_PROFILES,
  PATHWAY_TEMPLATES,
  profileFailures,
  profileForPathway,
  readRecoveryProfile,
  RECOVERY_TEMPLATES,
  templateProfile,
  TEMPLATE_IDS,
  WEEKLY_TEST_KIND,
  withFixedKinds,
  type RecoveryKind,
  type RecoveryProfile,
} from '../src/lib/recovery/index.js';
import { CERTIFIED_PRESETS } from '../src/lib/ai/presets/index.js';

// Method-aware recovery M1.2: the profile, its checks (RULE-4, RULE-5), the templates (MR-13, MR-20), the pathway
// profiles (RULE-2), the checked reader (MR-9) and actionOf (RULE-7, RULE-18, MR-11).

const kind = (id: string, overrides: Partial<RecoveryKind> = {}): RecoveryKind => ({
  id,
  name: id.replace(/_/g, ' '),
  description: `A ${id} step.`,
  action: 'move',
  hard: false,
  inOrder: false,
  ...overrides,
});

/** A small valid profile: two kinds, the catch-all and the two added kinds. */
const valid = (): RecoveryProfile =>
  withFixedKinds({
    version: 1,
    template: 'general',
    kinds: [kind('practice'), kind('drill', { action: 'let_go' }), kind('catch_all')],
    catchAll: 'catch_all',
    restGapDays: 1,
    returnRule: { breaks: [{ length: 'any', restart: 'last level' }], firstWeekBack: 'Start easy.' },
  });

const edit = (change: (profile: RecoveryProfile) => void): RecoveryProfile => {
  const profile = valid();
  change(profile);
  return profile;
};

const failsWith = (profile: RecoveryProfile, pattern: RegExp, facts = {}) =>
  expect(profileFailures(profile, facts).join(' ')).toMatch(pattern);

describe('profileFailures (RULE-4)', () => {
  it('passes a valid profile', () => {
    expect(profileFailures(valid())).toEqual([]);
  });

  it('needs exactly one known action per kind', () => {
    failsWith(edit((p) => (p.kinds[0].action = 'skip' as never)), /practice" needs one action/);
    failsWith(edit((p) => delete (p.kinds[0] as Partial<RecoveryKind>).action), /practice" needs one action/);
  });

  it('needs 2 to 8 kinds plus the catch-all, not counting the two added kinds', () => {
    failsWith(edit((p) => p.kinds.splice(1, 1)), /2 to 8 kinds plus the catch-all; got 1/);
    const eight = edit((p) => p.kinds.splice(0, 2, ...Array.from({ length: 8 }, (_, i) => kind(`k${i}`))));
    expect(profileFailures(eight)).toEqual([]);
    failsWith(edit((p) => p.kinds.splice(0, 2, ...Array.from({ length: 9 }, (_, i) => kind(`k${i}`)))), /got 9/);
  });

  it('needs the catch-all to exist and not be an added kind', () => {
    failsWith(edit((p) => (p.catchAll = 'nothing')), /catch-all kind is missing/);
    failsWith(edit((p) => (p.catchAll = 'weekly_test')), /catch-all cannot be one of the kinds code adds/);
  });

  it('never lets a hard kind continue; hard move, let go and fixed pass', () => {
    failsWith(edit((p) => Object.assign(p.kinds[0], { hard: true, action: 'continue' })), /practice" is hard, so it cannot continue/);
    for (const action of ['move', 'let_go', 'fixed'] as const) {
      expect(profileFailures(edit((p) => Object.assign(p.kinds[0], { hard: true, action })))).toEqual([]);
    }
  });

  it('keeps the rest gap at 0, 1 or 2 whole days', () => {
    for (const gap of [0, 1, 2]) expect(profileFailures(edit((p) => (p.restGapDays = gap)))).toEqual([]);
    for (const gap of [-1, 3, 1.5, NaN]) failsWith(edit((p) => (p.restGapDays = gap)), /rest gap must be 0, 1 or 2/);
  });

  it('makes a high-load kind hard', () => {
    failsWith(edit((p) => (p.kinds[0].highLoad = true)), /practice" is high-load, so it must be hard/);
    expect(profileFailures(edit((p) => Object.assign(p.kinds[0], { highLoad: true, hard: true })))).toEqual([]);
  });

  it('for a deliverable week-12 target, needs a continue catch-all (MR-21)', () => {
    failsWith(valid(), /deliverable, so the catch-all must continue/, { deliverableGoal: true });
    const continuing = edit((p) => (p.kinds.find((k) => k.id === 'catch_all')!.action = 'continue'));
    expect(profileFailures(continuing, { deliverableGoal: true })).toEqual([]);
    expect(profileFailures(valid(), { deliverableGoal: false })).toEqual([]);
  });

  it('checks the return rule format', () => {
    const two = edit((p) => (p.returnRule.breaks = [{ length: '1-2 weeks', restart: 'back 1 week' }, { length: '3+ weeks', restart: 'back 2 weeks' }]));
    expect(profileFailures(two)).toEqual([]);
    failsWith(edit((p) => (p.returnRule.breaks = [])), /one rule for "any" break/);
    failsWith(edit((p) => (p.returnRule.breaks = [{ length: '3+ weeks', restart: 'last level' }, { length: '1-2 weeks', restart: 'last level' }])), /one rule for "any" break/);
    failsWith(edit((p) => (p.returnRule.breaks = [{ length: 'any', restart: 'loads 10% lighter' as never }])), /restart must be one of/);
    failsWith(edit((p) => (p.returnRule.firstWeekBack = '  ')), /first week back" note/);
    failsWith(edit((p) => (p.returnRule.firstWeekBack = 'x'.repeat(241))), /240 characters or fewer/);
    failsWith(edit((p) => delete (p as Partial<RecoveryProfile>).returnRule), /return rule is missing/);
  });

  it('needs unique snake_case kind ids, a name and a description', () => {
    failsWith(edit((p) => (p.kinds[1].id = 'practice')), /"practice" is used twice/);
    failsWith(edit((p) => (p.kinds[0].id = 'Practice Session')), /must be snake_case/);
    failsWith(edit((p) => (p.kinds[0].name = '')), /has no name/);
    failsWith(edit((p) => (p.kinds[0].description = ' ')), /has no description/);
  });

  it('expects the two added kinds, both fixed (RULE-5)', () => {
    failsWith(edit((p) => (p.kinds = p.kinds.filter((k) => k.id !== 'weekly_test'))), /"Weekly test" kind is missing/);
    failsWith(edit((p) => (p.kinds = p.kinds.filter((k) => k.id !== 'fixed_time_session'))), /"Fixed-time session" kind is missing/);
    failsWith(edit((p) => (p.kinds.find((k) => k.id === 'weekly_test')!.action = 'move')), /"Weekly test" kind must be fixed/);
  });
});

describe('withFixedKinds (RULE-5)', () => {
  it('adds Weekly test and Fixed-time session, both fixed, once', () => {
    const once = valid();
    const twice = withFixedKinds(once);
    expect(twice.kinds.filter((k) => k.id === WEEKLY_TEST_KIND.id)).toHaveLength(1);
    expect(twice.kinds.filter((k) => k.id === FIXED_TIME_KIND.id)).toHaveLength(1);
    expect(twice.kinds.slice(-2).map((k) => [k.name, k.action])).toEqual([
      ['Weekly test', 'fixed'],
      ['Fixed-time session', 'fixed'],
    ]);
  });
});

describe('the 13 templates (MR-13, MR-20)', () => {
  const table = (id: (typeof TEMPLATE_IDS)[number]) =>
    RECOVERY_TEMPLATES[id].kinds
      .filter((k) => k.id !== 'weekly_test' && k.id !== 'fixed_time_session')
      .map((k) => `${k.name}: ${k.action}${k.hard ? ', hard' : ''}${k.inOrder ? ', in order' : ''}`);

  it('has all 13 and each passes the checks', () => {
    expect(Object.keys(RECOVERY_TEMPLATES).sort()).toEqual([...TEMPLATE_IDS].sort());
    expect(TEMPLATE_IDS).toHaveLength(13);
    for (const id of TEMPLATE_IDS) {
      expect(profileFailures(RECOVERY_TEMPLATES[id]), id).toEqual([]);
      expect(RECOVERY_TEMPLATES[id].template).toBe(id);
    }
  });

  it('matches the templates file', () => {
    expect(table('endurance')).toEqual([
      'Easy session: let_go',
      'Quality session: move, hard',
      'Long session: move, hard',
      'Strength and mobility: move',
      'Catch-all: let_go',
    ]);
    expect(table('strength')).toEqual([
      'Strength workout: move, hard, in order',
      'Conditioning: let_go',
      'Nutrition and tracking: let_go',
      'Mobility: move',
      'Catch-all: move',
    ]);
    expect(table('language')).toEqual([
      'New material: move, in order',
      'Daily speaking: let_go',
      'Review: let_go',
      'Conversation or listening practice: move',
      'Catch-all: move',
    ]);
    expect(table('instrument')).toEqual([
      'Technique drills: let_go',
      'New piece or section: move, in order',
      'Play-through or recording: move',
      'Catch-all: move',
    ]);
    expect(table('writing')).toEqual([
      'Drafting: continue',
      'Outlining and planning: move, in order',
      'Revising: continue',
      'Reading and research: let_go',
      'Catch-all: continue',
    ]);
    expect(table('product')).toEqual([
      'Build work: continue',
      'Customer conversations and outreach: move',
      'Daily distribution sprint: let_go',
      'Launch or shipping step: move, in order',
      'Learning: let_go',
      'Catch-all: continue',
    ]);
    expect(table('exam')).toEqual([
      'New topic: move, in order',
      'Practice questions: move',
      'Review: let_go',
      'Mock exam: move',
      'Catch-all: move',
    ]);
    expect(table('speaking')).toEqual([
      'Script and structure: move, in order',
      'Rehearsal: move',
      'Recorded run-through: move',
      'Voice and delivery drills: let_go',
      'Catch-all: move',
    ]);
    expect(table('creative')).toEqual([
      'Fundamentals drill: let_go',
      'Study or copy work: move',
      'Project piece: continue',
      'Catch-all: continue',
    ]);
    expect(table('habit')).toEqual(['Daily focus block: let_go', 'Weekly planning or review: move', 'Catch-all: let_go']);
    expect(table('content')).toEqual([
      'Titles and thumbnails: move, in order',
      'Research and scripting: continue, in order',
      'Filming: move, in order',
      'Editing: continue, in order',
      'Publishing: move, in order',
      'Learning and analytics: let_go',
      'Catch-all: continue',
    ]);
    expect(table('strategy_games')).toEqual([
      'Tactics puzzles: let_go',
      'Opening or theory study: move, in order',
      'Played game with its review: move',
      'Catch-all: move',
    ]);
    expect(table('general')).toEqual(['Practice session: move', 'Review or reflection: let_go', 'Project work: continue', 'Catch-all: move']);
  });

  it('has the rest gaps and return rules of the templates file', () => {
    const rules = Object.fromEntries(
      TEMPLATE_IDS.map((id) => [id, [RECOVERY_TEMPLATES[id].restGapDays, ...RECOVERY_TEMPLATES[id].returnRule.breaks.map((b) => `${b.length}: ${b.restart}`)]])
    );
    expect(rules).toEqual({
      endurance: [1, '1-2 weeks: back 1 week', '3+ weeks: back 2 weeks'],
      strength: [1, '1-2 weeks: back 1 week', '3+ weeks: back 2 weeks'],
      language: [0, 'any: last level'],
      instrument: [0, '1-2 weeks: last level', '3+ weeks: back 1 week'],
      writing: [0, 'any: last level'],
      product: [0, 'any: last level'],
      exam: [0, 'any: last level'],
      speaking: [0, 'any: last level'],
      creative: [0, 'any: last level'],
      habit: [0, 'any: last level'],
      content: [0, 'any: last level'],
      strategy_games: [0, '1-2 weeks: last level', '3+ weeks: back 1 week'],
      general: [0, '1-2 weeks: last level', '3+ weeks: back 1 week'],
    });
    expect(RECOVERY_TEMPLATES.writing.returnRule.firstWeekBack).toMatch(/never reread/);
    expect(RECOVERY_TEMPLATES.strength.returnRule.firstWeekBack).toMatch(/10% lighter/);
  });

  it('templateProfile returns a copy', () => {
    const copy = templateProfile('general');
    copy.kinds[0].action = 'fixed';
    expect(RECOVERY_TEMPLATES.general.kinds[0].action).toBe('move');
  });
});

describe('the 10 pathway profiles (RULE-2)', () => {
  it('has one profile per certified preset, each passing the checks', () => {
    expect(Object.keys(PATHWAY_PROFILES).sort()).toEqual(CERTIFIED_PRESETS.map((p) => p.id).sort());
    for (const [id, profile] of Object.entries(PATHWAY_PROFILES)) {
      expect(profileFailures(profile), id).toEqual([]);
      expect(profile.pathway).toBe(id);
      expect(profile.template).toBe(PATHWAY_TEMPLATES[id]);
    }
  });

  it('uses the templates the docs name', () => {
    expect(PATHWAY_TEMPLATES).toEqual({
      run10k: 'endurance',
      body_recomposition_90day: 'strength',
      spanish_conversation: 'language',
      guitar5songs: 'instrument',
      book_30k_words: 'writing',
      saas_first_customer: 'product',
      ted_speech_15min: 'speaking',
      deep_work_focus: 'habit',
      youtube_12_videos: 'content',
      chess_1200_rating: 'strategy_games',
    });
  });

  it('profileForPathway returns a copy, or null for an unknown id', () => {
    const copy = profileForPathway('run10k')!;
    copy.restGapDays = 2;
    expect(PATHWAY_PROFILES.run10k.restGapDays).toBe(1);
    expect(profileForPathway('recomp')).toBeNull();
  });
});

describe('readRecoveryProfile (MR-9)', () => {
  it('returns the stored profile when it passes', () => {
    const roadmap = { method: { name: 'X' }, recovery: PATHWAY_PROFILES.run10k };
    expect(readRecoveryProfile(roadmap)).toEqual(PATHWAY_PROFILES.run10k);
  });

  it('returns null for a missing value', () => {
    for (const roadmap of [null, undefined, {}, { method: {} }, { recovery: null }]) expect(readRecoveryProfile(roadmap)).toBeNull();
  });

  it('returns null for a malformed value, never throwing', () => {
    const values: unknown[] = [
      'text',
      42,
      { recovery: 'text' },
      { recovery: [] },
      { recovery: { version: 2, template: 'general', kinds: [] } },
      { recovery: { version: 1, template: 'cooking', kinds: [] } },
      { recovery: { ...valid(), kinds: 'none' } },
      { recovery: { ...valid(), kinds: [null] } },
      { recovery: { ...valid(), returnRule: null } },
    ];
    for (const roadmap of values) expect(() => readRecoveryProfile(roadmap)).not.toThrow();
    for (const roadmap of values) expect(readRecoveryProfile(roadmap)).toBeNull();
    const throwing = { get recovery() { throw new Error('boom'); } };
    expect(readRecoveryProfile(throwing)).toBeNull();
  });

  it('returns null for a profile that fails the checks', () => {
    const hardContinue = edit((p) => Object.assign(p.kinds[0], { hard: true, action: 'continue' }));
    expect(readRecoveryProfile({ recovery: hardContinue })).toBeNull();
    expect(readRecoveryProfile({ recovery: valid() }, { deliverableGoal: true })).toBeNull();
    expect(readRecoveryProfile({ recovery: valid() })).not.toBeNull();
  });
});

describe('actionOf (RULE-7, RULE-18, MR-11)', () => {
  const profile = edit((p) => {
    p.kinds.push(kind('heavy', { hard: true }), kind('drafting', { action: 'continue' }), kind('lesson', { inOrder: true }));
  });
  const step = (fields: { title?: string; kind?: string; highLoad?: boolean }) => ({ title: 'A step', ...fields });

  it('is null with no profile, no kind, or a kind not in the profile (RULE-18)', () => {
    expect(actionOf(step({ kind: 'practice' }), null)).toBeNull();
    expect(actionOf(step({ kind: 'practice' }), undefined)).toBeNull();
    expect(actionOf(null, profile)).toBeNull();
    expect(actionOf(step({}), profile)).toBeNull();
    expect(actionOf(step({ kind: '' }), profile)).toBeNull();
    expect(actionOf(step({ kind: 'cardio' }), profile)).toBeNull();
  });

  it("returns the kind's action and hard flag", () => {
    expect(actionOf(step({ kind: 'practice' }), profile)).toEqual({ action: 'move', hard: false });
    expect(actionOf(step({ kind: 'drill' }), profile)).toEqual({ action: 'let_go', hard: false });
    expect(actionOf(step({ kind: 'drafting' }), profile)).toEqual({ action: 'continue', hard: false });
    expect(actionOf(step({ kind: 'heavy' }), profile)).toEqual({ action: 'move', hard: true });
    expect(actionOf(step({ kind: 'fixed_time_session' }), profile)).toEqual({ action: 'fixed', hard: false });
  });

  it('makes the test step fixed, by kind and by title, whatever its kind says', () => {
    expect(actionOf(step({ kind: 'weekly_test' }), profile)).toEqual({ action: 'fixed', hard: false });
    expect(actionOf(step({ title: 'Weekly test: run 5K for time', kind: 'practice' }), profile)).toEqual({ action: 'fixed', hard: false });
    expect(actionOf(step({ title: 'weekly test: 20 push-ups' }), profile)).toEqual({ action: 'fixed', hard: false });
    expect(actionOf(step({ title: 'Weekly test: 5K', highLoad: true }), profile)).toEqual({ action: 'fixed', hard: true });
    // Still RULE-18 without a profile.
    expect(actionOf(step({ title: 'Weekly test: 5K' }), null)).toBeNull();
  });

  it('makes a highLoad step hard, and moves one that would continue', () => {
    expect(actionOf(step({ kind: 'practice', highLoad: true }), profile)).toEqual({ action: 'move', hard: true });
    expect(actionOf(step({ kind: 'drill', highLoad: true }), profile)).toEqual({ action: 'let_go', hard: true });
    expect(actionOf(step({ kind: 'drafting', highLoad: true }), profile)).toEqual({ action: 'move', hard: true });
    expect(actionOf(step({ kind: 'fixed_time_session', highLoad: true }), profile)).toEqual({ action: 'fixed', hard: true });
  });
});
