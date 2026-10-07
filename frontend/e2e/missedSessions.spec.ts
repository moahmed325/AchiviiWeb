import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, shellGoal } from './shellFixtures';

// Missed sessions M3.2: the gentle-return day and the short-on-time offer on Today (UX-2, UX-4, AC-10).
// Signals come from the mocked reconcile response; the switch for carry writes is a backend concern and untouched.

const main = (page: Page) => page.locator('main#main');
const stepCard = (page: Page) => main(page).locator('section[aria-labelledby="step-heading"]');

const WELCOME = "Welcome back. Today's a short one to ease in.";
const COUNTS = 'The 10-minute version still counts toward this week.';
const MINIMUM = {
  stepNumber: 1,
  title: 'Ten minutes on the brief',
  durationMinutes: 10,
  instructions: 'Write the one sentence that says who the product is for.',
  focusCue: 'One sentence.',
  pitfallToAvoid: '',
};

/** The shell goal with a 10-minute version on today (t3), and the days before it left undone. */
function goalWithMinimum() {
  const base = shellGoal();
  return {
    ...base,
    dailyTasks: base.dailyTasks.map((t) =>
      t.id === 't3' ? { ...t, minimumVersion: MINIMUM } : t.id === 't1' || t.id === 't2' ? { ...t, status: 'pending' as const } : t,
    ),
  };
}

function reconciled(goal: ReturnType<typeof goalWithMinimum>, signals: Record<string, unknown>) {
  return {
    applies: true,
    goalId: goal.id,
    asOf: new Date().toISOString(),
    timezone: 'UTC',
    days: [],
    gap: null,
    carry: { enabled: false, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
    signals: { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null, ...signals },
  };
}

/** Every new control is a real touch target (R6). */
async function expectTouchTarget(page: Page, name: string) {
  const box = await stepCard(page).getByRole('button', { name, exact: true }).boundingBox();
  expect(box, name).not.toBeNull();
  expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
}

async function expectCleanAt(page: Page, widths: number[]) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
    expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
  }
}

test.describe('Missed sessions on Today (M3.2)', () => {
  test('gentle-return day: the 10-minute version is the default, the full session one tap away', async ({ page }) => {
    const goal = goalWithMinimum();
    const gap = shellGoal().dailyTasks;
    await mockApi(page, {
      goal,
      reconcile: reconciled(goal, {
        notice: 'gentle_return',
        gentleReturn: { gapLength: 3, firstDate: gap[0].date, lastDate: gap[1].date },
        shortOnTime: true,
      }),
    });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const card = stepCard(page);
    await expect(card.getByText(WELCOME)).toBeVisible();
    const primary = card.getByRole('button', { name: 'Start the 10-minute version', exact: true });
    const full = card.getByRole('button', { name: 'Start the full session', exact: true });
    await expect(primary).toBeVisible();
    await expect(full).toBeVisible();
    await expect(card.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
    // Both signals: only the gentle-return day shows; the short-on-time line does not.
    await expect(page.getByText(COUNTS)).toHaveCount(0);
    await expect(page.getByText(/missed|failed|behind|\bwhy\b/i)).toHaveCount(0);
    await expectTouchTarget(page, 'Start the 10-minute version');
    await expectTouchTarget(page, 'Start the full session');

    // Keyboard: the primary action, then the full session.
    await primary.focus();
    await page.keyboard.press('Tab');
    await expect(full).toBeFocused();

    // One tap opens Focus mode on the 10-minute version.
    await primary.click();
    await page.getByRole('button', { name: /start focused session/i }).click();
    await expect(page.getByText('Minimum version')).toBeVisible();
    await expect(page.getByRole('heading', { name: MINIMUM.title })).toBeVisible();
    await page.keyboard.press('Escape');

    // One tap opens the full session, as Start does on other days.
    await full.click();
    await page.getByRole('button', { name: /start focused session/i }).click();
    await expect(page.getByText('Step 1 of 2')).toBeVisible();
    await page.keyboard.press('Escape');

    await expectCleanAt(page, [390, 360, 412]);
  });

  test('short on time: Start stays first, the 10-minute version is one tap away with its line', async ({ page }) => {
    const goal = goalWithMinimum();
    await mockApi(page, { goal, reconcile: reconciled(goal, { shortOnTime: true }) });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const card = stepCard(page);
    const start = card.getByRole('button', { name: 'Start', exact: true });
    const minimum = card.getByRole('button', { name: 'Start the 10-minute version', exact: true });
    await expect(start).toBeVisible();
    await expect(minimum).toBeVisible();
    await expect(card.getByText(COUNTS)).toBeVisible();
    await expect(page.getByText(WELCOME)).toHaveCount(0);
    await expect(page.getByText(/missed|failed|behind|\bwhy\b/i)).toHaveCount(0);
    await expectTouchTarget(page, 'Start the 10-minute version');

    await start.focus();
    await page.keyboard.press('Tab');
    await expect(minimum).toBeFocused();

    await minimum.click();
    await page.getByRole('button', { name: /start focused session/i }).click();
    await expect(page.getByText('Minimum version')).toBeVisible();
    await page.keyboard.press('Escape');

    await expectCleanAt(page, [390, 360, 412]);
  });
});
