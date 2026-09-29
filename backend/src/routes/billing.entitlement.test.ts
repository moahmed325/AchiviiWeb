import { describe, expect, it, vi } from "vitest";
const getAuthUser = vi.fn(); const hasProEntitlement = vi.fn();
vi.mock("./auth.js", () => ({ getAuthUser })); vi.mock("../lib/billing/entitlement.js", () => ({ hasProEntitlement }));
describe("billing entitlement handler", () => {
 it("returns authoritative Pro state", async()=>{getAuthUser.mockResolvedValue({id:"u1"});hasProEntitlement.mockResolvedValue(true);const {entitlementHandler}=await import("./billing.js");const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};await entitlementHandler({} as any,res);expect(res.status).toHaveBeenCalledWith(200);expect(res.json).toHaveBeenCalledWith({plan:"pro",entitled:true});});
 it("requires authentication", async()=>{getAuthUser.mockResolvedValue(null);const {entitlementHandler}=await import("./billing.js");const res:any={status:vi.fn().mockReturnThis(),json:vi.fn()};await entitlementHandler({} as any,res);expect(res.status).toHaveBeenCalledWith(401);expect(hasProEntitlement).not.toHaveBeenCalled();});
});
