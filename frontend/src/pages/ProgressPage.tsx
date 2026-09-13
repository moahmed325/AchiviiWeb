import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { fetchCurrentUserGoal, fetchAggregatedProfile } from '../lib/api';
import { fetchAdaptiveDashboard } from '../lib/adaptiveApi';
import { fetchCapacityAudit, CapacityAudit } from '../lib/lifeApi';
import type {
  AdaptiveDashboardResponse,
  GoalIntegrityStatus,
  CapabilityState,
} from '../types/adaptive';
import { UserGoal } from '../types';
import {
  AlertCircle,
  ArrowRight,
  Layers,
  Zap,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Sparkles,
  Target,
  Gauge,
} from 'lucide-react';

const INTEGRITY_CONFIG: Record<
  GoalIntegrityStatus,
  { label: string; badgeClass: string; textClass: string; icon: React.ReactNode }
> = {
  INTACT: {
    label: 'On Track',
    badgeClass: 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]',
    textClass: 'text-[#07CB6C]',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C]" />,
  },
  REVISED: {
    label: 'Adjusted Trajectory',
    badgeClass: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    textClass: 'text-sky-400',
    icon: <Sparkles className="w-3.5 h-3.5 text-sky-400" />,
  },
  AT_RISK: {
    label: 'Attention Needed',
    badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    textClass: 'text-amber-400',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  },
  COMPROMISED: {
    label: 'Needs Recalibration',
    badgeClass: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    textClass: 'text-rose-400',
    icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
  },
};

const STATE_CONFIG: Record<
  CapabilityState,
  { label: string; bgClass: string; textClass: string; borderClass: string; desc: string }
> = {
  ROBUST: {
    label: 'Mastered',
    bgClass: 'bg-emerald-950/20',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    desc: 'Unassisted real-world capability demonstrated under varied conditions.',
  },
  ESTABLISHED: {
    label: 'Mastered',
    bgClass: 'bg-teal-950/20',
    textClass: 'text-teal-400',
    borderClass: 'border-teal-500/30',
    desc: 'Verified capability consistency across consecutive benchmarks.',
  },
  EMERGING: {
    label: 'In Progress',
    bgClass: 'bg-amber-950/20',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    desc: 'Active training focus. Building consistency.',
  },
  UNTESTED: {
    label: 'Upcoming',
    bgClass: 'bg-white/[0.02]',
    textClass: 'text-neutral-400',
    borderClass: 'border-white/5',
    desc: 'Scheduled for upcoming milestone blocks.',
  },
  REGRESSED: {
    label: 'Needs Practice',
    bgClass: 'bg-rose-950/20',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    desc: 'Performance dip detected. Quick refresher scheduled.',
  },
};

