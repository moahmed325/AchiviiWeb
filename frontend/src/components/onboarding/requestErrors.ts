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
  message: 'Your first plan is included. After that, Pro builds a plan around any goal of your own, and the guided plans stay free.',
};

/** ND-37: create refuses a new plan once the 30-day trial is over without Pro. */
export const TRIAL_ENDED = 'TRIAL_ENDED';

const TRIAL_OVER: Omit<OnboardingError, 'kind'> = {
  title: 'Your 30 free days are over',
  message: 'Go Pro to build this plan. Everything you’ve done so far is kept.',
};

/** Read by shape, not `instanceof`, so a test that mocks `lib/api` still gets the same answer. */
const proCode = (error: unknown) => {
  const { status, code } = (error ?? {}) as Partial<ApiError>;
  if (!(error instanceof Error) || (status !== 403 && status !== 402)) return null;
  return code === CUSTOM_GOAL_REQUIRES_PRO || code === TRIAL_ENDED ? code : null;
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
  if (request === 'create' && proCode(error)) return { kind: 'pro', ...(proCode(error) === TRIAL_ENDED ? TRIAL_OVER : PRO_REQUIRED) };
  const fromServer =
    error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError) ? error.message.trim() : '';
  return { kind: 'server', title: copy.serverTitle, message: fromServer || copy.serverFallback };
}
