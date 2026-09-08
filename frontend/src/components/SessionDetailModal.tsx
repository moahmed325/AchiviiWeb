import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateSession, triggerReschedule } from '../lib/api';
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
  Sparkles,
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
  const { token } = useAuth();
  if (!session) return null;

  const [dateStr, setDateStr] = useState<string>(() => session.scheduled_date.split('T')[0]);
  const [startTime, setStartTime] = useState<string>(session.start_time);
  const [endTime, setEndTime] = useState<string>(session.end_time);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const getTimeIcon = (pref?: string | null) => {
    switch (pref?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'afternoon':
        return <Sunset className="w-4 h-4 text-orange-400" />;
      case 'evening':
        return <Moon className="w-4 h-4 text-indigo-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
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
      // Trigger update
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                {session.task_template?.phase?.title?.split(':')[0] || 'Goal Session'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                  isDone
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : isMissed
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : session.status === 'RESCHEDULED'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                }`}
              >
                {session.status}
              </span>
            </div>
            <h3 className="text-xl font-bold text-white">
              {session.task_template?.title || 'Goal Session'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Completion Toggle Button */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-white">
              {isDone ? 'Session Completed!' : 'Mark this session complete'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {isDone ? 'Great job staying on track! Click to unmark.' : 'Record your execution and progress.'}
            </div>
          </div>

          <button
            id="btn-modal-toggle-done"
            onClick={handleToggleDone}
            disabled={isUpdating}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              isDone
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            {isUpdating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isDone ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Done ✓</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Mark Done</span>
              </>
            )}
          </button>
        </div>

        {/* Edit Time Form */}
        <form onSubmit={handleSaveTime} className="space-y-4 pt-1 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Adjust Scheduled Time
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              {getTimeIcon(session.task_template?.preferred_time_of_day)}
              <span className="capitalize">{session.task_template?.preferred_time_of_day || 'Flexible'} preference</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Date</label>
              <input
                type="date"
                required
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">End Time</label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <button
                id="btn-modal-skip-session"
                type="button"
                onClick={handleSkip}
                disabled={isUpdating || isDone}
                className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Skip</span>
              </button>

              <button
                id="btn-modal-auto-reschedule"
                type="button"
                onClick={handleAutoReschedule}
                disabled={isUpdating || isDone}
                className="py-2 px-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/40 hover:border-amber-500/70 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-Reschedule</span>
              </button>
            </div>

            <button
              id="btn-modal-save-time"
              type="submit"
              disabled={isUpdating}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              Save Custom Time
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
