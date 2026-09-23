import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { CreateGoalResponse, FollowUpQuestion, Goal, GoalClarification, RoutineSettings } from '../../types';
import { clarifyGoal, createGoalPlan, fetchActiveGoal, type PlanProgressEvent } from '../../lib/api';
import { DRAFT_GOAL_KEY, answerFor as answerForState, buildCreatePayload } from './payload';
import { describeOnboardingError, type OnboardingError } from './requestErrors';
import { STEP_ORDER, isFlowStep, nextStep, splitQuestions, type FlowStep, type GoalKind, type WizardStep } from './steps';

export type { FlowStep, GoalKind, WizardStep } from './steps';
export type { OnboardingError } from './requestErrors';

/** What the last onboarding request learned about the connection to Achivii. */
export type Connection = 'unknown' | 'online' | 'offline';

export interface OnboardingStateOptions {
  token: string;
  onGoalCreated: (goal: Goal) => void;
  initialGoal?: string;
  isPreset?: boolean;
  /**
   * The goal active when onboarding opened (undefined: none; null: unknown because it failed to load). Lets a retry
   * after a lost connection recognise a plan the server finished, instead of creating it twice.
   */
  currentGoalId?: string | null;
}

/**
 * Onboarding flow state: steps and browser history, clarify, answers, routine, and plan creation.
 * Presentation-only state (drag, drawers, editors) stays with the step that renders it.
 */
