import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, setAuthModalMode, login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (authModalMode === 'signin') {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#0a0f0d] rounded-md p-6 sm:p-8 border border-[#1a2824] shadow-2xl z-10 animate-fadeInUp my-auto">
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-md text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Switcher */}
        <div className="flex rounded-md bg-[#0d1412] p-1 border border-[#1a2824] mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('signin');
              setError(null);
            }}
            className={`flex-1 min-h-[40px] py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              authModalMode === 'signin'
                ? 'bg-[#07CB6C] text-[#080d0b] font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('signup');
              setError(null);
            }}
            className={`flex-1 min-h-[40px] py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              authModalMode === 'signup'
                ? 'bg-[#07CB6C] text-[#080d0b] font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form Header */}
        <div className="text-left mb-6">
          <h3 className="text-lg font-semibold text-white tracking-tight">
            {authModalMode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            {authModalMode === 'signin'
              ? 'Sign in to continue to your plan.'
              : 'Get started in seconds.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-300 mb-1.5 font-medium">
              Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[#0d1412] border border-[#1a2824] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-300 mb-1.5 font-medium">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-md bg-[#0d1412] border border-[#1a2824] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>
            {authModalMode === 'signup' && (
              <p className="text-[11px] text-neutral-400 mt-1">Minimum 6 characters.</p>
            )}
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-md bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{authModalMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
