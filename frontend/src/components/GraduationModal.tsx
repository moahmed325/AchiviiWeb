import React, { useState, useEffect } from 'react';
import { GraduationState, GraduationChoice } from '../types';
import { submitGraduationChoice, fetchAggregatedProfile } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  ShieldCheck,
  PauseCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  X,
  Flag,
  Activity,
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

  // Profile learning telemetry state
  const [profileTelemetry, setProfileTelemetry] = useState<{
    bestWorkingHours?: string;
    peakWindow?: string;
    lapseRisk?: string;
    preferredRemediation?: string;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDismissed(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAggregatedProfile(token)
      .then((data) => {
        if (data && data.best_working_hours) {
          setProfileTelemetry({
            bestWorkingHours: data.best_working_hours.preferred_time_of_day?.toUpperCase() || 'MORNING',
            peakWindow: `${data.best_working_hours.peak_hour_window?.start || '08:00'} - ${data.best_working_hours.peak_hour_window?.end || '10:00'}`,
            lapseRisk: data.lapse_pattern_summary?.frequent_trigger || 'NOMINAL_CADENCE',
            preferredRemediation: data.lapse_pattern_summary?.preferred_recovery_choice?.toUpperCase() || 'SHRINK_WEEK',
          });
        }
      })
      .catch(() => {
        // Fallback default telemetry if not yet generated
        setProfileTelemetry({
          bestWorkingHours: 'MORNING',
          peakWindow: '08:00 - 10:00',
          lapseRisk: 'NOMINAL_CADENCE',
          preferredRemediation: 'SHRINK_WEEK',
        });
      });
  }, [token]);

  if (!graduationState.eligible || isDismissed) {
    return null;
  }

  const completionRatePercent = Math.round(graduationState.completion_rate * 100);

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
      setErrorMessage(err.message || 'Mission completion command failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050807]/85 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="graduation-modal-title"
      aria-describedby="graduation-modal-desc"
    >
      <div className="relative w-full max-w-2xl bg-[#0c1210] border border-[#182621] rounded-md p-5 sm:p-6 shadow-none text-left space-y-5 overflow-hidden my-auto">
        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          aria-label="Close graduation dialog"
          className="absolute top-4 right-4 min-h-[44px] min-w-[44px] p-2.5 rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#182621] transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Mission Completion Report Header */}
        <div className="space-y-1.5 pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C] flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-[#07CB6C]" />
              MISSION MILESTONE // GOAL BLUEPRINT COMPLETED
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30">
              {completionRatePercent}% CADENCE MET
            </span>
          </div>

          <h2 id="graduation-modal-title" className="text-base sm:text-lg font-bold text-[#e5ebe7]">
            Milestone Completion: "{graduationState.goal_title}"
          </h2>
          <p id="graduation-modal-desc" className="text-xs text-[#7e8f85] font-mono leading-relaxed">
            {graduationState.graduation_message ||
              `Execution telemetry confirms milestone completion with ${graduationState.completed_sessions} completed sessions (${completionRatePercent}% completion). Select an operational trajectory for the next lifecycle phase.`}
          </p>
        </div>

        {/* Monospace Continuous Profile Learning Key-Value Readouts */}
        <div className="p-3 rounded-sm bg-[#080d0b] border border-[#182621] space-y-2">
          <div className="flex items-center justify-between border-b border-[#182621] pb-1.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#a6b8ad] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />
              CONTINUOUS PROFILE LEARNING // TELEMETRY INSIGHTS
            </span>
            <span className="text-[9px] font-mono text-[#07CB6C] font-semibold">
              CALIBRATED
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2 rounded-sm bg-[#0c1210] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase block truncate">Peak Window</span>
              <span className="text-[11px] font-bold text-[#e5ebe7] block mt-0.5 truncate">
                {profileTelemetry?.peakWindow || '08:00 - 10:00'}
              </span>
            </div>

            <div className="p-2 rounded-sm bg-[#0c1210] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase block truncate">Optimal Day-Part</span>
              <span className="text-[11px] font-bold text-[#07CB6C] block mt-0.5 truncate">
                {profileTelemetry?.bestWorkingHours || 'MORNING'}
              </span>
            </div>

            <div className="p-2 rounded-sm bg-[#0c1210] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase block truncate">Completed Ratio</span>
              <span className="text-[11px] font-bold text-[#e5ebe7] block mt-0.5 truncate">
                {graduationState.completed_sessions}/{graduationState.total_sessions}
              </span>
            </div>

            <div className="p-2 rounded-sm bg-[#0c1210] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase block truncate">Preferred Vector</span>
              <span className="text-[11px] font-bold text-amber-400 block mt-0.5 truncate">
                {profileTelemetry?.preferredRemediation || 'SHRINK_WEEK'}
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-sm bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {/* Three Distinct Paths as Modular Technical Cards */}
        <div
          role="radiogroup"
          aria-label="Graduation operational pathways"
          className="space-y-2.5"
        >
          {/* Option A: Initialize New Blueprint */}
          <div
            onClick={() => setSelectedChoice('start_new_goal')}
            role="radio"
            aria-checked={selectedChoice === 'start_new_goal'}
            aria-label="Option A: Initialize New Blueprint. Re-enrollment flow leveraging continuous profile learning."
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedChoice('start_new_goal');
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                setSelectedChoice('maintenance_mode');
              }
            }}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer flex items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] ${
              selectedChoice === 'start_new_goal'
                ? 'bg-[#0a1711] border-[#07CB6C] text-[#e5ebe7]'
                : 'bg-[#080d0b] border-[#182621] hover:border-[#1f332c] text-[#7e8f85]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-sm border shrink-0 flex items-center justify-center mt-0.5 ${
                selectedChoice === 'start_new_goal'
                  ? 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]'
                  : 'bg-[#0c1210] border-[#182621] text-[#7e8f85]'
              }`}
            >
              <Compass className="w-4 h-4" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#e5ebe7] flex items-center gap-2">
                  OPTION A // INITIALIZE NEW BLUEPRINT
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 font-semibold">
                    RECOMMENDED
                  </span>
                </span>
                <span
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedChoice === 'start_new_goal'
                      ? 'border-[#07CB6C] bg-[#07CB6C]'
                      : 'border-[#182621]'
                  }`}
                >
                  {selectedChoice === 'start_new_goal' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#050807]" />
                  )}
                </span>
              </div>
              <p className="text-xs text-[#7e8f85] leading-normal font-sans">
                Graduate current objective and initialize next blueprint. Continuous profile learning automatically pre-populates your routine with verified peak performance windows.
              </p>
            </div>
          </div>

          {/* Option B: Maintenance Cadence */}
          <div
            onClick={() => setSelectedChoice('maintenance_mode')}
            role="radio"
            aria-checked={selectedChoice === 'maintenance_mode'}
            aria-label="Option B: Maintenance Cadence. 1 to 2 sessions per week habit sustainment."
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedChoice('maintenance_mode');
              } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault();
                setSelectedChoice('pause');
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                setSelectedChoice('start_new_goal');
              }
            }}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer flex items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C] ${
              selectedChoice === 'maintenance_mode'
                ? 'bg-[#0a1711] border-[#07CB6C] text-[#e5ebe7]'
                : 'bg-[#080d0b] border-[#182621] hover:border-[#1f332c] text-[#7e8f85]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-sm border shrink-0 flex items-center justify-center mt-0.5 ${
                selectedChoice === 'maintenance_mode'
                  ? 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]'
                  : 'bg-[#0c1210] border-[#182621] text-[#7e8f85]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#e5ebe7] flex items-center gap-2">
                  OPTION B // MAINTENANCE CADENCE
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-[#182621] text-[#a6b8ad] border border-[#1f332c] font-semibold">
                    SUSTAINMENT
                  </span>
                </span>
                <span
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedChoice === 'maintenance_mode'
                      ? 'border-[#07CB6C] bg-[#07CB6C]'
                      : 'border-[#182621]'
                  }`}
                >
                  {selectedChoice === 'maintenance_mode' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#050807]" />
                  )}
                </span>
              </div>
              <p className="text-xs text-[#7e8f85] leading-normal font-sans">
                Maintain established skill momentum with a low-friction cadence. Prunes weekly schedule down to 1–2 core sustainment sessions with zero buffer overhead.
              </p>
            </div>
          </div>

          {/* Option C: Standby / Pause */}
          <div
            onClick={() => setSelectedChoice('pause')}
            role="radio"
            aria-checked={selectedChoice === 'pause'}
            aria-label="Option C: Standby / Pause. Freezes active schedule state with zero penalty."
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedChoice('pause');
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault();
                setSelectedChoice('maintenance_mode');
              }
            }}
            className={`p-3.5 rounded-sm border transition-all cursor-pointer flex items-start gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              selectedChoice === 'pause'
                ? 'bg-amber-950/20 border-amber-500/50 text-[#e5ebe7]'
                : 'bg-[#080d0b] border-[#182621] hover:border-[#1f332c] text-[#7e8f85]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-sm border shrink-0 flex items-center justify-center mt-0.5 ${
                selectedChoice === 'pause'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-[#0c1210] border-[#182621] text-[#7e8f85]'
              }`}
            >
              <PauseCircle className="w-4 h-4" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#e5ebe7] flex items-center gap-2">
                  OPTION C // STANDBY / PAUSE
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                    FREEZE STATE
                  </span>
                </span>
                <span
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    selectedChoice === 'pause'
                      ? 'border-amber-400 bg-amber-400'
                      : 'border-[#182621]'
                  }`}
                >
                  {selectedChoice === 'pause' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#050807]" />
                  )}
                </span>
              </div>
              <p className="text-xs text-[#7e8f85] leading-normal font-sans">
                Freezes active schedule state without streak decay or penalties. All progression telemetry and completion history remain preserved for resumption at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#182621]">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#111a17] active:scale-[0.99] text-xs font-mono transition-colors cursor-pointer text-center"
          >
            DISMISS REPORT [ESC]
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="w-full sm:w-auto min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] active:scale-[0.99] text-[#050807] font-mono font-bold text-xs transition-all disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07CB6C]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>PROCESSING PROTOCOL...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>EXECUTE TRANSITION // CONFIRM PROTOCOL</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
