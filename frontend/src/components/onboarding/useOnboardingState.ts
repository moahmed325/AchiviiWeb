import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { CreateGoalResponse, FollowUpQuestion, Goal, GoalClarification, RoutineSettings } from '../../types';
import { clarifyGoal, createGoalPlan, fetchActiveGoal, type PlanProgressEvent } from '../../lib/api';
import { checkFixedDate, fixedDateBlocks } from '../../lib/fixedDate';
import { defaultRestWeekdays, validRestWeekdays, weekdayOf } from '../../lib/schedule';
import { nextPlanQuestions, prefilledAnswers, type NextPlanLaunch } from '../../lib/nextPlan';
import { todayKey } from '../../lib/today';
import { clearPlanPreview, previewScheduleFor } from '../../lib/planPreview';
import { useUserTimezone } from '../../context/AuthContext';
import { DRAFT_GOAL_KEY, answerFor as answerForState, buildCreatePayload } from './payload';
import { describeOnboardingError, type OnboardingError } from './requestErrors';
import {
  ESSENTIAL_PAGES,
  FOCUS_EARLIEST,
  isEssentialPage,
  isPageId,
  isQuestionPage,
  pageList,
  questionPage,
  type EssentialPage,
  type PageId,
} from './pages';
import { clearSnapshot, readSnapshot, writeSnapshot, type OnboardingSnapshot } from './snapshot';

export type { PageId } from './pages';
export type { OnboardingError } from './requestErrors';

/** What the last onboarding request learned about the connection to Achivii. */
export type Connection = 'unknown' | 'online' | 'offline';

/** The wizard's current screen: a page, or plan creation (not a page: no progress, history locked). */
export type WizardScreen = PageId | 'generation';

/**
 * The goal that was active when this tab first tried to build, so a reload that has already
 * loaded the finished plan is not treated as "the goal we started with".
 * Cleared with the draft.
 */
const PRIOR_GOAL_KEY = 'achivii_generation_prior_goal';

/** Same tab, this page load only. A reload starts clear and checks GET /api/goal/active again. */
let planCreateStarted = false;

/** Vitest resets the in-flight guard between cases. A hanging create must not block the next test. */
export function resetPlanCreateGuardForTests(options?: { keepPrior?: boolean }) {
  planCreateStarted = false;
  if (!options?.keepPrior) sessionStorage.removeItem(PRIOR_GOAL_KEY);
}

export interface OnboardingStateOptions {
  /** Null for a visitor: they answer everything first and sign up from the summary (ND-28). */
  token: string | null;
  onGoalCreated: (goal: Goal) => void;
  /** A visitor or a signed-in person on the summary without an account yet: keep the answers and go to sign-up. */
  onSignUp?: () => void;
  initialGoal?: string;
  /**
   * The goal active when onboarding opened (undefined: none; null: unknown because it failed to load).
   * A recovered plan must be a different id. `null` skips the check (Phase 5); this tab remembers the id from the
   * first Build so a reload does not mistake a just-saved plan for the one that was already active.
   */
  currentGoalId?: string | null;
  /** Next plan (NP-3): the earlier plan's answers are filled in again, and the level question is not asked. */
  nextPlan?: NextPlanLaunch | null;
  /** B-106: the fixed date to fill in (`YYYY-MM-DD`), from the plan a fresh or next plan follows; kept only while ahead. */
  initialFixedDate?: string;
}

const readDraft = (initialGoal?: string) => {
  if (initialGoal && initialGoal.trim()) return initialGoal.trim();
  try {
    const saved = localStorage.getItem(DRAFT_GOAL_KEY);
    return saved && saved.trim() ? saved.trim() : '';
  } catch {
    return '';
  }
};

/** The answers kept from before a sign-up or a reload, if they belong to this goal. A next plan always starts fresh. */
const restorable = (draft: string, nextPlan: NextPlanLaunch | null): OnboardingSnapshot | null => {
  if (nextPlan) return null;
  const snapshot = readSnapshot();
  if (!snapshot) return null;
  return !draft || snapshot.typedGoal === draft ? snapshot : null;
};

