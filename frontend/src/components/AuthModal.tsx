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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#050807]/85 transition-opacity"
        onClick={closeAuthModal}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md bg-[#0c1210] rounded-md p-6 sm:p-8 border border-[#182621] shadow-none z-10 animate-in fade-in duration-200">
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 min-h-[44px] min-w-[44px] p-2.5 rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#182621] transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C]"
          aria-label="Close authentication modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Switcher */}
        <div className="flex rounded-sm bg-[#080d0b] p-1 border border-[#182621] mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('signin');
              setError(null);
            }}
            className={`flex-1 min-h-[44px] py-2 text-xs font-mono font-semibold rounded-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] ${
              authModalMode === 'signin'
                ? 'bg-[#07CB6C] text-[#050807] font-bold'
                : 'text-[#7e8f85] hover:text-[#e5ebe7]'
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
            className={`flex-1 min-h-[44px] py-2 text-xs font-mono font-semibold rounded-sm transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] ${
              authModalMode === 'signup'
                ? 'bg-[#07CB6C] text-[#050807] font-bold'
                : 'text-[#7e8f85] hover:text-[#e5ebe7]'
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Form Header */}
        <div className="text-left mb-6">
          <div className="text-[10px] font-mono text-[#07CB6C] uppercase tracking-wider mb-1">
            AUTHENTICATION // SECURE ACCESS
          </div>
          <h3 className="text-lg font-bold text-[#e5ebe7]">
            {authModalMode === 'signin' ? 'Account Login' : 'Initialize Account'}
          </h3>
          <p className="text-xs text-[#7e8f85] mt-1 font-mono">
            {authModalMode === 'signin'
              ? 'Enter credentials to access active goal telemetry.'
              : 'Sign up to lock in routine telemetry and adaptive plans.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-sm bg-[#ef4444]/15 border border-[#ef4444]/30 flex items-start gap-2.5 text-[#ef4444] text-xs font-mono">
            <AlertCircle className="w-4 h-4 text-[#ef4444] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[#7e8f85] mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#7e8f85] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@achivii.io"
                className="w-full pl-10 pr-4 py-2.5 rounded-sm bg-[#080d0b] border border-[#182621] text-[#e5ebe7] placeholder-[#4e6155] text-base md:text-xs font-mono focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-[#7e8f85] mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#7e8f85] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-sm bg-[#080d0b] border border-[#182621] text-[#e5ebe7] placeholder-[#4e6155] text-base md:text-xs font-mono focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-all"
              />
            </div>
            {authModalMode === 'signup' && (
              <p className="text-[11px] font-mono text-[#7e8f85] mt-1">Minimum 6 characters required.</p>
            )}
          </div>

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 min-h-[44px] py-2.5 px-4 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.99] text-[#050807] font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C]"
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
