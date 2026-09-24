import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { SHELL_GOAL_TITLE, STORED_OUTCOME, axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/** M5.3: Today at `/` for the normal practice day (BP §09), built from the task data, every write through one path. */

const TODAY_TITLE = 'Write the one-page product brief';

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));
const main = (page: Page) => page.locator('main#main');
const stepRegion = (page: Page, title = TODAY_TITLE) => page.getByRole('region', { name: title });

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

const openToday = async (page: Page, options: Parameters<typeof mockApi>[1] = {}) => {
  const calls = await mockApi(page, { goal: shellGoal(), ...options });
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return calls;
};

const top = async (locator: Locator) => (await locator.boundingBox())!.y;

const richSteps = JSON.stringify([
  {
    stepNumber: 1,
    title: 'Sketch the core screen',
    durationMinutes: 20,
    instructions: 'Draw the one screen a user needs first.',
    focusCue: 'One screen only.',
    passMark: 'Clean sketch on paper.',
    output: 'Single-screen wireframe.',
    pitfallToAvoid: 'Coloring early.',
    timing: 'Morning before email',
    resourceTitle: 'Wireframing Basics',
    resourceUrl: 'https://example.com/wireframing',
    resourceWhy: 'Shows minimal layout techniques',
  },
  {
    stepNumber: 2,
    title: 'List the data it needs',
    durationMinutes: 25,
    instructions: 'Write every field that screen shows.',
    focusCue: 'Fields, not features.',
  },
]);

const richGoal = () => {
  const base = shellGoal();
  return {
    ...base,
    dailyTasks: base.dailyTasks.map((t) =>
      t.id === 't3'
        ? {
            ...t,
            whyToday: 'Clear framing prevents wasted development time.',
            detailedSteps: richSteps,
            implementationIntention: 'When: 9:00 AM | Where: Desk | Action: Sketch core screen',
            minimumVersion: {
              stepNumber: 1,
              title: 'Draft thumbnail wireframe',
              durationMinutes: 10,
              instructions: 'Sketch only the core hero block.',
              passMark: 'Hero sketched.',
              focusCue: '',
              pitfallToAvoid: '',
            },
            resourceTitle: 'PRD Template',
            resourceUrl: 'https://example.com/prd',
            resourceType: 'template' as const,
            resourceWhy: 'Saves setup time',
          }
        : t,
    ),
  };
};

