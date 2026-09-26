import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/**
 * Milestone M7.2: Review Flow UI E2E Specs.
 * Verifies weekly review modal opening from Today, analytical score presentation,
 * reflection capture, non-punitive feedback copy, 503 retry resilience,
 * 44px tap targets, zero horizontal overflow, and zero axe accessibility violations.
 */

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

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

const createReviewGoal = () => {
  const base = shellGoal();
  const today = new Date();
  // Move all week 1 tasks into the past so review is due
  const pastTasks = base.dailyTasks.map((t, idx) => {
    const pastDate = new Date(today.getTime() - (10 - idx) * 86_400_000);
    return {
      ...t,
      date: pastDate.toISOString().slice(0, 10),
      status: idx < 5 ? ('completed' as const) : ('pending' as const),
    };
  });

  return {
    ...base,
    currentWeek: 1,
    roadmapWeeks: [
      {
        id: 'rw-1',
        goalId: base.id,
        weekNumber: 1,
        phase: 'Foundation',
        theme: 'Form & Consistency',
        objective: 'Establish reliable daily baseline',
        keyMilestone: 'Complete 5 sessions',
        targetIntensity: 3,
        plannedMinutes: 180,
        status: 'active' as const,
        created_at: '',
        target: { kind: 'deliverable' as const, description: 'First working milestone deliverable' },
        test: {
          type: 'count' as const,
          instructions: 'Execute 5 continuous practice rounds',
          passIf: '5 rounds complete',
        },
      },
    ],
    dailyTasks: pastTasks,
  };
};

