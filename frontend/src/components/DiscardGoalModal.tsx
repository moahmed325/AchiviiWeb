import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { discardGoal } from '../lib/api';
import { AlertTriangle, X, Loader2, ShieldAlert } from 'lucide-react';

interface DiscardGoalModalProps {
  goalId?: string;
  goalTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const REQUIRED_CONFIRMATION_TEXT = 'delete my goal';

export const DiscardGoalModal: React.FC<DiscardGoalModalProps> = ({
  goalId,
  goalTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmationInput('');
      setIsDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isVerified = confirmationInput.trim() === REQUIRED_CONFIRMATION_TEXT;

  const handleDiscard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified || !token || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      await discardGoal(token, goalId);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to terminate protocol. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-modal-title"
      className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-[#0a0f0d] border border-red-500/30 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-[#131f1b] transition-colors cursor-pointer disabled:opacity-30"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Tag & Icon */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#ef4444]">
              [ CRITICAL ACTION // TERMINATE PROTOCOL ]
            </span>
          </div>

          <h2 id="discard-modal-title" className="text-xl font-bold text-white tracking-tight">
            Discard Active Protocol?
          </h2>

          {goalTitle && (
            <div className="text-xs font-mono text-neutral-300 px-2.5 py-1.5 rounded bg-[#0d1412] border border-[#1a2824] truncate">
              {goalTitle}
            </div>
          )}
        </div>

        {/* Warning Copy */}
        <div className="space-y-2 text-xs font-mono text-neutral-300 leading-relaxed border-l-2 border-red-500/60 pl-3">
          <p>
            This will permanently purge your scheduled core sessions, buffer allocations, and 90-day trajectory.
          </p>
          <p className="text-red-400 font-semibold">
            This action cannot be undone.
          </p>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleDiscard} className="space-y-4 pt-1">
          <div className="space-y-2">
            <label
              htmlFor="verification-input"
              className="block text-xs font-mono text-neutral-300"
            >
              Type <strong className="text-red-400 font-mono">"delete my goal"</strong> below to confirm:
            </label>
            <input
              id="verification-input"
              type="text"
              autoFocus
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="delete my goal"
              autoComplete="off"
              disabled={isDeleting}
              className="bg-[#0c1210] border border-[#1a2824] focus:border-red-500 text-white font-mono text-sm px-3.5 py-2.5 rounded-lg w-full outline-none transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="min-h-[44px] px-4 py-2 text-xs font-mono text-neutral-300 hover:text-white bg-[#0d1412] hover:bg-[#131f1b] border border-[#1a2824] rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            >
              Keep Protocol
            </button>

            <button
              type="submit"
              disabled={!isVerified || isDeleting}
              className={`min-h-[44px] py-2.5 px-4 rounded-lg font-medium text-xs font-mono transition-colors flex items-center justify-center gap-2 ${
                isVerified && !isDeleting
                  ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'opacity-40 cursor-not-allowed bg-red-900/30 text-red-400 border border-red-900/50'
              }`}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Purging Protocol...</span>
                </>
              ) : (
                <span>Permanently Discard Protocol</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