export const ProgressPage: React.FC = () => {
  const { token } = useAuth();
  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveDashboardResponse | null>(null);
  const [capacityAudit, setCapacityAudit] = useState<CapacityAudit | null>(null);
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
      const [goalRes, profileRes, auditRes] = await Promise.all([
        fetchCurrentUserGoal(token),
        fetchAggregatedProfile(token).catch(() => null),
        fetchCapacityAudit(token).catch(() => null),
      ]);

      setActiveUserGoal(goalRes.user_goal);
      if (auditRes) {
        setCapacityAudit(auditRes);
      }

      if (goalRes.user_goal) {
        const adaptRes = await fetchAdaptiveDashboard(token, goalRes.user_goal.id);
        setAdaptiveData(adaptRes);
      }

      if (profileRes && profileRes.best_working_hours) {
        setProfileTelemetry({
          bestWorkingHours: profileRes.best_working_hours.preferred_time_of_day?.toUpperCase() || 'MORNING',
          peakWindow: `${profileRes.best_working_hours.peak_hour_window?.start || '08:00'} - ${
            profileRes.best_working_hours.peak_hour_window?.end || '10:00'
          }`,
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
      <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white min-h-screen">
        <Navbar apiStatus="online" />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#07CB6C]" />
          <p className="text-xs font-mono text-neutral-400">Loading Adaptive Execution Progress...</p>
        </div>
      </div>
    );
  }

  if (error || !adaptiveData || !activeUserGoal) {
    return (
      <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white min-h-screen">
        <Navbar apiStatus="online" />
        <div className="flex-1 max-w-xl mx-auto px-4 py-16 text-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-semibold text-white">Could not load progress</h2>
          <p className="text-xs font-mono text-neutral-400">{error || 'No active goal protocol found.'}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link
              to="/onboarding"
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-medium flex items-center"
            >
              Start Goal Formalization
            </Link>
            <Link
              to="/"
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0d1412] hover:bg-[#131f1b] text-white border border-[#1a2824] text-xs font-mono flex items-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const integrity = adaptiveData.goalIntegrityStatus || 'INTACT';
  const integrityCfg = INTEGRITY_CONFIG[integrity] || INTEGRITY_CONFIG.INTACT;

  const capabilities = adaptiveData.capabilities || [];
  const verifiedCount = capabilities.filter((c) => c.state === 'ROBUST' || c.state === 'ESTABLISHED').length;
  const emergingCount = capabilities.filter((c) => c.state === 'EMERGING').length;
  const untestedCount = capabilities.filter((c) => c.state === 'UNTESTED').length;
  const totalCapabilities = capabilities.length || 3;
  const capabilityProgressPct = Math.round((verifiedCount / totalCapabilities) * 100);

  const currentWeek = adaptiveData.currentWeek || 1;
  const totalWeeks = adaptiveData.totalWeeks || 12;

  return (
    <div className="w-full flex-1 flex flex-col bg-[#0c1210] text-white relative min-h-screen">
      <Navbar apiStatus="online" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 relative z-10 space-y-6 sm:space-y-8">
        {/* Header with Outcome Statement & Goal Integrity Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#07CB6C] px-2.5 py-0.5 rounded-full bg-[#07CB6C]/10 border border-[#07CB6C]/20">
                90-Day Journey
              </span>
              <span className="text-xs text-neutral-400 font-medium">
                Week {currentWeek} of {totalWeeks}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {adaptiveData.outcomeStatement || activeUserGoal.goal_catalog?.title || 'Your Progress'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-3xl leading-relaxed">
              Track your real-world capability milestones, completion pacing, and sustainable weekly balance.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${integrityCfg.badgeClass}`}>
              {integrityCfg.icon}
              <span>{integrityCfg.label}</span>
            </div>
            <Link
              to="/dashboard"
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(7,203,108,0.15)]"
            >
              <span>Today's Workbench</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Skills Mastered */}
          <div className="bg-[#0a0f0d] p-5 rounded-2xl border border-white/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                Skills Mastered
              </span>
              <span className="p-1.5 rounded-lg bg-[#07CB6C]/10 text-[#07CB6C]">
                <Target className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">
                {verifiedCount} <span className="text-base font-normal text-neutral-500">/ {totalCapabilities}</span>
              </div>
              <div className="text-xs text-neutral-400 mt-0.5">
                {capabilityProgressPct}% of milestones unlocked
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full bg-[#07CB6C] transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(5, capabilityProgressPct)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Projected Finish */}
          <div className="bg-[#0a0f0d] p-5 rounded-2xl border border-white/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                Projected Finish
              </span>
              <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {adaptiveData.projectedCompletionWindow || 'Day 87–91'}
              </div>
              <div className="text-xs text-sky-400 mt-0.5">
                {adaptiveData.confidenceLevel} Confidence
              </div>
            </div>
            <div className="text-[11px] text-neutral-400">
              Adapts dynamically to your real pacing
            </div>
          </div>

          {/* Card 3: Rest & Buffer Headroom */}
          <div className="bg-[#0a0f0d] p-5 rounded-2xl border border-white/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                Weekly Breathing Room
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">
                {adaptiveData.reliabilityMarginHours.toFixed(1)}h
              </div>
              <div className="text-xs text-emerald-400 mt-0.5">
                Built-in recovery buffer
              </div>
            </div>
            <div className="text-[11px] text-neutral-400">
              Guaranteed zero backlog debt
            </div>
          </div>

          {/* Card 4: Current Focus */}
          <div className="bg-[#0a0f0d] p-5 rounded-2xl border border-white/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                Current Focus
              </span>
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Zap className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-base font-semibold text-white truncate">
                {adaptiveData.activeBottleneck?.name || 'Core Fundamentals'}
              </div>
              <div className="text-xs text-amber-400 mt-0.5">
                Active Priority
              </div>
            </div>
            <div className="text-[11px] text-neutral-400 truncate">
              {adaptiveData.activeBottleneck?.description || 'Next capability unlock'}
            </div>
          </div>
        </div>

        {/* Capability Milestones Roadmap */}
        <div className="bg-[#0a0f0d] p-6 sm:p-7 rounded-2xl border border-white/10 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#07CB6C]" />
                <span>Milestones & Skills Roadmap</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Progression is measured by verified capability mastery rather than arbitrary checkboxes.
              </p>
            </div>
            <div className="text-xs text-neutral-400">
              <span className="text-[#07CB6C] font-semibold">{verifiedCount} Mastered</span>
              {emergingCount > 0 && (
                <>
                  <span className="text-neutral-600"> • </span>
                  <span className="text-amber-400 font-semibold">{emergingCount} In Progress</span>
                </>
              )}
              {untestedCount > 0 && (
                <>
                  <span className="text-neutral-600"> • </span>
                  <span className="text-neutral-400">{untestedCount} Upcoming</span>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {capabilities.map((cap, idx) => {
              const cfg = STATE_CONFIG[cap.state] || STATE_CONFIG.UNTESTED;
              const isBottleneck = adaptiveData.activeBottleneck?.id === cap.id;

              return (
                <div
                  key={cap.id}
                  className={`p-5 rounded-xl border flex flex-col justify-between space-y-3.5 transition-all ${cfg.bgClass} ${cfg.borderClass} ${
                    isBottleneck ? 'ring-1 ring-[#07CB6C]/40' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-neutral-400 font-medium">
                        Milestone {idx + 1}
                      </span>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${cfg.textClass} ${cfg.borderClass}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-white leading-snug">{cap.name}</h3>

                    <p className="text-xs text-neutral-400 leading-relaxed">{cap.description}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 space-y-1.5">
                    <p className="text-[11px] text-neutral-300 leading-tight">{cfg.desc}</p>
                    {isBottleneck && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#07CB6C] font-medium pt-1">
                        <Zap className="w-3 h-3" />
                        Current Focus Priority
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Energy & Routine Balance */}
        {capacityAudit && (
          <div className="bg-[#0a0f0d] p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-[#07CB6C]" />
                Weekly Routine & Energy Balance
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                  capacityAudit.is_overloaded
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-[#07CB6C]/10 text-[#07CB6C] border-[#07CB6C]/30'
                }`}
              >
                {capacityAudit.is_overloaded ? 'Schedule Overloaded' : 'Healthy Balance'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Weekly Discretionary Free Time</span>
                <span className="text-lg font-bold text-white block mt-1">{capacityAudit.total_weekly_free_hours}h</span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">Outside sleep & fixed routines</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Ambition Focus Committed</span>
                <span className={`text-lg font-bold block mt-1 ${capacityAudit.is_overloaded ? 'text-rose-400' : 'text-[#07CB6C]'}`}>
                  {capacityAudit.committed_ambition_hours}h
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">Across {capacityAudit.active_ambitions_count} active goal(s)</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Protected Buffer</span>
                <span className="text-lg font-bold text-white block mt-1">{capacityAudit.safe_capacity_limit_hours}h</span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">Guaranteed slack margin</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Schedule Load</span>
                <span className={`text-lg font-bold block mt-1 ${capacityAudit.is_overloaded ? 'text-rose-400' : 'text-[#07CB6C]'}`}>
                  {capacityAudit.capacity_utilization_pct}%
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  {capacityAudit.is_overloaded ? 'Needs schedule trim' : 'Sustainable pace'}
                </span>
              </div>
            </div>

            {/* Recommendations */}
            {capacityAudit.recommendations.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Schedule Recommendations:
                </span>
                <ul className="list-disc list-inside text-neutral-300 space-y-0.5">
                  {capacityAudit.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Your Rhythm & Habit Performance */}
        {profileTelemetry && (
          <div className="bg-[#0a0f0d] p-5 sm:p-6 rounded-2xl border border-white/10 space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#07CB6C]" />
                Your Rhythm & Performance Insights
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 font-medium">
                Active Learning
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Peak Focus Window</span>
                <span className="text-sm font-semibold text-white block mt-1">{profileTelemetry.peakWindow}</span>
                <span className="text-[11px] text-[#07CB6C] block mt-0.5">{profileTelemetry.bestWorkingHours}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Total Completed</span>
                <span className="text-sm font-semibold text-white block mt-1">{profileTelemetry.totalCompleted} Sessions</span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">Avg {profileTelemetry.avgDuration}m each</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Adaptations</span>
                <span className="text-sm font-semibold text-white block mt-1">{profileTelemetry.recoveryEvents} Handled</span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">Seamless zero-debt moves</span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-neutral-400 block">Remediation Style</span>
                <span className="text-sm font-semibold text-[#07CB6C] block mt-1 truncate">{profileTelemetry.recoveryChoice}</span>
                <span className="text-[11px] text-neutral-400 block mt-0.5">Protected baseline</span>
              </div>
            </div>
          </div>
        )}

        {/* Latest Pacing Update Note */}
        {adaptiveData.latestPlanUpdate && (
          <div className="bg-[#0a0f0d] p-4 sm:p-5 rounded-2xl border border-white/10 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>Latest Pacing Note</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              {adaptiveData.latestPlanUpdate}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProgressPage;
