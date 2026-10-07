import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockApi, signIn } from './mockApi';
import { axeViolations, documentOverflow, shellGoal } from './shellFixtures';

/**
 * M6.5: Progress motion and reduced-motion path on /roadmap.
 * Verifies VDS §19-20, §25, §29, and Section 3.9 motion requirements.
 *
 * Since the roadmap redesign (f62e59b, 30e20ab) the motion lives on one responsive layout: the current week's segment
 * of the 12-week strip and the active node on the gold rail breathe (`dash-breathe`), and phase cards unfold through
 * `journey-accordion-content`. The reduced-motion path is the global rule in index.css.
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

/** The current week's segment in the 12-week strip: the page's progress indicator. */
const currentWeekSegment = (page: Page) =>
  page.getByRole('img', { name: 'Week 1 of 12' }).locator('.road-week[data-state="current"]');

/** The node on the rail where the user stands: the active step beacon. */
const activeRailNode = (page: Page) => page.locator('.road-row[data-status="active"] .road-node');

/** The first phase card's toggle, and the panel it controls. */
const phaseOne = async (page: Page) => {
  const toggle = page.getByRole('button', { name: /^Weeks 1–4 .*Foundation/ });
  const panel = page.locator(`#${await toggle.getAttribute('aria-controls')}`);
  return { toggle, panel };
};

const motionOf = (element: Locator) =>
  element.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      transitionProperty: style.transitionProperty,
      transitionDuration: style.transitionDuration,
    };
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

    // 1. Progress strip: exactly one current week, which breathes and eases its fill (R3)
    const segment = currentWeekSegment(page);
    await expect(segment).toHaveCount(1);
    await expect(segment).toBeVisible();
    const segmentMotion = await motionOf(segment);
    expect(segmentMotion.animationName).toContain('dash-breathe');
    expect(segmentMotion.transitionProperty).toContain('background-color');

    // 2. Active Step Illumination Beacon (R1, VDS §20)
    const activeStepNode = activeRailNode(page);
    await expect(activeStepNode).toHaveCount(1);
    await expect(activeStepNode).toBeVisible();
    // In standard motion, the breathing keyframe animation runs
    expect((await motionOf(activeStepNode)).animationName).toContain('dash-breathe');

    // 3. Fluid Unfolding for Strategic Phase Accordion (R2)
    const { toggle: phase1Toggle, panel: phase1Panel } = await phaseOne(page);
    await expect(phase1Panel).toHaveClass(/journey-accordion-content/);
    await expect(phase1Panel).toHaveAttribute('data-state', 'open');
    expect((await motionOf(phase1Panel)).transitionProperty).toContain('max-height');

    // Toggle Phase 1 closed
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

    // 1. "You are here" card is shown, and the strip's current week breathes
    const youAreHere = page.getByRole('region', { name: 'Current position' });
    await expect(youAreHere).toBeVisible();
    await expect(youAreHere).toContainText('You are here');
    expect((await motionOf(currentWeekSegment(page))).animationName).toContain('dash-breathe');

    // 2. Active step node has beacon
    const activeStep = activeRailNode(page);
    await expect(activeStep).toBeVisible();
    expect((await motionOf(activeStep)).animationName).toContain('dash-breathe');

    // 3. Mobile accordion fluid transition
    const { toggle: mobileToggle, panel: mobilePanel } = await phaseOne(page);
    await expect(mobilePanel).toBeVisible();
    await expect(mobilePanel).toHaveClass(/journey-accordion-content/);
    await expect(mobilePanel).toHaveAttribute('data-state', 'open');

    // Toggle closed, and the chevron turns back
    const chevron = mobileToggle.locator('svg');
    await mobileToggle.click();
    await expect(mobilePanel).toHaveAttribute('data-state', 'closed');
    await expect(mobilePanel).toBeHidden();
    expect(await chevron.getAttribute('class')).not.toContain('rotate-180');

    // Toggle back open
    await mobileToggle.click();
    await expect(mobilePanel).toHaveAttribute('data-state', 'open');
    await expect(mobilePanel).toBeVisible();
    expect(await chevron.getAttribute('class')).toContain('rotate-180');
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
      await expect(main.getByRole('region', { name: 'Current position' })).toBeVisible();

      // 2. Active step beacon and current-week animations are disabled (none, or clamped to 0.01ms)
      const isAnimationDisabled = (motion: Awaited<ReturnType<typeof motionOf>>) =>
        motion.animationName === 'none' || parseFloat(motion.animationDuration) <= 0.01;
      const beaconEl = activeRailNode(page);
      await expect(beaconEl).toBeVisible();
      expect(isAnimationDisabled(await motionOf(beaconEl))).toBe(true);
      expect(isAnimationDisabled(await motionOf(currentWeekSegment(page)))).toBe(true);

      // No animation anywhere on the page outlasts the clamp or loops
      const lingering = await page.evaluate(() =>
        document
          .getAnimations()
          .map((animation) => animation.effect?.getComputedTiming())
          .filter((timing) => !timing || Number(timing.duration) > 0.01 || timing.iterations !== 1).length,
      );
      expect(lingering).toBe(0);

      // 3. Accordion transitions are instantaneous
      const accordionPanel = page.locator('.journey-accordion-content:visible').first();
      await expect(accordionPanel).toBeVisible();
      expect(parseFloat((await motionOf(accordionPanel)).transitionDuration) <= 0.01).toBe(true);

      // 4. Progress strip transition is instantaneous / immediate
      expect(parseFloat((await motionOf(currentWeekSegment(page))).transitionDuration) <= 0.01).toBe(true);

      // 5. Zero Horizontal Scroll Overflow
      const overflow = await documentOverflow(page);
      expect(overflow).toBeLessThanOrEqual(1);

      // 6. Zero Axe Accessibility Violations
      const violations = await axeViolations(page);
      expect(violations).toEqual([]);
    });
  }
});
