import type { Response } from "express";
import { accessFor, TRIAL_ENDED, TRIAL_ENDED_MESSAGE } from "./access.js";

/**
 * ND-37: once the 30-day trial is over without Pro, nothing moves the plan on (no session done, no week written, no
 * schedule change); reading it stays open. Called by each such route right after it knows the person. Answers 402
 * `TRIAL_ENDED` and returns true when it refused; a billing read that fails never locks anyone out.
 */
export async function refuseIfLocked(user: { id: string; trialStartedAt?: Date | null }, res: Response): Promise<boolean> {
  if (!(await isLocked(user))) return false;
  res.status(402).json({ error: TRIAL_ENDED_MESSAGE, code: TRIAL_ENDED });
  return true;
}

export async function isLocked(user: { id: string; trialStartedAt?: Date | null }): Promise<boolean> {
  try {
    return (await accessFor(user)).state === "locked";
  } catch (error) {
    console.error("[Access] Could not check plan access:", error);
    return false;
  }
}
