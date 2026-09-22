import { CertifiedPresetBlueprint } from './types.js';

export const deepWorkPreset: CertifiedPresetBlueprint = {
  id: 'deep_work_focus',
  matchingPatterns: [
    /\bdeep\s*work\b/i,
    /\b(unbroken|daily)\s+focus\b/i,
    /\bdouble\s+(my\s+|daily\s+)?output\b/i,
    /\bdistraction[-\s]?free\b/i,
    /\bflow\s+state\b/i,
    /\bcognitive\s+output\b/i,
    /\bscreen\s*time\b/i,
  ],
  title: 'Master Deep Work & Double Daily Cognitive Output',
  primaryDomain: 'Cognitive Performance & Deep Work Mastery',
  clarifiedOutcome:
    'Eliminate digital distractions, master 4 hours of daily unbroken deep work, and double high-leverage cognitive output',
  badge: 'Certified Cognitive Architecture · Cal Newport Deep Work & Andrew Huberman Protocols',
  capabilities: [
    'Time-Block Planning & First Physical Step Framing',
    '90-Minute Ultradian Focus Cycles & Visual Gaze Anchoring',
    'Attention Residue Elimination & Strict Communication Windows',
    'The Vocalized Daily Shutdown Ritual & Cognitive Restoration',
    'Deep Work Tracking & Output Multiplier Auditing'
  ],
  scientificFrameworks: [
    {
      name: "Cal Newport's Deep Work & Law of Productivity",
      description:
        'High-Quality Work Produced = (Time Spent) x (Intensity of Focus). Splitting attention by briefly checking notifications leaves "attention residue" that impairs cognitive capacity for up to 20 minutes.',
      application:
        'Enforces zero-tab-hopping, airplane-mode deep work blocks with an absolute ban on in-session communication checks, capped at a biologically sustainable 4-hour daily ceiling.'
    },
    {
      name: "Dr. Andrew Huberman's Ultradian Rhythms & Dopamine Reset Architecture",
      description:
        'The human brain cycles through 90-minute ultradian rhythms of optimal alertness and focus. Aligning demanding cognitive work with these natural biological cycles maximizes dopamine, acetylcholine, and neural plasticity.',
      application:
        'Structures deep work into dedicated 90-minute blocks separated by 20-minute cognitive rests (NSDR / walking) and eliminates cheap dopamine micro-rewards (social media, notifications).'
    },
    {
      name: "Mihaly Csikszentmihalyi's Flow State & Cognitive Calibration",
      description:
        'Flow occurs when the perceived challenge of a task precisely matches the actor’s highest level of skill. Ambiguous instructions provoke anxiety; trivial busywork provokes boredom.',
      application:
        'Requires defining the atomic "First Physical Step" for every deep work block during the previous evening’s shutdown ritual, eliminating friction upon session initiation.'
    }
  ],
  verificationCriteria:
    'Maintain an audited 4.0 hours of daily unbroken deep work across a full 10-day sprint with zero in-session communication checks, verified 50% drop in phone screen time, and completion of a major strategic project deliverable in half historical time.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current daily unbroken focus baseline?',
      subtitle: 'Calibrates your initial block duration, weekly hour targets, and distraction quarantine protocols.',
      options: [
        'Scattered Multitasker (Struggle to work 30 minutes without checking phone, email, or browser tabs)',
        'Novice Deep Worker (Can focus for 60 minutes, but frequently interrupted by Slack and notifications)',
        'Structured Professional (Consistent 2-hour daily focus block, but hit a ceiling due to meeting sprawl)',
        'Advanced Knowledge Worker (Seeking the elite 4-hour daily deep work ceiling on high-stakes intellectual output)'
      ],
      allowCustom: true
    },
    {
      id: 'primary_distractor',
      question: 'What is your primary distraction vulnerability during focus blocks?',
      subtitle: 'Installs tailored behavioral friction and digital firewall rules.',
      options: [
        'Immediate response syndrome (Compulsive reflex to answer Slack, Teams, or emails instantly)',
        'Smartphone urge checking (Subconscious muscle memory reaching for phone during difficult cognitive friction)',
        'Ambiguous task scope (Procrastinating because the next step of a project is ill-defined)',
        'Afternoon fatigue & brain fog (Circadian energy crash at 2:00 PM leading to low-value busywork)'
      ],
      allowCustom: true
    },
    {
      id: 'work_environment',
      question: 'What is your primary professional work environment?',
      subtitle: 'Calibrates asynchronous communication boundaries and meeting batching strategies.',
      options: [
        'Autonomous remote worker / freelancer (High schedule autonomy; danger of procrastination)',
        'Hybrid corporate office (Frequent unplanned interruptions, shoulder taps, and scheduled meeting clusters)',
        'Founder / Entrepreneur (High cognitive load juggling high-level strategy with urgent daily firefighting)',
        'Student / Researcher / Developer (Preparing for high-stakes exams, technical architecture, or code sprints)'
      ],
      allowCustom: true
    }
  ],
  deepWorkVelocityTable: [
    {
      baselineKey: 'scattered_multitasker',
      label: 'Scattered Multitasker',
      dailyDeepWorkHours: 2.0,
      blockLengthMins: 45,
      screenTimeReductionTarget: 30,
      weeklyOutputMultiplier: '1.5x output',
      guidance: 'Start with two 45-minute blocks separated by a 15-minute walk; phone placed in another room with airplane mode enabled.'
    },
    {
      baselineKey: 'novice_deep_worker',
      label: 'Novice Deep Worker',
      dailyDeepWorkHours: 2.5,
      blockLengthMins: 60,
      screenTimeReductionTarget: 40,
      weeklyOutputMultiplier: '1.7x output',
      guidance: 'Lock in a sacred 90-minute morning deep block before opening your email client or communication hubs.'
    },
    {
      baselineKey: 'structured_professional',
      label: 'Structured Professional',
      dailyDeepWorkHours: 3.5,
      blockLengthMins: 90,
      screenTimeReductionTarget: 50,
      weeklyOutputMultiplier: '2.0x output',
      guidance: 'Batch all meetings and communication into a dedicated 2-hour afternoon window (2:00 PM–4:00 PM).'
    },
    {
      baselineKey: 'advanced_focus',
      label: 'Advanced Knowledge Worker',
      dailyDeepWorkHours: 4.0,
      blockLengthMins: 90,
      screenTimeReductionTarget: 60,
      weeklyOutputMultiplier: '2.5x output',
      guidance: 'Execute dual 90-minute morning blocks plus a 60-minute afternoon sprint; enforce absolute digital minimalism.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Digital perimeter lockdown, physical distraction notepad, establishing 2-hour daily deep blocks, and mastering the daily shutdown ritual.',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Foundation Milestone Gate: 2.0 Hours Daily Deep Block & Shutdown Discipline',
      milestoneCriteria:
        'Log 10 consecutive workdays with ≥2.0 hours of verified unbroken deep work, zero in-session phone checks, and a ≥90% execution rate on the vocalized daily shutdown ritual.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: '90-minute ultradian cycles, asynchronous communication batching (2x daily checks), and reaching a sustained 3.5-hour daily deep baseline.',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Acceleration Milestone Gate: 3.5 Hours Focus Benchmark & Digital Diet Lock',
      milestoneCriteria:
        'Achieve a sustained 3.5 hours/day deep work average across 2 consecutive weeks, verify a ≥40% reduction in smartphone screen time, and deliver a complex project milestone in half historical time.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'The 4-hour daily deep work ceiling, monk-mode project sprints, doubling high-leverage cognitive output, and capstone project delivery.',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: 4-Hour Focus Mastery & Output Doubling Verification',
      milestoneCriteria:
        'Complete a 10-day sprint averaging 4.0 hours of audited deep work per day with zero attention residue, a 50%+ reduction in screen time, and completion of a major Capstone deliverable.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Digital Perimeter Lockdown & Time-Block Architecture',
      objective: 'Install website blockers, establish the distraction notepad habit, and execute a daily 60-minute unbroken morning deep work block.',
      keyMilestone: 'Zero in-session phone checks logged across 5 consecutive days; 60m daily deep block logged.',
      targetIntensity: 60,
      workoutArchetypes: []
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: The Sacred Morning Block & 90-Minute Expansion',
      objective: 'Expand morning focus block to 90 minutes; protect the first 90 minutes of the workday from all email and messaging.',
      keyMilestone: '90-minute unbroken morning block executed on 4 of 5 workdays without opening Slack/email.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: The Vocalized Shutdown Ritual & Evening Boundaries',
      objective: 'Institute the formal end-of-day shutdown ritual ("Shutdown Complete") to banish work-related rumination and evening stress.',
      keyMilestone: 'Daily shutdown ritual executed at exact scheduled time 5 days in a row; zero evening work checks.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Foundation Milestone Audit & 2.0-Hour Lock',
      objective: 'Solidify 2.0 hours of daily deep work; pass the Phase 1 Foundation Milestone Gate.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: 2.0 Hours Daily Deep Block & Shutdown Discipline',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Asynchronous Batching & Communication Windows',
      objective: 'Constrain communication (Slack, email) to two 30-minute windows (11:30 AM and 4:30 PM); eliminate real-time notification alerts.',
      keyMilestone: 'Zero push notifications on desktop or mobile; email checked strictly twice per day.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Dual Ultradian Blocks (90m Morning + 60m Midday)',
      objective: 'Introduce a second focused block in the midday; reach 2.5–3.0 hours of cumulative daily deep work.',
      keyMilestone: 'Dual blocks executed on 4 days; high-priority backlog cleared by 30%.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Circadian Energy Optimization & NSDR Resets',
      objective: 'Integrate a 10-minute Non-Sleep Deep Rest (NSDR) session at 1:30 PM to eliminate the afternoon slump and fuel block 2.',
      keyMilestone: 'Zero afternoon energy crashes; block 2 productivity matches morning block output.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Acceleration Milestone Gate & 3.5-Hour Benchmark',
      objective: 'Execute 3.5 hours of daily deep work across the week; pass the Phase 2 Acceleration Milestone Gate.',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: 3.5 Hours Focus Benchmark & Digital Diet Lock',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: The 4-Hour Biological Ceiling & Flow Calibration',
      objective: 'Push to the maximum human cognitive limit: 4.0 hours of deep work (two 90m blocks + one 60m block).',
      keyMilestone: '4.0 hours of deep work logged with zero tab hopping; output velocity reaches 2x baseline.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Monk-Mode Project Sprint (High-Stakes Deliverable)',
      objective: 'Channel 4 hours of daily deep focus into a single high-leverage strategic project or intellectual asset.',
      keyMilestone: 'Major project milestone delivered 5 days ahead of historical schedule.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Digital Minimalism & Social Media Fast',
      objective: 'Execute a 7-day complete social media and algorithmic feed fast; monitor baseline attention span and mental clarity.',
      keyMilestone: 'Smartphone screen time drops below 90 minutes/day; focus stamina feels effortless.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Capstone Focus Mastery & Sustainable Routine Audit',
      objective: 'Complete the 10-day 4-hour deep work sprint; conduct output post-mortem; lock in permanent quarterly operating rhythm.',
      keyMilestone: 'Phase 3 Mastery Capstone: 4-Hour Focus Mastery & Output Doubling Verification',
      targetIntensity: 95,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `
================================================================================
EXPERT COGNITIVE PERFORMANCE & DEEP WORK ARCHITECT CONTEXT
================================================================================
You are Cal Newport (Deep Work) and Dr. Andrew Huberman coaching a knowledge worker to achieve cognitive flow.
Core Non-Negotiable Rules:
1. THE ATTENTION RESIDUE LAW:
   Checking an inbox, Slack channel, or phone for even 5 seconds destroys cognitive focus for up to 20 minutes due to attention residue. During a deep work block, all communication channels must be fully closed or blocked.
2. THE 4-HOUR BIOLOGICAL CEILING:
   The human brain cannot sustain more than 4 hours of true, high-intensity deliberate cognitive focus per day. Strive for depth and intensity, not 12-hour exhausted desk sitting.
3. THE PHYSICAL DISTRACTION NOTEPAD:
   When an urge to check something arises (e.g. 'I wonder who won the match', 'Need to buy toothpaste'), never switch tabs. Write it down on a physical pad beside the keyboard and continue working.
4. THE VOCALIZED SHUTDOWN RITUAL:
   End every workday with a structured review of tomorrow's schedule and say aloud: 'Shutdown complete.' This signals the brain's default mode network to disengage and restore.
================================================================================
`,
  evidenceTriad: {
    science: {
      title: "Attention Residue & Cognitive Switching Penalty",
      subtitle: "Dr. Sophie Leroy & Cal Newport",
      tag: "Cognitive Science",
      coreRule: "Every switch between tasks leaves a lingering cognitive shadow that degrades analytical depth.",
      realWorldApplication:
        "Knowledge workers block off dedicated 90-minute windows in airplane mode; batching tasks prevents fragmented multitasking."
    },
    socialAdherence: {
      title: "The Distraction Notepad & Urge Surfing",
      subtitle: "Dr. Andrew Huberman & Dr. Judson Brewer",
      tag: "Behavioral Guardrail",
      coreRule: "Do not suppress distraction urges; externalize them onto physical paper to satisfy the brain.",
      realWorldApplication:
        "A physical notepad beside the keyboard captures intrusive thoughts, keeping the digital workspace pristine."
    },
    proCoaching: {
      title: "The Vocalized Shutdown Protocol",
      subtitle: "Cal Newport & Mihaly Csikszentmihalyi",
      tag: "Mental Boundary",
      coreRule: "Without a clean boundary, work anxiety bleeds into evenings and erodes next-day cognitive capacity.",
      realWorldApplication:
        "At the end of the workday, reviewing the plan and declaring 'Shutdown complete' terminates work rumination."
    }
  }
};

// Populate Week 1 workout archetypes
deepWorkPreset.weeks[0].workoutArchetypes = [
  {
    workoutType: 'perimeter_lockdown',
    title: 'Focus Setup: Digital Perimeter Lockdown & Time-Block Architecture',
    focus: 'Configuring website blockers (Cold Turkey/Freedom), placing phone in another room, and planning tomorrow’s time blocks.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Digital Firewall & Distraction Blocking',
        durationRatio: 0.35,
        instructions:
          'Install or configure website blockers (e.g. Cold Turkey, Freedom, or browser blockers). Add news sites, social media, and algorithmic feeds to the blacklist during your focus hours. Turn off all desktop notifications.',
        focusCue: 'Create an environment where succumbing to distraction requires extreme physical effort.',
        pitfallToAvoid: 'Relying on willpower instead of strict digital barriers.',
        layer: 'safety',
        layerReasoning:
          'Research demonstrates that self-control is a finite resource that depletes rapidly under cognitive strain.'
      },
      {
        stepNumber: 2,
        title: 'The Time-Block Grid & First Physical Step Definition',
        durationRatio: 0.4,
        instructions:
          'Map your entire workday into distinct 30-to-60 minute blocks on paper or calendar. For your primary deep work block, define the exact "First Physical Step" (e.g. "Open index.ts and write function calculateScore").',
        focusCue: 'Eliminate all ambiguity about what you will do the second you sit down.',
        pitfallToAvoid: 'Leaving blocks labeled with vague goals like "work on project".',
        layer: 'mechanism',
        layerReasoning:
          'Defining concrete physical actions bypasses the amygdala’s resistance to ambiguous or overwhelming tasks.'
      },
      {
        stepNumber: 3,
        title: 'The Physical Distraction Notepad Setup',
        durationRatio: 0.25,
        instructions:
          'Place a blank physical notepad and pen on your desk directly next to your keyboard. Label the top: "Distraction Log - To Process Later". Commit to recording every random impulse here instead of opening a tab.',
        focusCue: 'Write the urge, park it on paper, and immediately return eyes to the primary document.',
        pitfallToAvoid: 'Opening "just one quick browser tab" to check a minor question.',
        layer: 'adherence',
        layerReasoning:
          'Writing an urge down on paper provides immediate psychological closure without disrupting digital focus.'
      }
    ]
  },
  {
    workoutType: 'deep_block_60',
    title: 'Deep Execution: 60-Minute Airplane-Mode Focus Block',
    focus: 'Executing a strict 60-minute unbroken cognitive sprint on your #1 priority with zero communication checks.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Visual Gaze Anchoring & 60s Priming',
        durationRatio: 0.15,
        instructions:
          'Set a 60-minute countdown timer. Focus your visual gaze on a single crosshair or word on your screen for 60 seconds without blinking or shifting eyes. Notice your alertness increase.',
        focusCue: 'Where your visual focus goes, cognitive focus follows.',
        pitfallToAvoid: 'Starting the timer while email or communication windows are still visible in the background.',
        layer: 'mechanism',
        layerReasoning:
          'Huberman neuroscience research shows visual vergence (tightening visual field) directly triggers acetylcholine release in the frontal cortex.'
      },
      {
        stepNumber: 2,
        title: '60-Minute Unbroken Deep Sprint',
        durationRatio: 0.7,
        instructions:
          'Engage with your single highest-priority project in fullscreen mode. Do not leave the document. When friction or difficulty arises, stay with the discomfort for 2 minutes rather than escaping to an easy task.',
        focusCue: 'Lean into the cognitive friction; that resistance is where neural adaptations occur.',
        pitfallToAvoid: 'Bailing on the session after 20 minutes because the problem feels hard.',
        layer: 'mechanism',
        layerReasoning:
          'Pushing through the initial 15-minute resistance threshold is the prerequisite for entering flow state.'
      },
      {
        stepNumber: 3,
        title: 'Session Debrief & Tally Logging',
        durationRatio: 0.15,
        instructions:
          'When the timer rings, stop immediately. Log your completed 60 minutes into your deep work tracker. Review your distraction notepad and discard trivial urges.',
        focusCue: 'Celebrate 60 minutes of pure, unbroken cognitive craftsmanship.',
        pitfallToAvoid: 'Immediately binging on social media as a "reward", which spikes dopamine and impairs retention.',
        layer: 'adherence',
        layerReasoning:
          'Tracking cumulative deep work hours builds a strong psychological identity as an elite cognitive producer.'
      }
    ]
  },
  {
    workoutType: 'asynch_batch',
    title: 'Workflow Optimization: Attention Residue Audit & Communication Batching',
    focus: 'Consolidating communication into two 30-minute windows and auditing attention leaks.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Asynchronous Window 1: Processing Inbox (30m)',
        durationRatio: 0.5,
        instructions:
          'Open your email and Slack. Process messages using the 2-minute rule: if it takes <2 minutes, execute immediately; if longer, convert it to a scheduled task. Clear unread counters to zero.',
        focusCue: 'Process messages rapidly like a sorting machine; do not let conversations linger.',
        pitfallToAvoid: 'Leaving email open in the background while trying to think deeply.',
        layer: 'adherence',
        layerReasoning:
          'Strict batching confines communication overhead into a predictable time box, freeing the remainder of the day.'
      },
      {
        stepNumber: 2,
        title: 'Attention Leak Audit & Friction Review',
        durationRatio: 0.3,
        instructions:
          'Review where your attention drifted over the last 48 hours. Identify which specific app or tab caused the most switching penalty. Add it to your blocker rules.',
        focusCue: 'Be honest about your micro-escapes.',
        pitfallToAvoid: 'Rationalizing checking news or messages as "necessary research".',
        layer: 'safety',
        layerReasoning:
          'Auditing attention leaks prevents insidious habit creep from eroding newly established boundaries.'
      },
      {
        stepNumber: 3,
        title: 'Midday Cognitive Reset Walk (10m)',
        durationRatio: 0.2,
        instructions:
          'Take a 10-minute walk outdoors with your phone in your pocket. Look at distant horizons to relax the ciliary muscles of your eyes.',
        focusCue: 'Engage panoramic vision; let your eyes take in the entire visual field.',
        pitfallToAvoid: 'Looking at your phone screen during your walk.',
        layer: 'mechanism',
        layerReasoning:
          'Panoramic vision downregulates sympathetic nervous system arousal and resets cognitive endurance.'
      }
    ]
  },
  {
    workoutType: 'nsdr_reset',
    title: 'Circadian Recharge: Mid-Afternoon Reset & 90-Minute Ultradian Block',
    focus: 'Using a 10-minute NSDR (Non-Sleep Deep Rest) to conquer the 2:00 PM dip, followed by a 90m deep work block.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: '10-Minute NSDR / Yoga Nidra Protocol',
        durationRatio: 0.2,
        instructions:
          'Lie down or sit back in a chair with eyes closed. Listen to a 10-minute NSDR guided audio track (or practice cyclic physiological sighing). Allow your body to achieve deep physical relaxation while retaining light awareness.',
        focusCue: 'Completely release muscle tension in your jaw, shoulders, and forehead on long exhalations.',
        pitfallToAvoid: 'Turning to caffeine or sugary snacks to overcome mid-afternoon lethargy.',
        layer: 'mechanism',
        layerReasoning:
          'Neuroscience research demonstrates that a 10-minute NSDR protocol restores striatal dopamine reserves and boosts memory consolidation by up to 30%.'
      },
      {
        stepNumber: 2,
        title: 'The 90-Minute Ultradian Sprint',
        durationRatio: 0.65,
        instructions:
          'Transition immediately from NSDR into your 90-minute focus block. Tackle your second major project milestone. Work with calm, sustained momentum without interruption.',
        focusCue: 'Ride the wave of post-NSDR mental clarity; maintain steady rhythm.',
        pitfallToAvoid: 'Checking incoming messages right after waking from NSDR.',
        layer: 'safety',
        layerReasoning:
          'Channeling post-rest alpha and theta brainwave states into creative synthesis produces superior structural insights.'
      },
      {
        stepNumber: 3,
        title: 'Block Debrief & Tracker Update',
        durationRatio: 0.15,
        instructions:
          'Record your 90 minutes. You have now logged 2.5+ hours of deep work today. Verify that primary deliverables are in the project folder.',
        focusCue: 'Recognize that 2.5 hours of true deep work outperforms 8 hours of distracted busywork.',
        pitfallToAvoid: 'Discounting your progress because the total hours seemed short.',
        layer: 'adherence',
        layerReasoning:
          'Cal Newport’s productivity studies prove 3 hours of deep work generates more high-value output than an entire day of semi-distracted effort.'
      }
    ]
  },
  {
    workoutType: 'shutdown_ritual',
    title: 'Mental Boundary: The Vocalized Daily Shutdown Ritual',
    focus: 'Conducting final email sweep, updating tomorrow’s time block plan, and declaring "Shutdown Complete".',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Final 20-Minute Communication Sweep',
        durationRatio: 0.35,
        instructions:
          'Perform your second and final communication check of the day. Answer urgent inquiries, confirm tomorrow’s calendar events, and close all communication apps.',
        focusCue: 'Process cleanly; do not initiate new open-ended conversations at the end of the day.',
        pitfallToAvoid: 'Leaving email open on your second monitor until late in the evening.',
        layer: 'adherence',
        layerReasoning:
          'A defined communication cutoff prevents open conversational loops from intruding into evening recovery.'
      },
      {
        stepNumber: 2,
        title: 'Tomorrow’s Time-Block Plan & First Action Lock',
        durationRatio: 0.45,
        instructions:
          'Open your paper notebook. Schedule tomorrow’s blocks. Identify the single critical output that must be achieved. Write down the exact first sentence or line of code you will start with.',
        focusCue: 'Leave zero decisions for tomorrow morning; let your future self wake up to a clear plan.',
        pitfallToAvoid: 'Going to sleep without knowing what your first 90 minutes tomorrow looks like.',
        layer: 'safety',
        layerReasoning:
          'Pre-planning eliminates morning decision fatigue, protecting dopamine and willpower for high-leverage execution.'
      },
      {
        stepNumber: 3,
        title: 'The "Shutdown Complete" Vocal Declaration',
        durationRatio: 0.2,
        instructions:
          'Shut down your computer or lock your screen. Look at your workspace, take a breath, and say out loud: "Shutdown complete." Step away from the desk; do not open work applications until tomorrow.',
        focusCue: 'Say the words with finality; trust your system to hold your tasks.',
        pitfallToAvoid: 'Sneaking a peek at work Slack from your phone on the couch.',
        layer: 'mechanism',
        layerReasoning:
          'The Zeigarnik effect causes unfinished tasks to intrusive recur in conscious thought; a formal shutdown ritual signals psychological completion to the brain.'
      }
    ]
  },
  {
    workoutType: 'weekly_multiplier_audit',
    title: 'Weekly Review: Output Multiplier Audit & Strategic Horizon',
    focus: 'Tallying weekly deep work hours, calculating output multiplier, and scheduling next week’s deep blocks.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Weekly Deep Work Hour Tally',
        durationRatio: 0.4,
        instructions:
          'Sum your total deep work hours for the week (target: 10–12 hours for Week 1). Compare completed deliverables against historical output. Note where you felt most focused.',
        focusCue: 'Measure focus hours, not just completed tasks; hours are the lead indicator of quality.',
        pitfallToAvoid: 'Focusing solely on volume of tasks while ignoring depth and strategic leverage.',
        layer: 'mechanism',
        layerReasoning:
          'Lead measures (hours spent in high-intensity focus) are controllable; lag measures (output) naturally follow.'
      },
      {
        stepNumber: 2,
        title: 'Screen Time & Digital Diet Audit',
        durationRatio: 0.35,
        instructions:
          'Check your smartphone Screen Time / Digital Wellbeing analytics. Record average daily screen time and number of phone pickups. Verify that pickups have decreased by ≥20%.',
        focusCue: 'Target non-essential screen time; celebrate hours reclaimed for real life.',
        pitfallToAvoid: 'Ignoring screen time data out of guilt; use it as an objective baseline.',
        layer: 'safety',
        layerReasoning:
          'Objective measurement of phone usage breaks subconscious addiction feedback loops.'
      },
      {
        stepNumber: 3,
        title: 'Next Week Strategic Horizon Mapping',
        durationRatio: 0.25,
        instructions:
          'Identify the 2 primary strategic milestones for next week. Reserve your morning deep blocks on your calendar and decline or reschedule conflicting non-essential meetings.',
        focusCue: 'Be protective of your prime morning hours.',
        pitfallToAvoid: 'Allowing other people’s meeting requests to encroach on your morning deep blocks.',
        layer: 'adherence',
        layerReasoning:
          'Proactive calendar defense guarantees that deep work takes precedence over administrative drift.'
      }
    ]
  },
  {
    workoutType: 'digital_sabbath',
    title: 'Cognitive Recovery: Digital Sabbath & Default Mode Restoration',
    focus: 'Zero work screens; spend the day engaged in physical nature, reading physical books, and social presence.',
    isRestDay: true,
    baseDurationMinutes: 15,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: '24-Hour Digital Sabbath Commitment',
        durationRatio: 0.6,
        instructions:
          'Leave your work laptop closed. Keep smartphone in a drawer or on a high shelf. Spend the day walking outdoors, exercising, cooking, or conversing in person without screens.',
        focusCue: 'Notice how quiet and spacious your mind feels when free from algorithmic dopamine feeds.',
        pitfallToAvoid: 'Mindlessly scrolling social media or news feeds on your rest day.',
        layer: 'mechanism',
        layerReasoning:
          'Complete sensory rest from glowing screens allows the brain’s default mode network to consolidate deep learning and restore executive attention.'
      },
      {
        stepNumber: 2,
        title: 'Active Social & Sensory Engagement',
        durationRatio: 0.4,
        instructions:
          'Engage in a tangible physical activity (hiking, cooking a meal, playing an instrument, or reading fiction). Sleep deeply without screens in the bedroom.',
        focusCue: 'Be fully present in your physical senses.',
        pitfallToAvoid: 'Thinking or worrying about Monday’s tasks during your rest window.',
        layer: 'adherence',
        layerReasoning:
          'Deep relaxation is the physiological prerequisite for intense sustained cognitive focus during the upcoming work week.'
      }
    ]
  }
];
