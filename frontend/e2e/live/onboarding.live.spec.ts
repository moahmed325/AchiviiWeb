import { expect, test, type Page } from '@playwright/test';
import { API, type CreateRequest } from '../mockApi';
import {
  CUSTOM_GOAL,
  CUSTOM_TYPED_SUCCESS,
  PRESET_GOAL,
  answerCustomQuestions,
  answerPresetQuestions,
  baseline,
  chooseSchedule,
  expectStep,
  generate,
  normalizeCreateBody,
  type ClarifyResponse,
} from '../onboardingFlow';

// Real sign-up and real clarify (a custom goal waits on the AI, about 17 s). Create is recorded and held open, so no
// goal is generated. Each run leaves one account per test in the dev database.
test.describe.configure({ timeout: 180_000 });

test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'Live checks run once, on desktop.');
});

async function recordCreate(page: Page) {
  const create: CreateRequest[] = [];
  await page.route(`${API}/api/goal/create`, (route) => {
    const request = route.request();
    const headers = request.headers();
    create.push({
      headers: {
        'content-type': headers['content-type'],
        accept: headers['accept'],
        authorization: headers['authorization']?.replace(/^Bearer .+$/, 'Bearer <token>'),
      },
      body: request.postDataJSON(),
    });
    return new Promise<void>(() => {});
  });
  return create;
}

async function signUp(page: Page, url: string, label: string) {
  await page.goto(url);
  await page.getByLabel('Email').fill(`phase3-live-${label}-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('journey1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/onboarding');
}

test('a landing pathway survives a real sign-up and sends the baseline preset payload', async ({ page }) => {
  const create = await recordCreate(page);
  const clarified = page.waitForResponse((r) => r.url() === `${API}/api/goal/clarify` && r.ok());
  await signUp(page, '/signup?pathway=run10k', 'preset');

  await expectStep(page, 'starting');
  expect(await page.evaluate(() => localStorage.getItem('achivii_draft_goal'))).toBe(PRESET_GOAL);
  const live = (await (await clarified).json()) as ClarifyResponse;
  expect(live.followUpQuestions).toEqual(baseline.presetClarify.followUpQuestions);

  await answerPresetQuestions(page, live.followUpQuestions);
  await chooseSchedule(page, 'review');
  await generate(page);

  await expect.poll(() => create.length).toBe(1);
  expect(create[0].headers).toEqual(baseline.presetCreate.headers);
  expect(normalizeCreateBody(create[0].body)).toEqual(normalizeCreateBody(baseline.presetCreate.body));
});

test('a custom goal with real clarify sends a payload shaped like the baseline', async ({ page }) => {
  const create = await recordCreate(page);
  await signUp(page, '/signup', 'custom');
  await expectStep(page, 'goal');

  const clarified = page.waitForResponse((r) => r.url() === `${API}/api/goal/clarify` && r.ok(), { timeout: 90_000 });
  await page.getByRole('textbox').first().fill(CUSTOM_GOAL);
  await page.getByRole('button', { name: /^Continue/ }).click();
  const live = (await (await clarified).json()) as ClarifyResponse;

  await chooseSchedule(page, 'starting');
  await answerCustomQuestions(page, live.followUpQuestions);
  await generate(page);

  await expect.poll(() => create.length).toBe(1);
  expect(create[0].headers).toEqual(baseline.customCreate.headers);

  const [q1, q2, q3, q4] = live.followUpQuestions;
  const expectedAnswers = [q1.options[0], CUSTOM_TYPED_SUCCESS, 'Skipped', q4.options[0]];
  const baselineBody = baseline.customCreate.body as { routine: unknown };
  expect(normalizeCreateBody(create[0].body)).toEqual({
    rawGoal: CUSTOM_GOAL,
    clarifiedOutcome: live.clarifiedOutcome,
    answers: Object.fromEntries([q1, q2, q3, q4].map((q, i) => [q.question, expectedAnswers[i]])),
    answerList: [q1, q2, q3, q4].map((q, i) => ({ id: q.id, question: q.question, answer: expectedAnswers[i] })),
    domain: live.primaryDomain,
    routine: normalizeCreateBody({ routine: baselineBody.routine }).routine,
  });
});
