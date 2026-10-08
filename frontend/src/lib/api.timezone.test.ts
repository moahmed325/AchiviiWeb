import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientTimezoneHeader, fetchCurrentUser, reconcileGoal } from './api';

// Missed sessions ND-1: the browser's zone lets the backend correct a user still stored on the default UTC.
const reply = (body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })));
const sentHeaders = () => vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('client timezone header', () => {
  it("is the browser's IANA zone", () => {
    expect(clientTimezoneHeader()).toEqual({ 'X-Client-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone });
  });

  it('is left out when the browser cannot tell', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no Intl');
    });
    expect(clientTimezoneHeader()).toEqual({});
  });

  it('goes with the sign-in check and with reconcile', async () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    reply({ user: { id: 'u1' } });
    await fetchCurrentUser('token-1');
    expect(sentHeaders()).toMatchObject({ Authorization: 'Bearer token-1', 'X-Client-Timezone': zone });

    vi.unstubAllGlobals();
    reply({ applies: false, reason: 'not_plan_v2' });
    await reconcileGoal('token-1');
    expect(sentHeaders()).toMatchObject({ Authorization: 'Bearer token-1', 'X-Client-Timezone': zone });
  });
});
