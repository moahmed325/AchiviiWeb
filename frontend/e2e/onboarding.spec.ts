import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import {
  CUSTOM_GOAL,
  CUSTOM_TYPED_SUCCESS,
  PRESET_GOAL,
  answerCustomQuestions,
  answerEssentials,
  answerPresetQuestions,
  baseline,
  chooseOption,
  continueButton,
  expectQuestion,
  expectStep,
  generate,
  generateButton,
  normalizeCreateBody,
  startGoal,
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

const signUp = async (page: Page) => {
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('secret1');
  await page.getByRole('button', { name: 'Create account' }).click();
};

test.describe('onboarding payload (R-4 baseline)', () => {
  test('a preset from a landing pathway sends the baseline request bodies', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await page.goto('/signup?pathway=run10k');
    await signUp(page);
    await expect(page).toHaveURL('/onboarding');

    await answerEssentials(page);
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
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
    await startGoal(page, CUSTOM_GOAL);

    await answerEssentials(page);
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    expect(calls.clarify).toEqual([{ rawGoal: CUSTOM_GOAL }]);
    expect(calls.create[0].headers).toEqual(baseline.customCreate.headers);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.customCreate.body));
  });

  test('a visitor types the goal on the landing page, answers everything, signs up, and the plan is built (ND-28)', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await page.goto('/');
    await page.getByRole('textbox', { name: 'What do you want to achieve?' }).first().fill(CUSTOM_GOAL);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/onboarding');

    await answerEssentials(page);
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await expect(page.getByText('Next, create your account so your plan is saved.')).toBeVisible();
    await generate(page);

    await expect(page).toHaveURL(/\/signup\?next=%2Fonboarding$/);
    expect(calls.create).toEqual([]);
    await signUp(page);
    await expect.poll(() => calls.create.length).toBe(1);
    expect(calls.clarify).toEqual([{ rawGoal: CUSTOM_GOAL }]);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.customCreate.body));
  });

  test('a commitment added and edited in the sheet reaches the request in the existing shape', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await chooseOption(page, 'Steady');
    await continueButton(page).click();
    await continueButton(page).click();
    await chooseOption(page, '45 min');
    await continueButton(page).click();
    await continueButton(page).click();
    await continueButton(page).click();
    await expectStep(page, 'commitments');

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

    await continueButton(page).click();
    await expectStep(page, 'date');
    await continueButton(page).click();
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
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);

    await generateButton(page).dblclick();
    await expect.poll(() => calls.create.length).toBe(1);
    await page.waitForTimeout(500);
    expect(calls.create).toHaveLength(1);
  });
});

test.describe('a vague goal (ND-28)', () => {
  test('gets a page of concrete goals after the daily time, and the plan is built for the one chosen', async ({ page }) => {
    const options = ['Run 5K without stopping', 'Do 20 push-ups in a row', 'Walk 10,000 steps a day'];
    const calls = await mockApi(page, {
      clarify: (body: { rawGoal: string }) =>
        body.rawGoal === 'Get fit' ? { ...baseline.customClarify, clarifiedOutcome: 'Get fit', focusOptions: options } : baseline.customClarify,
    });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Get fit' }).click();
    await expectStep(page, 'days');
    await chooseOption(page, 'Steady');
    await continueButton(page).click();
    await continueButton(page).click();
    await chooseOption(page, '45 min');
    await continueButton(page).click();

    await expectStep(page, 'focus');
    await expect(page.getByText('“Get fit” is a great direction.')).toBeVisible();
    await chooseOption(page, 'Something else');
    await page.getByLabel('Your 90-day goal').fill(CUSTOM_GOAL);
    await continueButton(page).click();
    await expectStep(page, 'slot');
    for (const step of ['slot', 'day', 'commitments', 'date'] as const) {
      await expectStep(page, step);
      await continueButton(page).click();
    }
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    expect(calls.clarify).toEqual([{ rawGoal: 'Get fit' }, { rawGoal: CUSTOM_GOAL }]);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.customCreate.body));
  });
});

