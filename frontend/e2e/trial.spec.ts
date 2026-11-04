import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { SHELL_GOAL_TITLE, shellGoal } from './shellFixtures';

// ND-37: every plan starts with 30 days free, no card; after them, without Pro, the plan is paused, not gone.

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000 - 60_000).toISOString();

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

test('during the trial Today says nothing about it until its last week', async ({ page }) => {
  await mockApi(page, { goal: shellGoal(), plan: 'free', access: 'trial', trialEndsAt: inDays(20) });
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Your free trial' })).toHaveCount(0);
});

test('in the trial’s last week Today names the days left and opens Pro', async ({ page }) => {
  await mockApi(page, { goal: shellGoal(), plan: 'free', access: 'trial', trialEndsAt: inDays(3) });
  await signIn(page);
  await page.goto('/');
  const notice = page.getByRole('complementary', { name: 'Your free trial' });
  await expect(notice).toContainText('3 days left of your free trial.');
  await notice.getByRole('button', { name: 'See Pro' }).click();
  const dialog = page.getByRole('dialog', { name: 'Achivii Pro' });
  await expect(dialog.getByRole('button', { name: 'Continue to Pro' })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('after the trial without Pro, Today offers Pro instead of the step, and the plan is still there', async ({ page }) => {
  await mockApi(page, { goal: shellGoal(), plan: 'free', access: 'locked', trialEndsAt: inDays(-2) });
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Keep going where you left off.' })).toBeVisible();
  await expect(page.getByText(`Your plan for “${SHELL_GOAL_TITLE}”`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to Pro' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start/ })).toHaveCount(0);
  const results = await new AxeBuilder({ page }).include('#main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);

  await page.locator('#main').getByRole('link', { name: 'Roadmap' }).click();
  await expect(page).toHaveURL('/roadmap');
});

test('after the trial, onboarding says up front that building a new plan needs Pro', async ({ page }) => {
  await mockApi(page, { goal: null, plan: 'free', access: 'locked', trialEndsAt: inDays(-2) });
  await signIn(page);
  await page.goto('/onboarding');
  await expect(page.getByRole('status').filter({ hasText: 'Your 30 free days are over.' })).toContainText('building it needs Achivii Pro');
});
