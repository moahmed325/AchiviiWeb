import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { User } from '../types';
import { fetchCurrentUser } from '../lib/api';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('No active session was returned. Please try again.');

    const accessToken = data.session.access_token;
    const currentUser = await fetchCurrentUser(accessToken);
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
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.session) {
      throw new Error('Account created. Check your email to confirm your account, then sign in.');
    }

    const accessToken = data.session.access_token;
    const currentUser = await fetchCurrentUser(accessToken);
    setToken(accessToken);
    setUser(currentUser);
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
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
