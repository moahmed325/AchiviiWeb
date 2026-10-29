import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import {
  CUSTOM_GOAL,
  PRESET_GOAL,
  answerEssentials,
  answerPresetQuestions,
  baseline,
  chooseOption,
  continueButton,
  expectQuestion,
  expectStep,
  generate,
  startGoal,
} from './onboardingFlow';

/** M3.7: every onboarding state that can fail, wait or be recovered from. */

const CREATED_GOAL = {
  id: 'g-new',
  userId: 'u-e2e',
  rawGoal: PRESET_GOAL,
  clarifiedOutcome: PRESET_GOAL,
  status: 'active',
  startDate: '2026-09-23T00:00:00.000Z',
  targetDate: '2026-12-22T00:00:00.000Z',
  currentWeek: 1,
  roadmapWeeks: [],
  dailyTasks: [],
};

const draftGoal = (page: Page) => page.evaluate(() => localStorage.getItem('achivii_draft_goal'));

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

/** Everything the user did is logged by the wizard, never shown; only that is allowed in the console. */
const onlyLoggedFailures = () =>
  expect(consoleErrors.filter((e) => !/Clarification error|Failed to fetch|Couldn't design|TypeError/.test(e))).toEqual([]);

/** ND-28: a goal typed on Home before a first plan, which (like the landing page) writes the draft goal. */
const startFromHome = async (page: Page, goal = PRESET_GOAL) => {
  await page.goto('/');
  await startGoal(page, goal);
  await expect(page).toHaveURL('/onboarding');
};

/** From Home to the summary, every answer the preset baseline's. */
const reachSummary = async (page: Page) => {
  await startFromHome(page);
  await answerEssentials(page);
  await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
};

const settled = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      return !(target instanceof Element && target.closest('#main')) || a.playState !== 'running';
    }),
  );

const expectNoAxeViolations = async (page: Page) => {
  await settled(page);
  const results = await new AxeBuilder({ page })
    .include('#main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

test.describe('clarify failure and recovery', () => {
  test('Achivii unreachable while the routine is answered: the questions page says so, and Try again keeps every answer [network errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify, clarifyFailures: 2 });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);

    // Arriving at the questions sends clarify again; it fails a second time.
    const alert = page.getByRole('alert');
    await expect(alert).toContainText("We can't reach Achivii right now");
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
    await expectNoAxeViolations(page);
    expect(calls.clarifyAttempts).toBe(2);

    await alert.getByRole('button', { name: 'Try again' }).click();
    await expectQuestion(page, baseline.customClarify.followUpQuestions[0].question);
    expect(calls.clarifyAttempts).toBe(3);
    expect(calls.clarify).toEqual([{ rawGoal: CUSTOM_GOAL }]);

    await page.goBack();
    await expectStep(page, 'date');
    await page.goBack();
    await page.goBack();
    await page.goBack();
    await page.goBack();
    await expectStep(page, 'minutes');
    await expect(page.getByRole('radio', { name: '45 min' })).toBeChecked();
    onlyLoggedFailures();
  });

  test('a failed clarify keeps the draft and the page across a reload [network errors expected]', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify, clarifyFailures: 2 });
    await signIn(page);
    await startFromHome(page);
    expect(await draftGoal(page)).toBe(PRESET_GOAL);

    await page.reload();
    await expectStep(page, 'days');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarifyAttempts).toBe(2);

    await answerEssentials(page);
    await expectQuestion(page, baseline.presetClarify.followUpQuestions[0].question);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(calls.clarifyAttempts).toBe(3);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    onlyLoggedFailures();
  });

  test('a clarify failure on Achivii’s side while the routine is answered is sent again on reaching the questions [network errors expected]', async ({ page }) => {
    const message = 'Unable to analyze your goal right now. AI services are temporarily unavailable. Please retry.';
    const calls = await mockApi(page, { clarify: baseline.customClarify, clarifyError: { status: 503, error: message } });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);
    await expectQuestion(page, baseline.customClarify.followUpQuestions[0].question);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(calls.clarifyAttempts).toBe(2);
  });

  test('questions still on their way: the page waits, then opens on the first question', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify, clarifyDelayMs: 4000 });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);
    await expect(page.getByText('Preparing your questions. Your answers so far are kept.')).toBeVisible();
    await expect(continueButton(page)).toHaveAttribute('aria-busy', 'true');

    await expectQuestion(page, baseline.customClarify.followUpQuestions[0].question, 15_000);
    expect(calls.clarifyAttempts).toBe(1);
    // The wait was replaced, so Back goes straight to the last routine page.
    await page.getByRole('button', { name: 'Back' }).click();
    await expectStep(page, 'date');
  });
});

test.describe('offline', () => {
  test('when Achivii is unreachable at load, onboarding says so, and the notice clears once a request succeeds', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify, healthDown: true });
    await signIn(page);
    await page.goto('/onboarding');
    const notice = page.getByRole('status').filter({ hasText: "We can't reach Achivii right now" });
    await expect(notice).toContainText('your answers stay on this page');
    await expectNoAxeViolations(page);

    await startGoal(page, PRESET_GOAL);
    await expect(notice).toHaveCount(0);
  });
});

