import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { shellGoal } from './shellFixtures';

// Next plan (docs/features/next-plan): the end screen leads with what they did (NP-1, NP-2; no weekly tests, ND-31); with
// Pro it offers the next plan, which asks a measured goal's level now and opens goal creation starting from it (NP-3,
// NP-6, NP-10); without Pro there is no next plan and no Pro line (NP-7); the new plan's Progress names the plan it
// follows (NP-8).

const clarifyCustom = JSON.parse(readFileSync(new URL('./fixtures/onboarding/clarify-custom-sourdough.json', import.meta.url), 'utf8'));

const JOURNEY = {
  kind: 'number',
  start: '3 km',
  startValue: 3,
  goal: 'Run 10 km without stopping',
  unit: 'km',
  direction: 'higher_is_better',
  weeksFinished: 11,
  sessionsDone: 52,
  sessionsPlanned: 60,
};

const completedGoal = () => {
  const base = shellGoal();
  return { ...base, status: 'completed', completedAt: new Date().toISOString(), journeyResult: JOURNEY };
};

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

test.afterEach(() => {
  expect(consoleErrors).toEqual([]);
});

test('Pro: the end screen leads with what they did; keep going asks the level now and starts from it', async ({ page }) => {
  await mockApi(page, { goal: completedGoal(), plan: 'pro', clarify: clarifyCustom });
  await signIn(page);
  await page.goto('/');

  await expect(page.getByText('You finished 11 of 12 weeks: 52 of 60 sessions.')).toBeVisible();
  await expect(page.getByText('You started at 3 km. Your goal: Run 10 km without stopping.')).toBeVisible();
  await page.getByRole('button', { name: 'Keep going' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('You started this plan at 3 km. Where are you now?').fill('8');
  await dialog.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('status').filter({ hasText: 'Your next plan starts from 8 km.' })).toBeVisible();
});

test('free: no next plan and no Pro line on the end screen', async ({ page }) => {
  await mockApi(page, { goal: completedGoal(), plan: 'free' });
  await signIn(page);
  await page.goto('/');

  await expect(page.getByText('You finished 11 of 12 weeks: 52 of 60 sessions.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose another pathway' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Keep going|Go further/ })).toHaveCount(0);
  await expect(page.getByText(/\bPro\b/)).toHaveCount(0);
});

test('the next plan’s Progress names the plan it follows', async ({ page }) => {
  await mockApi(page, { goal: { ...shellGoal(), previousPlan: { goalId: 'old', number: 2, mode: 'keep_going', summary: '3 km → 8 km' } } });
  await signIn(page);
  await page.goto('/progress');
  await expect(page.getByText('Plan 2. Plan 1: 3 km → 8 km.')).toBeVisible();
});
