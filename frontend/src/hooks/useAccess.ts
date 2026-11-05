import { useCallback, useEffect, useState } from 'react';
import { useAuthToken } from '../context/AuthContext';
import { fetchBillingEntitlement, type AccessState } from '../lib/api';

export interface AccessInfo {
  /** Null while it loads, or when it can't be read (nothing is locked on a guess; the server decides). */
  state: AccessState | null;
  trialEndsAt: string | null;
  reload: () => void;
}

/** ND-37: where the signed-in person stands with the 30-day trial and Pro (`GET /api/billing/entitlement`). */
export function useAccess(): AccessInfo {
  const token = useAuthToken();
  const [info, setInfo] = useState<{ state: AccessState | null; trialEndsAt: string | null }>({ state: null, trialEndsAt: null });
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    if (!token) return;
    let live = true;
    fetchBillingEntitlement(token)
      .then((result) => {
        if (live) setInfo({ state: result.access ?? (result.entitled ? 'pro' : 'new'), trialEndsAt: result.trialEndsAt ?? null });
      })
      .catch(() => {
        if (live) setInfo({ state: null, trialEndsAt: null });
      });
    return () => {
      live = false;
    };
  }, [token, loads]);
  const reload = useCallback(() => setLoads((n) => n + 1), []);
  return { ...info, reload };
}
