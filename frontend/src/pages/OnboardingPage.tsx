import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCatalog, fetchGoalById, fetchCurrentUserGoal } from '../lib/api';
import { formalizeGoal, commitGoal } from '../lib/adaptiveApi';
import { updateLifeStructure } from '../lib/lifeApi';
import { getTodayDateString } from '../lib/dateUtils';
import { GoalCatalog, UserGoal } from '../types';
import type {
  GoalDomain,
  DeadlineType,
  GoalFormalizationResult,
} from '../types/adaptive';
import { DiscardGoalModal } from '../components/DiscardGoalModal';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Flame,
  Globe,
  BookOpen,
  Server,
  Heart,
  Check,
  Target,
  Briefcase,
  Sparkles,
  Plus,
  Trash2,
  Car,
  Dumbbell,
  Clock,
} from 'lucide-react';

interface OnboardingQuestionOption {
  label: string;
  value: string;
  description?: string;
  baseline_level?: string;
  recommended_weekly_hours?: number;
}

interface OnboardingQuestion {
  id: string;
  question: string;
  help_text?: string;
  options: OnboardingQuestionOption[];
}

export interface RoutineItem {
  id: string;
  title: string;
  category: 'WORK' | 'HEALTH' | 'FAMILY' | 'COMMUTE' | 'EDUCATION' | 'OTHER';
  startTime: string;
  endTime: string;
  days: string[];
  enabled: boolean;
  isCustom?: boolean;
}

const DEFAULT_ROUTINES: RoutineItem[] = [
  {
    id: 'work',
    title: 'Work / Professional Hours',
    category: 'WORK',
    startTime: '09:00',
    endTime: '17:00',
    days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    enabled: true,
  },
  {
    id: 'lunch',
    title: 'Midday Lunch Break',
    category: 'FAMILY',
    startTime: '12:30',
    endTime: '13:30',
    days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    enabled: true,
  },
  {
    id: 'dinner',
    title: 'Dinner & Family Time',
    category: 'FAMILY',
    startTime: '19:00',
    endTime: '20:00',
    days: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    enabled: true,
  },
  {
    id: 'gym',
    title: 'Workout & Fitness Session',
    category: 'HEALTH',
    startTime: '06:30',
    endTime: '07:30',
    days: ['MON', 'WED', 'FRI'],
    enabled: false,
  },
  {
    id: 'commute',
    title: 'Commute / School Drop-off',
    category: 'COMMUTE',
    startTime: '08:00',
    endTime: '08:45',
    days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    enabled: false,
  },
  {
    id: 'study',
    title: 'Classes / Evening Study',
    category: 'EDUCATION',
    startTime: '18:00',
    endTime: '19:30',
    days: ['TUE', 'THU'],
    enabled: false,
  },
];

const DAYS_OF_WEEK = [
  { id: 'MON', label: 'M' },
  { id: 'TUE', label: 'T' },
  { id: 'WED', label: 'W' },
  { id: 'THU', label: 'T' },
  { id: 'FRI', label: 'F' },
  { id: 'SAT', label: 'S' },
  { id: 'SUN', label: 'S' },
];

