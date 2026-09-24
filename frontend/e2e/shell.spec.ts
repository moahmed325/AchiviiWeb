import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { PRESET_GOAL, baseline, chooseOption, expectStep } from './onboardingFlow';
import { SHELL_GOAL_TITLE, STORED_OUTCOME, axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/** M5.2: the ND-7 shell. A rail on desktop, a bottom bar on mobile, a minimal top bar on onboarding. */

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));
const primary = (page: Page) => page.getByRole('navigation', { name: 'Primary' });
const explorer = (page: Page) => page.getByRole('dialog', { name: 'Explore pathways' });
const accountButton = (page: Page) => primary(page).getByRole('button', { name: /^Account/ });

/** The one known violation on /dashboard: FullDayVisualizer nests a Focus button in a button (M5.3 / M5.8). */
const KNOWN_DASHBOARD = /^nested-interactive: /;

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

/** Let the page fade in before axe measures contrast. Looping animations elsewhere are ignored. */
const settled = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );

const expectTapTargets = async (controls: Locator) => {
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    expect(box, await control.innerText()).not.toBeNull();
    expect(Math.min(box!.width, box!.height), await control.innerText()).toBeGreaterThanOrEqual(44);
  }
};

/** A legacy page that is too wide scrolls inside the shell's content column, so measure the column as well. */
const contentOverflow = (page: Page) =>
  page.locator('[data-shell="content"]').evaluate((el) => el.scrollWidth - el.clientWidth);

const entryNames = async (page: Page) =>
  primary(page)
    .locator('a, button')
    .filter({ visible: true })
    .evaluateAll((items) => items.map((item) => (item.textContent ?? '').replace(/\s+/g, ' ').trim()));

