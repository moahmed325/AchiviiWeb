import React from 'react';
import { GoalCatalog } from '../types';
import { X, Clock, Calendar, CheckCircle2, Sun, Sunset, Moon, ArrowRight } from 'lucide-react';

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
        return <Sun className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'afternoon':
        return <Sunset className="w-3.5 h-3.5 text-[#f59e0b]" />;
      case 'evening':
        return <Moon className="w-3.5 h-3.5 text-[#a6b8ad]" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-[#7e8f85]" />;
    }
  };

  const totalPhases = goal.phases?.length || 3;
  const totalWeeks = goal.phases?.reduce((sum, p) => sum + p.duration_weeks, 0) || 12;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden overscroll-none">
      {/* Solid Dim Backdrop - NO glassmorphism */}
      <div
        className="fixed inset-0 bg-black/80 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-xl bg-[#0c1210] border-l border-[#182621] shadow-none flex flex-col justify-between">
          {/* Drawer Header */}
          <div className="p-5 sm:p-6 border-b border-[#182621] flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                  BLUEPRINT SPECIFICATION // {goal.category.toUpperCase()}
                </span>
                <span className="px-1.5 py-0.2 rounded-sm bg-[#16221e] border border-[#1f332c] text-[9px] font-mono text-[#a6b8ad]">
                  90-DAY CADENCE
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#e5ebe7] truncate">
                {goal.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-sm text-[#7e8f85] hover:text-[#e5ebe7] hover:bg-[#182621] transition-colors cursor-pointer shrink-0"
              title="Close specification sheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain space-y-6 flex-1">
            {/* Goal Overview */}
            <div className="space-y-2 p-4 rounded-sm bg-[#080d0b] border border-[#182621]">
              <span className="text-[10px] font-mono font-bold uppercase text-[#7e8f85] tracking-wider block">
                MISSION OBJECTIVE & SCOPE
              </span>
              <p className="text-xs sm:text-sm text-[#a6b8ad] leading-relaxed font-mono">
                {goal.description}
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="p-3.5 rounded-sm bg-[#080d0b] border border-[#182621] flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-[#111a17] text-[#07CB6C] flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#55675c] uppercase">WEEKLY LOAD</div>
                  <div className="text-xs sm:text-sm font-bold text-[#e5ebe7] mt-0.5">{goal.est_weekly_hours} HOURS / WK</div>
                </div>
              </div>

              <div className="p-3.5 rounded-sm bg-[#080d0b] border border-[#182621] flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm bg-[#111a17] text-[#07CB6C] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#55675c] uppercase">TOTAL TIMELINE</div>
                  <div className="text-xs sm:text-sm font-bold text-[#e5ebe7] mt-0.5">{totalWeeks} WEEKS (3 MO)</div>
                </div>
              </div>
            </div>

            {/* Structured Phases Roadmap */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#182621] pb-2">
                <span className="text-[10px] font-mono font-bold uppercase text-[#7e8f85] tracking-wider">
                  PHASE EXECUTION ARCHITECTURE ({totalPhases} PHASES)
                </span>
                <span className="text-[10px] font-mono text-[#07CB6C]">
                  DETERMINISTIC BLUEPRINT
                </span>
              </div>

              <div className="space-y-4">
                {goal.phases?.map((phase, idx) => (
                  <div
                    key={phase.id}
                    className="p-4 rounded-sm bg-[#080d0b] border border-[#182621] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-sm bg-[#16221e] border border-[#1f332c] text-[#07CB6C] text-[10px] font-mono font-bold flex items-center justify-center">
                          0{idx + 1}
                        </span>
                        <h5 className="text-xs sm:text-sm font-bold text-[#e5ebe7]">{phase.title}</h5>
                      </div>
                      <span className="text-[10px] font-mono text-[#7e8f85]">
                        {phase.duration_weeks} WEEKS
                      </span>
                    </div>

                    {/* Task Templates under this Phase */}
                    <div className="space-y-2 pt-1">
                      {phase.task_templates?.map((task) => (
                        <div
                          key={task.id}
                          className="p-2.5 rounded-sm bg-[#0c1210] border border-[#182621] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#07CB6C] shrink-0" />
                            <span className="text-[#a6b8ad] truncate">{task.title}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <span className="px-2 py-0.5 rounded-sm bg-[#080d0b] border border-[#182621] text-[#7e8f85] text-[10px]">
                              {task.sessions_per_week}x / WK
                            </span>
                            <span className="px-2 py-0.5 rounded-sm bg-[#080d0b] border border-[#182621] text-[#7e8f85] text-[10px]">
                              {task.session_duration_minutes}M
                            </span>
                            {task.preferred_time_of_day && (
                              <div
                                title={`Preferred time: ${task.preferred_time_of_day}`}
                                className="p-1 rounded-sm bg-[#080d0b] border border-[#182621]"
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
          </div>

          {/* Drawer Sticky Footer with CTA */}
          <div className="p-4 sm:p-5 border-t border-[#182621] bg-[#0c1210] flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] text-xs font-mono border border-[#182621] transition-colors cursor-pointer"
            >
              CLOSE SPEC
            </button>

            <button
              onClick={() => onSelect(goal)}
              className="min-h-[44px] px-6 py-2 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>INITIALIZE BLUEPRINT</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
