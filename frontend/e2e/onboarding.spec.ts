import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import {
  CUSTOM_GOAL,
  CUSTOM_TYPED_SUCCESS,
  PRESET_GOAL,
  answerCustomQuestions,
  answerPresetQuestions,
  baseline,
  chooseOption,
  chooseSchedule,
  expectStep,
  generate,
  generateButton,
  normalizeCreateBody,
} from './onboardingFlow';

const GOAL = {
  id: 'g-e2e',
  userId: 'u-e2e',
  rawGoal: 'Build & Ship a SaaS Web App',
  clarifiedOutcome: 'Build & Ship a SaaS Web App',
  status: 'active',
  startDate: '2026-09-01T00:00:00.000Z',
  targetDate: '2026-11-30T00:00:00.000Z',
  currentWeek: 1,
  roadmapWeeks: [],
  dailyTasks: [],
};

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

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

test.describe('onboarding payload (R-4 baseline)', () => {
  test('a preset from a landing pathway sends the baseline request bodies', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await page.goto('/signup?pathway=run10k');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel('Password', { exact: true }).fill('secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/onboarding');

    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    expect(calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    expect(calls.create[0].headers).toEqual(baseline.presetCreate.headers);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.presetCreate.body));
  });

  test('a custom goal sends the baseline request bodies', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await expectStep(page, 'goal');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();

    await chooseSchedule(page, 'starting');
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    expect(calls.clarify).toEqual([{ rawGoal: CUSTOM_GOAL }]);
    expect(calls.create[0].headers).toEqual(baseline.customCreate.headers);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.customCreate.body));
  });

  test('a pathway chosen inside onboarding sends the preset baseline body', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await chooseOption(page, 'Fitness');
    await chooseOption(page, PRESET_GOAL);
    await page.getByRole('button', { name: 'Start this pathway' }).click();

    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    expect(calls.clarify).toEqual([{ rawGoal: PRESET_GOAL }]);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.presetCreate.body));
  });

  test('a commitment added and edited in the sheet reaches the request in the existing shape', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expectStep(page, 'schedule');

    await page.getByRole('button', { name: 'Gym & Fitness' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a commitment' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Edit Gym & Fitness' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit commitment' });
    await editor.getByRole('button', { name: 'Weekends' }).click();
    await editor.getByRole('button', { name: 'Done' }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole('button', { name: 'Edit Gym & Fitness' })).toBeFocused();

    await chooseSchedule(page, 'starting');
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    const expected = normalizeCreateBody(baseline.customCreate.body) as { routine: { commitments: unknown[] } };
    expected.routine.commitments = [{ id: '<id>', title: 'Gym & Fitness', time: '18:00 - 19:30', category: 'fitness', days: ['Sat', 'Sun'] }];
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(expected);
  });

  test('a double click on the final button creates one goal', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseSchedule(page, 'starting');
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);

    await generateButton(page).dblclick();
    await expect.poll(() => calls.create.length).toBe(1);
    await page.waitForTimeout(500);
    expect(calls.create).toHaveLength(1);
  });
});

test.describe('onboarding history and reload (R-18)', () => {
  test('back and forward move between steps and keep every answer', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseSchedule(page, 'starting');
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);

    await page.goBack();
    await expectStep(page, 'success');
    await page.goBack();
    await expectStep(page, 'starting');
    await page.goBack();
    await expectStep(page, 'schedule');
    await page.goBack();
    await expectStep(page, 'goal');
    await expect(page.getByRole('textbox').first()).toHaveValue(CUSTOM_GOAL);

    await page.goForward();
    await expectStep(page, 'schedule');
    await page.goForward();
    await expectStep(page, 'starting');
    await page.goForward();
    await expectStep(page, 'success');
    await page.goForward();
    await expectStep(page, 'review');
    await expect(page.getByText(CUSTOM_TYPED_SUCCESS).first()).toBeVisible();

    await generate(page);
    await expect.poll(() => calls.create.length).toBe(1);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.customCreate.body));
  });

  test('on a preset, back and forward from the review follow the pathway order (ND-13)', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await page.goto('/signup?pathway=run10k');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel('Password', { exact: true }).fill('secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');

    await page.goBack();
    await expectStep(page, 'schedule');
    await page.goBack();
    await expectStep(page, 'success');
    await page.goForward();
    await expectStep(page, 'schedule');
    await page.goForward();
    await expectStep(page, 'review');

    await generate(page);
    await expect.poll(() => calls.create.length).toBe(1);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.presetCreate.body));
  });

  test('a reload on a preset keeps the preset on its first step', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify });
    await page.goto('/signup?pathway=run10k');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel('Password', { exact: true }).fill('secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expectStep(page, 'starting');

    await page.reload();
    await expectStep(page, 'starting');
    await expect(page.getByText(PRESET_GOAL).locator('visible=true').first()).toBeVisible();
  });

  test('after a reload, forward to a step whose answers are gone lands on a reachable step (ND-16)', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseSchedule(page, 'starting');
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await page.goBack();
    await page.goBack();
    await page.goBack();
    await expectStep(page, 'schedule');

    await page.reload();
    await expectStep(page, 'goal');
    await page.goForward();
    await expectStep(page, 'goal');
    await page.goForward();
    await expectStep(page, 'goal');
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('the saved pathway survives reloads and is cleared once the goal is created (ND-16) [dashboard errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, {
      clarify: baseline.presetClarify,
      createResult: { goal: GOAL, roadmapWeeks: [], dailyTasks: [] },
    });
    await page.goto('/signup?pathway=run10k');
    await page.getByLabel('Email').fill('new@example.com');
    await page.getByLabel('Password', { exact: true }).fill('secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expectStep(page, 'starting');

    for (let i = 0; i < 2; i += 1) {
      await page.reload();
      await expectStep(page, 'starting');
    }
    expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBe(PRESET_GOAL);

    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);
    await expect(page).toHaveURL('/');
    expect(calls.create).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBeNull();
  });
});

