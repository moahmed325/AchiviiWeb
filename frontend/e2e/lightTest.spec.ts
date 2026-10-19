import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, settled, shellGoal } from './shellFixtures';

// Weekly update M2.1 (RULE-19, WU-43, requirements 7, 8, 10): a run10k goal's week 2 is a light week. Its review logs
// the light test with "I did it", and the Roadmap shows the week's target as the next check. Desktop and mobile.
// EVIDENCE=1 also saves the screenshots for docs/features/weekly-update/milestones/m2.1-evidence/.

const TARGET = { kind: 'number' as const, metric: '10K time', value: 65, unit: 'minutes', direction: 'lower_is_better' as const };
const LIGHT_TEST = {
  type: 'timer' as const,
  instructions: "Run this week's long run as written, at an easy pace you could talk at. Note the distance, the time and how it felt.",
  passIf: 'Done as written',
  light: true,
};
const NEXT_CHECK = 'Next check, week 4: 10K time: 65 minutes or less';

/** A run10k goal in week 2 (a light week), with every week-2 day in the past, so its review is due. */
function lightWeekGoal() {
  const base = shellGoal();
  const today = Date.now();
  const w1 = base.roadmapWeeks[0];
  return {
    ...base,
    rawGoal: 'Run a 10K',
    currentWeek: 2,
    roadmapWeeks: [
      { ...w1, status: 'completed', target: TARGET, test: LIGHT_TEST, testResult: { value: 'Done', passed: true } },
      { ...w1, id: 'w2', weekNumber: 2, theme: 'Easy miles', status: 'active', target: TARGET, test: LIGHT_TEST, testResult: null },
    ],
    dailyTasks: base.dailyTasks.map((t, index) => ({
      ...t,
      id: `w2-${t.id}`,
      weekNumber: 2,
      dayNumber: t.dayNumber + 7,
      date: new Date(today - (10 - index) * 86_400_000).toISOString().slice(0, 10),
      status: index < 5 ? ('completed' as const) : ('pending' as const),
    })),
  };
}

const evidence = async (page: Page, info: TestInfo, name: string) => {
  if (!process.env.EVIDENCE) return;
  await settled(page);
  await page.screenshot({ path: `../docs/features/weekly-update/milestones/m2.1-evidence/${name}-${info.project.name}.png`, scale: 'css' });
};

test.describe('Light weekly tests (M2.1)', () => {
  test("a run10k goal's week-2 review logs the light test with \"I did it\"", async ({ page }, info) => {
    const goal = lightWeekGoal();
    let body: { reflection?: string; testResult?: unknown } | null = null;
    await mockApi(page, { goal });
    await page.route('**/api/goal/weeks/2/review', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          review: { id: 'rev-w2', goalId: goal.id, weekNumber: 2, tasksPlanned: 6, tasksCompleted: 5, scorePercentage: 83, reflection: 'Steady.', aiAdaptationInsight: 'Next week is ready.', created_at: '' },
          scorePercentage: 83,
          nextWeekNumber: 3,
          nextWeekTasks: [],
          testResult: { value: 'Done', passed: true, note: 'Legs felt fresh' },
        }),
      });
    });
    await signIn(page);
    await page.goto('/');

    await page.locator('section[aria-labelledby="review-due-heading"]').getByRole('button', { name: 'Start weekly review' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { level: 2, name: 'Week 2 Review' })).toBeVisible();
    await expect(dialog.getByText(NEXT_CHECK).first()).toBeVisible();
    await expect(dialog.getByText('Light test', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Your result')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Met target' })).toHaveCount(0);

    await dialog.getByLabel(/Note/).fill('Legs felt fresh');
    const didIt = dialog.getByRole('button', { name: 'I did it' });
    expect(Math.round((await didIt.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(44);
    await didIt.click();
    await expect(didIt).toHaveAttribute('aria-pressed', 'true');
    await didIt.scrollIntoViewIfNeeded();
    await evidence(page, info, 'review-light-entry');
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0);
    expect(await axeViolations(page)).toEqual([]);

    await dialog.getByPlaceholder(/Morning sessions went well/i).fill('Steady.');
    await dialog.getByRole('button', { name: 'Start Week 3' }).click();
    await expect(dialog.getByText('Week 3 has been adapted')).toBeVisible();
    expect(body).toEqual({ reflection: 'Steady.', testResult: { value: 'Done', passed: true, note: 'Legs felt fresh' } });
    await expect(dialog.getByTestId('adaptation-light-result')).toContainText('Done');
    await expect(dialog.getByText('Target Met')).toHaveCount(0);
  });

  test('the Roadmap shows a light week\'s target as the next check', async ({ page }, info) => {
    await mockApi(page, { goal: lightWeekGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await expect(page.getByText(NEXT_CHECK).first()).toBeVisible();
    await expect(page.getByText(/Done as written/)).toHaveCount(0);
    await page.getByText(NEXT_CHECK).first().scrollIntoViewIfNeeded();
    await evidence(page, info, 'roadmap-next-check');
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0);
  });
});
