import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockApi, type GenerationStreamStep } from './mockApi';
import {
  PRESET_GOAL,
  answerPresetQuestions,
  baseline,
  chooseOption,
  chooseSchedule,
  generate,
} from './onboardingFlow';

const stream = (name: string) =>
  (JSON.parse(readFileSync(new URL(`./fixtures/generation/${name}.json`, import.meta.url), 'utf8')) as { events: GenerationStreamStep[] }).events;

const v2 = stream('v2-success');
const v1 = stream('v1-fallback');
const failed = stream('custom-error');
const METHOD = 'The TED Masterclass Framework';
const WHY = 'A single throughline, three acts, and a rehearsed close fit a 15-minute talk.';

test.describe.configure({ timeout: 60_000 });

/** Steps only: the stream stays open so the generating screen can be checked without racing `done`. */
const holdAtPlan = v2.filter((step) => step.event.type !== 'done');

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

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

const reachReview = async (page: Page) => {
  await page.goto('/onboarding');
  await chooseOption(page, 'Fitness');
  await chooseOption(page, PRESET_GOAL);
  await page.getByRole('button', { name: 'Start this pathway' }).click();
  await answerPresetQuestions(page, baseline.presetClarify.followUpQuestions);
  await chooseSchedule(page, 'review');
};

const expectNoAxeViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .include('#main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

const stage = (page: Page, title: string) => page.getByRole('listitem').filter({ hasText: title });
const methodName = (page: Page) => page.getByText(METHOD, { exact: true });
const whyChosen = (page: Page) => page.getByText(WHY, { exact: true });

test('v2 stream shows the method name and reason only after method, then opens the dashboard [dashboard errors expected]', async ({
  page,
}) => {
  await mockApi(page, { clarify: baseline.presetClarify, createStream: v2 });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  await expect(page.getByRole('heading', { name: 'Building your path' })).toBeVisible();
  await expect(stage(page, 'Choosing your method').getByText('Now')).toBeVisible();
  await expect(page.getByText('Search sources')).toHaveCount(0);
  await expect(methodName(page)).toHaveCount(0);

  await expect(methodName(page)).toBeVisible();
  await expect(whyChosen(page)).toBeVisible();
  await expect(stage(page, 'Building your 90-day journey').getByText('Done')).toBeVisible();
  await expect(stage(page, 'Designing your first steps').getByText('Now')).toBeVisible();
  await expect(page.getByText('Search sources')).toHaveCount(0);
  await expect(page).toHaveURL('/dashboard');
});

test('v1 stream completes choosing without a method stage or an invented name [dashboard errors expected]', async ({ page }) => {
  await mockApi(page, { clarify: baseline.presetClarify, createStream: v1 });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  await expect(stage(page, 'Choosing your method').getByText('Now')).toBeVisible();
  await expect(page.getByText('Building your 90-day journey')).toHaveCount(0);

  await expect(stage(page, 'Choosing your method').getByText('Done')).toBeVisible();
  await expect(stage(page, 'Designing your first steps').getByText('Now')).toBeVisible();
  await expect(page.getByText('Building your 90-day journey')).toHaveCount(0);
  await expect(methodName(page)).toHaveCount(0);
  await expect(page.getByText('This is taking longer than usual. Still working (88s).')).toBeVisible();
  await expect(page.getByText('Search sources')).toHaveCount(0);
  await expect(page).toHaveURL('/dashboard');
});

test('an error after search still explains the failure and keeps the answers [errors expected]', async ({ page }) => {
  await mockApi(page, { clarify: baseline.presetClarify, createStream: failed });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText("We couldn't build your plan");
  await expect(alert).toContainText("Couldn't design your roadmap right now. Please try again.");
  await expect(page.getByText('Search sources')).toHaveCount(0);
  await expect(page).toHaveURL(/\/onboarding/);
  await alert.getByRole('button', { name: 'Review your answers' }).click();
  await expect(page.getByRole('heading', { name: 'Before we build your path' })).toBeVisible();
});

test('reduced motion keeps every visible stage readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page, { clarify: baseline.presetClarify, createStream: holdAtPlan });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  await expect(page.getByText('Understanding your goal')).toBeVisible();
  await expect(stage(page, 'Choosing your method').getByText('Now')).toBeVisible();
  const opacities = await page.locator('main li').evaluateAll((items) => items.map((item) => getComputedStyle(item).opacity));
  expect(opacities.length).toBeGreaterThan(0);
  expect(opacities.every((opacity) => opacity === '1')).toBe(true);
  await expect(page.getByText('Search sources')).toHaveCount(0);
});

test('the generating screen has no axe violations', async ({ page }, testInfo) => {
  await mockApi(page, { clarify: baseline.presetClarify, createStream: holdAtPlan });
  await signIn(page);
  await reachReview(page);
  await generate(page);
  await expect(methodName(page)).toBeVisible();
  expect(page.viewportSize()?.width).toBe(testInfo.project.name === 'desktop' ? 1440 : 390);
  await expectNoAxeViolations(page);
});

test('the generating screen does not overflow at 360px', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Checked once, at 360px');
  await page.setViewportSize({ width: 360, height: 800 });
  await mockApi(page, { clarify: baseline.presetClarify, createStream: holdAtPlan });
  await signIn(page);
  await reachReview(page);
  await generate(page);
  await expect(methodName(page)).toBeVisible();
  const overflow = await page.locator('#main').evaluate((main) => main.scrollWidth - main.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByText('Search sources')).toHaveCount(0);
});

