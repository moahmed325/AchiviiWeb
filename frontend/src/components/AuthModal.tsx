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
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-[#1a2824] shadow-2xl z-10 animate-in fade-in duration-200 my-auto">
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C]"
          aria-label="Close authentication modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-[#0d1412] p-1 border border-[#1a2824] mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('signin');
              setError(null);
            }}
            className={`flex-1 min-h-[40px] py-2 text-xs font-mono font-medium rounded-lg transition-all cursor-pointer ${
              authModalMode === 'signin'
                ? 'bg-[#07CB6C] text-[#080d0b] font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('signup');
              setError(null);
            }}
            className={`flex-1 min-h-[40px] py-2 text-xs font-mono font-medium rounded-lg transition-all cursor-pointer ${
              authModalMode === 'signup'
                ? 'bg-[#07CB6C] text-[#080d0b] font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Form Header */}
        <div className="text-left mb-6">
          <div className="text-[10px] font-mono text-[#07CB6C] uppercase tracking-wider mb-1 font-medium">
            AUTHENTICATION // SECURE ACCESS
          </div>
          <h3 className="text-lg font-semibold text-white tracking-tight">
            {authModalMode === 'signin' ? 'Account Login' : 'Initialize Account'}
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            {authModalMode === 'signin'
              ? 'Enter credentials to access active goal telemetry.'
              : 'Sign up to lock in routine telemetry and adaptive plans.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-rose-400 text-xs font-mono">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase tracking-wider font-medium">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@achivii.io"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0d1412] border border-[#1a2824] text-white placeholder-neutral-500 text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-neutral-300 mb-1.5 uppercase tracking-wider font-medium">
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
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#0d1412] border border-[#1a2824] text-white placeholder-neutral-500 text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>
            {authModalMode === 'signup' && (
              <p className="text-[11px] font-mono text-neutral-400 mt-1">Minimum 6 characters required.</p>
            )}
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] font-mono font-medium text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)]"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{authModalMode === 'signin' ? 'EXECUTE LOGIN' : 'CREATE ACCOUNT'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
