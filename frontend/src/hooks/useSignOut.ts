import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Signs out and goes to the landing page, in one transition (the Account page and onboarding's Account). */
export const useSignOut = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  // The router applies navigation as a transition. Clearing the session in the same transition means no render sees
  // a protected page without a user, which would redirect to /login instead of the landing page.
  return useCallback(() => {
    React.startTransition(() => {
      logout();
      navigate('/');
    });
  }, [logout, navigate]);
};
