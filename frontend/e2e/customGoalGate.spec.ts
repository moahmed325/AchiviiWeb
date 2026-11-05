import { expect, test } from '@playwright/test';
import { API, mockApi, signIn } from './mockApi';
import { CUSTOM_GOAL, answerCustomQuestions, answerEssentials, baseline, generate, startGoal } from './onboardingFlow';

// ND-37: a new plan is allowed before the first plan and during the 30-day trial; after it, only with Pro. The server
// refuses it with a 403, and onboarding explains the refusal honestly.

test.describe('a new plan after the trial', () => {
  test('a create refused after the trial says so and offers Pro, not another goal', async ({ page }) => {
    const calls = await mockApi(page, { clarify: baseline.customClarify, createProRequired: true });
    await signIn(page);
    await page.goto('/onboarding');
    await startGoal(page, CUSTOM_GOAL);
    await answerEssentials(page);
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await page.route(`${API}/api/billing/entitlement`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free', entitled: false }) }),
    );
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Your 30 free days are over' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Everything you’ve done so far is kept.');
    await expect(page.getByRole('alert')).not.toContainText("We couldn't build your plan");
    await expect(page.getByRole('button', { name: 'Continue to Pro' })).toBeVisible();
    // Any new plan needs Pro now, so another goal is no way out.
    await expect(page.getByRole('button', { name: 'Choose a different goal' })).toHaveCount(0);
  });
});
