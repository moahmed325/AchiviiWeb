import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, settled, shellGoal } from './shellFixtures';

// Missed sessions M4.1 (RULE-7, UX-3, AC-8): after test day, the week's test can be logged without the review.
// The mocked PUT /weeks/:n/test-result stores the result on the mocked goal, so a reload returns it.

const TITLE = "This week's test is still open";
const LINE = "Take it when you can. Your result goes into this week's review.";
const TEST = { type: 'deliverable_check', instructions: 'Share the one-page brief with one person who might use it.', passIf: 'one person reads it and replies' };

/** The shell goal as plan v2, with a test on week 1 and the test day on `testOffset` (0 = today, -1 = yesterday). */
function goalWithTest(testOffset: number) {
  const base = shellGoal();
  return {
    ...base,
    planVersion: 2,
    roadmapWeeks: base.roadmapWeeks.map((w) => ({ ...w, test: TEST, testResult: null })),
    dailyTasks: base.dailyTasks.map((t) => ({ ...t, isTestDay: t.id === `t${3 + testOffset}` })),
  };
}

const card = (page: Page) => page.getByRole('region', { name: TITLE });

async function expectCleanAt(page: Page, widths: number[]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
    // Axe measures contrast: let the fade-in finish first.
    await settled(page);
    expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
  }
}

test.describe('Late test on Today (M4.1)', () => {
  test('after test day: the card, logging a result, and the card gone after a reload', async ({ page }) => {
    const calls = await mockApi(page, { goal: goalWithTest(-1) });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole('heading', { level: 2, name: TITLE })).toBeVisible();
    await expect(card(page).getByText(LINE)).toBeVisible();
    await expect(card(page).getByText(TEST.instructions)).toBeVisible();
    await expect(card(page).getByText('Pass if one person reads it and replies.')).toBeVisible();
    await expect(card(page).getByText(/\blate\b|missed|behind|failed/i)).toHaveCount(0);
    const open = card(page).getByRole('button', { name: 'Log my result' });
    const box = await open.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await expectCleanAt(page, [390, 360, 412]);
    await page.setViewportSize({ width: 390, height: 844 });

    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Log my result' });
    await expect(dialog).toBeVisible();
    await settled(page);
    expect(await axeViolations(page), 'axe with the dialog open').toEqual([]);
    await dialog.getByLabel('Your result').fill('Sent to Sam, who replied');
    await dialog.getByRole('button', { name: 'Save result' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(TITLE)).toHaveCount(0);
    expect(calls.testResults).toEqual([{ weekNumber: 1, body: { value: 'Sent to Sam, who replied', passed: true } }]);
    // The week is not closed: Today still shows the week, and no review was sent.
    await expect(page.getByRole('heading', { level: 2, name: 'Write the one-page product brief' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Write the one-page product brief' })).toBeVisible();
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });

  test('a failed save keeps the form and says so; Escape closes it and returns focus', async ({ page }) => {
    await mockApi(page, { goal: goalWithTest(-1), testResultStatus: 500 });
    await signIn(page);
    await page.goto('/');

    const open = card(page).getByRole('button', { name: 'Log my result' });
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Log my result' });
    await dialog.getByLabel('Your result').fill('Sent');
    await dialog.getByRole('button', { name: 'Save result' }).click();
    await expect(dialog.getByRole('alert')).toHaveText("That didn't save. Please try again.");
    await expect(dialog.getByLabel('Your result')).toHaveValue('Sent');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await expect(card(page)).toBeVisible();
  });

  test('not on the test day itself, before it closes', async ({ page }) => {
    await mockApi(page, { goal: goalWithTest(0) });
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Write the one-page product brief' })).toBeVisible();
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });
});
