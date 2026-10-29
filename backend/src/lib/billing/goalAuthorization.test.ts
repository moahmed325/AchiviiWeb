import { describe, expect, it, vi, beforeEach } from "vitest";

const hasProEntitlement = vi.fn();
vi.mock("./entitlement.js", () => ({ hasProEntitlement }));
const count = vi.fn();
vi.mock("../prisma.js", () => ({ prisma: { goal: { count } } }));

describe("new custom-goal authorization", () => {
  beforeEach(() => {
    hasProEntitlement.mockReset();
    count.mockReset().mockResolvedValue(1);
  });

  it("allows an entitled user", async () => {
    hasProEntitlement.mockResolvedValue(true);
    const { authorizeNewCustomGoal } = await import("./goalAuthorization.js");
    await expect(authorizeNewCustomGoal("user-a")).resolves.toEqual({ allowed: true });
    expect(hasProEntitlement).toHaveBeenCalledWith("user-a");
  });

  it("allows anyone their first plan (ND-28)", async () => {
    hasProEntitlement.mockResolvedValue(false);
    count.mockResolvedValue(0);
    const { authorizeNewCustomGoal } = await import("./goalAuthorization.js");
    await expect(authorizeNewCustomGoal("user-a")).resolves.toEqual({ allowed: true });
    expect(count).toHaveBeenCalledWith({ where: { userId: "user-a" } });
  });

  it("denies a user without Pro who already had a plan with a stable error code", async () => {
    hasProEntitlement.mockResolvedValue(false);
    const { authorizeNewCustomGoal, CUSTOM_GOAL_REQUIRES_PRO } = await import("./goalAuthorization.js");
    await expect(authorizeNewCustomGoal("user-a")).resolves.toEqual({
      allowed: false,
      code: CUSTOM_GOAL_REQUIRES_PRO,
      message: "Custom Goals require Achivii Pro.",
    });
  });
});
