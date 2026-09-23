import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import {
  CUSTOM_GOAL,
  PRESET_GOAL,
  answerPresetQuestions,
  baseline,
  chooseOption,
  chooseSchedule,
  expectStep,
  generate,
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

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));
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

const startPathwayInOnboarding = async (page: Page) => {
  await page.goto('/onboarding');
  await chooseOption(page, 'Fitness');
  await chooseOption(page, PRESET_GOAL);
  await page.getByRole('button', { name: 'Start this pathway' }).click();
};

/** A launch from Home, which (like Today and signup) writes the draft goal; choosing inside onboarding never has. */
const launchPathwayFromHome = async (page: Page) => {
  await page.goto('/');
  await chooseOption(page, 'Fitness');
  await chooseOption(page, PRESET_GOAL);
  await page.getByRole('button', { name: 'Start this pathway' }).click();
  await expect(page).toHaveURL('/onboarding');
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
  test('custom goal: Achivii unreachable on the schedule, then back: retry keeps the schedule and sends once [network errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify, clarifyFailures: 1 });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox', { name: 'Your goal' }).fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expectStep(page, 'schedule');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText("We can't reach Achivii right now");
    await expect(alert).toContainText('Your schedule is kept.');
    await expect(page.getByText('Failed to fetch')).toHaveCount(0);
    await chooseOption(page, 'Steady');
    await chooseOption(page, '45 min');
    await expectNoAxeViolations(page);

    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expectStep(page, 'starting');
    expect(calls.clarifyAttempts).toBe(2);
    expect(calls.clarify).toEqual([{ rawGoal: CUSTOM_GOAL }]);

    await page.goBack();
    await expectStep(page, 'schedule');
    await expect(page.getByRole('radio', { name: 'Steady' })).toBeChecked();
    await expect(page.getByRole('radio', { name: '45 min' })).toBeChecked();
    onlyLoggedFailures();
  });

  test('pathway: a failed clarify keeps the draft across a reload, and retry after recovery shows the questions [network errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify, clarifyFailures: 2 });
    await signIn(page);
    await launchPathwayFromHome(page);
    await expectStep(page, 'starting');
    await expect(page.getByRole('alert')).toContainText("We can't reach Achivii right now");
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    expect(await draftGoal(page)).toBe(PRESET_GOAL);

    await page.reload();
    await expectStep(page, 'starting');
    await expect(page.getByRole('alert')).toContainText("We can't reach Achivii right now");
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    expect(calls.clarifyAttempts).toBe(2);

    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 2, name: baseline.presetClarify.followUpQuestions[0].question })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(calls.clarifyAttempts).toBe(3);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    onlyLoggedFailures();
  });

  test('a clarify failure on Achivii’s side shows Achivii’s own message [network errors expected]', async ({ page }) => {
    const message = 'Unable to analyze your goal right now. AI services are temporarily unavailable. Please retry.';
    await mockApi(page, { clarify: baseline.presetClarify, clarifyError: { status: 503, error: message } });
    await signIn(page);
    await startPathwayInOnboarding(page);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText("We couldn't prepare your questions");
    await expect(alert).toContainText(message);
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { level: 2, name: baseline.presetClarify.followUpQuestions[0].question })).toBeVisible();
  });

  test('leaving the schedule while the questions are coming cancels the wait', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify, clarifyDelayMs: 5000 });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox', { name: 'Your goal' }).fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseOption(page, 'Steady');
    await chooseOption(page, '45 min');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.getByText('Preparing your questions. Your schedule is kept while you wait.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-busy', 'true');

    await page.getByRole('button', { name: 'Back' }).click();
    await expectStep(page, 'goal');
    await expect.poll(() => calls.clarify.length).toBe(1);
    await page.waitForTimeout(300);
    await expectStep(page, 'goal');

    await page.getByRole('button', { name: /^Continue with my goal/ }).click();
    await chooseSchedule(page, 'starting');
    expect(calls.clarifyAttempts).toBe(1);
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

    await chooseOption(page, 'Fitness');
    await chooseOption(page, PRESET_GOAL);
    await page.getByRole('button', { name: 'Start this pathway' }).click();
    await expect(page.getByRole('heading', { level: 2, name: baseline.presetClarify.followUpQuestions[0].question })).toBeVisible();
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
    await launchPathwayFromHome(page);
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText("We couldn't build your plan");
    await expect(alert).toContainText(refusal);
    await expect(alert).toContainText('your current journey, if you have one, is unchanged');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);

    await alert.getByRole('button', { name: 'Review your answers' }).click();
    await expectStep(page, 'review');
    await expect(page.getByText(baseline.presetClarify.followUpQuestions[0].options[0])).toBeVisible();
    await expect(page.getByText('Steady: 5 days a week')).toBeVisible();

    await generate(page);
    await expect(page).toHaveURL('/dashboard');
    expect(calls.create).toHaveLength(2);
    expect(calls.create[1].body).toEqual(calls.create[0].body);
    expect(await draftGoal(page)).toBeNull();
  });

  test('a connection lost while building: the plan the server finished is found, not built twice [dashboard errors expected]', async ({
    page,
  }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify, createFailures: ['offline'], goalAfterCreate: CREATED_GOAL });
    await signIn(page);
    await startPathwayInOnboarding(page);
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);
    await expect(page).toHaveURL('/dashboard');
    expect(calls.create).toHaveLength(1);
    expect(await draftGoal(page)).toBeNull();
  });

  test('a reload during generation keeps the draft, and the next Build uses the plan the server saved [dashboard errors expected]', async ({
    page,
  }) => {
    const saved = {
      ...CREATED_GOAL,
      roadmapWeeks: [{ id: 'w1', weekNumber: 1, theme: 'Week 1', status: 'pending' }],
      dailyTasks: [{ id: 'task-1', description: 'Day 1', status: 'pending' }],
    };
    const calls = await mockApi(page, { clarify: baseline.presetClarify, goalAfterCreate: saved });
    await signIn(page);
    await launchPathwayFromHome(page);
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);
    await expect(page.getByRole('heading', { name: 'Building your path' })).toBeVisible();
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    // The heading is shown before POST: GET /api/goal/active runs first. Wait for that request.
    await expect.poll(() => calls.create.length).toBe(1);
    await expect.poll(() => calls.active).toBeGreaterThan(0);

    await page.reload();
    await expectStep(page, 'starting');
    await expect(page.getByRole('heading', { name: 'Building your path' })).toHaveCount(0);
    expect(await draftGoal(page)).toBe(PRESET_GOAL);

    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
    await generate(page);
    await expect(page).toHaveURL('/dashboard');
    expect(calls.create).toHaveLength(1);
    expect(await draftGoal(page)).toBeNull();
  });

  test('a connection lost while building with nothing finished is explained honestly [network errors expected]', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify, createFailures: ['offline'] });
    await signIn(page);
    await launchPathwayFromHome(page);
    await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
    await chooseSchedule(page, 'review');
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

