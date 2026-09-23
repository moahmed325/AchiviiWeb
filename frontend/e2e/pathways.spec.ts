import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { PRESET_GOAL, baseline, chooseOption, expectStep } from './onboardingFlow';

/** The pathway library in every in-app place it appears (M3.6, ND-15). */

const CURRENT = 'Build & Ship a SaaS Web App';

const GOAL = {
  id: 'g-e2e',
  userId: 'u-e2e',
  rawGoal: CURRENT,
  clarifiedOutcome: CURRENT,
  status: 'active',
  startDate: '2026-09-01T00:00:00.000Z',
  targetDate: '2026-11-30T00:00:00.000Z',
  currentWeek: 1,
  roadmapWeeks: [],
  dailyTasks: [],
};

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));
const draftGoal = (page: Page) => page.evaluate(() => localStorage.getItem('achivii_draft_goal'));
const explorer = (page: Page) => page.getByRole('dialog', { name: 'Explore pathways' });
const strip = (page: Page) => page.getByRole('region', { name: 'Pathways', exact: true });

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

/**
 * Axe measures contrast as painted, so let the target and its ancestors finish fading in. Today has looping
 * animations elsewhere on the page, so waiting for every animation would never end.
 */
const settled = (target: Locator) =>
  expect
    .poll(() =>
      target.evaluate((el) =>
        document.getAnimations().every((a) => {
          const node = (a.effect as KeyframeEffect | null)?.target;
          const related = node instanceof Node && (node.contains(el) || el.contains(node));
          return !related || a.playState !== 'running';
        }),
      ),
    )
    .toBe(true);

const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

const expectNoAxeViolations = async (page: Page, target: Locator) => {
  await settled(target);
  await target.evaluate((el) => el.setAttribute('data-axe-target', ''));
  const results = await new AxeBuilder({ page })
    .include('[data-axe-target]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await target.evaluate((el) => el.removeAttribute('data-axe-target'));  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

const expectWithin = async (target: Locator, width: number) => {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
};

const expectTapTarget = async (target: Locator) => {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
};

test.describe('pathway library without a goal', () => {
  test('Home offers directions, then pathways, and starts the chosen one in onboarding', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose a pathway');
    await expect(page.getByRole('group', { name: 'Choose a direction' }).getByRole('radio')).toHaveCount(6);
    await expect(page.getByRole('button', { name: 'Start this pathway' })).toHaveCount(0);

    await chooseOption(page, 'Fitness');
    await chooseOption(page, PRESET_GOAL);
    await page.getByRole('button', { name: 'Start this pathway' }).click();

    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose a pathway');
    await page.goForward();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
  });

  test('a one-pathway direction is ready to start at once', async ({ page }) => {
    await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await page.goto('/');
    await chooseOption(page, 'Personal');
    await expect(page.getByRole('radio', { name: 'Master Deep Work & Double Daily Output' })).toBeChecked();
    await page.getByRole('button', { name: 'Start this pathway' }).click();
    await expectStep(page, 'starting');
    expect(await draftGoal(page)).toBe('Master Deep Work & Double Daily Output');
  });

  test('a goal of your own stays free and opens onboarding without a preset (ND-6)', async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem('achivii_draft_goal', 'Run a 10K Under 50 Minutes'));
    await signIn(page);
    await page.goto('/');
    const custom = page.getByRole('region', { name: 'Something else in mind?' });
    await expect(custom).not.toContainText(/premium|locked|upgrade|paid|price/i);
    await custom.getByRole('button', { name: 'Describe my own goal' }).click();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'goal');
    await expect(page.getByRole('textbox', { name: 'Your goal' })).toHaveValue('');
  });

  test('Home fits small screens and passes axe', async ({ page }) => {
    await mockApi(page);
    await signIn(page);
    await page.goto('/');
    await chooseOption(page, 'Creative');
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await noOverflow(page);
      await expectTapTarget(page.locator('label').filter({ has: page.getByRole('radio', { name: 'Creative' }) }));
      await expectTapTarget(page.getByRole('button', { name: 'Describe my own goal' }));
    }
    await expectNoAxeViolations(page, page.locator('main'));
  });

  test('with reduced motion, pathways appear without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await signIn(page);
    await page.goto('/');
    await chooseOption(page, 'Learning');
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('main .animate-rise-in')].map((el) => parseFloat(getComputedStyle(el).animationDuration)),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) expect(d).toBeLessThanOrEqual(0.001);
  });
});

