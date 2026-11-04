import { beforeEach, describe, expect, it, vi } from "vitest";

const accessFor = vi.fn();
vi.mock("./access.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("./access.js")>()), accessFor }));

const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe("refuseIfLocked (ND-37)", () => {
  beforeEach(() => accessFor.mockReset());

  it("answers 402 TRIAL_ENDED once the trial is over without Pro", async () => {
    accessFor.mockResolvedValue({ state: "locked", trial: null });
    const { refuseIfLocked } = await import("./accessGuard.js");
    const res = response();
    await expect(refuseIfLocked({ id: "u1" }, res as never)).resolves.toBe(true);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "TRIAL_ENDED" }));
  });

  it("lets Pro, a trial and a new person through without answering", async () => {
    const { refuseIfLocked } = await import("./accessGuard.js");
    for (const state of ["pro", "trial", "new"]) {
      accessFor.mockResolvedValue({ state, trial: null });
      const res = response();
      await expect(refuseIfLocked({ id: "u1" }, res as never)).resolves.toBe(false);
      expect(res.status).not.toHaveBeenCalled();
    }
  });
});
