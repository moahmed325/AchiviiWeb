/**
 * Which frame a screen gets (ND-7).
 * - `chromeless`: the signed-out landing, the auth screens and the primitives preview bring their own.
 * - `bare`: no session on a protected path. ProtectedRoute is about to send it to sign-in, so no navigation.
 * - `focused`: onboarding and generation. A minimal top bar, so the flow stays focused and the user can leave.
 * - `app`: every other signed-in screen. The rail on desktop, the bottom bar on mobile.
 */
export type ShellMode = 'chromeless' | 'bare' | 'focused' | 'app';

const AUTH_ROUTES = ['/signup', '/login'];

export function shellMode(pathname: string, signedIn: boolean, previewPath?: string): ShellMode {
  if ((pathname === '/' && !signedIn) || AUTH_ROUTES.includes(pathname) || (previewPath && pathname === previewPath)) {
    return 'chromeless';
  }
  if (!signedIn) return 'bare';
  if (pathname === '/onboarding') return 'focused';
  return 'app';
}

export interface ShellEntries {
  todayActive: boolean;
  roadmapActive: boolean;
  /** Roadmap needs an active goal; without one ProtectedRoute would send it to onboarding, so it leads nowhere real. */
  showRoadmap: boolean;
}

/** Today is active on `/` (OD-3). */
export function shellEntries(pathname: string, hasGoal: boolean): ShellEntries {
  return {
    todayActive: pathname === '/',
    roadmapActive: pathname === '/roadmap',
    showRoadmap: hasGoal,
  };
}
