import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, carryNow, markTodayMissed, swapDays } from './api';

// Missed sessions M3.3 R1: the three plan actions (backend M2.4) answer with the reconcile body.
const BODY = { applies: true, goalId: 'g1', signals: { notice: null } };
const reply = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })));

afterEach(() => vi.unstubAllGlobals());

describe('plan actions (missed sessions M3.3)', () => {
  it('markTodayMissed posts to mark-missed with the token and no body', async () => {
    reply(200, BODY);
    await expect(markTodayMissed('t3', 'token-1')).resolves.toEqual(BODY);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/goal\/tasks\/t3\/mark-missed$/),
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) }),
    );
    expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty('body');
  });

  it('swapDays posts withTaskId and both days\' steps as loaded', async () => {
    reply(200, BODY);
    const expected = { t3: '[{"stepNumber":1}]', t5: '[]' };
    await expect(swapDays('t3', 't5', expected, 'token-1')).resolves.toEqual(BODY);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/goal\/tasks\/t3\/swap$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ withTaskId: 't5', expected }),
        headers: expect.objectContaining({ Authorization: 'Bearer token-1', 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('carryNow posts to carry-now with the token', async () => {
    reply(200, BODY);
    await expect(carryNow('t2', 'token-1')).resolves.toEqual(BODY);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/goal\/tasks\/t2\/carry-now$/),
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token-1' }) }),
    );
  });

  it.each([
    ['markTodayMissed', () => markTodayMissed('t3', 'token-1')],
    ['swapDays', () => swapDays('t3', 't5', { t3: '[]', t5: '[]' }, 'token-1')],
    ['carryNow', () => carryNow('t2', 'token-1')],
  ])('%s throws ApiError with the status and the server reason as code on a 409', async (_, call) => {
    reply(409, { error: 'Your plan changed since it was loaded.', reason: 'changed' });
    const refusal = call();
    await expect(refusal).rejects.toBeInstanceOf(ApiError);
    await expect(refusal).rejects.toMatchObject({ status: 409, code: 'changed' });
  });

  it('a refusal without a reason or a JSON body still throws ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
    await expect(markTodayMissed('t3', 'token-1')).rejects.toMatchObject({ status: 502, code: undefined });
  });
});
