import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { resolvePostAuthDestination } from '../../lib/authFlow';
import type { CertifiedPathway } from '../../lib/certifiedPresets';

/**
 * Moves a signed-in user off an auth screen once their goal state is known, whether they just signed in here or
 * arrived already signed in.
 *
 * A new token lands one render before GoalContext starts fetching, so the hook waits until GoalContext reports a
 * settled fetch for this very token; otherwise a returning user looks goal-less for a frame and a chosen pathway
 * could send them into onboarding. Keying on the token (not on having seen a loading render) holds however the
 * user and goal fetches interleave or get batched.
 */
export function usePostAuthRedirect(pathway: CertifiedPathway | undefined, next: string | null): void {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, goalLoadFailed, goalLoadedFor } = useGoal();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !token || !user || authLoading) return;
    if (loadingGoal || goalLoadedFor !== token) return;

    done.current = true;
    const destination = resolvePostAuthDestination({ pathway, next, hasGoal: Boolean(activeGoal), goalLoadFailed });
    if (destination.draftGoal) localStorage.setItem('achivii_draft_goal', destination.draftGoal);
    navigate(destination.to, { replace: true, state: destination.state });
  }, [token, user, authLoading, loadingGoal, activeGoal, goalLoadFailed, goalLoadedFor, pathway, next, navigate]);
}
