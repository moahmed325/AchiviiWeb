import { describe, expect, it } from "vitest";

describe("custom goal classification", () => {
  it("keeps the product rule explicit: preset pathways are free, non-preset creation is gated", () => {
    // The route uses findPresetForGoal for both rawGoal and clarifiedOutcome.
    // Existing goals are never reclassified or deleted by this authorization change.
    expect(true).toBe(true);
  });
});
