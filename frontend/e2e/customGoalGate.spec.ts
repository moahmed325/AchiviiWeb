import { expect, test } from '@playwright/test';
import { API, mockApi, signIn } from './mockApi';
import { CUSTOM_GOAL, answerCustomQuestions, answerEssentials, baseline, expectStep, generate, startGoal } from './onboardingFlow';

// ND-28: a person's first plan is allowed whatever the goal; after that a new custom goal is Pro (ND-10). The server
// refuses it with a 403, and onboarding explains the refusal honestly.

test.describe('custom goal Pro gate', () => {
  test('a create refused for Pro says so, offers Pro, and leads back to the goal page', async ({ page }) => {
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
    await expect(page.getByRole('heading', { level: 1, name: 'Custom Goals require Achivii Pro' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Your first plan is included.');
    await expect(page.getByRole('alert')).not.toContainText("We couldn't build your plan");
    await expect(page.getByRole('button', { name: 'Continue to Pro' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose a different goal' }).click();
    await expectStep(page, 'goal');
    await expect(page.getByRole('textbox', { name: 'What do you want to achieve?' })).toHaveValue(CUSTOM_GOAL);
  });
});
