import { expect, test, type Page } from '@playwright/test';
import { API, mockApi, signIn } from './mockApi';
import { CUSTOM_GOAL, answerCustomQuestions, baseline, chooseSchedule, expectStep, generate } from './onboardingFlow';

// A new custom goal is the Pro capability (ND-10, billing OD-3). The server refuses it with a 403; these check that a
// free user is told at every way in, before onboarding, and that a refusal that still happens is explained honestly.

const customCard = (page: Page) =>
  page.getByRole('region', { name: 'Have something unique in mind?' });

test.describe('custom goal Pro gate', () => {
  test('Home tells a free user a custom goal is Pro, and the pathways stay free', async ({ page }) => {
    await mockApi(page, { plan: 'free' });
    await signIn(page);
    await page.goto('/');
    const custom = customCard(page);
    await expect(custom.getByRole('button', { name: 'Continue to Pro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Describe my own goal' })).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Choose a direction' })).toBeVisible();
  });

  test('onboarding shows a free user the gate in place of the custom goal field', async ({ page }) => {
    await mockApi(page, { plan: 'free' });
    await signIn(page);
    await page.goto('/onboarding');
    await expectStep(page, 'goal');
    await expect(customCard(page).getByRole('button', { name: 'Continue to Pro' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your goal' })).toHaveCount(0);
  });

  test('a Pro user goes from Home to the custom goal field as before', async ({ page }) => {
    await mockApi(page, { plan: 'pro' });
    await signIn(page);
    await page.goto('/');
    await customCard(page).getByRole('button', { name: 'Describe my own goal' }).click();
    await expect(page).toHaveURL('/onboarding');
    await expectStep(page, 'goal');
    await expect(page.getByRole('textbox', { name: 'Your goal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to Pro' })).toHaveCount(0);
  });

  test('a create refused for Pro says so, offers Pro, and leads back to the free pathways', async ({ page }) => {
    // Pro when onboarding opened, no longer Pro when the plan is built (e.g. the subscription ended meanwhile).
    const calls = await mockApi(page, { clarify: baseline.customClarify, createProRequired: true });
    await signIn(page);
    await page.goto('/onboarding');
    await expectStep(page, 'goal');
    await page.getByRole('textbox', { name: 'Your goal' }).fill(CUSTOM_GOAL);
    await page.getByRole('button', { name: /^Continue/ }).click();
    await chooseSchedule(page, 'starting');
    await answerCustomQuestions(page, baseline.customClarify.followUpQuestions);
    await page.route(`${API}/api/billing/entitlement`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ plan: 'free', entitled: false }) }),
    );
    await generate(page);

    await expect.poll(() => calls.create.length).toBe(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Custom Goals require Achivii Pro' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Certified pathways stay free.');
    await expect(page.getByRole('alert')).not.toContainText("We couldn't build your plan");
    await expect(page.getByRole('button', { name: 'Continue to Pro' })).toBeVisible();

    await page.getByRole('button', { name: 'Choose a certified pathway' }).click();
    await expectStep(page, 'goal');
    await expect(page.getByRole('group', { name: 'Choose a direction' })).toBeVisible();
  });
});
