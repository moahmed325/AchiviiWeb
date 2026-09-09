import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateSession, triggerReschedule } from '../lib/api';
import { getLocalDateString } from '../lib/dateUtils';
import { Session } from '../types';
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
  Zap
} from 'lucide-react';

interface SessionDetailModalProps {
  session: Session | null;
  onClose: () => void;
  onSessionUpdated: (updated: Session) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  onClose,
  onSessionUpdated,
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

  const handleToggleDone = async () => {
    if (!token) return;
    setIsUpdating(true);
    setError(null);
    setNotice(null);
    try {
      const nextStatus = session.status === 'DONE' ? 'UPCOMING' : 'DONE';
      const res = await updateSession(token, session.id, { status: nextStatus });
      onSessionUpdated(res.session);
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

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
      const res = await updateSession(token, session.id, { status: 'MISSED' });
      onSessionUpdated(res.session);
    } catch (err: any) {
      setError(err.message || 'Failed to skip session');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAutoReschedule = async () => {
    if (!token) return;
    setIsUpdating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await triggerReschedule(token, session.id);
      if (res.result.actions.length > 0) {
        const action = res.result.actions[0];
        setNotice(`Session reallocated to ${action.newDate} (${action.newTime}). Schedule updated.`);
      } else {
        setNotice('Rescheduling evaluated: Current schedule confirmed optimal.');
      }
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to auto-reschedule session');
    } finally {
      setIsUpdating(false);
    }
  };

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
                  [CORE]
                </span>
              )}
              {sessionTier === 'buffer' && (
                <span className="px-1.5 py-0.5 rounded bg-[#131f1b] border border-[#1a2824] text-neutral-400 text-[10px] font-mono font-medium tracking-wider">
                  [BUFFER]
                </span>
              )}
              {sessionTier === 'reflect' && (
                <span className="px-1.5 py-0.5 rounded bg-[#131f1b] border border-[#1a2824] text-[#07CB6C] text-[10px] font-mono font-medium tracking-wider">
                  [REFLECT]
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
              {session.task_template?.title || 'Goal Session'}
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
          <div className="p-3 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-[#07CB6C] text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Completion Toggle Button */}
        <div className="p-4 rounded-xl bg-[#0d1412] border border-[#1a2824] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono font-medium text-white">
              {isDone ? 'SESSION STATUS: COMPLETED' : 'SESSION STATUS: PENDING EXECUTION'}
            </div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {isDone ? 'Marked complete. Click button to revert to upcoming.' : 'Click to register session completion.'}
            </div>
          </div>

          <button
            id="btn-modal-toggle-done"
            onClick={handleToggleDone}
            disabled={isUpdating}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 ${
              isDone
                ? 'bg-[#131f1b] hover:bg-[#1c2c26] text-[#07CB6C] border border-[#07CB6C]/40'
                : 'bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b]'
            }`}
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDone ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#07CB6C]" />
                <span>COMPLETED ✓</span>
              </>
            ) : (
              <>
                <span>MARK COMPLETE</span>
              </>
            )}
          </button>
        </div>

        {/* Edit Time Form */}
        <form onSubmit={handleSaveTime} className="space-y-4 pt-2 border-t border-[#1a2824]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-400">
              MANUAL SCHEDULE OVERRIDE
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
              {getTimeIcon(session.task_template?.preferred_time_of_day)}
              <span className="capitalize">{session.task_template?.preferred_time_of_day || 'Flexible'} preference</span>
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
            <div className="flex items-center gap-2">
              <button
                id="btn-modal-skip-session"
                type="button"
                onClick={handleSkip}
                disabled={isUpdating || isDone}
                className={`min-h-[44px] flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 ${
                  confirmingSkip
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
                    : 'bg-[#0d1412] hover:bg-[#181014] text-neutral-400 hover:text-rose-400 border border-[#1a2824] hover:border-rose-500/40'
                }`}
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>{confirmingSkip ? 'CONFIRM SKIP?' : 'SKIP SESSION'}</span>
              </button>

              <button
                id="btn-modal-auto-reschedule"
                type="button"
                onClick={handleAutoReschedule}
                disabled={isUpdating || isDone}
                className="min-h-[44px] flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-[#0d1412] hover:bg-[#18150e] text-amber-400 border border-[#1a2824] hover:border-amber-400/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>REALLOCATE</span>
              </button>
            </div>

            <button
              id="btn-modal-save-time"
              type="submit"
              disabled={isUpdating}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#131f1b] hover:bg-[#1c2c26] text-white text-xs font-mono font-medium border border-[#1a2824] hover:border-[#2a3e38] transition-colors cursor-pointer disabled:opacity-50"
            >
              SAVE CHANGES
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