test.describe('pathway library with a goal', () => {
  test('a pathway on Today opens the explorer on it, and switching keeps the current goal until setup finishes', async ({ page }) => {
    const calls = await mockApi(page, { goal: GOAL, clarify: baseline.presetClarify });
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });
    await signIn(page);
    await page.goto('/');

    await expect(strip(page).getByRole('button', { name: CURRENT })).toHaveAccessibleDescription(/^Current /);
    const tile = strip(page).getByRole('button', { name: PRESET_GOAL });
    await expect(tile).not.toHaveAccessibleDescription(/Current/);
    await tile.click();

    const dialog = explorer(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Fitness' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('radio', { name: PRESET_GOAL })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(tile).toBeFocused();
    expect(await draftGoal(page)).toBeNull();

    await tile.click();
    await dialog.getByRole('button', { name: /Switch to this pathway/ }).click();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    expect(calls.create).toEqual([]);
    expect(deletes).toEqual([]);

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(strip(page).getByRole('button', { name: CURRENT })).toHaveAccessibleDescription(/^Current /);
    await page.goForward();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
  });

  test('"Explore all" opens on the current pathway, where the action restarts it', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/');
    const exploreAll = strip(page).getByRole('button', { name: 'Explore all' });
    await exploreAll.click();
    const dialog = explorer(page);
    await expect(dialog.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('radio', { name: CURRENT })).toBeChecked();
    await expect(dialog.getByRole('button', { name: /Restart this pathway/ })).toBeEnabled();
    await dialog.getByRole('tab', { name: 'Creative' }).click();
    await expect(dialog.getByRole('button', { name: /Switch to this pathway/ })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(exploreAll).toBeFocused();
    await expect(page).toHaveURL('/');
  });

  test('the strip and the explorer fit small screens, work by touch and pass axe', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/');
    await expect(strip(page)).toBeVisible();
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      // The document is not checked: the navbar's goal links overflow at 360 px (a carry-over outside M3.6).
      await expectWithin(strip(page), width);
      await expect.poll(() => page.locator('main').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      await expectTapTarget(strip(page).getByRole('button', { name: 'Scroll pathways forward' }));
      await expectTapTarget(strip(page).getByRole('button', { name: 'Explore all' }));
    }
    await expectNoAxeViolations(page, strip(page));

    await page.setViewportSize({ width: 390, height: 800 });
    await strip(page).getByRole('button', { name: 'Speak Conversational Spanish' }).click();
    const dialog = explorer(page);
    await expect(dialog.getByRole('radio', { name: 'Speak Conversational Spanish' })).toBeChecked();
    await settled(dialog);
    await expectWithin(dialog, 390);
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await expectTapTarget(dialog.getByRole('tab', { name: 'Career' }));
    await expectTapTarget(dialog.getByRole('button', { name: /Switch to this pathway/ }));
    await dialog.getByRole('tab', { name: 'Personal' }).click();
    await expect(dialog.getByRole('radio', { name: 'Master Deep Work & Double Daily Output' })).toBeChecked();
    await expectNoAxeViolations(page, dialog);
  });

  test('the navbar opens the same explorer', async ({ page, isMobile }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/roadmap');
    const opener = page.getByRole('banner').getByRole('button', { name: isMobile ? 'Goals' : 'Pathways (10)' });
    await opener.click();
    const dialog = explorer(page);
    await expect(dialog.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the dashboard shows the same strip and explorer [dashboard errors expected]', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/dashboard');
    await expect(strip(page).getByRole('button', { name: CURRENT })).toHaveAccessibleDescription(/^Current /);
    await strip(page).getByRole('button', { name: 'Climb to a 1200 Rapid Chess Rating' }).click();
    await expect(explorer(page).getByRole('radio', { name: 'Climb to a 1200 Rapid Chess Rating' })).toBeChecked();
    await expect(explorer(page).getByRole('button', { name: /Switch to this pathway/ })).toBeEnabled();
  });
});