test.describe('the practice day', () => {
  test('reads in the BP §09 order: goal, Day N / 90, the step, its duration, Start, the week, the way onward', async ({ page }) => {
    await openToday(page);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(SHELL_GOAL_TITLE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main(page).getByText(`90-day outcome: ${STORED_OUTCOME}`)).toBeVisible();
    const day = page.getByLabel('Day 3 of 90');
    await expect(day).toBeVisible();
    await expect(main(page).getByText('Week 1 · Foundation · Find the smallest product')).toBeVisible();
    const step = page.getByRole('heading', { level: 2, name: TODAY_TITLE });
    const duration = stepRegion(page).getByText('45 min', { exact: true });
    const start = page.getByRole('button', { name: 'Start', exact: true });
    const week = page.getByRole('heading', { level: 2, name: 'This week' });
    const roadmap = main(page).getByRole('link', { name: 'Roadmap' });
    const order = [heading, day, step, duration, start, week, roadmap];
    const ys = [];
    for (const locator of order) ys.push(await top(locator));
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    await expect(stepRegion(page).getByText("Today's step")).toBeVisible();
    await expect(main(page).getByText('2 of 6 practice days done')).toBeVisible();
    // Removed from Today; the shell's Pathways entry opens the same explorer.
    await expect(main(page).getByRole('button', { name: /Explore Goals/ })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Pathways', exact: true })).toHaveCount(0);
  });

  test('Start opens the existing focus mode for this step', async ({ page }) => {
    await openToday(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.getByText('Day 3 of 90 • Focus Mode')).toBeVisible();
    await page.getByTitle('Exit focus mode (Esc)').click();
    await expect(page.getByText('Day 3 of 90 • Focus Mode')).toHaveCount(0);
  });

  test('Complete saves, shows the server result, and is still done after a reload', async ({ page }) => {
    const calls = await openToday(page);
    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark not done' })).toBeVisible();
    await expect(stepRegion(page).getByText('Done', { exact: true })).toBeVisible();
    expect(calls.taskUpdates).toEqual([{ taskId: 't3', body: { status: 'completed' } }]);
    await expect(main(page).getByText('3 of 6 practice days done')).toBeVisible();

    await page.reload();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark not done' })).toBeVisible();
    await stepRegion(page).getByRole('button', { name: 'Mark not done' }).click();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark complete' })).toBeVisible();
    expect(calls.taskUpdates.at(-1)).toEqual({ taskId: 't3', body: { status: 'pending' } });
  });

  test('a saved note goes with the completion and is still there after a reload (R-10)', async ({ page }) => {
    const calls = await openToday(page);
    await stepRegion(page).getByRole('button', { name: 'Notes' }).click();
    const note = stepRegion(page).getByLabel('Notes for this step');
    await note.fill('Brief drafted, pricing still open');
    await stepRegion(page).getByRole('button', { name: 'Save note' }).click();
    await expect(stepRegion(page).getByRole('status')).toHaveText('Saved');
    expect(calls.taskUpdates).toEqual([{ taskId: 't3', body: { notes: 'Brief drafted, pricing still open' } }]);

    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark not done' })).toBeVisible();
    expect(calls.taskUpdates.at(-1)).toEqual({ taskId: 't3', body: { status: 'completed', notes: 'Brief drafted, pricing still open' } });

    await page.reload();
    await stepRegion(page).getByRole('button', { name: 'Notes' }).click();
    await expect(stepRegion(page).getByLabel('Notes for this step')).toHaveValue('Brief drafted, pricing still open');
  });

  test('a note saved on Today survives a completion on the full day view (the kickoff wipe) [dashboard errors expected]', async ({ page }) => {
    const calls = await openToday(page);
    await stepRegion(page).getByRole('button', { name: 'Notes' }).click();
    await stepRegion(page).getByLabel('Notes for this step').fill('Kept across screens');
    await stepRegion(page).getByLabel('Notes for this step').blur();
    await expect(stepRegion(page).getByRole('status')).toHaveText('Saved');
    await main(page).getByRole('link', { name: 'Open full day view' }).click();
    await expect(page).toHaveURL('/dashboard');
    // The full day view shows its Mark Complete once the day's row is opened.
    await page.getByRole('button', { name: /Details$/ }).click();
    await page.getByRole('button', { name: 'Mark Complete', exact: true }).click();
    await expect.poll(() => calls.taskUpdates.length).toBe(2);
    expect(calls.taskUpdates[1]).toEqual({ taskId: 't3', body: { status: 'completed', notes: 'Kept across screens' } });
  });

  test('a failed write says so and leaves the step as it was [network errors expected]', async ({ page }) => {
    await openToday(page, { taskUpdateStatus: 500 });
    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect(stepRegion(page).getByRole('alert')).toHaveText("That didn't save. Try again.");
    await expect(stepRegion(page).getByRole('button', { name: 'Mark complete' })).toBeVisible();
    await expect(stepRegion(page).getByText('Done', { exact: true })).toHaveCount(0);
  });

  test('whyToday is shown when present and omitted when absent', async ({ page }) => {
    // Present
    await openToday(page, { goal: richGoal() });
    await expect(stepRegion(page).getByText('Clear framing prevents wasted development time.')).toBeVisible();

    // Absent
    await openToday(page);
    await expect(stepRegion(page).getByText('Clear framing prevents wasted development time.')).toHaveCount(0);
    await expect(page.getByText(/Follow the deliberate practice steps/)).toHaveCount(0);
  });

  test('the steps reveal shows instructions and focus cues, with pass mark, pitfall and output visible only when stored', async ({ page }) => {
    // 1. When absent in the mock (default shellGoal)
    await openToday(page);
    const reveal = stepRegion(page).getByRole('button', { name: 'Show the 2 steps' });
    await expect(page.getByText('Draw the one screen a user needs first.')).toBeHidden();
    await reveal.click();
    await expect(page.getByText('Draw the one screen a user needs first.')).toBeVisible();
    await expect(page.getByText('One screen only.')).toBeVisible();
    await expect(page.getByText('Fields, not features.')).toBeVisible();
    // Absent fields omit their labels
    await expect(stepRegion(page).getByText(/Done when:/)).toHaveCount(0);
    await expect(stepRegion(page).getByText(/Pitfall:/)).toHaveCount(0);
    await expect(stepRegion(page).getByText(/Output:/)).toHaveCount(0);
    await expect(stepRegion(page).getByText(/Timing:/)).toHaveCount(0);

    // 2. When present in the mock (richGoal)
    await openToday(page, { goal: richGoal() });
    const richReveal = stepRegion(page).getByRole('button', { name: 'Show the 2 steps' });
    await expect(page.getByText('Clean sketch on paper.')).toBeHidden();
    await richReveal.click();
    await expect(page.getByText('Clean sketch on paper.')).toBeVisible();
    await expect(page.getByText('Coloring early.')).toBeVisible();
    await expect(page.getByText('Single-screen wireframe.')).toBeVisible();
    await expect(page.getByText('Morning before email')).toBeVisible();
    const resourceLink = page.getByRole('link', { name: /Wireframing Basics/ });
    await expect(resourceLink).toBeVisible();
    await expect(resourceLink).toHaveAttribute('href', 'https://example.com/wireframing');
    await expect(page.getByText('Shows minimal layout techniques')).toBeVisible();
  });

  test('the 10-minute version is offered closed by default and reveals stored copy on open without a second Start', async ({ page }) => {
    await openToday(page, { goal: richGoal() });

    // Start remains the primary action; 10-minute version is not the default path
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeVisible();

    const minimumButton = stepRegion(page).getByRole('button', { name: 'The 10-minute version' });
    await expect(minimumButton).toBeVisible();
    await expect(minimumButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Draft thumbnail wireframe')).toBeHidden();

    await minimumButton.click();
    await expect(minimumButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Draft thumbnail wireframe')).toBeVisible();
    await expect(page.getByText('Sketch only the core hero block.')).toBeVisible();
    await expect(page.getByText('Hero sketched.')).toBeVisible();

    // Still only one Start button on screen
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(1);
  });

  test("the week glance picks another day, and that day's step is the one shown", async ({ page }) => {
    await openToday(page);
    const days = main(page).getByRole('list').last().getByRole('button');
    await expect(days).toHaveCount(7);
    await days.nth(0).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Session 1' })).toBeVisible();
    await expect(stepRegion(page, 'Session 1').getByText('Done', { exact: true })).toBeVisible();
    await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await days.nth(6).click();
    await expect(stepRegion(page, 'Session 7').getByText('Rest day')).toBeVisible();
  });

  test('the way onward: Roadmap and the full day view [dashboard errors expected]', async ({ page }) => {
    await openToday(page);
    await main(page).getByRole('link', { name: 'Roadmap' }).click();
    await expect(page).toHaveURL('/roadmap');
    await page.goBack();
    await main(page).getByRole('link', { name: 'Open full day view' }).click();
    await expect(page).toHaveURL('/dashboard');
  });

  test('a goal with no tasks this week says so plainly', async ({ page }) => {
    await openToday(page, { goal: { ...shellGoal(), dailyTasks: [] } });
    await expect(page.getByRole('heading', { level: 2, name: 'No step is planned for this week yet.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  });
});

test.describe('layout, keyboard and motion', () => {
  test('no overflow, 44 px targets and no axe violations; Start in the first screen with the thumb', async ({ page }, testInfo) => {
    await openToday(page, { goal: richGoal() });
    const widths = testInfo.project.name === 'desktop' ? [[1440, 900]] : [[390, 844], [360, 740]];
    for (const [width, height] of widths) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() =>
        document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      );
      expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
      const controls = main(page).locator('a, button').filter({ visible: true });
      for (const control of await controls.all()) {
        const box = (await control.boundingBox())!;
        expect(Math.min(box.width, box.height), `${await control.innerText()} at ${width}`).toBeGreaterThanOrEqual(44);
      }
      expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
    }
    if (testInfo.project.name === 'mobile') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.evaluate(() => window.scrollTo(0, 0));
      const start = (await page.getByRole('button', { name: 'Start', exact: true }).boundingBox())!;
      const bar = (await page.locator('[data-shell="bottom-bar"]').boundingBox())!;
      expect(start.y + start.height).toBeLessThanOrEqual(bar.y);
    }
  });

  test('keyboard only: the skip link, then Start, then focus mode', async ({ page }) => {
    await openToday(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(main(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Day 3 of 90 • Focus Mode')).toBeVisible();
  });

  test('with reduced motion, nothing on Today animates and everything is shown', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openToday(page, { goal: richGoal() });
    await stepRegion(page).getByRole('button', { name: 'Show the 2 steps' }).click();
    await expect(page.getByText('Draw the one screen a user needs first.')).toBeVisible();
    await stepRegion(page).getByRole('button', { name: 'The 10-minute version' }).click();
    await expect(page.getByText('Draft thumbnail wireframe')).toBeVisible();
    const durations = await main(page).evaluate((el) =>
      [el, ...el.querySelectorAll('*')].flatMap((node) => {
        const style = getComputedStyle(node);
        return [parseFloat(style.animationDuration) || 0, parseFloat(style.transitionDuration) || 0];
      }),
    );
    for (const d of durations) expect(d).toBeLessThanOrEqual(0.001);
  });
});
