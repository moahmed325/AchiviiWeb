import { useEffect, useState } from 'react';
import { useAuthToken } from '../context/AuthContext';
import { fetchBillingEntitlement } from '../lib/api';

/**
 * Whether the signed-in person has Pro (`GET /api/billing/entitlement`). False while it loads and when it can't be
 * read, so a Pro choice never shows by mistake; the server checks again on every Pro request.
 */
export function useProEntitlement(): boolean {
  const token = useAuthToken();
  const [entitled, setEntitled] = useState(false);
  useEffect(() => {
    if (!token) return;
    let live = true;
    fetchBillingEntitlement(token)
      .then((result) => {
        if (live) setEntitled(result.entitled === true);
      })
      .catch(() => {
        if (live) setEntitled(false);
      });
    return () => {
      live = false;
    };
  }, [token]);
  return Boolean(token) && entitled;
}
