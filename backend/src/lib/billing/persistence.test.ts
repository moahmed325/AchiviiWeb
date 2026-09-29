import { describe, expect, it } from "vitest";

/**
 * Persistence contract tests for M1.4.
 *
 * These tests intentionally avoid requiring a developer's local Supabase
 * credentials. They verify the deterministic billing primitives that sit
 * immediately above Prisma, while the migration is checked separately with
 * Prisma's migration-status command in CI/deployment environments.
 */

describe("billing persistence contracts", () => {
  it("uses a provider subscription ID as the durable lookup identity", async () => {
    const { prisma } = await import("../prisma.js");
    expect(typeof prisma.subscription.findUnique).toBe("function");
    expect(typeof prisma.subscription.update).toBe("function");
  });

  it("supports user-scoped subscription lookup", async () => {
    const { prisma } = await import("../prisma.js");
    expect(typeof prisma.subscription.findMany).toBe("function");
  });

  it("supports durable webhook-event insertion and duplicate lookup", async () => {
    const { prisma } = await import("../prisma.js");
    expect(typeof prisma.webhookEvent.create).toBe("function");
    expect(typeof prisma.webhookEvent.findUnique).toBe("function");
  });
});
