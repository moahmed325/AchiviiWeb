import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, shellGoal, settled } from './shellFixtures';

/**
 * Milestone M8.5: Dedicated Progress Page E2E Specs.
 * Updated for the simplified page (728ea8c, c4518bd): "Right now" (phase, week, day, percent), the journey's phases,
 * and a "Detailed history" disclosure holding week by week, benchmark results and adaptation history.
 * Verifies route navigation, shell integration, early state (Week 1, 0 sessions),
 * mid-journey state (Week 6 with reviews & benchmarks), goal-less & error resilience,
 * touch targets, tabular numerals, reduced motion, zero overflow, and axe accessibility.
 */

const primary = (page: Page) => page.getByRole('navigation', { name: 'Primary' });

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (/errors expected\]/.test(testInfo.title)) return;
  expect(consoleErrors).toEqual([]);
});

const expectTapTargets = async (controls: Locator) => {
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box, await control.innerText()).not.toBeNull();
    expect(Math.min(box!.width, box!.height), await control.innerText()).toBeGreaterThanOrEqual(44);
  }
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The calendar day `offset` days from today, as a date key. Since missed-sessions M1.1b the day number and task dates
 * follow the user's timezone (here the browser's, as the mock user stores none), so fixtures count on the local
 * calendar; UTC dates are a day off around local midnight.
 */
const localDayKey = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** A goal day stored as the app stores it: the local calendar day at 00:00 UTC. */
const storedDay = (offset: number) => `${localDayKey(offset)}T00:00:00.000Z`;

const createEarlyGoal = () => {
  const base = shellGoal();
  const now = new Date();
  return {
    ...base,
    currentWeek: 1,
    startDate: storedDay(0),
    targetDate: storedDay(90),
    roadmapWeeks: [
      {
        id: 'rw-1',
        goalId: base.id,
        weekNumber: 1,
        phase: 'Foundation',
        theme: 'Discovery & Framing',
        objective: 'Establish core scope and user interviews',
        keyMilestone: 'Complete 3 customer discovery calls',
        targetIntensity: 3,
        plannedMinutes: 270,
        status: 'active' as const,
        created_at: now.toISOString(),
        target: { kind: 'deliverable' as const, description: '3 interview synthesis summaries' },
        test: {
          type: 'count' as const,
          instructions: 'Conduct 3 customer discovery interviews',
          passIf: '3 interviews completed and notes logged',
        },
      },
      {
        id: 'rw-2',
        goalId: base.id,
        weekNumber: 2,
        phase: 'Foundation',
        theme: 'Problem Validation',
        objective: 'Validate core pain points',
        keyMilestone: 'Define target criteria',
        targetIntensity: 3,
        plannedMinutes: 270,
        status: 'pending' as const,
        created_at: now.toISOString(),
      },
    ],
    dailyTasks: DAYS.map((dayOfWeek, idx) => ({
      id: `task-w1-${idx + 1}`,
      goalId: base.id,
      weekNumber: 1,
      dayNumber: idx + 1,
      date: localDayKey(idx),
      dayOfWeek,
      title: idx === 6 ? 'Weekly Rest & Review' : `Discovery Session ${idx + 1}`,
      detailedSteps: '[]',
      implementationIntention: '',
      durationMinutes: 45,
      isRestDay: idx === 6,
      status: 'pending' as const,
      created_at: now.toISOString(),
    })),
    weeklyReviews: [],
  };
};

