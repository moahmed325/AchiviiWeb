import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, settled, shellGoal } from './shellFixtures';

// Missed sessions M3.2: the gentle-return day and the short-on-time offer on Today (UX-2, UX-4, AC-10).
// M3.3: the swap offer, setting today aside and swapping with another day (AC-2, AC-6). Signals and the switch
// (`carry.enabled`) come from mocked responses; MISSED_SESSIONS_CARRY_ENABLED is a backend setting and untouched.

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
    // Axe measures contrast: let the fade-in finish first, as todayStates.spec.ts does.
    await settled(page);
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

/** A plan v2 reconcile body with the switch on (`carry.enabled`), as the backend answers once ND-15 is turned on. */
function switchedOn(signals: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    applies: true,
    goalId: 'g-shell',
    asOf: new Date().toISOString(),
    timezone: 'UTC',
    days: [],
    gap: null,
    carry: { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
    signals: { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null, ...signals },
    ...extra,
  };
}

const isoDay = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const weekday = (offset: number) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${isoDay(offset)}T00:00:00Z`).getUTCDay()];
const CALM = /missed|failed|behind|\bwhy\b/i;

/** The shell goal with changes to some days (t1, t2 done; t3 today; t4-t6 later; t7 rest). */
function shellWith(changes: Record<string, Record<string, unknown>>) {
  const base = shellGoal();
  return { ...base, dailyTasks: base.dailyTasks.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)) };
}

test.describe('Missed sessions on Today (M3.3)', () => {
  test('with the switch off, nothing new appears', async ({ page }) => {
    const goal = shellWith({ t2: { status: 'pending', isKeySession: true } });
    const offer = switchedOn({
      notice: 'swap_offer',
      swapOffer: { missedTaskId: 't2', missedDate: isoDay(-1), receivingTaskId: 't3', receivingDate: isoDay(0), offerUntil: '' },
    });
    await mockApi(page, { goal, reconcile: { ...offer, carry: { ...offer.carry, enabled: false } } });
    await signIn(page);
    await page.goto('/');
    await expect(stepCard(page).getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    for (const name of ['Swap the days', 'Just move its main step', 'Set today aside', 'Swap with another day']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
  });

  test('a swap offer answered by "Swap the days"', async ({ page }) => {
    const goal = shellWith({ t2: { status: 'pending', isKeySession: true, title: 'Interview three users' } });
    const base = shellGoal().dailyTasks;
    const swapped = shellWith({
      t2: { status: 'pending', title: 'Write the one-page product brief' },
      t3: { title: 'Interview three users', isKeySession: true },
    });
    const calls = await mockApi(page, {
      goal,
      reconcile: switchedOn({
        notice: 'swap_offer',
        swapOffer: { missedTaskId: 't2', missedDate: isoDay(-1), receivingTaskId: 't3', receivingDate: isoDay(0), offerUntil: '' },
      }),
      swap: { body: switchedOn(), goal: swapped },
    });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const card = stepCard(page);
    await expect(card.getByText("Yesterday's key session didn't happen. Do it today instead?")).toBeVisible();
    await expect(page.getByText(CALM)).toHaveCount(0);
    await expectTouchTarget(page, 'Swap the days');
    await expectTouchTarget(page, 'Just move its main step');
    await expectCleanAt(page, [390, 375, 360, 412]);
    await page.setViewportSize({ width: 390, height: 844 });

    await card.getByRole('button', { name: 'Swap the days', exact: true }).click();
    await expect(main(page).getByRole('heading', { name: 'Interview three users' })).toBeVisible();
    await expect(page.getByText(/key session didn't happen/)).toHaveCount(0);
    expect(calls.planActions).toEqual([
      { action: 'swap', taskId: 't2', body: { withTaskId: 't3', expected: { t2: base[1].detailedSteps, t3: base[2].detailedSteps } } },
    ]);
  });

  test('setting today aside (carried)', async ({ page }) => {
    const goal = shellGoal();
    const steps = JSON.parse(goal.dailyTasks[3].detailedSteps);
    const after = shellWith({
      t4: { detailedSteps: JSON.stringify([{ ...steps[0], carriedFrom: { taskId: 't3', date: isoDay(0), replaced: [steps[0]] } }, steps[1]]) },
    });
    const calls = await mockApi(page, {
      goal,
      reconcile: switchedOn(),
      markMissed: {
        body: switchedOn({
          notice: 'carried',
          carried: [{ fromDate: isoDay(0), fromTaskId: 't3', toDate: isoDay(1), toTaskId: 't4', stepTitle: steps[0].title }],
        }),
        goal: after,
      },
    });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const card = stepCard(page);
    const trigger = card.getByRole('button', { name: 'Set today aside', exact: true });
    await expectTouchTarget(page, 'Set today aside');
    await expectTouchTarget(page, 'Swap with another day');

    // The dialog: Escape closes it and focus returns.
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: "Set today's session aside?" });
    await expect(dialog.getByText('Nothing gets longer.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(calls.planActions).toEqual([]);

    await trigger.click();
    for (const name of ['Keep today', 'Set it aside']) {
      const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }
    await expectCleanAt(page, [390, 375, 360, 412]);
    await page.setViewportSize({ width: 390, height: 844 });
    await dialog.getByRole('button', { name: 'Set it aside', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(
      card.getByText(`Today's session is set aside. We moved its most important step to ${weekday(1)}, so that day stays the same length.`),
    ).toBeVisible();
    await expect(card.getByRole('button', { name: 'Set today aside', exact: true })).toHaveCount(0);
    await expect(page.getByText(CALM)).toHaveCount(0);
    expect(calls.planActions).toEqual([{ action: 'mark-missed', taskId: 't3', body: null }]);
    await expectCleanAt(page, [390, 375, 360, 412]);
  });

  test('swapping with another day', async ({ page }) => {
    const goal = shellWith({ t5: { isTestDay: true } });
    const base = shellGoal().dailyTasks;
    const after = shellWith({ t3: { title: 'Session 4' }, t4: { title: 'Write the one-page product brief' }, t5: { isTestDay: true } });
    const calls = await mockApi(page, { goal, reconcile: switchedOn(), swap: { body: switchedOn(), goal: after } });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const trigger = stepCard(page).getByRole('button', { name: 'Swap with another day', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Swap with another day' });
    // Thursday and Saturday are open; Friday is the test day; Sunday is rest.
    await expect(dialog.getByRole('listitem')).toHaveText([`${weekday(1)}: Session 4`, `${weekday(3)}: Session 6`]);
    for (const item of await dialog.getByRole('listitem').getByRole('button').all()) {
      const box = await item.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await expectCleanAt(page, [390, 375, 360, 412]);
    await page.setViewportSize({ width: 390, height: 844 });

    await dialog.getByRole('button', { name: `${weekday(1)}: Session 4` }).click();
    await expect(dialog).toHaveCount(0);
    await expect(main(page).getByRole('heading', { name: 'Session 4' })).toBeVisible();
    expect(calls.planActions).toEqual([
      { action: 'swap', taskId: 't3', body: { withTaskId: 't4', expected: { t3: base[2].detailedSteps, t4: base[3].detailedSteps } } },
    ]);
  });
});
