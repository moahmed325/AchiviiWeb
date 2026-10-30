import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { documentOverflow, settled, shellGoal } from './shellFixtures';

// Weekly update M2.1 (RULE-19, WU-43, requirements 7, 8, 10): a run10k goal's week 2 is a light week. The Roadmap
// shows the week's target as the next check. Desktop and mobile.
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

  test('the Roadmap shows a light week\'s target as the next check', async ({ page }, info) => {
    await mockApi(page, { goal: lightWeekGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    // ND-33: this week's details are open on the Roadmap; earlier weeks' are folded.
    const thisWeek = page.locator('li[aria-current="step"]');
    await expect(thisWeek.getByText(NEXT_CHECK)).toBeVisible();
    await expect(page.getByText(/Done as written/)).toHaveCount(0);
    await thisWeek.getByText(NEXT_CHECK).scrollIntoViewIfNeeded();
    await evidence(page, info, 'roadmap-next-check');
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0);
  });
});
