import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { SHELL_GOAL_TITLE, STORED_OUTCOME, axeViolations, documentOverflow, settled, shellGoal } from './shellFixtures';

/** M5.3: Today at `/` for the normal practice day (BP §09), built from the task data, every write through one path. */

const TODAY_TITLE = 'Write the one-page product brief';

const main = (page: Page) => page.locator('main#main');
const stepRegion = (page: Page, title = TODAY_TITLE) => page.getByRole('region', { name: title });
/** Focus mode is a full-screen dialog (M5.5) that opens on the step's own title. */
const focusMode = (page: Page) => page.getByRole('dialog');

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

/** ND-28: the rich day's extras share one row, named by what is in it. */
const MORE = 'The 10-minute version · When and where · Resource';

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
  test('reads in order: Day N, the goal, the step, its duration, its steps, Start, the week (ND-28)', async ({ page }) => {
    await openToday(page);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toHaveText(SHELL_GOAL_TITLE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // ND-18, ND-28: the stored outcome is not shown on Today.
    await expect(main(page).getByText(STORED_OUTCOME)).toHaveCount(0);
    const day = page.getByLabel('Day 3 of 90');
    await expect(day).toBeVisible();
    await expect(main(page).getByText('Day 3 of 90 · Week 1 · Foundation')).toBeVisible();
    const step = page.getByRole('heading', { level: 2, name: TODAY_TITLE });
    const duration = stepRegion(page).getByText('45 min · 2 steps', { exact: true });
    const steps = stepRegion(page).getByRole('list', { name: 'Steps in this session' });
    const start = page.getByRole('button', { name: 'Start', exact: true });
    const week = page.getByRole('heading', { level: 2, name: 'This week' });
    const order = [day, heading, step, duration, steps, start, week];
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
    await expect(focusMode(page).getByRole('heading', { level: 2, name: TODAY_TITLE })).toBeVisible();
    await expect(focusMode(page).getByRole('button', { name: 'Start focused session' })).toBeVisible();
    await focusMode(page).getByTitle('Exit focus mode (Esc)').click();
    await expect(focusMode(page)).toHaveCount(0);
  });

  test('Complete saves, shows the server result, and is still done after a reload', async ({ page }) => {
    const calls = await openToday(page);
    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark not done' })).toBeVisible();
    await expect(stepRegion(page).getByText('Done', { exact: true })).toBeVisible();
    await expect(stepRegion(page).getByText('Session 3 is in the books.')).toBeVisible();
    await expect(stepRegion(page).getByText('Tomorrow · Thursday')).toBeVisible();
    expect(calls.taskUpdates).toEqual([{ taskId: 't3', body: { status: 'completed' } }]);
    await expect(main(page).getByText('3 of 6 practice days done')).toBeVisible();

    await page.reload();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark not done' })).toBeVisible();
    await expect(stepRegion(page).getByText('Session 3 is in the books.')).toBeVisible();
    await expect(stepRegion(page).getByText('Tomorrow · Thursday')).toBeVisible();
    await stepRegion(page).getByRole('button', { name: 'Mark not done' }).click();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark complete' })).toBeVisible();
    await expect(stepRegion(page).getByText('Session 3 is in the books.')).toHaveCount(0);
    await expect(stepRegion(page).getByText('Tomorrow · Thursday')).toHaveCount(0);
    expect(calls.taskUpdates.at(-1)).toEqual({ taskId: 't3', body: { status: 'pending' } });
  });

  test('focus wins and practice notes: displayed cleanly, preserved on save, with next step preview navigation (R1-R4)', async ({ page }) => {
    const goal = shellGoal();
    goal.dailyTasks[2].notes = 'Legs felt stiff\n• Focus win: Hit 180 spm cadence\n• Focus win: Kept steady breathing';
    await openToday(page, { goal });

    // Open Notes disclosure
    await stepRegion(page).getByRole('button', { name: 'Notes' }).click();

    // Verify structured focus wins
    await expect(stepRegion(page).getByText('Focus wins logged')).toBeVisible();
    await expect(stepRegion(page).getByText('Hit 180 spm cadence')).toBeVisible();
    await expect(stepRegion(page).getByText('Kept steady breathing')).toBeVisible();

    // Verify freeform textarea
    const note = stepRegion(page).getByLabel('Notes for this step');
    await expect(note).toHaveValue('Legs felt stiff');

    // Complete the step
    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect(stepRegion(page).getByText('Session 3 is in the books.')).toBeVisible();

    // Next step preview shows Tomorrow · Thursday and allows clicking to view
    await expect(stepRegion(page).getByText('Tomorrow · Thursday')).toBeVisible();
    await stepRegion(page).getByRole('button', { name: "View Thursday's step" }).click();
    await expect(page.getByRole('region', { name: 'Session 4' })).toBeVisible();

    // Axe scan passes on completed screen, once the fade-in has finished
    await settled(page);
    expect(await axeViolations(page)).toEqual([]);
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

  test('a note saved on Today is preserved when marked complete', async ({ page }) => {
    const calls = await openToday(page);
    await stepRegion(page).getByRole('button', { name: 'Notes' }).click();
    await stepRegion(page).getByLabel('Notes for this step').fill('Kept across screens');
    await stepRegion(page).getByLabel('Notes for this step').blur();
    await expect(stepRegion(page).getByRole('status')).toHaveText('Saved');
    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect.poll(() => calls.taskUpdates.length).toBe(2);
    expect(calls.taskUpdates[1]).toEqual({ taskId: 't3', body: { status: 'completed', notes: 'Kept across screens' } });
  });

  test('a failed write says so and leaves the step as it was [network errors expected]', async ({ page }) => {
    await openToday(page, { taskUpdateStatus: 500 });
    await stepRegion(page).getByRole('button', { name: 'Mark complete' }).click();
    await expect(stepRegion(page).getByRole('alert')).toHaveText("That didn't save. Please check your connection and try again.");
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
    // ND-28: the steps are listed; each opens in place.
    await expect(page.getByText('Draw the one screen a user needs first.')).toBeHidden();
    await stepRegion(page).getByRole('button', { name: /Sketch the core screen/ }).click();
    await stepRegion(page).getByRole('button', { name: /List the data it needs/ }).click();
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
    await expect(page.getByText('Clean sketch on paper.')).toBeHidden();
    for (const button of await stepRegion(page).getByRole('list', { name: 'Steps in this session' }).getByRole('button').all()) await button.click();
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

    const minimumButton = stepRegion(page).getByRole('button', { name: MORE });
    await expect(minimumButton).toBeVisible();
    await expect(minimumButton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Draft thumbnail wireframe')).toBeHidden();

    await minimumButton.click();
    await expect(stepRegion(page).getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Draft thumbnail wireframe')).toBeVisible();
    await expect(page.getByText('Sketch only the core hero block.')).toBeVisible();
    await expect(page.getByText('Hero sketched.')).toBeVisible();

    // Still only one Start button on screen
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(1);
  });

  test("the week glance picks another day, and that day's step is the one shown", async ({ page }) => {
    await openToday(page);
    // ND-28: the week's day marks are the buttons.
    const days = main(page).getByRole('list').last().getByRole('button');
    await expect(days).toHaveCount(7);
    await days.nth(0).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Session 1' })).toBeVisible();
    await expect(stepRegion(page, 'Session 1').getByText('Done', { exact: true })).toBeVisible();
    await expect(days.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await days.nth(6).click();
    await expect(stepRegion(page, 'Session 7').getByText("Sunday's rest")).toBeVisible();
    await stepRegion(page, 'Session 7').getByRole('button', { name: 'Back to today' }).click();
    await expect(page.getByRole('heading', { level: 2, name: TODAY_TITLE })).toBeVisible();
  });

  test('no footer of links (the app navigation has them) and no full day view link (ND-28, OD-3)', async ({ page }) => {
    await openToday(page);
    await expect(main(page).getByRole('navigation')).toHaveCount(0);
    await expect(main(page).getByRole('link', { name: 'Open full day view' })).toHaveCount(0);
  });

  test('navigating to /dashboard directly shows the overview, not Today, and it writes nothing (ND-19)', async ({ page }) => {
    await openToday(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(main(page).getByRole('heading', { level: 2, name: TODAY_TITLE })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toHaveCount(0);
    await expect(main(page).getByRole('button', { name: /Mark complete|Start/ })).toHaveCount(0);
  });

  test("the Dashboard's Start opens the same step's session on Today in one tap (ND-19, ND-27)", async ({ page }) => {
    await openToday(page);
    await page.goto('/dashboard');
    await main(page).getByRole('link', { name: 'Start session' }).click();
    await expect(page).toHaveURL('/');
    const focus = page.getByRole('dialog');
    await expect(focus.getByRole('heading', { name: TODAY_TITLE })).toBeVisible();
    await expect(focus.getByRole('button', { name: /start focused session/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(focus).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toBeVisible();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark complete' })).toBeVisible();
    // Used once: a reload does not open it again.
    await page.reload();
    await expect(stepRegion(page).getByRole('button', { name: 'Mark complete' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a goal with no tasks this week says so plainly', async ({ page }) => {
    await openToday(page, { goal: { ...shellGoal(), dailyTasks: [] } });
    await expect(page.getByRole('heading', { level: 2, name: 'No step is planned for this week yet.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  });
});

/**
 * Weekly update M3.3b (AC-4, AC-5): week 2 starts with a re-test of week 1's test, after two hard weeks, so Today shows
 * the line, the result entry and the daily-time card. The server's `retest` and `dailyTimeCheck` are mocked.
 */
const TWO_HARD_WEEKS = 'The last two weeks were hard to fit in. This week starts with a re-test to find your real level.';
const EVIDENCE = '../docs/features/weekly-update/milestones/m3.3b-evidence';

const retestGoal = () => {
  const base = shellGoal();
  const week1 = {
    ...base.roadmapWeeks[0],
    status: 'completed',
    target: { kind: 'number', metric: 'Pages written', value: 3, unit: 'pages', direction: 'higher_is_better' },
    test: { type: 'deliverable', instructions: 'Write three pages of the product brief in one sitting.', passIf: 'three pages written' },
    testResult: { value: 1, unit: 'pages', passed: false },
  };
  const retestStep = { stepNumber: 1, title: 'Re-test: Write three pages of the product brief in one sitting', durationMinutes: 20, instructions: 'Write the pages.' };
  return {
    ...base,
    currentWeek: 2,
    routine: JSON.stringify({ dailyMinutes: 60 }),
    roadmapWeeks: [week1, { ...base.roadmapWeeks[0], id: 'w2', weekNumber: 2, status: 'active', retestOfWeek: 1 }],
    dailyTasks: base.dailyTasks.map((t) => ({
      ...t,
      weekNumber: 2,
      dayNumber: t.dayNumber + 7,
      detailedSteps: t.id === 't3' ? JSON.stringify([retestStep, ...JSON.parse(t.detailedSteps)]) : t.detailedSteps,
    })),
    // The server names the re-test day (M3.3b review): t3, today.
    retest: { ofWeek: 1, reason: 'two_hard_weeks', logged: false, taskId: 't3', date: base.dailyTasks.find((t) => t.id === 't3')!.date },
    dailyTimeCheck: { minutes: 60, shorter: [30, 45] },
  };
};

test.describe('re-test weeks (weekly update M3.3b)', () => {
  test('the re-test line, its result entry, and the daily-time card with a shorter choice', async ({ page }, testInfo) => {
    const calls = await openToday(page, { goal: retestGoal() });
    // Screenshots for the milestone's evidence only when asked (EVIDENCE=1), so a normal run writes nothing into docs.
    const shot = async (name: string) => {
      if (process.env.EVIDENCE === '1') await page.screenshot({ path: `${EVIDENCE}/${name}-${testInfo.project.name}.png`, scale: 'css' });
    };

    // The line, as a status, and the entry on the re-test day.
    const line = main(page).getByRole('status').filter({ hasText: TWO_HARD_WEEKS });
    await expect(line).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
    await line.scrollIntoViewIfNeeded();
    await settled(page);
    await shot('retest-line');

    // Log the re-test: stored on week 1 (the re-tested week); the line and the entry go.
    await page.getByRole('button', { name: 'Log re-test result' }).click();
    const dialog = page.getByRole('dialog', { name: 'Log re-test result' });
    await expect(dialog.getByText('Write three pages of the product brief in one sitting.')).toBeVisible();
    await dialog.getByLabel('Your result').fill('3');
    await settled(page);
    await shot('retest-dialog');
    await dialog.getByRole('button', { name: 'Save result' }).click();
    await expect(dialog).toHaveCount(0);
    expect(calls.testResults.map((r) => r.weekNumber)).toEqual([1]);
    await expect(line).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log re-test result' })).toHaveCount(0);

    // The daily-time card: Make it shorter, then 45 min.
    const card = page.getByRole('region', { name: 'Does 60 minutes a day still work?' });
    await card.scrollIntoViewIfNeeded();
    await expect(card.getByRole('button', { name: 'Keep 60 minutes' })).toBeVisible();
    await settled(page);
    await shot('daily-time-card');
    await card.getByRole('button', { name: 'Make it shorter' }).click();
    await expect(card.getByRole('button', { name: '30 min' })).toBeVisible();
    await shot('daily-time-shorter');
    await card.getByRole('button', { name: '45 min' }).click();
    const changed = page.getByRole('status').filter({ hasText: 'From next week, your sessions are 45 minutes.' });
    await expect(changed).toBeVisible();
    await expect(card).toHaveCount(0);
    expect(calls.dailyTime).toEqual([45]);
    await shot('daily-time-changed');
    expect(await documentOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('layout, keyboard and motion', () => {
  test('no overflow, 44 px targets and no axe violations; Start in the first screen with the thumb', async ({ page }, testInfo) => {
    await openToday(page, { goal: richGoal() });
    const widths = testInfo.project.name === 'desktop' ? [[1440, 900]] : [[390, 844], [360, 740]];
    for (const [width, height] of widths) {
      await page.setViewportSize({ width, height });
      await settled(page);
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

  test('keyboard only: the skip link, then the steps, then Start, then focus mode', async ({ page }) => {
    await openToday(page);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(main(page)).toBeFocused();
    // ND-28: the session's two steps come first; each opens in place.
    await page.keyboard.press('Tab');
    await expect(stepRegion(page).getByRole('button', { name: /Sketch the core screen/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(focusMode(page).getByRole('heading', { level: 2, name: TODAY_TITLE })).toBeVisible();
  });

  test('with reduced motion, nothing on Today animates and everything is shown', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openToday(page, { goal: richGoal() });
    await stepRegion(page).getByRole('button', { name: /Sketch the core screen/ }).click();
    await expect(page.getByText('Draw the one screen a user needs first.')).toBeVisible();
    await stepRegion(page).getByRole('button', { name: MORE }).click();
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

/**
 * Checkpoints M2 (RULE-7, RULE-11, AC-5, AC-9): after the week 4 close, Today shows the checkpoint card first; accepting
 * says so, and the Roadmap shows the day-90 line under week 12. The server's `checkpoint` is mocked.
 */
const CHECKPOINT_EVIDENCE = '../docs/features/checkpoints/milestones/m2-evidence';

test.describe('checkpoints (M2)', () => {
  test('the week 4 card, accepting the realistic target, and the day-90 line', async ({ page }, testInfo) => {
    const goal = { ...shellGoal(), checkpoint: { week: 4, kind: 'lower', target: '10 km', offered: '6 km', goal: '10 km', last: false, toFullGoal: false }, dayNinetyLine: null };
    const calls = await openToday(page, { goal });
    const shot = async (name: string) => {
      if (process.env.EVIDENCE === '1') await page.screenshot({ path: `${CHECKPOINT_EVIDENCE}/${name}-${testInfo.project.name}.png`, scale: 'css' });
    };

    const card = page.getByRole('region', { name: 'A check on your pace' });
    await expect(card.getByText("At this pace you'll reach about 6 km by day 90. Your day-90 target is 10 km.")).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await settled(page);
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    await shot('checkpoint-card');

    await card.getByRole('button', { name: 'Aim for 6 km' }).click();
    await expect(main(page).getByRole('status').filter({ hasText: 'Your day-90 target is now 6 km.' })).toBeVisible();
    await expect(card).toHaveCount(0);
    expect(calls.checkpoints).toEqual([{ week: 4, answer: 'accept' }]);
    await settled(page);
    await shot('checkpoint-accepted');
  });
});
