import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Goal, GoalClarification } from '../../types';
import { clarifyGoal, createGoalPlan, fetchActiveGoal } from '../../lib/api';
import presetFixture from '../../../e2e/fixtures/onboarding/clarify-run10k.json';
import customFixture from '../../../e2e/fixtures/onboarding/clarify-custom-sourdough.json';
import { DRAFT_GOAL_KEY } from './payload';
import { PLAN_PREVIEW_KEY } from '../../lib/planPreview';
import { ONBOARDING_SNAPSHOT_KEY } from './snapshot';
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

/** The first option of every question. */
const answerAll = (result: Hook, clarification: GoalClarification) =>
  act(() => clarification.followUpQuestions.forEach((q) => result.current.chooseAnswer(q, q.options[0])));

const chooseSchedule = (result: Hook) =>
  act(() => result.current.setRoutine((prev) => ({ ...prev, dailyMinutes: 45, planVariant: 'steady' })));

/** A launched pathway with its questions back, all skipped, and a schedule: ready to build. */
async function readyPathway(options: Partial<OnboardingStateOptions> = {}) {
  localStorage.setItem(DRAFT_GOAL_KEY, PRESET);
  clarify.mockResolvedValue(PRESET_CLARIFY);
  const hook = setup({ ...options });
  await flush();
  answerAll(hook.result, PRESET_CLARIFY);
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
  it('counts the schedule as chosen only once picked training days match the days a week (B-108)', () => {
    const { result } = setup();
    chooseSchedule(result);
    expect(result.current.scheduleChosen).toBe(true);
    act(() => result.current.setRoutine((prev) => ({ ...prev, restWeekdays: [0] })));
    expect(result.current.scheduleChosen).toBe(false);
    act(() => result.current.setRoutine((prev) => ({ ...prev, restWeekdays: [0, 6] })));
    expect(result.current.scheduleChosen).toBe(true);
  });

  it('starts with the daily time and days a week picked in the landing page’s plan preview, for that goal only', () => {
    localStorage.setItem(PLAN_PREVIEW_KEY, JSON.stringify({ pathwayId: 'run10k', dailyMinutes: 60, planVariant: 'minimal' }));
    clarify.mockReturnValue(new Promise(() => {}));
    const previewed = setup({ initialGoal: PRESET}).result.current;
    expect(previewed.routine).toMatchObject({ dailyMinutes: 60, planVariant: 'minimal' });
    expect(previewed.scheduleChosen).toBe(true);
    expect(setup({ initialGoal: CUSTOM }).result.current.routine.dailyMinutes).toBe(0);
  });

  it('fills in a fixed date that is still ahead, and drops one that has passed (B-106)', () => {
    expect(setup({ initialFixedDate: '2099-05-10' }).result.current.fixedDate).toBe('2099-05-10');
    expect(setup({ initialFixedDate: '2020-05-10' }).result.current.fixedDate).toBe('');
    expect(setup().result.current.fixedDate).toBe('');
  });

  it('a launched pathway sends clarify once on mount and is loading from the first render', () => {
    clarify.mockReturnValue(new Promise(() => {}));
    const { result } = setup({ initialGoal: PRESET});
    expect(result.current.page).toBe('days');
    expect(result.current.isClarifying).toBe(true);
    expect(clarify).toHaveBeenCalledTimes(1);
    expect(clarify).toHaveBeenCalledWith(PRESET);
  });

  it('ignores an answer for a goal the user has since changed', async () => {
    const first = deferred<GoalClarification>();
    const second = deferred<GoalClarification>();
    clarify.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = setup();
    act(() => result.current.submitGoal('Learn to juggle'));
    act(() => result.current.goToPage('goal'));
    act(() => result.current.submitGoal(CUSTOM));

    await act(async () => second.resolve(CUSTOM_CLARIFY));
    await act(async () => first.resolve({ ...CUSTOM_CLARIFY, clarifiedOutcome: 'Juggle three balls' }));
    expect(result.current.clarification).toBe(CUSTOM_CLARIFY);
    expect(result.current.editedOutcome).toBe(CUSTOM_CLARIFY.clarifiedOutcome);
  });

  it('drops the previous goal’s questions and answers as soon as a new goal starts', async () => {
    clarify.mockResolvedValueOnce(CUSTOM_CLARIFY).mockReturnValueOnce(new Promise(() => {}));
    const { result } = setup();
    act(() => result.current.submitGoal(CUSTOM));
    await flush();
    act(() => result.current.chooseAnswer(CUSTOM_CLARIFY.followUpQuestions[0], CUSTOM_CLARIFY.followUpQuestions[0].options[0]));

    act(() => result.current.goToPage('goal'));
    act(() => result.current.submitGoal('Learn to juggle'));
    expect(result.current.clarification).toBeNull();
    expect(result.current.answers).toEqual({});
  });

  it('does not send the same goal twice while it is still being prepared', () => {
    clarify.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    act(() => result.current.submitGoal(CUSTOM));
    act(() => result.current.goToPage('goal'));
    act(() => result.current.submitGoal(CUSTOM));
    expect(clarify).toHaveBeenCalledTimes(1);
  });
});

