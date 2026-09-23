import type { FollowUpQuestion } from '../../types';
import type { useOnboardingState } from './useOnboardingState';

export type OnboardingState = ReturnType<typeof useOnboardingState>;

type QuestionFlowState = Pick<
  OnboardingState,
  | 'activeQuestionIndex'
  | 'skipCounts'
  | 'isResolved'
  | 'shownQuestion'
  | 'setActiveQuestionIndex'
  | 'setAnswers'
  | 'setCustomAnswers'
  | 'setSkipCounts'
>;

/**
 * One question step (a ND-14 group): which question is shown, and where answering and skipping lead.
 * `onFinish` runs once every question in the group is answered or skipped.
 */
export function questionFlow(state: QuestionFlowState, questions: FollowUpQuestion[], onFinish: () => void) {
  const {
    activeQuestionIndex,
    skipCounts,
    isResolved,
    shownQuestion,
    setActiveQuestionIndex,
    setAnswers,
    setCustomAnswers,
    setSkipCounts,
  } = state;

  const totalQuestions = questions.length;
  const safeIdx = Math.min(Math.max(0, activeQuestionIndex), Math.max(0, totalQuestions - 1));
  const currentQ: FollowUpQuestion | undefined = questions[safeIdx];
  const currentShown = currentQ ? shownQuestion(currentQ) : null;
  const currentSkips = currentQ ? skipCounts[currentQ.id] || 0 : 0;

  const firstUnresolved = (exceptId?: string) =>
    questions.findIndex((q) => q.id !== exceptId && !isResolved(q));

  /** True when moving on from the current question finishes the group. */
  const isLastStop = !currentQ || (safeIdx >= totalQuestions - 1 && firstUnresolved(currentQ.id) < 0);

  const moveOn = (fromIdx: number, justResolvedId?: string) => {
    if (fromIdx < totalQuestions - 1) {
      setActiveQuestionIndex(fromIdx + 1);
      return;
    }
    const pending = firstUnresolved(justResolvedId);
    if (pending >= 0) {
      setActiveQuestionIndex(pending);
      return;
    }
    onFinish();
  };

  const skipCurrent = () => {
    if (!currentQ) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQ.id];
      return next;
    });
    setCustomAnswers((prev) => ({ ...prev, [currentQ.id]: '' }));
    if (currentSkips === 0) {
      setSkipCounts((prev) => ({ ...prev, [currentQ.id]: 1 }));
      return;
    }
    setSkipCounts((prev) => ({ ...prev, [currentQ.id]: 2 }));
    moveOn(safeIdx, currentQ.id);
  };

  const chooseOption = (option: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({ ...prev, [currentQ.id]: option }));
    setCustomAnswers((prev) => ({ ...prev, [currentQ.id]: '' }));
  };

  const typeAnswer = (text: string) => {
    if (!currentQ) return;
    setCustomAnswers((prev) => ({ ...prev, [currentQ.id]: text }));
  };

  return {
    questions,
    totalQuestions,
    safeIdx,
    currentQ,
    currentShown,
    currentSkips,
    isLastStop,
    firstUnresolved,
    moveOn,
    skipCurrent,
    chooseOption,
    typeAnswer,
    showQuestion: (idx: number) => setActiveQuestionIndex(idx),
    previousQuestion: () => setActiveQuestionIndex(Math.max(0, safeIdx - 1)),
  };
}

export type QuestionFlow = ReturnType<typeof questionFlow>;
