import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchLifeStructure, updateLifeStructure, RoutineBlock } from '../lib/lifeApi';
import {
  X,
  Sun,
  Moon,
  Plus,
  Trash2,
  Briefcase,
  Dumbbell,
  Users,
  Car,
  BookOpen,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface RoutineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface RoutineItem {
  id: string;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  days: string[];
  enabled: boolean;
  isCustom?: boolean;
}

const DAYS_OF_WEEK = [
  { id: 'MON', label: 'M' },
  { id: 'TUE', label: 'T' },
  { id: 'WED', label: 'W' },
  { id: 'THU', label: 'T' },
  { id: 'FRI', label: 'F' },
  { id: 'SAT', label: 'S' },
  { id: 'SUN', label: 'S' },
];

const formatRoutineSummary = (days: string[], startTime: string, endTime: string): string => {
  const timeStr = `${startTime}–${endTime}`;
  if (!days || days.length === 0) return `No days set • ${timeStr}`;
  if (days.length === 7) return `Every day • ${timeStr}`;

  const isWeekdays = days.length === 5 && ['MON', 'TUE', 'WED', 'THU', 'FRI'].every((d) => days.includes(d));
  if (isWeekdays) return `Mon–Fri • ${timeStr}`;

  const isWeekends = days.length === 2 && ['SAT', 'SUN'].every((d) => days.includes(d));
  if (isWeekends) return `Weekends • ${timeStr}`;

  const dayLabels: Record<string, string> = {
    MON: 'Mon',
    TUE: 'Tue',
    WED: 'Wed',
    THU: 'Thu',
    FRI: 'Fri',
    SAT: 'Sat',
    SUN: 'Sun',
  };
  return `${days.map((d) => dayLabels[d] || d).join(', ')} • ${timeStr}`;
};

export const RoutineSettingsModal: React.FC<RoutineSettingsModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('23:00');
  const [routines, setRoutines] = useState<RoutineItem[]>([]);

  // Add custom routine state
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState<'WORK' | 'HEALTH' | 'FAMILY' | 'COMMUTE' | 'EDUCATION' | 'OTHER'>('WORK');
  const [customStartTime, setCustomStartTime] = useState('09:00');
  const [customEndTime, setCustomEndTime] = useState('10:00');
  const [customDays, setCustomDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);

  useEffect(() => {
    if (!isOpen || !token) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    fetchLifeStructure(token)
      .then((data) => {
        if (data.wake_time) setWakeTime(data.wake_time);
        if (data.sleep_time) setSleepTime(data.sleep_time);

        const loadedRoutines: RoutineItem[] = (data.routine_blocks || []).map((b: RoutineBlock) => {
          let daysArr: string[] = [];
          if (Array.isArray(b.days_of_week)) {
            daysArr = b.days_of_week;
          } else if (typeof b.days_of_week === 'string') {
            try {
              daysArr = JSON.parse(b.days_of_week);
            } catch {
              daysArr = b.days_of_week.split(',').map((s) => s.trim().toUpperCase());
            }
          }
          return {
            id: b.id,
            title: b.title,
            category: b.category,
            startTime: b.start_time,
            endTime: b.end_time,
            days: daysArr.length > 0 ? daysArr : ['MON', 'TUE', 'WED', 'THU', 'FRI'],
            enabled: true,
            isCustom: true,
          };
        });

        // If no routines exist yet, provide sensible starter defaults
        if (loadedRoutines.length === 0) {
          setRoutines([
            {
              id: 'work',
              title: 'Primary Work / Occupation',
              category: 'WORK',
              startTime: '09:00',
              endTime: '17:00',
              days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
              enabled: true,
            },
            {
              id: 'lunch',
              title: 'Lunch Break & Reset',
              category: 'HEALTH',
              startTime: '12:30',
              endTime: '13:30',
              days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
              enabled: true,
            },
            {
              id: 'dinner',
              title: 'Dinner & Family Time',
              category: 'FAMILY',
              startTime: '19:00',
              endTime: '20:30',
              days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
              enabled: true,
            },
          ]);
        } else {
          setRoutines(loadedRoutines);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load routine settings.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, token]);

  if (!isOpen) return null;

  const toggleRoutine = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const toggleRoutineDay = (routineId: string, dayId: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        const exists = r.days.includes(dayId);
        const nextDays = exists
          ? r.days.filter((d) => d !== dayId)
          : [...r.days, dayId];
        return { ...r, days: nextDays.length === 0 ? [dayId] : nextDays };
      })
    );
  };

  const updateRoutineTime = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removeRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleCustomDay = (dayId: string) => {
    setCustomDays((prev) =>
      prev.includes(dayId) ? (prev.length > 1 ? prev.filter((d) => d !== dayId) : prev) : [...prev, dayId]
    );
  };

  const handleAddCustomRoutine = () => {
    if (!customTitle.trim()) return;
    const newRoutine: RoutineItem = {
      id: `custom-${Date.now()}`,
      title: customTitle.trim(),
      category: customCategory,
      startTime: customStartTime,
      endTime: customEndTime,
      days: [...customDays],
      enabled: true,
      isCustom: true,
    };
    setRoutines((prev) => [...prev, newRoutine]);
    setCustomTitle('');
    setIsAddingCustom(false);
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const activeBlocks = routines
        .filter((r) => r.enabled)
        .map((r) => ({
          id: r.id.startsWith('custom-') || r.id.length < 10 ? undefined : r.id,
          title: r.title,
          category: r.category,
          start_time: r.startTime,
          end_time: r.endTime,
          days_of_week: r.days,
          is_hard_constraint: true,
        }));

      await updateLifeStructure(token, {
        wake_time: wakeTime,
        sleep_time: sleepTime,
        routine_blocks: activeBlocks,
      });

      setSuccess('Routine settings saved successfully.');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Failed to update routine settings.');
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'WORK':
        return <Briefcase className="w-3.5 h-3.5 text-blue-400" />;
      case 'HEALTH':
        return <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FAMILY':
        return <Users className="w-3.5 h-3.5 text-amber-400" />;
      case 'COMMUTE':
        return <Car className="w-3.5 h-3.5 text-purple-400" />;
      case 'EDUCATION':
        return <BookOpen className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Calendar className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0a0f0d] rounded-2xl p-6 sm:p-7 border border-white/10 shadow-2xl flex flex-col space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Daily Routine & Commitments</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Achivii plans your sessions around these windows. Adjust them whenever your schedule shifts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-[#07CB6C]/10 border border-[#07CB6C]/30 text-xs text-[#07CB6C] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
            <span className="text-xs text-neutral-400 font-mono">Loading routine settings...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin">
            {/* Waking & Sleep Boundaries */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="text-xs font-semibold text-white">Daily Boundaries</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Wake Time</span>
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-[#07CB6C] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Sleep Time</span>
                  </label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-[#07CB6C] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Commitments List */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Fixed Commitments</div>
                  <div className="text-[11px] text-neutral-400">Times blocked off for work, gym, or family</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom((prev) => !prev)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#07CB6C] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Block</span>
                </button>
              </div>

              {/* Inline Custom Creator */}
              {isAddingCustom && (
                <div className="p-3.5 rounded-xl bg-[#0e1613] border border-[#07CB6C]/40 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">New Commitment</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustom(false)}
                      className="text-neutral-500 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Title (e.g., Gym, Classes)"
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                    />
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg bg-[#0e1613] border border-white/10 text-xs text-white focus:outline-none focus:border-[#07CB6C]"
                    >
                      <option value="WORK">Work</option>
                      <option value="HEALTH">Health & Fitness</option>
                      <option value="FAMILY">Family & Home</option>
                      <option value="COMMUTE">Commute</option>
                      <option value="EDUCATION">Education / Study</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-300">
                      <input
                        type="time"
                        value={customStartTime}
                        onChange={(e) => setCustomStartTime(e.target.value)}
                        className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white outline-none"
                      />
                      <span className="text-neutral-500">to</span>
                      <input
                        type="time"
                        value={customEndTime}
                        onChange={(e) => setCustomEndTime(e.target.value)}
                        className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      {DAYS_OF_WEEK.map((d) => {
                        const isSelected = customDays.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleCustomDay(d.id)}
                            className={`w-6 h-6 rounded-md text-[10px] font-mono font-semibold transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#07CB6C] text-black'
                                : 'bg-white/5 text-neutral-500 hover:text-white'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddCustomRoutine}
                      disabled={!customTitle.trim()}
                      className="px-3 py-1 rounded-lg bg-[#07CB6C] text-black font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Add Block
                    </button>
                  </div>
                </div>
              )}

              {/* Routine Items List */}
              <div className="space-y-2">
                {routines.map((routine) =>
                  !routine.enabled ? (
                    <div
                      key={routine.id}
                      onClick={() => toggleRoutine(routine.id)}
                      className="px-3.5 py-2.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 select-none min-w-0">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => toggleRoutine(routine.id)}
                          className="w-4 h-4 accent-[#07CB6C] rounded cursor-pointer shrink-0 opacity-40 group-hover:opacity-70"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-neutral-500 group-hover:text-neutral-300">
                            {getCategoryIcon(routine.category)}
                          </span>
                          <span className="text-xs text-neutral-400 group-hover:text-neutral-200 truncate">
                            {routine.title}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500">
                        {formatRoutineSummary(routine.days, routine.startTime, routine.endTime)}
                      </span>
                    </div>
                  ) : (
                    <div
                      key={routine.id}
                      className="p-3.5 rounded-xl border border-[#07CB6C]/30 bg-white/[0.02] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 select-none">
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => toggleRoutine(routine.id)}
                          className="w-4 h-4 accent-[#07CB6C] rounded cursor-pointer mt-1"
                        />
                        <div className="space-y-1.5">
                          <div className="text-xs font-semibold text-white flex items-center gap-2">
                            {getCategoryIcon(routine.category)}
                            <span>{routine.title}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {DAYS_OF_WEEK.map((d) => {
                              const isSelected = routine.days.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toggleRoutineDay(routine.id, d.id);
                                  }}
                                  className={`w-6 h-6 rounded-md text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#07CB6C] text-black font-bold'
                                      : 'bg-white/5 text-neutral-500 hover:text-white hover:bg-white/10'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center ml-7 md:ml-0">
                        <div className="flex items-center gap-1 font-mono text-xs text-neutral-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                          <input
                            type="time"
                            value={routine.startTime}
                            onChange={(e) => updateRoutineTime(routine.id, 'startTime', e.target.value)}
                            className="bg-transparent text-white outline-none cursor-pointer"
                          />
                          <span className="text-neutral-500">–</span>
                          <input
                            type="time"
                            value={routine.endTime}
                            onChange={(e) => updateRoutineTime(routine.id, 'endTime', e.target.value)}
                            className="bg-transparent text-white outline-none cursor-pointer"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRoutine(routine.id)}
                          className="p-1 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove block"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Routine</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoutineSettingsModal;
