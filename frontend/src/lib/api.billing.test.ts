import { describe, expect, it, vi, beforeEach } from 'vitest';
import { startProCheckout } from './api';

describe('startProCheckout', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('posts the selected interval and returns only the trusted checkout URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      checkoutId: 'checkout-1', checkoutUrl: 'https://checkout.example.test/1',
    }), { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(startProCheckout('token-1', 'yearly')).resolves.toEqual({ checkoutUrl: 'https://checkout.example.test/1' });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/billing/checkout'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ interval: 'yearly' }),
      headers: expect.objectContaining({ Authorization: 'Bearer token-1' }),
    }));
  });

  it('surfaces provider failure without fabricating a checkout URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unable to create checkout. Please try again.' }), { status: 502 })));
    await expect(startProCheckout('token-1', 'monthly')).rejects.toMatchObject({ status: 502 });
  });

  it('rejects a malformed success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(startProCheckout('token-1', 'monthly')).rejects.toMatchObject({ status: 502 });
  });
});
