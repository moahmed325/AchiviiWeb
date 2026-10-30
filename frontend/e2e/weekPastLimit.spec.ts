import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { baseline } from './onboardingFlow';
import { SHELL_GOAL_TITLE, axeViolations, settled, shellGoal } from './shellFixtures';

// Weekly update M1.5b (RULE-15, WU-37 to WU-40): a break past the limit as the app shows it, with POST
// /api/goal/close-week mocked (mockApi's `closeWeek`, which refuses a close without the choice as the server does). Runs on
// the desktop and mobile projects. EVIDENCE=1 also saves the screenshots for
// docs/features/weekly-update/milestones/m1.5b-evidence/.

const KEEP_CARD = 'This break is longer than your plan can move. Start a fresh 12-week plan, or keep going with this one.';
const FINAL_CARD = "Your plan's dates have passed. Start a fresh 12-week plan, or do your final week now.";
const KEEP_LINE = 'Welcome back. Your plan picks up at week 6 and now ends on {date}.';
const TODAY_STEP = 'Write the one-page product brief';

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Week 1 still open, its days 6 weeks ago: past the limit. */
function before() {
  const base = shellGoal();
  return { ...base, dailyTasks: base.dailyTasks.map((t, index) => ({ ...t, date: isoDay(index - 47) })) };
}

/** After "Keep going": week 1 closed with the line, weeks 2 to 5 jumped, week 6 open with today's step. */
function after() {
  const base = shellGoal();
  const w1 = base.roadmapWeeks[0];
  const weekRow = (weekNumber: number, over: Record<string, unknown>) => ({ ...w1, id: `w${weekNumber}`, weekNumber, theme: `Week ${weekNumber} focus`, phase: weekNumber <= 4 ? 'Foundation' : 'Acceleration', ...over });
  return {
    ...base,
    currentWeek: 6,
    startDate: `${isoDay(-37)}T00:00:00.000Z`,
    targetDate: `${isoDay(47)}T00:00:00.000Z`,
    roadmapWeeks: [
      { ...w1, status: 'completed', closedBy: 'auto', closedAt: new Date().toISOString(), closeLineSeenAt: null },
      ...[2, 3, 4, 5].map((n) => weekRow(n, { status: 'completed', closedBy: 'jumped', jumped: true, closedAt: new Date().toISOString() })),
      weekRow(6, { status: 'active', theme: 'Ship the first screen' }),
    ],
    dailyTasks: base.dailyTasks.map((t) => ({ ...t, id: `w6-${t.id}`, weekNumber: 6, dayNumber: t.dayNumber + 35, status: 'pending' })),
    weeklyReviews: [{ id: 'r1', goalId: base.id, weekNumber: 1, tasksPlanned: 6, tasksCompleted: 6, scorePercentage: 100, reflection: '', aiAdaptationInsight: KEEP_LINE }],
  };
}

const CHECK = { due: true, weekNumber: 1, testLogged: false, break: true, choice: 'keep_going' };

const evidence = async (page: Page, info: TestInfo, name: string) => {
  if (!process.env.EVIDENCE) return;
  await settled(page);
  await page.screenshot({ path: `../docs/features/weekly-update/milestones/m1.5b-evidence/${name}-${info.project.name}.png`, scale: 'css' });
};

test.describe('Past the limit (M1.5b)', () => {
  test('away 6 weeks: the card, "Keep going", then the line and today\'s step; jumped weeks show "Paused"', async ({ page }, info) => {
    const calls = await mockApi(page, { goal: before(), closeWeek: { check: CHECK, goalAfterClose: after(), requireChoice: 'keep_going' } });
    await signIn(page);
    await page.goto('/');

    const card = page.getByRole('region', { name: 'Welcome back.' });
    await expect(card).toBeVisible();
    await expect(card.getByText(KEEP_CARD)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Start a fresh plan' })).toBeVisible();
    // Only the card: no Today, no test card, nothing closed, reconcile waits.
    await expect(page.getByRole('dialog', { name: "Did you do last week's test?" })).toHaveCount(0);
    expect(calls.closeWeek).toEqual(['check']);
    expect(calls.reconcile).toBe(0);
    await settled(page);
    expect(await axeViolations(page), 'axe with the choice card').toEqual([]);
    await evidence(page, info, 'card-keep-going');

    await card.getByRole('button', { name: 'Keep going' }).click();
    await expect(page.getByText(/^Welcome back\. Your plan picks up at week 6 and now ends on (?!\{date\}).+\.$/)).toBeVisible();
    await expect(page.getByText(TODAY_STEP).first()).toBeVisible();
    await expect(page.locator('main header').first()).toContainText('Week 6');
    expect(calls.closeWeek).toEqual(['check', 'close']);
    expect(calls.closeChoices).toEqual(['keep_going']);
    expect(calls.reconcile).toBe(1);
    await evidence(page, info, 'after-keep-going');

    // ND-31: progress is part of the Roadmap; its week by week names each jumped week "Paused", never done.
    await page.goto('/progress');
    await expect(page).toHaveURL('/roadmap');
    const weeks = page.getByRole('region', { name: 'Week by week' });
    await expect(weeks.getByText('Paused', { exact: true })).toHaveCount(4);
    await weeks.scrollIntoViewIfNeeded();
    await evidence(page, info, 'paused-roadmap');
  });

  test('"Start a fresh plan" opens goal creation with the text; nothing closes; back on Today the card shows again', async ({ page }) => {
    const calls = await mockApi(page, {
      goal: before(),
      clarify: baseline.customClarify,
      closeWeek: { check: CHECK, goalAfterClose: after(), requireChoice: 'keep_going' },
    });
    await signIn(page);
    await page.goto('/');

    await page.getByRole('region', { name: 'Welcome back.' }).getByRole('button', { name: 'Start a fresh plan' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    // As a goal switch with a draft does: goal creation starts on the goal's own text (WU-24: the text only).
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    expect(calls.clarify[0]).toMatchObject({ rawGoal: SHELL_GOAL_TITLE });
    expect(calls.closeWeek).toEqual(['check']);

    await page.goBack();
    await expect(page.getByRole('region', { name: 'Welcome back.' })).toBeVisible();
    expect(calls.closeWeek).toEqual(['check']);
    expect(calls.reconcile).toBe(0);
  });

  test('a goal screen sends them to the card; nothing closes', async ({ page }) => {
    const calls = await mockApi(page, { goal: before(), closeWeek: { check: CHECK, goalAfterClose: after(), requireChoice: 'keep_going' } });
    await signIn(page);
    await page.goto('/roadmap');
    await expect(page.getByRole('region', { name: 'Welcome back.' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    expect(calls.closeWeek).toEqual(['check']);
  });

  test('past week 12 the card offers the final week', async ({ page }, info) => {
    const calls = await mockApi(page, {
      goal: before(),
      closeWeek: { check: { ...CHECK, choice: 'final_week' }, goalAfterClose: after(), requireChoice: 'final_week' },
    });
    await signIn(page);
    await page.goto('/');
    const card = page.getByRole('region', { name: 'Welcome back.' });
    await expect(card.getByText(FINAL_CARD)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Keep going' })).toHaveCount(0);
    await settled(page);
    expect(await axeViolations(page), 'axe with the final-week card').toEqual([]);
    await evidence(page, info, 'card-final-week');
    await card.getByRole('button', { name: 'Do my final week' }).click();
    await expect(card).toBeHidden();
    expect(calls.closeChoices).toEqual(['final_week']);
  });
});
