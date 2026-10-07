import type { ApiError } from '../../lib/api';

export type OnboardingRequest = 'clarify' | 'create';

export interface OnboardingError {
  /**
   * `offline`: the request never reached Achivii or the connection dropped. `server`: Achivii answered with a failure.
   * `pro`: create refused a new custom goal without Achivii Pro (403 `CUSTOM_GOAL_REQUIRES_PRO`, ND-10).
   */
  kind: 'offline' | 'server' | 'pro';
  title: string;
  message: string;
}

const COPY: Record<OnboardingRequest, { offline: Omit<OnboardingError, 'kind'>; serverTitle: string; serverFallback: string }> = {
  clarify: {
    offline: {
      title: "We can't reach Achivii right now",
      message: "Your questions need a connection. Check yours, then try again. Everything you've entered is still here.",
    },
    serverTitle: "We couldn't prepare your questions",
    serverFallback: 'Something went wrong on our side. Please try again in a moment.',
  },
  create: {
    offline: {
      title: 'We lost the connection',
      message:
        "Your plan wasn't confirmed. Check your connection, then try again. We'll check whether it was created before building it again.",
    },
    serverTitle: "We couldn't build your plan",
    serverFallback: 'Something went wrong on our side. Your answers are kept, so you can try again in a moment.',
  },
};

/** The create refusal for a custom goal without Pro (`backend/src/lib/billing/goalAuthorization.ts`). */
export const CUSTOM_GOAL_REQUIRES_PRO = 'CUSTOM_GOAL_REQUIRES_PRO';

const PRO_REQUIRED: Omit<OnboardingError, 'kind'> = {
  title: 'Custom Goals require Achivii Pro',
  message: 'Certified pathways stay free. Pro unlocks creating your own custom 90-day journeys.',
};

/** Read by shape, not `instanceof`, so a test that mocks `lib/api` still gets the same answer. */
const isProRequired = (error: unknown) => {
  const { status, code } = (error ?? {}) as Partial<ApiError>;
  return error instanceof Error && status === 403 && code === CUSTOM_GOAL_REQUIRES_PRO;
};

/** fetch rejects with a TypeError when the request never reaches the server or the connection drops mid-stream. */
const isNetworkFailure = (error: unknown) =>
  error instanceof TypeError && /fetch|network|load failed/i.test(error.message);

/**
 * Plain-language copy for a failed clarify or create request. Achivii's own error messages are written for users
 * (including the safety refusals from create), so they are shown; browser and parsing errors never are.
 */
export function describeOnboardingError(error: unknown, request: OnboardingRequest): OnboardingError {
  const copy = COPY[request];
  if (isNetworkFailure(error)) return { kind: 'offline', ...copy.offline };
  if (request === 'create' && isProRequired(error)) return { kind: 'pro', ...PRO_REQUIRED };
  const fromServer =
    error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError) ? error.message.trim() : '';
  return { kind: 'server', title: copy.serverTitle, message: fromServer || copy.serverFallback };
}
