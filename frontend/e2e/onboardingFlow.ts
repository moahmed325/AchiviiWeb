import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { CreateRequest } from './mockApi';

export interface ClarifyQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface ClarifyResponse {
  clarifiedOutcome: string;
  primaryDomain: string;
  followUpQuestions: ClarifyQuestion[];
}

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/onboarding/${name}.json`, import.meta.url), 'utf8')) as T;

/**
 * Recorded on 2026-09-23 against the live dev stack before any Phase 3 change (M3.1): clarify passed through to the
 * backend, create intercepted before generation. These are the R-4 baseline; regenerate them only with Mo's approval.
 */
export const baseline = {
  presetClarify: fixture<ClarifyResponse>('clarify-run10k'),
  presetCreate: fixture<CreateRequest>('create-run10k'),
  customClarify: fixture<ClarifyResponse>('clarify-custom-sourdough'),
  customCreate: fixture<CreateRequest>('create-custom-sourdough'),
};

export const PRESET_GOAL = 'Run a 10K Under 50 Minutes';
export const CUSTOM_GOAL = 'Bake sourdough bread at home';
export const CUSTOM_TYPED_SUCCESS = 'Bake a loaf with an open crumb every weekend';

/** ND-28: one page per question. Clarify's questions are headed by their own text. */
export const STEP_HEADING = {
  goal: 'What do you want to achieve?',
  days: 'How many days a week can you give it?',
  weekdays: 'Which days work best?',
  minutes: 'How long can each session be?',
  slot: 'When do you have the most energy for it?',
  day: 'What does a normal day look like?',
  commitments: 'Anything else fixed in your week?',
  date: 'Is there a date this has to be ready by?',
  focus: "Let's give it a finish line",
  summary: 'Here’s where you’re going',
} as const;

export type Step = keyof typeof STEP_HEADING;

export async function expectStep(page: Page, step: Step, timeout?: number) {
  await expect(page.getByRole('heading', { level: 1, name: STEP_HEADING[step] })).toBeVisible({ timeout });
}

export async function expectQuestion(page: Page, question: string, timeout?: number) {
  await expect(page.getByRole('heading', { level: 1, name: question })).toBeVisible({ timeout });
}

/**
 * Answers, plans and day lengths are native radios inside their labels (ChoiceCard).
 * Scroll to the centre first: on a phone the sticky step footer covers a control that `click` has only
 * scrolled to the bottom edge, and the click never lands.
 */
export async function chooseOption(page: Page, option: string) {
  const label = page.locator('label').filter({ has: page.getByRole('radio', { name: option, exact: true }) });
  await label.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await label.click();
}

export const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });

/** Types the goal on the goal page (or the landing page's own field) and starts. */
export async function startGoal(page: Page, goal: string) {
  await page.getByRole('textbox', { name: STEP_HEADING.goal }).first().fill(goal);
  await page.keyboard.press('Enter');
  await expectStep(page, 'days');
}

/**
 * The routine used by both baselines: Steady, 45 minutes, every other page left at its default. Ends on the page
 * after the date: the first question, or the wait for them.
 */
export async function answerEssentials(page: Page) {
  await expectStep(page, 'days');
  await chooseOption(page, 'Steady');
  await continueButton(page).click();
  await expectStep(page, 'weekdays');
  await continueButton(page).click();
  await expectStep(page, 'minutes');
  await chooseOption(page, '45 min');
  await continueButton(page).click();
  for (const step of ['slot', 'day', 'commitments', 'date'] as const) {
    await expectStep(page, step);
    await continueButton(page).click();
  }
}

/** Preset baseline: the first option of every question, then the summary. */
export async function answerPresetQuestions(page: Page, questions: ClarifyQuestion[]) {
  for (const question of questions) {
    await expectQuestion(page, question.question, 90_000);
    await chooseOption(page, question.options[0]);
    await continueButton(page).click();
  }
  await expectStep(page, 'summary');
}

/** Custom baseline: an option, a typed success answer, a question skipped twice and an option, then the summary. */
export async function answerCustomQuestions(page: Page, questions: ClarifyQuestion[]) {
  expect(questions.map((q) => q.id)).toEqual(['current_level', 'success', 'equipment', 'obstacle']);
  await expectQuestion(page, questions[0].question, 90_000);
  await chooseOption(page, questions[0].options[0]);
  await continueButton(page).click();
  await expectQuestion(page, questions[1].question);
  await page.getByLabel('Or put it in your own words').fill(CUSTOM_TYPED_SUCCESS);
  await continueButton(page).click();
  await expectQuestion(page, questions[2].question);
  await page.getByRole('button', { name: 'Skip this' }).click();
  await page.getByRole('button', { name: 'Skip anyway' }).click();
  await chooseOption(page, questions[3].options[0]);
  await continueButton(page).click();
  await expectStep(page, 'summary');
}

export const generateButton = (page: Page) => page.getByRole('button', { name: 'Start my journey' });

export async function generate(page: Page) {
  await generateButton(page).click();
}

/** Commitment ids come from `Date.now()`; everything else must match the baseline exactly. */
export function normalizeCreateBody(body: unknown) {
  const copy = structuredClone(body) as { routine?: { commitments?: Array<{ id?: unknown }> } };
  copy.routine?.commitments?.forEach((c) => (c.id = '<id>'));
  return copy;
}
