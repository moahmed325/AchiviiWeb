import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchActiveGoal, fetchBillingAccountState, submitWeeklyReview } from './api';

// B-40: every JSON call reads its reply through one helper, so an error page that isn't JSON (a 502 from the host)
// throws ApiError with the call's own fallback text instead of a raw SyntaxError.

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const htmlPage = () =>
  new Response('<!DOCTYPE html><html><body>502 Bad Gateway</body></html>', { status: 502, headers: { 'content-type': 'text/html' } });

const reply = (response: Response) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

const calls = [
  { name: 'submitWeeklyReview', call: () => submitWeeklyReview(3, 'Went well', 'token-1'), fallback: 'Failed to submit weekly review' },
  { name: 'fetchActiveGoal', call: () => fetchActiveGoal('token-1'), fallback: 'Failed to fetch active goal' },
  { name: 'fetchBillingAccountState', call: () => fetchBillingAccountState('token-1'), fallback: 'Unable to load billing status' },
];

describe.each(calls)('$name', ({ call, fallback }) => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the server's text and gives the status for a JSON refusal", async () => {
    reply(json({ error: 'This week has already been reviewed.', reason: 'week_closed' }, 409));
    const refusal = call();
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ message: 'This week has already been reviewed.', status: 409, code: 'week_closed' });
  });

  it('throws ApiError with the unchanged fallback text for a 502 HTML page', async () => {
    reply(htmlPage());
    const refusal = call();
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ message: fallback, status: 502 });
  });

  it('uses the fallback text for a JSON refusal without an error field', async () => {
    reply(json({}, 500));
    await expect(call()).rejects.toMatchObject({ message: fallback, status: 500 });
  });
});

describe('success return values are unchanged', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submitWeeklyReview returns the whole body', async () => {
    const body = { scorePercentage: 80, nextWeekNumber: 4, nextWeekTasks: [] };
    reply(json(body, 200));
    await expect(submitWeeklyReview(3, 'Went well', 'token-1')).resolves.toEqual(body);
  });

  it('fetchActiveGoal returns activeGoal, including null', async () => {
    reply(json({ activeGoal: { id: 'goal-1' } }, 200));
    await expect(fetchActiveGoal('token-1')).resolves.toEqual({ id: 'goal-1' });
    reply(json({ activeGoal: null }, 200));
    await expect(fetchActiveGoal('token-1')).resolves.toBeNull();
  });

  it('fetchBillingAccountState returns the whole body', async () => {
    const body = { plan: 'pro', status: 'active', billingInterval: 'monthly', currentPeriodEnd: null, cancelAtPeriodEnd: false, manageUrl: null };
    reply(json(body, 200));
    await expect(fetchBillingAccountState('token-1')).resolves.toEqual(body);
  });
});
