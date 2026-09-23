import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { PlanProgressEvent } from '../../lib/api';
import type { OnboardingError } from './requestErrors';
import { StepGeneration } from './StepGeneration';
import { SLOW_AFTER_MS, generationAnnouncement, generationStages, slowCopy } from './generationStages';

const step = (id: PlanProgressEvent['id'], extra: Partial<PlanProgressEvent> = {}): PlanProgressEvent => ({
  type: 'step',
  id,
  label:
    id === 'search'
      ? 'Using a proven method for this goal'
      : id === 'method'
        ? 'The TED Masterclass Framework'
        : 'Writing your first week',
  elapsedMs: extra.elapsedMs ?? 0,
  slow: extra.slow ?? false,
  detail: extra.detail,
});

const METHOD = 'The TED Masterclass Framework';
const WHY = 'A single throughline, three acts, and a rehearsed close fit a 15-minute talk.';

describe('generationStages', () => {
  it('starts with understanding already done and no in-flight method stage', () => {
    const stages = generationStages([]);
    expect(stages.map((stage) => [stage.id, stage.state])).toEqual([
      ['understand', 'complete'],
      ['choose', 'upcoming'],
      ['design', 'upcoming'],
    ]);
    expect(stages.some((stage) => stage.methodName)).toBe(false);
  });

  it('makes choosing active on search, and shows the method only after method', () => {
    const searching = generationStages([step('search')]);
    expect(searching.find((stage) => stage.id === 'choose')?.state).toBe('active');
    expect(searching.some((stage) => stage.id === 'build')).toBe(false);

    const built = generationStages([
      step('search'),
      step('method', { detail: WHY, elapsedMs: 19634 }),
      step('plan', { elapsedMs: 19634 }),
    ]);
    const build = built.find((stage) => stage.id === 'build');
    expect(build).toMatchObject({ state: 'complete', methodName: METHOD, whyChosen: WHY });
    expect(built.find((stage) => stage.id === 'choose')?.state).toBe('complete');
    expect(built.find((stage) => stage.id === 'design')?.state).toBe('active');
    expect(generationAnnouncement(built)).toContain(METHOD);
    expect(generationAnnouncement(built)).toContain(WHY);
    expect(generationAnnouncement(searching)).not.toContain(METHOD);
  });

  it('completes choosing on the v1 path and omits the method stage', () => {
    const stages = generationStages([step('search'), step('plan', { elapsedMs: 87702, slow: true })]);
    expect(stages.map((stage) => stage.id)).toEqual(['understand', 'choose', 'design']);
    expect(stages.find((stage) => stage.id === 'choose')?.state).toBe('complete');
    expect(stages.find((stage) => stage.id === 'design')).toMatchObject({ state: 'active', slowSeconds: 88 });
    expect(stages.some((stage) => stage.methodName)).toBe(false);
    expect(generationAnnouncement(stages)).not.toContain('Method chosen');
  });

  it('shows silence on the active stage, and keeps a single line when the event is already slow', () => {
    const waiting = generationStages([step('search')], 22);
    expect(waiting.find((stage) => stage.id === 'choose')).toMatchObject({ state: 'active', slowSeconds: 22 });
    expect(waiting.filter((stage) => stage.slowSeconds !== undefined)).toHaveLength(1);

    const stamped = generationStages([step('search'), step('plan', { elapsedMs: 87702, slow: true })], 90);
    expect(stamped.find((stage) => stage.id === 'design')?.slowSeconds).toBe(88);
    expect(stamped.filter((stage) => stage.slowSeconds !== undefined)).toHaveLength(1);
    expect(generationAnnouncement(stamped, { mentionSlow: true }).match(/Still working/g)).toHaveLength(1);

    const ticking = generationStages([step('search'), step('plan', { elapsedMs: 132_281, slow: true })], 200, 3);
    expect(ticking.find((stage) => stage.id === 'design')?.slowSeconds).toBe(135);
    expect(ticking.filter((stage) => stage.slowSeconds !== undefined)).toHaveLength(1);
  });
});

