import { ApiError } from './api';
import type { CertifiedPathway } from './certifiedPresets';

export type AuthMode = 'signup' | 'login';

export const AUTH_PATHS: Record<AuthMode, string> = { signup: '/signup', login: '/login' };

const ORIGIN_PROBE = 'https://achivii.invalid';

/**
 * Returns `raw` only if it is a path inside this app: one leading `/`, never `//` or a scheme, and never an auth
 * screen (which would loop). Anything else returns null.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  let url: URL;
  try {
    url = new URL(raw, ORIGIN_PROBE);
  } catch {
    return null;
  }
  // The URL parser folds backslashes, tabs and newlines, so "/\evil.com" resolves to another origin here.
  if (url.origin !== ORIGIN_PROBE) return null;
  if (url.pathname === AUTH_PATHS.login || url.pathname === AUTH_PATHS.signup) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The other auth screen, carrying over only `pathway` and `next`. */
export function authSwitchHref(target: AuthMode, params: URLSearchParams): string {
  const kept = new URLSearchParams();
  for (const key of ['pathway', 'next']) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${AUTH_PATHS[target]}?${query}` : AUTH_PATHS[target];
}

export interface PostAuthInput {
  pathway?: CertifiedPathway;
  next: string | null;
  hasGoal: boolean;
  /** The goal fetch failed, so `hasGoal: false` can't be trusted. */
  goalLoadFailed: boolean;
}

export interface PostAuthDestination {
  to: string;
  state?: Record<string, unknown>;
  /** Written to `localStorage['achivii_draft_goal']` before navigating, as the pathway launch has always done. */
  draftGoal?: string;
}

/**
 * Where a signed-in user goes from an auth screen (ND-4). A chosen pathway wins over `next`. A user who already has a
 * goal is never sent into onboarding by a pathway, and a failed goal fetch lands on Today so nothing can replace a
 * goal the app couldn't see.
 */
export function resolvePostAuthDestination({ pathway, next, hasGoal, goalLoadFailed }: PostAuthInput): PostAuthDestination {
  if (goalLoadFailed) return { to: '/' };
  if (pathway) {
    if (hasGoal) return { to: '/', state: { pathwayNotice: pathway.title } };
    return {
      to: '/onboarding',
      state: { presetGoal: pathway.title, isPreset: true, switchGoal: true },
      draftGoal: pathway.title,
    };
  }
  const internal = safeNext(next);
  if (internal) return { to: internal };
  return { to: hasGoal ? '/' : '/onboarding' };
}

export type AuthErrorKind = 'duplicate' | 'credentials' | 'invalid' | 'offline' | 'server';

export interface AuthErrorDescription {
  kind: AuthErrorKind;
  message: string;
}

export function describeAuthError(error: unknown): AuthErrorDescription {
  // fetch rejects with a TypeError when the request never reaches the server.
  if (error instanceof TypeError) {
    return { kind: 'offline', message: "We can't reach Achivii right now. Check your connection, then try again." };
  }
  if (error instanceof ApiError) {
    if (error.status === 409) return { kind: 'duplicate', message: 'An account with this email already exists.' };
    if (error.status === 401) {
      return { kind: 'credentials', message: "That email and password don't match. Check both and try again." };
    }
    if (error.status === 400) return { kind: 'invalid', message: error.message };
  }
  return { kind: 'server', message: 'Something went wrong on our side. Please try again in a moment.' };
}

export const PASSWORD_MIN_LENGTH = 6;

/** Mirrors the backend: the email must contain "@". */
export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!email.includes('@')) return 'Enter an email address with an @, like name@example.com.';
  return undefined;
}

/** Mirrors the backend: sign-up passwords need at least 6 characters; sign-in only needs one. */
export function validatePassword(value: string, mode: AuthMode): string | undefined {
  if (!value) return mode === 'signup' ? 'Choose a password.' : 'Enter your password.';
  if (mode === 'signup' && value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return undefined;
}
