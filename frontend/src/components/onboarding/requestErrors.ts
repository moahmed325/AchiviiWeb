export type OnboardingRequest = 'clarify' | 'create';

export interface OnboardingError {
  /** `offline`: the request never reached Achivii or the connection dropped. `server`: Achivii answered with a failure. */
  kind: 'offline' | 'server';
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
  const fromServer =
    error instanceof Error && !(error instanceof TypeError) && !(error instanceof SyntaxError) ? error.message.trim() : '';
  return { kind: 'server', title: copy.serverTitle, message: fromServer || copy.serverFallback };
}