export const formatRoutineSummary = (days: string[], startTime: string, endTime: string): string => {
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
  const formattedDays = days.map((d) => dayLabels[d] || d).join(', ');
  return `${formattedDays} • ${timeStr}`;
};

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goalIdParam = searchParams.get('goalId');
  const { user, token, openAuthModal } = useAuth();

  // 4 Steps: 1 = Goal, 2 = Single-Question Walkthrough, 3 = Daily Routine, 4 = Roadmap & Start
  const [step, setStep] = useState<number>(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [existingActiveGoal, setExistingActiveGoal] = useState<UserGoal | null>(null);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);

  // Catalog State
  const [allGoals, setAllGoals] = useState<GoalCatalog[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<GoalCatalog | null>(null);

  // Step 2 Questionnaire State
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string>>({});

  // Step 3 Life Structure & Routine State
  const [wakeTime, setWakeTime] = useState<string>('07:00');
  const [sleepTime, setSleepTime] = useState<string>('23:00');
  const [scheduleReliability, setScheduleReliability] = useState<'HIGH' | 'MODERATE' | 'FLEXIBLE'>('HIGH');
  const [routines, setRoutines] = useState<RoutineItem[]>(DEFAULT_ROUTINES);

  // Custom Routine Creator State
  const [isAddingCustom, setIsAddingCustom] = useState<boolean>(false);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<RoutineItem['category']>('OTHER');
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('09:00');
  const [customDays, setCustomDays] = useState<string[]>(['MON', 'TUE', 'WED', 'THU', 'FRI']);

  // Formalization State
  const [outcomeStatement, setOutcomeStatement] = useState<string>('');
  const [domain, setDomain] = useState<GoalDomain>('PHYSICAL');
  const deadlineType: DeadlineType = 'SOFT';
  const [weeklyAvailableHours, setWeeklyAvailableHours] = useState<number>(6);
  const [startDate] = useState<string>(() => getTodayDateString());
  const [formalizationResult, setFormalizationResult] = useState<GoalFormalizationResult | null>(null);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const catalog = await fetchCatalog();
        setAllGoals(catalog);

        let initialSelected: GoalCatalog | null = null;

        if (token) {
          try {
            const currentGoalData = await fetchCurrentUserGoal(token);
            if (currentGoalData.user_goal) {
              setExistingActiveGoal(currentGoalData.user_goal);
            }
          } catch {
            // Non-blocking
          }
        }

        if (goalIdParam) {
          try {
            initialSelected = await fetchGoalById(goalIdParam);
          } catch {
            initialSelected = catalog.find((g) => g.id === goalIdParam) || null;
          }
        }

        if (!initialSelected && catalog.length > 0) {
          initialSelected = catalog[0];
        }

        if (initialSelected) {
          setSelectedGoal(initialSelected);
          setOutcomeStatement(initialSelected.title);
          setWeeklyAvailableHours(initialSelected.est_weekly_hours || 6);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load catalog.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [token, goalIdParam]);

  // Parse questions from selected blueprint
  const parsedQuestions: OnboardingQuestion[] = useMemo(() => {
    if (!selectedGoal?.onboarding_questions) return [];
    try {
      const raw = selectedGoal.onboarding_questions;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
  }, [selectedGoal]);

  const currentQuestion: OnboardingQuestion | undefined = parsedQuestions[currentQuestionIndex];
  const isCurrentQuestionAnswered = Boolean(currentQuestion && questionnaireAnswers[currentQuestion.id]);

  // Goal Icon helper
  const getGoalIcon = (iconName?: string) => {
    switch (iconName?.toLowerCase()) {
      case 'server':
      case 'code':
        return <Server className="w-5 h-5 text-[#07CB6C]" />;
      case 'flame':
      case 'dumbbell':
        return <Flame className="w-5 h-5 text-amber-400" />;
      case 'globe':
      case 'languages':
        return <Globe className="w-5 h-5 text-sky-400" />;
      case 'book':
      case 'writing':
        return <BookOpen className="w-5 h-5 text-purple-400" />;
      case 'heart':
      case 'wellness':
        return <Heart className="w-5 h-5 text-rose-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-[#07CB6C]" />;
    }
  };

  const getCategoryIcon = (category: RoutineItem['category']) => {
    switch (category) {
      case 'WORK':
        return <Briefcase className="w-3.5 h-3.5 text-neutral-400" />;
      case 'HEALTH':
        return <Dumbbell className="w-3.5 h-3.5 text-emerald-400" />;
      case 'FAMILY':
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case 'COMMUTE':
        return <Car className="w-3.5 h-3.5 text-amber-400" />;
      case 'EDUCATION':
        return <BookOpen className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-neutral-400" />;
    }
  };

  const formatRoutineSummary = (days: string[], start: string, end: string) => {
    let dayStr = '';
    if (days.length === 7) dayStr = 'Every day';
    else if (days.length === 5 && !days.includes('SAT') && !days.includes('SUN')) dayStr = 'Weekdays';
    else if (days.length === 2 && days.includes('SAT') && days.includes('SUN')) dayStr = 'Weekends';
    else dayStr = days.map((d) => d.slice(0, 1) + d.slice(1, 3).toLowerCase()).join(', ');
    return `${dayStr} • ${start}–${end}`;
  };

  // Step 1: Select Goal
  const handleSelectGoal = (goal: GoalCatalog) => {
    if (existingActiveGoal) {
      setIsDiscardModalOpen(true);
      return;
    }
    setSelectedGoal(goal);
    setOutcomeStatement(goal.title);
    setWeeklyAvailableHours(goal.est_weekly_hours || 6);

    const goalDomain: GoalDomain =
      goal.category === 'Health & Fitness'
        ? 'PHYSICAL'
        : goal.category === 'Technology' || goal.category === 'Writing & Creative'
        ? 'PROJECT'
        : 'COGNITIVE';
    setDomain(goalDomain);

    setCurrentQuestionIndex(0);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Step 2: Answer question
  const handleAnswerQuestion = (questionId: string, value: string) => {
    setQuestionnaireAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  // Step 2 Question Navigation
  const handlePrevQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setStep(1);
    }
  }, [currentQuestionIndex]);

  const handleContinueToRoutines = useCallback(() => {
    for (const q of parsedQuestions) {
      const chosenVal = questionnaireAnswers[q.id];
      const opt = q.options.find((o) => o.value === chosenVal);
      if (opt?.recommended_weekly_hours) {
        setWeeklyAvailableHours(opt.recommended_weekly_hours);
      }
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [parsedQuestions, questionnaireAnswers]);

  const handleNextQuestion = useCallback(() => {
    if (!isCurrentQuestionAnswered) return;
    if (currentQuestionIndex < parsedQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleContinueToRoutines();
    }
  }, [isCurrentQuestionAnswered, currentQuestionIndex, parsedQuestions.length, handleContinueToRoutines]);

  // Keyboard navigation for question walkthrough
  useEffect(() => {
    if (step !== 2 || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        handlePrevQuestion();
      } else if ((e.key === 'ArrowRight' || e.key === 'Enter') && isCurrentQuestionAnswered) {
        handleNextQuestion();
      } else {
        const num = parseInt(e.key);
        if (!isNaN(num) && num >= 1 && num <= currentQuestion.options.length) {
          handleAnswerQuestion(currentQuestion.id, currentQuestion.options[num - 1].value);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, currentQuestion, isCurrentQuestionAnswered, handlePrevQuestion, handleNextQuestion]);

  // Routine Handlers
  const toggleRoutine = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const updateRoutineTime = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const toggleRoutineDay = (routineId: string, day: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id !== routineId) return r;
        const hasDay = r.days.includes(day);
        const newDays = hasDay ? r.days.filter((d) => d !== day) : [...r.days, day];
        return { ...r, days: newDays };
      })
    );
  };

  const removeRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddCustomRoutine = () => {
    if (!customTitle.trim()) return;
    const newRoutine: RoutineItem = {
      id: `custom_${Date.now()}`,
      title: customTitle.trim(),
      category: customCategory,
      startTime: customStartTime,
      endTime: customEndTime,
      days: customDays.length > 0 ? customDays : ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      enabled: true,
      isCustom: true,
    };
    setRoutines((prev) => [...prev, newRoutine]);
    setCustomTitle('');
    setIsAddingCustom(false);
  };

  const toggleCustomDay = (day: string) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Step 3 -> Step 4
  const handleGeneratePlan = async () => {
    if (!user || !token) {
      openAuthModal('signup');
      return;
    }
    if (!selectedGoal) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await formalizeGoal(token, {
        rawGoal: outcomeStatement.trim() || selectedGoal.title,
        domain,
        deadlineType,
        weeklyAvailableHours,
      });
      setFormalizationResult(res.formalization);

      // Map enabled routines to routine_blocks
      const enabledRoutines = routines.filter((r) => r.enabled);
      const routineBlocks = enabledRoutines.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        days_of_week: r.days,
        start_time: r.startTime,
        end_time: r.endTime,
        is_hard_constraint: true,
        buffer_before_minutes: 15,
        buffer_after_minutes: 15,
      }));

      await updateLifeStructure(token, {
        wake_time: wakeTime,
        sleep_time: sleepTime,
        schedule_reliability: scheduleReliability,
        buffer_minutes: 15,
        routine_blocks: routineBlocks,
      });

      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Failed to prepare your plan.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4 -> Final Commit
  const handleCommitPlan = async () => {
    if (!token || !selectedGoal) return;

    setSubmitting(true);
    setError(null);
    try {
      const enabledRoutines = routines.filter((r) => r.enabled);
      const availabilitySlots: any[] = [];
      for (const r of enabledRoutines) {
        for (const d of r.days) {
          availabilitySlots.push({
            day_of_week: d,
            start_time: r.startTime,
            end_time: r.endTime,
            label: r.title,
          });
        }
      }

      await commitGoal(token, {
        goalCatalogId: selectedGoal.id,
        outcomeStatement: outcomeStatement.trim() || formalizationResult?.concreteOutcomeStatement || selectedGoal.title,
        verificationCriteria: formalizationResult?.verificationCriteria || 'Demonstrate unassisted real-world benchmark.',
        deadlineType,
        domain,
        startDate: new Date(startDate).toISOString(),
        sustainableWeeklyHours: weeklyAvailableHours,
        availabilitySlots,
        questionnaireAnswers,
      });

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to activate your plan.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b09] flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-[#07CB6C] animate-spin" />
          <span className="text-xs font-mono text-neutral-400">Loading catalog...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b09] text-white flex flex-col selection:bg-[#07CB6C]/30">
      {/* ─── Minimalist Header ─── */}
      <header className="border-b border-white/5 bg-[#070b09]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-[#07CB6C]/40 flex items-center justify-center">
              <Target className="w-4 h-4 text-[#07CB6C]" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">Achivii</span>
          </Link>

          {/* Stepper Dots */}
          <div className="flex items-center gap-3">
            {[
              { num: 1, label: 'Goal' },
              { num: 2, label: 'Questions' },
              { num: 3, label: 'Routine' },
              { num: 4, label: 'Plan' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-1.5">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                    step === s.num
                      ? 'bg-[#07CB6C] text-black ring-2 ring-[#07CB6C]/30'
                      : step > s.num
                      ? 'bg-white/10 text-[#07CB6C]'
                      : 'bg-white/5 text-neutral-500'
                  }`}
                >
                  {step > s.num ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                </div>
                <span className={`text-xs hidden sm:inline ${step === s.num ? 'text-white font-medium' : 'text-neutral-500'}`}>
                  {s.label}
                </span>
                {s.num < 4 && <div className="w-3 h-px bg-white/10 mx-0.5 hidden sm:block" />}
              </div>
            ))}
          </div>

          <div className="text-xs font-mono text-neutral-500">
            {step} / 4
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 ${step === 2 ? 'max-w-5xl py-6 sm:py-10 flex flex-col justify-center' : 'max-w-3xl py-8 sm:py-12'}`}>
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-3 max-w-3xl mx-auto">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200">{error}</div>
          </div>
        )}

        {/* ─── STEP 1: CHOOSE AMBITION ─── */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="space-y-1.5 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Choose Your 90-Day Ambition
              </h1>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-xl">
                Select what you want to achieve. We’ll tailor a daily plan that fits around your real schedule with zero catch-up debt.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {allGoals.map((goal) => {
                const isSelected = selectedGoal?.id === goal.id;
                return (
                  <div
                    key={goal.id}
                    onClick={() => handleSelectGoal(goal)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-[#0d1612] border-[#07CB6C]/60 shadow-[0_0_25px_rgba(7,203,108,0.12)]'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          {getGoalIcon(goal.icon)}
                        </div>
                        <span className="text-xs font-mono text-neutral-400">
                          {goal.est_weekly_hours}h / week
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-white group-hover:text-[#07CB6C] transition-colors">
                          {goal.title}
                        </h3>
                        <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                          {goal.description}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-neutral-500">
                        {goal.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-[#07CB6C] group-hover:translate-x-0.5 transition-transform">
                        <span>Select</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── STEP 2: FULL-PAGE QUESTION WALKTHROUGH WITH SIDE CONTROLS ─── */}
        {step === 2 && selectedGoal && currentQuestion && (
          <div className="w-full space-y-8 animate-in fade-in duration-200">
            {/* Top Progress & Hints */}
            <div className="max-w-2xl w-full mx-auto space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                <span className="text-[#07CB6C] font-semibold">
                  Question {currentQuestionIndex + 1} of {parsedQuestions.length}
                </span>
                <span className="text-neutral-500 hidden sm:inline">
                  Press 1–{currentQuestion.options.length} or use keyboard arrows
                </span>
              </div>

              {/* Progress Line */}
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#07CB6C] transition-all duration-300 rounded-full"
                  style={{ width: `${((currentQuestionIndex + 1) / parsedQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* ─── The Main Question Stage with Side Navigation ─── */}
            <div className="relative flex items-center justify-between gap-4 sm:gap-8 min-h-[380px]">
              {/* LEFT: Previous / Back Button */}
              <button
                type="button"
                onClick={handlePrevQuestion}
                className="group shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-neutral-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
                title={currentQuestionIndex === 0 ? 'Back to Goals (←)' : 'Previous Question (←)'}
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              {/* CENTER: Dedicated Question Card */}
              <div className="flex-1 max-w-xl mx-auto space-y-6 text-center sm:text-left">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-neutral-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                    <span>{selectedGoal.title}</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug">
                    {currentQuestion.question}
                  </h2>

                  {currentQuestion.help_text && (
                    <p className="text-xs sm:text-sm text-neutral-400">
                      {currentQuestion.help_text}
                    </p>
                  )}
                </div>

                {/* Vertical Tactile Options */}
                <div className="space-y-3 pt-2">
                  {currentQuestion.options.map((opt, optIdx) => {
                    const isChosen = questionnaireAnswers[currentQuestion.id] === opt.value;
                    const keyNumber = optIdx + 1;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleAnswerQuestion(currentQuestion.id, opt.value)}
                        className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-4 active:scale-[0.99] ${
                          isChosen
                            ? 'bg-[#0d1612] border-[#07CB6C] text-white shadow-[0_0_20px_rgba(7,203,108,0.15)] ring-1 ring-[#07CB6C]/40'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04] text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 border transition-colors ${
                              isChosen
                                ? 'bg-[#07CB6C] text-black border-[#07CB6C]'
                                : 'bg-white/5 text-neutral-400 border-white/10'
                            }`}
                          >
                            {keyNumber}
                          </div>

                          <div className="space-y-0.5">
                            <div className={`text-sm font-semibold ${isChosen ? 'text-white' : 'text-neutral-200'}`}>
                              {opt.label}
                            </div>
                            {opt.description && (
                              <p className="text-xs text-neutral-400 leading-relaxed">
                                {opt.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isChosen ? (
                            <div className="w-5 h-5 rounded-full bg-[#07CB6C] text-black flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-white/10" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Next / Forward Button */}
              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={!isCurrentQuestionAnswered}
                className={`group shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
                  isCurrentQuestionAnswered
                    ? 'bg-[#07CB6C] text-black hover:bg-[#07CB6C]/90 shadow-[0_0_25px_rgba(7,203,108,0.3)]'
                    : 'bg-white/5 text-neutral-600 border border-white/5 cursor-not-allowed opacity-40'
                }`}
                title={currentQuestionIndex === parsedQuestions.length - 1 ? 'Continue to Routine (→)' : 'Next Question (→)'}
              >
                <ChevronRight className={`w-5 h-5 sm:w-6 sm:h-6 ${isCurrentQuestionAnswered ? 'group-hover:translate-x-0.5' : ''} transition-transform`} />
              </button>
            </div>

            {/* Mobile Bottom Navigation Pill */}
            <div className="flex sm:hidden items-center justify-between pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={handlePrevQuestion}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 text-xs text-neutral-300 font-mono cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{currentQuestionIndex === 0 ? 'Goal' : 'Back'}</span>
              </button>

              <button
                type="button"
                onClick={handleNextQuestion}
                disabled={!isCurrentQuestionAnswered}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-xl font-semibold text-xs cursor-pointer ${
                  isCurrentQuestionAnswered
                    ? 'bg-[#07CB6C] text-black'
                    : 'bg-white/5 text-neutral-500 cursor-not-allowed'
                }`}
              >
                <span>{currentQuestionIndex === parsedQuestions.length - 1 ? 'Routine' : 'Next'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: DAILY ROUTINE & COMMITMENTS CANVAS ─── */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 text-xs font-mono text-neutral-400 hover:text-white transition-colors mb-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Questions</span>
              </button>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Map Your Daily Routine
              </h1>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Tell us your waking boundaries and existing commitments. We’ll protect them so your ambition fits naturally without stress.
              </p>
            </div>

            {/* Waking & Sleep Time Card */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Waking & Sleep Boundaries
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <label className="text-xs font-mono text-neutral-400 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>Typical Wake Time</span>
                  </label>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-[#07CB6C] outline-none"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                  <label className="text-xs font-mono text-neutral-400 flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Target Sleep Time</span>
                  </label>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(e) => setSleepTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-[#07CB6C] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Fixed Daily Commitments List with Smart Presets */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Fixed Commitments
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Toggle routines that apply to you or add custom blocks.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingCustom((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#07CB6C] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Block</span>
                </button>
              </div>

              {/* Inline Custom Commitment Creator */}
              {isAddingCustom && (
                <div className="p-4 rounded-xl bg-[#0e1613] border border-[#07CB6C]/40 space-y-3.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">New Commitment</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustom(false)}
                      className="text-neutral-500 hover:text-white text-xs font-mono"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-neutral-400">Title</label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="e.g., Morning Meditation, Violin, Daycare"
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-neutral-400">Category</label>
                      <select
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0e1613] border border-white/10 text-xs text-white focus:outline-none focus:border-[#07CB6C]"
                      >
                        <option value="WORK">Work</option>
                        <option value="HEALTH">Health & Fitness</option>
                        <option value="FAMILY">Family & Home</option>
                        <option value="COMMUTE">Commute</option>
                        <option value="EDUCATION">Education / Study</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Time & Days */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
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

                    {/* Day Selector Pills */}
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

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddCustomRoutine}
                      disabled={!customTitle.trim()}
                      className="px-4 py-1.5 rounded-lg bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Add Commitment
                    </button>
                  </div>
                </div>
              )}

              {/* List of Routines */}
              <div className="space-y-2.5">
                {routines.map((routine) =>
                  !routine.enabled ? (
                    // Inactive Routine: Clean, low-noise 1-line row
                    <div
                      key={routine.id}
                      onClick={() => toggleRoutine(routine.id)}
                      className="px-4 py-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 select-none min-w-0">
                        <input
                          type="checkbox"
                          id={`toggle-${routine.id}`}
                          checked={false}
                          onChange={() => toggleRoutine(routine.id)}
                          className="w-4 h-4 accent-[#07CB6C] rounded cursor-pointer shrink-0 opacity-40 group-hover:opacity-70"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-neutral-500 group-hover:text-neutral-300 transition-colors">
                            {getCategoryIcon(routine.category)}
                          </span>
                          <span className="text-xs font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors truncate">
                            {routine.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-mono text-neutral-500 group-hover:text-neutral-400 transition-colors">
                          {formatRoutineSummary(routine.days, routine.startTime, routine.endTime)}
                        </span>
                        {routine.isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRoutine(routine.id);
                            }}
                            className="p-1 text-neutral-600 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove Commitment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Active Routine: Expanded interactive card with Day Selector Pills & Time Inputs
                    <div
                      key={routine.id}
                      className="p-4 rounded-xl border border-[#07CB6C]/30 bg-white/[0.03] shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 select-none">
                        <input
                          type="checkbox"
                          id={`toggle-${routine.id}`}
                          checked={true}
                          onChange={() => toggleRoutine(routine.id)}
                          className="w-4 h-4 accent-[#07CB6C] rounded cursor-pointer mt-1"
                        />
                        <div className="space-y-2">
                          <label
                            htmlFor={`toggle-${routine.id}`}
                            className="text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                          >
                            <span className="text-[#07CB6C]">{getCategoryIcon(routine.category)}</span>
                            <span>{routine.title}</span>
                          </label>

                          {/* Interactive Day Selector Pills */}
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
                                      ? 'bg-[#07CB6C] text-black shadow-sm font-bold'
                                      : 'bg-white/5 text-neutral-500 hover:text-white hover:bg-white/10'
                                  }`}
                                  title={`${d.id}: Click to toggle`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Time editors & delete button */}
                      <div className="flex items-center gap-2.5 ml-7 md:ml-0 self-end md:self-center">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-neutral-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
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
                          className="p-1.5 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remove Commitment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Schedule Predictability */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
              <h3 className="text-sm font-semibold text-white">
                How predictable is your typical week?
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'HIGH', label: 'Consistent', desc: 'Predictable hours, rare overruns' },
                  { id: 'MODERATE', label: 'Moderate', desc: 'Occasional late meetings or family friction' },
                  { id: 'FLEXIBLE', label: 'Dynamic', desc: 'Frequently shifting schedule' },
                ].map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => setScheduleReliability(rel.id as any)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      scheduleReliability === rel.id
                        ? 'bg-[#0d1612] border-[#07CB6C]/60 text-white'
                        : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-semibold block">{rel.label}</span>
                    <span className="text-[10px] text-neutral-500 mt-0.5 block">{rel.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Plan...</span>
                  </>
                ) : (
                  <>
                    <span>See My 90-Day Plan</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: 90-DAY PLAN PREVIEW & START ─── */}
        {step === 4 && selectedGoal && (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Your 90-Day Roadmap Is Ready
              </h1>
              <p className="text-sm text-neutral-400">
                Here is how your ambition fits into your life over the next 12 weeks.
              </p>
            </div>

            {/* Clean Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-xs text-neutral-500 font-mono">Weekly Commitment</span>
                <div className="text-lg font-bold text-white font-mono">
                  {weeklyAvailableHours} hours / wk
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                <span className="text-xs text-neutral-500 font-mono">Daily Session</span>
                <div className="text-lg font-bold text-[#07CB6C] font-mono">
                  45 – 60 min
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1 col-span-2 sm:col-span-1">
                <span className="text-xs text-neutral-500 font-mono">Runway</span>
                <div className="text-lg font-bold text-white font-mono">
                  12 Weeks (90 Days)
                </div>
              </div>
            </div>

            {/* 3 Phases Preview */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                The 3 Milestones
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-[#07CB6C]/10 text-[#07CB6C] flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Weeks 1–4: Foundation & Habit Anchor</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Build daily consistency and establish baseline capability without burnout.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Weeks 5–8: Volume, Pacing & Core Execution</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Deepen focus, tackle primary bottlenecks, and accelerate sustained output.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Weeks 9–12: Integration, Polish & Capstone Delivery</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Synthesize capabilities, complete the final real-world benchmark, and cross the finish line.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Humane No-Debt Reassurance Callout */}
            <div className="p-4 rounded-2xl bg-[#07CB6C]/5 border border-[#07CB6C]/20 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-[#07CB6C] shrink-0 mt-0.5" />
              <div className="text-xs text-neutral-300 leading-relaxed">
                <span className="font-semibold text-white">Guaranteed Zero Backlog Debt: </span>
                If life gets in the way or you miss a session, your plan adapts smoothly. We will never double tomorrow’s work or guilt-trip you.
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-mono text-neutral-300 transition-colors cursor-pointer"
              >
                Back to Routine
              </button>

              <button
                type="button"
                onClick={handleCommitPlan}
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#07CB6C] hover:bg-[#07CB6C]/90 text-black font-semibold text-xs shadow-[0_0_25px_rgba(7,203,108,0.25)] transition-all cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Activating Plan...</span>
                  </>
                ) : (
                  <>
                    <span>Start My 90 Days</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Discard / Reset Active Goal Confirmation */}
      {existingActiveGoal && (
        <DiscardGoalModal
          isOpen={isDiscardModalOpen}
          goalTitle={existingActiveGoal.goal_catalog?.title || existingActiveGoal.outcome_statement}
          onClose={() => setIsDiscardModalOpen(false)}
          onSuccess={() => {
            setIsDiscardModalOpen(false);
            setExistingActiveGoal(null);
            setStep(1);
          }}
        />
      )}
    </div>
  );
};

export default OnboardingPage;
