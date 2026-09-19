import { CertifiedPresetBlueprint } from './types.js';

export const bookPreset: CertifiedPresetBlueprint = {
  id: 'book_30k_words',
  matchingPatterns: [
    /book/i,
    /write.*book/i,
    /30,?000.*word/i,
    /novella/i,
    /publish.*book/i,
    /author/i,
    /manuscript/i,
    /non-?fiction/i,
    /finish.*book/i
  ],
  title: 'Write and Polish a 30,000-Word Non-Fiction Book',
  primaryDomain: 'Creative Writing & Long-Form Authorship',
  clarifiedOutcome:
    'Write, developmental-edit, and format a complete, polished 30,000-word non-fiction book manuscript ready for publishing',
  badge: 'Certified Authorship Pipeline · Steven Pressfield War of Art & Stephen King Method',
  capabilities: [
    'Fractal Chapter Architecture & Beat-Sheet Outlining',
    'Daily Uninterrupted Word Quota Drafting (500–750 words/day)',
    'The Closed-Door Drafting Protocol (Zero Real-Time Editing)',
    'Substantive & Line Editing (The Zinsser 10% Clutter Cut)',
    'Manuscript Assembly, Beta Reader Synthesis & EPUB Formatting'
  ],
  scientificFrameworks: [
    {
      name: "Steven Pressfield's The War of Art (Defeating Resistance)",
      description:
        'Resistance is the universal force of self-sabotage that manifests as procrastination, perfectionism, and research rabbit holes. Treating writing as professional, sacred, non-negotiable labor conquers Resistance.',
      application:
        'Schedules an invariant daily focus window where writing is the sole permitted activity; sitting in the chair and typing the quota is the only metric of success.'
    },
    {
      name: "Stephen King & Tim Ferriss's Word Quota & Fractal Outline Architecture",
      description:
        'A book is not written in grand bursts of inspiration; it is built through steady compound volume. A rigid top-down fractal outline prevents mid-book structural collapse.',
      application:
        'Builds a 10-chapter fractal outline with 3 distinct narrative beats per chapter before drafting, paired with an invariant 500-word daily quota.'
    },
    {
      name: "William Zinsser's On Writing Well & Donald Miller's Transformation Arc",
      description:
        'Great non-fiction is defined not by what is included, but by what is pruned. Stripping clutter and framing the reader as the hero undergoing a specific transformation makes every chapter gripping.',
      application:
        'Applies a mandatory 10% reduction pass during Phase 3 editing, eliminating throat-clearing passive voice and redundant adverbs.'
    }
  ],
  verificationCriteria:
    'Complete a full 30,000-word edited manuscript divided into 10 structured chapters, with beta reader feedback incorporated, line-edited for brevity, and formatted into clean publication-ready EPUB/PDF.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current writing experience and daily habit baseline?',
      subtitle: 'Calibrates your daily word quota, session duration, and pacing schedule.',
      options: [
        'First-Time Aspiring Author (Never written long-form content; struggle with momentum and perfectionism)',
        'Subject Matter Expert (Deep domain knowledge, professional articles/blogs, but never published a full book)',
        'Fiction Drafter / Storyteller (Desiring to write a 30,000-word novella or narrative non-fiction)',
        'Prolific Writer / Fast-Drafter (Comfortable writing 1,000+ words/day; seeking strict structural architecture and editing)'
      ],
      allowCustom: true
    },
    {
      id: 'genre_scope',
      question: 'What is the primary category and transformation of your book?',
      subtitle: 'Determines the narrative architecture and chapter beat structures.',
      options: [
        'Actionable Self-Help / Personal Development (Direct reader transformation frameworks)',
        'Technical / Business Guide (Practical methodology, case studies, and systems)',
        'Memoir / Narrative Essay (Story-driven thematic life reflections)',
        'Philosophical / Cultural Commentary (In-depth argument and thesis exploration)'
      ],
      allowCustom: true
    },
    {
      id: 'historical_friction',
      question: 'What has been your primary obstacle or failure point in past writing attempts?',
      subtitle: 'Installs behavioral guardrails to ensure you reach the 30,000-word finish line.',
      options: [
        'The Chapter 3 stall (Running out of steam at 5,000–8,000 words due to lack of a detailed outline)',
        'The real-time editor trap (Rewriting the first page 20 times and never advancing)',
        'Research rabbit holes (Spending hours researching trivia instead of putting words on the page)',
        'Fear of judgment / imposter syndrome (Hesitating to share drafts with external readers)'
      ],
      allowCustom: true
    }
  ],
  writingVelocityTable: [
    {
      baselineKey: 'first_time_author',
      label: 'First-Time Aspiring Author',
      dailyTargetWords: 400,
      weeklyWordQuota: 2000,
      targetChapterCount: 10,
      recommendedSessionWindow: 'Morning sacred 45-min sprint',
      guidance: 'Enforce the Closed-Door Drafting Protocol: zero editing while typing; leave [TK] placeholders for missing facts and keep moving.'
    },
    {
      baselineKey: 'subject_matter_expert',
      label: 'Subject Matter Expert',
      dailyTargetWords: 500,
      weeklyWordQuota: 2500,
      targetChapterCount: 10,
      recommendedSessionWindow: 'Early morning 60-min deep work block',
      guidance: 'Structure every chapter around 1 core thesis, 1 memorable case study, and 3 actionable tactical takeaways for the reader.'
    },
    {
      baselineKey: 'fiction_novella',
      label: 'Fiction / Story Drafter',
      dailyTargetWords: 600,
      weeklyWordQuota: 3000,
      targetChapterCount: 12,
      recommendedSessionWindow: 'Evening 60-min immersion sprint',
      guidance: 'Focus on character stakes, sensory world-building, and end-of-chapter cliffhangers to propel reader engagement.'
    },
    {
      baselineKey: 'prolific_drafter',
      label: 'Prolific Fast-Drafter',
      dailyTargetWords: 750,
      weeklyWordQuota: 3750,
      targetChapterCount: 10,
      recommendedSessionWindow: 'Morning 75-min sprint block',
      guidance: 'Rapid sprint drafting; complete Draft 1.0 by Week 6 to unlock multiple deep developmental editing passes.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Book spine crystallization, 10-chapter fractal outline, closed-door drafting habits, and completing Chapters 1 to 3 (10,000 words).',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Foundation Milestone Gate: 10,000 Words & Chapters 1–3 Drafted',
      milestoneCriteria:
        'Reach a verified net word count of 10,000 words across Chapters 1, 2, and 3 with zero self-editing pauses and complete 10-chapter beat-sheet locked.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Drafting core body chapters (Chapters 4 through 10), maintaining daily word quotas, and completing the full 30,000-word First Draft.',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Acceleration Milestone Gate: The Complete First Draft Lock',
      milestoneCriteria:
        'Complete the full 30,000-word First Draft (Draft 1.0) from Title Page to Conclusion/Epilogue with all 10 chapters fully drafted.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'Developmental structural edit, the Zinsser 10% clutter prune, beta reader review synthesis, and final publication formatting.',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: Final Polished Manuscript & Publication Formatting',
      milestoneCriteria:
        'Complete developmental and line edits, incorporate feedback from 3 beta readers, and compile the final 30,000-word manuscript into clean publication-ready EPUB and formatted PDF.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: The One-Sentence Spine & Chapter 1 Drafting',
      objective: 'Crystallize the core thesis statement, lock in the 10-chapter fractal outline, and draft the first 1,500 words of Chapter 1.',
      keyMilestone: '10-chapter outline locked; Chapter 1 draft initiated with ≥1,500 words written.',
      targetIntensity: 60,
      workoutArchetypes: []
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: Chapter 1 Completion & Chapter 2 Momentum',
      objective: 'Finish Chapter 1 (3,000 words total) and begin Chapter 2; strictly adhere to the closed-door drafting rule.',
      keyMilestone: 'Chapter 1 complete (3,000 words); cumulative word count passes 4,500 words.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: Chapter 2 Completion & The [TK] Habit',
      objective: 'Complete Chapter 2; tag all factual questions as [TK] without leaving your word processor; start Chapter 3.',
      keyMilestone: 'Cumulative manuscript passes 7,500 words; zero research detours logged.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Foundation Milestone Audit & 10,000-Word Lock',
      objective: 'Finish Chapter 3; pass the Phase 1 Foundation Milestone Gate with 10,000 total words drafted.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: 10,000 Words & Chapters 1–3 Drafted',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Mid-Book Deep Dive (Chapter 4 & 5 Acceleration)',
      objective: 'Conquer the traditional mid-book slump by executing Chapters 4 and 5 at 500+ words per session.',
      keyMilestone: 'Cumulative manuscript passes 15,000 words (50% mark reached).',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Case Study Integration & Chapter 6 Drafting',
      objective: 'Draft Chapter 6; weave in compelling narrative case studies illustrating core concepts in action.',
      keyMilestone: 'Cumulative manuscript reaches 19,000 words; 6 chapters fully drafted.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Climax & Resolution Drafting (Chapters 7 & 8)',
      objective: 'Draft Chapters 7 and 8, resolving the primary intellectual conflicts of the book.',
      keyMilestone: 'Cumulative manuscript passes 24,000 words; final 2 chapters in sight.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: The Complete First Draft Lock (Chapters 9 & 10)',
      objective: 'Draft Chapters 9, 10, and Conclusion; pass the Phase 2 Acceleration Milestone Gate with full 30,000-word First Draft.',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: The Complete First Draft Lock',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: Developmental Edit & Narrative Flow Pass',
      objective: 'Perform the structural developmental edit: re-order sections, fix logical gaps, and verify chapter transitions.',
      keyMilestone: 'Full manuscript structural review complete with all chapter transition bridges strengthened.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: The Zinsser 10% Clutter Prune (Line Editing)',
      objective: 'Execute line edit: cut 10% of unnecessary adjectives, passive phrasing, and wordy sentences to increase density.',
      keyMilestone: 'Line-by-line edit complete; reading grade level polished to clear 8th-grade readability.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Beta Reader Critique & [TK] Resolution',
      objective: 'Send manuscript to 3 trusted beta readers; batch-research and resolve all [TK] placeholder citations.',
      keyMilestone: '100% of [TK] placeholders resolved with authentic citations; initial beta reader feedback gathered.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Final Manuscript Formatting & Publication Capstone',
      objective: 'Incorporate beta revisions, generate clean table of contents, format into EPUB/PDF, and pass Capstone.',
      keyMilestone: 'Phase 3 Mastery Capstone: Final Polished Manuscript & Publication Formatting',
      targetIntensity: 95,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `
================================================================================
EXPERT AUTHOR & BOOK ARCHITECT CONTEXT: 30,000-WORD MANUSCRIPT
================================================================================
You are Steven Pressfield (The War of Art) and William Zinsser (On Writing Well) coaching an author to complete a 30,000-word book.
Core Non-Negotiable Rules:
1. THE CLOSED-DOOR DRAFTING PROTOCOL:
   Draft with the door closed, edit with the door open. While drafting, never stop to reread yesterday's work, fix spelling, or look up a forgotten stat. Tag missing facts with [TK] (e.g. '[TK study on sleep duration]') and keep typing forward.
2. DAILY WORD QUOTA OVER INSPIRATION:
   Inspiration is for amateurs; professionals sit down and hit their word count ($500\text{ words/day}$). Success is defined solely by hitting the quota during the focus window.
3. FRACTAL 10-CHAPTER OUTLINE:
   A book never stalls from writer's block; it stalls from structural ambiguity. Every chapter must have a clear 3-beat outline (Hook $\rightarrow$ Evidence/Story $\rightarrow$ Tactical Takeaway) before writing begins.
4. THE ZINSSER 10% PRUNE:
   First drafts are full of throat-clearing fluff. In Phase 3, cut 10% of the words to make every sentence punchy and active.
================================================================================
`,
  evidenceTriad: {
    science: {
      title: "Psychological Momentum & The [TK] Convention",
      subtitle: "Steven Pressfield & Anne Lamott",
      tag: "Cognitive Momentum",
      coreRule: "Separating generative output from critical editing prevents cognitive paralysis.",
      realWorldApplication:
        "Writers draft in flow state without pausing to fact-check; inserting '[TK]' placeholders allows the creative hemisphere to stay in high-output mode."
    },
    socialAdherence: {
      title: "The Invariant 500-Word Sacred Window",
      subtitle: "Stephen King & Tim Ferriss",
      tag: "Habit Architecture",
      coreRule: "A non-negotiable 45–60 minute morning window before checking email guarantees consistency.",
      realWorldApplication:
        "Writers protect their first waking hour for manuscript creation; hitting 500 words before 9:00 AM makes failure impossible."
    },
    proCoaching: {
      title: "The 10% Zinsser Pruning Pass",
      subtitle: "William Zinsser & Donald Miller",
      tag: "Craft & Brevity",
      coreRule: "Simplicity is the essence of great prose; eliminate every word that serves no function.",
      realWorldApplication:
        "During Phase 3 line editing, authors strip out redundant adverbs ('very', 'really', 'extremely') and transform passive constructions into vivid active verbs."
    }
  }
};

// Populate Week 1 workout archetypes
bookPreset.weeks[0].workoutArchetypes = [
  {
    workoutType: 'premise_spine',
    title: 'Writing Sprint: The One-Sentence Spine & Reader Transformation Arc',
    focus: 'Crystallizing the core book thesis, defining the target reader before/after state, and locking in the working title.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'The Core Transformation Equation',
        durationRatio: 0.35,
        instructions:
          'Write the foundational book spine equation: "This book takes [SPECIFIC READER] from [FRUSTRATED STATE A] to [EMPOWERED STATE B] through [UNIQUE METHOD]."',
        focusCue: 'Be ruthlessly specific about who this book is NOT for.',
        pitfallToAvoid: 'Writing for "everyone", which results in a book that resonates with no one.',
        layer: 'mechanism',
        layerReasoning:
          'Clear reader avatar definition acts as the cognitive anchor for every future chapter argument and editorial decision.'
      },
      {
        stepNumber: 2,
        title: 'The 3 Core Thematic Pillars (Acts I, II, III)',
        durationRatio: 0.4,
        instructions:
          'Divide your book into 3 overarching phases: Act I (Deconstructing the Old Broken Mindset), Act II (The Core Framework & Methodology), Act III (Real-World Execution & Mastery). Write a 2-paragraph summary of each act.',
        focusCue: 'Ensure each act builds logically upon the previous one with rising clarity.',
        pitfallToAvoid: 'Front-loading all tactical advice in Act I before establishing the emotional stakes.',
        layer: 'adherence',
        layerReasoning:
          'A classical 3-act narrative architecture provides the author with a clear macro-map, eliminating mid-book disorientation.'
      },
      {
        stepNumber: 3,
        title: 'Working Title & Subtitle Drafting',
        durationRatio: 0.25,
        instructions:
          'Generate 5 title and subtitle variations. The title should be memorable (2–4 words); the subtitle must explain the exact tangible benefit or transformation.',
        focusCue: 'Check that the subtitle promises an irresistible outcome to your ideal reader.',
        pitfallToAvoid: 'Abstract, poetic titles that require the reader to guess what the book is about.',
        layer: 'safety',
        layerReasoning:
          'An explicit, benefit-driven subtitle directly drives commercial book conversion and reader recommendation velocity.'
      }
    ]
  },
  {
    workoutType: 'fractal_outline',
    title: 'Architectural Sprint: The 10-Chapter Fractal Outline',
    focus: 'Mapping the 10 book chapters, assigning target word counts (3,000 words each), and detailing 3 key beats per chapter.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: '10-Chapter Title & Scope Allocation',
        durationRatio: 0.3,
        instructions:
          'List Chapters 1 through 10. Allocate exactly 3,000 words to each chapter to hit the 30,000-word target. Give each chapter an action-oriented title.',
        focusCue: 'Every chapter must represent one distinct, standalone milestone in the reader’s journey.',
        pitfallToAvoid: 'Creating chapters with overlapping themes that will cause repetitive drafting.',
        layer: 'mechanism',
        layerReasoning:
          'Even modular chapter pacing prevents structural drift and allows clean standalone reading.'
      },
      {
        stepNumber: 2,
        title: 'The 3-Beat Chapter Anatomy Mapping',
        durationRatio: 0.5,
        instructions:
          'For each chapter, map the 3 invariant beats: Beat 1: The Hook & Counter-Intuitive Story (approx. 800 words), Beat 2: The Core Principle & Breakdown (approx. 1,400 words), Beat 3: The Tactical Exercise & Chapter Bridge (approx. 800 words).',
        focusCue: 'Treat each beat as a mini-essay with its own beginning, middle, and conclusion.',
        pitfallToAvoid: 'Leaving chapter outlines as single vague bullet points like "discuss habits".',
        layer: 'adherence',
        layerReasoning:
          'Granular beat outlines convert writing from open-ended creative agony into rapid filling-in of pre-engineered slots.'
      },
      {
        stepNumber: 3,
        title: 'Chapter 1 Beat Review & Sprint Setup',
        durationRatio: 0.2,
        instructions:
          'Isolate the 3 beats of Chapter 1. Write down 2 personal stories or case studies you will use in Beat 1 tomorrow morning. Prepare your blank document.',
        focusCue: 'Visualize the opening sentence before closing your laptop for the night.',
        pitfallToAvoid: 'Opening your document tomorrow without knowing exactly what scene you are drafting.',
        layer: 'safety',
        layerReasoning:
          'Pre-committing to the opening scene the night before activates the brain’s default mode network for unconscious incubation.'
      }
    ]
  },
  {
    workoutType: 'drafting_hook',
    title: 'Drafting Sprint 1: Chapter 1 Hook & Scene Opening (500 Words)',
    focus: 'Executing the Closed-Door Drafting Protocol to write 500 clean words for Chapter 1 Beat 1.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Pre-Drafting Priming & Environment Setup',
        durationRatio: 0.15,
        instructions:
          'Set phone to Do Not Disturb in another room. Open your word processor in fullscreen distraction-free mode. Review Chapter 1 Beat 1 bullet points for 2 minutes.',
        focusCue: 'Take 3 deep breaths; remind yourself: "The first draft does not have to be good, it just has to be written."',
        pitfallToAvoid: 'Checking email, news, or notifications "just for a quick second" before typing.',
        layer: 'safety',
        layerReasoning:
          'Cognitive switching penalty research shows that a single notification derailment takes 23 minutes of refocusing time.'
      },
      {
        stepNumber: 2,
        title: 'Closed-Door 500-Word Drafting Sprint',
        durationRatio: 0.65,
        instructions:
          'Draft continuously for 35 minutes. Aim for 500 net words. Drop right into a vivid scene or shocking statistic. If you need a date or name, type [TK] and keep typing forward without stopping.',
        focusCue: 'Do not hit the backspace key to rephrase; keep fingers moving forward.',
        pitfallToAvoid: 'Rereading the first paragraph 10 times to perfect the tone.',
        layer: 'mechanism',
        layerReasoning:
          'Generative drafting utilizes dorsal frontoparietal networks; engaging critical editing networks shuts down verbal fluency.'
      },
      {
        stepNumber: 3,
        title: 'Word Count Logging & Session Shutdown',
        durationRatio: 0.2,
        instructions:
          'Log your net word count in your tracking sheet. Write down the first sentence you will draft tomorrow morning. Close the document immediately.',
        focusCue: 'Stop writing in the middle of a thought so restarting tomorrow is effortless.',
        pitfallToAvoid: 'Continuing to write until mental exhaustion, which creates subconscious dread for the next day.',
        layer: 'adherence',
        layerReasoning:
          'Hemingway’s rule of stopping at the peak of momentum ensures high enthusiasm for the subsequent writing session.'
      }
    ]
  },
  {
    workoutType: 'drafting_core',
    title: 'Drafting Sprint 2: Chapter 1 Core Framework & Argument (600 Words)',
    focus: 'Drafting Beat 2 of Chapter 1, detailing the primary concept and supporting data.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Beat 2 Framework Review',
        durationRatio: 0.15,
        instructions:
          'Review the central argument of Chapter 1 Beat 2. Identify the core objection a skeptical reader might raise and plan your counter-argument.',
        focusCue: 'Anticipate the reader’s doubts; answer their silent "Why should I believe this?" question.',
        pitfallToAvoid: 'Preaching dogmatic assertions without addressing counter-arguments.',
        layer: 'safety',
        layerReasoning:
          'Addressing counter-arguments directly establishes authorial credibility and deepens reader trust.'
      },
      {
        stepNumber: 2,
        title: '600-Word Deep Argument Sprint',
        durationRatio: 0.65,
        instructions:
          'Draft 600 words unpacking the core framework. Break the concept into 3 digestible sub-steps. Use bold, clear analogies to anchor complex concepts.',
        focusCue: 'Write in active voice: "The pilot landed the plane," not "The plane was landed by the pilot."',
        pitfallToAvoid: 'Using academic passive voice or excessive jargon to sound authoritative.',
        layer: 'mechanism',
        layerReasoning:
          'Active voice sentence construction increases processing fluency and cognitive absorption in non-fiction readers.'
      },
      {
        stepNumber: 3,
        title: 'Cumulative Progress Audit',
        durationRatio: 0.2,
        instructions:
          'Verify that Chapter 1 now stands at ≥1,100 words. Log words into the master tracker. Note any [TK] placeholders created.',
        focusCue: 'Acknowledge your progress: you are over 1/3 of the way through Chapter 1.',
        pitfallToAvoid: 'Fixing typographical errors; leave them for the Phase 3 line edit.',
        layer: 'adherence',
        layerReasoning:
          'Visual word-count progress trackers stimulate dopamine release and reinforce identity as a productive working author.'
      }
    ]
  },
  {
    workoutType: 'drafting_bridge',
    title: 'Drafting Sprint 3: Chapter 1 Exercise & Chapter 2 Bridge (500 Words)',
    focus: 'Drafting Beat 3 of Chapter 1: practical reader exercise and transition cliffhanger to Chapter 2.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Tactical Reader Exercise Design',
        durationRatio: 0.2,
        instructions:
          'Design an immediate, high-leverage 5-minute exercise for the reader to apply Chapter 1’s thesis today. Keep the instructions numbered and actionable.',
        focusCue: 'Give the reader a quick win they can complete right after putting the chapter down.',
        pitfallToAvoid: 'Vague theoretical advice like "think about your mindset" instead of concrete action.',
        layer: 'safety',
        layerReasoning:
          'Tangible reader implementation builds self-efficacy and transforms passive reading into active behavioral change.'
      },
      {
        stepNumber: 2,
        title: '500-Word Drafting & Chapter 2 Transition Bridge',
        durationRatio: 0.6,
        instructions:
          'Draft the tactical exercise section and the final transitional bridge paragraph of Chapter 1. Conclude with an open loop or question that compels the reader to turn the page to Chapter 2.',
        focusCue: 'End the chapter with forward momentum; hint at the deeper obstacle addressed in Chapter 2.',
        pitfallToAvoid: 'Ending a chapter on a flat, passive summary that feels like an off-ramp.',
        layer: 'mechanism',
        layerReasoning:
          'Narrative open loops (the Zeigarnik effect) create cognitive tension that drives uninterrupted reading momentum.'
      },
      {
        stepNumber: 3,
        title: 'Chapter 1 Draft Completion Verification',
        durationRatio: 0.2,
        instructions:
          'Verify that Chapter 1 has officially reached 1,600+ words. Save and backup your file locally and to the cloud (Google Drive/Dropbox).',
        focusCue: 'Celebrate: Chapter 1 is in the vault! Draft 1.0 is officially underway.',
        pitfallToAvoid: 'Failing to back up working files across multiple storage media.',
        layer: 'adherence',
        layerReasoning:
          'Automated cloud backups prevent catastrophic file loss, protecting psychological investment and continuity.'
      }
    ]
  },
  {
    workoutType: 'research_batch',
    title: 'Editorial Maintenance: Word-Count Audit & [TK] Research Batching',
    focus: 'Auditing weekly net output, resolving 2–3 tagged [TK] research questions, and setting up Chapter 2 beats.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: '[TK] Tag Resolution Sprint (30 Minutes)',
        durationRatio: 0.5,
        instructions:
          'Search your Chapter 1 document for "[TK]". Now that the drafting sprint is complete, spend 30 minutes looking up the exact dates, citations, or data points needed to replace the placeholders.',
        focusCue: 'Keep research focused strictly on replacing the tagged brackets; do not follow unrelated links.',
        pitfallToAvoid: 'Allowing fact-checking to turn into endless web browsing.',
        layer: 'safety',
        layerReasoning:
          'Batching research into dedicated sessions isolates analytical web searching from creative text generation.'
      },
      {
        stepNumber: 2,
        title: 'Weekly Word-Count & Milestone Audit',
        durationRatio: 0.25,
        instructions:
          'Tally your total net words written across Week 1 (target: 2,000–2,500 words). Verify you are on pace to reach 10,000 words by Week 4.',
        focusCue: 'Reflect on what time of day your drafting felt most effortless.',
        pitfallToAvoid: 'Beating yourself up if you fell slightly short of quota; simply adjust tomorrow’s block.',
        layer: 'adherence',
        layerReasoning:
          'Weekly quantitative audits calibrate realistic velocity and prevent unmanageable backlogs.'
      },
      {
        stepNumber: 3,
        title: 'Chapter 2 Beat Preview & Setup',
        durationRatio: 0.25,
        instructions:
          'Review the 3 beats for Chapter 2. Pick your opening story for Monday morning. Ensure your desk is clear and ready.',
        focusCue: 'Anchor Chapter 2 in your mind before heading into your day off.',
        pitfallToAvoid: 'Leaving Monday morning unplanned, which invites procrastination.',
        layer: 'mechanism',
        layerReasoning:
          'Prior planning activates prospective memory, enabling effortless resumption after a rest day.'
      }
    ]
  },
  {
    workoutType: 'creative_rest',
    title: 'Active Recovery & Creative Well Replenishment',
    focus: 'Zero writing; read 45 minutes of a gold-standard masterwork in your genre to absorb rhythm and voice.',
    isRestDay: true,
    baseDurationMinutes: 15,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Deep Reading & Craft Analysis (45 Minutes)',
        durationRatio: 0.7,
        instructions:
          'Spend 30–45 minutes reading a premier book in your genre (e.g. Malcolm Gladwell, James Clear, or Steven Pressfield). Pay attention to sentence length, opening hooks, and how they transition between stories and principles.',
        focusCue: 'Read as an apprentice writer analyzing craft, rather than a passive consumer.',
        pitfallToAvoid: 'Comparing yourself unfavorably to a veteran author’s final polished 10th draft.',
        layer: 'mechanism',
        layerReasoning:
          'Exposure to high-craft prose tunes the internal ear to natural cadence, rhythm, and sentence economy.'
      },
      {
        stepNumber: 2,
        title: 'Mindful Walk & Subconscious Incubation',
        durationRatio: 0.3,
        instructions:
          'Take a 15-minute walk without listening to podcasts or music. Let your mind freely wander over Chapter 2’s themes.',
        focusCue: 'Let thoughts drift without forcing answers or writing notes.',
        pitfallToAvoid: 'Forcing yourself to plan or outline during rest periods.',
        layer: 'adherence',
        layerReasoning:
          'Unfocused walking stimulates diffuse-mode thinking, which is responsible for lateral insights and creative breakthroughs.'
      }
    ]
  }
];
