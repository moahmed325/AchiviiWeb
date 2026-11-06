import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Sparkles } from 'lucide-react';
import { useAuthToken, useFirstName } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { ApiError, fetchCoach, sendCoachMessage, type CoachMessage, type CoachState } from '../lib/api';
import { planWeeks } from '../lib/planLength';
import { Button, Dialog, DialogContent, ErrorState, IconButton, LoadingState, Skeleton, Textarea, VisuallyHidden, cx } from '../components/ui';
import { ProCheckout } from '../components/billing';

/** The longest message the coach takes (the server checks it too). */
const MESSAGE_MAX = 1000;

/** Ways to start, written as the person would say them. */
const SUGGESTIONS = [
  'What should I focus on today?',
  'I missed a few days. How do I get back on track?',
  'How am I doing so far?',
  "I only have 15 minutes today. What's the best use?",
];

/**
 * ND-41: Achivii Coach. A conversation with a coach that knows the person's plan (the server gives it the goal, the
 * method, this week and how it went). It talks; it never changes the plan. The trial or Pro is needed to send; a trial
 * that ended keeps the conversation readable. Off until `COACH_ENABLED`: then an honest "coming soon".
 */
export const CoachPage: React.FC = () => {
  const token = useAuthToken();
  const { firstName } = useFirstName();
  const { activeGoal } = useGoal();
  const [state, setState] = React.useState<CoachState | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [loads, setLoads] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState<string | null>(null);
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!token) return;
    let live = true;
    setLoadFailed(false);
    fetchCoach(token)
      .then((next) => live && setState(next))
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [token, loads]);

  const messageCount = state?.messages.length ?? 0;
  React.useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messageCount, pending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!token || !message || pending) return;
    setPending(message);
    setSendError(null);
    setDraft('');
    try {
      const result = await sendCoachMessage(token, message, firstName);
      setState((current) => (current ? { ...current, messages: [...current.messages, ...result.messages], remainingToday: result.remainingToday } : current));
    } catch (error) {
      setDraft(message);
      if (error instanceof ApiError && error.code === 'TRIAL_ENDED') {
        setState((current) => (current ? { ...current, access: 'locked' } : current));
      } else if (error instanceof ApiError && error.code === 'coach_daily_limit') {
        setState((current) => (current ? { ...current, remainingToday: 0 } : current));
      } else {
        setSendError(error instanceof ApiError && error.status < 500 && error.status !== 409 ? error.message : "Coach couldn't answer just now. Please try again.");
      }
    } finally {
      setPending(null);
      inputRef.current?.focus();
    }
  };

  const header = (
    <header className="animate-rise-in flex items-center gap-4">
      <span className="coach-mark coach-mark--lg" aria-hidden="true">
        <Sparkles strokeWidth={1.5} className="size-6" />
      </span>
      <div className="min-w-0">
        <h1 className="text-h2 text-text">
          Coach <span aria-hidden="true" className="text-achievement">✦</span>
        </h1>
        <p className="mt-0.5 truncate text-small text-text-secondary">
          {activeGoal ? `Knows your plan: ${activeGoal.rawGoal} · Week ${activeGoal.currentWeek || 1} of ${planWeeks(activeGoal)}` : 'Your practice coach'}
        </p>
      </div>
    </header>
  );

  if (!state) {
    return (
      <main id="main" className="ui-root mx-auto flex w-full max-w-3xl flex-1 flex-col px-gutter py-10 sm:py-14">
        {header}
        {loadFailed ? (
          <ErrorState className="mt-10" title="We couldn't load Coach" description="Check your connection and try again." onRetry={() => setLoads((n) => n + 1)} />
        ) : (
          <LoadingState label="Loading Coach" className="mt-10">
            <Skeleton className="h-24" />
            <Skeleton className="mt-4 h-16 w-2/3" />
          </LoadingState>
        )}
      </main>
    );
  }

  if (!state.enabled) {
    return (
      <main id="main" className="ui-root mx-auto flex w-full max-w-3xl flex-1 flex-col px-gutter py-10 sm:py-14">
        {header}
        <section aria-labelledby="soon-heading" className="dash-card animate-rise-in mt-10 p-7 sm:p-9">
          <p className="font-ui-mono text-micro uppercase text-achievement">Coming soon</p>
          <h2 id="soon-heading" className="mt-3 text-h3 text-text">A coach that knows your plan</h2>
          <p className="mt-3 max-w-xl text-body text-text-secondary">
            Ask what to focus on today, how to get back after missed days, or how you&apos;re doing, and get answers built on
            your goal, your method and this week. Coach is almost ready; it will appear here.
          </p>
        </section>
      </main>
    );
  }

  if (!state.hasGoal) {
    return (
      <main id="main" className="ui-root mx-auto flex w-full max-w-3xl flex-1 flex-col px-gutter py-10 sm:py-14">
        {header}
        <section aria-labelledby="no-plan-heading" className="dash-panel animate-rise-in mt-10 p-7 sm:p-9">
          <h2 id="no-plan-heading" className="text-h3 text-text">Coach needs a plan to talk about</h2>
          <p className="mt-2 max-w-xl text-body text-text-secondary">Start a goal and Coach will know your plan, your week and how it&apos;s going.</p>
          <Button asChild variant="gold" className="mt-6">
            <Link to="/onboarding">Start a goal</Link>
          </Button>
        </section>
      </main>
    );
  }

  const locked = state.access === 'locked';
  const outOfMessages = !locked && state.remainingToday <= 0;
  const canSend = !locked && !outOfMessages;
  const empty = state.messages.length === 0 && !pending;

  return (
    <main id="main" className="ui-root mx-auto flex w-full max-w-3xl flex-1 flex-col px-gutter pb-4 pt-10 sm:pt-14">
      {header}

      <section aria-label="Conversation" className="mt-8 flex flex-1 flex-col">
        {empty ? (
          <div className="dash-card animate-rise-in p-6 sm:p-8">
            <p className="text-body-lg text-text">
              {firstName ? `Hi ${firstName}.` : 'Hi.'} I know your plan, this week and how it&apos;s going. Ask me anything about your
              practice.
            </p>
            {canSend && (
              <ul className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap" aria-label="Ways to start">
                {SUGGESTIONS.map((suggestion) => (
                  <li key={suggestion}>
                    <button type="button" onClick={() => void send(suggestion)} className="coach-suggestion focus-ring">
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ol className="flex flex-col gap-5" aria-live="polite" aria-relevant="additions">
            {state.messages.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {pending && (
              <>
                <Message message={{ id: 'pending', role: 'user', content: pending, createdAt: '' }} />
                <li className="flex items-start gap-3">
                  <span className="coach-mark" aria-hidden="true"><Sparkles strokeWidth={1.5} className="size-4" /></span>
                  <span className="coach-typing" role="status">
                    <VisuallyHidden>Coach is writing</VisuallyHidden>
                    <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
                  </span>
                </li>
              </>
            )}
          </ol>
        )}
        <div ref={endRef} />
      </section>

      <div className="coach-composer sticky bottom-0 mt-6 pb-2 pt-3">
        {locked ? (
          <div className="dash-panel flex flex-wrap items-center justify-between gap-4 p-5">
            <p className="text-small text-text-secondary">Your free trial has ended. Go Pro to keep talking with Coach; your conversation is kept.</p>
            <Button variant="gold" size="sm" onClick={() => setUpgradeOpen(true)}>Go Pro</Button>
          </div>
        ) : outOfMessages ? (
          <p role="status" className="dash-panel p-5 text-small text-text-secondary">
            That&apos;s {state.dailyLimit} messages today. Coach is back tomorrow.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="coach-message" className="sr-only">Message Coach</label>
            <Textarea
              id="coach-message"
              ref={inputRef}
              size="compact"
              rows={1}
              maxLength={MESSAGE_MAX}
              value={draft}
              placeholder="Ask your coach anything…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
              className="flex-1"
            />
            <IconButton
              type="submit"
              label="Send"
              disabled={!draft.trim() || Boolean(pending)}
              variant="gold"
              icon={<ArrowUp aria-hidden="true" strokeWidth={2} className="size-5" />}
              className="mb-0.5"
            />
          </form>
        )}
        <p role="alert" className={cx('mt-2 text-small text-danger', !sendError && 'sr-only')}>{sendError ?? ''}</p>
        <p className="mt-2 text-small text-text-secondary">
          Coach can get things wrong and can&apos;t change your plan. For pain, injury or health worries, see a professional.
          {canSend && state.remainingToday <= 5 ? ` ${state.remainingToday} ${state.remainingToday === 1 ? 'message' : 'messages'} left today.` : ''}
        </p>
      </div>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent title="Achivii Pro" size="lg">
          <ProCheckout />
        </DialogContent>
      </Dialog>
    </main>
  );
};

/** One message: the person's on the right, the coach's on the left with its mark. Line breaks are kept. */
const Message: React.FC<{ message: CoachMessage }> = ({ message }) =>
  message.role === 'user' ? (
    <li className="flex justify-end">
      <VisuallyHidden>You said:</VisuallyHidden>
      <p className="coach-bubble coach-bubble--you">{message.content}</p>
    </li>
  ) : (
    <li className="flex items-start gap-3">
      <span className="coach-mark" aria-hidden="true"><Sparkles strokeWidth={1.5} className="size-4" /></span>
      <VisuallyHidden>Coach said:</VisuallyHidden>
      <p className="coach-bubble">{message.content}</p>
    </li>
  );

export default CoachPage;