test.describe('Weekly Review Flow (M7.2)', () => {
  test('opens review modal, displays analytical metrics, and passes accessibility checks', async ({ page }, testInfo) => {
    const reviewGoal = createReviewGoal();
    await mockApi(page, { goal: reviewGoal });
    await signIn(page);
    await page.goto('/');

    const reviewSection = page.locator('section[aria-labelledby="review-due-heading"]');
    await expect(reviewSection).toBeVisible();

    const startBtn = reviewSection.getByRole('button', { name: 'Start weekly review' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Dialog is visible with proper heading hierarchy
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Week 1 Review' })).toBeVisible();

    // Analytical metrics and non-punitive copy
    await expect(dialog.getByText('This week')).toBeVisible();
    await expect(dialog.getByText('83%')).toBeVisible();
    await expect(dialog.getByText('5 of 6 practice sessions completed')).toBeVisible();
    await expect(dialog.getByText('Great week! Next week will build on this momentum.')).toBeVisible();
    await expect(dialog.getByText('Focus')).toBeVisible();
    await expect(dialog.getByText('Form & Consistency')).toBeVisible();
    await expect(dialog.getByText('Target')).toBeVisible();
    await expect(dialog.getByText('First working milestone deliverable')).toBeVisible();
    await expect(dialog.getByText('Weekly test')).toBeVisible();
    await expect(dialog.getByText('Execute 5 continuous practice rounds')).toBeVisible();

    // Reflection input field
    const textarea = dialog.getByPlaceholder(/Morning sessions went well/i);
    await expect(textarea).toBeVisible();

    // Action buttons meet touch target guidelines (min-h-[44px])
    const submitBtn = dialog.getByRole('button', { name: 'Start Week 2' });
    const cancelBtn = dialog.getByRole('button', { name: 'Cancel' });
    await expect(submitBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    const submitBox = await submitBtn.boundingBox();
    const cancelBox = await cancelBtn.boundingBox();
    expect(Math.round(submitBox?.height ?? 0)).toBeGreaterThanOrEqual(44);
    expect(Math.round(cancelBox?.height ?? 0)).toBeGreaterThanOrEqual(44);

    // Responsive and Axe accessibility checks
    const widths = testInfo.project.name === 'desktop' ? [1440] : [390, 360];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
      expect(await axeViolations(page), `axe at ${width}`).toEqual([]);
    }
  });

  test('submits reflection, advances week, and closes modal', async ({ page }) => {
    const reviewGoal = createReviewGoal();
    let reviewSubmitted = false;

    await mockApi(page, { goal: reviewGoal });

    await page.route('**/api/goal/weeks/*/review', async (route) => {
      const data = route.request().postDataJSON();
      expect(data.reflection).toBe('Solid week of deliberate focus.');
      reviewSubmitted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          review: {
            id: 'rev-w1',
            goalId: reviewGoal.id,
            weekNumber: 1,
            tasksPlanned: 6,
            tasksCompleted: 5,
            scorePercentage: 83,
            reflection: data.reflection,
            aiAdaptationInsight: 'Building steady pacing.',
            created_at: '',
          },
          scorePercentage: 83,
          nextWeekNumber: 2,
          nextWeekTasks: [
            {
              id: 't-w2-1',
              goalId: reviewGoal.id,
              weekNumber: 2,
              dayNumber: 8,
              date: new Date().toISOString().slice(0, 10),
              dayOfWeek: 'Monday',
              title: 'Week 2 kick-off practice',
              status: 'pending',
              durationMinutes: 45,
              slotTime: '09:00',
              created_at: '',
            },
          ],
        }),
      });
    });

    await signIn(page);
    await page.goto('/');

    const reviewSection = page.locator('section[aria-labelledby="review-due-heading"]');
    await reviewSection.getByRole('button', { name: 'Start weekly review' }).click();

    const dialog = page.getByRole('dialog');
    const textarea = dialog.getByPlaceholder(/Morning sessions went well/i);
    await textarea.fill('Solid week of deliberate focus.');

    const submitBtn = dialog.getByRole('button', { name: 'Start Week 2' });
    await submitBtn.click();

    // Modal transitions to Adaptation Moment (M7.3)
    await expect(dialog.getByText('Week 2 has been adapted')).toBeVisible();
    await expect(dialog.getByText('Building steady pacing.')).toBeVisible();

    // User clicks Continue to Today
    const continueBtn = dialog.getByRole('button', { name: 'Continue to Today' });
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Modal closes upon continuing
    await expect(dialog).not.toBeVisible();
    expect(reviewSubmitted).toBe(true);
  });

  test('handles 503 review failure gracefully: preserves reflection, shows error alert, and allows retry [network errors expected]', async ({ page }) => {
    const reviewGoal = createReviewGoal();
    let attempts = 0;

    await mockApi(page, { goal: reviewGoal });

    await page.route('**/api/goal/weeks/*/review', async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: "Couldn't write next week right now. This week is unchanged; please try again.",
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            review: {
              id: 'rev-w1',
              goalId: reviewGoal.id,
              weekNumber: 1,
              tasksPlanned: 6,
              tasksCompleted: 5,
              scorePercentage: 83,
              reflection: 'Testing error recovery flow.',
              aiAdaptationInsight: 'Recovered cleanly and generated next week.',
              created_at: '',
            },
            scorePercentage: 83,
            nextWeekNumber: 2,
            nextWeekTasks: [],
          }),
        });
      }
    });

    await signIn(page);
    await page.goto('/');

    const reviewSection = page.locator('section[aria-labelledby="review-due-heading"]');
    await reviewSection.getByRole('button', { name: 'Start weekly review' }).click();

    const dialog = page.getByRole('dialog');
    const textarea = dialog.getByPlaceholder(/Morning sessions went well/i);
    await textarea.fill('Testing error recovery flow.');

    const submitBtn = dialog.getByRole('button', { name: 'Start Week 2' });
    await submitBtn.click();

    // Alert rendered and reflection preserved
    const alert = dialog.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Couldn't write next week right now. This week is unchanged; please try again.");
    await expect(textarea).toHaveValue('Testing error recovery flow.');

    // Button offers retry
    const retryBtn = dialog.getByRole('button', { name: 'Try again' });
    await expect(retryBtn).toBeVisible();

    // Clicking retry now succeeds and transitions to adaptation
    await retryBtn.click();
    await expect(dialog.getByText('Week 2 has been adapted')).toBeVisible();
    await expect(dialog.getByText('Recovered cleanly and generated next week.')).toBeVisible();

    const continueBtn = dialog.getByRole('button', { name: 'Continue to Today' });
    await continueBtn.click();

    await expect(dialog).not.toBeVisible();
    expect(attempts).toBe(2);
  });

  test('displays encouraging phase-gate reinforcement copy when benchmark is not met at phase boundary', async ({ page }) => {
    const reviewGoal = createReviewGoal();

    await mockApi(page, { goal: reviewGoal });

    await page.route('**/api/goal/weeks/*/review', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          review: {
            id: 'rev-w4',
            goalId: reviewGoal.id,
            weekNumber: 4,
            tasksPlanned: 6,
            tasksCompleted: 4,
            scorePercentage: 67,
            reflection: 'Struggled with fatigue this week.',
            aiAdaptationInsight: '4 of 6 sessions done. Rebalancing volume.',
            created_at: '',
          },
          scorePercentage: 67,
          nextWeekNumber: 5,
          nextWeekTasks: [],
          isMilestoneCheckpoint: true,
          milestoneGateTransition: {
            title: 'Foundation Review',
            completedPhase: 'Foundation',
            nextPhase: 'Acceleration',
            benchmarkMet: false,
          },
        }),
      });
    });

    await signIn(page);
    await page.goto('/');

    const reviewSection = page.locator('section[aria-labelledby="review-due-heading"]');
    await reviewSection.getByRole('button', { name: 'Start weekly review' }).click();

    const dialog = page.getByRole('dialog');
    const submitBtn = dialog.getByRole('button', { name: 'Start Week 2' });
    await submitBtn.click();

    // Adaptation moment reveals phase gate outcome with canonical BP §18 language
    await expect(dialog.getByText('Foundation Review')).toBeVisible();
    await expect(dialog.getByText('Phase Consolidation')).toBeVisible();
    await expect(
      dialog.getByText('Your current results suggest we should reinforce this phase.')
    ).toBeVisible();
    await expect(
      dialog.getByText('The path has adapted to give you space to consolidate your fundamentals before advancing.')
    ).toBeVisible();
    // Zero shame language
    await expect(dialog.getByText(/fail/i)).toHaveCount(0);

    const continueBtn = dialog.getByRole('button', { name: 'Continue to Today' });
    await continueBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});
