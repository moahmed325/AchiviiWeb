import { test, expect, Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { shellGoal, axeViolations, documentOverflow } from './shellFixtures';

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

const openToday = async (page: Page, options: Parameters<typeof mockApi>[1] = {}) => {
  const calls = await mockApi(page, { goal: shellGoal(), ...options });
  await signIn(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  return calls;
};

test.describe('Focus Mode Redesign (M5.5)', () => {
  test('timer controls: active countdown, pause/resume, space key, and reset', async ({ page }) => {
    await openToday(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
    await expect(modal).toBeVisible();
    await expect(modal.getByText('45:00')).toBeVisible();

    // Initial timer state is "In Flow"
    await expect(modal.getByText('In Flow')).toBeVisible();

    // Pause via button
    await modal.getByRole('button', { name: 'Pause' }).click();
    await expect(modal.getByText('Paused')).toBeVisible();

    // Resume via spacebar
    await page.keyboard.press('Space');
    await expect(modal.getByText('In Flow')).toBeVisible();

    // Pause via spacebar
    await page.keyboard.press('Space');
    await expect(modal.getByText('Paused')).toBeVisible();

    // Reset timer
    await modal.getByRole('button', { name: 'Reset timer' }).click();
    await expect(modal.getByText('45:00')).toBeVisible();
    await expect(modal.getByText('Paused')).toBeVisible();

    // Close via Exit button
    await modal.getByTitle('Exit focus mode (Esc)').click();
    await expect(modal).toHaveCount(0);
  });

  test('deliberate practice step runner: tips toggle and step navigation', async ({ page }) => {
    await openToday(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
    await expect(modal).toBeVisible();

    // Step 1 details
    await expect(modal.getByText('Step 1 of 2')).toBeVisible();
    await expect(modal.getByText('20 min target')).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Sketch the core screen' })).toBeVisible();

    // Toggle tips
    const tipsBtn = modal.getByRole('button', { name: 'View Tips & Guidance' });
    if (await tipsBtn.isVisible()) {
      await tipsBtn.click();
      await expect(modal.getByText('Focus Cue', { exact: true })).toBeVisible();
      await modal.getByRole('button', { name: 'Hide Tips & Cues' }).click();
    }

    // Previous is disabled on step 0
    await expect(modal.getByRole('button', { name: 'Previous' })).toBeDisabled();

    // Next step
    await modal.getByRole('button', { name: 'Next Step' }).click();
    await expect(modal.getByText('Step 2 of 2')).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'List the data it needs' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Complete Session' })).toBeVisible();

    // Previous button goes back to step 1
    await modal.getByRole('button', { name: 'Previous' }).click();
    await expect(modal.getByText('Step 1 of 2')).toBeVisible();
  });

  test('session completion with reflection: updates task and appends note (R5, R9, R10)', async ({ page }) => {
    const calls = await openToday(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
    await expect(modal).toBeVisible();

    // Advance to final step and complete
    await modal.getByRole('button', { name: 'Next Step' }).click();
    await modal.getByRole('button', { name: 'Complete Session' }).click();

    // Verify celebration view inside modal
    await expect(modal.getByText('Deliberate Practice Complete')).toBeVisible();
    await expect(modal.getByText('Day 3 Mastered')).toBeVisible();
    await expect(modal.getByText('45 min')).toBeVisible();
    await expect(modal.getByText('Day 3 / 90')).toBeVisible();

    // Enter reflection note
    const textarea = modal.getByPlaceholder('What was your breakthrough today?');
    await textarea.fill('Maintained cadence drills smoothly');

    // Save and return
    await modal.getByRole('button', { name: 'Save & Return to Dashboard' }).click();

    // Modal closed and Today reflects completed task
    await expect(modal).toHaveCount(0);
    await expect(page.getByText('Done', { exact: true })).toBeVisible();

    // Check mockApi recorded the task update with reflection appended
    const update = calls.taskUpdates.find((u) => u.taskId === 't3');
    expect(update).toBeDefined();
    expect(update?.body.status).toBe('completed');
    expect(update?.body.notes).toBe('Maintained cadence drills smoothly');

    // Reload page to verify persistence
    await page.reload();
    await expect(page.getByText('Done', { exact: true })).toBeVisible();
  });

  test('failed write keeps modal open, preserves reflection note and surfaces error alert (R6)', async ({ page }) => {
    await openToday(page, { taskUpdateStatus: 500 });
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
    await expect(modal).toBeVisible();

    // Advance to completion
    await modal.getByRole('button', { name: 'Next Step' }).click();
    await modal.getByRole('button', { name: 'Complete Session' }).click();

    // Fill reflection
    const textarea = modal.getByPlaceholder('What was your breakthrough today?');
    await textarea.fill('High energy tempo');

    // Save and return (fails with 500)
    await modal.getByRole('button', { name: 'Save & Return to Dashboard' }).click();

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
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
    await expect(modal).toBeVisible();

    // Advance to completion
    await modal.getByRole('button', { name: 'Next Step' }).click();
    await modal.getByRole('button', { name: 'Complete Session' }).click();

    const textarea = modal.getByPlaceholder('What was your breakthrough today?');
    await textarea.focus();
    await page.keyboard.type('hello world');

    await expect(textarea).toHaveValue('hello world');
    // Modal is still in celebration screen
    await expect(modal.getByText('Deliberate Practice Complete')).toBeVisible();
  });

  test('accessibility: zero axe violations on active stage and celebration screen', async ({ page }) => {
    await openToday(page);
    await page.getByRole('button', { name: 'Start', exact: true }).click();

    const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
    await expect(modal).toBeVisible();

    // Active stage axe scan
    expect(await axeViolations(page)).toEqual([]);

    // Advance to celebration screen
    await modal.getByRole('button', { name: 'Next Step' }).click();
    await modal.getByRole('button', { name: 'Complete Session' }).click();

    // Celebration screen axe scan
    expect(await axeViolations(page)).toEqual([]);
  });

  test('responsive layout: zero horizontal overflow and targets >= 44px at 1440, 390, 360', async ({ page }) => {
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await openToday(page);
      await page.getByRole('button', { name: 'Start', exact: true }).click();

      const modal = page.getByRole('dialog', { name: /Day 3 of 90 • Focus Mode/ });
      await expect(modal).toBeVisible();

      // Check document / modal has no horizontal overflow
      expect(await documentOverflow(page), `document overflow at ${width}`).toBeLessThanOrEqual(0);
      const modalOverflow = await modal.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(modalOverflow, `modal overflow at ${width}`).toBeLessThanOrEqual(0);

      // Check main action buttons meet 44px min target
      const pauseBtn = modal.getByRole('button', { name: 'Pause' });
      const box = await pauseBtn.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }

      await modal.getByTitle('Exit focus mode (Esc)').click();
      await expect(modal).toHaveCount(0);
    }
  });
});
