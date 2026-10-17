/**
 * Method-aware recovery (M3.1a, 03-phases.md section 3): the method switch. Missed days follow their steps' kinds, and
 * next week continues from where the person is (M3.1d), only when this is exactly 'true'. Read per call. On in
 * production since 2026-10-16 (O2); it is this feature's kill switch, managed in the Render dashboard only. Carry
 * writes still need `MISSED_SESSIONS_CARRY_ENABLED`. Its own module so `planV2.ts` and
 * `reconcileCore.ts` can both read it without importing each other.
 */
export function methodRecoveryEnabled(): boolean {
  return process.env.METHOD_RECOVERY_ENABLED === 'true';
}