test.describe('onboarding history and reload (R-18)', () => {
  test('back and forward move between pages and keep every answer', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    const questions = baseline.customClarify.followUpQuestions;

    await page.goBack();
    await expectQuestion(page, questions[3].question);
    await page.goBack();
    await page.goBack();
    await expectQuestion(page, questions[1].question);
    await expect(page.getByLabel('Or put it in your own words')).toHaveValue(CUSTOM_TYPED_SUCCESS);
    await page.goBack();
    await page.goBack();
    await expectStep(page, 'date');

    await page.goForward();
    await page.goForward();
    await expectQuestion(page, questions[1].question);
    await page.goForward();
    await page.goForward();
    await page.goForward();
    await expectStep(page, 'summary');

    await generate(page);
    await expect.poll(() => calls.create.length).toBe(1);
    expect(normalizeCreateBody(calls.create[0].body)).toEqual(normalizeCreateBody(baseline.customCreate.body));
  });

  test('a reload keeps the page and the answers', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await chooseOption(page, 'Intensive');
    await continueButton(page).click();
    await expectStep(page, 'weekdays');

    await page.reload();
    await expectStep(page, 'weekdays');
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('radio', { name: 'Intensive' })).toBeChecked();
  });

  test('the saved pathway survives reloads and is cleared once the goal is created (ND-16) [dashboard errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, {
      clarify: baseline.presetClarify,
      createResult: { goal: GOAL, roadmapWeeks: [], dailyTasks: [] },
    });
    await page.goto('/signup?pathway=run10k');
    await signUp(page);
    await expectStep(page, 'days');

    for (let i = 0; i < 2; i += 1) {
      await page.reload();
      await expectStep(page, 'days');
    }
    expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBe(PRESET_GOAL);

    await answerEssentials(page);
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await generate(page);
    await expect(page).toHaveURL('/');
    expect(calls.create).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('achivii_onboarding'))).toBeNull();
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
    await expectStep(page, 'days');
    const draft = await page.evaluate(() => localStorage.getItem('achivii_draft_goal'));
    expect(draft).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    await expect(page.getByText(draft!).locator('visible=true').first()).toBeVisible();
    expect(deletes).toEqual([]);
    expect(calls.create).toEqual([]);

    // ND-16: the switch-goal launch state survives a reload instead of bouncing to /dashboard.
    await page.reload();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'days');
    expect(deletes).toEqual([]);
  });

  test('a clarify failure shows on the questions page with a retry [network errors expected]', async ({ page }) => {
    await mockApi(page, { clarifyOffline: true });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);

    // M3.7: a refused connection is reported as Achivii being unreachable.
    await expect(page.getByRole('alert')).toContainText("We can't reach Achivii right now");
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(continueButton(page)).toBeDisabled();
    expect(consoleErrors.filter((e) => !e.includes('Clarification error'))).toEqual([]);
  });
});

/** Axe measures contrast as painted, so let entering pages finish fading in first. */
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

const expectAccessibleAndContained = async (page: Page) => {
  await settled(page);
  const results = await new AxeBuilder({ page })
    .include('#main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe('onboarding accessibility and layout (M3.5)', () => {
  test('every page has no axe violations and no horizontal overflow', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await expectStep(page, 'goal');
    await expectAccessibleAndContained(page);
    await startGoal(page, CUSTOM_GOAL);

    await chooseOption(page, 'Steady');
    await expectAccessibleAndContained(page);
    await continueButton(page).click();
    await expectStep(page, 'weekdays');
    await expectAccessibleAndContained(page);
    await continueButton(page).click();
    await chooseOption(page, '45 min');
    await expectAccessibleAndContained(page);
    await continueButton(page).click();
    for (const step of ['slot', 'day', 'commitments', 'date'] as const) {
      await expectStep(page, step);
      await expectAccessibleAndContained(page);
      if (step === 'commitments') {
        await page.getByRole('button', { name: 'Gym & Fitness' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await settled(page);
        const dialogResults = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(dialogResults.violations.map((v) => v.id)).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('button', { name: 'Gym & Fitness' })).toBeFocused();
      }
      if (step === 'date') {
        await chooseOption(page, "Yes, there's a date");
        await expectAccessibleAndContained(page);
        await chooseOption(page, 'No fixed date');
      }
      await continueButton(page).click();
    }

    await expectQuestion(page, baseline.customClarify.followUpQuestions[0].question);
    await expectAccessibleAndContained(page);
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await expectAccessibleAndContained(page);
  });

  test('a question page fits a 360 px screen with its actions in reach', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);
    await expectQuestion(page, baseline.customClarify.followUpQuestions[0].question);

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 740 });
      await settled(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      for (const name of ['Back', 'Continue']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(740);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('the goal starts with the keyboard, and each page starts at its heading', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await expect(page.getByRole('textbox', { name: 'What do you want to achieve?' })).toBeFocused();
    await page.keyboard.type(PRESET_GOAL);
    await page.keyboard.press('Enter');

    await expectStep(page, 'days');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });

  test('with reduced motion, pages arrive without animation', async ({ page }) => {
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
