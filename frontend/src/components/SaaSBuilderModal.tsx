import React, { useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Cpu,
  Mic,
  Receipt,
  Repeat,
  Clock,
  ShieldAlert,
  Sun,
  Sunset,
  Moon,
  Check
} from 'lucide-react';
import { Goal, RoutineSettings } from '../types';

interface SaaSBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchGoal: (goal: Goal) => void;
}

export interface StarterSaaSPreset {
  id: string;
  name: string;
  tagline: string;
  icon: 'mic' | 'receipt' | 'repeat';
  badge: string;
  inputAsset: string;
  outputAsset: string;
  coreEntities: string[];
  stripeProTier: string;
  description: string;
  scopeCuts: string[];
}

export const STARTER_SAAS_PRESETS: StarterSaaSPreset[] = [
  {
    id: 'audioscribe-ai',
    name: 'AudioScribe AI',
    tagline: 'Voice notes to clean structured action items & summaries',
    icon: 'mic',
    badge: 'AI Audio & Productivity',
    inputAsset: 'Raw voice audio upload (.mp3, .m4a, web microphone)',
    outputAsset: 'Markdown summary, bulleted decision log & action checklist',
    coreEntities: ['User', 'AudioRecording', 'Transcription', 'ActionItem'],
    stripeProTier: '3 free notes/mo -> $19/mo for unlimited notes + export',
    description: 'Transform messy spoken thoughts into crystal-clear executive meeting briefs, project tasks, and searchable personal knowledge.',
    scopeCuts: [
      'CUT: Real-time live speech streaming (v1 uses high-reliability chunked uploads)',
      'CUT: Multi-speaker diarization (postponed to v2 after initial paying users)',
      'FOCUS: Sub-5-second processing speed and razor-sharp formatting accuracy'
    ]
  },
  {
    id: 'micro-invoice-pro',
    name: 'Micro-Invoice Pro',
    tagline: 'Freelance client invoicing, branded PDFs & Stripe payment portal',
    icon: 'receipt',
    badge: 'B2B FinTech Utility',
    inputAsset: 'Client email, billable hours / flat fees & project description',
    outputAsset: 'Branded web invoice with Stripe checkout + downloadable PDF',
    coreEntities: ['User', 'Client', 'Invoice', 'LineItem'],
    stripeProTier: '3 free invoices/mo -> $15/mo for unlimited invoices + custom logo',
    description: 'Dead-simple invoicing for independent contractors who want to get paid in 2 clicks without the bloat of traditional accounting software.',
    scopeCuts: [
      'CUT: Multi-currency automatic conversion (v1 uses standard USD / EUR / GBP)',
      'CUT: Bank account transaction sync (postponed to v2 to avoid Plaid complexity)',
      'FOCUS: Instant 1-click credit card checkout via Stripe and clean PDF generation'
    ]
  },
  {
    id: 'contentforge-repurpose',
    name: 'ContentForge Repurposer',
    tagline: 'Multi-platform viral content engine from a single video or article URL',
    icon: 'repeat',
    badge: 'Creator Economy Engine',
    inputAsset: 'YouTube video URL, podcast link, or blog article URL',
    outputAsset: '5 high-engagement X/Twitter threads, 2 LinkedIn carousels, 1 newsletter',
    coreEntities: ['User', 'SourceUrl', 'RepurposedBatch', 'ContentDraft'],
    stripeProTier: '2 URL conversions/mo -> $29/mo for unlimited + viral hook library',
    description: 'Turn a single piece of long-form thought leadership into a month of cross-platform social media distribution in under 60 seconds.',
    scopeCuts: [
      'CUT: Automated social media API auto-publishing (user copy-pastes in v1 to bypass API approval)',
      'CUT: Video clipping / subtitle burn-in (postponed to v2)',
      'FOCUS: Viral hook generation, tone calibration, and platform-specific markdown formatting'
    ]
  }
];

