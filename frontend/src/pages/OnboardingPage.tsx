import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCatalog, fetchGoalById, submitOnboarding, fetchCurrentUserGoal, generateRoadmaps, selectRoadmap, fetchRoadmaps } from '../lib/api';
import { getLocalDateString, getTodayDateString } from '../lib/dateUtils';
import { GoalCatalog, DayOfWeek, AvailabilitySlot, Roadmap } from '../types';
import { RoadmapSelector } from '../components/RoadmapSelector';
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Sun, 
  ShieldCheck, 
  Sparkles, 
  Loader2, 
  AlertCircle,
  Rocket,
  Flame,
  Globe,
  BookOpen,
  Server,
  Heart,
  Check,
  RotateCcw
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

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goalIdParam = searchParams.get('goalId');
  const modeParam = searchParams.get('mode');
  const { user, token, openAuthModal } = useAuth();

  // 2-Step Architecture: 1 = Choose Goal, 2 = Learn About You & Verify, 3 = Generation Success
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdjustingRoutine, setIsAdjustingRoutine] = useState<boolean>(false);

  // Data State
  const [allGoals, setAllGoals] = useState<GoalCatalog[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedGoal, setSelectedGoal] = useState<GoalCatalog | null>(null);

  // Questionnaire Answers
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard_9_5');
  const [saturdayMode, setSaturdayMode] = useState<'FREE' | 'MORNING' | 'FULL_DAY'>('FREE');
  const [startDate, setStartDate] = useState<string>(() => getTodayDateString());
  const [quickDateOption, setQuickDateOption] = useState<'TODAY' | 'NEXT_MONDAY' | 'CUSTOM'>('TODAY');

  // Busy Blocks State (Initialized with standard 9-5)
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
  const [generatedSessionCount, setGeneratedSessionCount] = useState<number>(60);

  // Phase 4: Roadmap Selection State
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const catalog = await fetchCatalog();
        setAllGoals(catalog);

        let initialSelected: GoalCatalog | null = null;

        // Check for existing active goal and pre-populate saved routine if returning
        if (token) {
          try {
            const currentGoalData = await fetchCurrentUserGoal(token);
            if (currentGoalData.user_goal) {
              const activeCatalogId = currentGoalData.user_goal.goal_catalog_id;
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

              // Direct entry into Step 2 when adjusting routine for active goal
              const shouldAdjust = modeParam === 'adjust' || (goalIdParam ? goalIdParam === activeCatalogId : true);
              if (shouldAdjust) {
                setIsAdjustingRoutine(true);
                setStep(2);
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
      case 'rocket': return <Rocket className="w-5 h-5 text-indigo-400" />;
      case 'flame': return <Flame className="w-5 h-5 text-rose-400" />;
      case 'globe': return <Globe className="w-5 h-5 text-sky-400" />;
      case 'bookopen': return <BookOpen className="w-5 h-5 text-amber-400" />;
      case 'server': return <Server className="w-5 h-5 text-emerald-400" />;
      case 'heart': return <Heart className="w-5 h-5 text-pink-400" />;
      default: return <Sparkles className="w-5 h-5 text-purple-400" />;
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
      alert('End time must be after start time.');
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

  // Submit onboarding routine and transition to AI Roadmap selection
  const handleProceedToRoadmaps = async () => {
    if (!user || !token) {
      openAuthModal('signup');
      return;
    }
    if (!selectedGoal) {
      alert('Please select a goal first.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await submitOnboarding(token, {
        goal_catalog_id: selectedGoal.id,
        start_date: new Date(startDate).toISOString(),
        availability_slots: availabilitySlots,
      });

      const userGoalId = res.user_goal?.id;

      // Generate or retrieve roadmap variants for this goal
      let variants: Roadmap[] = [];
      try {
        const genRes = await generateRoadmaps(token, userGoalId);
        variants = genRes.roadmaps || [];
      } catch (genErr) {
        const listRes = await fetchRoadmaps(token);
        variants = listRes.roadmaps || [];
      }

      setRoadmaps(variants);
      if (variants.length > 0) {
        setSelectedRoadmapId(res.user_goal?.selected_roadmap_id || variants[0].id);
      }
      setStep(3); // Transition to RoadmapSelector
    } catch (err: any) {
      setError(err.message || 'Failed to initialize pacing roadmaps.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm chosen roadmap, modulate schedule, and land on celebration
  const handleConfirmRoadmapAndGenerate = async () => {
    if (!token || !selectedRoadmapId) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await selectRoadmap(token, selectedRoadmapId);
      if (res.session_count) {
        setGeneratedSessionCount(res.session_count);
      }
      setStep(4); // Celebration screen
    } catch (err: any) {
      setError(err.message || 'Failed to select roadmap and modulate schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate timeline
  const targetEndDate = new Date(new Date(startDate).getTime() + 12 * 7 * 24 * 60 * 60 * 1000);
  const formattedEndDate = isNaN(targetEndDate.getTime())
    ? '—'
    : targetEndDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Calculate approximate free hours per week
  const busyMinutesPerWeek = availabilitySlots.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    return sum + (eh * 60 + em - (sh * 60 + sm));
  }, 0);
  // Total operating window per week ~98 hours (15h weekdays * 5 + 13.5h Sat + 13h Sun)
  const estimatedFreeHours = Math.max(0, Math.round(98 - busyMinutesPerWeek / 60));

  const filteredGoals = allGoals.filter((g) => {
    if (selectedCategory === 'All') return true;
    return g.category.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm">Configuring your onboarding experience...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[160px] pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">Achivii</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
              {isAdjustingRoutine ? 'Adjust Routine' : 'Goal Onboarding'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-8">
        {/* 3-Step Architecture Indicator */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 sm:gap-6 text-xs">
            <div
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 cursor-pointer transition-colors ${
                step === 1 ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                1
              </div>
              <span>Step 1: Goal</span>
            </div>

            <div className="w-6 sm:w-10 h-px bg-slate-800" />

            <div
              onClick={() => selectedGoal && setStep(2)}
              className={`flex items-center gap-2 cursor-pointer transition-colors ${
                step === 2 ? 'text-indigo-400 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                2
              </div>
              <span>Step 2: Routine</span>
            </div>

            <div className="w-6 sm:w-10 h-px bg-slate-800" />

            <div
              onClick={() => roadmaps.length > 0 && setStep(3)}
              className={`flex items-center gap-2 transition-colors ${
                roadmaps.length > 0 ? 'cursor-pointer hover:text-slate-300' : 'cursor-not-allowed opacity-50'
              } ${step === 3 ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 3 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                3
              </div>
              <span>Step 3: Roadmap</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-xs animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Adjust Routine Notice */}
        {isAdjustingRoutine && step === 1 && (
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs text-indigo-300">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                <strong>Adjust Routine Mode:</strong> Your active goal is pre-selected. Click continue to tweak your routine questions.
              </span>
            </div>
            <button
              onClick={() => setStep(2)}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-xs transition-colors shrink-0 cursor-pointer"
            >
              Skip to Routine Questions →
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 1: CHOOSE YOUR GOAL */}
        {/* ========================================================= */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-white">Choose Your 3-Month Goal</h1>
              <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
                Select your curated 12-week blueprint. Each goal is pre-scoped into 3 sequential phases with deterministic time-blocking.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full font-medium transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
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
                    onClick={() => setSelectedGoal(goal)}
                    className={`p-5 rounded-2xl cursor-pointer transition-all border relative flex flex-col justify-between ${
                      isSelected
                        ? 'glass-panel border-indigo-500/80 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-600/10'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                            {getGoalIcon(goal.icon)}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                            {goal.category}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
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
                        12 Weeks (3 Phases)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

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
                onClick={() => setStep(2)}
                disabled={!selectedGoal}
                className="py-3 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>Continue to Step 2: Learn About You</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: LEARN ABOUT YOU QUESTIONNAIRE & VERIFY ROUTINE */}
        {/* ========================================================= */}
        {step === 2 && selectedGoal && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header with Selected Goal Pill or Adjust Routine Banner */}
            {isAdjustingRoutine ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        Adjusting Routine
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Active Plan
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white">{selectedGoal.title}</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Completed sessions and streaks are strictly preserved. Upcoming sessions will re-align to your new hours.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustingRoutine(false);
                    setStep(1);
                  }}
                  className="text-xs text-indigo-300 hover:text-white underline underline-offset-4 self-start sm:self-auto cursor-pointer shrink-0"
                >
                  Switch to a different goal
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    {getGoalIcon(selectedGoal.icon)}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      Target Goal
                    </span>
                    <div className="font-bold text-sm text-white">{selectedGoal.title}</div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-white underline self-start sm:self-auto cursor-pointer"
                >
                  Change Goal
                </button>
              </div>
            )}

            <div className="text-center space-y-1.5">
              <h2 className="text-3xl font-black text-white">
                {isAdjustingRoutine ? 'Adjust Your Weekly Availability' : "Let's Learn About Your Weekly Routine"}
              </h2>
              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                {isAdjustingRoutine
                  ? 'Update your routine hours, busy blocks, or start date below. When verified, your upcoming schedule will re-align automatically.'
                  : 'Answer 3 quick questions below. We will calculate your schedule, let you verify your busy blocks, and then auto-generate all 12 weeks.'}
              </p>
            </div>

            {/* ---------------- KICKOFF DATE (NEW GOAL ONLY) OR TIMELINE SUMMARY (ACTIVE GOAL) ---------------- */}
            {isAdjustingRoutine ? (
              <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
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
                    <span className="text-slate-500 text-[10px] block">Roadmap Span</span>
                    <span className="text-slate-300 font-bold">12 Weeks (84 Days)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Question 1: When do you want to kick off?</span>
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    Finish: {formattedEndDate}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectQuickDate('TODAY')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      quickDateOption === 'TODAY'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Today (Immediate Start)</div>
                    <div className={`text-[11px] mt-0.5 font-mono ${quickDateOption === 'TODAY' ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectQuickDate('NEXT_MONDAY')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      quickDateOption === 'NEXT_MONDAY'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">Next Monday</div>
                    <div className={`text-[11px] mt-0.5 font-mono ${quickDateOption === 'NEXT_MONDAY' ? 'text-indigo-100' : 'text-slate-400'}`}>
                      Clean Week Kickoff
                    </div>
                  </button>

                  <div
                    onClick={() => setQuickDateOption('CUSTOM')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-center cursor-pointer ${
                      quickDateOption === 'CUSTOM'
                        ? 'bg-indigo-950/40 border-indigo-500/80 ring-1 ring-indigo-500/30'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
                      Custom Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setQuickDateOption('CUSTOM');
                        setStartDate(e.target.value);
                      }}
                      className="w-full bg-transparent text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- QUESTION: TYPICAL WEEKDAY (MON–FRI) ---------------- */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>
                  {isAdjustingRoutine
                    ? 'Question 1: What does your updated weekday (Mon–Fri) routine look like?'
                    : 'Question 2: What does your typical weekday (Mon–Fri) look like?'}
                </span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {WEEKDAY_PRESETS.slice(0, 3).map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectWeekdayPreset(preset)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{preset.icon}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {preset.badge}
                          </span>
                        </div>
                        <div className="font-bold text-xs">{preset.title}</div>
                      </div>
                      <div className={`text-[11px] font-mono mt-2 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
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
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{preset.icon}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {preset.badge}
                          </span>
                        </div>
                        <div className="font-bold text-xs">{preset.title}</div>
                      </div>
                      <div className={`text-[11px] font-mono mt-2 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {preset.timeStr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ---------------- QUESTION: SATURDAY OBLIGATIONS ---------------- */}
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>
                    {isAdjustingRoutine
                      ? 'Question 2: What is your Saturday availability?'
                      : 'Question 3: Do you have work or commitments on Saturdays?'}
                  </span>
                </span>
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <span>Sunday is always 100% free buffer</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectSaturdayMode('FREE')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    saturdayMode === 'FREE'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Saturdays 100% Free</div>
                  <div className={`text-[11px] mt-0.5 ${saturdayMode === 'FREE' ? 'text-emerald-100' : 'text-slate-400'}`}>
                    Recommended for overflow recovery
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSaturdayMode('MORNING')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    saturdayMode === 'MORNING'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Saturday Morning Busy</div>
                  <div className={`text-[11px] mt-0.5 font-mono ${saturdayMode === 'MORNING' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Busy 09:00 – 13:00
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSaturdayMode('FULL_DAY')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    saturdayMode === 'FULL_DAY'
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">Saturday Full Day Busy</div>
                  <div className={`text-[11px] mt-0.5 font-mono ${saturdayMode === 'FULL_DAY' ? 'text-indigo-100' : 'text-slate-400'}`}>
                    Busy 09:00 – 17:00
                  </div>
                </button>
              </div>
            </div>

            {/* ---------------- SECTION B: VERIFY YOUR BUSY BLOCKS BEFOREHAND ---------------- */}
            <div className="glass-panel p-6 rounded-2xl border-2 border-indigo-500/50 space-y-4 shadow-xl bg-slate-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-bold text-white">
                      Verify Your Weekly Busy Blocks (Before Generating)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Achivii will block out these times and schedule your goal sessions in your open windows.
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
                      <span>Entire day is marked free. Goal sessions can be scheduled anytime from 07:00 to 22:00.</span>
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

            {/* ---------------- ACTION BAR: AUTO-GENERATE / SAVE ---------------- */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
              {isAdjustingRoutine ? (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors cursor-pointer"
                >
                  ← Cancel & Return to Dashboard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors cursor-pointer"
                >
                  ← Back to Choose Goal
                </button>
              )}

              <button
                id="btn-confirm-onboarding"
                type="button"
                onClick={handleProceedToRoadmaps}
                disabled={submitting}
                className="w-full sm:w-auto py-3.5 px-8 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-sm font-bold shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing Routine & Generating Roadmaps...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{isAdjustingRoutine ? 'Update Routine & Pacing Roadmaps' : 'Next: Choose Pacing Roadmap'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: CHOOSE PACING ROADMAP (AI LAYER) */}
        {/* ========================================================= */}
        {step === 3 && (
          <RoadmapSelector
            roadmaps={roadmaps}
            selectedRoadmapId={selectedRoadmapId}
            onSelectRoadmap={(roadmap) => setSelectedRoadmapId(roadmap.id)}
            onConfirm={handleConfirmRoadmapAndGenerate}
            onBack={() => setStep(2)}
            isSubmitting={submitting}
            error={error}
          />
        )}

        {/* ========================================================= */}
        {/* STEP 4: CELEBRATION & LIVE CALENDAR LANDING */}
        {/* ========================================================= */}
        {step === 4 && selectedGoal && (
          <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-indigo-500/40 text-center space-y-6 max-w-2xl mx-auto animate-in zoom-in-95 duration-300 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 mx-auto shadow-xl shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAdjustingRoutine ? 'Schedule Re-Aligned Live' : '3-Month Schedule Generated Live'}</span>
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white">
                {isAdjustingRoutine ? 'Routine Updated Successfully! ⚡' : 'Your Goal is Officially Locked In!'}
              </h2>
              <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                {isAdjustingRoutine ? (
                  <>
                    We updated your availability for <strong className="text-white">"{selectedGoal.title}"</strong>.
                    All completed sessions remain intact, and upcoming sessions were re-aligned to fit your new free hours.
                  </>
                ) : (
                  <>
                    We mapped <strong className="text-white">"{selectedGoal.title}"</strong> to your verified routine and auto-generated{' '}
                    <strong className="text-emerald-400">{generatedSessionCount} time-blocked sessions</strong> across all 12 weeks.
                  </>
                )}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-2 gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 block mb-1">Kickoff Start</span>
                <span className="text-white font-bold">{startDate}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Target Graduation</span>
                <span className="text-emerald-400 font-bold">{formattedEndDate}</span>
              </div>
            </div>

            {/* Direct Navigation */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Return to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate('/calendar')}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-colors text-center cursor-pointer"
              >
                View Live Calendar
              </button>

              <button
                onClick={() => navigate('/progress')}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-purple-200 border border-purple-500/30 text-xs font-semibold transition-colors text-center cursor-pointer"
              >
                View Progress & Milestones
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
