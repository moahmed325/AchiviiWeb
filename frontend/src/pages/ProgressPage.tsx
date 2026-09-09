import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { fetchGoalProgress, fetchAggregatedProfile } from '../lib/api';
import { GoalProgressResponse } from '../types';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Layers, 
  Zap, 
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Compass
} from 'lucide-react';

export const ProgressPage: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<GoalProgressResponse | null>(null);
  const [profileTelemetry, setProfileTelemetry] = useState<{
    bestWorkingHours: string;
    peakWindow: string;
    totalCompleted: number;
    avgDuration: number;
    frequentTrigger: string;
    recoveryChoice: string;
    recoveryEvents: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [res, profileRes] = await Promise.all([
        fetchGoalProgress(token),
        fetchAggregatedProfile(token).catch(() => null),
      ]);
      setData(res);
      if (profileRes && profileRes.best_working_hours) {
        setProfileTelemetry({
          bestWorkingHours: profileRes.best_working_hours.preferred_time_of_day?.toUpperCase() || 'MORNING',
          peakWindow: `${profileRes.best_working_hours.peak_hour_window?.start || '08:00'} - ${profileRes.best_working_hours.peak_hour_window?.end || '10:00'}`,
          totalCompleted: profileRes.best_working_hours.total_completed_sessions || 0,
          avgDuration: profileRes.best_working_hours.average_session_duration_minutes || 45,
          frequentTrigger: profileRes.lapse_pattern_summary?.frequent_trigger || 'NONE_LOGGED',
          recoveryChoice: profileRes.lapse_pattern_summary?.preferred_recovery_choice?.toUpperCase() || 'SHRINK_WEEK',
          recoveryEvents: profileRes.lapse_pattern_summary?.total_recovery_events || 0,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load progress data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
  }, [token]);

  if (loading) {
    return (
      <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7]">
        <Navbar apiStatus="online" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
          <p className="text-xs font-mono text-[#7e8f85]">Aggregating 3-month goal metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7]">
        <Navbar apiStatus="online" />
        <div className="flex-1 max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-10 h-10 rounded-sm bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-[#e5ebe7]">Could not load progress</h2>
          <p className="text-xs font-mono text-[#7e8f85]">{error || 'No active goal found. Complete onboarding first.'}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/onboarding"
              className="min-h-[44px] px-4 py-2 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold flex items-center"
            >
              Start Onboarding
            </Link>
            <Link
              to="/"
              className="min-h-[44px] px-4 py-2 rounded-sm bg-[#0c1210] hover:bg-[#111a17] text-[#e5ebe7] border border-[#182621] text-xs font-mono flex items-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { goal, metrics, phaseBreakdown, recentActivity } = data;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getPaceBadge = () => {
    switch (goal.paceStatus) {
      case 'GUARDRAIL_ALERT':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Guardrail Alert (2+ Weeks Behind)</span>
          </div>
        );
      case 'BEHIND_PACE':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Timeline Extended (+{goal.slippageDays}d slippage)</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span>100% On Schedule (0d slippage)</span>
          </div>
        );
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7] relative">
      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6 sm:space-y-8">
        {/* Header with Breadcrumb & Pace Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#182621]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">{goal.icon || '🎯'}</span>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#07CB6C] px-2 py-0.5 rounded-sm bg-[#07CB6C]/10 border border-[#07CB6C]/20">
                {goal.category}
              </span>
              <span className="text-xs text-[#7e8f85] font-mono">
                Week {metrics.currentWeek} of {metrics.totalWeeks}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <span>{goal.title}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#7e8f85] max-w-3xl leading-relaxed">
              {goal.description}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {getPaceBadge()}
            <Link
              to="/schedule"
              className="min-h-[44px] px-4 py-2 rounded-sm bg-[#07CB6C] hover:bg-[#06b560] text-[#050807] text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-[0.99]"
            >
              <span>View Active Week</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Continuous Profile Learning Telemetry Section */}
        <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-3 shadow-none">
          <div className="flex items-center justify-between border-b border-[#182621] pb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#a6b8ad] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />
              CONTINUOUS PROFILE LEARNING // AGGREGATED TELEMETRY
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 font-semibold uppercase">
              ACTIVE AGGREGATION
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-sm bg-[#080d0b] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase tracking-wider block">Peak Focus Window</span>
              <span className="text-sm font-bold text-[#e5ebe7] block mt-1">
                {profileTelemetry?.peakWindow || '08:00 - 10:00'}
              </span>
              <span className="text-[10px] text-[#07CB6C] block mt-0.5">
                {profileTelemetry?.bestWorkingHours || 'MORNING'} CADENCE
              </span>
            </div>

            <div className="p-3 rounded-sm bg-[#080d0b] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase tracking-wider block">Cumulative Volume</span>
              <span className="text-sm font-bold text-[#e5ebe7] block mt-1">
                {profileTelemetry?.totalCompleted || metrics.completedSessions} Sessions
              </span>
              <span className="text-[10px] text-[#7e8f85] block mt-0.5">
                Avg {profileTelemetry?.avgDuration || 45}m / session
              </span>
            </div>

            <div className="p-3 rounded-sm bg-[#080d0b] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase tracking-wider block">Lapse Risk Diagnostic</span>
              <span className="text-sm font-bold text-amber-400 block mt-1 truncate">
                {profileTelemetry?.frequentTrigger || 'NONE'}
              </span>
              <span className="text-[10px] text-[#7e8f85] block mt-0.5">
                {profileTelemetry?.recoveryEvents || 0} Recovery Events Logged
              </span>
            </div>

            <div className="p-3 rounded-sm bg-[#080d0b] border border-[#182621]">
              <span className="text-[9px] text-[#7e8f85] uppercase tracking-wider block">Preferred Remediation</span>
              <span className="text-sm font-bold text-[#07CB6C] block mt-1 truncate">
                {profileTelemetry?.recoveryChoice || 'SHRINK_WEEK'}
              </span>
              <span className="text-[10px] text-[#7e8f85] block mt-0.5">
                Buffer-tier priority drop
              </span>
            </div>
          </div>
        </div>

        {/* Executive KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Overall Completion */}
          <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-3 relative overflow-hidden shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7e8f85]">Total Completion</span>
              <span className="p-1.5 rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-white font-mono">{metrics.completionPercentage}%</div>
              <div className="text-xs font-mono text-[#7e8f85] mt-0.5">
                <strong className="text-white">{metrics.completedSessions}</strong> of {metrics.totalSessions} sessions finished
              </div>
            </div>
            {/* Visual Bar */}
            <div className="w-full h-1.5 rounded-sm bg-[#111a17] overflow-hidden border border-[#182621]">
              <div
                className="h-full bg-[#07CB6C] transition-all duration-500"
                style={{ width: `${Math.max(4, metrics.completionPercentage)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Time Commitment */}
          <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-3 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7e8f85]">Hours Invested</span>
              <span className="p-1.5 rounded-sm bg-[#080d0b] text-[#07CB6C] border border-[#182621]">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-white font-mono">{metrics.completedHours} hrs</div>
              <div className="text-xs font-mono text-[#7e8f85] mt-0.5">
                Target: <strong className="text-white">{metrics.totalHours} hrs</strong> over 12 weeks
              </div>
            </div>
            <div className="w-full h-1.5 rounded-sm bg-[#111a17] overflow-hidden border border-[#182621]">
              <div
                className="h-full bg-[#07CB6C] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, (metrics.completedHours / (metrics.totalHours || 1)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Timeline & Days Left */}
          <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-3 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7e8f85]">Timeline Pacing</span>
              <span className="p-1.5 rounded-sm bg-[#080d0b] text-[#07CB6C] border border-[#182621]">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-white font-mono">{goal.daysRemaining} days</div>
              <div className="text-xs font-mono text-[#7e8f85] mt-0.5">
                Projected finish: <strong className="text-white">{formatDate(goal.projectedTargetDate)}</strong>
              </div>
            </div>
            <div className="text-[11px] text-[#7e8f85] font-mono">
              Day {goal.daysElapsed} of 84+ total plan days
            </div>
          </div>

          {/* Card 4: Current Active Phase */}
          <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-3 shadow-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#7e8f85]">Current Phase</span>
              <span className="p-1.5 rounded-sm bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-base font-bold text-white truncate font-mono">
                {metrics.currentPhase?.title || 'Phase 1: Foundation'}
              </div>
              <div className="text-xs font-mono text-amber-400 mt-0.5">
                {metrics.currentPhase?.completionPercentage || 0}% Phase Progress
              </div>
            </div>
            <div className="text-[11px] font-mono text-[#7e8f85]">
              Weeks {(metrics.currentPhase?.phase_order || 1) * 4 - 3}–{(metrics.currentPhase?.phase_order || 1) * 4} focus
            </div>
          </div>
        </div>

        {/* Timeline Comparison Card: Original vs Projected Finish */}
        <div className="bg-[#0c1210] p-5 sm:p-6 rounded-md border border-[#182621] space-y-4 shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white">
                Timeline Drift & Finish Projection
              </h3>
              <p className="text-xs text-[#7e8f85] font-mono mt-0.5">
                Adaptive reallocation calibrates the target completion date without session loss.
              </p>
            </div>
            <div className="text-xs font-mono text-[#7e8f85]">
              Start: <span className="text-white font-medium">{formatDate(goal.startDate)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Original Target */}
            <div className="p-3.5 rounded-sm bg-[#080d0b] border border-[#182621] space-y-1.5 font-mono">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7e8f85]">Original Target Date</span>
              <div className="text-xl font-bold text-[#e5ebe7]">
                {formatDate(goal.originalTargetDate)}
              </div>
              <p className="text-xs text-[#7e8f85]">
                Calculated as exactly 12 standard calendar weeks (84 days) from kick-off.
              </p>
            </div>

            {/* Projected Finish */}
            <div className={`p-3.5 rounded-sm border space-y-1.5 font-mono ${
              goal.slippageDays > 0 
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-100'
                : 'bg-[#0a1711] border-[#07CB6C]/30 text-emerald-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider">Projected Finish Date</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                  goal.slippageDays > 0
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-[#07CB6C]/20 text-[#07CB6C]'
                }`}>
                  {goal.slippageDays === 0 ? 'On Target' : `+${goal.slippageDays} Days Slippage`}
                </span>
              </div>
              <div className="text-xl font-bold">
                {formatDate(goal.projectedTargetDate)}
              </div>
              <p className="text-xs opacity-80">
                {goal.slippageDays === 0
                  ? 'All sessions are successfully fitting into designated operating and buffer windows.'
                  : 'Missed sessions extended the timeline to protect habit consistency.'}
              </p>
            </div>
          </div>
        </div>

        {/* 3-Phase Milestone Execution Roadmap */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#07CB6C]" />
                <span>3-Phase Execution Roadmap</span>
              </h2>
              <p className="text-xs text-[#7e8f85] font-mono mt-0.5">
                12-week structured progression scoped into 3 distinct building phases.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {phaseBreakdown.map((phase) => {
              const isCompleted = phase.status === 'COMPLETED';
              const isInProgress = phase.status === 'IN_PROGRESS';

              return (
                <div
                  key={phase.id}
                  className={`bg-[#0c1210] p-4 sm:p-5 rounded-md border flex flex-col justify-between space-y-4 shadow-none ${
                    isCompleted
                      ? 'border-[#07CB6C]/40 bg-[#0a1711]'
                      : isInProgress
                      ? 'border-[#07CB6C]/50'
                      : 'border-[#182621]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 font-mono">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7e8f85]">
                        Phase {phase.phase_order} ({phase.duration_weeks} Weeks)
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-[#07CB6C]/20 text-[#07CB6C] border border-[#07CB6C]/30'
                            : isInProgress
                            ? 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30'
                            : 'bg-[#182621] text-[#7e8f85] border border-[#1f332c]'
                        }`}
                      >
                        {phase.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white leading-snug">
                      {phase.title}
                    </h3>

                    {/* Phase Progress Bar */}
                    <div className="space-y-1.5 pt-1 font-mono">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#7e8f85]">Progress</span>
                        <span className="font-bold text-white">{phase.completionPercentage}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-sm bg-[#111a17] overflow-hidden border border-[#182621]">
                        <div
                          className={`h-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-[#07CB6C]'
                              : isInProgress
                              ? 'bg-[#07CB6C]'
                              : 'bg-slate-700'
                          }`}
                          style={{ width: `${Math.max(3, phase.completionPercentage)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-[#7e8f85] text-right">
                        {phase.completedSessions} / {phase.totalSessions} sessions completed
                      </div>
                    </div>

                    {/* Task Templates list */}
                    <div className="pt-2 border-t border-[#182621] space-y-1.5 font-mono">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7e8f85]">
                        Task Blueprints
                      </span>
                      <div className="space-y-1">
                        {phase.taskTemplates.map((template) => (
                          <div
                            key={template.id}
                            className="p-2 rounded-sm bg-[#080d0b] border border-[#182621] text-xs flex items-center justify-between gap-2"
                          >
                            <span className="text-[#e5ebe7] font-medium truncate max-w-[170px]">
                              {template.title}
                            </span>
                            <span className="text-[#7e8f85] text-[10px] shrink-0">
                              {template.sessions_per_week}x / wk ({template.session_duration_minutes}m)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/schedule`}
                    className="w-full min-h-[44px] py-2.5 rounded-sm bg-[#080d0b] hover:bg-[#111a17] text-[#a6b8ad] hover:text-[#e5ebe7] border border-[#182621] text-xs font-mono font-medium text-center transition-colors flex items-center justify-center cursor-pointer"
                  >
                    Inspect in Calendar →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Session Status Distribution & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Status Breakdown Proportion Bar */}
          <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-4 lg:col-span-1 shadow-none">
            <h3 className="text-sm font-bold text-white font-mono">Session Status Distribution</h3>
            <div className="space-y-3 font-mono">
              <div className="w-full h-2.5 rounded-sm bg-[#111a17] overflow-hidden flex border border-[#182621]">
                <div
                  title={`Done: ${metrics.completedSessions}`}
                  className="h-full bg-[#07CB6C]"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.completedSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
                <div
                  title={`Rescheduled: ${metrics.rescheduledSessions}`}
                  className="h-full bg-amber-400"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.rescheduledSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
                <div
                  title={`Missed: ${metrics.missedSessions}`}
                  className="h-full bg-[#ef4444]"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.missedSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
                <div
                  title={`Upcoming: ${metrics.upcomingSessions}`}
                  className="h-full bg-slate-700"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.upcomingSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
              </div>

              {/* Legend List */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#a6b8ad]">
                    <span className="w-2 h-2 rounded-full bg-[#07CB6C]" />
                    Completed Sessions
                  </span>
                  <span className="font-bold text-white">{metrics.completedSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#a6b8ad]">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Rescheduled (Recovered)
                  </span>
                  <span className="font-bold text-white">{metrics.rescheduledSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#a6b8ad]">
                    <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                    Missed / Skipped
                  </span>
                  <span className="font-bold text-white">{metrics.missedSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#a6b8ad]">
                    <span className="w-2 h-2 rounded-full bg-slate-700" />
                    Upcoming Scheduled
                  </span>
                  <span className="font-bold text-white">{metrics.upcomingSessions}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity List */}
          <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#182621] space-y-4 lg:col-span-2 shadow-none">
            <div className="flex items-center justify-between font-mono">
              <h3 className="text-sm font-bold text-white">Recent Execution History</h3>
              <span className="text-xs text-[#7e8f85]">Past & Rescheduled Sessions</span>
            </div>

            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-[#7e8f85] text-xs font-mono rounded-sm border border-dashed border-[#182621]">
                No past sessions recorded yet. Start checking off sessions from your weekly calendar.
              </div>
            ) : (
              <div className="space-y-2 font-mono">
                {recentActivity.map((item) => {
                  const isDone = item.status === 'DONE';
                  const isRescheduled = item.status === 'RESCHEDULED';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-sm bg-[#080d0b] border border-[#182621] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-sm ${
                          isDone
                            ? 'bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20'
                            : isRescheduled
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20'
                        }`}>
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : isRescheduled ? (
                            <Zap className="w-4 h-4" />
                          ) : (
                            <AlertCircle className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-[#e5ebe7]">{item.taskTitle}</div>
                          <div className="text-[10px] text-[#7e8f85]">
                            {formatDate(item.scheduledDate)} · {item.startTime}–{item.endTime}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider ${
                        isDone
                          ? 'bg-[#07CB6C]/15 text-[#07CB6C] border border-[#07CB6C]/30'
                          : isRescheduled
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
