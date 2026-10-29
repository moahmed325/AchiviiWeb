import type { FollowUpQuestion } from '../../types';

/**
 * ND-28: onboarding asks one thing per page. The essentials need no AI call, so they come first while clarify reads
 * the goal in the background; a vague goal gets a page of concrete goals to choose from; then clarify's questions, one
 * per page; then the summary.
 */
export const ESSENTIAL_PAGES = ['days', 'weekdays', 'minutes', 'slot', 'day', 'commitments', 'date'] as const;
export type EssentialPage = (typeof ESSENTIAL_PAGES)[number];

/** Typical first goals, one of them vague on purpose: Achivii helps turn it into something measurable. */
export const GOAL_EXAMPLES = ['Run my first 10K', 'Speak conversational Spanish', 'Write the first draft of a book', 'Get fit'] as const;

export const GOAL_MAX_LENGTH = 200;

/** `questions` holds the place of clarify's questions while they are on their way. */
export type PageId = 'goal' | EssentialPage | 'focus' | 'questions' | `q:${string}` | 'summary';

/** The vague-goal page waits until the person has answered a few essentials, so a second clarify can run behind the rest. */
export const FOCUS_EARLIEST: EssentialPage = 'minutes';

export const questionPage = (q: Pick<FollowUpQuestion, 'id'>): PageId => `q:${q.id}`;
export const isQuestionPage = (page: PageId): page is `q:${string}` => page.startsWith('q:');
export const isEssentialPage = (page: unknown): page is EssentialPage => ESSENTIAL_PAGES.includes(page as EssentialPage);

export interface PageListInput {
  /** The essential the focus page follows, once it is known to be needed; null before that. */
  focusAfter: EssentialPage | null;
  /** Clarify's questions; null while they are on their way (or after the goal changed). */
  questions: FollowUpQuestion[] | null;
}

export function pageList({ focusAfter, questions }: PageListInput): PageId[] {
  const pages: PageId[] = ['goal'];
  for (const page of ESSENTIAL_PAGES) {
    pages.push(page);
    if (page === focusAfter) pages.push('focus');
  }
  if (questions && questions.length > 0) pages.push(...questions.map(questionPage));
  else pages.push('questions');
  pages.push('summary');
  return pages;
}

export const isPageId = (value: unknown, pages: readonly PageId[]): value is PageId =>
  typeof value === 'string' && pages.includes(value as PageId);

export type Section = 'goal' | 'week' | 'you' | 'ready';

export const SECTION_LABEL: Record<Section, string> = {
  goal: 'Your goal',
  week: 'Your week',
  you: 'Where you start',
  ready: 'Ready',
};

export const SECTIONS: readonly Section[] = ['goal', 'week', 'you', 'ready'];

export function sectionOf(page: PageId): Section {
  if (page === 'goal' || page === 'focus') return 'goal';
  if (isEssentialPage(page)) return 'week';
  if (page === 'summary') return 'ready';
  return 'you';
}