describe('outcome', () => {
  it('an outcome cleared while editing falls back to clarify’s when the page is left', async () => {
    clarify.mockResolvedValue(PRESET_CLARIFY);
    const { result } = setup({ initialGoal: PRESET});
    await flush();
    act(() => result.current.goToPage('summary'));
    act(() => result.current.setEditedOutcome('   '));
    act(() => result.current.goToPage('date'));
    expect(result.current.editedOutcome).toBe(PRESET_CLARIFY.clarifiedOutcome);
  });

  it('keeps an edited outcome across steps', async () => {
    clarify.mockResolvedValue(PRESET_CLARIFY);
    const { result } = setup({ initialGoal: PRESET});
    await flush();
    act(() => result.current.goToPage('summary'));
    act(() => result.current.setEditedOutcome('Run 10 km in 48 minutes'));
    act(() => result.current.goToPage('date'));
    act(() => result.current.goToPage('summary'));
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

  it('a custom goal refused without Pro is described as Pro, not as a fault, and nothing is created', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    create.mockRejectedValueOnce(
      Object.assign(new Error('Custom Goals require Achivii Pro.'), { status: 403, code: 'CUSTOM_GOAL_REQUIRES_PRO' }),
    );
    clarify.mockResolvedValue(CUSTOM_CLARIFY);
    const { result, onGoalCreated } = setup({ currentGoalId: undefined });
    act(() => result.current.submitGoal(CUSTOM));
    await flush();
    answerAll(result, CUSTOM_CLARIFY);
    await chooseSchedule(result);

    await act(() => result.current.handleGeneratePlan());
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.current.screen).toBe('generation');
    expect(result.current.generationError).toMatchObject({ kind: 'pro', title: 'Custom Goals require Achivii Pro' });
    expect(result.current.connection).toBe('online');
    expect(onGoalCreated).not.toHaveBeenCalled();
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
    expect(first.result.current.screen).toBe('generation');
    expect(create).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DRAFT_GOAL_KEY)).toBe(PRESET);
    first.unmount();
    resetPlanCreateGuardForTests({ keepPrior: true });

    activeGoal.mockReset();
    activeGoal.mockResolvedValueOnce(goal('saved'));
    const second = await readyPathway({ currentGoalId: 'saved' });
    expect(second.result.current.screen).not.toBe('generation');
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
    expect(second.result.current.screen).not.toBe('generation');
  });

  it('browser Back during generation stays on generation', async () => {
    create.mockReturnValue(new Promise(() => {}));
    activeGoal.mockResolvedValue(null);
    const { result } = await readyPathway({ currentGoalId: undefined });
    await act(async () => {
      void result.current.handleGeneratePlan();
    });
    expect(result.current.screen).toBe('generation');
    act(() => result.current.goToPage('summary'));
    expect(result.current.screen).toBe('generation');
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

describe('a next plan (NP-3)', () => {
  it('drops the level question, fills in the earlier answers and sends nextPlan with the body', async () => {
    localStorage.setItem(DRAFT_GOAL_KEY, CUSTOM);
    clarify.mockResolvedValue(CUSTOM_CLARIFY);
    create.mockResolvedValueOnce({ goal: goal('new', CUSTOM), roadmapWeeks: [], dailyTasks: [] });
    activeGoal.mockResolvedValue(null);
    const equipment = CUSTOM_CLARIFY.followUpQuestions.find((q) => q.id === 'equipment')!.options[1];
    const { result } = setup({
      initialGoal: CUSTOM,
      currentGoalId: 'old',
      nextPlan: {
        request: { fromGoalId: 'old', mode: 'keep_going' },
        goalText: CUSTOM,
        isPreset: false,
        startsFrom: null,
        answers: [
          { id: 'current_level', question: '', answer: 'Never tried sourdough' },
          { id: 'success', question: '', answer: 'A loaf with an open crumb' },
          { id: 'equipment', question: '', answer: equipment },
          { id: 'obstacle', question: '', answer: 'Skipped' },
        ],
      },
    });
    await flush();
    expect(result.current.questionList?.map((q) => q.id)).toEqual(['success', 'equipment', 'obstacle']);
    expect(result.current.answers).toEqual({ equipment });
    expect(result.current.customAnswers).toEqual({ success: 'A loaf with an open crumb' });

    const obstacle = result.current.questionList!.find((q) => q.id === 'obstacle')!;
    act(() => result.current.skipQuestion(obstacle));
    act(() => result.current.skipQuestion(obstacle));
    await chooseSchedule(result);
    await act(() => result.current.handleGeneratePlan());
    const body = create.mock.calls[0][0];
    expect(body.nextPlan).toEqual({ fromGoalId: 'old', mode: 'keep_going' });
    expect(body.answerList?.map((item) => item.id)).toEqual(['success', 'equipment', 'obstacle']);
  });
});

const VAGUE = 'Get fit';
const VAGUE_CLARIFY: GoalClarification = {
  ...CUSTOM_CLARIFY,
  clarifiedOutcome: 'Get fit',
  focusOptions: ['Run 5K without stopping', 'Do 20 push-ups in a row', 'Walk 10,000 steps a day'],
};

describe('one page at a time (ND-28)', () => {
  it('starts a typed goal on its first essential, with clarify already under way', () => {
    clarify.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    expect(result.current.page).toBe('goal');
    act(() => result.current.submitGoal(CUSTOM));
    expect(result.current.page).toBe('days');
    expect(clarify).toHaveBeenCalledWith(CUSTOM);
    expect(window.history.state.wizardStep).toBe('days');
  });

  it('moves through the essentials, then waits on the questions page and replaces it with the first question', async () => {
    const pending = deferred<GoalClarification>();
    clarify.mockReturnValue(pending.promise);
    const { result } = setup({ initialGoal: CUSTOM });
    await chooseSchedule(result);
    for (const page of ['days', 'weekdays', 'minutes', 'slot', 'day', 'commitments', 'date'] as const) {
      expect(result.current.page).toBe(page);
      act(() => result.current.continueFrom(page));
    }
    expect(result.current.page).toBe('questions');

    await act(async () => pending.resolve(CUSTOM_CLARIFY));
    expect(result.current.page).toBe('q:current_level');
    expect(window.history.state.wizardStep).toBe('q:current_level');
    expect(result.current.pages).not.toContain('questions');
  });

  it('a question skipped once is asked again reworded; skipped twice, it moves on', async () => {
    clarify.mockResolvedValue(CUSTOM_CLARIFY);
    const { result } = setup({ initialGoal: CUSTOM });
    await flush();
    const first = CUSTOM_CLARIFY.followUpQuestions[0];
    act(() => result.current.goToPage('q:current_level'));
    act(() => result.current.skipQuestion(first));
    expect(result.current.page).toBe('q:current_level');
    expect(result.current.isPageComplete('q:current_level')).toBe(false);
    act(() => result.current.skipQuestion(first));
    expect(result.current.page).toBe(`q:${CUSTOM_CLARIFY.followUpQuestions[1].id}`);
    expect(result.current.isSkipped(first)).toBe(true);
  });

  it('a failed clarify shows on the questions page, and arriving there sends it again', async () => {
    clarify.mockRejectedValueOnce(OFFLINE()).mockResolvedValueOnce(CUSTOM_CLARIFY);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = setup({ initialGoal: CUSTOM });
    await flush();
    expect(result.current.clarificationError).toMatchObject({ kind: 'offline' });
    await chooseSchedule(result);
    act(() => result.current.goToPage('date'));
    act(() => result.current.continueFrom('date'));
    await flush();
    expect(clarify).toHaveBeenCalledTimes(2);
    expect(result.current.page).toBe('q:current_level');
    expect(result.current.routine).toMatchObject({ dailyMinutes: 45, planVariant: 'steady' });
  });
});

describe('a vague goal (ND-28)', () => {
  it('brings in the focus page after the daily time, then clarifies the goal chosen there', async () => {
    const chosen = deferred<GoalClarification>();
    clarify.mockResolvedValueOnce(VAGUE_CLARIFY).mockReturnValueOnce(chosen.promise);
    const { result } = setup({ initialGoal: VAGUE });
    await flush();
    expect(result.current.needsFocus).toBe(true);
    await chooseSchedule(result);
    act(() => result.current.continueFrom('days'));
    act(() => result.current.continueFrom('weekdays'));
    expect(result.current.page).toBe('minutes');
    act(() => result.current.continueFrom('minutes'));
    expect(result.current.page).toBe('focus');

    act(() => result.current.chooseFocus('Run 5K without stopping'));
    act(() => result.current.continueFrom('focus'));
    expect(result.current.page).toBe('slot');
    expect(result.current.rawGoal).toBe('Run 5K without stopping');
    expect(clarify).toHaveBeenLastCalledWith('Run 5K without stopping');
    expect(result.current.typedGoal).toBe(VAGUE);

    // Found vague as well, the chosen goal is never sent back to the focus page.
    await act(async () => chosen.resolve({ ...CUSTOM_CLARIFY, focusOptions: ['A', 'B', 'C'] }));
    expect(result.current.needsFocus).toBe(false);
    expect(result.current.focusOptions).toEqual(VAGUE_CLARIFY.focusOptions);
    expect(result.current.questionList).toHaveLength(4);
  });

  it('found vague only once the essentials are done, the questions page hands over to the focus page', async () => {
    const pending = deferred<GoalClarification>();
    clarify.mockReturnValue(pending.promise);
    const { result } = setup({ initialGoal: VAGUE });
    await chooseSchedule(result);
    act(() => result.current.goToPage('date'));
    act(() => result.current.continueFrom('date'));
    expect(result.current.page).toBe('questions');
    await act(async () => pending.resolve(VAGUE_CLARIFY));
    expect(result.current.page).toBe('focus');
    expect(result.current.pages.indexOf('focus')).toBe(result.current.pages.indexOf('date') + 1);
  });
});

describe('a visitor (ND-28)', () => {
  async function readyVisitor() {
    clarify.mockResolvedValue(CUSTOM_CLARIFY);
    const onSignUp = vi.fn();
    const hook = setup({ token: null, initialGoal: CUSTOM, onSignUp });
    await flush();
    answerAll(hook.result, CUSTOM_CLARIFY);
    await chooseSchedule(hook.result);
    act(() => hook.result.current.goToPage('summary'));
    return { ...hook, onSignUp };
  }

  it('Start keeps the answers and goes to sign-up; nothing is created', async () => {
    const { result, onSignUp } = await readyVisitor();
    await act(() => result.current.handleGeneratePlan());
    expect(onSignUp).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(ONBOARDING_SNAPSHOT_KEY)!)).toMatchObject({
      typedGoal: CUSTOM,
      page: 'summary',
      buildAfterSignUp: true,
      routine: { dailyMinutes: 45, planVariant: 'steady' },
    });
  });

  it('signed in afterwards, the same answers are back and the plan is built at once', async () => {
    const visitor = await readyVisitor();
    await act(() => visitor.result.current.handleGeneratePlan());
    visitor.unmount();

    clarify.mockReset();
    activeGoal.mockResolvedValue(null);
    create.mockResolvedValueOnce({ goal: goal('new', CUSTOM), roadmapWeeks: [], dailyTasks: [] });
    const { onGoalCreated } = setup({ currentGoalId: undefined });
    await flush();
    expect(clarify).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ rawGoal: CUSTOM, routine: { dailyMinutes: 45, planVariant: 'steady' } });
    expect(onGoalCreated).toHaveBeenCalledWith(goal('new', CUSTOM));
    expect(localStorage.getItem(ONBOARDING_SNAPSHOT_KEY)).toBeNull();
  });

  it('a reload returns to the same page, but a different goal starts afresh', async () => {
    const visitor = await readyVisitor();
    act(() => visitor.result.current.goToPage('slot'));
    visitor.unmount();
    expect(setup({ token: null }).result.current.page).toBe('slot');
    clarify.mockReturnValue(new Promise(() => {}));
    expect(setup({ token: null, initialGoal: 'Learn to juggle' }).result.current.page).toBe('days');
  });
});