test.describe('generation handoff', () => {
  test('a failed build is explained, keeps every answer and the draft, and Try again builds once more [dashboard errors expected]', async ({
    page,
  }) => {
    const refusal = "Couldn't design your roadmap right now. Please try again.";
    const calls = await mockApi(page, {
      clarify: baseline.presetClarify,
      createFailures: [refusal],
      createResult: { goal: CREATED_GOAL, roadmapWeeks: [], dailyTasks: [] },
    });
    await signIn(page);
    await reachSummary(page);
    await generate(page);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText("We couldn't build your plan");
    await expect(alert).toContainText(refusal);
    await expect(alert).toContainText('your current journey, if you have one, is unchanged');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);

    await alert.getByRole('button', { name: 'Review your answers' }).click();
    await expectStep(page, 'summary');
    await expect(page.getByText('5 days a week')).toBeVisible();
    await expect(page.getByText('45 min a session')).toBeVisible();

    await generate(page);
    await expect(page).toHaveURL('/');
    expect(calls.create).toHaveLength(2);
    expect(calls.create[1].body).toEqual(calls.create[0].body);
    expect(await draftGoal(page)).toBeNull();
  });

  test('a connection lost while building: the plan the server finished is found, not built twice [dashboard errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify, createFailures: ['offline'], goalAfterCreate: CREATED_GOAL });
    await signIn(page);
    await reachSummary(page);
    await generate(page);
    await expect(page).toHaveURL('/');
    expect(calls.create).toHaveLength(1);
    expect(await draftGoal(page)).toBeNull();
  });

  test('a reload during generation keeps the answers, and the next Start uses the plan the server saved [dashboard errors expected]', async ({
    page,
  }) => {
    const saved = {
      ...CREATED_GOAL,
      roadmapWeeks: [{ id: 'w1', weekNumber: 1, theme: 'Week 1', status: 'pending' }],
      dailyTasks: [{ id: 'task-1', description: 'Day 1', status: 'pending' }],
    };
    const calls = await mockApi(page, { clarify: baseline.presetClarify, goalAfterCreate: saved });
    await signIn(page);
    await reachSummary(page);
    await generate(page);
    await expect(page.getByRole('heading', { name: 'Building your path' })).toBeVisible();
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    // The heading is shown before POST: GET /api/goal/active runs first. Wait for that request.
    await expect.poll(() => calls.create.length).toBe(1);
    await expect.poll(() => calls.active).toBeGreaterThan(0);

    await page.reload();
    await expectStep(page, 'summary');
    await expect(page.getByRole('heading', { name: 'Building your path' })).toHaveCount(0);
    expect(await draftGoal(page)).toBe(PRESET_GOAL);

    await generate(page);
    await expect(page).toHaveURL('/');
    expect(calls.create).toHaveLength(1);
    expect(await draftGoal(page)).toBeNull();
  });

  test('a connection lost while building with nothing finished is explained honestly [network errors expected]', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify, createFailures: ['offline'] });
    await signIn(page);
    await reachSummary(page);
    await generate(page);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('We lost the connection');
    await expect(alert).toContainText("We'll check whether it was created before building it again.");
    await expect(alert).not.toContainText('unchanged');
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
    expect(calls.create).toHaveLength(1);
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
  });
});

test.describe('the goal on the summary', () => {
  test('an edited goal survives Back and Forward and is what the plan is built from', async ({ page }) => {
    const edited = 'Run 10 km in under 48 minutes by December';
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await reachSummary(page);
    await page.getByRole('button', { name: 'Edit your goal' }).click();
    const field = page.getByRole('textbox', { name: 'Your 90-day goal' });
    await expect(field).toBeFocused();
    await field.fill(edited);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText(edited)).toBeVisible();

    await page.goBack();
    await expectQuestion(page, baseline.presetClarify.followUpQuestions.at(-1)!.question);
    await page.goForward();
    await expectStep(page, 'summary');
    await expect(page.getByText(edited)).toBeVisible();
    await generate(page);
    await expect.poll(() => calls.create.length).toBe(1);
    expect((calls.create[0].body as { clarifiedOutcome: string }).clarifiedOutcome).toBe(edited);
  });

  test('clearing the goal brings back the suggested one instead of leaving it blank', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await reachSummary(page);
    await page.getByRole('button', { name: 'Edit your goal' }).click();
    await page.getByRole('textbox', { name: 'Your 90-day goal' }).fill('   ');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText(baseline.presetClarify.clarifiedOutcome)).toBeVisible();
  });
});

test.describe('commitment sheet', () => {
  test('Cancel and Escape discard edits and return focus; a blank name is caught', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await chooseOption(page, 'Steady');
    for (let i = 0; i < 5; i += 1) {
      if (i === 2) await chooseOption(page, '45 min');
      await continueButton(page).click();
    }
    await expectStep(page, 'commitments');

    const opener = page.getByRole('button', { name: 'Gym & Fitness' });
    await opener.click();
    const sheet = page.getByRole('dialog', { name: 'Add a commitment' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Name' }).fill('');
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet.getByText('Give it a name')).toBeVisible();
    await expect(sheet.getByRole('textbox', { name: 'Name' })).toBeFocused();

    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();

    await opener.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
    const bodyLocked = await page.evaluate(() => getComputedStyle(document.body).overflow);
    expect(bodyLocked).not.toBe('hidden');
  });
});

test.describe('small screens', () => {
  test('on a 360 px screen the first answer starts above the footer', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);

    const firstAnswerClearsFooter = () =>
      page.evaluate(() => {
        const option = document.querySelector('#main input[type=radio]')!.closest('label')!.getBoundingClientRect();
        const footer = document.querySelector('#main .sticky')!.getBoundingClientRect();
        return footer.top - option.top;
      });
    await settled(page);
    expect(await firstAnswerClearsFooter()).toBeGreaterThanOrEqual(44);
    await answerEssentials(page);
    await expectQuestion(page, baseline.customClarify.followUpQuestions[0].question);
    await settled(page);
    expect(await firstAnswerClearsFooter()).toBeGreaterThanOrEqual(44);
  });
});