const searchOnly: GenerationStreamStep[] = [
  {
    delayMs: 0,
    event: {
      type: 'step',
      id: 'search',
      label: 'Comparing methods for your answers',
      elapsedMs: 0,
      slow: false,
    },
  },
];

test('silence after search shows still-working on Choosing your method', async ({ page }) => {
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page, { clarify: baseline.presetClarify, createStream: searchOnly });
  await signIn(page);
  await page.clock.resume();
  await reachReview(page);
  await generate(page);

  await expect(stage(page, 'Choosing your method').getByText('Now')).toBeVisible();
  await expect(page.getByText(/Still working/)).toHaveCount(0);

  await page.clock.fastForward(21_000);
  const line = page.getByText(/This is taking longer than usual\. Still working \(\d+s\)\./);
  await expect(line).toBeVisible();
  const seconds = Number((await line.innerText()).match(/\((\d+)s\)/)?.[1]);
  expect(seconds).toBeGreaterThanOrEqual(20);
  await expect(stage(page, 'Choosing your method')).toContainText('Still working');
  await expect(stage(page, 'Designing your first steps')).not.toContainText('Still working');
  await expect(page.getByText('Search sources')).toHaveCount(0);
  await expect(page.getByText(/about \d+ seconds left/)).toHaveCount(0);
  const opacity = await line.evaluate((node) => getComputedStyle(node).opacity);
  expect(opacity).toBe('1');
});

test('a server error keeps finished stages, and retry builds again [dashboard errors expected]', async ({ page }) => {
  await mockApi(page, { clarify: baseline.presetClarify, createStream: failed, createStreamNext: [v2] });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText("We couldn't build your plan");
  await expect(alert).toContainText("Couldn't design your roadmap right now. Please try again.");
  await expect(stage(page, 'Understanding your goal').getByText('Done')).toBeVisible();
  await expect(stage(page, 'Designing your first steps').getByText('Done')).toHaveCount(0);
  await expect(page.getByText('Building your 90-day journey')).toHaveCount(0);
  await expect(methodName(page)).toHaveCount(0);

  await expect(alert.getByRole('heading', { name: "We couldn't build your plan" })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(alert.getByRole('button', { name: 'Review your answers' })).toBeFocused();
  const outline = await page.locator(':focus').evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.press('Tab');
  await expect(alert.getByRole('button', { name: 'Try again' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Building your path' })).toBeVisible();
  await expect(methodName(page)).toHaveCount(0);
  await expect(stage(page, 'Choosing your method').getByText('Now')).toBeVisible();
  await expect(methodName(page)).toBeVisible();
  await expect(page).toHaveURL('/dashboard');
  expect(await page.evaluate(() => (window as Window & { __achiviiCreates?: number }).__achiviiCreates)).toBe(2);
});

test('an unsafe goal uses Achivii’s sentence on the same screen [errors expected]', async ({ page }) => {
  const unsafe: GenerationStreamStep[] = [
    ...searchOnly,
    {
      delayMs: 50,
      event: { type: 'error', error: 'This goal is outside what Achivii can plan safely.', elapsedMs: 80, slow: false },
    },
  ];
  await mockApi(page, { clarify: baseline.presetClarify, createStream: unsafe });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText("We couldn't build your plan");
  await expect(alert).toContainText('This goal is outside what Achivii can plan safely.');
  await expect(page.getByText('Failed to fetch')).toHaveCount(0);
  await expect(stage(page, 'Understanding your goal').getByText('Done')).toBeVisible();
  await expect(page.getByText('Building your 90-day journey')).toHaveCount(0);
});

test('a stream that ends early says the plan was not ready [errors expected]', async ({ page }) => {
  const ended: GenerationStreamStep[] = [...searchOnly, { delayMs: 50, event: { type: 'end' } }];
  await mockApi(page, { clarify: baseline.presetClarify, createStream: ended });
  await signIn(page);
  await reachReview(page);
  await generate(page);

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Plan stream ended before a plan was ready.');
  await expect(page.getByText('Failed to fetch')).toHaveCount(0);
  await expect(stage(page, 'Designing your first steps').getByText('Done')).toHaveCount(0);
});

test('the error screen has no axe violations [errors expected]', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockApi(page, { clarify: baseline.presetClarify, createStream: failed });
  await signIn(page);
  await reachReview(page);
  await generate(page);
  const alert = page.getByRole('alert');
  await expect(alert).toContainText("We couldn't build your plan");
  const opacity = await alert.evaluate((node) => getComputedStyle(node).opacity);
  expect(opacity).toBe('1');
  expect(page.viewportSize()?.width).toBe(testInfo.project.name === 'desktop' ? 1440 : 390);
  await expectNoAxeViolations(page);
});

test('the error screen does not overflow at 360px [errors expected]', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Checked once, at 360px');
  await page.setViewportSize({ width: 360, height: 800 });
  await mockApi(page, { clarify: baseline.presetClarify, createStream: failed });
  await signIn(page);
  await reachReview(page);
  await generate(page);
  await expect(page.getByRole('alert')).toBeVisible();
  const overflow = await page.locator('#main').evaluate((main) => main.scrollWidth - main.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