describe('StepGeneration', () => {
  const noop = () => {};

  it('never shows Search sources, and reveals the method only with the method event', () => {
    const { rerender } = render(<StepGeneration planSteps={[step('search')]} generationError={null} onReviewInputs={noop} onRetry={noop} />);
    expect(screen.getByRole('heading', { name: 'Building your path' })).toBeInTheDocument();
    expect(screen.getByText('Choosing your method')).toBeInTheDocument();
    expect(screen.queryByText('Search sources')).not.toBeInTheDocument();
    expect(screen.queryByText(METHOD)).not.toBeInTheDocument();
    expect(screen.queryByText('Building your 90-day journey')).not.toBeInTheDocument();

    rerender(
      <StepGeneration
        planSteps={[step('search'), step('method', { detail: WHY }), step('plan')]}
        generationError={null}
        onReviewInputs={noop}
        onRetry={noop}
      />,
    );
    expect(screen.getByText(METHOD)).toBeInTheDocument();
    expect(screen.getByText(WHY)).toBeInTheDocument();
    expect(screen.getByText('Building your 90-day journey')).toBeInTheDocument();
    expect(screen.queryByText('Search sources')).not.toBeInTheDocument();
  });

  it('does not invent a method name when plan arrives without method', () => {
    render(
      <StepGeneration
        planSteps={[step('search'), step('plan', { elapsedMs: 87702, slow: true })]}
        generationError={null}
        onReviewInputs={noop}
        onRetry={noop}
      />,
    );
    expect(screen.queryByText('Building your 90-day journey')).not.toBeInTheDocument();
    expect(screen.queryByText(METHOD)).not.toBeInTheDocument();
    expect(screen.getByText('This is taking longer than usual. Still working (88s).')).toBeInTheDocument();
    expect(screen.queryByText('Search sources')).not.toBeInTheDocument();
  });

  it('keeps the existing failure actions', () => {
    render(
      <StepGeneration
        planSteps={[]}
        generationError={{ kind: 'server', title: "We couldn't build your plan", message: 'Try a smaller goal.' }}
        onReviewInputs={noop}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('your current journey, if you have one, is unchanged');
    expect(screen.getByRole('button', { name: 'Review your answers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

const listItem = (title: string) => screen.getAllByRole('listitem').find((item) => item.textContent?.includes(title));

const serverError = (message: string): OnboardingError => ({
  kind: 'server',
  title: "We couldn't build your plan",
  message,
});

describe('slow during silence', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderSearch = () => {
    vi.useFakeTimers();
    return render(<StepGeneration planSteps={[step('search')]} generationError={null} onReviewInputs={() => {}} onRetry={() => {}} />);
  };

  it('shows still-working on Choosing your method after 20 seconds with no new event', async () => {
    renderSearch();
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS - 1));
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(listItem('Choosing your method')).toHaveTextContent(slowCopy(20));
    expect(listItem('Designing your first steps')).not.toHaveTextContent('Still working');
    expect(screen.queryByText('Search sources')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Still working \(\d+s\)/)).toHaveLength(1);
    expect(screen.getByRole('status').textContent?.match(/Still working/g)).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(listItem('Choosing your method')).toHaveTextContent(slowCopy(23));
    expect(screen.getByRole('status').textContent?.match(/Still working/g)).toHaveLength(1);
  });

  it('does not announce still-working twice when the next event is already slow', async () => {
    const view = renderSearch();
    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS));
    expect(screen.getByText(slowCopy(20))).toBeInTheDocument();

    view.rerender(
      <StepGeneration
        planSteps={[step('search'), step('plan', { elapsedMs: 25_000, slow: true })]}
        generationError={null}
        onReviewInputs={() => {}}
        onRetry={() => {}}
      />,
    );

    expect(screen.getAllByText(/Still working \(\d+s\)/)).toHaveLength(1);
    expect(listItem('Designing your first steps')).toHaveTextContent(slowCopy(25));
    expect(listItem('Choosing your method')).not.toHaveTextContent('Still working');
    expect(screen.queryByText('Building your 90-day journey')).not.toBeInTheDocument();
    expect(screen.getByRole('status').textContent ?? '').not.toContain('Still working');
  });

  it('keeps counting from a slow event, still as one line, and says it once', async () => {
    vi.useFakeTimers();
    render(
      <StepGeneration
        planSteps={[step('search'), step('plan', { elapsedMs: 132_000, slow: true })]}
        generationError={null}
        onReviewInputs={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(slowCopy(132))).toBeInTheDocument();
    expect(screen.getAllByText(/Still working \(\d+s\)/)).toHaveLength(1);
    expect(screen.getByRole('status').textContent?.match(/Still working/g)).toHaveLength(1);

    await act(() => vi.advanceTimersByTimeAsync(3_000));
    expect(screen.getByText(slowCopy(135))).toBeInTheDocument();
    expect(screen.getAllByText(/Still working \(\d+s\)/)).toHaveLength(1);
    expect(listItem('Designing your first steps')).toHaveTextContent(slowCopy(135));
    expect(listItem('Choosing your method')).not.toHaveTextContent('Still working');
    expect(screen.getByRole('status').textContent?.match(/Still working/g)).toHaveLength(1);
  });

  it('clears the silence line when the next event is not slow, then waits again', async () => {
    const view = renderSearch();
    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS));

    view.rerender(
      <StepGeneration
        planSteps={[step('search'), step('plan', { elapsedMs: 5_000, slow: false })]}
        generationError={null}
        onReviewInputs={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();
    expect(listItem('Designing your first steps')).toHaveTextContent('Now');

    await act(() => vi.advanceTimersByTimeAsync(SLOW_AFTER_MS));
    expect(listItem('Designing your first steps')).toHaveTextContent(slowCopy(40));
    expect(listItem('Choosing your method')).not.toHaveTextContent('Still working');
    expect(screen.getAllByText(/Still working \(\d+s\)/)).toHaveLength(1);
  });
});

describe('generation failures', () => {
  const searchOnly = [step('search')];

  it('keeps the stages that finished and does not invent a method', () => {
    render(
      <StepGeneration
        planSteps={searchOnly}
        generationError={serverError("Couldn't design your roadmap right now. Please try again.")}
        onReviewInputs={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Building your path' })).toBeInTheDocument();
    expect(listItem('Understanding your goal')).toHaveTextContent('Done');
    expect(listItem('Choosing your method')).toHaveTextContent('Now');
    expect(listItem('Designing your first steps')).toHaveTextContent('Not started');
    expect(listItem('Designing your first steps')).not.toHaveTextContent('Done');
    expect(screen.queryByText('Building your 90-day journey')).not.toBeInTheDocument();
    expect(screen.queryByText(METHOD)).not.toBeInTheDocument();
    expect(screen.queryByText(/Still working/)).not.toBeInTheDocument();
    expect(screen.queryByText('Search sources')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't design your roadmap right now. Please try again.");
  });

  it.each([
    'This goal is outside what Achivii can plan safely.',
    'We could not find a safe way to plan this goal in 12 weeks. Try a smaller goal.',
    'Plan stream ended before a plan was ready.',
  ])('shows the server sentence %j without browser noise', (message) => {
    render(
      <StepGeneration planSteps={[]} generationError={serverError(message)} onReviewInputs={() => {}} onRetry={() => {}} />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("We couldn't build your plan");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveTextContent('your current journey, if you have one, is unchanged');
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
    expect(screen.queryByText(/Both AI providers/)).not.toBeInTheDocument();
  });

  it('tells a lost connection apart from a server failure by the words', () => {
    render(
      <StepGeneration
        planSteps={searchOnly}
        generationError={{
          kind: 'offline',
          title: 'We lost the connection',
          message:
            "Your plan wasn't confirmed. Check your connection, then try again. We'll check whether it was created before building it again.",
        }}
        onReviewInputs={() => {}}
        onRetry={() => {}}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('We lost the connection');
    expect(alert).toHaveTextContent("We'll check whether it was created before building it again.");
    expect(alert).not.toHaveTextContent('unchanged');
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
    expect(listItem('Understanding your goal')).toHaveTextContent('Done');
  });

  it('returns to review and retries without keeping the failed stages on screen', () => {
    const onReview = vi.fn();
    const onRetry = vi.fn();
    const view = render(
      <StepGeneration planSteps={searchOnly} generationError={serverError('Try a smaller goal.')} onReviewInputs={onReview} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Review your answers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onReview).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();

    view.rerender(<StepGeneration planSteps={[]} generationError={null} onReviewInputs={onReview} onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: 'Building your path' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(METHOD)).not.toBeInTheDocument();
    expect(listItem('Choosing your method')).toHaveTextContent('Not started');
  });
});
