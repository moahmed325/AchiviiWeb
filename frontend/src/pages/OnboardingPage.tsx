import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCatalog, fetchGoalById, fetchCurrentUserGoal, fetchLearnedDefaults } from '../lib/api';
import { formalizeGoal, commitGoal } from '../lib/adaptiveApi';
import { getLocalDateString, getTodayDateString } from '../lib/dateUtils';
import { GoalCatalog, DayOfWeek, AvailabilitySlot, OnboardingLearnedDefaults, UserGoal } from '../types';
import type {
  GoalDomain,
  DeadlineType,
  FeasibilityZone,
  GoalFormalizationResult,
  FeasibilityAssessment,
  CommitGoalResponse,
} from '../types/adaptive';
import { DiscardGoalModal } from '../components/DiscardGoalModal';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  Sun,
  ShieldCheck,
  Zap,
  Loader2,
  AlertCircle,
  Compass,
  Activity,
  Flame,
  Globe,
  BookOpen,
  Server,
  Heart,
  Check,
  RotateCcw,
  Target,
  Shield,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

const DAYS_OF_WEEK: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MON', label: 'Monday', short: 'Mon' },
  { key: 'TUE', label: 'Tuesday', short: 'Tue' },
  { key: 'WED', label: 'Wednesday', short: 'Wed' },
  { key: 'THU', label: 'Thursday', short: 'Thu' },
  { key: 'FRI', label: 'Friday', short: 'Fri' },
  { key: 'SAT', label: 'Saturday', short: 'Sat' },
];

const CATEGORIES = ['All', 'Technology', 'Health & Fitness', 'Languages', 'Writing & Creative', 'Career & Engineering', 'Wellness & Mindset'];

interface WeekdayPreset {
  id: string;
  title: string;
  badge: string;
  timeStr: string;
  icon: string;
  getSlots: () => AvailabilitySlot[];
}

const WEEKDAY_PRESETS: WeekdayPreset[] = [
  {
    id: 'standard_9_5',
    title: 'Standard 9–5 Work',
    badge: 'Popular',
    timeStr: '09:00 – 17:00',
    icon: '💼',
    getSlots: () => [
      { day_of_week: 'MON', start_time: '09:00', end_time: '17:00', label: 'Day Job' },
      { day_of_week: 'TUE', start_time: '09:00', end_time: '17:00', label: 'Day Job' },
      { day_of_week: 'WED', start_time: '09:00', end_time: '17:00', label: 'Day Job' },
      { day_of_week: 'THU', start_time: '09:00', end_time: '17:00', label: 'Day Job' },
      { day_of_week: 'FRI', start_time: '09:00', end_time: '17:00', label: 'Day Job' },
    ],
  },
  {
    id: 'early_bird',
    title: 'Early Bird Shift',
    badge: 'Morning Shift',
    timeStr: '07:30 – 15:30',
    icon: '🌅',
    getSlots: () => [
      { day_of_week: 'MON', start_time: '07:30', end_time: '15:30', label: 'Early Shift' },
      { day_of_week: 'TUE', start_time: '07:30', end_time: '15:30', label: 'Early Shift' },
      { day_of_week: 'WED', start_time: '07:30', end_time: '15:30', label: 'Early Shift' },
      { day_of_week: 'THU', start_time: '07:30', end_time: '15:30', label: 'Early Shift' },
      { day_of_week: 'FRI', start_time: '07:30', end_time: '15:30', label: 'Early Shift' },
    ],
  },
  {
    id: 'late_shift',
    title: 'Late / Evening Shift',
    badge: 'Night Owl',
    timeStr: '12:00 – 20:00',
    icon: '🌙',
    getSlots: () => [
      { day_of_week: 'MON', start_time: '12:00', end_time: '20:00', label: 'Late Shift' },
      { day_of_week: 'TUE', start_time: '12:00', end_time: '20:00', label: 'Late Shift' },
      { day_of_week: 'WED', start_time: '12:00', end_time: '20:00', label: 'Late Shift' },
      { day_of_week: 'THU', start_time: '12:00', end_time: '20:00', label: 'Late Shift' },
      { day_of_week: 'FRI', start_time: '12:00', end_time: '20:00', label: 'Late Shift' },
    ],
  },
  {
    id: 'student_flexible',
    title: 'Student / Part-Time',
    badge: 'Alternating',
    timeStr: 'Mon/Wed/Fri 10–3',
    icon: '🎓',
    getSlots: () => [
      { day_of_week: 'MON', start_time: '10:00', end_time: '15:00', label: 'Classes' },
      { day_of_week: 'WED', start_time: '10:00', end_time: '15:00', label: 'Classes' },
      { day_of_week: 'FRI', start_time: '10:00', end_time: '15:00', label: 'Classes' },
    ],
  },
  {
    id: 'minimal_open',
    title: 'Open / Freelance Routine',
    badge: 'High Availability',
    timeStr: '10:00 – 13:00 (3h/day)',
    icon: '⚡',
    getSlots: () => [
      { day_of_week: 'MON', start_time: '10:00', end_time: '13:00', label: 'Core Work' },
      { day_of_week: 'TUE', start_time: '10:00', end_time: '13:00', label: 'Core Work' },
      { day_of_week: 'WED', start_time: '10:00', end_time: '13:00', label: 'Core Work' },
      { day_of_week: 'THU', start_time: '10:00', end_time: '13:00', label: 'Core Work' },
      { day_of_week: 'FRI', start_time: '10:00', end_time: '13:00', label: 'Core Work' },
    ],
  },
];

