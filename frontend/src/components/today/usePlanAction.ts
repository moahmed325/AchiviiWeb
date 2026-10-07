import { useRef, useState } from 'react';
import type { Reconciliation } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { ApiError } from '../../lib/api';

/*
 * Missed sessions M3.3: sends one plan action (mark today missed, swap, carry now) and keeps its response. On a 200
 * the goal context stores the reconcile body, then reloads the goal. A 409 `changed` reloads the plan; any other
 * refusal or a network failure leaves everything as it was. The server's own text is never shown.
 */

const CHANGED = "Your plan changed. Here's the latest.";
const NOT_CHANGED = "That didn't change. Please try again.";

export type Place = 'offer' | 'aside' | 'swap' | 'plan';
type Outcome = 'done' | 'changed' | 'failed' | 'skipped';

export interface PlanAction {
  /** The key of the action being sent, so only its control shows the spinner. */
  busy: string | null;
  /** The one line about the last attempt, and where it belongs. Never the server's own text. */
  message: { at: Place; text: string } | null;
  run: (at: Exclude<Place, 'plan'>, key: string, call: (token: string) => Promise<Reconciliation>) => Promise<Outcome>;
  clear: () => void;
}

/** One action at a time: a double click, or a second control while the first is sending, sends nothing. */
export function usePlanAction(): PlanAction {
  const { token } = useAuth();
  const { applyReconciliation, reloadPlan } = useGoal();
  const sending = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<PlanAction['message']>(null);

  const run: PlanAction['run'] = async (at, key, call) => {
    if (sending.current || !token) return 'skipped';
    sending.current = true;
    setBusy(key);
    setMessage(null);
    try {
      const body = await call(token);
      await applyReconciliation(body);
      return 'done';
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'changed') {
        // Someone (another tab, tonight's close) changed these days: show the plan as it is now.
        await reloadPlan();
        setMessage({ at: 'plan', text: CHANGED });
        return 'changed';
      }
      setMessage({ at, text: NOT_CHANGED });
      return 'failed';
    } finally {
      sending.current = false;
      setBusy(null);
    }
  };

  return { busy, message, run, clear: () => setMessage(null) };
}

