import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/api';
import { describeOnboardingError } from './requestErrors';

describe('describeOnboardingError', () => {
  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'network error'])(
    'treats %j as not reaching Achivii, without showing the browser message',
    (message) => {
      const clarify = describeOnboardingError(new TypeError(message), 'clarify');
      expect(clarify).toMatchObject({ kind: 'offline', title: "We can't reach Achivii right now" });
      expect(clarify.message).not.toContain(message);
      expect(describeOnboardingError(new TypeError(message), 'create')).toMatchObject({ kind: 'offline', title: 'We lost the connection' });
    },
  );

  it('shows Achivii’s own message, which is written for users', () => {
    const refusal = 'This goal is outside what Achivii can plan safely.';
    expect(describeOnboardingError(new Error(refusal), 'create')).toEqual({
      kind: 'server',
      title: "We couldn't build your plan",
      message: refusal,
    });
    expect(describeOnboardingError(new Error('Unable to analyze your goal right now.'), 'clarify')).toMatchObject({
      title: "We couldn't prepare your questions",
      message: 'Unable to analyze your goal right now.',
    });
  });

  it('hides parsing and programming errors behind plain copy', () => {
    for (const error of [new SyntaxError('Unexpected token < in JSON'), new TypeError('x is undefined'), 'boom', null]) {
      const described = describeOnboardingError(error, 'clarify');
      expect(described.kind).toBe('server');
      expect(described.message).toBe('Something went wrong on our side. Please try again in a moment.');
    }
  });

  it('says plainly that a custom goal needs Pro when create is refused with 403 CUSTOM_GOAL_REQUIRES_PRO', () => {
    const refusal = new ApiError('Custom Goals require Achivii Pro.', 403, 'CUSTOM_GOAL_REQUIRES_PRO');
    expect(describeOnboardingError(refusal, 'create')).toEqual({
      kind: 'pro',
      title: 'Custom Goals require Achivii Pro',
      message: 'Certified pathways stay free. Pro unlocks creating your own custom 90-day journeys.',
    });
  });

  it('treats any other 403 as an ordinary server failure', () => {
    expect(describeOnboardingError(new ApiError('Forbidden', 403), 'create')).toMatchObject({ kind: 'server', message: 'Forbidden' });
    expect(
      describeOnboardingError(new ApiError('Custom Goals require Achivii Pro.', 403, 'CUSTOM_GOAL_REQUIRES_PRO'), 'clarify'),
    ).toMatchObject({ kind: 'server' });
  });
});
