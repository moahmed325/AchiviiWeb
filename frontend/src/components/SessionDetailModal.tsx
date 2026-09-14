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
  FileText,
  Activity,
  Calendar,
} from 'lucide-react';
import { formatTaskTitle } from '../lib/formatters';

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

  // Dose options
  const standardMinutes = session.task_template?.session_duration_minutes || 45;
  const [doseLevel, setDoseLevel] = useState<'STANDARD' | 'REDUCED' | 'MVS'>('STANDARD');
  const [proofText, setProofText] = useState<string>('');
  const rpe = 7;

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

  // Quick Reschedule Helpers
  const handleMoveToTomorrow = () => {
    const base = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    base.setDate(base.getDate() + 1);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    setDateStr(`${y}-${m}-${d}`);
  };

  const handleMoveToSunday = () => {
    const base = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
    const day = base.getDay(); // 0 is Sunday
    const daysUntilSunday = (7 - day) % 7 || 7;
    base.setDate(base.getDate() + daysUntilSunday);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    setDateStr(`${y}-${m}-${d}`);
  };

  // Action: Complete Session
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

      if (res.deviationReport?.requiresDiagnostic) {
        setNotice('Session recorded. Strategic replan requested.');
        if (onDiagnosisTriggered) {
          setTimeout(() => {
            onDiagnosisTriggered();
          }, 1200);
        }
      } else {
        setNotice(`Session completed (${activeDuration}m). Progress recorded!`);
      }

      onSessionUpdated({ ...session, status: 'DONE' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to record session.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Action: Skip / Miss Session
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
        setNotice('Session missed. Schedule adjusting to protect your outcome.');
        if (onDiagnosisTriggered) {
          setTimeout(() => {
            onDiagnosisTriggered();
          }, 1200);
        }
      } else {
        setNotice('Session marked missed. Absorbed into buffer without backlog debt.');
      }

      onSessionUpdated({ ...session, status: 'MISSED' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update session.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Action: Save New Date & Time
  const handleSaveTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsUpdating(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await updateSession(token, session.id, {
        scheduled_date: new Date(`${dateStr}T12:00:00Z`).toISOString(),
        start_time: startTime,
        end_time: endTime,
        status: session.status === 'DONE' ? 'DONE' : 'RESCHEDULED',
      });
      setNotice('Session schedule updated.');
      onSessionUpdated(updated.session);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to update session time.');
    } finally {
      setIsUpdating(false);
    }
  };

  const isDone = session.status === 'DONE';
  const isRescheduled = session.status === 'RESCHEDULED';
  const sessionTier = (session as any).tier || (session.task_template as any)?.tier || 'core';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0a0f0d] rounded-2xl p-6 sm:p-7 border border-white/10 shadow-2xl z-10 space-y-5 my-auto max-h-[92vh] overflow-y-auto scrollbar-thin">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
          <div className="space-y-1.5 min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
                {sessionTier === 'core' ? 'Core Focus' : sessionTier === 'reflect' ? 'Weekly Review' : 'Buffer Session'}
              </span>

              {isDone && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Completed
                </span>
              )}
              {isRescheduled && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
                  Rescheduled
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
              {formatTaskTitle(session.task_template?.title) || 'Execution Session'}
            </h3>

            {session.task_template?.description && (
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                {session.task_template.description}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Execution Dose & Completion */}
        {!isDone && (
          <div className="space-y-3.5 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Session Duration</span>
              </span>
              <span className="text-xs font-mono font-medium text-[#07CB6C]">
                {activeDuration} min target
              </span>
            </div>

            {/* Dose Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDoseLevel('STANDARD')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  doseLevel === 'STANDARD'
                    ? 'bg-[#07CB6C]/15 border-[#07CB6C] text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                <span className="text-[10px] uppercase block text-neutral-400 font-medium">Standard</span>
                <span className="text-xs font-bold font-mono">{standardMinutes}m</span>
              </button>

              <button
                type="button"
                onClick={() => setDoseLevel('REDUCED')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  doseLevel === 'REDUCED'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                <span className="text-[10px] uppercase block text-amber-400 font-medium">Reduced</span>
                <span className="text-xs font-bold font-mono">{Math.max(20, Math.round(standardMinutes * 0.65))}m</span>
              </button>

              <button
                type="button"
                onClick={() => setDoseLevel('MVS')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  doseLevel === 'MVS'
                    ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm'
                    : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white'
                }`}
              >
                <span className="text-[10px] uppercase block text-sky-400 font-medium">Mini (MVS)</span>
                <span className="text-xs font-bold font-mono">{Math.max(15, Math.round(standardMinutes * 0.4))}m</span>
              </button>
            </div>

            {/* Verification Note */}
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-neutral-500" />
                <span>Notes or Proof (Optional)</span>
              </label>
              <input
                type="text"
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="e.g., Finished module 3, felt good"
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
              />
            </div>

            {/* Complete Button */}
            <button
              type="button"
              onClick={handleRecordCompleted}
              disabled={isUpdating}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Mark Session Completed</span>
            </button>
          </div>
        )}

        {/* Reschedule Section */}
        <form onSubmit={handleSaveTime} className="space-y-3.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#07CB6C]" />
              <span>Reschedule Session</span>
            </span>
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              {getTimeIcon(session.task_template?.preferred_time_of_day)}
              <span className="capitalize">{session.task_template?.preferred_time_of_day || 'Flexible'} slot</span>
            </div>
          </div>

          {/* Quick Reschedule Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-neutral-400">Quick moves:</span>
            <button
              type="button"
              onClick={handleMoveToTomorrow}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              Move to Tomorrow
            </button>
            <button
              type="button"
              onClick={handleMoveToSunday}
              className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              Move to Sunday Buffer
            </button>
          </div>

          {/* Date & Time Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Date</label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-[#07CB6C] transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
            <button
              id="btn-modal-skip-session"
              type="button"
              onClick={handleSkip}
              disabled={isUpdating || isDone}
              className={`px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                confirmingSkip
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                  : 'bg-white/5 hover:bg-rose-950/20 text-neutral-400 hover:text-rose-400 border border-white/10'
              }`}
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>{confirmingSkip ? 'Confirm Skip (No Debt)?' : 'Mark as Missed'}</span>
            </button>

            <button
              id="btn-modal-save-time"
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/10 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save New Time</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionDetailModal;
