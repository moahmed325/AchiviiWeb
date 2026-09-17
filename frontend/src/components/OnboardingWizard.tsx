import React, { useState } from 'react';
import {
  Target,
  ArrowRight,
  ArrowLeft,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Check
} from 'lucide-react';
import {
  GoalClarification,
  RoutineSettings,
  CreateGoalResponse,
  Goal
} from '../types';
import { clarifyGoal, createGoalPlan } from '../lib/api';

interface OnboardingWizardProps {
  token: string;
  onGoalCreated: (goal: Goal) => void;
}

const INSPIRATION_GOALS = [
  'Play acoustic guitar well enough to play 5 songs from memory at campfires',
  'Run a 10K under 50 minutes without stopping',
  'Build and ship a full-stack SaaS web app to first paying user',
  'Hold a 15-minute conversational dialogue in Spanish fluently',
  'Master handstand push-ups and bodyweight strength baseline'
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ token, onGoalCreated }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [rawGoal, setRawGoal] = useState('');
  const [isClarifying, setIsClarifying] = useState(false);
  const [clarificationError, setClarificationError] = useState<string | null>(null);

  // Step 2 State
  const [clarification, setClarification] = useState<GoalClarification | null>(null);
  const [editedOutcome, setEditedOutcome] = useState('');
  const [isEditingOutcome, setIsEditingOutcome] = useState(false);

  // Step 3 State (Question Answers)
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  // Step 4 State (Routine)
  const [routine, setRoutine] = useState<RoutineSettings>({
    wakeTime: '07:00',
    sleepTime: '23:00',
    busyHours: '09:00 - 17:00',
    preferredSlot: 'morning',
    dailyMinutes: 30,
    planVariant: 'steady'
  });

  // Step 5 State (Plan Generation)
  const [generationStage, setGenerationStage] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Step 2 disclosure
  const [showMethodologies, setShowMethodologies] = useState(false);

  const generationStages = [
    'Breaking your goal into 3 progressive phases...',
    'Designing your weekly milestones...',
    'Writing your first week of daily sessions...',
    'Personalizing exercises for your level...',
    'Finalizing your schedule...'
  ];

  // --------------------------------------------------------------------------
  // Step 1: Submit Goal for Clarification
  // --------------------------------------------------------------------------
  const handleClarify = async (goalText: string) => {
    const textToUse = goalText || rawGoal;
    if (!textToUse.trim()) return;

    setIsClarifying(true);
    setClarificationError(null);

    try {
      const result = await clarifyGoal(textToUse.trim());
      setClarification(result);
      setEditedOutcome(result.clarifiedOutcome);

      // Pre-seed default answers for questions
      const initialAnswers: Record<string, string> = {};
      result.followUpQuestions.forEach((q) => {
        if (q.options?.length > 0) {
          initialAnswers[q.id] = q.options[0];
        }
      });
      setAnswers(initialAnswers);

      setStep(2);
    } catch (err: any) {
      console.error(err);
      setClarificationError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsClarifying(false);
    }
  };

  // --------------------------------------------------------------------------
  // Step 4: Final Generation Trigger
  // --------------------------------------------------------------------------
  const handleGeneratePlan = async () => {
    setStep(5);
    setGenerationError(null);

    // Progress animation
    const interval = setInterval(() => {
      setGenerationStage((prev) => (prev + 1) % generationStages.length);
    }, 1800);

    try {
      // Merge custom answers
      const finalizedAnswers: Record<string, string> = {};
      clarification?.followUpQuestions.forEach((q) => {
        if (customAnswers[q.id]?.trim()) {
          finalizedAnswers[q.question] = customAnswers[q.id].trim();
        } else {
          finalizedAnswers[q.question] = answers[q.id] || q.options[0] || '';
        }
      });

      const response: CreateGoalResponse = await createGoalPlan(
        {
          rawGoal,
          clarifiedOutcome: editedOutcome || clarification?.clarifiedOutcome || rawGoal,
          answers: finalizedAnswers,
          routine
        },
        token
      );

      clearInterval(interval);
      const fullGoal: Goal = {
        ...response.goal,
        roadmapWeeks: response.roadmapWeeks || response.goal.roadmapWeeks || [],
        dailyTasks: response.dailyTasks || response.goal.dailyTasks || []
      };
      onGoalCreated(fullGoal);
    } catch (err: any) {
      clearInterval(interval);
      console.error(err);
      setGenerationError(err.message || 'Plan generation failed. Please try again.');
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Progress Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
          <span>Step {step} of 5</span>
          <span className="text-[#07CB6C] font-medium">
            {step === 1 && 'Your goal'}
            {step === 2 && 'Refine'}
            {step === 3 && 'Quick questions'}
            {step === 4 && 'Your schedule'}
            {step === 5 && 'Building plan'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#111a17] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#07CB6C] transition-all duration-500 ease-out"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* STEP 1: GOAL INPUT */}
      {/* ===================================================================== */}
      {step === 1 && (
        <div className="space-y-6 animate-fadeInUp">
          <div className="space-y-2 text-left">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              What do you want to achieve?
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Describe your goal and we'll create a personalized daily plan tailored to your life.
            </p>
          </div>

          <div className="space-y-3">
            <textarea
              value={rawGoal}
              onChange={(e) => setRawGoal(e.target.value)}
              placeholder="e.g. Learn acoustic guitar so I can play 5 campfire songs from memory..."
              rows={4}
              className="w-full px-4 py-3.5 rounded-md bg-[#0c1210] border border-[#1a2824] text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C] focus:ring-1 focus:ring-[#07CB6C] transition-all text-sm sm:text-base resize-none"
            />

            {clarificationError && (
              <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md p-2.5">
                {clarificationError}
              </p>
            )}

            {/* Inspiration Chips */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-neutral-500">
                Or try one of these:
              </p>
              <div className="flex flex-wrap gap-2">
                {INSPIRATION_GOALS.map((insp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setRawGoal(insp);
                      handleClarify(insp);
                    }}
                    className="text-xs text-neutral-300 bg-[#0c1210] hover:bg-[#16221e] border border-[#1a2824] hover:border-[#07CB6C]/40 px-3 py-1.5 rounded-md text-left transition-colors cursor-pointer"
                  >
                    {insp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              disabled={!rawGoal.trim() || isClarifying}
              onClick={() => handleClarify(rawGoal)}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-[#07CB6C] hover:bg-[#06b560] disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-semibold text-sm transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isClarifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  <span>Thinking...</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: CLARIFIED OUTCOME CONFIRMATION */}
      {/* ===================================================================== */}
      {step === 2 && clarification && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#07CB6C]/10 border border-[#07CB6C]/25 text-[#07CB6C] text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{clarification.primaryDomain}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Your goal, sharpened
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              A clear goal makes success easier. Here's what we'll work toward.
            </p>
          </div>

          {/* Outcome Card */}
          <div className="p-5 rounded-md bg-[#0c1210] border border-[#07CB6C]/30 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase text-[#07CB6C] tracking-wider">
                What success looks like
              </span>
              <button
                type="button"
                onClick={() => setIsEditingOutcome(!isEditingOutcome)}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingOutcome ? 'Done' : 'Edit'}</span>
              </button>
            </div>

            {isEditingOutcome ? (
              <textarea
                value={editedOutcome}
                onChange={(e) => setEditedOutcome(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[#080d0b] border border-[#1a2824] rounded-md text-white text-sm focus:outline-none focus:border-[#07CB6C]"
              />
            ) : (
              <p className="text-base sm:text-lg font-medium text-white leading-relaxed">
                "{editedOutcome}"
              </p>
            )}

            <div className="pt-2 border-t border-[#1a2824] flex items-center gap-2 text-xs text-neutral-400">
              <AwardIcon className="w-4 h-4 text-[#f59e0b] shrink-0" />
              <span>
                <strong className="text-neutral-200">How you'll know you made it:</strong> {clarification.verificationCriteria}
              </span>
            </div>
          </div>

          {/* Core Capabilities */}
          {clarification.capabilities && clarification.capabilities.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#07CB6C]" />
                <span>Skills you'll build</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {clarification.capabilities.map((cap, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[#0c1210] border border-[#1a2824] text-neutral-200"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#07CB6C]" />
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scientific Frameworks — collapsed by default */}
          {clarification.scientificFrameworks && clarification.scientificFrameworks.length > 0 && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowMethodologies(!showMethodologies)}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>{showMethodologies ? 'Hide' : 'View'} research-backed methods we'll use</span>
                {showMethodologies ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showMethodologies && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                  {clarification.scientificFrameworks.map((framework, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-1.5 text-left"
                    >
                      <div className="font-medium text-xs text-[#07CB6C]">
                        {framework.name}
                      </div>
                      <p className="text-xs text-neutral-300 leading-snug">
                        {framework.description}
                      </p>
                      <p className="text-[11px] text-neutral-500 italic">
                        ↳ {framework.application}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-sm transition-all cursor-pointer"
            >
              <span>Looks good</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: DOMAIN CLARIFYING QUESTIONS */}
      {/* ===================================================================== */}
      {step === 3 && clarification && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              A few quick questions
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              So we can personalize your first week.
            </p>
          </div>

          <div className="space-y-5 animate-stagger">
            {clarification.followUpQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 sm:p-5 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3 animate-fadeInUp"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#16221e] border border-[#07CB6C]/30 text-[#07CB6C] text-xs flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{q.question}</h3>
                  </div>
                  {q.subtitle && (
                    <p className="text-xs text-neutral-400 pl-7">{q.subtitle}</p>
                  )}
                </div>

                <div className="space-y-2 pl-7">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[q.id] === opt && !customAnswers[q.id];
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                          setCustomAnswers((prev) => ({ ...prev, [q.id]: '' }));
                        }}
                        className={`w-full text-left p-3 rounded-md border text-xs sm:text-sm transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#07CB6C]/10 border-[#07CB6C] text-white'
                            : 'bg-[#080d0b] border-[#1a2824] text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#07CB6C]" />}
                      </button>
                    );
                  })}

                  {q.allowCustom && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Or type your own..."
                        value={customAnswers[q.id] || ''}
                        onChange={(e) => {
                          setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }));
                        }}
                        className="w-full px-3 py-2 text-xs bg-[#080d0b] border border-[#1a2824] rounded-md text-white placeholder-neutral-500 focus:outline-none focus:border-[#07CB6C]"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-sm transition-all cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 4: ROUTINE CAPTURE */}
      {/* ===================================================================== */}
      {step === 4 && (
        <div className="space-y-6 text-left animate-fadeInUp">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              When works best for you?
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              We'll schedule sessions around your life so they actually stick.
            </p>
          </div>

          <div className="space-y-4">
            {/* Roadmap Plan Variant Selector */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-medium">
                  How many days per week?
                </label>
                <span className="text-xs text-[#07CB6C] font-medium">
                  {routine.planVariant === 'minimal' && '4 days / week'}
                  {(!routine.planVariant || routine.planVariant === 'steady') && '5 days / week'}
                  {routine.planVariant === 'accelerated' && '6 days / week'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'minimal',
                    title: 'Light',
                    days: '4 days / week',
                    badge: 'Flexible',
                    desc: '4 sessions with 3 rest days. Great if you have a busy schedule.'
                  },
                  {
                    id: 'steady',
                    title: 'Steady',
                    days: '5 days / week',
                    badge: 'Recommended',
                    desc: '5 sessions with 2 rest days. The sweet spot for consistent progress.'
                  },
                  {
                    id: 'accelerated',
                    title: 'Intensive',
                    days: '6 days / week',
                    badge: 'Fast track',
                    desc: '6 sessions with 1 rest day. For when you want to move fast.'
                  }
                ].map((variant) => {
                  const isSelected = (routine.planVariant || 'steady') === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() =>
                        setRoutine((prev) => ({
                          ...prev,
                          planVariant: variant.id as any
                        }))
                      }
                      className={`p-3.5 rounded-md border text-left transition-all cursor-pointer space-y-2 flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#07CB6C]/10 border-[#07CB6C] text-white'
                          : 'bg-[#080d0b] border-[#1a2824] text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">{variant.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                            isSelected
                              ? 'bg-[#07CB6C] text-black font-semibold'
                              : 'bg-[#16221e] text-neutral-400 border border-[#1a2824]'
                          }`}
                        >
                          {variant.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-300 font-mono">{variant.days}</div>
                      <p className="text-[11px] text-neutral-500 leading-snug">{variant.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferred Focus Window */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3">
              <label className="text-xs text-neutral-400 font-medium">
                When's your best focus time?
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'morning', label: 'Morning', icon: Sun, time: '~7:30 AM' },
                  { id: 'afternoon', label: 'Afternoon', icon: Sunset, time: '~2:00 PM' },
                  { id: 'evening', label: 'Evening', icon: Moon, time: '~7:30 PM' }
                ].map((slot) => {
                  const Icon = slot.icon;
                  const isSelected = routine.preferredSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() =>
                        setRoutine((prev) => ({
                          ...prev,
                          preferredSlot: slot.id as any
                        }))
                      }
                      className={`p-3 rounded-md border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#07CB6C]/10 border-[#07CB6C] text-white'
                          : 'bg-[#080d0b] border-[#1a2824] text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 mx-auto mb-1.5 ${
                          isSelected ? 'text-[#07CB6C]' : 'text-neutral-400'
                        }`}
                      />
                      <div className="text-xs font-medium">{slot.label}</div>
                      <div className="text-[10px] text-neutral-500">{slot.time}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Commitment Minutes */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-neutral-400 font-medium">
                  How much time per day?
                </label>
                <span className="text-xs text-[#07CB6C] font-medium">
                  {routine.dailyMinutes} min / day
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[30, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() =>
                      setRoutine((prev) => ({ ...prev, dailyMinutes: mins }))
                    }
                    className={`py-2.5 px-3 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                      routine.dailyMinutes === mins
                        ? 'bg-[#07CB6C] text-black font-semibold border-[#07CB6C]'
                        : 'bg-[#080d0b] border-[#1a2824] text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-neutral-500">
                {routine.dailyMinutes === 30 && 'Great for building a sustainable habit.'}
                {routine.dailyMinutes === 45 && 'A balanced sweet spot for steady progress.'}
                {routine.dailyMinutes >= 60 && 'Intensive — for faster results.'}
              </p>
            </div>

            {/* Schedule Bounds */}
            <div className="p-4 rounded-md bg-[#0c1210] border border-[#1a2824] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-neutral-400 mb-1">Wake time</label>
                <input
                  type="time"
                  value={routine.wakeTime}
                  onChange={(e) =>
                    setRoutine((prev) => ({ ...prev, wakeTime: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 bg-[#080d0b] border border-[#1a2824] rounded-md text-white focus:outline-none focus:border-[#07CB6C]"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Sleep time</label>
                <input
                  type="time"
                  value={routine.sleepTime}
                  onChange={(e) =>
                    setRoutine((prev) => ({ ...prev, sleepTime: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 bg-[#080d0b] border border-[#1a2824] rounded-md text-white focus:outline-none focus:border-[#07CB6C]"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Busy hours</label>
                <input
                  type="text"
                  value={routine.busyHours}
                  onChange={(e) =>
                    setRoutine((prev) => ({ ...prev, busyHours: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 bg-[#080d0b] border border-[#1a2824] rounded-md text-white focus:outline-none focus:border-[#07CB6C]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleGeneratePlan}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-semibold text-sm transition-all cursor-pointer"
            >
              <span>Create My Plan</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: PLAN GENERATION / LOADING */}
      {/* ===================================================================== */}
      {step === 5 && (
        <div className="py-16 text-center space-y-6 animate-fadeInUp">
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[#07CB6C]/20 border-t-[#07CB6C] animate-spin" />
            <Target className="w-8 h-8 text-[#07CB6C] animate-pulse" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Building your plan...
            </h2>
            <p className="text-sm text-[#07CB6C] transition-all duration-300">
              {generationStages[generationStage]}
            </p>
          </div>

          {generationError && (
            <div className="max-w-md mx-auto p-4 rounded-md bg-red-950/40 border border-red-800 text-red-300 text-xs space-y-3">
              <p>{generationError}</p>
              <button
                type="button"
                onClick={handleGeneratePlan}
                className="px-4 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function AwardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

export default OnboardingWizard;
