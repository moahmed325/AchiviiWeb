import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockApi } from './mockApi';

const GOAL = {
  id: 'g-e2e',
  userId: 'u-e2e',
  rawGoal: 'Build & Ship a SaaS Web App',
  clarifiedOutcome: 'Build & Ship a SaaS Web App',
  status: 'active',
  startDate: '2026-09-01T00:00:00.000Z',
  targetDate: '2026-11-30T00:00:00.000Z',
  currentWeek: 1,
  roadmapWeeks: [],
  dailyTasks: [],
};

const signIn = (page: Page) => page.addInitScript(() => localStorage.setItem('achivii_auth_token', 'e2e-token'));

async function fill(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

let consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  page.on('console', (message) => {
    // Chromium logs every 4xx/5xx response; the error responses are what these tests exercise.
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
});

// Playwright requires an object pattern here even when no fixture is used.
// eslint-disable-next-line no-empty-pattern
test.afterEach(async ({}, testInfo) => {
  if (testInfo.title.includes('[network errors expected]')) return;
  expect(consoleErrors).toEqual([]);
});

test.describe('entry points', () => {
  test('every landing CTA opens the matching auth screen', async ({ page, isMobile }) => {
    await mockApi(page);
    await page.goto('/');

    await page.locator('#top').getByRole('link', { name: 'Start your journey' }).click();
    await expect(page).toHaveURL('/signup');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');

    await page.goBack();
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');

    await page.goBack();
    await page.getByRole('link', { name: /Run a 10K Under 50 Minutes/ }).click();
    await expect(page).toHaveURL('/signup?pathway=run10k');
    await expect(page.getByText('Your chosen journey').locator('visible=true')).toHaveCount(1);
    await expect(page.getByText('35 min a day').locator('visible=true')).toHaveCount(1);

    await page.goBack();
    await page.getByRole('link', { name: 'I already have an account' }).click();
    await expect(page).toHaveURL('/login');

    await page.goBack();
    await page.getByRole('contentinfo').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');

    if (!isMobile) await expect(page.getByRole('complementary')).toContainText('You have somewhere to go.');
  });

  test('back from an auth screen returns to the landing page', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.locator('#top').getByRole('link', { name: 'Start your journey' }).click();
    await expect(page).toHaveURL('/signup');
    await page.goBack();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your ambition deserves a path.');
  });

  test('reload keeps the auth screen and the chosen pathway', async ({ page }) => {
    await mockApi(page);
    await page.goto('/signup?pathway=run10k');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create your account');
    await expect(page.getByText('Run a 10K Under 50 Minutes').locator('visible=true')).toHaveCount(1);
  });
});

test.describe('after authentication', () => {
  test('a fresh sign-up goes to onboarding', async ({ page }) => {
    await mockApi(page);
    await page.goto('/signup');
    await fill(page, 'new@example.com', 'secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/onboarding');
  });

  test('a sign-up from a pathway reaches onboarding with it preselected', async ({ page }) => {
    await mockApi(page);
    await page.goto('/signup?pathway=run10k');
    await fill(page, 'new@example.com', 'secret1');
    await page.getByLabel('Password', { exact: true }).press('Enter');
    await expect(page).toHaveURL('/onboarding');
    expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBe('Run a 10K Under 50 Minutes');
    await expect(page.getByText('Run a 10K Under 50 Minutes').locator('visible=true').first()).toBeVisible();
  });

  test('sign-in with a goal goes to Today, and a chosen pathway does not replace it', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await page.goto('/login?pathway=run10k');
    await fill(page, 'e2e@example.com', 'secret1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('status').filter({ hasText: 'You already have a journey in progress' })).toContainText(
      'Run a 10K Under 50 Minutes',
    );
    expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBeNull();
    const dismiss = await page.getByRole('button', { name: 'Dismiss' }).boundingBox();
    expect(Math.min(dismiss!.width, dismiss!.height)).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText('You already have a journey in progress')).toHaveCount(0);
  });

  test('a protected page sends a signed-out visitor to sign-in and back', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await page.goto('/roadmap');
    await expect(page).toHaveURL('/login?next=%2Froadmap');
    await fill(page, 'e2e@example.com', 'secret1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/roadmap');
  });

  test('visiting /login while signed in moves on without showing the form', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/login');
    await expect(page).toHaveURL('/');
    await page.goto('/signup?pathway=saas');
    await expect(page).toHaveURL('/');
  });

  test('signing out returns to the landing page', async ({ page }) => {
    await mockApi(page, { goal: GOAL });
    await signIn(page);
    await page.goto('/roadmap');
    await page.locator('button[aria-haspopup="true"]').click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your ambition deserves a path.');
  });
});

