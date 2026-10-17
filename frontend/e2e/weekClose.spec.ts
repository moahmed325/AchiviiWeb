import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, settled, shellGoal } from './shellFixtures';

// Weekly update M1.2b (RULE-8, RULE-9, RULE-17, WU-14, WU-28, WU-31): the automatic week close as the app shows it,
// with POST /api/goal/close-week mocked (mockApi's `closeWeek`). Runs on the desktop and mobile projects.
// EVIDENCE=1 also saves the screenshots for docs/features/weekly-update/milestones/m1.2b-evidence/.

const CARD = "Did you do last week's test?";
const CARD_LINE = 'Log your result to shape next week.';
const READY = 'Getting your next week ready…';
const FAILED = "Couldn't get your next week ready. Please try again.";
const INSIGHT = 'Next week is ready. Your targets stay as planned.';
const TEST = { type: 'deliverable_check', instructions: 'Share the one-page brief with one person who might use it.', passIf: 'one person reads it and replies' };

/** Week 1, still open, with its test not logged. */
function before() {
  const base = shellGoal();
  return { ...base, roadmapWeeks: base.roadmapWeeks.map((w) => ({ ...w, test: TEST, testResult: null })) };
}

/** The same goal after the automatic close: week 1 closed by `auto` with the neutral line, week 2 open. */
function after() {
  const base = shellGoal();
  const w1 = base.roadmapWeeks[0];
  return {
    ...base,
    currentWeek: 2,
    roadmapWeeks: [
      { ...w1, test: TEST, testResult: null, status: 'completed', closedBy: 'auto', closedAt: new Date().toISOString(), closeLineSeenAt: null },
      { ...w1, id: 'w2', weekNumber: 2, theme: 'Build the first screen', status: 'active' },
    ],
    dailyTasks: base.dailyTasks.map((t) => ({ ...t, id: `w2-${t.id}`, weekNumber: 2, dayNumber: t.dayNumber + 7, status: 'pending' })),
    weeklyReviews: [{ id: 'r1', goalId: base.id, weekNumber: 1, tasksPlanned: 6, tasksCompleted: 2, scorePercentage: 33, reflection: '', aiAdaptationInsight: INSIGHT }],
  };
}

const evidence = async (page: Page, info: TestInfo, name: string) => {
  if (!process.env.EVIDENCE) return;
  await settled(page);
  await page.screenshot({ path: `../docs/features/weekly-update/milestones/m1.2b-evidence/${name}-${info.project.name}.png`, scale: 'css' });
};

