import { describe, expect, it } from "vitest";
import { accessFrom, TRIAL_DAYS, trialEndsAt } from "./access.js";

const start = new Date("2026-11-01T10:00:00Z");

describe("access (ND-37)", () => {
  it("is new before the first plan, a trial for 30 days, then locked", () => {
    expect(accessFrom(false, null, start)).toEqual({ state: "new", trial: null });
    expect(accessFrom(false, start, new Date("2026-11-30T09:59:59Z")).state).toBe("trial");
    expect(accessFrom(false, start, new Date("2026-12-01T10:00:00Z")).state).toBe("locked");
    expect(trialEndsAt(start).getTime() - start.getTime()).toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000);
  });

  it("Pro is never locked, and keeps the trial dates", () => {
    expect(accessFrom(true, start, new Date("2027-03-01T00:00:00Z"))).toEqual({
      state: "pro",
      trial: { startedAt: start, endsAt: trialEndsAt(start) },
    });
  });
});