test.describe('outcome', () => {
  test('an edited outcome survives Back and Forward and is what the plan is built from', async ({ page }) => {
    const edited = 'Run 10 km in under 48 minutes by December';
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await startPathwayInOnboarding(page);
    await expectStep(page, 'starting');
    for (const question of baseline.presetClarify.followUpQuestions) {
      await chooseOption(page, question.options[0]);
      await page.getByRole('button', { name: /^(Next question|Continue)$/ }).click();
    }
    await expectStep(page, 'success');
    await page.getByRole('button', { name: 'Edit outcome' }).click();
    const field = page.getByRole('textbox', { name: 'Your 90-day outcome' });
    await expect(field).toBeFocused();
    await field.fill(edited);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText(edited)).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expectStep(page, 'schedule');

    await page.goBack();
    await expectStep(page, 'success');
    await expect(page.getByText(edited)).toBeVisible();
    await page.goForward();
    await expectStep(page, 'schedule');
    await chooseSchedule(page, 'review');
    await expect(page.getByText(edited)).toBeVisible();
    await generate(page);
    await expect.poll(() => calls.create.length).toBe(1);
    expect((calls.create[0].body as { clarifiedOutcome: string }).clarifiedOutcome).toBe(edited);
  });

  test('clearing the outcome brings back the suggested one instead of leaving it blank', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await startPathwayInOnboarding(page);
    await expectStep(page, 'starting');
    for (const question of baseline.presetClarify.followUpQuestions) {
      await chooseOption(page, question.options[0]);
      await page.getByRole('button', { name: /^(Next question|Continue)$/ }).click();
    }
    await page.getByRole('button', { name: 'Edit outcome' }).click();
    await page.getByRole('textbox', { name: 'Your 90-day outcome' }).fill('   ');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText(baseline.presetClarify.clarifiedOutcome)).toBeVisible();
  });
});

test.describe('commitment sheet', () => {
  test('Cancel and Escape discard edits and return focus; a blank name is caught', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox', { name: 'Your goal' }).fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expectStep(page, 'schedule');

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
  test('on a 360 px screen the first answer starts above the footer, on both question steps', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/onboarding');
    await page.getByRole('textbox', { name: 'Your goal' }).fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseSchedule(page, 'starting');

    const firstAnswerClearsFooter = () =>
      page.evaluate(() => {
        const option = document.querySelector('#main input[type=radio]')!.closest('label')!.getBoundingClientRect();
        const footer = document.querySelector('#main .sticky')!.getBoundingClientRect();
        return footer.top - option.top;
      });
    await settled(page);
    expect(await firstAnswerClearsFooter()).toBeGreaterThanOrEqual(44);
    // The step description stays available to screen readers.
    await expect(page.getByText('A few questions about where you are today')).toHaveCount(1);
  });
});