test.describe('entries', () => {
  test('with a goal: Today, Roadmap, Pathways and Account, and nothing else', async ({ page, isMobile }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/');

    const names = await entryNames(page);
    expect(names.map((name) => name.replace(/e2e@example\.com$/, ''))).toEqual(['Today', 'Roadmap', 'Pathways', 'Account']);
    await expect(primary(page).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await expect(primary(page).getByRole('link', { name: 'Roadmap' })).not.toHaveAttribute('aria-current');
    await expect(primary(page).getByText(/Journey|Progress|Coach|coming soon/i)).toHaveCount(0);
    await expect(page.getByText(/Achivii ©/)).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveCount(0);

    // Desktop: a rail down the left edge. Mobile: a bar across the bottom.
    const box = (await primary(page).boundingBox())!;
    if (isMobile) {
      expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 20);
      expect(box.y + box.height).toBeGreaterThan(page.viewportSize()!.height - 2);
    } else {
      expect(box.x).toBeLessThan(40);
      expect(box.height).toBeGreaterThan(400);
    }
  });

  test('without a goal: no Roadmap, and / still invites a pathway', async ({ page }) => {
    await mockApi(page, { goal: null });
    await signIn(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Choose a pathway' })).toBeVisible();
    const names = await entryNames(page);
    expect(names.map((name) => name.replace(/e2e@example\.com$/, ''))).toEqual(['Today', 'Pathways', 'Account']);
  });

  test('a goal that failed to load: the shell still renders, and Roadmap is hidden', async ({ page }) => {
    await mockApi(page, { goal: shellGoal(), activeStatus: 500 });
    await signIn(page);
    await page.goto('/');
    await expect(primary(page).getByRole('link', { name: 'Today' })).toBeVisible();
    await expect(primary(page).getByRole('link', { name: 'Roadmap' })).toHaveCount(0);
  });

  test('Today is active on /dashboard; Roadmap on /roadmap [dashboard errors expected]', async ({ page }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/dashboard');
    await expect(primary(page).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await primary(page).getByRole('link', { name: 'Roadmap' }).click();
    await expect(page).toHaveURL('/roadmap');
    await expect(primary(page).getByRole('link', { name: 'Roadmap' })).toHaveAttribute('aria-current', 'page');
    await expect(primary(page).getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  test('onboarding shows only the top bar: the wordmark and Account with Sign out', async ({ page }) => {
    await mockApi(page, { goal: null });
    await signIn(page);
    await page.goto('/onboarding');
    await expect(page.getByRole('heading', { level: 1, name: 'Where are you going?' })).toBeVisible();
    await expect(primary(page)).toHaveCount(0);
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('link', { name: 'Achivii, home' })).toHaveAttribute('href', '/');
    await banner.getByRole('button', { name: /^Account/ }).click();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset 90-Day Plan' })).toHaveCount(0);
    await expect(page.getByText(SHELL_GOAL_TITLE)).toHaveCount(0);
  });
});

test.describe('landmarks', () => {
  for (const url of ['/', '/dashboard', '/roadmap', '/onboarding']) {
    test(`${url} has one main#main, and the skip link moves focus to it [dashboard errors expected]`, async ({ page }) => {
      await mockApi(page, { goal: url === '/onboarding' ? null : shellGoal() });
      await signIn(page);
      await page.goto(url);
      await expect(page.locator('main#main')).toBeVisible();
      await expect(page.locator('main')).toHaveCount(1);
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'Skip to content' });
      await expect(skip).toBeFocused();
      const before = page.url();
      await page.keyboard.press('Enter');
      await expect(page.locator('main#main')).toBeFocused();
      expect(page.url()).toBe(before);
    });
  }
});

test.describe('layout and accessibility', () => {
  const screens = [
    { url: '/', goal: true },
    { url: '/', goal: false },
    { url: '/dashboard', goal: true },
    { url: '/roadmap', goal: true },
    { url: '/onboarding', goal: false },
  ];

  for (const screen of screens) {
    test(`${screen.url} ${screen.goal ? 'with' : 'without'} a goal: no overflow, 44 px targets, no new axe violation [dashboard errors expected]`, async ({
      page,
    }, testInfo) => {
      await mockApi(page, { goal: screen.goal ? shellGoal() : null });
      await signIn(page);
      await page.goto(screen.url);
      await expect(page.locator('main#main')).toBeVisible();
      const widths = testInfo.project.name === 'desktop' ? [1440, 1024] : [390, 375, 360];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        await settled(page);
        expect(await documentOverflow(page), `overflow at ${width}`).toBeLessThanOrEqual(1);
        if (screen.url !== '/onboarding') expect(await contentOverflow(page), `content overflow at ${width}`).toBeLessThanOrEqual(1);
        const shell = screen.url === '/onboarding' ? page.getByRole('banner') : primary(page);
        await expectTapTargets(shell.locator('a, button').filter({ visible: true }));
        const violations = (await axeViolations(page)).filter((v) => !(screen.url === '/dashboard' && KNOWN_DASHBOARD.test(v)));
        expect(violations, `axe at ${width}`).toEqual([]);
      }
    });
  }

  test('the bottom bar never covers the end of the page', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'The bottom bar is the mobile layout.');
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const main = (await page.locator('main#main').boundingBox())!;
    const bar = (await page.locator('[data-shell="bottom-bar"]').boundingBox())!;
    expect(main.y + main.height).toBeLessThanOrEqual(bar.y + 1);
  });

  test('a legacy page wider than the screen scrolls inside the content, and the bottom bar stays on screen and takes taps', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'The bottom bar is the mobile layout.');
    // With an empty roadmap and a long stored title, /roadmap is 407 px wide (section 6, Phase 6).
    const wide = { ...shellGoal(), clarifiedOutcome: SHELL_GOAL_TITLE, routine: undefined, roadmapWeeks: [], dailyTasks: [] };
    await mockApi(page, { goal: wide });
    await signIn(page);
    for (const width of [390, 360]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/roadmap');
      await expect(page.locator('main#main')).toBeVisible();
      expect(await contentOverflow(page), 'the Phase 6 overflow is still there, inside the column').toBeGreaterThan(1);
      expect(await documentOverflow(page)).toBeLessThanOrEqual(0);
      const bar = (await page.locator('[data-shell="bottom-bar"]').boundingBox())!;
      expect(Math.abs(bar.y + bar.height - 844)).toBeLessThanOrEqual(1);
      await primary(page).getByRole('button', { name: 'Pathways' }).click();
      await expect(explorer(page)).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  /** Focus mode is a legacy full-screen overlay inside the page (M5.5 replaces it); the shell must sit under it. */
  const expectShellCovered = async (page: Page, shell: 'rail' | 'bottom-bar') => {
    await settled(page);
    const box = (await page.locator(`[data-shell="${shell}"]`).boundingBox())!;
    const topmostIsShell = await page.evaluate(
      ({ x, y, shell }) => Boolean(document.elementFromPoint(x, y)?.closest(`[data-shell="${shell}"]`)),
      { x: box.x + box.width / 2, y: box.y + box.height / 2, shell },
    );
    expect(topmostIsShell).toBe(false);
  };

  test('focus mode on / covers the shell', async ({ page, isMobile }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expectShellCovered(page, isMobile ? 'bottom-bar' : 'rail');
  });

  test('focus mode on /dashboard covers the shell [dashboard errors expected]', async ({ page, isMobile }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /^Focus/ }).first().click();
    await expectShellCovered(page, isMobile ? 'bottom-bar' : 'rail');
  });

  test('with reduced motion, the shell has no running animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await accountButton(page).click();
    const durations = await page.evaluate(() =>
      [...document.querySelectorAll('[data-shell] *, [data-shell]')].flatMap((el) => {
        const style = getComputedStyle(el);
        return [parseFloat(style.animationDuration) || 0, parseFloat(style.transitionDuration) || 0];
      }),
    );
    for (const d of durations) expect(d).toBeLessThanOrEqual(0.001);
  });
});

