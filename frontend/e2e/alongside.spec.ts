import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { shellGoal } from './shellFixtures';

// ND-41: one guided skill can run alongside the main plan (Pro). Today stacks its step under the main one; the
// Roadmap shows it with a way to stop it.

const SKILL = 'Play 5 Songs on Acoustic Guitar';
const today = new Date().toISOString().slice(0, 10);

const skillGoal = () => {
  const goal = shellGoal();
  return {
    ...goal,
    id: 'g-skill',
    rawGoal: SKILL,
    clarifiedOutcome: SKILL,
    status: 'alongside',
    currentWeek: 1,
    dailyTasks: [
      {
        id: 'skill-today',
        goalId: 'g-skill',
        weekNumber: 1,
        dayNumber: 3,
        date: today,
        dayOfWeek: 'Today',
        title: 'Chord changes to a metronome',
        detailedSteps: JSON.stringify([{ stepNumber: 1, title: 'G to C, slowly', durationMinutes: 10, instructions: '', focusCue: '', pitfallToAvoid: '' }]),
        implementationIntention: '',
        durationMinutes: 20,
        isRestDay: false,
        status: 'pending',
        created_at: `${today}T00:00:00.000Z`,
      },
    ],
  };
};

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

test.afterEach(() => {
  expect(consoleErrors).toEqual([]);
});

test('Today stacks the skill’s step under the main one, and marks it done in the skill’s plan', async ({ page }) => {
  const calls = await mockApi(page, { goal: shellGoal(), alongsideGoal: skillGoal(), plan: 'pro' });
  await signIn(page);
  await page.goto('/');
  const card = page.getByRole('region', { name: SKILL });
  await expect(card).toContainText('Also today');
  await expect(card).toContainText('Chord changes to a metronome');
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const results = await new AxeBuilder({ page }).include('#main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

  await card.getByRole('button', { name: 'Mark done' }).click();
  await expect(card).toContainText('Done for today');
  expect(calls.taskUpdates).toEqual([{ taskId: 'skill-today', body: { status: 'completed' } }]);
});

test('the Roadmap shows the skill alongside, and stopping it asks first and leaves the main plan', async ({ page }) => {
  const calls = await mockApi(page, { goal: shellGoal(), alongsideGoal: skillGoal(), plan: 'pro' });
  await signIn(page);
  await page.goto('/roadmap');
  await expect(page.getByRole('heading', { name: `Alongside · ${SKILL}` })).toBeVisible();
  await page.getByRole('button', { name: 'Stop this skill' }).click();
  const dialog = page.getByRole('dialog', { name: `Stop ${SKILL}?` });
  await expect(dialog).toContainText('Your main plan stays exactly as it is.');
  await dialog.getByRole('button', { name: 'Stop the skill' }).click();
  await expect(page.getByRole('heading', { name: `Alongside · ${SKILL}` })).toHaveCount(0);
  expect(calls.alongsideResets).toBe(1);
  expect(calls.resets).toBe(0);
});
