import { findPresetForGoal, type EvidenceTriad } from './presets/index.js';
import { generateWithOneRetry } from './retry.js';

export const QUESTION_IDS = ['current_level', 'success', 'equipment', 'obstacle'] as const;

/** Used when a question comes without its own second wording (presets, or a model that left it out). */
export const RETRY_FALLBACK_SUBTITLE = 'A rough guess is fine. It helps us size your first week.';

export interface ClarifyQuestion {
  id: string;
  question: string;
  subtitle: string;
  options: string[];
  allowCustom: boolean;
  /** Shown once if the user skips the question the first time. */
  retry: { question: string; subtitle: string };
}

export interface GoalClarification {
  /** The working title: a plain restatement of the goal, with no targets added. */
  clarifiedOutcome: string;
  primaryDomain: string;
  followUpQuestions: ClarifyQuestion[];
  evidenceTriad?: EvidenceTriad;
}

const CLARIFY_SYSTEM = `You help a person start a 90-day goal. You do not write the plan. Your only job is to understand the goal
well enough to ask four questions whose answers will shape the plan.

Respond with one JSON object that matches the schema.`;

const questionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', enum: [...QUESTION_IDS] },
    question: { type: 'string' },
    subtitle: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    allowCustom: { type: 'boolean' },
    retry: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        subtitle: { type: 'string' },
      },
      required: ['question', 'subtitle'],
    },
  },
  required: ['id', 'question', 'subtitle', 'options', 'allowCustom', 'retry'],
};

export const CLARIFY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    workingTitle: { type: 'string' },
    domain: { type: 'string' },
    questions: { type: 'array', items: questionSchema },
  },
  required: ['workingTitle', 'domain', 'questions'],
};

export function buildClarifyPrompt(rawGoal: string): string {
  return `The goal as the user typed it: "${rawGoal}"

1. "workingTitle": restate the goal as a short, plain action title (4 to 10 words), keeping the user's meaning.
   Do not add targets or numbers the user did not give; the user defines success in question 2.
   Good: "Become a live streamer", "Bake sourdough bread at home". Bad: "Master the art of streaming by Day 90".

2. "domain": the activity in 1 to 3 words, named by what the person actually does ("Live streaming",
   "Bread baking", "Touch typing"), never by adjectives or nationalities in the title
   ("French sourdough" is "Bread baking").

3. "questions": exactly 4, in this order. Each has "id", "question", "subtitle" (one short line on why we ask),
   3 to 5 "options" written for THIS goal, "allowCustom": true, and "retry": the same question asked a
   different, easier way ("question" and "subtitle"), shown if they skip it the first time.
   Good retry for push-ups: "Roughly how many push-ups could you do today, even with rests?"

   a. id "current_level": where they are now, as something they can measure or state as a fact,
      not a self-rating. Ask for a count, a time, a result, or what they have already done.
      Good: "How many push-ups can you do in a row right now?" with options "0-5", "6-15", "16-30", "More than 30".
      Good: "Have you streamed before?" with "Never", "A few times, no regular viewers", "Regularly, under 10 viewers",
      "Regularly, 10+ viewers".
      Bad: "What is your level?" with "Beginner", "Intermediate", "Advanced".

   b. id "success": "In 90 days, what would make you say this worked?" Options are concrete, checkable outcomes
      for this goal at different sizes, from modest to ambitious.
      Good for streaming: "Stream 3 times a week without skipping", "Reach Twitch Affiliate",
      "Average 10 live viewers", "Earn my first income from streaming".
      Bad: "Get better", "Feel confident", "Master it".

   c. id "equipment": what they have or can use for this goal (tools, gear, space, access). Options list the
      realistic setups for this goal, from minimal to full.

   d. id "obstacle": the thing most likely to stop them. Options are the real obstacles people hit with this
      goal specifically, not only "time" and "motivation".
      Good for sourdough: "My starter keeps dying", "Loaves come out dense", "I don't have time on weekdays".

Keep every question short enough to read in one glance. No jargon the user would have to look up.`;
}

interface RawClarifyQuestion {
  id?: unknown;
  question?: unknown;
  subtitle?: unknown;
  options?: unknown;
  retry?: { question?: unknown; subtitle?: unknown } | null;
}

export interface RawClarifyAnswer {
  workingTitle?: unknown;
  domain?: unknown;
  questions?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of value) {
    const option = text(item);
    const key = option.toLowerCase();
    if (!option || seen.has(key)) continue;
    seen.add(key);
    options.push(option);
  }
  return options.slice(0, 5);
}

/** Fixes what code can fix (order, duplicate options, a missing retry) and rejects what it can't. */
export function checkClarifyAnswer(
  data: RawClarifyAnswer
): { value: GoalClarification } | { reason: string } {
  const title = text(data.workingTitle);
  const titleWords = title.split(/\s+/).filter(Boolean).length;
  if (titleWords < 2 || titleWords > 12) {
    return { reason: `"workingTitle" must be 4 to 10 words; got "${title}".` };
  }
  const domain = text(data.domain);
  if (!domain) return { reason: '"domain" is empty.' };

  const raw = Array.isArray(data.questions) ? (data.questions as RawClarifyQuestion[]) : [];
  const questions: ClarifyQuestion[] = [];
  for (const id of QUESTION_IDS) {
    const found = raw.find((q) => text(q?.id) === id);
    if (!found) return { reason: `question "${id}" is missing. Return exactly 4 questions: ${QUESTION_IDS.join(', ')}.` };
    const question = text(found.question);
    if (!question) return { reason: `question "${id}" has no question text.` };
    const options = cleanOptions(found.options);
    if (options.length < 3) {
      return { reason: `question "${id}" needs 3 to 5 different options; got ${options.length}.` };
    }
    const retryQuestion = text(found.retry?.question);
    questions.push({
      id,
      question,
      subtitle: text(found.subtitle),
      options,
      allowCustom: true,
      retry: retryQuestion && retryQuestion.toLowerCase() !== question.toLowerCase()
        ? { question: retryQuestion, subtitle: text(found.retry?.subtitle) || RETRY_FALLBACK_SUBTITLE }
        : { question, subtitle: RETRY_FALLBACK_SUBTITLE },
    });
  }

  return { value: { clarifiedOutcome: title, primaryDomain: domain, followUpQuestions: questions } };
}

/** Prompt 1: turns the typed goal into a working title and the 4 questions that shape the plan. */
export async function clarifyGoalWithAI(rawGoal: string): Promise<GoalClarification> {
  const preset = findPresetForGoal(rawGoal);
  if (preset) {
    return {
      clarifiedOutcome: preset.clarifiedOutcome,
      primaryDomain: preset.primaryDomain,
      followUpQuestions: preset.diagnosticQuestions.map((q) => ({
        ...q,
        retry: { question: q.question, subtitle: RETRY_FALLBACK_SUBTITLE },
      })),
      evidenceTriad: preset.evidenceTriad,
    };
  }

  const clarification = await generateWithOneRetry<RawClarifyAnswer, GoalClarification>(
    buildClarifyPrompt(rawGoal),
    CLARIFY_SYSTEM,
    CLARIFY_RESPONSE_SCHEMA,
    (data) => checkClarifyAnswer(data),
    'Clarify'
  );
  if (clarification) return clarification;

  throw new Error('Unable to analyze your goal right now. AI services are temporarily unavailable. Please retry.');
}
