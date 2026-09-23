import { describe, expect, it } from 'vitest';
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
});