test.describe('form behaviour', () => {
  test('validates before sending, and a double click sends once', async ({ page }) => {
    const calls = await mockApi(page, { authDelayMs: 800 });
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your email address.')).toBeVisible();
    await expect(page.getByText('Choose a password.')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();
    expect(calls.signup).toBe(0);

    await fill(page, 'new@example.com', 'secret1');
    await page.getByRole('button', { name: 'Create account' }).dblclick();
    await expect(page.getByRole('button', { name: 'Creating your account…' })).toHaveAttribute('aria-busy', 'true');
    await expect(page).toHaveURL('/onboarding');
    expect(calls.signup).toBe(1);
  });

  test('wrong password is explained without losing the email', async ({ page }) => {
    await mockApi(page, { loginStatus: 401 });
    await page.goto('/login');
    await fill(page, 'e2e@example.com', 'wrong-one');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toHaveText("That email and password don't match. Check both and try again.");
    await expect(page.getByLabel('Email')).toHaveValue('e2e@example.com');
    await expectNoAxeViolations(page);
  });

  test('a duplicate email offers sign-in with the email and pathway kept', async ({ page }) => {
    await mockApi(page, { signupStatus: 409 });
    await page.goto('/signup?pathway=saas');
    await fill(page, 'taken@example.com', 'secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toContainText('An account with this email already exists.');
    await page.getByRole('link', { name: 'Sign in instead' }).click();
    await expect(page).toHaveURL('/login?pathway=saas');
    await expect(page.getByLabel('Email')).toHaveValue('taken@example.com');
  });

  test('a stopped backend is announced up front and on submit [network errors expected]', async ({ page }) => {
    await mockApi(page, { offline: true });
    await page.goto('/signup');
    await expect(page.getByRole('status').filter({ hasText: "Achivii isn't responding right now" })).toBeVisible();
    await fill(page, 'new@example.com', 'secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toHaveText("We can't reach Achivii right now. Check your connection, then try again.");
    await expect(page.getByRole('button', { name: 'Create account' })).not.toHaveAttribute('aria-busy', 'true');
  });

  test('a server error is explained [network errors expected]', async ({ page }) => {
    await mockApi(page, { signupStatus: 500 });
    await page.goto('/signup');
    await fill(page, 'new@example.com', 'secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toHaveText('Something went wrong on our side. Please try again in a moment.');
  });

  test('the keyboard order is skip link, home, email, password, toggle, submit, switch', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard order is checked once, on desktop.');
    await mockApi(page);
    await page.goto('/login');
    const order: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          return el.getAttribute('aria-label') || el.getAttribute('name') || el.textContent?.trim() || el.tagName;
        }),
      );
    }
    expect(order).toEqual(['Skip to content', 'Achivii, home', 'email', 'password', 'Show password', 'Sign in', 'Create an account']);
  });

  test('the password toggle reveals and hides the password', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('secret1');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });
});

test.describe('layout and accessibility', () => {
  for (const url of ['/signup', '/login', '/signup?pathway=run10k']) {
    test(`${url} has no axe violations and no horizontal overflow`, async ({ page }) => {
      await mockApi(page);
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('with the keyboard open at 390×664 the form and its button stay reachable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile only.');
    await mockApi(page);
    await page.setViewportSize({ width: 390, height: 664 });
    await page.goto('/signup?pathway=run10k');
    await page.getByLabel('Password', { exact: true }).focus();
    const button = page.getByRole('button', { name: 'Create account' });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('reduced motion leaves the screens fully usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockApi(page);
    await page.goto('/signup');
    await fill(page, 'new@example.com', 'secret1');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL('/onboarding');
  });
});
