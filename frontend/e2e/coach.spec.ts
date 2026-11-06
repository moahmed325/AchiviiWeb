import { expect, test, type Page } from '@playwright/test';
import { API, mockApi, signIn } from './mockApi';
import { expectCleanAt, shellGoal } from './shellFixtures';

// ND-41: Achivii Coach in the browser. The API is mocked; nothing reaches a model.

const ON = { enabled: true, hasGoal: true, access: 'ok', messages: [], remainingToday: 30, dailyLimit: 30 };

const openCoach = async (page: Page, state: Record<string, unknown> = ON) => {
  await mockApi(page, { goal: shellGoal() });
  await page.route(`${API}/api/coach`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) }));
  const sent: unknown[] = [];
  await page.route(`${API}/api/coach/messages`, async (route) => {
    const body = route.request().postDataJSON() as { text: string };
    sent.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          { id: 'u1', role: 'user', content: body.text, createdAt: new Date().toISOString() },
          { id: 'c1', role: 'coach', content: 'Start with today’s session; keep it easy.', createdAt: new Date().toISOString() },
        ],
        remainingToday: 29,
      }),
    });
  });
  await signIn(page);
  await page.goto('/dashboard');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /^Coach/ }).click();
  await expect(page).toHaveURL('/coach');
  return sent;
};

test('Coach opens from the nav; a starter is sent and the reply shows', async ({ page }) => {
  const sent = await openCoach(page);
  await expect(page.getByText('Knows your plan:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'What should I focus on today?' }).click();
  await expect(page.getByText('Start with today’s session; keep it easy.')).toBeVisible();
  expect(sent).toEqual([{ text: 'What should I focus on today?' }]);
});

test('typing and Enter sends; the box clears and keeps focus', async ({ page }) => {
  const sent = await openCoach(page);
  const box = page.getByRole('textbox', { name: 'Message Coach' });
  await box.fill('How am I doing?');
  await box.press('Enter');
  await expect(page.getByText('Start with today’s session; keep it easy.')).toBeVisible();
  await expect(box).toHaveValue('');
  await expect(box).toBeFocused();
  expect(sent).toHaveLength(1);
});

test('switched off, Coach says it is coming soon', async ({ page }) => {
  await openCoach(page, { ...ON, enabled: false });
  await expect(page.getByRole('heading', { name: 'A coach that knows your plan' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
});

test('clean at phone widths, empty and with a conversation: no overflow and no axe violations', async ({ page }) => {
  await openCoach(page);
  await expectCleanAt(page);
  await page.getByRole('button', { name: 'How am I doing so far?' }).click();
  await expect(page.getByText('Start with today’s session; keep it easy.')).toBeVisible();
  await expectCleanAt(page);
});
