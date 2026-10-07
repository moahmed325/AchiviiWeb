import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/**
 * M6.4: the journey on phone widths (/roadmap below 768px).
 *
 * Since the roadmap redesign (f62e59b, 30e20ab) one responsive layout serves every width: the 12-week strip, the lit
 * "You are here" card and a single gold rail of phase cards that open in place. The separate mobile vertical journey
 * and desktop staircase are no longer mounted on /roadmap.
 */


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

      // One vertical path serves phones: the week strip and a single progression rail of phase cards
      await expect(main.getByRole('img', { name: 'Week 1 of 12' })).toBeVisible();
      await expect(main.getByRole('region', { name: 'Your progression' })).toHaveCount(1);
      await expect(main.getByRole('button', { name: /^Weeks 1–4 / })).toBeVisible();

      await settled(page);

      // Verify zero horizontal overflow
      expect(await documentOverflow(page), `document overflow at ${vp.width}`).toBeLessThanOrEqual(1);
      expect(await contentOverflow(page), `content overflow at ${vp.width}`).toBeLessThanOrEqual(1);

      // Verify the "You are here" position is in view on load and names the active phase
      const youAreHere = main.getByRole('region', { name: 'Current position' });
      await expect(youAreHere).toBeInViewport();
      await expect(youAreHere).toContainText('You are here');
      await expect(youAreHere.getByRole('heading', { level: 2 })).toHaveText('Foundation');

      // Verify interactive button touch targets are >= 44x44px
      const buttons = main.locator('button:visible');
      expect(await buttons.count()).toBeGreaterThan(0);
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

      const main = page.locator('main#main');

      // Phase 1 (active) is expanded by default
      const phase1Btn = main.getByRole('button', { name: /^Weeks 1–4 .*Foundation/ });
      await expect(phase1Btn).toHaveAttribute('aria-expanded', 'true');

      // Phase 2 is collapsed by default
      const phase2Btn = main.getByRole('button', { name: /^Weeks 5–8 .*Acceleration/ });
      await expect(phase2Btn).toHaveAttribute('aria-expanded', 'false');
      const phase2Panel = page.locator(`#${await phase2Btn.getAttribute('aria-controls')}`);
      await expect(phase2Panel).toBeHidden();

      // Tap to expand Phase 2
      await phase2Btn.click();
      await expect(phase2Btn).toHaveAttribute('aria-expanded', 'true');
      await expect(phase2Panel).toBeVisible();

      // Future honesty: a future phase lists only what the plan holds (its weeks), never daily sessions or targets
      await expect(phase2Panel.getByRole('listitem')).toHaveCount(4);
      await expect(phase2Panel.getByRole('listitem').first()).toContainText('Week 5');
      await expect(phase2Panel).not.toContainText(/Session \d|Target|This week|Day \d/);

      // Collapse Phase 2
      await phase2Btn.click();
      await expect(phase2Btn).toHaveAttribute('aria-expanded', 'false');
      await expect(phase2Panel).toBeHidden();
    });
  }
});
