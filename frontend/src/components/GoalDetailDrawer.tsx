import React from 'react';
import { GoalCatalog } from '../types';
import { X, Clock, Calendar, CheckCircle2, Sun, Sunset, Moon, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

interface GoalDetailDrawerProps {
  goal: GoalCatalog | null;
  onClose: () => void;
  onSelect: (goal: GoalCatalog) => void;
}

export const GoalDetailDrawer: React.FC<GoalDetailDrawerProps> = ({ goal, onClose, onSelect }) => {
  if (!goal) return null;

  const getTimeIcon = (time?: string | null) => {
    switch (time?.toLowerCase()) {
      case 'morning':
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-orange-400" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl glass-panel bg-slate-950/95 border-l border-slate-800 shadow-2xl flex flex-col justify-between">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-800 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  {goal.category}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-medium">
                  3 Months / 12 Weeks
                </span>
              </div>
              <h2 className="text-2xl font-black text-white">{goal.title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Goal Overview */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Goal Mission</h4>
              <p className="text-slate-300 text-sm leading-relaxed">{goal.description}</p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Weekly Effort</div>
                  <div className="text-sm font-bold text-white">{goal.est_weekly_hours} Hours / Week</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Total Duration</div>
                  <div className="text-sm font-bold text-white">12 Weeks (3 Phases)</div>
                </div>
              </div>
            </div>

            {/* Structured Phases Roadmap */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  12-Week Phase Execution Plan
                </h4>
                <span className="text-[11px] text-indigo-400 font-medium">Pre-Scoped Blueprints</span>
              </div>

              <div className="space-y-4">
                {goal.phases?.map((phase, idx) => (
                  <div
                    key={phase.id}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h5 className="text-sm font-bold text-white">{phase.title}</h5>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {phase.duration_weeks} Weeks
                      </span>
                    </div>

                    {/* Task Templates under this Phase */}
                    <div className="space-y-2 pt-1">
                      {phase.task_templates?.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-slate-200 font-medium truncate">{task.title}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                              {task.sessions_per_week}x / wk
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                              {task.session_duration_minutes}m
                            </span>
                            {task.preferred_time_of_day && (
                              <div
                                title={`Preferred time: ${task.preferred_time_of_day}`}
                                className="p-1 rounded bg-slate-800/80"
                              >
                                {getTimeIcon(task.preferred_time_of_day)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adaptive Rescheduling Guarantee Notice */}
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white">Adaptive Execution Guarantee</p>
                <p className="text-slate-400 leading-relaxed">
                  Unlike traditional calendars, Achivii automatically detects missed sessions and reschedules them into your open slots or seamlessly recalculates your finish date.
                </p>
              </div>
            </div>
          </div>

          {/* Drawer Footer CTA */}
          <div className="p-6 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
            <button
              onClick={onClose}
              className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              id="btn-drawer-commit-goal"
              onClick={() => {
                onClose();
                onSelect(goal);
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Commit to this 3-Month Goal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
