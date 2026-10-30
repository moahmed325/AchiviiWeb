import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, expectCleanAt, settled, shellGoal, SHELL_GOAL_TITLE } from './shellFixtures';

const main = (page: Page) => page.locator('main#main');

test.describe('OD-9 States on Today (M5.7)', () => {
  test('goal load failure: shows error alert, does not redirect to onboarding, retry reloads goal', async ({ page }) => {
    // 1. Initial goal load fails with 500
    await mockApi(page, { activeStatus: 500, goal: shellGoal() });
    await signIn(page);
    await page.goto('/');

    // Stays on / (not /onboarding)
    await expect(page).toHaveURL('/');
    const alert = main(page).getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('heading', { level: 1, name: "We couldn't load your goal" })).toBeVisible();
    await expect(alert.getByText('Your plan is safe, but we had trouble reaching Achivii. Check your connection or try again.')).toBeVisible();
    await expect(page.getByText('Choose a pathway')).not.toBeVisible();

    // 2. Mock API route update on retry so active goal loads successfully
    await page.route('http://localhost:5000/api/goal/active', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ activeGoal: shellGoal() }) });
    });
    await alert.getByRole('button', { name: 'Try again' }).click();

    // Today loads
    await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toBeVisible();
  });

  test('rest day: intentional rest messaging, suppressed start button, next step preview, and zero axe violations', async ({ page }, testInfo) => {
    const base = shellGoal();
    const restGoal = {
      ...base,
      dailyTasks: base.dailyTasks.map((t) => (t.id === 't3' ? { ...t, isRestDay: true, title: 'Active Recovery' } : t)),
    };
    await mockApi(page, { goal: restGoal });
    await signIn(page);
    await page.goto('/');

    const stepCard = main(page).locator('section[aria-labelledby="step-heading"]');
    await expect(stepCard.getByText("Today's rest")).toBeVisible();
    await expect(stepCard.getByText("Nothing to do today. Rest is part of the plan: it's when the practice settles in.")).toBeVisible();

    // Start button is suppressed on rest day
    await expect(stepCard.getByRole('button', { name: 'Start' })).toHaveCount(0);
    // Logging the rest is a quiet option
    await expect(stepCard.getByRole('button', { name: 'Log your rest' })).toBeVisible();

    // Next step preview is visible
    await expect(stepCard.getByText('Tomorrow · Thursday')).toBeVisible();
    await expect(stepCard.getByRole('button', { name: "View Thursday's step" })).toBeVisible();

    // Axe & responsive check
    const widths = testInfo.project.name === 'desktop' ? [1440] : [390, 360];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
      await settled(page);
      expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
    }
  });

  test('key session: displays key session badge, without a filler callout (ND-30)', async ({ page }) => {
    const base = shellGoal();
    const keyGoal = {
      ...base,
      dailyTasks: base.dailyTasks.map((t) => (t.id === 't3' ? { ...t, isKeySession: true } : t)),
    };
    await mockApi(page, { goal: keyGoal });
    await signIn(page);
    await page.goto('/');

    const stepCard = main(page).locator('section[aria-labelledby="step-heading"]');
    await expect(stepCard.getByText('Key session')).toBeVisible();
    await expect(stepCard.getByText(/pivotal session/)).toHaveCount(0);
    await expect(stepCard.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test("an older goal's stored test day is an ordinary session: no badge, no check card (no weekly tests)", async ({ page }) => {
    const base = shellGoal();
    const testGoal = {
      ...base,
      roadmapWeeks: [
        {
          weekNumber: 1,
          phase: 'Foundations',
          theme: 'Core architecture',
          test: { type: 'Prototype Demo', instructions: 'Walk a real user through the interactive onboarding prototype.', passIf: 'under 5 minutes' },
        },
      ],
      dailyTasks: base.dailyTasks.map((t) => (t.id === 't3' ? { ...t, isTestDay: true } : t)),
    };
    await mockApi(page, { goal: testGoal });
    await signIn(page);
    await page.goto('/');

    const stepCard = main(page).locator('section[aria-labelledby="step-heading"]');
    await expect(stepCard.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
    await expect(stepCard.getByText('Test day')).toHaveCount(0);
    await expect(stepCard.getByText("Today's check")).toHaveCount(0);
    await expect(stepCard.getByText('Walk a real user through the interactive onboarding prototype.')).toHaveCount(0);
  });

  test('recovery: yesterday left pending shows no generic callout and no punitive copy', async ({ page }) => {
    const base = shellGoal();
    const recoveryGoal = {
      ...base,
      dailyTasks: base.dailyTasks.map((t) => (t.id === 't2' ? { ...t, status: 'pending' as const } : t)),
    };
    await mockApi(page, { goal: recoveryGoal });
    await signIn(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toBeVisible();
    await expect(page.getByText("Yesterday's step wasn't completed")).toHaveCount(0);
    await expect(page.getByText(/didn't happen/)).toHaveCount(0);

    // No punitive copy
    await expect(page.getByText(/missed/i)).toHaveCount(0);
    await expect(page.getByText(/failed/i)).toHaveCount(0);
    await expect(page.getByText(/behind/i)).toHaveCount(0);
  });

  test('miss notice (M3.1): a step carried into today shows one calm line, no overflow at 360-412 px and no axe violations', async ({ page }) => {
    const base = shellGoal();
    const yesterday = base.dailyTasks.find((t) => t.id === 't2')!;
    const today = base.dailyTasks.find((t) => t.id === 't3')!;
    const goal = { ...base, dailyTasks: base.dailyTasks.map((t) => (t.id === 't2' ? { ...t, status: 'pending' as const } : t)) };
    await mockApi(page, {
      goal,
      reconcile: {
        applies: true,
        goalId: base.id,
        asOf: new Date().toISOString(),
        timezone: 'UTC',
        days: [],
        gap: null,
        carry: { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
        signals: {
          carried: [{ fromDate: yesterday.date, fromTaskId: 't2', toDate: today.date, toTaskId: 't3', stepTitle: 'Draft the brief' }],
          dropped: [],
          swapOffer: null,
          shortOnTime: false,
          gentleReturn: null,
          notice: 'carried',
        },
      },
    });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const stepCard = main(page).locator('section[aria-labelledby="step-heading"]');
    const line = "Yesterday's session didn't happen. We moved its most important step into today, so today stays the same length.";
    await expect(stepCard.getByText(line)).toBeVisible();
    await expect(page.getByText(/session didn't happen/)).toHaveCount(1);
    await expect(page.getByText(/missed|failed|behind/i)).toHaveCount(0);

    for (const width of [390, 360, 375, 412]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
      await settled(page);
      expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
    }
  });

  test('a week whose days have all passed shows no review to do by hand (weeks close on their own)', async ({ page }) => {
    const base = shellGoal();
    const today = new Date();
    const pastTasks = base.dailyTasks.map((t, idx) => {
      const pastDate = new Date(today.getTime() - (10 - idx) * 86_400_000);
      return { ...t, date: pastDate.toISOString().slice(0, 10) };
    });
    await mockApi(page, { goal: { ...base, dailyTasks: pastTasks } });
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByText('Review due')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /weekly review/i })).toHaveCount(0);
  });

  test('clamped day 90 / after week 12: shows honest 90-day completion without fabricating tasks', async ({ page }) => {
    const base = shellGoal();
    const pastDate = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const completeGoal = {
      ...base,
      currentWeek: 12,
      targetDate: pastDate,
      dailyTasks: [],
    };
    await mockApi(page, { goal: completeGoal });
    await signIn(page);
    await page.goto('/');

    // Numeral clamped at 90 / 90
    await expect(page.getByLabel('Day 90 of 90')).toBeVisible();
    // Past day 85 an active goal is in the closing stretch (M9.4), which replaced the old "Journey Complete" card.
    await expect(page.getByRole('heading', { level: 2, name: 'Look back and arrive' })).toBeVisible();
    await expect(page.getByText(/The 84 planned practice days are complete/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review 90-day staircase' })).toHaveAttribute('href', '/roadmap');
    // No fabricated step: no practice-day card and no Start.
    await expect(main(page).locator('section[aria-labelledby="step-heading"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  });

  test('offline banner appears when health check fails, and write failure shows visible alert', async ({ page }) => {
    await mockApi(page, { goal: shellGoal(), healthDown: true, taskUpdateStatus: 500 });
    await signIn(page);
    await page.goto('/');

    // Offline banner
    await expect(page.getByText('Achivii is offline. You can view your plan, but changes cannot be saved until you reconnect.')).toBeVisible();

    // Mark complete fails
    await page.getByRole('button', { name: 'Mark complete' }).click();
    const alert = main(page).getByRole('alert');
    await expect(alert).toHaveText("That didn't save. Please check your connection and try again.");
    await expect(page.getByRole('button', { name: 'Mark complete' })).toBeVisible();
  });
});

// M3.4: every Today state at the four phone widths: no horizontal overflow, axe clean after the fade-in, and every
// button in the state's main card at least 44x44 px. The states above check their copy; these check the layout.
test.describe('Every Today state is clean at 360-412 px (M3.4)', () => {
  const withTasks = (changes: Record<string, Record<string, unknown>>) => {
    const base = shellGoal();
    return { ...base, dailyTasks: base.dailyTasks.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)) };
  };

  /** Buttons inside `scope` that are at least 44x44 px. */
  const expectTargets = async (scope: Locator, label: string) => {
    for (const control of await scope.getByRole('button').all()) {
      const box = await control.boundingBox();
      const name = (await control.textContent())?.trim() || (await control.getAttribute('aria-label')) || '';
      expect(box, `${label}: ${name}`).not.toBeNull();
      expect(box!.height, `${label}: ${name} height`).toBeGreaterThanOrEqual(44);
    }
  };

  interface Case {
    name: string;
    goal: Record<string, unknown> | null;
    options?: Parameters<typeof mockApi>[1];
    /** Waits for the state to show. */
    ready: (page: Page) => Promise<void>;
    /** The card whose buttons are measured; omitted for states with none. */
    card?: (page: Page) => Locator;
  }
  const stepCard = (page: Page) => main(page).locator('section[aria-labelledby="step-heading"]');
  const cases: Case[] = [
    { name: 'load error', goal: shellGoal(), options: { activeStatus: 500 }, ready: (page) => expect(main(page).getByRole('alert')).toBeVisible(), card: (page) => main(page).getByRole('alert') },
    { name: 'offline', goal: shellGoal(), options: { healthDown: true }, ready: (page) => expect(page.getByText(/Achivii is offline/)).toBeVisible(), card: stepCard },
    { name: 'no goal', goal: null, ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Choose a pathway' })).toBeVisible() },
    { name: 'ordinary day, to do', goal: shellGoal(), ready: (page) => expect(stepCard(page).getByRole('button', { name: 'Start', exact: true })).toBeVisible(), card: stepCard },
    {
      name: 'ordinary day, done',
      goal: withTasks({ t3: { status: 'completed' } }),
      ready: (page) => expect(stepCard(page).getByText(/^Session \d+ is in the books\.$/)).toBeVisible(),
      card: stepCard,
    },
    { name: 'rest day', goal: withTasks({ t3: { isRestDay: true } }), ready: (page) => expect(stepCard(page).getByText("Today's rest")).toBeVisible(), card: stepCard },
    { name: 'key session', goal: withTasks({ t3: { isKeySession: true } }), ready: (page) => expect(stepCard(page).getByText('Key session')).toBeVisible(), card: stepCard },
    {
      // No weekly tests, section 7: the feel tap after a done session.
      name: 'ordinary day, done, with how it felt',
      goal: withTasks({ t3: { status: 'completed', feel: 'just_right' } }),
      ready: (page) => expect(stepCard(page).getByRole('group', { name: 'How did it feel?' })).toBeVisible(),
      card: stepCard,
    },
    {
      name: 'closing stretch (days 85-90)',
      goal: { ...shellGoal(), currentWeek: 12, targetDate: new Date(Date.now() - 5 * 86_400_000).toISOString(), dailyTasks: [] },
      ready: (page) => expect(page.getByRole('heading', { level: 2, name: 'Look back and arrive' })).toBeVisible(),
      card: (page) => main(page),
    },
    {
      name: 'completed goal',
      goal: { ...shellGoal(), status: 'completed', completedAt: new Date().toISOString() },
      ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'COMPLETE' })).toBeVisible(),
    },
    {
      name: 'completed goal, results tab',
      goal: { ...shellGoal(), status: 'completed', completedAt: new Date().toISOString() },
      ready: async (page) => {
        await page.getByRole('tab', { name: 'Your Results' }).click();
        await expect(page.getByText('Weeks Finished')).toBeVisible();
      },
    },
  ];

  for (const { name, goal, options, ready, card } of cases) {
    test(`${name}`, async ({ page }) => {
      await mockApi(page, { goal, ...options });
      await signIn(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/');
      await ready(page);
      if (card) await expectTargets(card(page), name);
      await expectCleanAt(page);
    });
  }

  test('loading: the skeleton is announced, fits the phone widths and passes axe', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await mockApi(page, { goal: shellGoal() });
    // Registered after mockApi's catch-all, so it runs first and holds the goal request until the gate opens.
    await page.route('http://localhost:5000/api/goal/active', async (route) => {
      await gate;
      await route.fallback();
    });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('status').filter({ hasText: 'Loading your day' })).toBeAttached();
    await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toHaveCount(0);
    await expectCleanAt(page);
    release();
    await expect(page.getByRole('heading', { level: 1, name: SHELL_GOAL_TITLE })).toBeVisible();
  });
});
