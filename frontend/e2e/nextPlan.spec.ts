import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { shellGoal } from './shellFixtures';

// Next plan (docs/features/next-plan): the day-90 screen leads with what they reached (NP-1, NP-2); with Pro it offers
// the next plan, which opens goal creation starting from the measured level (NP-3, NP-6); without Pro there is no
// next plan and no Pro line (NP-7); the new plan's Progress names the plan it follows (NP-8).

const clarifyCustom = JSON.parse(readFileSync(new URL('./fixtures/onboarding/clarify-custom-sourdough.json', import.meta.url), 'utf8'));

const JOURNEY = {
  kind: 'number',
  start: '3 km',
  startValue: 3,
  reached: '8 km',
  reachedValue: 8,
  reachedWeek: 12,
  goal: '10 km',
  goalValue: 10,
  unit: 'km',
  direction: 'higher_is_better',
  dayNinetyTarget: null,
  reachedDayNinety: false,
  madeIt: false,
  nearGoal: false,
  weeksFinished: 12,
  lastDone: null,
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

test('Pro: the day-90 screen leads with the result and keep going starts from it', async ({ page }) => {
  await mockApi(page, { goal: completedGoal(), plan: 'pro', clarify: clarifyCustom });
  await signIn(page);
  await page.goto('/');

  await expect(page.getByText('You went from 3 km to 8 km.')).toBeVisible();
  await expect(page.getByText("Your goal: 10 km. That's your next plan.")).toBeVisible();
  await page.getByRole('button', { name: 'Keep going to 10 km' }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('status').filter({ hasText: 'Your next plan starts from 8 km.' })).toBeVisible();
});

test('free: no next plan and no Pro line on the day-90 screen', async ({ page }) => {
  await mockApi(page, { goal: completedGoal(), plan: 'free' });
  await signIn(page);
  await page.goto('/');

  await expect(page.getByText('You went from 3 km to 8 km.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose another pathway' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Keep going|Go further/ })).toHaveCount(0);
  await expect(page.getByText(/\bPro\b/)).toHaveCount(0);
});

test('the next plan’s Roadmap names the plan it follows (ND-31: Progress is part of it)', async ({ page }) => {
  await mockApi(page, { goal: { ...shellGoal(), previousPlan: { goalId: 'old', number: 2, mode: 'keep_going', summary: '3 km → 8 km' } } });
  await signIn(page);
  await page.goto('/roadmap');
  await expect(page.getByText('Plan 2. Plan 1: 3 km → 8 km.')).toBeVisible();
});
