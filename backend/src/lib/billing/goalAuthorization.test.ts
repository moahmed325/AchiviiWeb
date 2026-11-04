import { describe, expect, it, vi, beforeEach } from "vitest";

const hasProEntitlement = vi.fn();
vi.mock("./entitlement.js", () => ({ hasProEntitlement }));
vi.mock("../prisma.js", () => ({ prisma: {} }));

const DAY = 24 * 60 * 60 * 1000;

describe("new plan authorization (ND-37)", () => {
  beforeEach(() => hasProEntitlement.mockReset().mockResolvedValue(false));

  it("allows Pro whatever the trial", async () => {
    hasProEntitlement.mockResolvedValue(true);
    const { authorizeNewPlan } = await import("./goalAuthorization.js");
    await expect(authorizeNewPlan({ id: "user-a", trialStartedAt: new Date(Date.now() - 90 * DAY) })).resolves.toEqual({ allowed: true });
  });

  it("allows a first plan, and any plan during the 30 days", async () => {
    const { authorizeNewPlan } = await import("./goalAuthorization.js");
    await expect(authorizeNewPlan({ id: "user-a", trialStartedAt: null })).resolves.toEqual({ allowed: true });
    await expect(authorizeNewPlan({ id: "user-a", trialStartedAt: new Date(Date.now() - 29 * DAY) })).resolves.toEqual({ allowed: true });
  });

  it("refuses once the trial is over, with a stable code", async () => {
    const { authorizeNewPlan } = await import("./goalAuthorization.js");
    await expect(authorizeNewPlan({ id: "user-a", trialStartedAt: new Date(Date.now() - 31 * DAY) })).resolves.toEqual({
      allowed: false,
      code: "TRIAL_ENDED",
      message: "Your 30 free days are over. Go Pro to keep going; your plan and progress are kept.",
    });
  });
});
