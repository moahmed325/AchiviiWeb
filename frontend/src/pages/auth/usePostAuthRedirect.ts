import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { resolvePostAuthDestination } from '../../lib/authFlow';
import type { CertifiedPathway } from '../../lib/certifiedPresets';

/** If a goal fetch finishes before React ever renders it as loading, stop waiting for that render after this long. */
const GOAL_FETCH_GRACE_MS = 1500;

/**
 * Moves a signed-in user off an auth screen once their goal state is known, whether they just signed in here or
 * arrived already signed in.
 *
 * A new token lands one render before GoalContext starts fetching, so for a token that appeared after mount the hook
 * waits until that fetch has been seen to start and finish; otherwise a returning user looks goal-less for a frame
 * and a chosen pathway could send them into onboarding.
 */
export function usePostAuthRedirect(pathway: CertifiedPathway | undefined, next: string | null): void {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, goalLoadFailed } = useGoal();
  const navigate = useNavigate();

  const tokenAtMount = useRef(token);
  const fetchSeenFor = useRef<string | null>(null);
  const done = useRef(false);
  const [graceOverFor, setGraceOverFor] = useState<string | null>(null);

  useEffect(() => {
    if (!token || token === tokenAtMount.current) return;
    const timer = window.setTimeout(() => setGraceOverFor(token), GOAL_FETCH_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [token]);

  useEffect(() => {
    if (done.current || !token || !user || authLoading) return;
    if (loadingGoal) {
      fetchSeenFor.current = token;
      return;
    }
    const settled = token === tokenAtMount.current || fetchSeenFor.current === token || graceOverFor === token;
    if (!settled) return;

    done.current = true;
    const destination = resolvePostAuthDestination({ pathway, next, hasGoal: Boolean(activeGoal), goalLoadFailed });
    if (destination.draftGoal) localStorage.setItem('achivii_draft_goal', destination.draftGoal);
    navigate(destination.to, { replace: true, state: destination.state });
  }, [token, user, authLoading, loadingGoal, activeGoal, goalLoadFailed, graceOverFor, pathway, next, navigate]);
}
