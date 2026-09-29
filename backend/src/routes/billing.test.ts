import { describe, expect, it, vi, beforeEach } from "vitest";
const getAuthUser = vi.fn(); const createCheckout = vi.fn(); const reconcile = vi.fn();
vi.mock("./auth.js", () => ({ getAuthUser }));
vi.mock("../lib/billing/accountState.js", () => ({ getBillingAccountState: vi.fn() }));
vi.mock("../lib/billing/lemonSqueezyCheckout.js", () => ({ createLemonSqueezyCheckout: createCheckout }));
vi.mock("../lib/billing/lemonSqueezyReconciliation.js", () => ({ reconcileUserSubscription: reconcile }));
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

beforeEach(() => { getAuthUser.mockReset(); createCheckout.mockReset(); reconcile.mockReset(); delete process.env.BILLING_CHECKOUT_ENABLED; });

describe("billing checkout route", () => {
  it("can disable new purchases without touching existing entitlements", async () => { process.env.BILLING_CHECKOUT_ENABLED="false"; getAuthUser.mockResolvedValue({id:"user-123",email:"user@example.com"}); const {checkoutHandler}=await import("./billing.js"); const res=response(); await checkoutHandler({body:{interval:"monthly"},headers:{}} as any,res as any); expect(res.status).toHaveBeenCalledWith(503); expect(createCheckout).not.toHaveBeenCalled(); });
  it("rejects unauthenticated requests", async () => { getAuthUser.mockResolvedValue(null); const { checkoutHandler } = await import("./billing.js"); const res=response(); await checkoutHandler({body:{},headers:{}} as any,res as any); expect(res.status).toHaveBeenCalledWith(401); expect(createCheckout).not.toHaveBeenCalled(); });
  it("uses authenticated identity and selected interval", async () => { getAuthUser.mockResolvedValue({id:"user-123",email:"user@example.com"}); createCheckout.mockResolvedValue({checkoutId:"checkout-123",checkoutUrl:"https://checkout.example/123"}); const {checkoutHandler}=await import("./billing.js"); const res=response(); await checkoutHandler({body:{interval:"yearly"},headers:{}} as any,res as any); expect(createCheckout).toHaveBeenCalledWith({userId:"user-123",email:"user@example.com",interval:"yearly"}); expect(res.status).toHaveBeenCalledWith(200); });
  it("rejects invalid interval", async () => { getAuthUser.mockResolvedValue({id:"user-123",email:"user@example.com"}); const {checkoutHandler}=await import("./billing.js"); const res=response(); await checkoutHandler({body:{interval:"weekly"},headers:{}} as any,res as any); expect(res.status).toHaveBeenCalledWith(400); });
  it("hides provider errors", async () => { getAuthUser.mockResolvedValue({id:"user-123",email:"user@example.com"}); createCheckout.mockRejectedValue(new Error("secret")); const {checkoutHandler}=await import("./billing.js"); const res=response(); await checkoutHandler({body:{interval:"monthly"},headers:{}} as any,res as any); expect(res.status).toHaveBeenCalledWith(502); expect(res.json).toHaveBeenCalledWith({error:"Unable to create checkout. Please try again."}); });
});

describe("billing reconciliation route", () => {
  it("reconciles only for the authenticated user", async () => { getAuthUser.mockResolvedValue({id:"user-123",email:"user@example.com"}); reconcile.mockResolvedValue({reconciled:true,status:"ACTIVE"}); const {reconcileHandler}=await import("./billing.js"); const res=response(); await reconcileHandler({body:{},headers:{}} as any,res as any); expect(reconcile).toHaveBeenCalledWith("user-123"); expect(res.status).toHaveBeenCalledWith(200); });
  it("returns service unavailable without changing state", async () => { getAuthUser.mockResolvedValue({id:"user-123",email:"user@example.com"}); reconcile.mockResolvedValue({reconciled:false,status:"ACTIVE",reason:"provider_unavailable"}); const {reconcileHandler}=await import("./billing.js"); const res=response(); await reconcileHandler({body:{},headers:{}} as any,res as any); expect(res.status).toHaveBeenCalledWith(503); });
});

describe("billing routes", () => {
  // The frontend AccountMenu calls GET /api/billing/account for plan state and
  // the provider-managed subscription entry point (UX-4/UX-5). A missing
  // registration silently 404s that experience in production.
  it("exposes the account state route the frontend consumes", async () => { const { billingRouter } = await import("./billing.js"); const layers = (billingRouter as unknown as { stack: Array<{ route?: { path?: string; methods?: Record<string, boolean> } }> }).stack; const account = layers.find((l) => l.route?.path === "/account"); expect(account?.route?.methods?.get).toBe(true); });
});
