import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { fetchGoalProgress } from '../lib/api';
import { GoalProgressResponse } from '../types';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  Zap, 
  Loader2,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export const ProgressPage: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<GoalProgressResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGoalProgress(token);
      setData(res);
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar apiStatus="online" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400">Aggregating 3-month goal metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Navbar apiStatus="online" />
        <div className="flex-1 max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Could not load progress</h2>
          <p className="text-sm text-slate-400">{error || 'No active goal found. Complete onboarding first.'}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/onboarding"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Start Onboarding
            </Link>
            <Link
              to="/"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
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
      year: 'numeric',
    });
  };

  const getPaceBadge = () => {
    switch (goal.paceStatus) {
      case 'GUARDRAIL_ALERT':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Guardrail Alert (2+ Weeks Behind)</span>
          </div>
        );
      case 'BEHIND_PACE':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Timeline Extended (+{goal.slippageDays}d slippage)</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>100% On Schedule (0d slippage)</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-[500px] h-[300px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 space-y-8">
        {/* Header with Breadcrumb & Pace Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">{goal.icon || '🎯'}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                {goal.category}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Week {metrics.currentWeek} of {metrics.totalWeeks}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
              <span>{goal.title}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl leading-relaxed">
              {goal.description}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {getPaceBadge()}
            <Link
              to="/schedule"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
            >
              <span>View This Week</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Executive KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Overall Completion */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Completion</span>
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-white">{metrics.completionPercentage}%</div>
              <div className="text-xs text-slate-400 mt-0.5">
                <strong className="text-white">{metrics.completedSessions}</strong> of {metrics.totalSessions} sessions finished
              </div>
            </div>
            {/* Visual Bar */}
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, metrics.completionPercentage)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Time Commitment */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hours Invested</span>
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-white">{metrics.completedHours} hrs</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Target: <strong className="text-white">{metrics.totalHours} hrs</strong> over 12 weeks
              </div>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(4, (metrics.completedHours / (metrics.totalHours || 1)) * 100))}%` }}
              />
            </div>
          </div>

          {/* Card 3: Timeline & Days Left */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Timeline Pacing</span>
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-white">{goal.daysRemaining} days</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Projected finish: <strong className="text-white">{formatDate(goal.projectedTargetDate)}</strong>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Day {goal.daysElapsed} of 84+ total plan days
            </div>
          </div>

          {/* Card 4: Current Active Phase */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Phase</span>
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-base font-black text-white truncate">
                {metrics.currentPhase?.title || 'Phase 1: Foundation'}
              </div>
              <div className="text-xs text-amber-300/80 mt-0.5">
                {metrics.currentPhase?.completionPercentage || 0}% Phase Progress
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Weeks {(metrics.currentPhase?.phase_order || 1) * 4 - 3}–{(metrics.currentPhase?.phase_order || 1) * 4} focus
            </div>
          </div>
        </div>

        {/* Timeline Comparison Card: Original vs Projected Finish */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Timeline Drift & Finish Projection</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                How adaptive rescheduling adjusts your finish target instead of letting you fail.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Start: <span className="text-white font-medium">{formatDate(goal.startDate)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Original Target */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Original Target Date</span>
              <div className="text-xl font-bold text-slate-200 font-mono">
                {formatDate(goal.originalTargetDate)}
              </div>
              <p className="text-xs text-slate-400">
                Calculated as exactly 12 standard calendar weeks (84 days) from kick-off.
              </p>
            </div>

            {/* Projected Finish */}
            <div className={`p-4 rounded-xl border space-y-1.5 ${
              goal.slippageDays > 0 
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-100'
                : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider">Projected Finish Date</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  goal.slippageDays > 0
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {goal.slippageDays === 0 ? 'On Target' : `+${goal.slippageDays} Days Slippage`}
                </span>
              </div>
              <div className="text-xl font-bold font-mono">
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
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>3-Phase Execution Roadmap</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                12-week structured progression scoped into 3 distinct building phases.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {phaseBreakdown.map((phase) => {
              const isCompleted = phase.status === 'COMPLETED';
              const isInProgress = phase.status === 'IN_PROGRESS';

              return (
                <div
                  key={phase.id}
                  className={`glass-panel p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all hover:scale-[1.01] ${
                    isCompleted
                      ? 'border-emerald-500/40 bg-emerald-950/10'
                      : isInProgress
                      ? 'border-indigo-500/50 bg-indigo-950/15 ring-1 ring-indigo-500/20 shadow-lg shadow-indigo-600/5'
                      : 'border-slate-800/80 bg-slate-900/40'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Phase {phase.phase_order} ({phase.duration_weeks} Weeks)
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isInProgress
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {phase.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white leading-snug">
                      {phase.title}
                    </h3>

                    {/* Phase Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Progress</span>
                        <span className="font-mono font-bold text-white">{phase.completionPercentage}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isCompleted
                              ? 'bg-emerald-500'
                              : isInProgress
                              ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                              : 'bg-slate-700'
                          }`}
                          style={{ width: `${Math.max(3, phase.completionPercentage)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-400 text-right">
                        {phase.completedSessions} / {phase.totalSessions} sessions completed
                      </div>
                    </div>

                    {/* Task Templates list */}
                    <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Task Blueprints
                      </span>
                      <div className="space-y-1">
                        {phase.taskTemplates.map((template) => (
                          <div
                            key={template.id}
                            className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs flex items-center justify-between gap-2"
                          >
                            <span className="text-slate-300 font-medium truncate max-w-[170px]">
                              {template.title}
                            </span>
                            <span className="text-slate-400 text-[10px] font-mono shrink-0">
                              {template.sessions_per_week}x / wk ({template.session_duration_minutes}m)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Link
                    to={`/schedule`}
                    className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold text-center transition-colors block cursor-pointer"
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
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 lg:col-span-1">
            <h3 className="text-base font-bold text-white">Session Status Distribution</h3>
            <div className="space-y-3">
              <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden flex border border-slate-800">
                <div
                  title={`Done: ${metrics.completedSessions}`}
                  className="h-full bg-emerald-500"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.completedSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
                <div
                  title={`Rescheduled: ${metrics.rescheduledSessions}`}
                  className="h-full bg-amber-500"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.rescheduledSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
                <div
                  title={`Missed: ${metrics.missedSessions}`}
                  className="h-full bg-rose-500"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.missedSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
                <div
                  title={`Upcoming: ${metrics.upcomingSessions}`}
                  className="h-full bg-indigo-500/60"
                  style={{ width: `${metrics.totalSessions > 0 ? (metrics.upcomingSessions / metrics.totalSessions) * 100 : 0}%` }}
                />
              </div>

              {/* Legend List */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Completed Sessions
                  </span>
                  <span className="font-mono font-bold text-white">{metrics.completedSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    Rescheduled (Recovered)
                  </span>
                  <span className="font-mono font-bold text-white">{metrics.rescheduledSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    Missed / Skipped
                  </span>
                  <span className="font-mono font-bold text-white">{metrics.missedSessions}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/60" />
                    Upcoming Scheduled
                  </span>
                  <span className="font-mono font-bold text-white">{metrics.upcomingSessions}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity List */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Recent Execution History</h3>
              <span className="text-xs text-slate-400">Past & Rescheduled Sessions</span>
            </div>

            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs rounded-xl border border-dashed border-slate-800">
                No past sessions recorded yet. Start checking off sessions from your weekly calendar!
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((item) => {
                  const isDone = item.status === 'DONE';
                  const isRescheduled = item.status === 'RESCHEDULED';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${
                          isDone
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isRescheduled
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
                          <div className="font-bold text-white">{item.taskTitle}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {formatDate(item.scheduledDate)} · {item.startTime}–{item.endTime}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isRescheduled
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
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
