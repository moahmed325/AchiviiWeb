import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { SHELL_GOAL_TITLE, STORED_OUTCOME, expectCleanAt, shellGoal, settled } from './shellFixtures';

/**
 * ND-33: the Roadmap shows progress and the whole plan, each week's details folded (ND-31 folded Progress into it). The shell goal is
 * day 3 of week 1, with no weekly targets or tests (ND-35); the progress card is checked in the unit tests.
 */

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (/errors expected\]/.test(testInfo.title)) return;
  expect(consoleErrors).toEqual([]);
});

const main = (page: Page) => page.locator('main#main');

const openRoadmap = async (page: Page, url = '/roadmap') => {
  await mockApi(page, { goal: shellGoal() });
  await signIn(page);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toBeVisible();
};

test('the goal, where the plan stands, progress, every phase and week, and the finish line; never the stored outcome', async ({ page }) => {
  await openRoadmap(page);
  await expect(main(page).getByText(/^Week 1 of 12 · Foundation · finishes /)).toBeVisible();
  await expect(main(page).getByText(STORED_OUTCOME)).toHaveCount(0);
  await expect(main(page).getByRole('region', { name: 'Your progress' })).toBeVisible();
  for (const phase of ['Foundation', 'Acceleration', 'Mastery']) await expect(main(page).getByRole('heading', { level: 3, name: phase })).toBeVisible();
  const current = main(page).locator('li[aria-current="step"]');
  await expect(current).toHaveCount(1);
  await expect(current.getByRole('button', { name: /^Week 1: / })).toHaveAttribute('aria-expanded', 'true');
  await expect(current.getByText('2 of 6')).toBeVisible();
  await expect(main(page).getByRole('heading', { level: 3, name: /^Finish line/ })).toBeVisible();
});

test('/progress opens the Roadmap, and the navigation has one entry for both', async ({ page }) => {
  await openRoadmap(page, '/progress');
  await expect(page).toHaveURL('/roadmap');
  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('link', { name: 'Roadmap' })).toHaveAttribute('aria-current', 'page');
  await expect(primary.getByRole('link', { name: 'Progress' })).toHaveCount(0);
});

test('clean at phone widths: no overflow and no axe violations', async ({ page }) => {
  await openRoadmap(page);
  await expectCleanAt(page);
});

test('with reduced motion, nothing on the Roadmap animates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRoadmap(page);
  await settled(page);
  const durations = await main(page).evaluate((el) =>
    [el, ...el.querySelectorAll('*')].flatMap((node) => {
      const style = getComputedStyle(node);
      return [parseFloat(style.animationDuration) || 0, parseFloat(style.transitionDuration) || 0];
    }),
  );
  expect(Math.max(...durations)).toBeLessThanOrEqual(0.01);
});
