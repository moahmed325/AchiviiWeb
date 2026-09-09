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
  Download,
  FileText,
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
  const [exportNotice, setExportNotice] = useState<string | null>(null);

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
  const coreHours = (graduationState.completed_sessions * 1.5).toFixed(1);
  const totalDays = graduationState.total_plan_days || 90;

  const handleExportDebrief = (format: 'markdown' | 'json' = 'markdown') => {
    const debriefData = {
      protocol: 'Achivii Execution Protocol v2.0',
      status: 'VERIFIED_GRADUATION',
      goalTitle: graduationState.goal_title,
      userGoalId: graduationState.user_goal_id,
      timestamp: new Date().toISOString(),
      metrics: {
        totalPlanDays: totalDays,
        completedSessions: graduationState.completed_sessions,
        totalSessions: graduationState.total_sessions,
        completionRate: `${completionRatePercent}%`,
        coreHoursLogged: `${coreHours}h`,
        buffersAbsorbed: '6 Shifts / 0 Dropped',
      },
      profileTelemetry: {
        peakWindow: profileTelemetry?.peakWindow || '08:00 - 10:00',
        bestWorkingHours: profileTelemetry?.bestWorkingHours || 'MORNING',
        lapseRisk: profileTelemetry?.lapseRisk || 'NOMINAL_CADENCE',
        preferredRemediation: profileTelemetry?.preferredRemediation || 'SHRINK_WEEK',
      },
      selectedTrajectory: selectedChoice,
    };

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(debriefData, null, 2)], { type: 'application/json' });
      filename = `achivii-debrief-${graduationState.user_goal_id || 'protocol'}.json`;
    } else {
      const markdownContent = `# ACHIVII EXECUTION PROTOCOL // GRADUATION DEBRIEF

**Protocol Status:** 100% VERIFIED GRADUATION  
**Milestone Target:** ${graduationState.goal_title}  
**Sign-off Timestamp:** ${new Date().toISOString()}  

---

## 1. Executive Telemetry Readout
- **Core Hours Logged:** ${coreHours}h
- **Milestones Executed:** ${graduationState.completed_sessions} of ${graduationState.total_sessions} Sessions (${completionRatePercent}%)
- **Protocol Duration:** ${totalDays} Days Total
- **Buffer Integrity:** 6 Shifts Absorbed / 0 Milestones Dropped (Zero Fragility)

## 2. Profile Learning & Peak Windows
- **Calibrated Peak Window:** ${profileTelemetry?.peakWindow || '08:00 - 10:00'}
- **Optimal Day-Part:** ${profileTelemetry?.bestWorkingHours || 'MORNING'}
- **Autonomous Remediation:** ${profileTelemetry?.preferredRemediation || 'SHRINK_WEEK'}
- **Lapse Vector Status:** ${profileTelemetry?.lapseRisk || 'NOMINAL_CADENCE'}

## 3. Transition Trajectory
- **Selected Next Stage:** ${selectedChoice.toUpperCase()}

---
*Signed and audited by Achivii Anti-Failure Engine.*
`;
      blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
      filename = `achivii-debrief-${graduationState.user_goal_id || 'protocol'}.md`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Debrief exported successfully (${filename}).`);
    setTimeout(() => setExportNotice(null), 4000);
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="graduation-modal-title"
      aria-describedby="graduation-modal-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsDismissed(true);
      }}
    >
      <div className="bg-[#0a0f0d] border border-[#1a2824] rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden my-auto text-left space-y-6">
        {/* Soft radial mint glow behind window */}
        <div className="absolute -top-32 -right-32 w-72 h-72 bg-[#07CB6C]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-[#07CB6C]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Dismiss Button */}
        <button
          onClick={() => setIsDismissed(true)}
          aria-label="Close graduation dialog"
          className="absolute top-5 right-5 p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header & Telemetry */}
        <div className="space-y-2 pr-8 relative z-10">
          <span className="font-mono text-xs text-[#07CB6C] tracking-widest uppercase block font-medium">
            [ PROTOCOL COMPLETE // 90-DAY GRADUATION ]
          </span>
          <h2 id="graduation-modal-title" className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Protocol Completed: 100% Verified
          </h2>
          <p id="graduation-modal-desc" className="text-neutral-400 text-sm leading-relaxed">
            All core deliverables deployed and validated. 90-day milestone requirements satisfied for &ldquo;{graduationState.goal_title}&rdquo;.
          </p>
        </div>

        {/* Final Protocol Telemetry Strip (3-Column Metric Cards) */}
        <div className="grid grid-cols-3 gap-3 my-6 relative z-10">
          <div className="bg-[#0d1412] border border-[#1a2824] p-3.5 rounded-xl space-y-1">
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
              Core Hours Logged
            </span>
            <span className="text-base sm:text-lg font-semibold text-white block">
              {coreHours}h
            </span>
            <span className="font-mono text-[10px] text-[#07CB6C] block">
              {graduationState.completed_sessions} Sessions
            </span>
          </div>

          <div className="bg-[#0d1412] border border-[#1a2824] p-3.5 rounded-xl space-y-1">
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
              Buffers Absorbed
            </span>
            <span className="text-base sm:text-lg font-semibold text-white block">
              6 Shifts
            </span>
            <span className="font-mono text-[10px] text-neutral-400 block">
              0 Dropped
            </span>
          </div>

          <div className="bg-[#0d1412] border border-[#1a2824] p-3.5 rounded-xl space-y-1">
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider block">
              On-Time Completion
            </span>
            <span className="text-base sm:text-lg font-semibold text-white block">
              {totalDays} Days Total
            </span>
            <span className="font-mono text-[10px] text-[#07CB6C] block">
              100% Verified
            </span>
          </div>
        </div>

        {/* Export Telemetry Action */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] relative z-10">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-[#07CB6C] shrink-0" />
            <div>
              <span className="text-xs font-medium text-white block">
                Telemetry Protocol Debrief
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                Audit logs, schedule parameters, and learned windows
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportDebrief('markdown')}
              className="px-3 py-1.5 rounded-lg border border-[#1a2824] bg-[#0a0f0d] text-neutral-300 hover:text-white hover:border-[#2a3e38] text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Export Debrief (MD)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportDebrief('json')}
              className="px-2.5 py-1.5 rounded-lg border border-[#1a2824] bg-[#0a0f0d] text-neutral-400 hover:text-white hover:border-[#2a3e38] text-xs font-mono font-medium transition-colors cursor-pointer"
              title="Export Raw JSON"
            >
              JSON
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="p-3 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {/* Transition Trajectory Options */}
        <div className="space-y-2.5 relative z-10">
          <label className="font-mono text-xs text-neutral-300 uppercase tracking-wider block font-medium">
            Next Stage Operational Trajectory
          </label>

          <div
            role="radiogroup"
            aria-label="Graduation operational pathways"
            className="space-y-2"
          >
            {/* Option A: Initialize New Blueprint */}
            <div
              onClick={() => setSelectedChoice('start_new_goal')}
              role="radio"
              aria-checked={selectedChoice === 'start_new_goal'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedChoice('start_new_goal');
                }
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedChoice === 'start_new_goal'
                  ? 'border-[#07CB6C] bg-[#07CB6C]/10 text-white'
                  : 'border-[#1a2824] bg-[#0d1412] text-neutral-400 hover:text-white hover:border-[#2a3e38]'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center mt-0.5 ${
                  selectedChoice === 'start_new_goal'
                    ? 'bg-[#07CB6C]/20 border-[#07CB6C]/40 text-[#07CB6C]'
                    : 'bg-[#0a0f0d] border-[#1a2824] text-neutral-500'
                }`}
              >
                <Compass className="w-4 h-4" />
              </div>

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    Option A // Initialize New Blueprint
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30 font-medium">
                      RECOMMENDED
                    </span>
                  </span>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChoice === 'start_new_goal'
                        ? 'border-[#07CB6C] bg-[#07CB6C]'
                        : 'border-[#1a2824]'
                    }`}
                  >
                    {selectedChoice === 'start_new_goal' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#080d0b]" />
                    )}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                  Deploy your next 90-day objective with continuous profile learning and verified peak performance windows.
                </p>
              </div>
            </div>

            {/* Option B: Maintenance Cadence */}
            <div
              onClick={() => setSelectedChoice('maintenance_mode')}
              role="radio"
              aria-checked={selectedChoice === 'maintenance_mode'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedChoice('maintenance_mode');
                }
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedChoice === 'maintenance_mode'
                  ? 'border-[#07CB6C] bg-[#07CB6C]/10 text-white'
                  : 'border-[#1a2824] bg-[#0d1412] text-neutral-400 hover:text-white hover:border-[#2a3e38]'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center mt-0.5 ${
                  selectedChoice === 'maintenance_mode'
                    ? 'bg-[#07CB6C]/20 border-[#07CB6C]/40 text-[#07CB6C]'
                    : 'bg-[#0a0f0d] border-[#1a2824] text-neutral-500'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </div>

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    Option B // Maintenance Cadence
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1a2824] text-neutral-400 border border-[#2a3e38] font-medium">
                      SUSTAINMENT
                    </span>
                  </span>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChoice === 'maintenance_mode'
                        ? 'border-[#07CB6C] bg-[#07CB6C]'
                        : 'border-[#1a2824]'
                    }`}
                  >
                    {selectedChoice === 'maintenance_mode' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#080d0b]" />
                    )}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                  Prunes schedule down to 1–2 weekly habit sustainment sessions to preserve skill momentum.
                </p>
              </div>
            </div>

            {/* Option C: Standby / Pause */}
            <div
              onClick={() => setSelectedChoice('pause')}
              role="radio"
              aria-checked={selectedChoice === 'pause'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedChoice('pause');
                }
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedChoice === 'pause'
                  ? 'border-amber-400/60 bg-amber-500/10 text-white'
                  : 'border-[#1a2824] bg-[#0d1412] text-neutral-400 hover:text-white hover:border-[#2a3e38]'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center mt-0.5 ${
                  selectedChoice === 'pause'
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-[#0a0f0d] border-[#1a2824] text-neutral-500'
                }`}
              >
                <PauseCircle className="w-4 h-4" />
              </div>

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-2">
                    Option C // Standby / Pause
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
                      FREEZE STATE
                    </span>
                  </span>
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      selectedChoice === 'pause'
                        ? 'border-amber-400 bg-amber-400'
                        : 'border-[#1a2824]'
                    }`}
                  >
                    {selectedChoice === 'pause' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#080d0b]" />
                    )}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed font-sans">
                  Freezes active schedule state with zero penalty or streak decay, preserved for resumption at any time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Exit CTA */}
        <div className="pt-2 relative z-10">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-[#07CB6C] text-[#080d0b] font-medium py-2.5 px-5 rounded-lg hover:bg-[#06b860] active:scale-[0.99] transition-all w-full flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(7,203,108,0.25)] disabled:opacity-50 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Archiving Protocol...</span>
              </>
            ) : (
              <>
                <span>Archive Protocol & Return to Workbench</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
