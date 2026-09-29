import { describe, expect, it, vi } from 'vitest';
const getAuthUser = vi.fn(); const createLemonSqueezyCheckout = vi.fn();
vi.mock('./auth.js', () => ({ getAuthUser }));
vi.mock('../lib/billing/lemonSqueezyCheckout.js', () => ({ createLemonSqueezyCheckout }));
describe('billing checkout handler', () => {
  it('requires authentication', async () => {
    getAuthUser.mockResolvedValue(null); const { checkoutHandler } = await import('./billing.js');
    const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()}; await checkoutHandler({body:{interval:'monthly'}} as any,res);
    expect(res.status).toHaveBeenCalledWith(401); expect(createLemonSqueezyCheckout).not.toHaveBeenCalled();
  });
  it('passes the selected interval and local identity to the provider service', async () => {
    getAuthUser.mockResolvedValue({id:'u1',email:'u@example.com'}); createLemonSqueezyCheckout.mockResolvedValue({checkoutId:'c1',checkoutUrl:'https://checkout.test/c1'});
    const { checkoutHandler } = await import('./billing.js'); const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};
    await checkoutHandler({body:{interval:'yearly'}} as any,res);
    expect(createLemonSqueezyCheckout).toHaveBeenCalledWith({userId:'u1',email:'u@example.com',interval:'yearly'});
    expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith({checkoutId:'c1',checkoutUrl:'https://checkout.test/c1'});
  });
  it('returns retryable failure and does not grant entitlement', async () => {
    getAuthUser.mockResolvedValue({id:'u1',email:'u@example.com'}); createLemonSqueezyCheckout.mockRejectedValue(new Error('provider failed'));
    const { checkoutHandler } = await import('./billing.js'); const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};
    await checkoutHandler({body:{interval:'monthly'}} as any,res);
    expect(res.status).toHaveBeenCalledWith(502); expect(res.json).toHaveBeenCalledWith({error:'Unable to create checkout. Please try again.'});
  });
});
