import React, { useState } from 'react';
import { GraduationState, GraduationChoice } from '../types';
import { submitGraduationChoice } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Rocket,
  ShieldCheck,
  PauseCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';

interface GraduationModalProps {
  graduationState: GraduationState;
  onResolved: () => void | Promise<void>;
}

export const GraduationModal: React.FC<GraduationModalProps> = ({
  graduationState,
  onResolved,
}) => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [selectedChoice, setSelectedChoice] = useState<GraduationChoice>('start_new_goal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!graduationState.eligible || isDismissed) {
    return null;
  }

  const handleConfirm = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitGraduationChoice(token, graduationState.user_goal_id, selectedChoice);
      await onResolved();

      if (selectedChoice === 'start_new_goal') {
        navigate('/onboarding');
      } else {
        setIsDismissed(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process graduation decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/60 text-left space-y-6 overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <GraduationCap className="w-4 h-4 text-indigo-400" />
            <span>Goal Milestone Reached</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Ready to Graduate "{graduationState.goal_title}"?
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
            {graduationState.graduation_message ||
              `You've reached the graduation window with ${graduationState.completed_sessions} completed sessions (${Math.round(graduationState.completion_rate * 100)}% completion). Decide how you'd like to shape your next phase.`}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Three Explicit Choices (Guardrail 1) */}
        <div className="grid grid-cols-1 gap-3.5">
          {/* Option 1: Start New Goal */}
          <div
            onClick={() => setSelectedChoice('start_new_goal')}
            role="button"
            tabIndex={0}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
              selectedChoice === 'start_new_goal'
                ? 'bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border-indigo-500 ring-2 ring-indigo-500/30'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white flex items-center gap-2">
                  Start a New Goal
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                    Recommended
                  </span>
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedChoice === 'start_new_goal'
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-slate-700'
                  }`}
                >
                  {selectedChoice === 'start_new_goal' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Graduate this goal and leverage your continuous profile learning. We’ll pre-fill your next goal onboarding with your learned peak hours and consistency rhythms.
              </p>
            </div>
          </div>

          {/* Option 2: Maintenance Mode */}
          <div
            onClick={() => setSelectedChoice('maintenance_mode')}
            role="button"
            tabIndex={0}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
              selectedChoice === 'maintenance_mode'
                ? 'bg-gradient-to-r from-emerald-950/60 to-teal-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  Enter Maintenance Mode
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedChoice === 'maintenance_mode'
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-700'
                  }`}
                >
                  {selectedChoice === 'maintenance_mode' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Keep the momentum going with a light, sustainable cadence. Prunes non-essential sessions down to 1–2 core practice sessions per week.
              </p>
            </div>
          </div>

          {/* Option 3: Pause Goal */}
          <div
            onClick={() => setSelectedChoice('pause')}
            role="button"
            tabIndex={0}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
              selectedChoice === 'pause'
                ? 'bg-gradient-to-r from-amber-950/60 to-orange-950/40 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">
                  Pause Goal Safely
                </span>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedChoice === 'pause'
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-slate-700'
                  }`}
                >
                  {selectedChoice === 'pause' && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Life is busy right now. Freezes your schedule without streak decay or penalties. You can resume at any time and your timeline will adjust smoothly.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-colors"
          >
            Decide Later
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Decision</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
