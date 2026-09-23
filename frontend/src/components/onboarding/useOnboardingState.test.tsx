import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Goal, GoalClarification } from '../../types';
import { clarifyGoal, createGoalPlan, fetchActiveGoal } from '../../lib/api';
import presetFixture from '../../../e2e/fixtures/onboarding/clarify-run10k.json';
import customFixture from '../../../e2e/fixtures/onboarding/clarify-custom-sourdough.json';
import { DRAFT_GOAL_KEY } from './payload';
import { resetPlanCreateGuardForTests, useOnboardingState, type OnboardingStateOptions } from './useOnboardingState';

vi.mock('../../lib/api', () => ({ clarifyGoal: vi.fn(), createGoalPlan: vi.fn(), fetchActiveGoal: vi.fn() }));

const clarify = vi.mocked(clarifyGoal);
const create = vi.mocked(createGoalPlan);
const activeGoal = vi.mocked(fetchActiveGoal);

const PRESET = 'Run a 10K Under 50 Minutes';
const CUSTOM = 'Bake sourdough bread at home';
const PRESET_CLARIFY = presetFixture as unknown as GoalClarification;
const CUSTOM_CLARIFY = customFixture as unknown as GoalClarification;
const OFFLINE = () => new TypeError('Failed to fetch');
const goal = (id: string, rawGoal = PRESET) => ({ id, rawGoal, roadmapWeeks: [], dailyTasks: [] }) as unknown as Goal;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => act(async () => {});

const setup = (options: Partial<OnboardingStateOptions> = {}) => {
  const onGoalCreated = vi.fn();
  const hook = renderHook(() => useOnboardingState({ token: 't', onGoalCreated, ...options }), { wrapper: StrictMode });
  return { ...hook, onGoalCreated };
};

type Hook = ReturnType<typeof setup>['result'];

const chooseSchedule = (result: Hook) =>
  act(() => result.current.setRoutine((prev) => ({ ...prev, dailyMinutes: 45, planVariant: 'steady' })));

/** A launched pathway with its questions back, all skipped, and a schedule: ready to build. */
async function readyPathway(options: Partial<OnboardingStateOptions> = {}) {
  localStorage.setItem(DRAFT_GOAL_KEY, PRESET);
  clarify.mockResolvedValue(PRESET_CLARIFY);
  const hook = setup({ isPreset: true, ...options });
  await flush();
  act(() =>
    hook.result.current.setSkipCounts(Object.fromEntries(PRESET_CLARIFY.followUpQuestions.map((q) => [q.id, 2]))),
  );
  await chooseSchedule(hook.result);
  expect(hook.result.current.allQuestionsResolved).toBe(true);
  return hook;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  resetPlanCreateGuardForTests();
  window.history.replaceState(null, '', '/onboarding');
});

afterEach(() => vi.restoreAllMocks());

describe('clarify', () => {
  it('a launched pathway sends clarify once on mount and is loading from the first render', () => {
    clarify.mockReturnValue(new Promise(() => {}));
    const { result } = setup({ initialGoal: PRESET, isPreset: true });
    expect(result.current.step).toBe('starting');
    expect(result.current.isClarifying).toBe(true);
    expect(clarify).toHaveBeenCalledTimes(1);
    expect(clarify).toHaveBeenCalledWith(PRESET);
  });

  it('ignores an answer for a goal the user has since changed', async () => {
    const first = deferred<GoalClarification>();
    const second = deferred<GoalClarification>();
    clarify.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = setup();
    act(() => result.current.handleStartGoal('Learn to juggle', 'custom'));
    act(() => result.current.goToStep('goal'));
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));

    await act(async () => second.resolve(CUSTOM_CLARIFY));
    await act(async () => first.resolve({ ...CUSTOM_CLARIFY, clarifiedOutcome: 'Juggle three balls' }));
    expect(result.current.clarification).toBe(CUSTOM_CLARIFY);
    expect(result.current.editedOutcome).toBe(CUSTOM_CLARIFY.clarifiedOutcome);
  });

  it('drops the previous goal’s questions and answers as soon as a new goal starts', async () => {
    clarify.mockResolvedValueOnce(CUSTOM_CLARIFY).mockReturnValueOnce(new Promise(() => {}));
    const { result } = setup();
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));
    await flush();
    act(() => result.current.setAnswers({ current_level: CUSTOM_CLARIFY.followUpQuestions[0].options[0] }));

    act(() => result.current.goToStep('goal'));
    act(() => result.current.handleStartGoal('Learn to juggle', 'custom'));
    expect(result.current.clarification).toBeNull();
    expect(result.current.answers).toEqual({});
  });

  it('does not send the same goal twice while it is still being prepared', () => {
    clarify.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));
    act(() => result.current.goToStep('goal'));
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));
    expect(clarify).toHaveBeenCalledTimes(1);
  });
});