test.describe('The week close in the app (M1.2b)', () => {
  test('the test card, Skip, then the line once', async ({ page }, info) => {
    const calls = await mockApi(page, {
      goal: before(),
      closeWeek: { check: { due: true, weekNumber: 1, testLogged: false }, goalAfterClose: after() },
    });
    await signIn(page);
    await page.goto('/');

    const card = page.getByRole('dialog', { name: CARD });
    await expect(card).toBeVisible();
    await expect(card.getByText(CARD_LINE)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Log result' })).toBeVisible();
    // Today shows only the card; reconcile waits for the answer (RULE-17).
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
    expect(calls.closeWeek).toEqual(['check']);
    expect(calls.reconcile).toBe(0);
    await settled(page);
    expect(await axeViolations(page), 'axe with the card open').toEqual([]);
    await evidence(page, info, 'test-card');

    await card.getByRole('button', { name: 'Skip' }).click();
    await expect(card).toBeHidden();
    const line = page.getByText(INSIGHT);
    await expect(line).toBeVisible();
    await expect(page.locator('main header').first()).toContainText('Week 2');
    expect(calls.closeWeek).toEqual(['check', 'close']);
    expect(calls.reconcile).toBe(1);
    expect(calls.testResults).toEqual([]);
    await evidence(page, info, 'line');

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(line).toBeHidden();
    expect(calls.closeLineSeen).toEqual([1]);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(INSIGHT)).toHaveCount(0);
  });

  test('Log result logs the test, then closes the week with it', async ({ page }) => {
    const calls = await mockApi(page, {
      goal: before(),
      closeWeek: { check: { due: true, weekNumber: 1, testLogged: false }, goalAfterClose: after() },
    });
    await signIn(page);
    await page.goto('/');

    await page.getByRole('dialog', { name: CARD }).getByRole('button', { name: 'Log result' }).click();
    const entry = page.getByRole('dialog', { name: "Log last week's test" });
    await entry.getByLabel('Your result').fill('Sent to Sam, who replied');
    await entry.getByRole('button', { name: 'Save result' }).click();
    await expect(page.getByText(INSIGHT)).toBeVisible();
    expect(calls.testResults).toEqual([{ weekNumber: 1, body: { value: 'Sent to Sam, who replied', passed: true } }]);
    expect(calls.closeWeek).toEqual(['check', 'close']);
  });

  test('"Getting your next week ready…" while the week is written', async ({ page }, info) => {
    const calls = await mockApi(page, {
      goal: before(),
      closeWeek: { check: { due: true, weekNumber: 1, testLogged: true }, goalAfterClose: after(), closeDelayMs: 2_000 },
    });
    await signIn(page);
    await page.goto('/');

    await expect(page.getByText(READY)).toBeVisible();
    await evidence(page, info, 'getting-ready');
    await expect(page.getByText(INSIGHT)).toBeVisible();
    await expect(page.getByText(READY)).toHaveCount(0);
    expect(calls.closeWeek).toEqual(['check', 'close']);
  });

  test('a failed close shows the plan as stored and Try again', async ({ page }, info) => {
    const calls = await mockApi(page, {
      goal: before(),
      closeWeek: { check: { due: true, weekNumber: 1, testLogged: true }, goalAfterClose: after(), closeStatus: 503 },
    });
    await signIn(page);
    await page.goto('/');

    const alert = page.getByRole('alert').filter({ hasText: FAILED });
    await expect(alert).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Write the one-page product brief' })).toBeVisible();
    expect(calls.reconcile).toBe(1);
    await evidence(page, info, 'close-failed');
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect.poll(() => calls.closeWeek).toEqual(['check', 'close', 'check', 'close']);
    await expect(page.getByRole('alert').filter({ hasText: FAILED })).toBeVisible();
    expect(calls.reconcile).toBe(2);
  });

  test('switch off: nothing changes', async ({ page }) => {
    const calls = await mockApi(page, { goal: before() });
    await signIn(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2, name: 'Write the one-page product brief' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(READY)).toHaveCount(0);
    expect(calls.closeWeek).toEqual(['check']);
    expect(calls.reconcile).toBe(1);
  });

  test('a review that lost to an automatic close keeps its reflection', async ({ page }, info) => {
    const done = before();
    done.dailyTasks = done.dailyTasks.map((t) => ({ ...t, status: t.isRestDay ? 'pending' : 'completed' }));
    await mockApi(page, { goal: done });
    let reflection: unknown = null;
    await page.route('**/api/goal/weeks/1/review', (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'This week has already been reviewed.', reason: 'week_closed' }) })
    );
    await page.route('**/api/goal/weeks/1/reflection', (route) => {
      reflection = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reflection: 'Kept it small' }) });
    });
    await signIn(page);
    await page.goto('/');

    await page.getByRole('button', { name: 'Start weekly review' }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('What worked? What could be better?').fill('Kept it small');
    await modal.getByRole('button', { name: 'Start Week 2' }).click();
    await expect(modal.getByText('This week had already closed. Your reflection is saved.')).toBeVisible();
    expect(reflection).toEqual({ reflection: 'Kept it small' });
    await evidence(page, info, 'lost-race');
  });

  // Weekly update M1.4 (RULE-13, RULE-14, section 6, WU-33 (4)): back 4 days after week 2 should have started, the
  // close moves the plan 4 days, so week 2 starts today; Today shows the line with the moved end date and today's step.
  test('a 4-day gap: the plan moves, the line names the new end date, today is week 2 day 1', async ({ page }, info) => {
    const iso = (offset: number) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const moved = after();
    // Week 2 starts today (plan day 8), so "Day 8 of 90": the end is 83 days on, and day 90 the day before it.
    const goal = {
      ...moved,
      startDate: `${iso(-7)}T00:00:00.000Z`,
      targetDate: `${iso(83)}T00:00:00.000Z`,
      dailyTasks: moved.dailyTasks.map((t, index) => ({ ...t, date: iso(index), title: index === 0 ? 'Write the one-page product brief' : t.title })),
      weeklyReviews: moved.weeklyReviews.map((r) => ({ ...r, aiAdaptationInsight: 'Your next week starts today. Your plan now ends on {date}.' })),
    };
    await mockApi(page, { goal: before(), closeWeek: { check: { due: true, weekNumber: 1, testLogged: true }, goalAfterClose: goal } });
    await signIn(page);
    await page.goto('/');

    const end = await page.evaluate((key) => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC', ...(y === new Date().getFullYear() ? {} : { year: 'numeric' }) });
    }, iso(82));
    await expect(page.getByText(`Your next week starts today. Your plan now ends on ${end}.`)).toBeVisible();
    await expect(page.getByText('{date}', { exact: false })).toHaveCount(0);
    await expect(page.getByLabel('Day 8 of 90')).toBeVisible();
    const step = page.getByRole('region', { name: 'Write the one-page product brief' });
    await expect(step.getByText("Today's step")).toBeVisible();
    await settled(page);
    expect(await axeViolations(page), 'axe with the moved-plan line').toEqual([]);
    if (process.env.EVIDENCE) {
      await page.screenshot({ path: `../docs/features/weekly-update/milestones/m1.4-evidence/moved-line-${info.project.name}.png`, scale: 'css' });
    }
  });
});
