import { describe, expect, it, vi, beforeEach } from "vitest";

const hasProEntitlement = vi.fn();
vi.mock("./entitlement.js", () => ({ hasProEntitlement }));

describe("new custom-goal authorization", () => {
  beforeEach(() => hasProEntitlement.mockReset());

  it("allows an entitled user", async () => {
    hasProEntitlement.mockResolvedValue(true);
    const { authorizeNewCustomGoal } = await import("./goalAuthorization.js");
    await expect(authorizeNewCustomGoal("user-a")).resolves.toEqual({ allowed: true });
    expect(hasProEntitlement).toHaveBeenCalledWith("user-a");
  });

  it("denies a user without Pro with a stable error code", async () => {
    hasProEntitlement.mockResolvedValue(false);
    const { authorizeNewCustomGoal, CUSTOM_GOAL_REQUIRES_PRO } = await import("./goalAuthorization.js");
    await expect(authorizeNewCustomGoal("user-a")).resolves.toEqual({
      allowed: false,
      code: CUSTOM_GOAL_REQUIRES_PRO,
      message: "Custom Goals require Achivii Pro.",
    });
  });
});
