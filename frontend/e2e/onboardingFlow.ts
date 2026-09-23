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

/** Step headings since M3.5. Steps are named rather than numbered because their order depends on the goal (ND-13). */
export const STEP_HEADING = {
  goal: 'Where are you going?',
  starting: 'Where are you starting?',
  success: 'What does success look like?',
  schedule: 'When can you make time for this?',
  review: 'Before we build your path',
} as const;

export type Step = keyof typeof STEP_HEADING;

export async function expectStep(page: Page, step: Step, timeout?: number) {
  await expect(page.getByRole('heading', { level: 1, name: STEP_HEADING[step] })).toBeVisible({ timeout });
}

/** Answers, plans and day lengths are native radios inside their labels (ChoiceCard, SegmentedControl). */
export async function chooseOption(page: Page, option: string) {
  await page.locator('label').filter({ has: page.getByRole('radio', { name: option, exact: true }) }).click();
}

const nextOrContinue = (page: Page) => page.getByRole('button', { name: /^(Next question|Continue)$/ });

/**
 * The schedule used by both baselines: Steady, 45 minutes, every other field left at its default. A custom goal
 * goes on to its questions, which may still be coming from clarify; a pathway goes on to the review (ND-13).
 */
export async function chooseSchedule(page: Page, next: 'starting' | 'review') {
  await expectStep(page, 'schedule');
  await chooseOption(page, 'Steady');
  await chooseOption(page, '45 min');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectStep(page, next, 90_000);
}

/** Preset baseline: the first option of every question. A pathway has no success question, so that step only confirms the outcome. */
export async function answerPresetQuestions(page: Page, questions: ClarifyQuestion[]) {
  await expectStep(page, 'starting');
  for (const question of questions) {
    await chooseOption(page, question.options[0]);
    await nextOrContinue(page).click();
  }
  await expectStep(page, 'success');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

/**
 * Custom baseline: an option, a question skipped twice and an option on the starting point, then a typed answer to
 * the success question (ND-14 moves it next to the outcome).
 */
export async function answerCustomQuestions(page: Page, questions: ClarifyQuestion[]) {
  expect(questions.map((q) => q.id)).toEqual(['current_level', 'success', 'equipment', 'obstacle']);
  await expectStep(page, 'starting');
  await chooseOption(page, questions[0].options[0]);
  await page.getByRole('button', { name: 'Next question' }).click();
  await page.getByRole('button', { name: 'Skip this' }).click();
  await page.getByRole('button', { name: 'Skip anyway' }).click();
  await chooseOption(page, questions[3].options[0]);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expectStep(page, 'success');
  await page.getByLabel('Or put it in your own words').fill(CUSTOM_TYPED_SUCCESS);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expectStep(page, 'review');
}

export const generateButton = (page: Page) => page.getByRole('button', { name: 'Build my 90-day path' });

export async function generate(page: Page) {
  await generateButton(page).click();
}

/** Commitment ids come from `Date.now()`; everything else must match the baseline exactly. */
export function normalizeCreateBody(body: unknown) {
  const copy = structuredClone(body) as { routine?: { commitments?: Array<{ id?: unknown }> } };
  copy.routine?.commitments?.forEach((c) => (c.id = '<id>'));
  return copy;
}
