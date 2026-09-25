import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/**
 * M6.5: Progress motion and reduced-motion path on /roadmap.
 * Verifies VDS §19-20, §25, §29, and Section 3.9 motion requirements.
 */

const signIn = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

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

test.describe('Journey Motion (M6.5) — Standard Motion Mode', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('desktop /roadmap exhibits progress bar transition, beacon illumination, and fluid accordion', async ({
    page,
  }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/roadmap');

    // 1. Layer 1 Progress Bar Fill (R3)
    const progressBar = page.locator('[data-testid="journey-progress-bar"]');
    await expect(progressBar).toBeVisible();
    await expect(progressBar).toHaveClass(/journey-progress-bar/);

    const transitionStyle = await progressBar.evaluate((el) => window.getComputedStyle(el).transition);
    expect(transitionStyle).toContain('width');

    // 2. Active Step Illumination Beacon (R1, VDS §20)
    const activeStepNode = page.locator('.journey-beacon:visible').first();
    await expect(activeStepNode).toBeVisible();

    const activeAnimation = await activeStepNode.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        animationName: style.animationName,
        boxShadow: style.boxShadow,
      };
    });
    // In standard motion, beacon-breathe keyframe animation runs
    expect(activeAnimation.animationName).toContain('beacon-breathe');

    // 3. Fluid Unfolding for Strategic Phase Accordion (R2)
    const phase1Panel = page.locator('#phase-panel-p1');
    await expect(phase1Panel).toHaveClass(/journey-accordion-content/);
    await expect(phase1Panel).toHaveAttribute('data-state', 'open');

    // Toggle Phase 1 closed
    const phase1Toggle = page.getByRole('button', { name: /Phase 1 of/i });
    await phase1Toggle.click();
    await expect(phase1Panel).toHaveAttribute('data-state', 'closed');

    // Verify chevron rotates
    const chevron = phase1Toggle.locator('svg');
    const chevronClass = await chevron.getAttribute('class');
    expect(chevronClass).not.toContain('rotate-180');

    // Toggle Phase 1 back open
    await phase1Toggle.click();
    await expect(phase1Panel).toHaveAttribute('data-state', 'open');
    const openChevronClass = await chevron.getAttribute('class');
    expect(openChevronClass).toContain('rotate-180');
  });

  test('mobile /roadmap exhibits active step beacon, smooth accordion, and rotating chevrons', async ({
    page,
  }) => {
    await mockApi(page, { goal: shellGoal() });
    await signIn(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/roadmap');

    // 1. "You are here" badge beacon
    const mobileBadge = page.locator('[data-testid="you-are-here-badge"]');
    await expect(mobileBadge).toBeVisible();
    await expect(mobileBadge).toHaveClass(/journey-beacon/);

    // 2. Active step node has beacon
    const activeStep = page.locator('[data-testid="active-step-node"]');
    await expect(activeStep).toBeVisible();
    await expect(activeStep).toHaveClass(/journey-beacon/);

    // 3. Mobile accordion fluid transition
    const mobilePanel = page.locator('#mobile-phase-p1');
    await expect(mobilePanel).toBeVisible();
    await expect(mobilePanel).toHaveClass(/journey-accordion-content/);
    await expect(mobilePanel).toHaveAttribute('data-state', 'open');

    // Toggle closed
    const mobileToggle = page.getByRole('button', { name: /Landing 1/i });
    await mobileToggle.click();
    await expect(mobilePanel).toHaveAttribute('data-state', 'closed');

    // Toggle back open
    await mobileToggle.click();
    await expect(mobilePanel).toHaveAttribute('data-state', 'open');
  });
});

test.describe('Journey Motion (M6.5) — Strict Reduced-Motion Path', () => {
  test.use({ reducedMotion: 'reduce' });

  const VIEWPORTS = [
    { name: 'Desktop (1440x900)', width: 1440, height: 900 },
    { name: 'iPhone (390x844)', width: 390, height: 844 },
    { name: 'Android Compact (360x800)', width: 360, height: 800 },
  ];

  for (const vp of VIEWPORTS) {
    test(`renders immediately without motion delay, zero horizontal overflow, and 0 axe violations on ${vp.name}`, async ({
      page,
    }) => {
      await mockApi(page, { goal: shellGoal() });
      await signIn(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/roadmap');

      // 1. Verify main content rendered immediately with opacity 1
      const main = page.locator('main#main');
      await expect(main).toBeVisible();
      const mainOpacity = await main.evaluate((el) => window.getComputedStyle(el).opacity);
      expect(Number(mainOpacity)).toBe(1);

      // 2. Active step beacon animation is disabled (animation is none / 0 duration)
      const beaconEl = page.locator('.journey-beacon:visible').first();
      await expect(beaconEl).toBeVisible();
      const beaconComputed = await beaconEl.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          animationName: style.animationName,
          animationDuration: style.animationDuration,
        };
      });
      // In reduced motion, animation is none or duration is clamped to 0.01ms
      const isAnimationDisabled =
        beaconComputed.animationName === 'none' ||
        parseFloat(beaconComputed.animationDuration) <= 0.01;
      expect(isAnimationDisabled).toBe(true);

      // 3. Accordion transitions are instantaneous
      const accordionPanel = page.locator('.journey-accordion-content:visible').first();
      if (await accordionPanel.isVisible()) {
        const accordionTransition = await accordionPanel.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.transitionDuration;
        });
        const durationSeconds = parseFloat(accordionTransition);
        expect(durationSeconds <= 0.01).toBe(true);
      }

      // 4. Progress bar transition is instantaneous / immediate
      const progressBar = page.locator('[data-testid="journey-progress-bar"]');
      if (await progressBar.isVisible()) {
        const barTransition = await progressBar.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.transitionDuration;
        });
        const barDuration = parseFloat(barTransition);
        expect(barDuration <= 0.01).toBe(true);
      }

      // 5. Zero Horizontal Scroll Overflow
      const overflow = await documentOverflow(page);
      expect(overflow).toBeLessThanOrEqual(1);

      // 6. Zero Axe Accessibility Violations
      const violations = await axeViolations(page);
      expect(violations).toEqual([]);
    });
  }
});