const createMidJourneyGoal = () => {
  const base = shellGoal();
  const now = new Date();
  const elapsedDays = 40;
  const start = new Date(now.getTime() - elapsedDays * 86_400_000);

  const weeks = [
    {
      id: 'rw-w1',
      goalId: base.id,
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Core Posture & Mechanics',
      objective: 'Establish daily practice habit',
      keyMilestone: '5 clean sessions logged',
      targetIntensity: 3,
      plannedMinutes: 225,
      status: 'completed' as const,
      executionScore: 100,
      created_at: start.toISOString(),
      target: { kind: 'deliverable' as const, description: 'Consistent form routine' },
      test: {
        type: 'count' as const,
        instructions: 'Execute 5 continuous practice rounds',
        passIf: '5 rounds unbroken',
      },
      testResult: {
        value: 5,
        unit: 'rounds',
        passed: true,
        note: 'Exceeded target pace and form was rock-solid',
      },
    },
    {
      id: 'rw-w2',
      goalId: base.id,
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Tempo Control',
      objective: 'Build endurance baseline',
      keyMilestone: 'Complete target volume',
      targetIntensity: 3,
      plannedMinutes: 225,
      status: 'completed' as const,
      executionScore: 83,
      created_at: start.toISOString(),
    },
    {
      id: 'rw-w3',
      goalId: base.id,
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Volume Progression',
      objective: 'Increase repetition consistency',
      keyMilestone: 'Maintain clean tempo under load',
      targetIntensity: 3,
      plannedMinutes: 225,
      status: 'completed' as const,
      executionScore: 83,
      created_at: start.toISOString(),
    },
    {
      id: 'rw-w4',
      goalId: base.id,
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Phase Consolidation',
      objective: 'Consolidate fundamental mechanics',
      keyMilestone: 'Benchmark assessment round',
      targetIntensity: 4,
      plannedMinutes: 240,
      status: 'completed' as const,
      executionScore: 67,
      created_at: start.toISOString(),
      target: { kind: 'number' as const, metric: 'Speed', value: 80, unit: 'bpm', direction: 'higher_is_better' as const },
      test: {
        type: 'count' as const,
        instructions: 'Sustain 80 bpm tempo for 4 continuous sets',
        passIf: '4 sets completed at 80 bpm clean',
      },
      testResult: {
        value: 3,
        unit: 'sets',
        passed: false,
        note: 'Reinforcing baseline form before accelerating into Phase 2',
      },
    },
    {
      id: 'rw-w5',
      goalId: base.id,
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Dynamic Acceleration',
      objective: 'Increase tempo safely',
      keyMilestone: 'First high-intensity session',
      targetIntensity: 4,
      plannedMinutes: 240,
      status: 'completed' as const,
      executionScore: 100,
      created_at: start.toISOString(),
    },
    {
      id: 'rw-w6',
      goalId: base.id,
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Sustained Power',
      objective: 'Hold target power output across reps',
      keyMilestone: 'Mid-phase check-in',
      targetIntensity: 4,
      plannedMinutes: 240,
      status: 'active' as const,
      created_at: start.toISOString(),
      test: {
        type: 'duration' as const,
        instructions: 'Sustain 45 min focus tempo without pause',
        passIf: '45 min continuous tempo clean',
      },
    },
  ];

  // Generate 6 weeks of daily tasks (5 active, 2 rest per week)
  const tasks = [];
  for (let w = 1; w <= 6; w++) {
    for (let d = 0; d < 7; d++) {
      const isRest = d === 5 || d === 6;
      const dayNum = (w - 1) * 7 + d + 1;
      const isPast = w < 6 || (w === 6 && d < 3);
      tasks.push({
        id: `t-mid-${w}-${d}`,
        goalId: base.id,
        weekNumber: w,
        dayNumber: dayNum,
        date: localDayKey(dayNum - 1 - elapsedDays),
        dayOfWeek: DAYS[d],
        title: isRest ? 'Active Recovery' : `Practice Session W${w}D${d + 1}`,
        detailedSteps: '[]',
        implementationIntention: '',
        durationMinutes: 45,
        isRestDay: isRest,
        status: isPast && !isRest ? ('completed' as const) : ('pending' as const),
        created_at: start.toISOString(),
      });
    }
  }

  const reviews = [
    {
      id: 'wr-1',
      goalId: base.id,
      weekNumber: 1,
      tasksPlanned: 6,
      tasksCompleted: 6,
      scorePercentage: 100,
      reflection: 'Consistent morning routine helped maintain focus throughout.',
      aiAdaptationInsight: 'Strong initial cadence established. Pacing is calibrated well for baseline building.',
      created_at: new Date(start.getTime() + 7 * 86_400_000).toISOString(),
    },
    {
      id: 'wr-4',
      goalId: base.id,
      weekNumber: 4,
      tasksPlanned: 6,
      tasksCompleted: 4,
      scorePercentage: 67,
      reflection: 'Fatigue showed up mid-week; adapted Friday pace to protect technique.',
      aiAdaptationInsight: 'Phase 1 fundamentals consolidated. Adapted week 5 progression to reinforce endurance.',
      created_at: new Date(start.getTime() + 28 * 86_400_000).toISOString(),
    },
  ];

  return {
    ...base,
    currentWeek: 6,
    startDate: storedDay(-elapsedDays),
    targetDate: storedDay(90 - elapsedDays),
    roadmapWeeks: weeks,
    dailyTasks: tasks,
    weeklyReviews: reviews,
  };
};

/** The "Right now" section, named by the current phase. */
const rightNow = (page: Page) => page.locator('main#main section[aria-labelledby="current-progress"]');

