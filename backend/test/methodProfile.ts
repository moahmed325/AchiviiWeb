import { withFixedKinds, type RecoveryKind, type RecoveryProfile } from '../src/lib/recovery/profile.js';

// Method-aware recovery M3.1a: the profile the carry tests use. One kind for each action and each special case.

const kind = (id: string, overrides: Partial<RecoveryKind> = {}): RecoveryKind => ({
  id,
  name: id.replace(/_/g, ' '),
  description: `A ${id} step.`,
  action: 'move',
  hard: false,
  inOrder: false,
  ...overrides,
});

export const PROFILE: RecoveryProfile = withFixedKinds({
  version: 1,
  template: 'general',
  kinds: [
    kind('practice'),
    kind('drafting', { action: 'continue' }),
    kind('review', { action: 'let_go' }),
    kind('lesson', { inOrder: true }),
    kind('heavy', { hard: true }),
    kind('general'),
  ],
  catchAll: 'general',
  restGapDays: 1,
  returnRule: { breaks: [{ length: 'any', restart: 'last level' }], firstWeekBack: 'Ease back in.' },
});