export function useOnboardingState({ token, onGoalCreated, initialGoal, isPreset, currentGoalId }: OnboardingStateOptions) {
  // The draft key stays until a goal is created, so a reload keeps a launched pathway (ND-16).
  const [initialDraft] = useState(() => {
    if (initialGoal && initialGoal.trim()) return initialGoal.trim();
    const saved = localStorage.getItem(DRAFT_GOAL_KEY);
    return saved && saved.trim() ? saved.trim() : '';
  });

  const [goalKind, setGoalKind] = useState<GoalKind>(() => (isPreset || initialDraft ? 'pathway' : 'custom'));
  const isPresetGoal = goalKind === 'pathway';
  const order = STEP_ORDER[goalKind];

  // A launched pathway skips the goal step and starts on its first question step.
  const [step, setStep] = useState<WizardStep>(() => (initialDraft ? STEP_ORDER.pathway[1] : 'goal'));
  const [rawGoal, setRawGoal] = useState(initialDraft);

  // A launched pathway's clarify starts on mount, so it is already in flight on the first render.
  const [isClarifying, setIsClarifying] = useState(Boolean(initialDraft));
  const [clarificationError, setClarificationError] = useState<OnboardingError | null>(null);
  const [isWaitingForClarification, setIsWaitingForClarification] = useState(false);
  const [lastClarifiedGoal, setLastClarifiedGoal] = useState<string | null>(initialDraft || null);
  const [connection, setConnection] = useState<Connection>('unknown');
  /** Only the latest clarify request may change state; an earlier one (for a goal since changed) is ignored. */
  const clarifyRequest = useRef(0);
  const clarifiedOnMount = useRef(false);
  /** Mirrors `isWaitingForClarification` for the clarify callback, which outlives the render that started it. */
  const waitingForClarification = useRef(false);

  const [clarification, setClarification] = useState<GoalClarification | null>(null);
  const [editedOutcome, setEditedOutcome] = useState(initialDraft);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  // 1 = skipped once (the question is shown again, reworded), 2 = skipped for good.
  const [skipCounts, setSkipCounts] = useState<Record<string, number>>({});
  /** Index within the questions of the current question step (ND-14 groups). */
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  const [routine, setRoutine] = useState<RoutineSettings>({
    wakeTime: '07:00',
    sleepTime: '23:00',
    busyHours: '09:00 - 17:00',
    preferredSlot: 'evening',
    dailyMinutes: 0,
    planVariant: undefined,
    commitments: [],
  });
  const scheduleChosen = routine.dailyMinutes > 0 && Boolean(routine.planVariant);

  const [planSteps, setPlanSteps] = useState<PlanProgressEvent[]>([]);
  const [generationError, setGenerationError] = useState<OnboardingError | null>(null);
  const isCreating = useRef(false);

  const questionList = clarification?.followUpQuestions || [];
  const questionGroups = splitQuestions(questionList);
  const questionsFor = (s: WizardStep) => (s === 'success' ? questionGroups.success : questionGroups.starting);

  const answerFor = (q: FollowUpQuestion) => answerForState(q, { answers, customAnswers });
  const isSkipped = (q: FollowUpQuestion) => !answerFor(q) && (skipCounts[q.id] || 0) >= 2;
  const isResolved = (q: FollowUpQuestion) => Boolean(answerFor(q)) || isSkipped(q);
  const allQuestionsResolved = questionList.length > 0 && questionList.every(isResolved);
  const shownQuestion = (q: FollowUpQuestion) =>
    (skipCounts[q.id] || 0) >= 1 && q.retry ? q.retry : { question: q.question, subtitle: q.subtitle };

  /** Whether a step's own input is complete. */
  const isStepComplete = (s: FlowStep): boolean => {
    switch (s) {
      case 'goal':
        return rawGoal.trim().length > 0;
      case 'schedule':
        return scheduleChosen;
      case 'starting':
      case 'success':
        return Boolean(clarification) && questionsFor(s).every(isResolved);
      case 'review':
        return false;
    }
  };

  // History entries keep React Router's own state (`usr`, `key`, `idx`), so the launch state that lets
  // ProtectedRoute admit a switch-goal visit survives a reload (ND-16).
  const writeHistory = (method: 'pushState' | 'replaceState', wizardStep: WizardStep) => {
    window.history[method]({ ...window.history.state, wizardStep }, '', window.location.pathname);
  };

  /** Entering a question step going forward starts at its first question; going back, at its last. */
  const setWaitingForClarification = (waiting: boolean) => {
    waitingForClarification.current = waiting;
    setIsWaitingForClarification(waiting);
  };

  const goToStep = (targetStep: WizardStep, pushHistory: boolean = true, questionIndex?: number) => {
    if (step === 'generation') return; // Locked during plan creation
    if (targetStep === step) {
      if (questionIndex !== undefined) setActiveQuestionIndex(questionIndex);
      return;
    }

    // Leaving the schedule cancels a wait for the questions, so their arrival can't pull the user forward.
    if (step === 'schedule' && waitingForClarification.current) setWaitingForClarification(false);
    // An outcome cleared while editing falls back to clarify's, which is what the plan would be built from anyway.
    if (step === 'success' && !editedOutcome.trim()) setEditedOutcome(clarification?.clarifiedOutcome || rawGoal);

    if (pushHistory) writeHistory('pushState', targetStep);

    if (targetStep === 'starting' || targetStep === 'success') {
      const goingBack = isFlowStep(step) && order.indexOf(targetStep) < order.indexOf(step);
      setActiveQuestionIndex(questionIndex ?? (goingBack ? Math.max(0, questionsFor(targetStep).length - 1) : 0));
    }

    setStep(targetStep);
  };

  /** A step is reachable once every step before it in the active order is complete. */
  const canJumpToStep = (targetStep: WizardStep): boolean => {
    if (step === 'generation' || !isFlowStep(targetStep)) return false;
    const index = order.indexOf(targetStep);
    if (!order.slice(0, index).every(isStepComplete)) return false;
    if (targetStep === 'goal' || targetStep === 'schedule') return true;
    // A pathway's first question step may show while clarify is still loading.
    return Boolean(clarification) || (targetStep === 'starting' && goalKind === 'pathway');
  };

  // After a reload the entry may still name a later step; point it at the step actually shown.
  useEffect(() => {
    if (window.history.state?.wizardStep !== step) writeHistory('replaceState', step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePopState = useEffectEvent((e: PopStateEvent) => {
    const target = e.state?.wizardStep;
    if (step === 'generation' || !isFlowStep(target)) return;
    // An entry for a step whose data is gone (e.g. after a reload) falls back to the furthest reachable step.
    let index = order.indexOf(target);
    while (index > 0 && !canJumpToStep(order[index])) index -= 1;
    const reachable = order[index];
    if (reachable !== target) writeHistory('replaceState', reachable);
    goToStep(reachable, false);
  });

  // Subscribed once: React Router re-renders synchronously inside the same popstate dispatch, and a listener
  // removed or re-added during a dispatch is skipped by the browser.
  useEffect(() => {
    const listener = (e: PopStateEvent) => handlePopState(e);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  const stepAfterSchedule = nextStep(goalKind, 'schedule') ?? 'review';

  // The clarify callback runs after later renders, so it reads the current step and order through this ref.
  const leaveScheduleForQuestions = useRef(() => {});
  useLayoutEffect(() => {
    leaveScheduleForQuestions.current = () => goToStep(stepAfterSchedule);
  });

  /** Sends clarify. State that marks the request as started is set by the caller (or initialised, on mount). */
  const requestClarification = (goalText: string) => {
    const request = ++clarifyRequest.current;
    clarifyGoal(goalText)
      .then((result) => {
        if (request !== clarifyRequest.current) return;
        setClarification(result);
        setEditedOutcome(result.clarifiedOutcome);
        setAnswers({});
        setCustomAnswers({});
        setSkipCounts({});
        setIsClarifying(false);
        setConnection('online');
        if (waitingForClarification.current) {
          setWaitingForClarification(false);
          leaveScheduleForQuestions.current();
        }
      })
      .catch((err: unknown) => {
        if (request !== clarifyRequest.current) return;
        console.error('[OnboardingWizard] Clarification error:', err);
        const error = describeOnboardingError(err, 'clarify');
        setClarification(null);
        setClarificationError(error);
        setIsClarifying(false);
        setConnection(error.kind === 'offline' ? 'offline' : 'online');
        setWaitingForClarification(false);
      });
  };

  const startClarification = (goalText: string, force: boolean = false) => {
    const textToUse = (goalText || rawGoal).trim();
    if (!textToUse) return;

    if (!force && lastClarifiedGoal === textToUse && (clarification || isClarifying)) {
      return;
    }

    // Questions and answers belong to one goal; a new goal must never show or send the previous one's.
    if (textToUse !== lastClarifiedGoal) {
      setClarification(null);
      setAnswers({});
      setCustomAnswers({});
      setSkipCounts({});
    }

    setIsClarifying(true);
    setClarificationError(null);
    setLastClarifiedGoal(textToUse);
    requestClarification(textToUse);
  };

  // A preset or draft goal starts clarify in the background on mount (once, even under StrictMode's double effects).
  useEffect(() => {
    if (!initialDraft || clarifiedOnMount.current) return;
    clarifiedOnMount.current = true;
    requestClarification(initialDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaves the goal step at once, while clarify runs in the background.
  const handleStartGoal = (goalText: string, kind: GoalKind) => {
    const textToUse = (goalText || rawGoal).trim();
    if (!textToUse) return;

    setRawGoal(textToUse);
    setEditedOutcome(textToUse);
    setGoalKind(kind);

    goToStep(STEP_ORDER[kind][1]);
    startClarification(textToUse);
  };

  // Leaves the schedule, waiting for clarify if the next step needs the questions and they aren't back yet.
  const handleProceedFromSchedule = () => {
    if (!scheduleChosen) return;
    if (clarification && !isClarifying) {
      goToStep(stepAfterSchedule);
      return;
    }
    // A failed (or never started) clarify is sent again for the same goal; the schedule is untouched.
    if (!isClarifying) startClarification(rawGoal, true);
    setWaitingForClarification(true);
  };

  const finishWithGoal = (goal: Goal) => {
    localStorage.removeItem(DRAFT_GOAL_KEY);
    onGoalCreated(goal);
  };

  /** After a lost connection: the plan the server may have finished anyway, told apart from the goal already active. */
  const findCreatedGoal = async (): Promise<Goal | null> => {
    if (currentGoalId === null) return null;
    try {
      const active = await fetchActiveGoal(token);
      return active && active.id !== currentGoalId && active.rawGoal.trim() === rawGoal.trim() ? active : null;
    } catch {
      return null;
    }
  };

  const handleGeneratePlan = async () => {
    if (isCreating.current) return;
    if (!scheduleChosen) {
      goToStep('schedule');
      return;
    }
    if (!allQuestionsResolved) {
      goToStep(isStepComplete('starting') ? 'success' : 'starting');
      return;
    }
    isCreating.current = true;
    const lostConnectionLastTime = generationError?.kind === 'offline';
    setStep('generation');
    setGenerationError(null);
    setPlanSteps([]);

    if (lostConnectionLastTime) {
      const created = await findCreatedGoal();
      if (created) {
        finishWithGoal(created);
        return;
      }
    }

    try {
      const response: CreateGoalResponse = await createGoalPlan(
        buildCreatePayload({ rawGoal, editedOutcome, clarification, routine, answers, customAnswers }),
        token,
        (event) => {
          setPlanSteps((prev) => [...prev.filter((s) => s.id !== event.id), event]);
        }
      );

      const fullGoal: Goal = {
        ...response.goal,
        roadmapWeeks: response.roadmapWeeks || response.goal.roadmapWeeks || [],
        dailyTasks: response.dailyTasks || response.goal.dailyTasks || [],
      };
      finishWithGoal(fullGoal);
    } catch (err: unknown) {
      console.error(err);
      const error = describeOnboardingError(err, 'create');
      if (error.kind === 'offline') {
        const created = await findCreatedGoal();
        if (created) {
          finishWithGoal(created);
          return;
        }
      }
      isCreating.current = false;
      setConnection(error.kind === 'offline' ? 'offline' : 'online');
      setGenerationError(error);
    }
  };

  return {
    goalKind,
    isPresetGoal,
    order,
    step,
    setStep,
    goToStep,
    canJumpToStep,
    isStepComplete,
    rawGoal,
    setRawGoal,
    isClarifying,
    clarificationError,
    isWaitingForClarification,
    connection,
    clarification,
    editedOutcome,
    setEditedOutcome,
    answers,
    setAnswers,
    customAnswers,
    setCustomAnswers,
    skipCounts,
    setSkipCounts,
    activeQuestionIndex,
    setActiveQuestionIndex,
    questionList,
    questionGroups,
    answerFor,
    isSkipped,
    isResolved,
    allQuestionsResolved,
    shownQuestion,
    routine,
    setRoutine,
    scheduleChosen,
    planSteps,
    generationError,
    startClarification,
    handleStartGoal,
    handleProceedFromSchedule,
    handleGeneratePlan,
  };
}