describe('waiting on the schedule', () => {
  it('continuing before the questions are back waits, then moves on to them', async () => {
    const pending = deferred<GoalClarification>();
    clarify.mockReturnValue(pending.promise);
    const { result } = setup();
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));
    await chooseSchedule(result);
    act(() => result.current.handleProceedFromSchedule());
    act(() => result.current.handleProceedFromSchedule());
    expect(result.current.isWaitingForClarification).toBe(true);
    expect(clarify).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve(CUSTOM_CLARIFY));
    expect(result.current.step).toBe('starting');
    expect(result.current.isWaitingForClarification).toBe(false);
    expect(window.history.state.wizardStep).toBe('starting');
  });

  it('leaving the schedule cancels the wait, so the questions arriving can’t pull the user forward', async () => {
    const pending = deferred<GoalClarification>();
    clarify.mockReturnValue(pending.promise);
    const { result } = setup();
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));
    await chooseSchedule(result);
    act(() => result.current.handleProceedFromSchedule());
    act(() => result.current.goToStep('goal'));

    await act(async () => pending.resolve(CUSTOM_CLARIFY));
    expect(result.current.step).toBe('goal');
    expect(result.current.isWaitingForClarification).toBe(false);
    expect(result.current.clarification).toBe(CUSTOM_CLARIFY);
  });

  it('a failed clarify is described, keeps the schedule, and continuing retries the same goal once', async () => {
    const retry = deferred<GoalClarification>();
    clarify.mockRejectedValueOnce(OFFLINE()).mockReturnValueOnce(retry.promise);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup();
    act(() => result.current.handleStartGoal(CUSTOM, 'custom'));
    await flush();
    expect(result.current.clarificationError).toMatchObject({ kind: 'offline', title: "We can't reach Achivii right now" });
    expect(result.current.connection).toBe('offline');

    await chooseSchedule(result);
    act(() => result.current.handleProceedFromSchedule());
    act(() => result.current.handleProceedFromSchedule());
    expect(clarify).toHaveBeenCalledTimes(2);
    expect(clarify).toHaveBeenLastCalledWith(CUSTOM);
    expect(result.current.clarificationError).toBeNull();

    await act(async () => retry.resolve(CUSTOM_CLARIFY));
    expect(result.current.step).toBe('starting');
    expect(result.current.connection).toBe('online');
    expect(result.current.routine).toMatchObject({ dailyMinutes: 45, planVariant: 'steady' });
  });
});

describe('outcome', () => {
  it('an outcome cleared while editing falls back to clarify’s when the step is left', async () => {
    clarify.mockResolvedValue(PRESET_CLARIFY);
    const { result } = setup({ initialGoal: PRESET, isPreset: true });
    await flush();
    act(() => result.current.goToStep('success'));
    act(() => result.current.setEditedOutcome('   '));
    act(() => result.current.goToStep('schedule'));
    expect(result.current.editedOutcome).toBe(PRESET_CLARIFY.clarifiedOutcome);
  });

  it('keeps an edited outcome across steps', async () => {
    clarify.mockResolvedValue(PRESET_CLARIFY);
    const { result } = setup({ initialGoal: PRESET, isPreset: true });
    await flush();
    act(() => result.current.goToStep('success'));
    act(() => result.current.setEditedOutcome('Run 10 km in 48 minutes'));
    act(() => result.current.goToStep('schedule'));
    act(() => result.current.goToStep('success'));
    expect(result.current.editedOutcome).toBe('Run 10 km in 48 minutes');
  });
});

