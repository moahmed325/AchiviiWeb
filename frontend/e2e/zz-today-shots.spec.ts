import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { mockApi, signIn } from './mockApi';
import { shellGoal } from './shellFixtures';

// TEMPORARY: visual check of Today. Not committed.
const OUT = 'C:/Users/moahm/AppData/Local/Temp/today-shots';

test('today screenshots', async ({ page }, testInfo) => {
  mkdirSync(OUT, { recursive: true });
  const name = testInfo.project.name;
  await mockApi(page, { goal: shellGoal() });
  await signIn(page);
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${name}-1-default.png`, fullPage: true });

  await page.getByRole('button', { name: 'Show the 2 steps' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-2-steps-open.png`, fullPage: true });
  await page.getByRole('button', { name: 'Hide the steps' }).click();

  await page.getByRole('button', { name: 'Mark complete' }).click();
  await page.getByText('Step completed.').waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${name}-3-done.png`, fullPage: true });

  await page.getByRole('button', { name: 'Show week' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}-4-week-open.png`, fullPage: true });
});
