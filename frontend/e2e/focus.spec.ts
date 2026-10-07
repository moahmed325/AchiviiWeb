import { test, expect, Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { shellGoal, axeViolations, documentOverflow } from './shellFixtures';

const MINIMUM_VERSION = {
  stepNumber: 1,
  title: 'Sketch one screen in 10 minutes',
  instructions: 'Draw only the first screen, roughly.',
  durationMinutes: 10,
  focusCue: '',
  pitfallToAvoid: '',
};

/** The shell goal, with today's task (t3) given a 10-minute version (OD-9). */
const goalWithMinimumVersion = () => {
  const goal = shellGoal();
  return {
    ...goal,
    dailyTasks: goal.dailyTasks.map((task) => (task.id === 't3' ? { ...task, minimumVersion: MINIMUM_VERSION } : task)),
  };
};

const openToday = async (page: Page, options: Parameters<typeof mockApi>[1] = {}) => {
  const calls = await mockApi(page, { goal: shellGoal(), ...options });
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The shell goal started two days ago, so today is day 3 (M1.1b reads it in the user's timezone).
  await expect(page.getByLabel('Day 3 of 90', { exact: true })).toBeVisible();
  return calls;
};

/** Opens Focus mode from Today's Start; it opens on a calm start screen with the timer not yet running. */
const openFocus = async (page: Page) => {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Focus' });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole('heading', { name: 'Write the one-page product brief' })).toBeVisible();
  return modal;
};

const startSession = async (page: Page) => {
  const modal = await openFocus(page);
  await modal.getByRole('button', { name: 'Start focused session' }).click();
  await expect(modal.getByText('In flow')).toBeVisible();
  return modal;
};

const completeSession = async (page: Page) => {
  const modal = await startSession(page);
  await modal.getByRole('button', { name: 'Done — next' }).click();
  await modal.getByRole('button', { name: 'Complete session' }).click();
  await expect(modal.getByRole('region', { name: 'Session complete' })).toBeVisible();
  return modal;
};

test.describe('Focus Mode', () => {
  test('timer controls: start with space, active countdown, pause/resume by button and space, exit', async ({ page }) => {
    await openToday(page);
    const modal = await openFocus(page);

    // The timer waits for the user: nothing counts down on the start screen.
    await expect(modal.getByText('Press Space to start')).toBeVisible();
    await expect(modal.getByRole('region', { name: 'Focus timer' })).toHaveCount(0);

    // Start via spacebar
    await page.keyboard.press('Space');
    const timer = modal.getByRole('region', { name: 'Focus timer' });
    await expect(timer.getByText('In flow')).toBeVisible();
    await expect(timer.getByText(/^(45:00|44:5\d)$/)).toBeVisible();

    // The countdown runs
    await expect(timer.getByText(/^44:5\d$/)).toBeVisible();

    // Pause via button; the time holds while paused
    await timer.getByRole('button', { name: 'Pause' }).click();
    await expect(timer.getByText('Paused')).toBeVisible();
    const held = await timer.getByText(/^\d\d:\d\d$/).textContent();
    await page.waitForTimeout(1500);
    await expect(timer.getByText(/^\d\d:\d\d$/)).toHaveText(held ?? '');

    // Resume via spacebar
    await page.keyboard.press('Space');
    await expect(timer.getByText('In flow')).toBeVisible();
    await expect(timer.getByRole('button', { name: 'Pause' })).toBeVisible();

    // Pause via spacebar, resume via button
    await page.keyboard.press('Space');
    await expect(timer.getByText('Paused')).toBeVisible();
    await timer.getByRole('button', { name: 'Resume' }).click();
    await expect(timer.getByText('In flow')).toBeVisible();

    // Close via Exit button
    await modal.getByTitle('Exit focus mode (Esc)').click();
    await expect(modal).toHaveCount(0);

    // Escape closes it too
    const reopened = await openFocus(page);
    await page.keyboard.press('Escape');
    await expect(reopened).toHaveCount(0);
  });

  test('deliberate practice step runner: help disclosure and step navigation', async ({ page }) => {
    await openToday(page);
    const modal = await startSession(page);

    // Step 1 details
    const step = modal.getByRole('article', { name: 'Current step' });
    await expect(step.getByText('Step 1 of 2')).toBeVisible();
    await expect(step.getByRole('heading', { name: 'Sketch the core screen' })).toBeVisible();
    await expect(step.getByText('Draw the one screen a user needs first.')).toBeVisible();

    // Help (focus cue) is collapsed until asked for
    const cue = step.getByText('One screen only.');
    await expect(cue).toBeHidden();
    await step.getByText('Need help?').click();
    await expect(cue).toBeVisible();

    // The shell task has no 10-minute version, so none is offered
    await expect(step.getByRole('button', { name: /low energy/i })).toHaveCount(0);

    // Next step
    await step.getByRole('button', { name: 'Done — next' }).click();
    await expect(step.getByText('Step 2 of 2')).toBeVisible();
    await expect(step.getByRole('heading', { name: 'List the data it needs' })).toBeVisible();
    await expect(step.getByText('One screen only.')).toHaveCount(0);
    await expect(step.getByRole('button', { name: 'Complete session' })).toBeVisible();
    await expect(step.getByRole('button', { name: 'Done — next' })).toHaveCount(0);
  });

  test('session completion with reflection: updates task and saves the note (R5, R9, R10)', async ({ page }) => {
    const calls = await openToday(page);
    const modal = await completeSession(page);

    // Completion view inside modal
    await expect(modal.getByText('Session complete', { exact: true })).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'You did the work.' })).toBeVisible();

    // Enter reflection note
    const textarea = modal.getByRole('textbox', { name: /One thing to remember/ });
    await expect(textarea).toHaveAttribute('placeholder', 'What mattered today?');
    await textarea.fill('Maintained cadence drills smoothly');

    // Save and return
    await modal.getByRole('button', { name: 'Finish & return' }).click();

    // Modal closed and Today reflects completed task
    await expect(modal).toHaveCount(0);
    await expect(page.getByText('Done', { exact: true })).toBeVisible();
    await expect(page.getByText('Step completed. Deliberate practice logged for today.')).toBeVisible();

    // Check mockApi recorded the task update with the reflection; a full session is not the minimum version (ND-3)
    const update = calls.taskUpdates.find((u) => u.taskId === 't3');
    expect(update).toBeDefined();
    expect(update?.body.status).toBe('completed');
    expect(update?.body.notes).toBe('Maintained cadence drills smoothly');
    expect((update?.body as Record<string, unknown> | undefined)?.usedMinimumVersion).toBeUndefined();

    // Reload page to verify persistence
    await page.reload();
    await expect(page.getByText('Done', { exact: true })).toBeVisible();
  });

  test('completing the 10-minute version records usedMinimumVersion (missed sessions M2.0, ND-3)', async ({ page }) => {
    const calls = await openToday(page, { goal: goalWithMinimumVersion() });
    const modal = await startSession(page);

    await modal.getByRole('button', { name: 'Low energy — do the minimum' }).click();
    const minimum = modal.getByRole('article', { name: 'Minimum version' });
    await expect(minimum.getByRole('heading', { name: MINIMUM_VERSION.title })).toBeVisible();
    await minimum.getByRole('button', { name: 'Complete minimum' }).click();

    await expect(modal.getByText('Minimum complete', { exact: true })).toBeVisible();
    await modal.getByRole('button', { name: 'Finish & return' }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.getByText('Done', { exact: true })).toBeVisible();

    const update = calls.taskUpdates.find((u) => u.taskId === 't3');
    expect(update?.body.status).toBe('completed');
    expect((update?.body as Record<string, unknown> | undefined)?.usedMinimumVersion).toBe(true);
  });

  test('failed write keeps modal open, preserves reflection note and surfaces error alert (R6)', async ({ page }) => {
    await openToday(page, { taskUpdateStatus: 500 });
    const modal = await completeSession(page);

    // Fill reflection
    const textarea = modal.getByRole('textbox', { name: /One thing to remember/ });
    await textarea.fill('High energy tempo');

    // Save and return (fails with 500)
    await modal.getByRole('button', { name: 'Finish & return' }).click();

    // Modal remains OPEN
    await expect(modal).toBeVisible();

    // Accessible error alert is shown inside modal
    const alert = modal.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("That didn't save. Please try again.");

    // Reflection text is preserved
    await expect(textarea).toHaveValue('High energy tempo');

    // Button changed to "Try again"
    await expect(modal.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('spacebar inside reflection textarea enters a space and does not toggle timer', async ({ page }) => {
    await openToday(page);
    const modal = await completeSession(page);

    const textarea = modal.getByRole('textbox', { name: /One thing to remember/ });
    await textarea.focus();
    await page.keyboard.type('hello world');

    await expect(textarea).toHaveValue('hello world');
    // Modal is still on the completion screen; the timer did not come back
    await expect(modal.getByRole('region', { name: 'Session complete' })).toBeVisible();
    await expect(modal.getByRole('region', { name: 'Focus timer' })).toHaveCount(0);
  });

  test('accessibility: zero axe violations on start screen, active stage and completion screen', async ({ page }) => {
    await openToday(page);
    const modal = await openFocus(page);

    // Start screen axe scan
    expect(await axeViolations(page)).toEqual([]);

    // Active stage axe scan, with help open
    await modal.getByRole('button', { name: 'Start focused session' }).click();
    await expect(modal.getByText('In flow')).toBeVisible();
    await modal.getByText('Need help?').click();
    expect(await axeViolations(page)).toEqual([]);

    // Completion screen axe scan
    await modal.getByRole('button', { name: 'Done — next' }).click();
    await modal.getByRole('button', { name: 'Complete session' }).click();
    await expect(modal.getByRole('region', { name: 'Session complete' })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('responsive layout: zero horizontal overflow and targets >= 44px at 1440, 390, 360', async ({ page }) => {
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await openToday(page);
      const modal = await startSession(page);

      // Check document / modal has no horizontal overflow
      expect(await documentOverflow(page), `document overflow at ${width}`).toBeLessThanOrEqual(0);
      const modalOverflow = await modal.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(modalOverflow, `modal overflow at ${width}`).toBeLessThanOrEqual(0);

      // Check the session's controls meet the 44px minimum target
      for (const name of ['Pause', 'Mute', 'Exit focus mode (Esc)', 'Done — next']) {
        const box = await modal.getByRole('button', { name, exact: true }).boundingBox();
        expect(box, `${name} at ${width}`).not.toBeNull();
        if (box) {
          expect(box.height, `${name} height at ${width}`).toBeGreaterThanOrEqual(44);
          expect(box.width, `${name} width at ${width}`).toBeGreaterThanOrEqual(44);
        }
      }

      await modal.getByTitle('Exit focus mode (Esc)').click();
      await expect(modal).toHaveCount(0);
    }
  });
});
