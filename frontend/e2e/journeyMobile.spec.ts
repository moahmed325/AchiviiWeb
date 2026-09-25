import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/** M6.4: Mobile vertical journey (/roadmap on viewports < 768px). */

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (/errors expected\]/.test(testInfo.title)) return;
  expect(consoleErrors).toEqual([]);
});

const settled = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );

const contentOverflow = (page: Page) =>
  page.locator('[data-shell="content"]').evaluate((el) => el.scrollWidth - el.clientWidth);

const expectTapTargets = async (controls: Locator) => {
  for (const control of await controls.all()) {
    const box = await control.boundingBox();
    if (!box) continue;
    expect(box.height, await control.innerText()).toBeGreaterThanOrEqual(44);
    expect(box.width, await control.innerText()).toBeGreaterThanOrEqual(44);
  }
};

const MOBILE_VIEWPORTS = [
  { name: 'iPhone (390x844)', width: 390, height: 844 },
  { name: 'Android Compact (360x800)', width: 360, height: 800 },
];

test.describe('Mobile Vertical Journey (M6.4)', () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test(`renders vertical journey on ${vp.name} without overflow and with 0 axe violations`, async ({ page }) => {
      await mockApi(page, { goal: shellGoal() });
      await signIn(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/roadmap');

      // Verify main landmark
      const main = page.locator('main#main');
      await expect(main).toBeVisible();

      // Verify mobile vertical component is shown and desktop staircase is hidden
      await expect(page.getByTestId('mobile-vertical-journey')).toBeVisible();
      await expect(page.getByText('The 90-Day Ascent')).toBeHidden();

      await settled(page);

      // Verify zero horizontal overflow
      expect(await documentOverflow(page), `document overflow at ${vp.width}`).toBeLessThanOrEqual(1);
      expect(await contentOverflow(page), `content overflow at ${vp.width}`).toBeLessThanOrEqual(1);

      // Verify "You Are Here" position badge is visible on load
      const youAreHereBadge = page.getByTestId('you-are-here-badge');
      await expect(youAreHereBadge).toBeVisible();
      await expect(youAreHereBadge).toContainText('You are here');

      // Verify interactive button touch targets are >= 44x44px
      const buttons = main.locator('button:visible');
      await expectTapTargets(buttons);

      // Verify accessibility with 0 axe violations
      const violations = await axeViolations(page);
      expect(violations, `axe violations at ${vp.width}`).toEqual([]);
    });

    test(`interacts with mobile phase accordion on ${vp.name} respecting future honesty`, async ({ page }) => {
      await mockApi(page, { goal: shellGoal() });
      await signIn(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/roadmap');

      await expect(page.getByTestId('mobile-vertical-journey')).toBeVisible();

      // Phase 1 (active) is expanded by default
      const phase1Btn = page.getByRole('button', { name: /Landing 1/i });
      await expect(phase1Btn).toHaveAttribute('aria-expanded', 'true');

      // Phase 2 is collapsed by default
      const phase2Btn = page.getByRole('button', { name: /Landing 2/i });
      await expect(phase2Btn).toHaveAttribute('aria-expanded', 'false');

      // Tap to expand Phase 2
      await phase2Btn.click();
      await expect(phase2Btn).toHaveAttribute('aria-expanded', 'true');

      // Verify future honesty on expanded future phase
      await expect(page.getByText(/Future Honesty · Daily sessions designed after Week/i).first()).toBeVisible();

      // Collapse Phase 2
      await phase2Btn.click();
      await expect(phase2Btn).toHaveAttribute('aria-expanded', 'false');
    });
  }
});