test.describe('pathways, account and offline', () => {
  test('Pathways opens the explorer, and closing it returns focus', async ({ page }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    const opener = primary(page).getByRole('button', { name: 'Pathways' });
    await opener.click();
    await expect(explorer(page).getByRole('tab', { name: 'Business' })).toHaveAttribute('aria-selected', 'true');
    await expect(explorer(page).getByRole('button', { name: /Restart this pathway/ })).toBeEnabled();
    await page.keyboard.press('Escape');
    await expect(explorer(page)).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('a pathway chosen from the shell starts switch goal with no create and no DELETE (R-3, R-15)', async ({ page }) => {
    const calls = await mockApi(page, { goal: shellGoal(), clarify: baseline.presetClarify });
    const deletes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'DELETE') deletes.push(request.url());
    });
    await signIn(page);
    await page.goto('/roadmap');
    await primary(page).getByRole('button', { name: 'Pathways' }).click();
    await explorer(page).getByRole('tab', { name: 'Fitness' }).click();
    await chooseOption(page, PRESET_GOAL);
    await explorer(page).getByRole('button', { name: /Switch to this pathway/ }).click();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'starting');
    await expect.poll(() => calls.clarify.length).toBeGreaterThan(0);
    for (const body of calls.clarify) expect(body).toEqual({ rawGoal: PRESET_GOAL });
    expect(calls.create).toEqual([]);
    expect(deletes).toEqual([]);
    await expect(primary(page)).toHaveCount(0);
    await expect(page.getByRole('banner')).toBeVisible();
  });

  test('Account shows the goal the user chose, not the stored outcome', async ({ page }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await accountButton(page).click();
    const panel = page.getByText('Signed in as').filter({ visible: true }).locator('xpath=../..');
    await expect(panel).toContainText('e2e@example.com');
    await expect(panel).toContainText(SHELL_GOAL_TITLE);
    await expect(panel).not.toContainText(STORED_OUTCOME);
  });

  test('Account opens and closes from the keyboard, and Escape returns focus', async ({ page, isMobile }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    const trigger = accountButton(page);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const signOut = page.getByRole('button', { name: 'Sign out' });
    await expect(signOut).toBeVisible();
    if (isMobile) {
      await expect(page.getByRole('dialog', { name: 'Account' })).toBeVisible();
    } else {
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Reset 90-Day Plan' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(signOut).toBeFocused();
    }
    await page.keyboard.press('Escape');
    await expect(signOut).toBeHidden();
    await expect(trigger).toBeFocused();
    if (!isMobile) await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('keyboard only: the rail comes first, in order, and Account is reached and left by keyboard', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The rail is the desktop layout; the bottom bar follows the page in document order.');
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await expect(page.locator('main#main')).toBeVisible();
    const order: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').replace('e2e@example.com', '').trim();
        }),
      );
    }
    expect(order).toEqual(['Skip to content', 'Achivii, home', 'Today', 'Roadmap', 'Pathways', 'Account']);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Reset 90-Day Plan' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    // Leaving the panel by keyboard closes it.
    await expect(accountButton(page)).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main#main')))).toBe(true);
  });

  test('an outside click closes the desktop Account panel', async ({ page, isMobile }) => {
    test.skip(isMobile, 'The mobile Account is a sheet with its own scrim.');
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await accountButton(page).click();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await page.locator('main#main').click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden();
  });

  test('Reset: cancel sends nothing; confirm deletes once and opens onboarding', async ({ page }) => {
    const calls = await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await accountButton(page).click();
    const reset = page.getByRole('button', { name: 'Reset 90-Day Plan' });
    await reset.click();
    const confirm = page.getByRole('dialog', { name: 'Reset your 90-day plan?' });
    await expect(confirm).toContainText('deletes your current plan and all of its task progress');
    await confirm.getByRole('button', { name: 'Keep my plan' }).click();
    await expect(confirm).toBeHidden();
    await expect(reset).toBeFocused();
    expect(calls.resets).toBe(0);
    await expect(page).toHaveURL('/roadmap');

    await reset.click();
    await confirm.getByRole('button', { name: 'Reset plan' }).click();
    await expect(page).toHaveURL('/onboarding');
    expect(calls.resets).toBe(1);
    await expect(primary(page)).toHaveCount(0);
  });

  test('a failed reset says so and stays [network errors expected]', async ({ page }) => {
    const calls = await mockApi(page, { goal: shellGoal(), resetStatus: 500 });
    await signIn(page);
    await page.goto('/roadmap');
    await accountButton(page).click();
    await page.getByRole('button', { name: 'Reset 90-Day Plan' }).click();
    const confirm = page.getByRole('dialog', { name: 'Reset your 90-day plan?' });
    await confirm.getByRole('button', { name: 'Reset plan' }).click();
    await expect(confirm.getByRole('alert')).toHaveText("We couldn't reset your plan. Please try again.");
    await expect(page).toHaveURL('/roadmap');
    expect(calls.resets).toBe(1);
    expect(consoleErrors.filter((e) => !e.startsWith('Failed to reset goal'))).toEqual([]);
  });

  test('Sign out from the shell lands on the landing page', async ({ page }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.goto('/roadmap');
    await accountButton(page).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your ambition deserves a path.');
  });

  test('the offline chip appears in the shell from the load-time check, above the bottom bar', async ({ page, isMobile }) => {
    await mockApi(page, { goal: shellGoal(), healthDown: true });
    await signIn(page);
    await page.goto('/');
    const chip = page.getByRole('status').filter({ hasText: /^Offline$/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveCount(1);
    const box = (await chip.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    if (isMobile) {
      const nav = (await primary(page).boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(nav.y + 1);
    }
  });

  test('the offline chip appears in the onboarding top bar', async ({ page }) => {
    await mockApi(page, { goal: null, healthDown: true });
    await signIn(page);
    await page.goto('/onboarding');
    await expect(page.getByRole('banner').getByRole('status').filter({ hasText: /^Offline$/ })).toBeVisible();
  });
});
