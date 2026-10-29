import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
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

const draftGoal = (page: Page) => page.evaluate(() => localStorage.getItem('achivii_draft_goal'));
const explorer = (page: Page) => page.getByRole('dialog', { name: 'Explore pathways' });
const strip = (page: Page) => page.getByRole('region', { name: 'Pathways', exact: true });
const shellPathways = (page: Page) => page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Pathways' });

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
 * animations elsewhere on the page, so waiting for every animation would never end. The explorer has its own
 * decorative loops (the destination star's glow), so loops are not waited for: they never finish.
 */
const settled = (target: Locator) =>
  expect
    .poll(() =>
      target.evaluate((el) =>
        document.getAnimations().every((a) => {
          const node = (a.effect as KeyframeEffect | null)?.target;
          const related = node instanceof Node && (node.contains(el) || el.contains(node));
          const loops = a.effect?.getTiming().iterations === Infinity;
          return !related || loops || a.playState !== 'running';
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

const expectTapTarget = async (target: Locator) => {
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44);
};

test.describe('Home without a goal (ND-28)', () => {
  test('Home asks for the goal and starts onboarding with it', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.presetClarify });
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you want to achieve?');
    await page.getByRole('textbox', { name: 'What do you want to achieve?' }).fill(PRESET_GOAL);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'days');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you want to achieve?');
    await page.goForward();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'days');
  });

  test('an example starts in one tap', async ({ page }) => {
    await mockApi(page, { clarify: baseline.customClarify });
    await signIn(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Speak conversational Spanish' }).click();
    await expectStep(page, 'days');
    expect(await draftGoal(page)).toBe('Speak conversational Spanish');
  });

  test('Home fits small screens and passes axe', async ({ page }) => {
    await mockApi(page);
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What do you want to achieve?');
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await noOverflow(page);
      await expectTapTarget(page.getByRole('textbox', { name: 'What do you want to achieve?' }));
      await expectTapTarget(page.getByRole('button', { name: 'Get fit' }));
    }
    await expectNoAxeViolations(page, page.locator('main'));
  });
});

test.describe('pathway library with a goal', () => {
  // M5.3: the strip left Today; the shell's Pathways entry is how Today reaches the explorer. /dashboard is an overview
  // again (ND-19, superseding OD-3) and has no strip either.
  test('Pathways from Today opens the explorer, and switching keeps the current goal until setup finishes', async ({ page }) => {
    const calls = await mockApi(page, { goal: GOAL, clarify: baseline.presetClarify });
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });
    await signIn(page);
    await page.goto('/');

    await expect(strip(page)).toHaveCount(0);
    const opener = shellPathways(page);
    await opener.click();

    const dialog = explorer(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: 'Fitness' }).click();
    await chooseOption(page, PRESET_GOAL);
    await expect(dialog.getByRole('radio', { name: PRESET_GOAL })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(await draftGoal(page)).toBeNull();

    await opener.click();
    await dialog.getByRole('tab', { name: 'Fitness' }).click();
    await chooseOption(page, PRESET_GOAL);
    await dialog.getByRole('button', { name: /Switch to this pathway/ }).click();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'days');
    expect(await draftGoal(page)).toBe(PRESET_GOAL);
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    expect(calls.create).toEqual([]);
    expect(deletes).toEqual([]);

    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(CURRENT);
    await page.goForward();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'days');
  });

  test('Pathways from Today opens on the current pathway, where the action restarts it', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/');
    const exploreAll = shellPathways(page);
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

  test('/dashboard is the overview (ND-19), without the retired strip, and its Pathways entry opens the explorer', async ({
    page,
  }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('main').getByText(CURRENT)).toBeVisible();
    await expect(strip(page)).toHaveCount(0);

    const opener = shellPathways(page);
    await opener.click();
    const dialog = explorer(page);
    await expect(dialog.getByRole('radio', { name: CURRENT })).toBeChecked();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect(page).toHaveURL('/dashboard');
  });

  test('the app navigation opens the same explorer', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/roadmap');
    const opener = page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Pathways' });
    await opener.click();
    const dialog = explorer(page);
    await expect(dialog.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('the app navigation on Today (/) opens the explorer, fits small screens and passes axe', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/');
    const opener = page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Pathways' });
    await opener.click();
    const dialog = explorer(page);
    await expect(dialog.getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    // The project's own size is restored after, so focus returns to the same shell control that opened the dialog.
    const viewport = page.viewportSize()!;
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 800 });
      await noOverflow(page);
      await expectTapTarget(dialog.getByRole('tab', { name: 'Business' }));
    }
    await page.setViewportSize(viewport);
    await expectNoAxeViolations(page, dialog);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});
