import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { fetchCurrentUserGoal, fetchAggregatedProfile } from '../lib/api';
import { fetchAdaptiveDashboard } from '../lib/adaptiveApi';
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
} from 'lucide-react';

const INTEGRITY_CONFIG: Record<
  GoalIntegrityStatus,
  { label: string; badgeClass: string; textClass: string; icon: React.ReactNode }
> = {
  INTACT: {
    label: 'DESTINATION INTACT',
    badgeClass: 'bg-[#07CB6C]/10 border-[#07CB6C]/30 text-[#07CB6C]',
    textClass: 'text-[#07CB6C]',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-[#07CB6C]" />,
  },
  REVISED: {
    label: 'REVISED TRAJECTORY',
    badgeClass: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    textClass: 'text-sky-400',
    icon: <Sparkles className="w-3.5 h-3.5 text-sky-400" />,
  },
  AT_RISK: {
    label: 'CRITICAL PATH AT RISK',
    badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    textClass: 'text-amber-400',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  },
  COMPROMISED: {
    label: 'DESTINATION COMPROMISED',
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
    label: 'ROBUST',
    bgClass: 'bg-emerald-950/30',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    desc: 'Unassisted real-world capability demonstrated under varied conditions.',
  },
  ESTABLISHED: {
    label: 'ESTABLISHED',
    bgClass: 'bg-teal-950/30',
    textClass: 'text-teal-400',
    borderClass: 'border-teal-500/30',
    desc: 'Verified capability consistency across consecutive benchmarks.',
  },
  EMERGING: {
    label: 'EMERGING',
    bgClass: 'bg-amber-950/30',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    desc: 'Currently in active training stimulus. Partial consistency demonstrated.',
  },
  UNTESTED: {
    label: 'UNTESTED',
    bgClass: 'bg-[#0d1412]',
    textClass: 'text-neutral-400',
    borderClass: 'border-[#1a2824]',
    desc: 'Prerequisites pending. Scheduled for upcoming capability blocks.',
  },
  REGRESSED: {
    label: 'REGRESSED',
    bgClass: 'bg-rose-950/30',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    desc: 'Performance decay detected. Targeted remediation queued.',
  },
};

export const ProgressPage: React.FC = () => {
  const { token } = useAuth();
  const [activeUserGoal, setActiveUserGoal] = useState<UserGoal | null>(null);
  const [adaptiveData, setAdaptiveData] = useState<AdaptiveDashboardResponse | null>(null);
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
      const [goalRes, profileRes] = await Promise.all([
        fetchCurrentUserGoal(token),
        fetchAggregatedProfile(token).catch(() => null),
      ]);

      setActiveUserGoal(goalRes.user_goal);

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1a2824]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#07CB6C] px-2 py-0.5 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/20">
                ADAPTIVE 90-DAY TRAJECTORY
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                Week {currentWeek} of {totalWeeks}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
              <span>{adaptiveData.outcomeStatement || activeUserGoal.goal_catalog?.title || 'Execution Protocol'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-3xl leading-relaxed">
              Real-time progress measured by verified capability state transitions rather than arbitrary checklist check-offs.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono font-bold ${integrityCfg.badgeClass}`}>
              {integrityCfg.icon}
              <span>[{integrityCfg.label}]</span>
            </div>
            <Link
              to="/dashboard"
              className="min-h-[44px] px-4 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-[0.99]"
            >
              <span>Daily Workbench</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Executive KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Capability Transitions */}
          <div className="bg-[#0a0f0d] p-5 rounded-md border border-[#1a2824] space-y-3 relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400">
                CAPABILITY MASTERY
              </span>
              <span className="p-1.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20">
                <Target className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-bold text-white font-mono">{capabilityProgressPct}%</div>
              <div className="text-xs font-mono text-neutral-400 mt-0.5">
                <strong className="text-emerald-400">{verifiedCount}</strong> of {totalCapabilities} capabilities verified
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#131f1b] overflow-hidden">
              <div
                className="h-full bg-[#07CB6C] transition-all duration-500 rounded-full"
                style={{ width: `${Math.max(5, capabilityProgressPct)}%` }}
              />
            </div>
          </div>

          {/* Card 2: Dynamic Forecast Window */}
          <div className="bg-[#0a0f0d] p-5 rounded-md border border-[#1a2824] space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400">
                DYNAMIC FORECAST
              </span>
              <span className="p-1.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-mono">
                {adaptiveData.projectedCompletionWindow || 'Day 87–91'}
              </div>
              <div className="text-xs font-mono text-sky-400 mt-0.5">
                Confidence: {adaptiveData.confidenceLevel}
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              Adapts dynamically from telemetry
            </div>
          </div>

          {/* Card 3: Reliability Margin Headroom */}
          <div className="bg-[#0a0f0d] p-5 rounded-md border border-[#1a2824] space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400">
                RELIABILITY MARGIN
              </span>
              <span className="p-1.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-3xl font-bold text-white font-mono">
                {adaptiveData.reliabilityMarginHours.toFixed(1)}h
              </div>
              <div className="text-xs font-mono text-emerald-400 mt-0.5">
                Weekly buffer headroom
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-400">
              Zero catch-up debt guarantee
            </div>
          </div>

          {/* Card 4: Active Bottleneck */}
          <div className="bg-[#0a0f0d] p-5 rounded-md border border-[#1a2824] space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-neutral-400">
                ACTIVE BOTTLENECK
              </span>
              <span className="p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Zap className="w-4 h-4" />
              </span>
            </div>
            <div>
              <div className="text-base font-semibold text-white truncate font-mono">
                {adaptiveData.activeBottleneck?.name || 'Core Adaptation'}
              </div>
              <div className="text-xs font-mono text-amber-400 mt-0.5 uppercase">
                Status: {adaptiveData.activeBottleneck?.state || 'EMERGING'}
              </div>
            </div>
            <div className="text-[11px] font-mono text-neutral-400 truncate">
              {adaptiveData.activeBottleneck?.description || 'Current critical path unlock'}
            </div>
          </div>
        </div>

        {/* Capability State Graph & Prerequisites DAG */}
        <div className="bg-[#0a0f0d] p-6 sm:p-7 rounded-md border border-[#1a2824] space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1a2824] pb-3">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#07CB6C]" />
                <span>Capability State Graph & Verification Hierarchy</span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Progression is gated by verified capability acquisition rather than calendar days.
              </p>
            </div>
            <div className="text-xs font-mono text-neutral-400">
              Status: <span className="text-[#07CB6C] font-semibold">{verifiedCount} Verified</span>,{' '}
              <span className="text-amber-400 font-semibold">{emergingCount} Emerging</span>,{' '}
              <span className="text-neutral-400">{untestedCount} Untested</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {capabilities.map((cap, idx) => {
              const cfg = STATE_CONFIG[cap.state] || STATE_CONFIG.UNTESTED;
              const isBottleneck = adaptiveData.activeBottleneck?.id === cap.id;

              return (
                <div
                  key={cap.id}
                  className={`p-4 rounded-md border flex flex-col justify-between space-y-3 transition-all ${cfg.bgClass} ${cfg.borderClass} ${
                    isBottleneck ? 'ring-1 ring-amber-500/50' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 font-mono">
                      <span className="text-[10px] uppercase text-neutral-400">
                        Node {idx + 1} // {cap.tier === 'TIER_1_CRITICAL' ? 'Critical Path' : 'Supportive Tier'}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${cfg.textClass} ${cfg.borderClass}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white leading-snug">{cap.name}</h3>

                    <p className="text-xs text-neutral-400 leading-relaxed font-mono">{cap.description}</p>
                  </div>

                  <div className="pt-2 border-t border-[#1a2824] space-y-1">
                    <span className="text-[10px] font-mono text-neutral-500 block">VERIFICATION CRITERIA:</span>
                    <p className="text-[11px] font-mono text-neutral-300 leading-tight">{cfg.desc}</p>
                    {isBottleneck && (
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block pt-1">
                        ⚡ GOVERNING BOTTLENECK CONSTRAINT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Continuous Profile Learning Telemetry Section */}
        {profileTelemetry && (
          <div className="bg-[#0a0f0d] p-5 sm:p-6 rounded-md border border-[#1a2824] space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1a2824] pb-2.5">
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#07CB6C]" />
                CONTINUOUS PROFILE LEARNING // AGGREGATED TELEMETRY
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 font-medium uppercase">
                ACTIVE AGGREGATION
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
              <div className="p-3.5 rounded bg-[#0d1412] border border-[#1a2824]">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Peak Focus Window</span>
                <span className="text-sm font-semibold text-white block mt-1">{profileTelemetry.peakWindow}</span>
                <span className="text-[10px] text-[#07CB6C] block mt-0.5">{profileTelemetry.bestWorkingHours} CADENCE</span>
              </div>

              <div className="p-3.5 rounded bg-[#0d1412] border border-[#1a2824]">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Cumulative Volume</span>
                <span className="text-sm font-semibold text-white block mt-1">{profileTelemetry.totalCompleted} Sessions</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Avg {profileTelemetry.avgDuration}m / session</span>
              </div>

              <div className="p-3.5 rounded bg-[#0d1412] border border-[#1a2824]">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Lapse Risk Diagnostic</span>
                <span className="text-sm font-semibold text-amber-400 block mt-1 truncate">{profileTelemetry.frequentTrigger}</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">{profileTelemetry.recoveryEvents} Events Logged</span>
              </div>

              <div className="p-3.5 rounded bg-[#0d1412] border border-[#1a2824]">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Preferred Remediation</span>
                <span className="text-sm font-semibold text-[#07CB6C] block mt-1 truncate">{profileTelemetry.recoveryChoice}</span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Buffer-tier priority drop</span>
              </div>
            </div>
          </div>
        )}

        {/* Latest Adaptive Decision Trace */}
        <div className="bg-[#0a0f0d] p-5 sm:p-6 rounded-md border border-[#1a2824] space-y-2">
          <div className="flex items-center justify-between border-b border-[#1a2824] pb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              SYSTEM DIAGNOSTIC & ADAPTATION AUDIT
            </span>
            <span className="text-[10px] font-mono text-neutral-500">TRANSPARENT REASONING</span>
          </div>
          <p className="text-xs font-mono text-neutral-300 leading-relaxed pt-1">
            {adaptiveData.latestPlanUpdate || 'Trajectory progressing normally according to plan.'}
          </p>
        </div>
      </main>
    </div>
  );
};

export default ProgressPage;
