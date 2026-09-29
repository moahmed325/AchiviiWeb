import { describe, expect, it } from "vitest";
import { mapLemonSqueezyStatus, periodEndForState } from "./lemonSqueezyState.js";

describe("Lemon Squeezy state mapping", () => {
  it("maps lifecycle states to Achivii states", () => {
    expect(mapLemonSqueezyStatus("active", null, "2026-10-01T00:00:00Z")).toBe("ACTIVE");
    expect(mapLemonSqueezyStatus("on_trial", null, "2026-10-01T00:00:00Z")).toBe("ACTIVE");
    expect(mapLemonSqueezyStatus("past_due", null, "2026-10-01T00:00:00Z")).toBe("PAST_DUE_RECOVERY");
    expect(mapLemonSqueezyStatus("unpaid", null, "2026-10-01T00:00:00Z")).toBe("UNPAID");
    expect(mapLemonSqueezyStatus("paused", null, "2026-10-01T00:00:00Z")).toBe("PAUSED");
    expect(mapLemonSqueezyStatus("expired", null, null)).toBe("EXPIRED");
    expect(mapLemonSqueezyStatus("future_status", null, null)).toBe("UNKNOWN");
  });

  it("uses the cancellation end boundary when available", () => {
    const end = "2099-10-01T00:00:00Z";
    expect(mapLemonSqueezyStatus("cancelled", end, null)).toBe("CANCELLED_ENDING");
    expect(periodEndForState("CANCELLED_ENDING", null, end)?.toISOString()).toBe(new Date(end).toISOString());
  });
});

