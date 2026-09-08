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
  const [error, setError] = useState<string | null>(null);

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-[#a6b8ad]" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[#7e8f85]" />;
    }
  };

  const handleToggleDone = async () => {
    if (!token) return;
    setIsUpdating(true);
    setError(null);
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
    const confirm = window.confirm('Skip this session? It will be marked as missed and scheduled for recovery.');
    if (!confirm) return;

    setIsUpdating(true);
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
    try {
      const res = await triggerReschedule(token, session.id);
      if (res.result.actions.length > 0) {
        const action = res.result.actions[0];
        alert(`Session reallocated to ${action.newDate} (${action.newTime})!`);
      } else {
        alert('Rescheduling evaluated: Session schedule confirmed.');
      }
      onClose();
      window.location.reload();
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
    try {
      const res = await updateSession(token, session.id, {
        scheduled_date: new Date(dateStr).toISOString(),
        start_time: startTime,
        end_time: endTime,
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-none">
      {/* Solid Dim Backdrop - NO glassmorphism */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-[#0c1210] rounded-md p-5 sm:p-6 border border-[#182621] shadow-none z-10 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#182621] pb-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7e8f85]">
                SESSION TELEMETRY // {session.task_template?.phase?.title?.split(':')[0] || 'PHASE 1'}
              </span>

              {/* Explicit Tier Tag */}
              {sessionTier === 'core' && (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 border border-[#07CB6C]/40 text-[#07CB6C] text-[9px] font-mono font-bold tracking-wider">
                  [CORE]
                </span>
              )}
              {sessionTier === 'buffer' && (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#182621] border border-dashed border-[#182621] text-[#7e8f85] text-[9px] font-mono font-bold tracking-wider">
                  [BUFFER]
                </span>
              )}
              {sessionTier === 'reflect' && (
                <span className="px-1.5 py-0.5 rounded-sm bg-[#16221e] border border-[#1f332c] text-[#a6b8ad] text-[9px] font-mono font-bold tracking-wider">
                  [REFLECT]
                </span>
              )}

              <span
                className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase border ${
                  isDone
                    ? 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                    : isMissed
                    ? 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30'
                    : isRescheduled
                    ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
                    : 'bg-[#182621] text-[#a6b8ad] border-[#182621]'
                }`}
              >
                STATUS: {session.status}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-[#e5ebe7] truncate">
              {session.task_template?.title || 'Goal Session'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#182621] transition-colors cursor-pointer shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-sm bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Completion Toggle Button */}
        <div className="p-4 rounded-sm bg-[#080d0b] border border-[#182621] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-mono font-bold text-[#e5ebe7]">
              {isDone ? 'SESSION STATUS: COMPLETED' : 'SESSION STATUS: PENDING EXECUTION'}
            </div>
            <div className="text-[11px] font-mono text-[#7e8f85] mt-0.5">
              {isDone ? 'Marked complete. Click button to revert to upcoming.' : 'Click to register session completion.'}
            </div>
          </div>

          <button
            id="btn-modal-toggle-done"
            onClick={handleToggleDone}
            disabled={isUpdating}
            className={`min-h-[44px] px-4 py-2 rounded-sm text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 ${
              isDone
                ? 'bg-[#182621] hover:bg-[#20332c] text-[#07CB6C] border border-[#07CB6C]/40'
                : 'bg-[#07CB6C] hover:bg-[#06b560] text-[#050807]'
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
        <form onSubmit={handleSaveTime} className="space-y-4 pt-2 border-t border-[#182621]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#7e8f85]">
              MANUAL SCHEDULE OVERRIDE
            </span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-[#7e8f85]">
              {getTimeIcon(session.task_template?.preferred_time_of_day)}
              <span className="capitalize">{session.task_template?.preferred_time_of_day || 'Flexible'} preference</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-medium text-[#7e8f85] mb-1">DATE</label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-sm bg-[#080d0b] border border-[#182621] text-[#e5ebe7] text-base sm:text-xs font-mono focus:outline-none focus:border-[#07CB6C]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-medium text-[#7e8f85] mb-1">START TIME</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-sm bg-[#080d0b] border border-[#182621] text-[#e5ebe7] text-base sm:text-xs font-mono focus:outline-none focus:border-[#07CB6C]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-medium text-[#7e8f85] mb-1">END TIME</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-sm bg-[#080d0b] border border-[#182621] text-[#e5ebe7] text-base sm:text-xs font-mono focus:outline-none focus:border-[#07CB6C]"
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
                className="min-h-[44px] flex-1 sm:flex-none px-3.5 py-2 rounded-sm bg-[#080d0b] hover:bg-[#161214] text-[#7e8f85] hover:text-[#ef4444] border border-[#182621] hover:border-[#ef4444]/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>SKIP SESSION</span>
              </button>

              <button
                id="btn-modal-auto-reschedule"
                type="button"
                onClick={handleAutoReschedule}
                disabled={isUpdating || isDone}
                className="min-h-[44px] flex-1 sm:flex-none px-3.5 py-2 rounded-sm bg-[#080d0b] hover:bg-[#16140d] text-[#f59e0b] border border-[#182621] hover:border-[#f59e0b]/40 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>REALLOCATE</span>
              </button>
            </div>

            <button
              id="btn-modal-save-time"
              type="submit"
              disabled={isUpdating}
              className="min-h-[44px] px-4 py-2 rounded-sm bg-[#16221e] hover:bg-[#20332c] text-[#e5ebe7] text-xs font-mono font-medium border border-[#1f332c] transition-colors cursor-pointer disabled:opacity-50"
            >
              SAVE CHANGES
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