test.describe('onboarding entry and failure', () => {
  test('switching goal from inside the app opens onboarding without touching the current goal', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The pathway explorer entry is checked on desktop.');
    const calls = await mockApi(page, { goal: GOAL, clarify: baseline.presetClarify });
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });
    await signIn(page);
    await page.goto('/');
    // M5.3: Today no longer has "Explore Goals (10)"; the shell's Pathways entry opens the same explorer.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Pathways' }).locator('visible=true').first().click();
    const explorer = page.getByRole('dialog', { name: 'Explore pathways' });
    await explorer.getByRole('tab', { name: 'Fitness' }).click();
    await chooseOption(page, PRESET_GOAL);
    await explorer.getByRole('button', { name: /Switch to this pathway/ }).click();

    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
    const draft = await page.evaluate(() => localStorage.getItem('achivii_draft_goal'));
    expect(draft).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    await expect(page.getByText(draft!).first()).toBeVisible();
    expect(deletes).toEqual([]);
    expect(calls.create).toEqual([]);

    // ND-16: the switch-goal launch state survives a reload instead of bouncing to /dashboard.
    await page.reload();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
    await expect(page.getByText(draft!).first()).toBeVisible();
    expect(deletes).toEqual([]);
  });

  test('a clarify failure keeps the user on the schedule step [network errors expected]', async ({ page }) => {
    await mockApi(page, { clarifyOffline: true });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expectStep(page, 'schedule');
    await chooseOption(page, 'Steady');
    await chooseOption(page, '45 min');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    // M3.7: a refused connection is reported as Achivii being unreachable (it was "We couldn't prepare your questions").
    await expect(page.getByRole('alert')).toContainText("We can't reach Achivii right now");
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
    await expectStep(page, 'schedule');
    expect(consoleErrors.filter((e) => !e.includes('Clarification error'))).toEqual([]);
  });

  test('a pathway whose clarify fails offers a retry on the starting point [network errors expected]', async ({ page }) => {
    await mockApi(page, { clarifyOffline: true });
    await signIn(page);
    await page.goto('/onboarding');
    await chooseOption(page, 'Career');
    await page.getByRole('button', { name: 'Start this pathway' }).click();

    await expectStep(page, 'starting');
    // M3.7: offline copy, as above.
    await expect(page.getByRole('alert')).toContainText("We can't reach Achivii right now");
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  });
});

/** Axe measures contrast as painted, so let entering steps finish fading in first. */
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

const expectAccessibleAndContained = async (page: Page) => {
  await settled(page);
  const results = await new AxeBuilder({ page })
    .include('#main')
    .include('aside[aria-label="Your progress"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe('onboarding accessibility and layout (M3.5)', () => {
  test('every step has no axe violations and no horizontal overflow', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await expectStep(page, 'goal');
    await chooseOption(page, 'Creative');
    await expectAccessibleAndContained(page);

    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expectStep(page, 'schedule');
    await chooseOption(page, 'Steady');
    await chooseOption(page, '45 min');
    await expectAccessibleAndContained(page);

    await page.getByRole('button', { name: 'Gym & Fitness' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settled(page);
    const dialogResults = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(dialogResults.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Gym & Fitness' })).toBeFocused();

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expectStep(page, 'starting');
    await expectAccessibleAndContained(page);

    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await expectStep(page, 'review');
    await expectAccessibleAndContained(page);
  });

  test('the question step fits a 360 px screen with its actions in reach', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseSchedule(page, 'starting');

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 740 });
      await settled(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      for (const name of ['Back', 'Next question']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(740);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('a pathway can be chosen with the keyboard, and each step starts at its heading', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('radio', { name: 'Fitness' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('radio', { name: PRESET_GOAL })).toBeFocused();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Start this pathway' })).toBeFocused();
    await page.keyboard.press('Enter');

    await expectStep(page, 'starting');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('with reduced motion, steps arrive without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await expectStep(page, 'goal');
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('.animate-rise-in')].map((el) => parseFloat(getComputedStyle(el).animationDuration))
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) expect(d).toBeLessThanOrEqual(0.001);
  });
});

