import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { axeViolations, documentOverflow, shellGoal, SHELL_GOAL_TITLE } from './shellFixtures';

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));
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
    await expect(stepCard.getByText('Rest day')).toBeVisible();
    await expect(
      stepCard.getByText('Rest is where adaptation happens. Take today to recover so you can execute your next session at full intensity.')
    ).toBeVisible();

    // Start button is suppressed on rest day
    await expect(stepCard.getByRole('button', { name: 'Start' })).toHaveCount(0);
    // Log recovery button is present
    await expect(stepCard.getByRole('button', { name: 'Log recovery complete' })).toBeVisible();

    // Next step preview is visible
    await expect(stepCard.getByText('Tomorrow · Thursday')).toBeVisible();
    await expect(stepCard.getByRole('button', { name: "View Thursday's step" })).toBeVisible();

    // Axe & responsive check
    const widths = testInfo.project.name === 'desktop' ? [1440] : [390, 360];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
      expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
    }
  });

  test('key session: displays key session badge and pivotal session callout', async ({ page }) => {
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
    await expect(
      stepCard.getByText('This is your pivotal session for Week 1. Focus on execution quality and adherence.')
    ).toBeVisible();
    await expect(stepCard.getByRole('button', { name: 'Start' })).toBeVisible();
  });

  test('test day: displays weekly benchmark card with instructions and pass mark without fake inputs', async ({ page }) => {
    const base = shellGoal();
    const testGoal = {
      ...base,
      roadmapWeeks: [
        {
          weekNumber: 1,
          phase: 'Foundations',
          theme: 'Core architecture',
          test: {
            type: 'Prototype Demo',
            instructions: 'Walk a real user through the interactive onboarding prototype.',
            passIf: 'user completes the flow in under 5 minutes without guidance',
          },
        },
      ],
      dailyTasks: base.dailyTasks.map((t) => (t.id === 't3' ? { ...t, isTestDay: true } : t)),
    };
    await mockApi(page, { goal: testGoal });
    await signIn(page);
    await page.goto('/');

    const stepCard = main(page).locator('section[aria-labelledby="step-heading"]');
    await expect(stepCard.getByText('Test day')).toBeVisible();
    await expect(stepCard.getByText('Prototype Demo Benchmark')).toBeVisible();
    await expect(stepCard.getByText('Walk a real user through the interactive onboarding prototype.')).toBeVisible();
    await expect(stepCard.getByText('Pass mark:')).toBeVisible();
    await expect(stepCard.getByText('Pass if user completes the flow in under 5 minutes without guidance.')).toBeVisible();

    // Zero fake score inputs
    await expect(page.locator('input[type="range"]')).toHaveCount(0);
    await expect(page.locator('input[name="score"]')).toHaveCount(0);
  });

  test('recovery: uncompleted yesterday task displays encouraging recovery guidance without punitive copy', async ({ page }) => {
    const base = shellGoal();
    const recoveryGoal = {
      ...base,
      dailyTasks: base.dailyTasks.map((t) => (t.id === 't2' ? { ...t, status: 'pending' as const } : t)),
    };
    await mockApi(page, { goal: recoveryGoal });
    await signIn(page);
    await page.goto('/');

    await expect(page.getByText("Yesterday's step wasn't completed")).toBeVisible();
    await expect(
      page.getByText("Here's how we can recover. Don't try to double up or rush. Focus entirely on today's step and keep your momentum forward.")
    ).toBeVisible();

    // No punitive copy
    await expect(page.getByText(/missed/i)).toHaveCount(0);
    await expect(page.getByText(/failed/i)).toHaveCount(0);
    await expect(page.getByText(/behind/i)).toHaveCount(0);
  });

  test('review due: when all week tasks are in the past, renders prominent review due card', async ({ page }) => {
    const base = shellGoal();
    const today = new Date();
    const pastTasks = base.dailyTasks.map((t, idx) => {
      const pastDate = new Date(today.getTime() - (10 - idx) * 86_400_000);
      return { ...t, date: pastDate.toISOString().slice(0, 10) };
    });
    const reviewGoal = {
      ...base,
      dailyTasks: pastTasks,
    };
    await mockApi(page, { goal: reviewGoal });
    await signIn(page);
    await page.goto('/');

    const reviewSection = page.locator('section[aria-labelledby="review-due-heading"]');
    await expect(reviewSection).toBeVisible();
    await expect(reviewSection.getByText('Review due')).toBeVisible();
    await expect(reviewSection.getByRole('heading', { level: 2, name: 'Week 1 is ready for review' })).toBeVisible();
    await expect(reviewSection.getByRole('link', { name: 'Start weekly review' })).toHaveAttribute('href', '/dashboard');
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
    await expect(page.getByRole('heading', { level: 2, name: '90-Day Journey Complete' })).toBeVisible();
    await expect(page.getByText('You have completed the 90-day deliberate practice path for this goal.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review 90-day roadmap' })).toHaveAttribute('href', '/roadmap');
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