/**
 * Onboarding flow state (ND-28): one page per question, browser history, clarify in the background, the vague-goal
 * page, answers, routine, the kept answers across sign-up, and plan creation. Presentation-only state (editors,
 * dialogs) stays with the page that renders it.
 */
export function useOnboardingState({
  token,
  onGoalCreated,
  onSignUp,
  initialGoal,
  currentGoalId,
  nextPlan = null,
  initialFixedDate = '',
}: OnboardingStateOptions) {
  const [initial] = useState(() => {
    const draft = readDraft(initialGoal);
    const snapshot = restorable(draft, nextPlan);
    return { draft: snapshot?.typedGoal ?? draft, snapshot };
  });
  const { snapshot } = initial;

  const timezone = useUserTimezone();
  const today = todayKey(new Date(), timezone);

  const [typedGoal, setTypedGoal] = useState(initial.draft);
  const [rawGoal, setRawGoal] = useState(snapshot?.rawGoal ?? initial.draft);
  const [editedOutcome, setEditedOutcome] = useState(snapshot?.editedOutcome ?? initial.draft);

  const [clarification, setClarification] = useState<GoalClarification | null>(snapshot?.clarification ?? null);
  // A launched goal's clarify starts on mount, so it is already in flight on the first render.
  const [isClarifying, setIsClarifying] = useState(Boolean(initial.draft) && !snapshot?.clarification);
  const [clarificationError, setClarificationError] = useState<OnboardingError | null>(null);
  const [connection, setConnection] = useState<Connection>('unknown');
  /** Only the latest clarify request may change state; an earlier one (for a goal since changed) is ignored. */
  const clarifyRequest = useRef(0);
  const clarifiedOnMount = useRef(false);

  const [focusAfter, setFocusAfter] = useState<EssentialPage | null>(snapshot?.focusAfter ?? null);
  /** A goal picked (or written) on the focus page is never sent back to it, even if clarify finds it vague too. */
  const [focusChosen, setFocusChosen] = useState(snapshot?.focusChosen ?? false);
  /** The goals offered for a vague goal: from the first clarify that found it vague, kept after one is chosen. */
  const [focusOptions, setFocusOptions] = useState<string[] | null>(snapshot?.focusOptions ?? null);

  const [answers, setAnswers] = useState<Record<string, string>>(snapshot?.answers ?? {});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(snapshot?.customAnswers ?? {});
  // 1 = skipped once (the question is shown again, reworded), 2 = skipped for good.
  const [skipCounts, setSkipCounts] = useState<Record<string, number>>(snapshot?.skipCounts ?? {});

  // A pathway chosen in the landing page's plan preview starts with the daily time and days a week picked there.
  const [routine, setRoutine] = useState<RoutineSettings>(() => {
    if (snapshot) return snapshot.routine;
    const previewed = initial.draft && !nextPlan ? previewScheduleFor(initial.draft) : null;
    return {
      wakeTime: '07:00',
      sleepTime: '23:00',
      busyHours: '09:00 - 17:00',
      preferredSlot: 'evening',
      dailyMinutes: previewed?.dailyMinutes ?? 0,
      planVariant: previewed?.planVariant,
      commitments: [],
    };
  });
  // B-108: the training days shown are the defaults until the person changes them; they are sent only once changed.
  const shownRestWeekdays = routine.planVariant
    ? (routine.restWeekdays ?? defaultRestWeekdays(routine.planVariant, weekdayOf(today)))
    : [];
  const weekdaysValid =
    Boolean(routine.planVariant) &&
    (routine.restWeekdays === undefined || validRestWeekdays(routine.planVariant!, routine.restWeekdays) !== null);
  const scheduleChosen = routine.dailyMinutes > 0 && weekdaysValid;

  // B-106: the optional fixed date, kept apart from the routine (the server stores it on the goal). Checked against
  // today in the person's stored time zone, as the server resolves the plan's start.
  const [fixedDate, setFixedDate] = useState(() => {
    if (snapshot) return snapshot.fixedDate;
    return initialFixedDate && !fixedDateBlocks(checkFixedDate(initialFixedDate, today)) ? initialFixedDate : '';
  });
  const fixedDateCheck = checkFixedDate(fixedDate, today);
  const fixedDateOk = !fixedDateBlocks(fixedDateCheck);

  const needsFocus = Boolean(focusOptions && !focusChosen);
  const questionList = clarification && !needsFocus ? clarification.followUpQuestions || [] : null;
  const pages = pageList({ focusAfter, questions: questionList });

  // A goal launched from the landing page, a pathway or a next plan starts on its first essential.
  const [screen, setScreen] = useState<WizardScreen>(() => {
    if (snapshot && isPageId(snapshot.page, pages)) return snapshot.page;
    if (snapshot) return 'questions';
    return initial.draft ? ESSENTIAL_PAGES[0] : 'goal';
  });
  const page: PageId | null = screen === 'generation' ? null : screen;

  const [planSteps, setPlanSteps] = useState<PlanProgressEvent[]>([]);
  const [generationError, setGenerationError] = useState<OnboardingError | null>(null);
  const isCreating = useRef(false);

  const answerFor = (q: FollowUpQuestion) => answerForState(q, { answers, customAnswers });
  const isSkipped = (q: FollowUpQuestion) => !answerFor(q) && (skipCounts[q.id] || 0) >= 2;
  const isResolved = (q: FollowUpQuestion) => Boolean(answerFor(q)) || isSkipped(q);
  const allQuestionsResolved = Boolean(questionList && questionList.length > 0 && questionList.every(isResolved));
  const shownQuestion = (q: FollowUpQuestion) =>
    (skipCounts[q.id] || 0) >= 1 && q.retry ? q.retry : { question: q.question, subtitle: q.subtitle };
  const questionFor = (p: PageId) => (isQuestionPage(p) ? questionList?.find((q) => questionPage(q) === p) : undefined);

  /** Whether a page's own answer is complete, so Continue can move on. */
  const isPageComplete = (p: PageId): boolean => {
    switch (p) {
      case 'goal':
        return rawGoal.trim().length > 0;
      case 'days':
        return Boolean(routine.planVariant);
      case 'weekdays':
        return weekdaysValid;
      case 'minutes':
        return routine.dailyMinutes > 0;
      case 'slot':
        return Boolean(routine.preferredSlot);
      case 'day':
      case 'commitments':
        return true;
      case 'date':
        return fixedDateOk;
      case 'focus':
        return focusChosen;
      case 'questions':
        return false;
      case 'summary':
        return false;
      default: {
        const q = questionFor(p);
        return Boolean(q && isResolved(q));
      }
    }
  };

  // Kept in this browser as the person goes, so a reload or the sign-up returns them to the same place (ND-28).
  useEffect(() => {
    if (nextPlan || !typedGoal || !page || page === 'goal') return;
    writeSnapshot({
      v: 1,
      typedGoal,
      rawGoal,
      editedOutcome,
      clarification,
      answers,
      customAnswers,
      skipCounts,
      routine,
      fixedDate,
      focusAfter,
      focusChosen,
      focusOptions,
      page,
    });
  }, [nextPlan, typedGoal, rawGoal, editedOutcome, clarification, answers, customAnswers, skipCounts, routine, fixedDate, focusAfter, focusChosen, focusOptions, page]);

  // History entries keep React Router's own state (`usr`, `key`, `idx`), so the launch state that lets
  // ProtectedRoute admit a switch-goal visit survives a reload (ND-16).
  const writeHistory = (method: 'pushState' | 'replaceState', target: PageId) => {
    window.history[method]({ ...window.history.state, wizardStep: target }, '', window.location.pathname);
  };

  const goToPage = (target: PageId, pushHistory: boolean = true) => {
    if (screen === 'generation' || target === screen) return;
    // An outcome cleared while editing falls back to the goal, which is what the plan would be built from anyway.
    if (!editedOutcome.trim()) setEditedOutcome(clarification?.clarifiedOutcome || rawGoal);
    if (pushHistory) writeHistory('pushState', target);
    setScreen(target);
  };

  /** A page is reachable once every page before it is complete. */
  const canReach = (target: PageId): boolean => {
    const index = pages.indexOf(target);
    return index >= 0 && pages.slice(0, index).every((p) => p === 'questions' || isPageComplete(p));
  };

  // After a reload the entry may still name a later page; point it at the page actually shown.
  useEffect(() => {
    if (page && window.history.state?.wizardStep !== page) writeHistory('replaceState', page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePopState = useEffectEvent((e: PopStateEvent) => {
    const target = e.state?.wizardStep;
    if (screen === 'generation' || !isPageId(target, pages)) return;
    // An entry for a page whose data is gone falls back to the furthest reachable page before it.
    let index = pages.indexOf(target);
    while (index > 0 && !canReach(pages[index])) index -= 1;
    const reachable = pages[index];
    if (reachable !== target) writeHistory('replaceState', reachable);
    goToPage(reachable, false);
  });

  // Subscribed once: React Router re-renders synchronously inside the same popstate dispatch, and a listener
  // removed or re-added during a dispatch is skipped by the browser.
  useEffect(() => {
    const listener = (e: PopStateEvent) => handlePopState(e);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);

  /** Sends clarify. State that marks the request as started is set by the caller (or initialised, on mount). */
  const requestClarification = (goalText: string) => {
    const request = ++clarifyRequest.current;
    clarifyGoal(goalText)
      .then((clarified) => {
        if (request !== clarifyRequest.current) return;
        // NP-3: a next plan drops the level question (the server adds the measured level) and fills in the rest.
        const result = nextPlan
          ? { ...clarified, focusOptions: undefined, followUpQuestions: nextPlanQuestions(clarified.followUpQuestions || []) }
          : clarified;
        const filled = nextPlan
          ? prefilledAnswers(result.followUpQuestions, nextPlan.answers, nextPlan.request.mode)
          : { answers: {}, customAnswers: {} };
        setClarification(result);
        // Only the goal as typed is offered goals to choose from; a chosen goal is never sent back to that page.
        if (result.focusOptions?.length) setFocusOptions((prev) => prev ?? result.focusOptions ?? null);
        setEditedOutcome(result.clarifiedOutcome);
        setAnswers(filled.answers);
        setCustomAnswers(filled.customAnswers);
        setSkipCounts({});
        setIsClarifying(false);
        setConnection('online');
      })
      .catch((err: unknown) => {
        if (request !== clarifyRequest.current) return;
        console.error('[OnboardingWizard] Clarification error:', err);
        const error = describeOnboardingError(err, 'clarify');
        setClarification(null);
        setClarificationError(error);
        setIsClarifying(false);
        setConnection(error.kind === 'offline' ? 'offline' : 'online');
      });
  };

  /** Questions and answers belong to one goal; a new goal never shows or sends the previous one's. */
  const startClarification = (goalText: string = rawGoal) => {
    const textToUse = goalText.trim();
    if (!textToUse) return;
    setClarification(null);
    setAnswers({});
    setCustomAnswers({});
    setSkipCounts({});
    setIsClarifying(true);
    setClarificationError(null);
    requestClarification(textToUse);
  };

  // A launched goal starts clarify in the background on mount (once, even under StrictMode's double effects).
  useEffect(() => {
    if (!initial.draft || clarifiedOnMount.current || snapshot?.clarification) return;
    clarifiedOnMount.current = true;
    requestClarification(snapshot?.rawGoal ?? initial.draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While the person waits on the questions page, the answer decides where they go: the focus page for a vague goal,
  // otherwise the first question. The page is replaced, so Back skips the wait.
  useEffect(() => {
    if (screen !== 'questions' || !clarification) return;
    if (needsFocus) {
      setFocusAfter('date');
      writeHistory('replaceState', 'focus');
      setScreen('focus');
      return;
    }
    const first = questionList?.[0];
    if (first) {
      writeHistory('replaceState', questionPage(first));
      setScreen(questionPage(first));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, clarification, needsFocus]);

  /** The goal page: a new goal starts clarify again and resets the vague-goal choice; the routine is kept. */
  const submitGoal = (goalText: string) => {
    const text = goalText.trim();
    if (!text) return;
    if (text !== rawGoal || (!clarification && !isClarifying)) {
      setTypedGoal(text);
      setRawGoal(text);
      setEditedOutcome(text);
      setFocusAfter(null);
      setFocusChosen(false);
      setFocusOptions(null);
      try {
        localStorage.setItem(DRAFT_GOAL_KEY, text);
      } catch {
        // The draft only helps a reload.
      }
      startClarification(text);
    }
    goToPage(ESSENTIAL_PAGES[0]);
  };

  /** The focus page: the chosen goal replaces the vague one, and clarify reads it while the rest is answered. */
  const chooseFocus = (goalText: string) => {
    const text = goalText.trim();
    if (!text) return;
    setFocusChosen(true);
    if (text !== rawGoal) {
      setRawGoal(text);
      setEditedOutcome(text);
      startClarification(text);
    }
  };

  /** Continue from a page. Leaving an essential once a vague goal is known brings the focus page in next. */
  const continueFrom = (from: PageId) => {
    if (!isPageComplete(from) && from !== 'focus') return;
    if (
      isEssentialPage(from) &&
      needsFocus &&
      !focusAfter &&
      ESSENTIAL_PAGES.indexOf(from) >= ESSENTIAL_PAGES.indexOf(FOCUS_EARLIEST)
    ) {
      setFocusAfter(from);
      goToPage('focus');
      return;
    }
    const next = pages[pages.indexOf(from) + 1];
    if (!next) return;
    // Arriving at the questions after a failed clarify sends it again.
    if (next === 'questions' && !clarification && !isClarifying) startClarification(rawGoal);
    goToPage(next);
  };

  const goBack = (from: PageId) => {
    const previous = pages[pages.indexOf(from) - 1];
    if (previous) goToPage(previous === 'questions' ? pages[pages.indexOf(from) - 2] : previous);
  };

  /** Skips a question: the first time it is asked again, reworded; the second time it is skipped for good. */
  const skipQuestion = (q: FollowUpQuestion) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[q.id];
      return next;
    });
    setCustomAnswers((prev) => ({ ...prev, [q.id]: '' }));
    const skips = skipCounts[q.id] || 0;
    setSkipCounts((prev) => ({ ...prev, [q.id]: skips === 0 ? 1 : 2 }));
    if (skips >= 1) {
      const next = pages[pages.indexOf(questionPage(q)) + 1];
      if (next) goToPage(next);
    }
  };

  const chooseAnswer = (q: FollowUpQuestion, option: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: option }));
    setCustomAnswers((prev) => ({ ...prev, [q.id]: '' }));
  };

  const typeAnswer = (q: FollowUpQuestion, text: string) => setCustomAnswers((prev) => ({ ...prev, [q.id]: text }));

  const finishWithGoal = (goal: Goal) => {
    localStorage.removeItem(DRAFT_GOAL_KEY);
    clearPlanPreview();
    clearSnapshot();
    sessionStorage.removeItem(PRIOR_GOAL_KEY);
    onGoalCreated(goal);
  };

  /**
   * The id to tell a finished plan apart from the goal that was already active.
   * Remembered on the first check in this tab. `null` (goal failed to load) is not remembered and not guessed.
   */
  const priorGoalId = (): string | null | undefined => {
    if (currentGoalId === null) return null;
    const stored = sessionStorage.getItem(PRIOR_GOAL_KEY);
    if (stored === null) {
      sessionStorage.setItem(PRIOR_GOAL_KEY, currentGoalId ?? '');
      return currentGoalId;
    }
    return stored === '' ? undefined : stored;
  };

  /** A plan the server already saved for this goal, told apart from the goal that was active when Build started. */
  const findCreatedGoal = async (): Promise<Goal | null> => {
    const prior = priorGoalId();
    if (prior === null || !token) return null;
    try {
      const active = await fetchActiveGoal(token);
      return active && active.id !== prior && active.rawGoal.trim() === rawGoal.trim() ? active : null;
    } catch {
      return null;
    }
  };

  /** The first page that still needs an answer, or null when everything the plan needs is in. */
  const firstIncompletePage = (): PageId | null => {
    if (!scheduleChosen) return routine.planVariant ? (weekdaysValid ? 'minutes' : 'weekdays') : 'days';
    if (!fixedDateOk) return 'date';
    if (!questionList) return needsFocus ? 'focus' : 'questions';
    const unresolved = questionList.find((q) => !isResolved(q));
    return unresolved ? questionPage(unresolved) : null;
  };

  const handleGeneratePlan = async () => {
    if (isCreating.current || planCreateStarted) return;
    const missing = firstIncompletePage();
    if (missing) {
      goToPage(missing);
      return;
    }
    // A visitor signs up first; the answers wait in this browser and the plan is built when they return.
    if (!token) {
      writeSnapshot({
        v: 1,
        typedGoal,
        rawGoal,
        editedOutcome,
        clarification,
        answers,
        customAnswers,
        skipCounts,
        routine,
        fixedDate,
        focusAfter,
        focusChosen,
        focusOptions,
        page: 'summary',
        buildAfterSignUp: true,
      });
      onSignUp?.();
      return;
    }
    isCreating.current = true;
    planCreateStarted = true;
    setScreen('generation');
    setGenerationError(null);
    setPlanSteps([]);

    try {
      const already = await findCreatedGoal();
      if (already) {
        finishWithGoal(already);
        return;
      }

      try {
        const response: CreateGoalResponse = await createGoalPlan(
          buildCreatePayload({ rawGoal, editedOutcome, clarification, routine, fixedDate, answers, customAnswers, nextPlan: nextPlan?.request }),
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
        const created = await findCreatedGoal();
        if (created) {
          finishWithGoal(created);
          return;
        }
        isCreating.current = false;
        setConnection(error.kind === 'offline' ? 'offline' : 'online');
        setGenerationError(error);
      }
    } finally {
      planCreateStarted = false;
    }
  };

  // Back from the sign-up: the visitor already tapped Start, so the plan is built at once.
  const builtAfterSignUp = useRef(false);
  useEffect(() => {
    if (!token || builtAfterSignUp.current || !snapshot?.buildAfterSignUp) return;
    builtAfterSignUp.current = true;
    void handleGeneratePlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return {
    pages,
    screen,
    page,
    setScreen,
    goToPage,
    continueFrom,
    goBack,
    isPageComplete,
    typedGoal,
    rawGoal,
    submitGoal,
    isClarifying,
    clarificationError,
    connection,
    clarification,
    needsFocus,
    focusChosen,
    focusOptions,
    chooseFocus,
    editedOutcome,
    setEditedOutcome,
    answers,
    customAnswers,
    skipCounts,
    questionList,
    questionFor,
    answerFor,
    isSkipped,
    isResolved,
    allQuestionsResolved,
    shownQuestion,
    chooseAnswer,
    typeAnswer,
    skipQuestion,
    routine,
    setRoutine,
    shownRestWeekdays,
    scheduleChosen,
    fixedDate,
    setFixedDate,
    fixedDateCheck,
    today,
    planSteps,
    generationError,
    startClarification,
    handleGeneratePlan,
  };
}
