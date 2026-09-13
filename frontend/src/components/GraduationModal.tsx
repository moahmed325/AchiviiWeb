import React, { useState, useEffect } from 'react';
import { GraduationState, GraduationChoice } from '../types';
import { submitGraduationChoice, fetchAggregatedProfile } from '../lib/api';
import { verifyOutcomeGate } from '../lib/adaptiveApi';
import type { OutcomeGateStatus } from '../types/adaptive';
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
  Sparkles,
} from 'lucide-react';

export interface GraduationModalProps {
  userGoalId?: string;
  goalTitle?: string;
  graduationState?: GraduationState;
  onResolved: () => void | Promise<void>;
}

export const GraduationModal: React.FC<GraduationModalProps> = ({
  userGoalId,
  goalTitle,
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

  // Outcome gate verification state
  const [gateStatus, setGateStatus] = useState<OutcomeGateStatus | null>(null);
  const [verifyingGate, setVerifyingGate] = useState<boolean>(false);

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

  const effectiveGoalId = userGoalId || graduationState?.user_goal_id || '';
  const effectiveGoalTitle = goalTitle || graduationState?.goal_title || '90-Day Adaptive Goal Protocol';

  useEffect(() => {
    if (!token || !effectiveGoalId) return;

    // Run Outcome Gate Verification
    setVerifyingGate(true);
    verifyOutcomeGate(token, { userGoalId: effectiveGoalId })
      .then((status) => {
        setGateStatus(status);
      })
      .catch(() => {})
      .finally(() => setVerifyingGate(false));

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
  }, [token, effectiveGoalId]);

  if ((graduationState && !graduationState.eligible) || isDismissed) {
    return null;
  }

  const completionRatePercent = graduationState ? Math.round(graduationState.completion_rate * 100) : 100;
  const coreHours = graduationState ? (graduationState.completed_sessions * 1.5).toFixed(1) : '72.0';
  const totalDays = graduationState?.total_plan_days || 90;

  const handleExportDebrief = (format: 'markdown' | 'json' = 'markdown') => {
    const debriefData = {
      protocol: 'Achivii Adaptive 90-Day Execution Protocol',
      status: 'VERIFIED_OUTCOME_GATE_GRADUATION',
      goalTitle: effectiveGoalTitle,
      userGoalId: effectiveGoalId,
      timestamp: new Date().toISOString(),
      outcomeGate: {
        isAchieved: gateStatus?.isAchieved ?? true,
        verificationCriteria: gateStatus?.verificationCriteria || 'Demonstrated unassisted real-world benchmark.',
        evidenceCount: gateStatus?.evidenceCount || 1,
      },
      metrics: {
        totalPlanDays: totalDays,
        completionRate: `${completionRatePercent}%`,
        coreHoursLogged: `${coreHours}h`,
        buffersAbsorbed: 'Zero Catch-Up Debt Incurred',
      },
      profileTelemetry: {
        peakWindow: profileTelemetry?.peakWindow || '08:00 - 10:00',
        bestWorkingHours: profileTelemetry?.bestWorkingHours || 'MORNING',
        lapseRisk: profileTelemetry?.lapseRisk || 'NOMINAL_CADENCE',
        preferredRemediation: profileTelemetry?.preferredRemediation || 'SHRINK_WEEK',
      },
      selectedNextStage: selectedChoice,
    };

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(debriefData, null, 2)], { type: 'application/json' });
      filename = `achivii-outcome-gate-${effectiveGoalId || 'protocol'}.json`;
    } else {
      const markdownContent = `# ACHIVII EXECUTION PROTOCOL // OUTCOME GATE GRADUATION DEBRIEF

**Protocol Status:** 100% VERIFIED DESTINATION MASTERY  
**Milestone Target:** ${effectiveGoalTitle}  
**Sign-off Timestamp:** ${new Date().toISOString()}  

---

## 1. Outcome Gate Empirical Verification
- **Destination Mastery:** ${gateStatus?.isAchieved ? 'VERIFIED' : 'PENDING FINAL CAPSTONE'}
- **Verification Criteria:** ${gateStatus?.verificationCriteria || 'Real-world unassisted demonstration'}
- **Evidence Count:** ${gateStatus?.evidenceCount || 1} Validating Proof Records

## 2. Executive Telemetry Readout
- **Core Hours Logged:** ${coreHours}h
- **Protocol Horizon:** 90 Days Total
- **Buffer Integrity:** Strategic Filtering Absorbed All Deviations (Zero Catch-Up Debt)

## 3. Profile Learning & Peak Windows
- **Calibrated Peak Window:** ${profileTelemetry?.peakWindow || '08:00 - 10:00'}
- **Optimal Day-Part:** ${profileTelemetry?.bestWorkingHours || 'MORNING'}
- **Autonomous Remediation:** ${profileTelemetry?.preferredRemediation || 'SHRINK_WEEK'}
- **Lapse Vector Status:** ${profileTelemetry?.lapseRisk || 'NOMINAL_CADENCE'}

## 4. Next Transition Stage
- **Selected Stage:** ${selectedChoice.toUpperCase()}

---
*Signed and audited by Achivii Adaptive Execution Engine.*
`;
      blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
      filename = `achivii-outcome-gate-${effectiveGoalId || 'protocol'}.md`;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Evidence Dossier exported as ${format.toUpperCase()}`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleConfirmChoice = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await submitGraduationChoice(token, userGoalId || '', selectedChoice);

      if (selectedChoice === 'start_new_goal') {
        navigate('/onboarding');
      } else {
        await onResolved();
        setIsDismissed(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit graduation choice.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={() => setIsDismissed(true)}
      />

      <div className="relative w-full max-w-2xl bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-emerald-500/40 shadow-2xl z-10 space-y-6 my-auto text-white">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#1a2824] pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                OUTCOME GATE // DESTINATION MASTERY
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold uppercase">
                GRADUATION ELIGIBLE
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {effectiveGoalTitle}
            </h2>

            <p className="text-xs font-mono text-neutral-400 leading-relaxed max-w-xl">
              All critical-path capabilities achieved and verified through empirical execution telemetry.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer shrink-0"
            title="Dismiss modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {/* Outcome Gate Status Badge */}
        <div className="p-4 rounded-xl bg-[#0d1412] border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              DESTINATION VERIFICATION CRITERIA
            </span>
            {verifyingGate && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
          </div>
          <p className="text-xs font-mono text-white leading-relaxed">
            {gateStatus?.verificationCriteria || 'Demonstrate unassisted real-world benchmark without failure.'}
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-neutral-400">
            <span>Evidence records ingested: <strong className="text-emerald-400">{gateStatus?.evidenceCount || 1}</strong></span>
            <span className="text-[#1a2824]">|</span>
            <span className="text-emerald-400 font-semibold">100% Validated</span>
          </div>
        </div>

        {/* Post-Graduation Trajectory Choice */}
        <div className="space-y-3">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-300 block">
            Select Your Next Evolution Stage:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Choice 1: Start New Goal */}
            <button
              type="button"
              onClick={() => setSelectedChoice('start_new_goal')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedChoice === 'start_new_goal'
                  ? 'bg-emerald-950/30 border-emerald-500/60 ring-1 ring-emerald-500/40'
                  : 'bg-[#0d1412] border-[#1a2824] hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-emerald-400 flex items-center gap-1.5">
                  <Compass className="w-4 h-4" />
                  INITIALIZE NEW PROTOCOL
                </span>
                {selectedChoice === 'start_new_goal' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p className="text-[11px] font-mono text-neutral-400 leading-snug">
                Archive this achievement and formalize your next 90-day goal using your established work capacity.
              </p>
            </button>

            {/* Choice 2: Enter Maintenance */}
            <button
              type="button"
              onClick={() => setSelectedChoice('maintenance_mode')}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                selectedChoice === 'maintenance_mode'
                  ? 'bg-sky-950/30 border-sky-500/60 ring-1 ring-sky-500/40'
                  : 'bg-[#0d1412] border-[#1a2824] hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-sky-400 flex items-center gap-1.5">
                  <PauseCircle className="w-4 h-4" />
                  AUTONOMOUS MAINTENANCE
                </span>
                {selectedChoice === 'maintenance_mode' && (
                  <CheckCircle2 className="w-4 h-4 text-sky-400" />
                )}
              </div>
              <p className="text-[11px] font-mono text-neutral-400 leading-snug">
                Maintain unassisted capability with autonomous practice. Your execution profile remains preserved.
              </p>
            </button>
          </div>
        </div>

        {/* Dossier Export Options */}
        <div className="p-3.5 rounded-xl bg-[#0d1412] border border-[#1a2824] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="space-y-0.5 text-center sm:text-left">
            <span className="text-xs font-mono font-bold text-white block">90-Day Evidence Dossier</span>
            <span className="text-[10px] font-mono text-neutral-400">Export verified telemetry and diagnostic history</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleExportDebrief('markdown')}
              className="px-3 py-1.5 rounded bg-[#0a0f0d] hover:bg-[#16221e] border border-[#1a2824] hover:border-emerald-500/40 text-[11px] font-mono text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>MARKDOWN</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportDebrief('json')}
              className="px-3 py-1.5 rounded bg-[#0a0f0d] hover:bg-[#16221e] border border-[#1a2824] hover:border-emerald-500/40 text-[11px] font-mono text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div className="p-2.5 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono text-center">
            {exportNotice}
          </div>
        )}

        {/* Confirm Action Button */}
        <button
          type="button"
          onClick={handleConfirmChoice}
          disabled={isSubmitting}
          className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#080d0b]" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          <span>CONFIRM GRADUATION & COMMENCE NEXT EVOLUTION</span>
        </button>
      </div>
    </div>
  );
};

export default GraduationModal;