export const SaaSBuilderModal: React.FC<SaaSBuilderModalProps> = ({
  isOpen,
  onClose,
  onLaunchGoal
}) => {
  const [modalStep, setModalStep] = useState<'choose_idea' | 'architectural_spec' | 'routine_schedule' | 'roadmap_preview'>('choose_idea');

  // Selected preset or custom
  const [selectedPreset, setSelectedPreset] = useState<StarterSaaSPreset | null>(null);
  const [customIdeaText, setCustomIdeaText] = useState('');
  const [isAnalyzingCustom, setIsAnalyzingCustom] = useState(false);

  // Custom diagnostic answers
  const customAnswers: Record<string, string> = {
    deliverable: 'Clean Interactive Web Dashboard + Exportable PDF',
    dataEngine: 'PostgreSQL relational schema with indexed user foreign keys',
    proTrigger: 'Usage limit (e.g. 5 free runs/mo, then $19/mo Unlimited)'
  };

  // Routine state (Defaulting to 60 min/day)
  const [routine, setRoutine] = useState<RoutineSettings>({
    wakeTime: '07:00',
    sleepTime: '23:00',
    busyHours: '09:00 - 17:00',
    preferredSlot: 'morning',
    dailyMinutes: 60, // 60 MINUTE GOLD STANDARD
    planVariant: 'steady'
  });

  if (!isOpen) return null;

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const handleSelectPreset = (preset: StarterSaaSPreset) => {
    setSelectedPreset(preset);
    setModalStep('architectural_spec');
  };

  const handleAnalyzeCustomIdea = () => {
    if (!customIdeaText.trim()) return;
    setIsAnalyzingCustom(true);

    // Simulate CTO architectural interrogation
    setTimeout(() => {
      setIsAnalyzingCustom(false);
      setSelectedPreset({
        id: 'custom-saas',
        name: customIdeaText.slice(0, 24) || 'Custom SaaS Product',
        tagline: customIdeaText.slice(0, 80),
        icon: 'repeat',
        badge: 'Custom Architecture • Next.js 15',
        inputAsset: 'User submitted inputs and parameters',
        outputAsset: 'Tailored computational asset & data deliverable',
        coreEntities: ['User', 'PrimaryWorkspace', 'GeneratedAsset'],
        stripeProTier: 'Free tier limits -> $19/mo Pro tier unlocks unlimited capabilities',
        description: customIdeaText,
        scopeCuts: [
          'CUT: Multi-tenant complex team permissions (kept to single-user authentication for 90-day focus)',
          'CUT: Native mobile apps (web-first responsive architecture built to ship in 60 min/day)',
          'FOCUS: Rock-solid core transformation pipeline and high-converting Stripe billing'
        ]
      });
      setModalStep('architectural_spec');
    }, 750);
  };

  const handleCreateMockGoal = () => {
    const goalTitle = selectedPreset ? `Ship ${selectedPreset.name} (Next.js & TypeScript)` : 'Ship a Production Full-Stack SaaS MVP';
    const nowIso = new Date().toISOString();
    const targetIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
    
    // Mock Goal Creation to instantly verify the UI
    const mockGoal: Goal = {
      id: `saas-${Date.now()}`,
      userId: 'user-1',
      rawGoal: goalTitle,
      clarifiedOutcome: `Build, deploy, and launch ${selectedPreset?.name || 'a full-stack SaaS MVP'} on a custom domain with Stripe billing`,
      methodologyNotes: 'Tracer-Bullet Vertical Slicing (Frontend -> Backend -> DB) with Day 1 Continuous Delivery on Vercel.',
      status: 'active',
      startDate: nowIso,
      targetDate: targetIso,
      currentWeek: 1,
      answers: JSON.stringify(customAnswers),
      routine: JSON.stringify(routine),
      created_at: nowIso,
      updated_at: nowIso,
      roadmapWeeks: [
        {
          id: 'w1',
          goalId: 'g1',
          weekNumber: 1,
          phase: 'Foundation',
          theme: 'The Tracer-Bullet Shell & Live Vercel Deploy',
          objective: 'Deploy a live Next.js 15 app with server action and Postgres write by Day 3.',
          keyMilestone: 'Production URL accessible with end-to-end data roundtrip.',
          targetIntensity: 65,
          plannedMinutes: 60,
          status: 'active',
          created_at: nowIso
        }
      ],
      dailyTasks: [
        {
          id: 't1',
          goalId: 'g1',
          weekNumber: 1,
          dayNumber: 1,
          date: nowIso,
          dayOfWeek: 'Monday',
          title: 'Day 1: Frontend Shell & Live Vercel Production Deploy',
          status: 'pending',
          isRestDay: false,
          durationMinutes: 60,
          slotTime: '07:30 - 08:30',
          implementationIntention: 'When 07:30 at Dev Desk, I will build the hero input and push to production.',
          resourceTitle: 'Next.js App Router & Vercel Git Deploy Guide',
          resourceUrl: 'https://nextjs.org/docs',
          resourceType: 'documentation',
          resourceWhy: 'Learn how to set up continuous deployment so your app is live on Day 1.',
          detailedSteps: JSON.stringify([
            {
              stepNumber: 1,
              title: 'Warmup: Product Spec & 1 Core User Story',
              durationMinutes: 10,
              instructions: 'Define the single primary input form that the user will interact with.',
              focusCue: 'Keep it to 1 input field and 1 primary submit CTA.',
              pitfallToAvoid: 'Do not design a 10-page wireframe. Design only the epicenter.'
            },
            {
              stepNumber: 2,
              title: 'Core Sprint: Next.js 15 Scaffold & Production Deploy',
              durationMinutes: 35,
              instructions: 'Scaffold the App Router repo with Tailwind CSS, push to GitHub, and link to Vercel.',
              focusCue: 'Verify the build passes on Vercel with zero TypeScript warnings.',
              pitfallToAvoid: 'Do not get distracted adding dark mode or custom fonts.'
            },
            {
              stepNumber: 3,
              title: 'Audit & Reflection: Mobile Verification',
              durationMinutes: 15,
              instructions: 'Open your live Vercel URL on your mobile phone and test responsiveness.',
              focusCue: 'Confirm the public URL works globally with SSL.',
              pitfallToAvoid: 'Never leave Day 1 without a live production link.'
            }
          ]),
          created_at: nowIso
        }
      ]
    };

    onLaunchGoal(mockGoal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050807]/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto text-white select-none animate-fadeIn">
      <div className="w-full max-w-4xl bg-[#09100d] border border-[#1a2824] rounded-lg shadow-2xl flex flex-col overflow-hidden my-auto max-h-[92vh]">
        
        {/* =================================================================== */}
        {/* TOP HEADER */}
        {/* =================================================================== */}
        <div className="p-4 sm:p-5 border-b border-[#1a2824] flex items-center justify-between bg-[#0b1410] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-center text-[#07CB6C]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#07CB6C]">
                  SaaS Masterclass Studio
                </span>
                <span className="text-[10px] font-mono text-neutral-400 bg-[#111a17] px-2 py-0.5 rounded border border-[#1a2824]">
                  Next.js 15 • 60 min/day
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
                Ship a Production Full-Stack SaaS MVP
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-[#111a17] border border-transparent hover:border-[#1a2824] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* BODY STAGES */}
        {/* =================================================================== */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-left flex-1">
          
          {/* ----------------------------------------------------------------- */}
          {/* STAGE 1: CHOOSE AN IDEA OR TYPE CUSTOM */}
          {/* ----------------------------------------------------------------- */}
          {modalStep === 'choose_idea' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Choose Your SaaS Product Path
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  Select one of our 3 battle-tested, high-demand starter SaaS templates, or bring your own custom concept.
                </p>
              </div>

              {/* 3 PRESET CARDS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                  <span className="uppercase tracking-wider font-bold text-neutral-300">
                    Option A: Battle-Tested Starter SaaS Presets (Ready to Build)
                  </span>
                  <span className="text-[11px] text-[#07CB6C]">100% Pre-Tuned Specs</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {STARTER_SAAS_PRESETS.map((preset) => {
                    return (
                      <div
                        key={preset.id}
                        className="p-4 rounded-md bg-[#0c1411] border border-[#1a2824] hover:border-[#07CB6C]/60 hover:bg-[#0f1915] transition-all flex flex-col justify-between space-y-3 group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="p-2 rounded bg-[#111d17] text-[#07CB6C] border border-[#07CB6C]/20 group-hover:scale-105 transition-transform">
                              {preset.icon === 'mic' && <Mic className="w-4 h-4" />}
                              {preset.icon === 'receipt' && <Receipt className="w-4 h-4" />}
                              {preset.icon === 'repeat' && <Repeat className="w-4 h-4" />}
                            </span>
                            <span className="text-[9px] font-mono text-neutral-400 bg-[#14201a] px-1.5 py-0.5 rounded border border-[#1f3028]">
                              {preset.badge}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-bold text-white group-hover:text-[#07CB6C] transition-colors leading-snug">
                              {preset.name}
                            </h4>
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                              {preset.tagline}
                            </p>
                          </div>

                          <div className="p-2 rounded bg-[#080d0b] border border-[#16221c] text-[11px] space-y-1 font-mono">
                            <div className="flex items-start gap-1 text-neutral-300">
                              <span className="text-neutral-500">In:</span>
                              <span className="truncate">{preset.inputAsset}</span>
                            </div>
                            <div className="flex items-start gap-1 text-[#07CB6C]">
                              <span className="text-neutral-500">Out:</span>
                              <span className="truncate">{preset.outputAsset}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className="w-full py-2 px-3 rounded bg-[#111c17] hover:bg-[#07CB6C] text-neutral-300 hover:text-black font-semibold text-xs border border-[#1a2824] hover:border-[#07CB6C] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Select This Preset</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DIVIDER */}
              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1a2824]" />
                </div>
                <span className="relative px-3 bg-[#09100d] text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                  Or Bring Your Own Custom SaaS Idea
                </span>
              </div>

              {/* CUSTOM IDEA INPUT */}
              <div className="p-4 sm:p-5 rounded-md bg-[#0b1310] border border-[#1a2824] space-y-3">
                <div className="space-y-1">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-200">
                    Option B: Describe Your SaaS Idea Freely
                  </span>
                  <p className="text-xs text-neutral-400">
                    Tell us what problem it solves, who it's for, and what it does. Our Senior CTO engine will analyze and scope it down to 60 min/day.
                  </p>
                </div>

                <textarea
                  value={customIdeaText}
                  onChange={(e) => setCustomIdeaText(e.target.value)}
                  placeholder="e.g. A web app where real estate agents paste raw property notes and photos, and it automatically generates 10 Instagram caption variations, a flyer PDF, and an MLS description..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-md bg-[#070c09] border border-[#1a2824] focus:border-[#07CB6C] text-white placeholder-neutral-500 text-xs sm:text-sm focus:outline-none transition-colors resize-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!customIdeaText.trim() || isAnalyzingCustom}
                    onClick={handleAnalyzeCustomIdea}
                    className="px-5 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b560] disabled:opacity-40 text-black font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    {isAnalyzingCustom ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                        <span>Diagnosing Architecture...</span>
                      </>
                    ) : (
                      <>
                        <span>Analyze My Idea (CTO Diagnostic)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STAGE 2: CTO ARCHITECTURAL SPEC & SCOPE CUTS */}
          {/* ----------------------------------------------------------------- */}
          {modalStep === 'architectural_spec' && selectedPreset && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#1a2824] pb-3">
                <div>
                  <span className="text-[11px] font-mono text-[#07CB6C] uppercase tracking-wider font-bold">
                    Step 2 • Architectural Verification
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    Verified CTO Architecture Spec
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalStep('choose_idea')}
                  className="text-xs font-mono text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Idea</span>
                </button>
              </div>

              {/* SPEC SHEET CARD */}
              <div className="p-4 sm:p-5 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#16221c] pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase block">Product Name</span>
                    <h4 className="text-base font-bold text-white">{selectedPreset.name}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#07CB6C]/10 text-[#07CB6C] border border-[#07CB6C]/30 text-xs font-mono font-bold">
                    Stack: Next.js 15 • TypeScript • Prisma • Stripe
                  </span>
                </div>

                {/* THE 4 VECTORS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-[#0c1411] border border-[#16221c] space-y-1">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase block">1. Core Input</span>
                    <p className="text-neutral-200 font-medium">{selectedPreset.inputAsset}</p>
                  </div>
                  <div className="p-3 rounded bg-[#0c1411] border border-[#16221c] space-y-1">
                    <span className="text-[10px] font-mono text-[#07CB6C] uppercase block">2. High-Value Output</span>
                    <p className="text-white font-medium">{selectedPreset.outputAsset}</p>
                  </div>
                  <div className="p-3 rounded bg-[#0c1411] border border-[#16221c] space-y-1">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase block">3. Primary DB Entities</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {selectedPreset.coreEntities.map((entity, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-[#111c17] text-neutral-300 font-mono text-[11px] border border-[#1f2f27]">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded bg-[#0c1411] border border-[#16221c] space-y-1">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase block">4. Stripe Pro Tier Gate</span>
                    <p className="text-neutral-200 font-medium">{selectedPreset.stripeProTier}</p>
                  </div>
                </div>

                {/* SCOPE CUTS (CRITICAL FOR SUCCESS) */}
                <div className="p-3.5 rounded bg-[#111512] border border-amber-500/25 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold font-mono uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Mandatory 90-Day Scope Cuts (Enforced to Guarantee 60 Min/Day Delivery)</span>
                  </div>
                  <ul className="space-y-1 text-xs text-neutral-300 list-disc list-inside">
                    {selectedPreset.scopeCuts.map((cut, idx) => (
                      <li key={idx} className="leading-relaxed">{cut}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* NAVIGATION */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setModalStep('choose_idea')}
                  className="px-4 py-2 rounded-md border border-[#1a2824] text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setModalStep('routine_schedule')}
                  className="px-5 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span>Confirm Architecture & Configure Schedule</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STAGE 3: 60-MINUTE ROUTINE SCHEDULE */}
          {/* ----------------------------------------------------------------- */}
          {modalStep === 'routine_schedule' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#1a2824] pb-3">
                <div>
                  <span className="text-[11px] font-mono text-[#07CB6C] uppercase tracking-wider font-bold">
                    Step 3 • Daily Execution Anchoring
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    Configure Your 60-Minute Daily Focus Slot
                  </h3>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-4">
                {/* 60 MINUTE BADGE */}
                <div className="p-3 rounded bg-[#07CB6C]/10 border border-[#07CB6C]/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#07CB6C]" />
                    <span className="text-xs font-mono font-bold text-white">Daily Deliberate Practice Session</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-[#07CB6C] text-black font-mono font-bold text-xs">
                    60 Minutes / Day (Recommended)
                  </span>
                </div>

                {/* PREFERRED FOCUS WINDOW */}
                <div className="space-y-2">
                  <label className="text-xs font-mono text-neutral-400 uppercase tracking-wider block">
                    When do you want your daily 60-minute coding sprint?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'morning', label: 'Morning Deep Work', time: '07:30 - 08:30', icon: Sun },
                      { id: 'afternoon', label: 'Midday Focus', time: '13:00 - 14:00', icon: Sunset },
                      { id: 'evening', label: 'Evening Build Block', time: '19:30 - 20:30', icon: Moon }
                    ].map((slot) => {
                      const IconComponent = slot.icon;
                      const isSelected = routine.preferredSlot === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setRoutine({ ...routine, preferredSlot: slot.id as any })}
                          className={`p-3 rounded-md border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                            isSelected
                              ? 'bg-[#0e1c15] border-[#07CB6C] ring-1 ring-[#07CB6C]/40 text-white'
                              : 'bg-[#0b1310] border-[#1a2824] text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <IconComponent className={`w-4 h-4 ${isSelected ? 'text-[#07CB6C]' : 'text-neutral-500'}`} />
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#07CB6C]" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold block">{slot.label}</span>
                            <span className="text-[11px] font-mono text-neutral-400">{slot.time}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* CIRCADIAN BOUNDARIES */}
                <div className="grid grid-cols-3 gap-2.5 pt-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase">Wake Time</label>
                    <input
                      type="text"
                      value={routine.wakeTime}
                      onChange={(e) => setRoutine({ ...routine, wakeTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0b1410] border border-[#1a2824] text-white font-mono text-xs focus:border-[#07CB6C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase">Busy / Work Hours</label>
                    <input
                      type="text"
                      value={routine.busyHours}
                      onChange={(e) => setRoutine({ ...routine, busyHours: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0b1410] border border-[#1a2824] text-white font-mono text-xs focus:border-[#07CB6C] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase">Sleep Time</label>
                    <input
                      type="text"
                      value={routine.sleepTime}
                      onChange={(e) => setRoutine({ ...routine, sleepTime: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-[#0b1410] border border-[#1a2824] text-white font-mono text-xs focus:border-[#07CB6C] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* NAVIGATION */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setModalStep('architectural_spec')}
                  className="px-4 py-2 rounded-md border border-[#1a2824] text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setModalStep('roadmap_preview')}
                  className="px-5 py-2 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <span>Preview 12-Week Tracer-Bullet Roadmap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* STAGE 4: ROADMAP PREVIEW & LAUNCH */}
          {/* ----------------------------------------------------------------- */}
          {modalStep === 'roadmap_preview' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-[#1a2824] pb-3">
                <div>
                  <span className="text-[11px] font-mono text-[#07CB6C] uppercase tracking-wider font-bold">
                    Step 4 • Final Roadmap Verification
                  </span>
                  <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                    The 90-Day Tracer-Bullet Execution Plan
                  </h3>
                </div>
              </div>

              {/* 3 PHASES OVERVIEW */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-md bg-[#080d0b] border border-[#07CB6C]/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#07CB6C]/10 text-[#07CB6C] font-bold">
                      Phase 1: Foundation
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">Weeks 1 - 4</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">The Epicenter Tracer Bullet</h4>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Deploy live on Day 1. Complete core transformation engine and Postgres data loop by Week 4.
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-amber-400">
                    Gate 1: Live Public CRUD Diagnostic
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold">
                      Phase 2: Acceleration
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">Weeks 5 - 8</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">Monetization & Auth</h4>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Multi-tenant user authentication, Stripe subscription billing, and real-time webhook feature gating.
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-amber-400">
                    Gate 2: Stripe Checkout & Entitlement Benchmark
                  </div>
                </div>

                <div className="p-3.5 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-bold">
                      Phase 3: Mastery
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400">Weeks 9 - 12</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">Hardening & Real Users</h4>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    High-converting landing page, transactional emails, error telemetry, and onboarding first 5 real users.
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-[#07CB6C]">
                    Gate 3: Capstone Launch Audit
                  </div>
                </div>
              </div>

              {/* WEEK 1 DAILY TASKS SNAPSHOT */}
              <div className="p-4 rounded-md bg-[#080d0b] border border-[#1a2824] space-y-2.5">
                <span className="text-xs font-mono uppercase text-neutral-300 font-bold block">
                  Week 1 Daily Sprint Architecture (Tracer Bullet: Frontend → Backend → DB)
                </span>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="p-2 rounded bg-[#0c1411] border border-[#16221c] flex items-center justify-between">
                    <span className="text-white">Day 1: Frontend Shell & Live Vercel Production Deploy</span>
                    <span className="text-[#07CB6C]">60 min</span>
                  </div>
                  <div className="p-2 rounded bg-[#0c1411] border border-[#16221c] flex items-center justify-between">
                    <span className="text-white">Day 2: Server Action Pipeline & Zod Schema Validation</span>
                    <span className="text-[#07CB6C]">60 min</span>
                  </div>
                  <div className="p-2 rounded bg-[#0c1411] border border-[#16221c] flex items-center justify-between">
                    <span className="text-white">Day 3: PostgreSQL Database Wire-Up & Read-After-Write Cycle</span>
                    <span className="text-[#07CB6C]">60 min</span>
                  </div>
                  <div className="p-2 rounded bg-[#0c1411] border border-[#16221c] flex items-center justify-between">
                    <span className="text-white">Day 4: Core Value Engine Algorithm Injection</span>
                    <span className="text-[#07CB6C]">60 min</span>
                  </div>
                  <div className="p-2 rounded bg-[#0c1411] border border-[#16221c] flex items-center justify-between">
                    <span className="text-white">Day 5: Optimistic UI States & Error Boundary Hardening</span>
                    <span className="text-[#07CB6C]">60 min</span>
                  </div>
                </div>
              </div>

              {/* FINAL LAUNCH BUTTON */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setModalStep('routine_schedule')}
                  className="px-4 py-2 rounded-md border border-[#1a2824] text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateMockGoal}
                  className="px-6 py-2.5 rounded-md bg-[#07CB6C] hover:bg-[#06b560] text-black font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg hover:scale-[1.02]"
                >
                  <span>Start 90-Day Execution Journey</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SaaSBuilderModal;
