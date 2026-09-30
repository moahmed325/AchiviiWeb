import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { User } from '../types';
import { loginUser, signupUser, fetchCurrentUser } from '../lib/api';
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
const TOKEN_STORAGE_KEY = 'achivii_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
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

      const legacyToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!legacyToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(legacyToken);
        if (active) {
          setToken(legacyToken);
          setUser(currentUser);
        }
      } catch {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        if (active) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
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
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error(error?.message || 'Login failed.');
      }
      const accessToken = data.session.access_token;
      const currentUser = await fetchCurrentUser(accessToken);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(accessToken);
      setUser(currentUser);
      return;
    }

    const res = await loginUser(email, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const signup = async (email: string, password: string) => {
    if (supabase) {
      const tz = (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') || 'UTC';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { timezone: tz } },
      });
      if (error) throw new Error(error.message);
      if (!data.session) {
        throw new Error('Account created. Please confirm your email, then sign in.');
      }
      const accessToken = data.session.access_token;
      const currentUser = await fetchCurrentUser(accessToken);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(accessToken);
      setUser(currentUser);
      return;
    }

    const tz = (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') || 'UTC';
    const res = await signupUser(email, password, tz);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
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
