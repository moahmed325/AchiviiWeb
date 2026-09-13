import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateSession } from '../lib/api';
import { recordSessionTelemetry } from '../lib/adaptiveApi';
import { getLocalDateString } from '../lib/dateUtils';
import { Session } from '../types';
import type { ExecutionState } from '../types/adaptive';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  Sun, 
  Sunset, 
  Moon, 
  AlertCircle, 
  Loader2, 
  SkipForward, 
  ShieldCheck,
  FileText,
  Activity,
} from 'lucide-react';

interface SessionDetailModalProps {
  session: Session | null;
  onClose: () => void;
  onSessionUpdated: (updated: Session) => void;
  onDiagnosisTriggered?: () => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  onClose,
  onSessionUpdated,
  onDiagnosisTriggered,
}) => {
  const { token, user } = useAuth();
  if (!session) return null;

  const [dateStr, setDateStr] = useState<string>(() =>
    session.scheduled_date ? getLocalDateString(session.scheduled_date, user?.timezone) : ''
  );
  const [startTime, setStartTime] = useState<string>(session.start_time || '09:00');
  const [endTime, setEndTime] = useState<string>(session.end_time || '10:00');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [confirmingSkip, setConfirmingSkip] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Adaptive Telemetry fields
  const standardMinutes = session.task_template?.session_duration_minutes || 45;
  const [doseLevel, setDoseLevel] = useState<'STANDARD' | 'REDUCED' | 'MVS'>('STANDARD');
  const [proofText, setProofText] = useState<string>('');
  const [rpe, setRpe] = useState<number>(7);

  const activeDuration =
    doseLevel === 'MVS'
      ? Math.max(15, Math.round(standardMinutes * 0.4))
      : doseLevel === 'REDUCED'
      ? Math.max(20, Math.round(standardMinutes * 0.65))
      : standardMinutes;

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-amber-400" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-neutral-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  // Primary Action: Record Completed Execution Telemetry
  const handleRecordCompleted = async () => {
    if (!token) return;
    setIsUpdating(true);
    setError(null);
    setNotice(null);
    try {
      const execState: ExecutionState =
        doseLevel === 'MVS' ? 'MINIMUM_VIABLE' : doseLevel === 'REDUCED' ? 'REDUCED' : 'COMPLETED';

      const res = await recordSessionTelemetry(token, {
        sessionId: session.id,
        executionState: execState,
        proofOfWorkText: proofText.trim() || undefined,
        rpeRating: rpe,
        durationMinutes: activeDuration,
      });

      // Check deviation response
      if (res.deviationReport?.requiresDiagnostic) {
        setNotice('Session recorded. Strategic deviation flagged: Bottleneck capability requires diagnostic alignment.');
        if (onDiagnosisTriggered) {
          setTimeout(() => {
            onDiagnosisTriggered();
          }, 1200);
        }
      } else {
        setNotice(`Telemetry ingested (${activeDuration}m, ${doseLevel} dose). Trajectory calibrated.`);
      }

      onSessionUpdated({ ...session, status: 'DONE' });
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Failed to record session telemetry.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Secondary Action: Skip Session & Strategic Filtering
  const handleSkip = async () => {
    if (!token) return;
    if (!confirmingSkip) {
      setConfirmingSkip(true);
      return;
    }

    setIsUpdating(true);
    setConfirmingSkip(false);
    setError(null);
    try {
      const res = await recordSessionTelemetry(token, {
        sessionId: session.id,
        executionState: 'MISSED',
      });

      if (res.deviationReport?.requiresDiagnostic) {
        setNotice('Material disruption detected: Critical path threatened. Initiating diagnostic replan.');
        if (onDiagnosisTriggered) {
          setTimeout(() => {
            onDiagnosisTriggered();
          }, 1200);
        }
      } else {
        setNotice('Session missed. Low-impact variance silently absorbed by reliability margin. Zero catch-up debt added.');
      }

      onSessionUpdated({ ...session, status: 'MISSED' });
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setError(err.message || 'Failed to skip session');
    } finally {
      setIsUpdating(false);
    }
  };

  // Manual Schedule Override
  const handleSaveTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (startTime >= endTime) {
      setError('End time must be after start time.');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await updateSession(token, session.id, {
        scheduled_date: new Date(dateStr).toISOString(),
        start_time: startTime,
        end_time: endTime,
      });
      setNotice('Session schedule updated successfully.');
      onSessionUpdated(res.session);
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule session');
    } finally {
      setIsUpdating(false);
    }
  };

  const isDone = session.status === 'DONE';
  const isMissed = session.status === 'MISSED';
  const isRescheduled = session.status === 'RESCHEDULED';

  const sessionTier = session.tier || (
    session.task_template?.title?.toLowerCase().includes('reflect') ? 'reflect' :
    isRescheduled ? 'buffer' : 'core'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Dim Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0a0f0d] rounded-2xl p-6 sm:p-8 border border-[#1a2824] shadow-2xl z-10 space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#1a2824] pb-4">
          <div className="space-y-1.5 min-w-0 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400">
                SESSION TELEMETRY // {session.task_template?.phase?.title?.split(':')[0] || 'PHASE 1'}
              </span>

              {/* Explicit Tier Tag */}
              {sessionTier === 'core' && (
                <span className="px-1.5 py-0.5 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-[10px] font-mono font-medium tracking-wider">
                  [TIER 1 CORE]
                </span>
              )}
              {sessionTier === 'buffer' && (
                <span className="px-1.5 py-0.5 rounded bg-sky-950/40 border border-sky-500/30 text-sky-400 text-[10px] font-mono font-medium tracking-wider">
                  [TIER 2 SUPPORTIVE]
                </span>
              )}
              {sessionTier === 'reflect' && (
                <span className="px-1.5 py-0.5 rounded bg-[#131f1b] border border-[#1a2824] text-neutral-300 text-[10px] font-mono font-medium tracking-wider">
                  [TIER 3 BUFFER]
                </span>
              )}

              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${
                  isDone
                    ? 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                    : isMissed
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : isRescheduled
                    ? 'bg-amber-400/10 text-amber-400 border-amber-400/30'
                    : 'bg-[#0d1412] text-neutral-400 border-[#1a2824]'
                }`}
              >
                STATUS: {session.status}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight truncate">
              {session.task_template?.title || 'Execution Session'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-[#131f1b] transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Multi-Dose Telemetry Formulation */}
        {!isDone && (
          <div className="space-y-4 p-4 rounded-xl bg-[#0d1412] border border-[#1a2824]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />
                EXECUTION DOSE SELECTION
              </span>
              <span className="text-xs font-mono font-bold text-[#07CB6C]">
                {activeDuration} MIN ESTIMATED
              </span>
            </div>

            {/* Dose Level Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDoseLevel('STANDARD')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  doseLevel === 'STANDARD'
                    ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-white'
                    : 'bg-[#0a0f0d] border-[#1a2824] text-neutral-400 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-mono uppercase block text-neutral-400">Standard</span>
                <span className="text-xs font-bold font-mono">{standardMinutes}m</span>
              </button>

              <button
                type="button"
                onClick={() => setDoseLevel('REDUCED')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  doseLevel === 'REDUCED'
                    ? 'bg-amber-500/15 border-amber-500 text-white'
                    : 'bg-[#0a0f0d] border-[#1a2824] text-neutral-400 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-mono uppercase block text-amber-400">Reduced</span>
                <span className="text-xs font-bold font-mono">{Math.max(20, Math.round(standardMinutes * 0.65))}m</span>
              </button>

              <button
                type="button"
                onClick={() => setDoseLevel('MVS')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  doseLevel === 'MVS'
                    ? 'bg-sky-500/15 border-sky-500 text-white'
                    : 'bg-[#0a0f0d] border-[#1a2824] text-neutral-400 hover:text-white'
                }`}
              >
                <span className="text-[10px] font-mono uppercase block text-sky-400">MVS Floor</span>
                <span className="text-xs font-bold font-mono">{Math.max(15, Math.round(standardMinutes * 0.4))}m</span>
              </button>
            </div>

            {/* Proof of Work Text */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-neutral-500" />
                Proof of Work / Verification Notes (Optional)
              </label>
              <input
                type="text"
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="e.g. 5km completed in 24m30s, no pain"
                className="w-full px-3 py-2 rounded-lg bg-[#0a0f0d] border border-[#1a2824] text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-[#07CB6C]"
              />
            </div>

            {/* RPE Rating */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-neutral-400 uppercase tracking-wider">Perceived Exertion (RPE 1–10)</span>
                <span className="text-[#07CB6C] font-bold">RPE {rpe} / 10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={rpe}
                onChange={(e) => setRpe(Number(e.target.value))}
                className="w-full accent-[#07CB6C] cursor-pointer"
              />
            </div>

            {/* Ingestion Trigger Button */}
            <button
              type="button"
              onClick={handleRecordCompleted}
              disabled={isUpdating}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] active:scale-[0.99] text-[#080d0b] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(7,203,108,0.25)] disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#080d0b]" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>LOG TELEMETRY & COMPLETE</span>
            </button>
          </div>
        )}

        {/* If Already Completed */}
        {isDone && (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold text-emerald-400 block">
                TELEMETRY VERIFIED & COMPLETE
              </span>
              <p className="text-[11px] font-mono text-neutral-400">
                Session evidence has been factored into the Capability State Graph.
              </p>
            </div>
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          </div>
        )}

        {/* Manual Schedule Override & Skip Action */}
        <form onSubmit={handleSaveTime} className="space-y-4 pt-2 border-t border-[#1a2824]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400">
              SCHEDULE CALIBRATION OVERRIDE
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
              {getTimeIcon(session.task_template?.preferred_time_of_day)}
              <span className="capitalize">{session.task_template?.preferred_time_of_day || 'Flexible'} slot</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">DATE</label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-white text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">START TIME</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-white text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">END TIME</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#0d1412] border border-[#1a2824] text-white text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <button
              id="btn-modal-skip-session"
              type="button"
              onClick={handleSkip}
              disabled={isUpdating || isDone}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                confirmingSkip
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                  : 'bg-[#0d1412] hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400 border border-[#1a2824] hover:border-rose-500/40'
              }`}
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>{confirmingSkip ? 'CONFIRM SKIP (NO DEBT)?' : 'RECORD MISSED'}</span>
            </button>

            <button
              id="btn-modal-save-time"
              type="submit"
              disabled={isUpdating}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#131f1b] hover:bg-[#1c2c26] text-white text-xs font-mono font-medium border border-[#1a2824] hover:border-[#2a3e38] transition-colors cursor-pointer disabled:opacity-50"
            >
              SAVE SCHEDULE OVERRIDE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
