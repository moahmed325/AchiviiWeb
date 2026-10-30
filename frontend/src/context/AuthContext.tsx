import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { User } from '../types';
import { fetchCurrentUser, updateReminders, updateTimezone } from '../lib/api';
import { supabase } from '../lib/supabase';
import { ACCOUNT_LOAD_FAILED, fromSupabaseAuthError } from '../lib/authFlow';

/**
 * B-44: after Supabase accepted the password, a failed `/me` is our side, not wrong credentials (`/me` answers 401 for
 * a database error too). A lost connection stays a TypeError, so it still reads as offline.
 */
async function userAfterSignIn(accessToken: string) {
  try {
    return await fetchCurrentUser(accessToken);
  } catch (error) {
    if (error instanceof TypeError) throw error;
    // The lib is ES2020, so the cause is set by hand.
    throw Object.assign(new Error(ACCOUNT_LOAD_FAILED), { cause: error });
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** B-15: `confirm_email` when Supabase asks the person to confirm their email before the first sign-in. */
  signup: (email: string, password: string) => Promise<'signed_in' | 'confirm_email'>;
  /** B-15: leaves for Google's sign-in; the person comes back to /login with the same search. */
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** B-46 (2): moves the plan to this zone (an IANA name). */
  setTimezone: (timezone: string) => Promise<void>;
  /** ND-28: the missed-day reminder email on or off. */
  setReminders: (enabled: boolean) => Promise<void>;
  /** B-15: emails a reset link that opens /reset-password signed in for recovery. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** B-15: sets a new password for the signed-in (recovery) session. */
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const applySession = async (session: Session | null) => {
      if (!active) return;
      if (!session) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      const accessToken = session.access_token;
      setToken(accessToken);
      try {
        const currentUser = await fetchCurrentUser(accessToken);
        if (active) setUser(currentUser);
      } catch {
        if (active) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    const restore = async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await applySession(data.session);
          return;
        }
      }

      setUser(null);
      setToken(null);
      setLoading(false);
    };

    void restore();

    if (!supabase) return () => { active = false; };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase Auth is not configured.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw fromSupabaseAuthError(error);
    if (!data.session) throw new Error('No active session was returned. Please try again.');

    const accessToken = data.session.access_token;
    const currentUser = await userAfterSignIn(accessToken);
    setToken(accessToken);
    setUser(currentUser);
  };

  const signup = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase Auth is not configured.');
    const tz = (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') || 'UTC';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { timezone: tz },
        // B-15: the confirmation link lands on sign-in, which then sends them on (pathway and next kept).
        emailRedirectTo: `${window.location.origin}/login${window.location.search}`,
      },
    });
    if (error) throw fromSupabaseAuthError(error);
    if (!data.session) return 'confirm_email';

    const accessToken = data.session.access_token;
    const currentUser = await userAfterSignIn(accessToken);
    setToken(accessToken);
    setUser(currentUser);
    return 'signed_in';
  };

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase Auth is not configured.');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login${window.location.search}` },
    });
    if (error) throw fromSupabaseAuthError(error);
  };

  const requestPasswordReset = async (email: string) => {
    if (!supabase) throw new Error('Supabase Auth is not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) throw fromSupabaseAuthError(error);
  };

  const updatePassword = async (password: string) => {
    if (!supabase) throw new Error('Supabase Auth is not configured.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw fromSupabaseAuthError(error);
  };

  const setTimezone = async (timezone: string) => {
    if (!token) throw new Error('Sign in first.');
    setUser(await updateTimezone(token, timezone));
  };

  const setReminders = async (enabled: boolean) => {
    if (!token) throw new Error('Sign in first.');
    setUser(await updateReminders(token, enabled));
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, signInWithGoogle, logout, setTimezone, setReminders, requestPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

/**
 * The signed-in user's stored IANA timezone (ND-1, missed-sessions M1.1b), or undefined.
 * Unlike useAuth it never throws outside an AuthProvider, so shared hooks and pages can use it safely;
 * the date helpers then fall back to the browser timezone, then UTC.
 */
export function useUserTimezone(): string | undefined {
  return useContext(AuthContext)?.user?.timezone || undefined;
}

/** The access token, or null. Like useUserTimezone it never throws outside an AuthProvider (next plan's Pro check). */
export function useAuthToken(): string | null {
  return useContext(AuthContext)?.token ?? null;
}
