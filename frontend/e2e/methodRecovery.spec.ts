import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { expectCleanAt, shellGoal } from './shellFixtures';

// Method-aware recovery M3.3: Today, the Dashboard and Focus with the method switch on. The server's line
// (`signals.line`) and choices (`carry.choices`) come from mocked responses; METHOD_RECOVERY_ENABLED is a backend
// setting and untouched.

const main = (page: Page) => page.locator('main#main');
const stepCard = (page: Page) => main(page).locator('section[aria-labelledby="step-heading"]');

const isoDay = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const weekday = (offset: number) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${isoDay(offset)}T00:00:00Z`).getUTCDay()];
const CALM = /missed|failed|behind|\bwhy\b|skipped/i;
const WIDTHS = [1440, 390, 360];

/** The shell goal with changes to some days (t1, t2 done; t3 today; t4-t6 later; t7 rest). */
function shellWith(changes: Record<string, Record<string, unknown>>) {
  const base = shellGoal();
  return { ...base, dailyTasks: base.dailyTasks.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)) };
}

/** A reconcile body with both switches on: the server's line for the day `from` days from today, naming `to`. */
function methodBody(line: { kind: string; from: number; to?: number } | null, choices: Record<string, unknown> = {}) {
  return {
    applies: true,
    goalId: 'g-shell',
    asOf: new Date().toISOString(),
    timezone: 'UTC',
    days: [],
    gap: null,
    carry: {
      enabled: true,
      carries: [],
      drops: [],
      held: [],
      alreadyCarried: [],
      written: [],
      outcomes: [],
      choices: { today: { taskId: 't3', setAside: true, swapWith: ['t4'] }, held: [], ...choices },
    },
    signals: {
      carried: [],
      dropped: [],
      swapOffer: null,
      shortOnTime: false,
      gentleReturn: null,
      notice: line ? 'method' : null,
      line: line
        ? { kind: line.kind, taskId: 't2', date: isoDay(line.from), toTaskId: line.to === undefined ? null : 'tx', toDate: line.to === undefined ? null : isoDay(line.to) }
        : null,
    },
  };
}

test.describe('Method-aware recovery on Today, the Dashboard and Focus (M3.3)', () => {
  test('a let-go day: one line on Today and on the Dashboard', async ({ page }) => {
    const goal = shellWith({ t2: { status: 'pending' } });
    await mockApi(page, { goal, reconcile: methodBody({ kind: 'let_go', from: -1 }) });
    await signIn(page);
    await page.goto('/');

    await expect(stepCard(page).getByText("Yesterday's session didn't happen. Nothing needs making up: the plan carries on as it is.")).toBeVisible();
    await expect(page.getByText(/session didn't happen/)).toHaveCount(1);
    await expect(page.getByText(CALM)).toHaveCount(0);
    await expectCleanAt(page, WIDTHS);

    await page.goto('/dashboard');
    await expect(main(page).getByText('Yesterday slipped past. No catching up needed, just today.')).toBeVisible();
    await expect(page.getByText(CALM)).toHaveCount(0);
    await expectCleanAt(page, WIDTHS);
  });

  test('a continued day: the line, then "Pick up where {Weekday} stopped." in Today and in Focus', async ({ page }) => {
    const steps = JSON.parse(shellGoal().dailyTasks[2].detailedSteps);
    const marked = JSON.stringify([{ ...steps[0], continueFrom: { taskId: 't2', date: isoDay(-1) } }, steps[1]]);
    const goal = shellWith({ t2: { status: 'pending' }, t3: { detailedSteps: marked } });
    await mockApi(page, { goal, reconcile: methodBody({ kind: 'continued', from: -1, to: 0 }) });
    await signIn(page);
    await page.goto('/');

    const card = stepCard(page);
    const pickUp = `Pick up where ${weekday(-1)} stopped.`;
    await expect(card.getByText("Yesterday's session didn't happen. Today's session picks up where you left off.")).toBeVisible();
    await card.getByRole('button', { name: new RegExp(steps[0].title) }).click();
    const first = main(page).getByRole('listitem').filter({ hasText: steps[0].title });
    await expect(first.getByText(pickUp, { exact: true })).toBeVisible();
    await expect(first.getByText(steps[0].instructions, { exact: true })).toBeVisible();
    await expect(page.getByText(CALM)).toHaveCount(0);
    await expectCleanAt(page, WIDTHS);

    await page.goto('/dashboard');
    await expect(main(page).getByText("Yesterday's work picks up again today.")).toBeVisible();

    await page.goto('/');
    await stepCard(page).getByRole('button', { name: 'Start', exact: true }).click();
    const focus = page.getByRole('dialog');
    await expect(focus.getByText(pickUp, { exact: true })).toBeVisible();
    await focus.getByRole('button', { name: /start focused session/i }).click();
    const runner = focus.getByRole('article', { name: 'Current step' });
    await expect(runner.getByText(pickUp, { exact: true })).toBeVisible();
    await expect(runner.getByText(steps[0].instructions, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('an in-order step to next week: one line on Today and on the Dashboard', async ({ page }) => {
    const goal = shellWith({ t1: { status: 'pending' } });
    await mockApi(page, { goal, reconcile: methodBody({ kind: 'next_week', from: -2 }) });
    await signIn(page);
    await page.goto('/');

    await expect(stepCard(page).getByText(`${weekday(-2)}'s session didn't happen. There's no room for it this week, so next week starts with it.`)).toBeVisible();
    await expect(page.getByText(CALM)).toHaveCount(0);
    await expectCleanAt(page, WIDTHS);

    await page.goto('/dashboard');
    await expect(main(page).getByText(`${weekday(-2)} slipped past. Next week starts with it.`)).toBeVisible();
    await expectCleanAt(page, WIDTHS);
  });

  test("the swap list offers only the server's days", async ({ page }) => {
    // t4, t5 and t6 are open practice days later this week; the server allows only t6.
    await mockApi(page, { goal: shellGoal(), reconcile: methodBody(null, { today: { taskId: 't3', setAside: true, swapWith: ['t6'] } }) });
    await signIn(page);
    await page.goto('/');

    await stepCard(page).getByRole('button', { name: 'Swap with another day', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Swap with another day' });
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: `${weekday(3)}: Session 6`, exact: true })).toBeVisible();
    await expectCleanAt(page, WIDTHS);
  });

  test('no swap allowed: only "Set today aside" shows', async ({ page }) => {
    await mockApi(page, { goal: shellGoal(), reconcile: methodBody(null, { today: { taskId: 't3', setAside: true, swapWith: [] } }) });
    await signIn(page);
    await page.goto('/');
    await expect(stepCard(page).getByRole('button', { name: 'Set today aside', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Swap with another day', exact: true })).toHaveCount(0);
  });
});