describe('creating the plan', () => {
  it('a server failure keeps the draft; trying again sends once more and then clears it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create
      .mockRejectedValueOnce(new Error("Couldn't design your roadmap right now. Please try again."))
      .mockResolvedValueOnce({ goal: goal('new'), roadmapWeeks: [], dailyTasks: [] });
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: undefined });

    await act(() => result.current.handleGeneratePlan());
    expect(result.current.generationError).toEqual({
      kind: 'server',
      title: "We couldn't build your plan",
      message: "Couldn't design your roadmap right now. Please try again.",
    });
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);
    expect(activeGoal).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);

    await act(() => result.current.handleGeneratePlan());
    expect(create).toHaveBeenCalledTimes(2);
    expect(onGoalCreated).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBeNull();
  });

  it('a retry clears the stages from the failed attempt before sending again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockImplementationOnce(async (_payload, _token, onStep) => {
      onStep?.({
        type: 'step',
        id: 'search',
        label: 'Comparing methods for your answers',
        elapsedMs: 0,
        slow: false,
      });
      throw new Error("Couldn't design your roadmap right now. Please try again.");
    });
    create.mockReturnValueOnce(new Promise(() => {}));
    const { result } = await readyPathway();

    await act(() => result.current.handleGeneratePlan());
    expect(result.current.planSteps.map((step) => step.id)).toEqual(['search']);
    expect(result.current.generationError?.kind).toBe('server');
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);
    expect(result.current.routine.planVariant).toBe('steady');

    await act(async () => {
      void result.current.handleGeneratePlan();
    });
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.current.planSteps).toEqual([]);
    expect(result.current.generationError).toBeNull();
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);
    expect(result.current.routine.planVariant).toBe('steady');
    expect(activeGoal).toHaveBeenCalled();
  });

  it('sends one create for a double click', async () => {
    create.mockReturnValue(new Promise(() => {}));
    const { result } = await readyPathway();
    await act(async () => {
      void result.current.handleGeneratePlan();
      void result.current.handleGeneratePlan();
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('after a lost connection, finds the plan the server finished instead of creating it twice', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(OFFLINE());
    activeGoal.mockResolvedValueOnce(goal('old')).mockResolvedValueOnce(goal('new'));
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: 'old' });

    await act(() => result.current.handleGeneratePlan());
    expect(onGoalCreated).toHaveBeenCalledWith(goal('new'));
    expect(create).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBeNull();
  });

  it('after a lost connection with nothing finished, asks to try again, and the retry checks first', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(OFFLINE());
    activeGoal.mockResolvedValueOnce(goal('old')).mockResolvedValueOnce(goal('old')).mockResolvedValueOnce(goal('new'));
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: 'old' });

    await act(() => result.current.handleGeneratePlan());
    expect(result.current.generationError?.kind).toBe('offline');
    expect(result.current.connection).toBe('offline');
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);
    expect(onGoalCreated).not.toHaveBeenCalled();

    await act(() => result.current.handleGeneratePlan());
    expect(onGoalCreated).toHaveBeenCalledWith(goal('new'));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('checks for a finished plan before the first Build, and uses it instead of creating', async () => {
    activeGoal.mockResolvedValueOnce(goal('new', PRESET));
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: undefined });

    await act(() => result.current.handleGeneratePlan());
    expect(create).not.toHaveBeenCalled();
    expect(onGoalCreated).toHaveBeenCalledWith(goal('new', PRESET));
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBeNull();
  });

  it('still creates when nothing matching has been saved', async () => {
    activeGoal.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({
      goal: goal('new'),
      roadmapWeeks: [{ weekNumber: 1 }],
      dailyTasks: [{ id: 'task-1' }],
    } as never);
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: undefined });

    await act(() => result.current.handleGeneratePlan());
    expect(activeGoal).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(onGoalCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new', roadmapWeeks: [{ weekNumber: 1 }], dailyTasks: [{ id: 'task-1' }] }),
    );
  });

  it('does not treat the goal that was already active as the new plan', async () => {
    activeGoal.mockResolvedValue(goal('old'));
    create.mockResolvedValueOnce({ goal: goal('new'), roadmapWeeks: [], dailyTasks: [] });
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: 'old' });

    await act(() => result.current.handleGeneratePlan());
    expect(create).toHaveBeenCalledTimes(1);
    expect(onGoalCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' }));
  });

  it('a server retry uses a plan saved without a done event and does not post again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(new Error("Couldn't design your roadmap right now. Please try again."));
    activeGoal.mockResolvedValueOnce(null).mockResolvedValueOnce(goal('new'));
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: undefined });

    await act(() => result.current.handleGeneratePlan());
    expect(onGoalCreated).toHaveBeenCalledWith(goal('new'));
    expect(create).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBeNull();
  });

  it('a reload keeps the draft and the next Build checks before creating', async () => {
    create.mockReturnValueOnce(new Promise(() => {}));
    activeGoal.mockResolvedValue(null);
    const first = await readyPathway({ currentGoalId: undefined });
    await act(async () => {
      void first.result.current.handleGeneratePlan();
    });
    expect(first.result.current.step).toBe('generation');
    expect(create).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);
    first.unmount();
    resetPlanCreateGuardForTests({ keepPrior: true });

    activeGoal.mockReset();
    activeGoal.mockResolvedValueOnce(goal('saved'));
    const second = await readyPathway({ currentGoalId: 'saved' });
    expect(second.result.current.step).not.toBe('generation');
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);

    await act(() => second.result.current.handleGeneratePlan());
    expect(create).toHaveBeenCalledTimes(1);
    expect(second.onGoalCreated).toHaveBeenCalledWith(goal('saved'));
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBeNull();
  });

  it('a second mount does not send while the first create is still running', async () => {
    create.mockReturnValue(new Promise(() => {}));
    activeGoal.mockResolvedValue(null);
    const first = await readyPathway({ currentGoalId: undefined });
    await act(async () => {
      void first.result.current.handleGeneratePlan();
    });
    expect(create).toHaveBeenCalledTimes(1);

    const second = await readyPathway({ currentGoalId: undefined });
    await act(async () => {
      void second.result.current.handleGeneratePlan();
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(second.result.current.step).not.toBe('generation');
  });

  it('browser Back during generation stays on generation', async () => {
    create.mockReturnValue(new Promise(() => {}));
    activeGoal.mockResolvedValue(null);
    const { result } = await readyPathway({ currentGoalId: undefined });
    await act(async () => {
      void result.current.handleGeneratePlan();
    });
    expect(result.current.step).toBe('generation');
    act(() => result.current.goToStep('review'));
    expect(result.current.step).toBe('generation');
  });

  it('never guesses when the current goal is unknown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(OFFLINE());
    const { result, onGoalCreated } = await readyPathway({ currentGoalId: null });

    await act(() => result.current.handleGeneratePlan());
    expect(activeGoal).not.toHaveBeenCalled();
    expect(onGoalCreated).not.toHaveBeenCalled();
    expect(result.current.generationError?.kind).toBe('offline');
  });
});