const DOMAIN_OPTIONS: { value: GoalDomain; label: string; icon: string; desc: string }[] = [
  { value: 'PHYSICAL', label: 'Physical', icon: '🏋️', desc: 'Fitness, sport, endurance, body composition' },
  { value: 'COGNITIVE', label: 'Cognitive', icon: '🧠', desc: 'Learning, skills, language, certification' },
  { value: 'PROJECT', label: 'Project', icon: '🚀', desc: 'Building, shipping, creative output' },
];

const FEASIBILITY_CONFIG: Record<FeasibilityZone, { color: string; bgClass: string; borderClass: string; label: string; icon: React.ReactNode }> = {
  GREEN: {
    color: 'text-emerald-400',
    bgClass: 'bg-emerald-950/30',
    borderClass: 'border-emerald-500/40',
    label: 'HIGH FEASIBILITY',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
  },
  YELLOW: {
    color: 'text-amber-400',
    bgClass: 'bg-amber-950/30',
    borderClass: 'border-amber-500/40',
    label: 'MODERATE — ACHIEVABLE WITH DISCIPLINE',
    icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  },
  RED: {
    color: 'text-rose-400',
    bgClass: 'bg-rose-950/30',
    borderClass: 'border-rose-500/40',
    label: 'HIGH RISK — CONSIDER ADJUSTING',
    icon: <AlertCircle className="w-5 h-5 text-rose-400" />,
  },
};

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goalIdParam = searchParams.get('goalId');
  const modeParam = searchParams.get('mode');
  const { user, token, openAuthModal } = useAuth();

  // 4-Step Architecture: 1 = Destination, 2 = Feasibility, 3 = Availability, 4 = Committed
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdjustingRoutine, setIsAdjustingRoutine] = useState<boolean>(false);
  const [existingActiveGoal, setExistingActiveGoal] = useState<UserGoal | null>(null);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);

  // Catalog State
  const [allGoals, setAllGoals] = useState<GoalCatalog[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedGoal, setSelectedGoal] = useState<GoalCatalog | null>(null);

  // Adaptive Goal Formalization State
  const [outcomeStatement, setOutcomeStatement] = useState<string>('');
  const [domain, setDomain] = useState<GoalDomain>('PHYSICAL');
  const [deadlineType, setDeadlineType] = useState<DeadlineType>('SOFT');
  const [weeklyAvailableHours, setWeeklyAvailableHours] = useState<number>(6);

  // Formalization + Feasibility Results (set after Step 1 → Step 2 transition)
  const [formalizationResult, setFormalizationResult] = useState<GoalFormalizationResult | null>(null);
  const [feasibilityResult, setFeasibilityResult] = useState<FeasibilityAssessment | null>(null);

  // Commit Result (set after Step 3 → Step 4 transition)
  const [commitResult, setCommitResult] = useState<CommitGoalResponse | null>(null);

  // Availability State (reused from legacy)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard_9_5');
  const [saturdayMode, setSaturdayMode] = useState<'FREE' | 'MORNING' | 'FULL_DAY'>('FREE');
  const [startDate, setStartDate] = useState<string>(() => getTodayDateString());
  const [quickDateOption, setQuickDateOption] = useState<'TODAY' | 'NEXT_MONDAY' | 'CUSTOM'>('TODAY');

  // Busy Blocks State
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([
    { day_of_week: 'MON', start_time: '09:00', end_time: '17:00', label: 'Work' },
    { day_of_week: 'TUE', start_time: '09:00', end_time: '17:00', label: 'Work' },
    { day_of_week: 'WED', start_time: '09:00', end_time: '17:00', label: 'Work' },
    { day_of_week: 'THU', start_time: '09:00', end_time: '17:00', label: 'Work' },
    { day_of_week: 'FRI', start_time: '09:00', end_time: '17:00', label: 'Work' },
  ]);

  // Verification & Custom Slot Form
  const [activeVerificationDay, setActiveVerificationDay] = useState<DayOfWeek>('MON');
  const [newStartTime, setNewStartTime] = useState<string>('09:00');
  const [newEndTime, setNewEndTime] = useState<string>('17:00');
  const [newLabel, setNewLabel] = useState<string>('Work');

  // Continuous Profile Learning State
  const [learnedDefaults, setLearnedDefaults] = useState<OnboardingLearnedDefaults | null>(null);
  const [showLearnedSuggestion, setShowLearnedSuggestion] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const catalog = await fetchCatalog();
        setAllGoals(catalog);

        let initialSelected: GoalCatalog | null = null;

        // Check for continuous profile learning defaults
        if (token) {
          try {
            const defaults = await fetchLearnedDefaults(token);
            if (defaults.has_historical_data) {
              setLearnedDefaults(defaults);
            }
          } catch (_) {}
        }

        // Check for existing active goal and pre-populate saved routine if returning
        if (token) {
          try {
            const currentGoalData = await fetchCurrentUserGoal(token);
            if (currentGoalData.user_goal) {
              setExistingActiveGoal(currentGoalData.user_goal);
              const activeCatalogId = currentGoalData.user_goal.goal_catalog_id;
              const isDifferentGoal = Boolean(goalIdParam && goalIdParam !== activeCatalogId);
              const targetGoalId = goalIdParam || activeCatalogId;
              const matchingGoal = catalog.find((g) => g.id === targetGoalId) || currentGoalData.user_goal.goal_catalog;
              if (matchingGoal) {
                initialSelected = matchingGoal;
              }
              if (currentGoalData.user_goal.start_date) {
                setStartDate(getLocalDateString(currentGoalData.user_goal.start_date));
              }
              if (currentGoalData.availability_slots && currentGoalData.availability_slots.length > 0) {
                setAvailabilitySlots(currentGoalData.availability_slots);
              }

              // Direct entry into Step 3 when adjusting routine for active goal
              const shouldAdjust = (modeParam === 'adjust' || !goalIdParam || goalIdParam === activeCatalogId) && !isDifferentGoal;
              if (shouldAdjust) {
                setIsAdjustingRoutine(true);
                setStep(3);
              }
            }
          } catch (e) {
            // Non-fatal
          }
        }

        if (!initialSelected) {
          if (goalIdParam) {
            const match = catalog.find((g) => g.id === goalIdParam);
            initialSelected = match || (await fetchGoalById(goalIdParam));
          } else if (catalog.length > 0) {
            initialSelected = catalog[0];
          }
        }

        setSelectedGoal(initialSelected);
      } catch (err: any) {
        setError(err.message || 'Failed to load catalog');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [goalIdParam, modeParam, token]);

  const getGoalIcon = (iconName: string) => {
    switch (iconName?.toLowerCase()) {
      case 'rocket': return <Zap className="w-5 h-5 text-indigo-400" />;
      case 'flame': return <Flame className="w-5 h-5 text-rose-400" />;
      case 'globe': return <Globe className="w-5 h-5 text-sky-400" />;
      case 'bookopen': return <BookOpen className="w-5 h-5 text-amber-400" />;
      case 'server': return <Server className="w-5 h-5 text-emerald-400" />;
      case 'heart': return <Heart className="w-5 h-5 text-pink-400" />;
      default: return <Compass className="w-5 h-5 text-purple-400" />;
    }
  };

  // Helper: apply weekday preset
  const handleSelectWeekdayPreset = (preset: WeekdayPreset) => {
    setSelectedPresetId(preset.id);
    const saturdaySlots = availabilitySlots.filter((s) => s.day_of_week === 'SAT');
    setAvailabilitySlots([...preset.getSlots(), ...saturdaySlots]);
  };

  // Helper: apply Saturday mode
  const handleSelectSaturdayMode = (mode: 'FREE' | 'MORNING' | 'FULL_DAY') => {
    setSaturdayMode(mode);
    const withoutSat = availabilitySlots.filter((s) => s.day_of_week !== 'SAT');
    if (mode === 'MORNING') {
      setAvailabilitySlots([
        ...withoutSat,
        { day_of_week: 'SAT', start_time: '09:00', end_time: '13:00', label: 'Saturday Morning' },
      ]);
    } else if (mode === 'FULL_DAY') {
      setAvailabilitySlots([
        ...withoutSat,
        { day_of_week: 'SAT', start_time: '09:00', end_time: '17:00', label: 'Saturday Work' },
      ]);
    } else {
      setAvailabilitySlots(withoutSat);
    }
  };

  // Helper: Quick date selector
  const handleSelectQuickDate = (option: 'TODAY' | 'NEXT_MONDAY' | 'CUSTOM') => {
    setQuickDateOption(option);
    const now = new Date();
    if (option === 'TODAY') {
      setStartDate(getLocalDateString(now));
    } else if (option === 'NEXT_MONDAY') {
      const day = now.getDay();
      const diffToMonday = (8 - day) % 7 || 7;
      const nextMon = new Date(now.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
      setStartDate(getLocalDateString(nextMon));
    }
  };

  // Helper: Clear specific day
  const handleClearDay = (dayKey: DayOfWeek) => {
    setAvailabilitySlots((prev) => prev.filter((s) => s.day_of_week !== dayKey));
  };

  // Helper: Remove single slot
  const handleRemoveSlot = (slotToRemove: AvailabilitySlot) => {
    setAvailabilitySlots((prev) =>
      prev.filter(
        (s) =>
          !(
            s.day_of_week === slotToRemove.day_of_week &&
            s.start_time === slotToRemove.start_time &&
            s.end_time === slotToRemove.end_time
          )
      )
    );
  };

  // Helper: Add custom slot
  const handleAddCustomSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartTime || !newEndTime) return;
    if (newStartTime >= newEndTime) {
      setError('End time must be after start time.');
      return;
    }
    setAvailabilitySlots((prev) => [
      ...prev,
      {
        day_of_week: activeVerificationDay,
        start_time: newStartTime,
        end_time: newEndTime,
        label: newLabel || 'Busy',
      },
    ]);
  };

  // ─── Step 1 → Step 2: Formalize goal and check feasibility ───
  const handleFormalizeGoal = async () => {
    if (!user || !token) {
      openAuthModal('signup');
      return;
    }
    if (!selectedGoal) {
      setError('Please select a goal first.');
      return;
    }
    const rawGoal = outcomeStatement.trim() || selectedGoal.title;
    if (!rawGoal) {
      setError('Please describe what you want to achieve.');
      return;
    }

    // Single Active Goal constraint guard
    if (existingActiveGoal && !isAdjustingRoutine && existingActiveGoal.goal_catalog_id !== selectedGoal.id) {
      setError('Only one active protocol can run concurrently. Discard or graduate current goal before initializing a new one.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await formalizeGoal(token, {
        rawGoal,
        domain,
        deadlineType,
        weeklyAvailableHours,
      });
      setFormalizationResult(res.formalization);
      setFeasibilityResult(res.feasibility);
      // Auto-populate outcome if user didn't customize
      if (!outcomeStatement.trim()) {
        setOutcomeStatement(res.formalization.concreteOutcomeStatement);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to formalize goal.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 3 → Step 4: Commit goal with availability ───
  const handleCommitGoal = async () => {
    if (!token || !selectedGoal) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await commitGoal(token, {
        goalCatalogId: selectedGoal.id,
        outcomeStatement: outcomeStatement.trim() || formalizationResult?.concreteOutcomeStatement || selectedGoal.title,
        verificationCriteria: formalizationResult?.verificationCriteria || 'Demonstrate unassisted real-world capability.',
        deadlineType,
        domain,
        startDate: new Date(startDate).toISOString(),
        sustainableWeeklyHours: weeklyAvailableHours,
        availabilitySlots: availabilitySlots.map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          label: s.label || undefined,
        })),
      });
      setCommitResult(res);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to commit goal and generate trajectory.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate timeline
  const targetEndDate = new Date(new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000);
  const formattedEndDate = isNaN(targetEndDate.getTime())
    ? '—'
    : targetEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Calculate approximate free hours per week
  const busyMinutesPerWeek = availabilitySlots.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
  const estimatedFreeHours = Math.max(0, Math.round(98 - busyMinutesPerWeek / 60));

  const filteredGoals = allGoals.filter((g) => {
    if (selectedCategory === 'All') return true;
    return g.category.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  const STEP_LABELS = ['Destination', 'Feasibility', 'Availability', 'Committed'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">Configuring your onboarding experience...</p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col bg-[#050807] text-[#e5ebe7] relative">
      {/* Top Header */}
      <header className="border-b border-[#1a2824] bg-[#0c1210] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="min-h-[44px] inline-flex items-center gap-2 text-xs font-mono text-[#9ca3af] hover:text-[#e5ebe7] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#07CB6C]" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#e5ebe7]">Achivii</span>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-sm bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/20 uppercase tracking-wider">
              {isAdjustingRoutine ? 'Adjust Routine' : 'Adaptive Onboarding'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 relative z-10 space-y-6 sm:space-y-8">
        {/* Single Active Goal Conflict Warning Banner */}
        {existingActiveGoal && (!isAdjustingRoutine || (selectedGoal && selectedGoal.id !== existingActiveGoal.goal_catalog_id)) && (
          <div className="p-4 sm:p-5 rounded-md bg-[#0a0f0d] border border-amber-500/40 text-xs font-mono space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>ACTIVE PROTOCOL IN PROGRESS // SINGLE ACTIVE GOAL RULE</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px]">
                CONCURRENT LIMIT: 1
              </span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              You already have an active 90-day protocol running: <strong className="text-white font-mono">{existingActiveGoal.goal_catalog?.title || 'Active Protocol'}</strong>.
              Achivii enforces a strict single-goal focus to prevent fragmentation and guarantee deterministic completion.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/"
                className="min-h-[38px] px-4 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b860] text-[#080d0b] font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <span>Go to Active Workbench</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setIsDiscardModalOpen(true)}
                className="min-h-[38px] px-3.5 py-2 rounded-md bg-[#0d1412] hover:bg-red-950/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard Active Protocol</span>
              </button>
            </div>
          </div>
        )}

        {/* 4-Step Architecture Indicator */}
        {step < 5 && (
          <div className="flex items-center justify-center gap-2 sm:gap-3 text-xs font-mono">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const isActive = step === stepNum;
              const isCompleted = step > stepNum;
              const isClickable = stepNum < step;
              return (
                <React.Fragment key={label}>
                  {idx > 0 && <div className="w-4 sm:w-8 h-px bg-[#1a2824]" />}
                  <div
                    onClick={() => isClickable && setStep(stepNum)}
                    className={`flex items-center gap-1.5 transition-colors ${
                      isClickable ? 'cursor-pointer hover:text-[#e5ebe7]' : ''
                    } ${isActive ? 'text-[#07CB6C] font-bold' : isCompleted ? 'text-emerald-600' : 'text-[#9ca3af]'}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono font-bold ${
                        isActive
                          ? 'bg-[#07CB6C] text-[#050807]'
                          : isCompleted
                          ? 'bg-emerald-800 text-emerald-200'
                          : 'bg-[#0c1210] border border-[#1a2824] text-[#9ca3af]'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : stepNum}
                    </div>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: GOAL DESTINATION */}
        {/* ========================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-white">Define Your 90-Day Destination</h1>
              <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
                Select a goal template, then describe the specific outcome you want to achieve. The system will verify feasibility before you commit.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded font-mono text-[11px] transition-colors shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-500 text-black font-semibold shadow-none'
                      : 'bg-[#0c1210] border border-[#1a2824] text-[#a6b8ad] hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Goal Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredGoals.map((goal) => {
                const isSelected = selectedGoal?.id === goal.id;
                return (
                  <div
                    key={goal.id}
                    onClick={() => {
                      setSelectedGoal(goal);
                      if (!outcomeStatement.trim()) {
                        setOutcomeStatement(goal.title);
                      }
                    }}
                    className={`p-5 rounded-md cursor-pointer transition-all border relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#0c1210] border-emerald-500 ring-1 ring-emerald-500/50 shadow-none'
                        : 'bg-[#0c1210] border-[#1a2824] hover:border-emerald-500/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-md bg-[#080d0b] border border-[#1a2824]">
                            {getGoalIcon(goal.icon)}
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                            {goal.category}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded bg-emerald-500 text-black flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white mb-1">{goal.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{goal.description}</p>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-300">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" /> {goal.est_weekly_hours}h / week
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[11px] text-purple-300">
                        90 Days (Adaptive)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Outcome Statement Input */}
            {selectedGoal && (
              <div className="bg-[#0c1210] p-6 rounded-md border border-[#1a2824] space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Describe Your Concrete Outcome</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  What specific, measurable result do you want to achieve in 90 days? Be as concrete as possible — this becomes your verification criteria.
                </p>
                <textarea
                  value={outcomeStatement}
                  onChange={(e) => setOutcomeStatement(e.target.value)}
                  placeholder={`e.g. "Run a 5K in under 25 minutes without stopping" or "Build and ship a production web app with authentication"`}
                  rows={3}
                  className="w-full px-4 py-3 rounded-md bg-[#080d0b] border border-[#1a2824] text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
                />

                {/* Domain & Weekly Hours Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {DOMAIN_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDomain(opt.value)}
                      className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                        domain === opt.value
                          ? 'bg-emerald-950/40 text-white border-emerald-500'
                          : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{opt.icon}</span>
                        <span className="font-bold text-xs">{opt.label}</span>
                      </div>
                      <div className={`text-[11px] ${domain === opt.value ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Deadline Type & Weekly Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#080d0b] p-4 rounded-md border border-[#1a2824] space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Deadline Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDeadlineType('SOFT')}
                        className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          deadlineType === 'SOFT'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500'
                            : 'bg-[#0c1210] border border-[#1a2824] text-slate-400 hover:text-white'
                        }`}
                      >
                        Soft (Flexible)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeadlineType('HARD')}
                        className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                          deadlineType === 'HARD'
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-500'
                            : 'bg-[#0c1210] border border-[#1a2824] text-slate-400 hover:text-white'
                        }`}
                      >
                        Hard (Fixed)
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {deadlineType === 'SOFT'
                        ? 'System can extend timeline if scientifically warranted.'
                        : 'System optimizes within fixed 90-day runway. No extension.'}
                    </p>
                  </div>

                  <div className="bg-[#080d0b] p-4 rounded-md border border-[#1a2824] space-y-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">Weekly Available Hours</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={2}
                        max={20}
                        step={0.5}
                        value={weeklyAvailableHours}
                        onChange={(e) => setWeeklyAvailableHours(parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-500"
                      />
                      <span className="text-lg font-bold text-emerald-400 font-mono w-14 text-right">{weeklyAvailableHours}h</span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Hours per week you can sustainably dedicate to this goal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1 Continue CTA */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <div className="text-xs text-slate-400">
                Selected:{' '}
                <strong className="text-white">
                  {selectedGoal?.title || 'None'}
                </strong>
              </div>

              <button
                id="btn-step1-continue"
                onClick={handleFormalizeGoal}
                disabled={!selectedGoal || submitting}
                className="min-h-[44px] py-2.5 px-6 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold shadow-none flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Feasibility...</span>
                  </>
                ) : (
                  <>
                    <span>Check Feasibility</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: FEASIBILITY GATE */}
        {/* ========================================================= */}
        {step === 2 && formalizationResult && feasibilityResult && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Feasibility Assessment</h2>
              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                Your goal has been analyzed against 90-day physiological and cognitive adaptation timelines. Review the assessment below.
              </p>
            </div>

            {/* Feasibility Zone Badge */}
            {(() => {
              const config = FEASIBILITY_CONFIG[feasibilityResult.zone];
              return (
                <div className={`p-5 sm:p-6 rounded-md border ${config.bgClass} ${config.borderClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {config.icon}
                      <div>
                        <span className={`text-[10px] font-mono uppercase tracking-wider ${config.color} font-bold block`}>
                          {config.label}
                        </span>
                        <span className="text-white font-bold text-sm">
                          Feasibility Score: {feasibilityResult.score}/100
                        </span>
                      </div>
                    </div>
                    <span className={`text-2xl font-black font-mono ${config.color}`}>
                      {feasibilityResult.zone}
                    </span>
                  </div>

                  {feasibilityResult.zone === 'RED' && (
                    <p className="text-xs text-rose-300 leading-relaxed">
                      This goal carries high risk under the current parameters. Consider increasing weekly hours, adjusting the deadline type to SOFT, or narrowing the outcome scope.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Formalized Outcome Statement */}
            <div className="bg-[#0c1210] p-5 rounded-md border border-[#1a2824] space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">Concrete Outcome Statement</span>
              </div>
              <p className="text-white text-sm font-semibold leading-relaxed">
                "{formalizationResult.concreteOutcomeStatement}"
              </p>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                <span>Verification: {formalizationResult.verificationCriteria}</span>
              </div>
            </div>

            {/* Baseline Questions */}
            {formalizationResult.baselineQuestions.length > 0 && (
              <div className="bg-[#0c1210] p-5 rounded-md border border-[#1a2824] space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">Baseline Assessment Questions</span>
                </div>
                <p className="text-xs text-slate-400">These questions help establish your starting point. You'll verify these during your first week.</p>
                <div className="space-y-2">
                  {formalizationResult.baselineQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-emerald-500 font-mono font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottleneck Risks & Recommendations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {feasibilityResult.bottleneckRisks.length > 0 && (
                <div className="bg-[#0c1210] p-4 rounded-md border border-[#1a2824] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Bottleneck Risks
                  </span>
                  <ul className="space-y-1">
                    {feasibilityResult.bottleneckRisks.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {feasibilityResult.recommendations.length > 0 && (
                <div className="bg-[#0c1210] p-4 rounded-md border border-[#1a2824] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Recommendations
                  </span>
                  <ul className="space-y-1">
                    {feasibilityResult.recommendations.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Domain & Parameters Summary */}
            <div className="p-4 rounded-md bg-[#080d0b] border border-[#1a2824] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block mb-0.5">Domain</span>
                <span className="text-white font-bold">{formalizationResult.domain}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Deadline</span>
                <span className="text-white font-bold">{deadlineType}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Weekly Capacity</span>
                <span className="text-emerald-400 font-bold">{weeklyAvailableHours}h</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Timeline</span>
                <span className="text-white font-bold">90 Days</span>
              </div>
            </div>

            {/* Step 2 Navigation */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2.5 px-5 rounded-md bg-[#0c1210] hover:bg-[#111a17] text-slate-300 text-xs font-semibold border border-[#1a2824] transition-colors cursor-pointer"
              >
                ← Adjust Destination
              </button>

              <button
                onClick={() => setStep(3)}
                className="min-h-[44px] py-2.5 px-6 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span>Accept & Configure Availability</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: AVAILABILITY & COMMIT */}
        {/* ========================================================= */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header */}
            {isAdjustingRoutine ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-md bg-[#0c1210] border border-[#1a2824] shadow-none">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-emerald-950/20 border border-emerald-500/30 text-emerald-400">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                        Adjusting Routine
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                        Active Plan
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white">{selectedGoal?.title || 'Active Goal'}</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Update your availability. The trajectory will re-adapt to your new hours automatically.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustingRoutine(false);
                    setStep(1);
                  }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-4 self-start sm:self-auto cursor-pointer shrink-0"
                >
                  Switch to a different goal
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md bg-[#0c1210] border border-[#1a2824]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-[#080d0b] border border-[#1a2824]">
                    {selectedGoal && getGoalIcon(selectedGoal.icon)}
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      Destination Verified
                    </span>
                    <div className="font-bold text-sm text-white">{outcomeStatement || selectedGoal?.title}</div>
                    {feasibilityResult && (
                      <span className={`text-[10px] font-mono font-bold ${FEASIBILITY_CONFIG[feasibilityResult.zone].color}`}>
                        Feasibility: {feasibilityResult.zone} ({feasibilityResult.score}/100)
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  className="text-xs text-slate-400 hover:text-white underline self-start sm:self-auto cursor-pointer"
                >
                  Review Feasibility
                </button>
              </div>
            )}

            <div className="text-center space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {isAdjustingRoutine ? 'Adjust Your Weekly Availability' : 'Configure Your Weekly Availability'}
              </h2>
              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                {isAdjustingRoutine
                  ? 'Update your routine hours, busy blocks, or start date below. The trajectory will re-adapt automatically.'
                  : 'Tell us when you\'re busy. The system will build your adaptive trajectory around your real availability.'}
              </p>
            </div>

            {/* Continuous Profile Learning: Editable Suggestions Banner */}
            {learnedDefaults && learnedDefaults.has_historical_data && showLearnedSuggestion && (
              <div className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] flex items-start justify-between gap-3 text-xs animate-in fade-in shadow-none">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">Learned Consistency Suggestions</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                        Profile Memory
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-xs">
                      {learnedDefaults.coaching_insight ||
                        `From your previous goals, your consistency peaks with ${learnedDefaults.recommended_days_per_week} days/week and ${learnedDefaults.preferred_time_of_day} focus sessions.`}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                      <span>Suggested focus days: <strong className="text-emerald-400">{learnedDefaults.high_completion_days.join(', ')}</strong></span>
                      <span>•</span>
                      <span className="italic">Fully editable below. Never applied without your review.</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLearnedSuggestion(false)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors text-base"
                  title="Dismiss suggestion"
                >
                  ×
                </button>
              </div>
            )}

            {/* KICKOFF DATE */}
            {isAdjustingRoutine ? (
              <div className="bg-[#0c1210] p-4 sm:p-5 rounded-md border border-[#1a2824] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-[#080d0b] border border-[#1a2824] text-emerald-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                      Active Goal Timeline
                    </span>
                    <span className="text-white font-bold text-sm">
                      Kicked Off: {new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Projected Finish</span>
                    <span className="text-emerald-400 font-bold">{formattedEndDate}</span>
                  </div>
                  <div className="hidden sm:block w-px h-6 bg-slate-800" />
                  <div>
                    <span className="text-slate-500 text-[10px] block">Adaptive Runway</span>
                    <span className="text-slate-300 font-bold">90 Days</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#0c1210] p-6 rounded-md border border-[#1a2824] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>When do you want to kick off?</span>
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    Finish: {formattedEndDate}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectQuickDate('TODAY')}
                    className={`p-3.5 rounded-md border text-left transition-all cursor-pointer ${
                      quickDateOption === 'TODAY'
                        ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                        : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="font-bold text-xs">Today (Immediate Start)</div>
                    <div className={`text-[11px] mt-0.5 font-mono ${quickDateOption === 'TODAY' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectQuickDate('NEXT_MONDAY')}
                    className={`p-3.5 rounded-md border text-left transition-all cursor-pointer ${
                      quickDateOption === 'NEXT_MONDAY'
                        ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                        : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="font-bold text-xs">Next Monday</div>
                    <div className={`text-[11px] mt-0.5 font-mono ${quickDateOption === 'NEXT_MONDAY' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      Clean Week Kickoff
                    </div>
                  </button>

                  <div
                    onClick={() => setQuickDateOption('CUSTOM')}
                    className={`p-3 rounded-md border text-left flex flex-col justify-center cursor-pointer ${
                      quickDateOption === 'CUSTOM'
                        ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/40'
                        : 'bg-[#080d0b] border-[#1a2824] hover:border-emerald-500/30'
                    }`}
                  >
                    <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 block">
                      Custom Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setQuickDateOption('CUSTOM');
                        setStartDate(e.target.value);
                      }}
                      className="w-full bg-transparent text-base sm:text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* WEEKDAY PRESETS */}
            <div className="bg-[#0c1210] p-6 rounded-md border border-[#1a2824] space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>What does your typical weekday (Mon–Fri) look like?</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {WEEKDAY_PRESETS.slice(0, 3).map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectWeekdayPreset(preset)}
                      className={`p-3.5 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                          : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{preset.icon}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-emerald-500 text-black font-bold' : 'bg-[#1a2824] text-slate-400'
                          }`}>
                            {preset.badge}
                          </span>
                        </div>
                        <div className="font-bold text-xs">{preset.title}</div>
                      </div>
                      <div className={`text-[11px] font-mono mt-2 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {preset.timeStr}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {WEEKDAY_PRESETS.slice(3, 5).map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectWeekdayPreset(preset)}
                      className={`p-3.5 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                          : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{preset.icon}</span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-emerald-500 text-black font-bold' : 'bg-[#1a2824] text-slate-400'
                          }`}>
                            {preset.badge}
                          </span>
                        </div>
                        <div className="font-bold text-xs">{preset.title}</div>
                      </div>
                      <div className={`text-[11px] font-mono mt-2 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {preset.timeStr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SATURDAY MODE */}
            <div className="bg-[#0c1210] p-6 rounded-md border border-[#1a2824] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Do you have work or commitments on Saturdays?</span>
                </span>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span>Sunday is always 100% free buffer</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectSaturdayMode('FREE')}
                  className={`p-3.5 rounded-md border text-left transition-all cursor-pointer ${
                    saturdayMode === 'FREE'
                      ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                      : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="font-bold text-xs">Saturdays 100% Free</div>
                  <div className={`text-[11px] mt-0.5 ${saturdayMode === 'FREE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    Recommended for overflow recovery
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSaturdayMode('MORNING')}
                  className={`p-3.5 rounded-md border text-left transition-all cursor-pointer ${
                    saturdayMode === 'MORNING'
                      ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                      : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="font-bold text-xs">Saturday Morning Busy</div>
                  <div className={`text-[11px] mt-0.5 font-mono ${saturdayMode === 'MORNING' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    Busy 09:00 – 13:00
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSaturdayMode('FULL_DAY')}
                  className={`p-3.5 rounded-md border text-left transition-all cursor-pointer ${
                    saturdayMode === 'FULL_DAY'
                      ? 'bg-emerald-950/40 text-white border-emerald-500 shadow-none'
                      : 'bg-[#080d0b] border-[#1a2824] text-slate-300 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="font-bold text-xs">Saturday Full Day Busy</div>
                  <div className={`text-[11px] mt-0.5 font-mono ${saturdayMode === 'FULL_DAY' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    Busy 09:00 – 17:00
                  </div>
                </button>
              </div>
            </div>

            {/* VERIFY BUSY BLOCKS */}
            <div className="bg-[#0c1210] p-6 rounded-md border border-[#1a2824] space-y-4 shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1a2824]">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">
                      Verify Your Weekly Busy Blocks
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    The system will build your adaptive trajectory around these committed hours.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Free time capacity:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                    ~{estimatedFreeHours} hrs / week open
                  </span>
                </div>
              </div>

              {/* Day-by-Day Busy Summary Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {DAYS_OF_WEEK.map((d) => {
                  const slots = availabilitySlots.filter((s) => s.day_of_week === d.key);
                  const isSelected = activeVerificationDay === d.key;

                  return (
                    <div
                      key={d.key}
                      onClick={() => setActiveVerificationDay(d.key)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span className="text-white">{d.short}</span>
                        {slots.length > 0 && (
                          <span className="w-2 h-2 rounded-full bg-rose-400" />
                        )}
                      </div>

                      <div className="space-y-1">
                        {slots.length === 0 ? (
                          <span className="text-[11px] text-emerald-400 font-medium">100% Free</span>
                        ) : (
                          slots.map((s, idx) => (
                            <div key={idx} className="text-[10px] font-mono text-slate-300 truncate">
                              {s.start_time}–{s.end_time}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detail list for activeVerificationDay + Inline Add / Clear */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-2">
                    <span>{DAYS_OF_WEEK.find((d) => d.key === activeVerificationDay)?.label} Busy Details:</span>
                  </span>

                  {availabilitySlots.filter((s) => s.day_of_week === activeVerificationDay).length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearDay(activeVerificationDay)}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear {activeVerificationDay} (Mark 100% Free)</span>
                    </button>
                  )}
                </div>

                {/* Slots on this day */}
                <div className="flex flex-wrap gap-2">
                  {availabilitySlots.filter((s) => s.day_of_week === activeVerificationDay).length === 0 ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5 py-1">
                      <Check className="w-4 h-4" />
                      <span>Entire day is marked free. Sessions can be scheduled anytime from 07:00 to 22:00.</span>
                    </div>
                  ) : (
                    availabilitySlots
                      .filter((s) => s.day_of_week === activeVerificationDay)
                      .map((s, i) => (
                        <div
                          key={i}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs"
                        >
                          <span className="font-bold text-white">{s.label || 'Busy'}</span>
                          <span className="font-mono text-slate-400">
                            {s.start_time} – {s.end_time}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlot(s)}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))
                  )}
                </div>

                {/* Optional Custom Slot Form */}
                <form onSubmit={handleAddCustomSlot} className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Custom busy label (e.g. Gym)"
                    className="w-full sm:flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer shrink-0"
                    >
                      + Add Block
                    </button>
                  </div>
                </form>
              </div>

              {/* Sunday Buffer Guarantee */}
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Sunday Buffer Guarantee:</strong> Sundays are kept 100% open for rest, family, and adaptive overflow recovery.
                  </span>
                </div>
                <span className="text-xs font-bold text-white shrink-0">100% Protected</span>
              </div>
            </div>

            {/* ACTION BAR: COMMIT GOAL */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
              {isAdjustingRoutine ? (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto py-2.5 px-5 rounded-md bg-[#0c1210] hover:bg-[#111a17] text-slate-300 text-xs font-semibold border border-[#1a2824] transition-colors cursor-pointer"
                >
                  ← Cancel & Return to Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto py-2.5 px-5 rounded-md bg-[#0c1210] hover:bg-[#111a17] text-slate-300 text-xs font-semibold border border-[#1a2824] transition-colors cursor-pointer"
                >
                  ← Back to Feasibility
                </button>
              )}

              <button
                id="btn-commit-goal"
                type="button"
                onClick={handleCommitGoal}
                disabled={submitting}
                className="w-full sm:w-auto min-h-[44px] py-3 px-8 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Building Capability DAG & Trajectory...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>{isAdjustingRoutine ? 'Update Trajectory' : 'Commit Goal & Generate Trajectory'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: TRAJECTORY COMMITTED */}
        {/* ========================================================= */}
        {step === 4 && commitResult && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-[#0c1210] p-8 sm:p-12 rounded-md border border-[#1a2824] text-center space-y-6 max-w-2xl mx-auto animate-in zoom-in-95 duration-300 shadow-none">
              <div className="w-14 h-14 rounded-md bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Adaptive Trajectory v1 Generated</span>
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Goal Committed & Trajectory Active
                </h2>
                <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                  Your destination is locked. The system has built a Capability DAG and generated your first trajectory
                  with <strong className="text-emerald-400">{commitResult.week1ExecutionObjects.length} Week 1 execution objects</strong>.
                </p>
              </div>

              {/* Outcome Statement */}
              <div className="p-4 rounded-md bg-[#080d0b] border border-[#1a2824] text-left space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">Locked Destination</span>
                <p className="text-white text-sm font-semibold">
                  "{outcomeStatement || formalizationResult?.concreteOutcomeStatement || selectedGoal?.title}"
                </p>
              </div>

              {/* Stats Grid */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-500 block mb-1">Capabilities</span>
                  <span className="text-white font-bold">{commitResult.capabilitiesCount} nodes in DAG</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Trajectory</span>
                  <span className="text-emerald-400 font-bold">v1 Active</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Kickoff</span>
                  <span className="text-white font-bold">{startDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-1">Projected Finish</span>
                  <span className="text-emerald-400 font-bold">{formattedEndDate}</span>
                </div>
              </div>

              {/* Week 1 Execution Objects */}
              {commitResult.week1ExecutionObjects.length > 0 && (
                <div className="text-left space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">Week 1 Execution Objects</span>
                  <div className="space-y-1.5">
                    {commitResult.week1ExecutionObjects.slice(0, 5).map((eo, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-md bg-[#080d0b] border border-[#1a2824] text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${eo.priorityTier === 1 ? 'bg-emerald-400' : eo.priorityTier === 2 ? 'bg-sky-400' : 'bg-slate-500'}`} />
                          <span className="text-white font-semibold">{eo.actionName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                          <span>{eo.standardDoseMinutes}m</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-amber-400">{eo.reducedDoseMinutes}m</span>
                          <span className="text-slate-600">|</span>
                          <span className="text-rose-400">{eo.mvsDoseMinutes}m</span>
                        </div>
                      </div>
                    ))}
                    {commitResult.week1ExecutionObjects.length > 5 && (
                      <p className="text-[11px] text-slate-500 text-center">
                        + {commitResult.week1ExecutionObjects.length - 5} more execution objects
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white inline-block" /> Standard dose</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Reduced</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> MVS (minimum)</span>
                  </div>
                </div>
              )}

              {/* Direct Navigation */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto min-h-[44px] py-3 px-6 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center justify-center gap-2 shadow-none transition-colors cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Go to Strategic Workbench</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate('/progress')}
                  className="w-full sm:w-auto min-h-[44px] py-3 px-6 rounded-md bg-[#0c1210] hover:bg-[#111a17] text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors text-center cursor-pointer shadow-none"
                >
                  View Progress & Capabilities
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Discard Active Goal Confirmation Modal */}
      <DiscardGoalModal
        isOpen={isDiscardModalOpen}
        goalId={existingActiveGoal?.id}
        goalTitle={existingActiveGoal?.goal_catalog?.title}
        onClose={() => setIsDiscardModalOpen(false)}
        onSuccess={() => {
          setIsDiscardModalOpen(false);
          setExistingActiveGoal(null);
          setIsAdjustingRoutine(false);
        }}
      />
    </div>
  );
};