/** The secondary evidence (week by week, benchmarks, adaptation) sits behind one disclosure (progressive depth). */
const openDetailedHistory = async (page: Page) => {
  const toggle = page.getByRole('button', { name: /^Detailed history/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('region', { name: 'Week by week' })).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
};

test.describe('Route Navigation & Shell Integration', () => {
  test('navigates to /progress, renders page header with active goal context, and marks Progress active in shell', async ({
    page,
    isMobile,
  }) => {
    const goal = createEarlyGoal();
    await mockApi(page, { goal });
    await signIn(page);
    await page.goto('/progress');

    // Page header elements: the goal the user chose, the stored outcome beneath it (ND-18), and where they stand
    const main = page.locator('main#main');
    await expect(main).toBeVisible();
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(goal.rawGoal);
    await expect(main.getByText(goal.clarifiedOutcome)).toBeVisible();
    await expect(rightNow(page).getByRole('heading', { level: 2 })).toHaveText('Foundation');
    await expect(rightNow(page).getByText('Week 1 · Day 1', { exact: true })).toBeVisible();

    // Shell navigation active state
    const progressLink = primary(page).getByRole('link', { name: 'Progress' });
    await expect(progressLink).toBeVisible();
    await expect(progressLink).toHaveAttribute('aria-current', 'page');
    await expect(primary(page).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
    await expect(primary(page).getByRole('link', { name: 'Roadmap' })).not.toHaveAttribute('aria-current');

    // Mobile layout has sticky bottom bar, desktop has rail
    if (isMobile) {
      await expect(page.locator('[data-shell="bottom-bar"]')).toBeVisible();
    } else {
      await expect(page.locator('[data-shell="rail"]')).toBeVisible();
    }

    // Navigating between Today, Roadmap, and Progress updates aria-current cleanly
    await primary(page).getByRole('link', { name: 'Today' }).click();
    await expect(page).toHaveURL('/');
    await expect(primary(page).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await expect(primary(page).getByRole('link', { name: 'Progress' })).not.toHaveAttribute('aria-current');

    await primary(page).getByRole('link', { name: 'Progress' }).click();
    await expect(page).toHaveURL('/progress');
    await expect(primary(page).getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('Early Journey State (Week 1, 0 Completed Sessions)', () => {
  test('displays honest 0 metrics, calm orientation copy, serene adaptation empty card, and upcoming benchmarks', async ({
    page,
  }) => {
    const goal = createEarlyGoal();
    await mockApi(page, { goal });
    await signIn(page);
    await page.goto('/progress');

    // Layer 1: "Right now" shows an honest 0 and calm, non-punitive orientation copy
    const now = rightNow(page);
    await expect(now).toBeVisible();
    await expect(now.getByText('0%', { exact: true })).toBeVisible();
    await expect(now.getByRole('progressbar', { name: '0% progress' })).toHaveAttribute('aria-valuenow', '0');
    await expect(now.getByText('Your journey is ready. Start with today’s session.')).toBeVisible();
    await expect(now.getByText(/sessions completed/)).toHaveCount(0);

    // Layer 2: the journey's phases, the first one current
    const journey = page.getByRole('region', { name: 'Your journey' });
    await expect(journey.getByText('Foundation (current phase)')).toBeVisible();
    await expect(journey.getByText('Acceleration (upcoming)')).toBeVisible();
    await expect(journey.getByText('Mastery (upcoming)')).toBeVisible();
    await expect(journey.getByText(/\(completed\)/)).toHaveCount(0);

    await openDetailedHistory(page);

    // Layer 3: week by week, nothing done yet: 0 of 6 practice days
    const weeks = page.getByRole('region', { name: 'Week by week' });
    await expect(weeks).toBeVisible();
    await expect(weeks.getByText('0 of 6 practice days')).toBeVisible();

    // Layer 4: BenchmarkResultsCard shows upcoming badge with pass criteria and instructions preview
    const benchmarks = page.locator('section[aria-labelledby="benchmark-results-heading"]');
    await expect(benchmarks).toBeVisible();
    await expect(benchmarks.getByText('Upcoming')).toBeVisible();
    await expect(benchmarks.getByText('Pass criteria: 3 interviews completed and notes logged')).toBeVisible();
    await expect(benchmarks.getByText('Conduct 3 customer discovery interviews')).toBeVisible();

    // Layer 5: AdaptationHistoryList renders serene early-state card explaining weekly reviews
    const adaptation = page.locator('section[aria-labelledby="adaptation-history-heading"]');
    await expect(adaptation).toBeVisible();
    await expect(adaptation.getByText('Weekly reviews unlock adaptation insights')).toBeVisible();
    await expect(
      adaptation.getByText('At the end of each week, your review reflections and server path adaptations will appear here.'),
    ).toBeVisible();
    // Zero synthetic/fake reviews shown
    await expect(adaptation.getByText(/Your reflection/i)).toHaveCount(0);
  });
});

test.describe('Mid-Journey State (Week 6 with Completed Reviews & Benchmarks)', () => {
  test('displays real execution metrics, phase milestones, recorded benchmark results, and genuine adaptation logs', async ({
    page,
  }) => {
    const goal = createMidJourneyGoal();
    await mockApi(page, { goal });
    await signIn(page);
    await page.goto('/progress');

    const main = page.locator('main#main');
    await expect(main).toBeVisible();

    // Layer 1: where the user stands (week 6 is in Acceleration, as on the Roadmap) and real execution:
    // 28 of the 30 sessions planned to date = 93%
    const now = rightNow(page);
    await expect(now.getByRole('heading', { level: 2 })).toHaveText('Acceleration');
    await expect(now.getByText('Week 6 · Day 41', { exact: true })).toBeVisible();
    await expect(now.getByText('93%', { exact: true })).toBeVisible();
    await expect(now.getByRole('progressbar', { name: '93% progress' })).toHaveAttribute('aria-valuenow', '93');
    await expect(now.getByText('28 practice sessions completed so far.')).toBeVisible();

    // Layer 2: Phase milestones progression
    const phases = page.getByRole('region', { name: 'Your journey' });
    await expect(phases).toBeVisible();
    await expect(phases.getByText('Foundation (completed)')).toBeVisible();
    await expect(phases.getByText('Acceleration (current phase)')).toBeVisible();
    await expect(phases.getByText('Mastery (upcoming)')).toBeVisible();

    await openDetailedHistory(page);

    // Layer 3: week by week execution
    const weeks = page.getByRole('region', { name: 'Week by week' });
    await expect(weeks.getByText('5 of 5 practice days')).toHaveCount(5);
    await expect(weeks.getByText('3 of 5 practice days')).toBeVisible();

    // Layer 4: Benchmark results card with passed and non-punitive unmet badges
    const benchmarks = page.locator('section[aria-labelledby="benchmark-results-heading"]');
    await expect(benchmarks).toBeVisible();

    // Week 1 passed
    await expect(benchmarks.getByText('Benchmark achieved')).toBeVisible();
    await expect(benchmarks.getByText('5 rounds', { exact: true })).toBeVisible();
    await expect(benchmarks.getByText('"Exceeded target pace and form was rock-solid"')).toBeVisible();

    // Week 4 non-punitive unmet benchmark
    await expect(benchmarks.getByText('In progress · Reinforcing')).toBeVisible();
    await expect(benchmarks.getByText('3 sets', { exact: true })).toBeVisible();
    await expect(benchmarks.getByText('"Reinforcing baseline form before accelerating into Phase 2"')).toBeVisible();
    // Zero red/fail shame copy
    await expect(benchmarks.getByText(/failed|punishment|strike|penalty/i)).toHaveCount(0);

    // Week 6 upcoming
    await expect(benchmarks.getByText('Upcoming')).toBeVisible();
    await expect(benchmarks.getByText('Pass criteria: 45 min continuous tempo clean')).toBeVisible();

    // Layer 5: Adaptation history with genuine server insights
    const adaptation = page.locator('section[aria-labelledby="adaptation-history-heading"]');
    await expect(adaptation).toBeVisible();

    // Week 1 entry
    await expect(adaptation.getByText('Week 1')).toBeVisible();
    await expect(adaptation.getByText('Consistent morning routine helped maintain focus throughout.')).toBeVisible();
    await expect(
      adaptation.getByText('Strong initial cadence established. Pacing is calibrated well for baseline building.'),
    ).toBeVisible();

    // Week 4 milestone gate transition
    await expect(adaptation.getByText('Week 4')).toBeVisible();
    await expect(adaptation.getByText('Phase milestone reached')).toBeVisible();
    await expect(adaptation.getByText('Fatigue showed up mid-week; adapted Friday pace to protect technique.')).toBeVisible();
    await expect(
      adaptation.getByText('Phase 1 fundamentals consolidated. Adapted week 5 progression to reinforce endurance.'),
    ).toBeVisible();
  });
});

test.describe('Resilience & Goal-less States', () => {
  test('unauthenticated access redirects cleanly to /login', async ({ page }) => {
    // No auth token set
    await page.goto('/progress');
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated user with no active goal displays calm empty state with onboarding CTA', async ({ page }) => {
    await mockApi(page, { goal: null });
    await signIn(page);
    await page.goto('/progress');

    const main = page.locator('main#main');
    await expect(main).toBeVisible();
    await expect(main.getByRole('heading', { level: 1, name: 'No active journey' })).toBeVisible();
    await expect(main.getByText('Create a journey to start tracking your progress.')).toBeVisible();

    const cta = main.getByRole('link', { name: 'Create journey' });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', '/onboarding');
  });

  test('simulated goalLoadFailed renders accessible alert and recovers on retry [network errors expected]', async ({
    page,
  }) => {
    const goal = createEarlyGoal();
    let shouldFail = true;

    await mockApi(page, { goal });

    // Override active goal endpoint to simulate initial failure then recovery
    await page.route('**/api/goal/active', async (route) => {
      if (shouldFail) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Database temporarily unavailable' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ activeGoal: goal }),
        });
      }
    });

    await signIn(page);
    await page.goto('/progress');

    // Error alert rendered with role="alert", reassuring rather than alarming
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('heading', { level: 1, name: 'Your progress is safe.' })).toBeVisible();
    await expect(alert.getByText("We couldn't reach Achivii right now.")).toBeVisible();

    const retryBtn = alert.getByRole('button', { name: 'Try again' });
    await expect(retryBtn).toBeVisible();

    // Backend recovers: click retry
    shouldFail = false;
    await retryBtn.click();

    // Page recovers and displays progress content
    await expect(alert).not.toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: goal.rawGoal })).toBeVisible();
    await expect(rightNow(page)).toBeVisible();
  });
});

test.describe('Accessibility & Responsive Sweeps', () => {
  const viewports = [
    { name: 'Desktop (1440px)', width: 1440, height: 900 },
    { name: 'Mobile iPhone (390px)', width: 390, height: 844 },
    { name: 'Android Compact (360px)', width: 360, height: 800 },
  ];

  for (const vp of viewports) {
    test(`renders cleanly with 0 axe violations, zero overflow, and 44px tap targets on ${vp.name}`, async ({
      page,
    }) => {
      const goal = createMidJourneyGoal();
      await mockApi(page, { goal });
      await signIn(page);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/progress');
      await expect(page.locator('main#main')).toBeVisible();
      await page.getByRole('button', { name: /^Detailed history/ }).click();
      await expect(page.getByRole('region', { name: 'Adaptation history' })).toBeVisible();
      await settled(page);

      // 1. Zero horizontal overflow, with the detailed history open
      const overflow = await documentOverflow(page);
      expect(overflow, `horizontal overflow at ${vp.width}px`).toBeLessThanOrEqual(1);

      // 2. Tabular numerals present on metric figures to prevent jitter
      const tabularElements = page.locator('.tabular-nums');
      expect(await tabularElements.count()).toBeGreaterThan(0);

      // 3. Minimum 44x44px tap targets on interactive elements
      const interactive = primary(page).locator('a, button').filter({ visible: true });
      await expectTapTargets(interactive);
      await expectTapTargets(page.locator('main#main button').filter({ visible: true }));

      // 4. Zero Axe-core violations
      const violations = await axeViolations(page);
      expect(violations, `axe violations at ${vp.width}px`).toEqual([]);
    });
  }

  test('with reduced motion, content renders immediately without animation traps', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const goal = createMidJourneyGoal();
    await mockApi(page, { goal });
    await signIn(page);
    await page.goto('/progress');

    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: goal.rawGoal })).toBeVisible();
    await expect(rightNow(page)).toBeVisible();

    // The progress fill does not animate, and opening the detailed history shows it at once
    const fill = rightNow(page).getByRole('progressbar').locator('div');
    const fillDuration = await fill.evaluate((el) => parseFloat(window.getComputedStyle(el).transitionDuration));
    expect(fillDuration).toBeLessThanOrEqual(0.01);

    await page.getByRole('button', { name: /^Detailed history/ }).click();
    await expect(page.locator('section[aria-labelledby="benchmark-results-heading"]')).toBeVisible();
    await expect(page.locator('section[aria-labelledby="adaptation-history-heading"]')).toBeVisible();
    const lingering = await page.evaluate(() =>
      document
        .getAnimations()
        .map((animation) => animation.effect?.getComputedTiming())
        .filter((timing) => !timing || Number(timing.duration) > 0.01 || timing.iterations !== 1).length,
    );
    expect(lingering).toBe(0);
  });
});
