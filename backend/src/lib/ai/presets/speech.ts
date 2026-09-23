import { CertifiedPresetBlueprint } from './types.js';

export const speechPreset: CertifiedPresetBlueprint = {
  id: 'ted_speech_15min',
  matchingPatterns: [
    /\b(public speaking|ted talk|toastmasters|keynote|stage fright|orator)\b/i,
    /\bgive a (speech|talk)\b/i,
    /\b(speech|presentation)\s+(skills|practice|delivery|coach)\b/i,
    /\bvocal\s+variety\b/i,
    // Frontend catalogue title (ND-17). The backend title still matches by equality.
    /\bdeliver a 15-minute ted-style speech\b/i,
  ],
  title: 'Deliver an Unforgettable 15-Minute TED-Style Speech',
  primaryDomain: 'Public Speaking & TED-Style Storytelling',
  clarifiedOutcome:
    'Deliver an unforgettable 15-minute TED-style keynote speech from memory without slide crutches, captivating a live audience through a single throughline, emotional story beats, and authoritative stage presence',
  badge: 'Certified Rhetorical Architecture · Carmine Gallo Talk Like TED & Toastmasters International',
  capabilities: [
    'The 15-Word Throughline Anchor & Audience-Centric Transformation Arc',
    'Aristotle’s Rhetorical Triad: Ethos, Pathos, and Logos Structural Calibration',
    'Toastmasters Vocal Mechanics: Diaphragmatic Breath, Pacing (130–150 WPM), and Silence Substitution',
    'Beat-Sheet Memory Architecture (Idea Chunking vs Fragile Verbatim Memorization)',
    'Nancy Duarte Sparkline Design: Alternating "What Is" vs "What Could Be"',
    'Physiological State Regulation (Huberman Sighs & Adrenaline Transmutation)'
  ],
  scientificFrameworks: [
    {
      name: "Carmine Gallo's Talk Like TED & The Rule of Three",
      description:
        'Human working memory can only absorb a single core idea per presentation. World-class TED talks succeed because they anchor everything to a single "Throughline" organized into exactly three emotional narrative acts with a signature "jaw-dropping moment."',
      application:
        'Enforces a strict 15-word throughline constraint and a 3-act story structure, banishing wandering tangents and slide-clutter data dumps.'
    },
    {
      name: "Toastmasters International Vocal Dynamics & The Silence Substitution Technique",
      description:
        'Audible fillers ("um", "ah", "like", "you know") occur when speakers panic during cognitive retrieval and phonate anxiety. Pausing silently projects executive gravitas, gives the audience time to absorb ideas, and resets lung volume.',
      application:
        'Mandates replacing every instinctive filler word with a silent 2-second diaphragmatic breath pause, audited weekly with an audio Ah-Counter.'
    },
    {
      name: "Nancy Duarte's Resonate & The Sparkline Contrast Structure",
      description:
        'Great oratory does not merely deliver information; it creates compelling dramatic tension by constantly contrasting the flawed present ("What Is") with the inspiring potential future ("What Could Be").',
      application:
        'Structures the 15-minute speech into dynamic emotional oscillations between tension and resolution, culminating in a clear, empowering Call to Adventure.'
    }
  ],
  verificationCriteria:
    'Deliver a full 15-minute keynote speech from memory before a verified live audience of ≥5 people (or live recorded performance), maintaining 130–150 WPM conversational pacing, zero slide-reading crutches, and <1 audible filler word per minute audited via recording.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current public speaking and presentation experience?',
      subtitle: 'Calibrates speech length target, weekly vocal drill duration, and memory chunking pacing.',
      options: [
        'Stage Fright Novice (Extreme anxiety, rapid heartbeat, and avoidance of speaking opportunities)',
        'Technical Presenter (Comfortable in team meetings, but robotic and heavily reliant on slides)',
        'Experienced Speaker (Regularly speak to groups, but want to reach TED/Keynote caliber virtuosity)',
        'Keynote Aspirant (Polished speaker preparing for a high-stakes TEDx talk, conference keynote, or company all-hands)'
      ],
      allowCustom: true
    },
    {
      id: 'primary_fear',
      question: 'What is your greatest vulnerability when speaking publicly?',
      subtitle: 'Installs targeted psychological and behavioral antidotes into daily rehearsals.',
      options: [
        'Memory freeze / Blanking out on stage in front of an audience',
        'Physiological hijack (Shaking hands, trembling voice, shortness of breath)',
        'Audible filler word infestation (Compulsive "um", "ah", "like" when transitioning thoughts)',
        'Monotone delivery & audience disengagement (Failing to command room energy and inspire emotion)'
      ],
      allowCustom: true
    },
    {
      id: 'speech_context',
      question: 'What is the primary venue or occasion for this 15-minute speech?',
      subtitle: 'Shapes the rhetorical posture, emotional tone, and audience call to action.',
      options: [
        'TEDx / Independent Storytelling Event',
        'Industry Conference / Professional Keynote',
        'Company All-Hands / Strategic Vision Pitch to Investors',
        'Personal Milestone / Keynote Address / Community Rally'
      ],
      allowCustom: true
    }
  ],
  speechVelocityTable: [
    {
      baselineKey: 'stage_fright_novice',
      label: 'Stage Fright Novice',
      speechLengthMins: 10,
      fillerWordsPerMinTarget: '< 3 / min',
      weeklyVocalDrillsMinutes: 45,
      targetWPM: '120–135 WPM (deliberate, steady pacing)',
      guidance: 'Start with 3-minute story chunks recorded privately on your smartphone. Focus entirely on diaphragmatic breathing and embracing silence.'
    },
    {
      baselineKey: 'technical_presenter',
      label: 'Technical Presenter',
      speechLengthMins: 12,
      fillerWordsPerMinTarget: '< 2 / min',
      weeklyVocalDrillsMinutes: 60,
      targetWPM: '130–145 WPM (conversational authority)',
      guidance: 'Ban bullet-point slides completely. Replace data dumps with relatable character-driven analogies and emotional contrast.'
    },
    {
      baselineKey: 'experienced_speaker',
      label: 'Experienced Speaker',
      speechLengthMins: 15,
      fillerWordsPerMinTarget: '< 1 / min',
      weeklyVocalDrillsMinutes: 75,
      targetWPM: '135–150 WPM (dynamic rhetorical cadence)',
      guidance: 'Master beat-sheet memory chunking. Introduce intentional stage choreography, vocal pitch drops, and dramatic pauses.'
    },
    {
      baselineKey: 'keynote_aspirant',
      label: 'Keynote Aspirant',
      speechLengthMins: 15,
      fillerWordsPerMinTarget: 'Zero audible fillers',
      weeklyVocalDrillsMinutes: 90,
      targetWPM: '140–155 WPM (TED-level virtuosity)',
      guidance: 'Rehearse under stress inoculation conditions: loud distractions, standing on a stage, and live peer critique.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Throughline Lock, 3-Act Storyboard & Vocal Hygiene',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Hard-Gate: Locked 15-Word Throughline & 5-Minute Slide-Free Delivery',
      milestoneCriteria:
        'Deliver the opening 5 minutes of your speech from memory with zero notes or slides, audited at <3 filler words per minute, and verify your 15-word throughline passes the stranger clarity test.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Vocal Dynamics, Duarte Sparklines & Complete 12-Minute Memory Run',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Hard-Gate: Complete 12-Minute Memory Run with <1 Filler/Min',
      milestoneCriteria:
        'Perform a complete 12-minute unbroken delivery from memory recorded on video, demonstrating dynamic vocal pitch/pace modulation and maintaining <1 audible filler word per minute.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'Stage Choreography, Stress Inoculation & Official 15-Minute Live Capstone',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: Official 15-Minute TED-Style Live Keynote Delivery',
      milestoneCriteria:
        'Deliver your full 15-minute keynote speech before a live audience of ≥5 people, maintaining 130–150 WPM conversational cadence, zero slide reading, and documented standing audience feedback.'
    }
  ],
  evidenceTriad: {
    science: {
      title: 'Carmine Gallo Talk Like TED & The Rule of Three',
      subtitle: 'Cognitive Working Memory & Emotional Architecture',
      tag: 'RHETORICAL NEUROSCIENCE',
      coreRule: 'Anchor the talk to one 15-word Throughline structured into three emotional narrative acts.',
      realWorldApplication:
        'Audience minds forget 90% of a talk within 24 hours. They only remember what they felt and the core throughline. Structuring in threes respects human cognitive processing limits.'
    },
    socialAdherence: {
      title: 'Toastmasters Ah-Counter & Silence Substitution',
      subtitle: 'Vocal Discipline & Anxiety Extinguishing',
      tag: 'HABIT DEFENSE',
      coreRule: 'Never phonate while calculating the next phrase; swallow filler words in a silent breath.',
      realWorldApplication:
        'Speakers say "um" to fill terrifying silence. Replacing fillers with 2-second silent pauses makes the speaker look confident, wise, and in complete command of the room.'
    },
    proCoaching: {
      title: 'Nancy Duarte Sparklines & Stage Choreography',
      subtitle: 'Dramatic Contrast & Physical Authority',
      tag: 'STAGE MASTERY',
      coreRule: 'Oscillate between "What Is" and "What Could Be"; move intentionally with purpose.',
      realWorldApplication:
        'Great orators don’t pace aimlessly. They plant their feet to deliver critical punches, use open palms to invite connection, and take two steps to signify a new narrative act.'
    }
  },
  expertPromptContext: `You are generating a certified 12-week public speaking roadmap to deliver an unforgettable 15-minute TED-style keynote speech.
Follow the 5-Step Master Blueprint Protocol strictly:
1. Ground every week in Carmine Gallo Talk Like TED, Toastmasters International vocal dynamics, and Nancy Duarte Sparkline structure.
2. Defeat the 5 Public Speaking Death Zones:
   - Death Zone 1 (Weeks 1-2): The "Curse of Knowledge" & Topic Bloat -> Antidote: The 15-word Throughline anchor test & 3-act StoryBrand filter.
   - Death Zone 2 (Weeks 3-4): The "Slide Crutch" Trap -> Antidote: Slide-free delivery; Duarte visual-only minimalism (1 photo/statistic per slide max, zero text bullets).
   - Death Zone 3 (Weeks 5-6): Verbal Tick & Filler Word Infestation -> Antidote: Toastmasters Ah-Counter audit & the 2-second Silence Substitution technique.
   - Death Zone 4 (Weeks 7-8): The Monotone Teleprompter Freeze -> Antidote: Beat-sheet associative memory chunking (memorize concepts and emotional beats, not verbatim sentences).
   - Death Zone 5 (Weeks 10-11): Stage Fright Adrenaline Hijack -> Antidote: Huberman physiological double-sighs, grounded power stances, and stress-inoculation dress rehearsals.
3. Every daily task must mandate the 3-layer triad:
   - Mechanism: The rhetorical principle (e.g. dramatic contrast, open-palm gesturing, diaphragmatic projection).
   - Adherence: Specific rehearsal structure (e.g. 15m vocal warmup + 30m beat-sheet run + video review).
   - Safety: Anti-panic protocols, voice preservation (hydration/warmups), and pacing guards (130–150 WPM).
4. Hard-gate milestones at Weeks 4 (5-minute slide-free gate), 8 (12-minute memory run gate), and 12 (15-minute live audience capstone) MUST be enforced with zero compromise.`,
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'The Throughline Anchor & Narrative Hook Formulation',
      objective: 'Distill your entire message into a 15-word Throughline and formulate a captivating 90-second opening hook.',
      keyMilestone: 'Lock your 15-word throughline and deliver a 90-second opening hook from memory with zero notes.',
      targetIntensity: 60,
      workoutArchetypes: [
        {
          workoutType: 'throughline_framing',
          title: 'The 15-Word Throughline & Hook Formulation',
          focus: 'Define the singular transformation of your talk and draft the opening 90 seconds.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'The 15-Word Throughline Crucible',
              durationRatio: 0.35,
              instructions:
                'Write down the single thesis of your speech in 15 words or fewer. It must contain: 1) The audience problem, 2) The core insight, 3) The transformed future state. If it exceeds 15 words, trim aggressively.',
              focusCue: 'If you can’t state your idea in 15 words, you don’t yet know what your speech is about.',
              pitfallToAvoid: 'Cramming three different topics into a run-on sentence with multiple conjunctions.',
              layer: 'mechanism',
              layerReasoning:
                'The throughline is the spine of the talk; every story, joke, and statistic must directly serve this single sentence.'
            },
            {
              stepNumber: 2,
              title: 'The 90-Second Opening Hook Architecture',
              durationRatio: 0.45,
              instructions:
                'Draft your opening 90 seconds using one of Carmine Gallo’s 3 proven hooks: 1) A personal story of vulnerability, 2) A counterintuitive shocking statistic, or 3) A provocative "What if?" question. Never begin with pleasantries or "Thank you for having me."',
              focusCue: 'Grab the audience’s emotional attention within the first 10 seconds.',
              pitfallToAvoid: 'Wasting the highest-attention moment on biographical throat-clearing or logistics.',
              layer: 'mechanism',
              layerReasoning:
                'Audiences decide whether to mentally tune in or check out within the first 60 seconds.'
            },
            {
              stepNumber: 3,
              title: 'Vocalized Hook Recording & Review',
              durationRatio: 0.2,
              instructions:
                'Stand up, place your phone on a shelf at eye level, and record yourself delivering the 90-second hook 3 times from memory. Listen back to check clarity and energy.',
              focusCue: 'Speak with warmth and conviction; maintain eye contact with the camera lens.',
              pitfallToAvoid: 'Reading from a paper script; delivery must be conversational from Day 1.',
              layer: 'adherence',
              layerReasoning:
                'Recording your voice immediately reveals robotic inflections and builds early camera comfort.'
            }
          ]
        },
        {
          workoutType: 'vocal_mechanics',
          title: 'Toastmasters Vocal Dynamics & Diaphragmatic Breath',
          focus: 'Master belly breathing, resonance projection, and eliminate filler words using the silence technique.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Diaphragmatic Breath & Resonance Warmup',
              durationRatio: 0.3,
              instructions:
                'Place one hand on your belly and one on your chest. Inhale deeply through your nose for 4 seconds, feeling your belly expand while your chest stays still. Hum on an "Mmm" sound for 15 seconds to warm vocal folds.',
              focusCue: 'Voice power comes from the abdomen, not the throat.',
              pitfallToAvoid: 'Shallow chest breathing, which triggers fight-or-flight vocal tremors.',
              layer: 'safety',
              layerReasoning:
                'Diaphragmatic breathing lowers cortisol and prevents the vocal cord constriction caused by adrenaline.'
            },
            {
              stepNumber: 2,
              title: 'The Silence Substitution Drill (Ah-Counter Training)',
              durationRatio: 0.45,
              instructions:
                'Select a random everyday topic (e.g., "Why coffee is great" or "My favorite city"). Speak aloud for 3 minutes. Whenever you feel the urge to say "um", "uh", or "like", close your lips and take a silent 2-second breath instead.',
              focusCue: 'Silence sounds profound to the audience; it only feels long to you.',
              pitfallToAvoid: 'Rushing to fill every micro-gap of quiet with phonated anxiety.',
              layer: 'adherence',
              layerReasoning:
                'Replacing the involuntary filler reflex with a conscious silent pause transforms nervous habit into executive gravitas.'
            },
            {
              stepNumber: 3,
              title: 'Pacing Calibration: The 140 WPM Benchmark',
              durationRatio: 0.25,
              instructions:
                'Read a 140-word excerpt aloud while timing yourself. Adjust your tempo until it takes exactly 60 seconds (140 Words Per Minute). Mark where natural pauses occur.',
              focusCue: 'Slow down on complex concepts; accelerate slightly on energetic stories.',
              pitfallToAvoid: 'Racing at 180+ WPM due to nervous adrenaline.',
              layer: 'mechanism',
              layerReasoning:
                '130–150 WPM is the gold-standard conversational sweet spot for high retention and effortless listening.'
            }
          ]
        },
        {
          workoutType: 'stage_presence_body',
          title: 'Nonverbal Stance: Grounding, Open Torso & Eye Triangles',
          focus: 'Eliminate nervous fidgeting; establish a grounded physical posture and purposeful eye contact.',
          isRestDay: false,
          baseDurationMinutes: 40,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'The Grounded Boxer Stance',
              durationRatio: 0.3,
              instructions:
                'Stand with feet shoulder-width apart, knees unlocked, weight evenly distributed across both soles. Relax shoulders down and back. Hold this rooted position for 3 minutes without shifting or swaying.',
              focusCue: 'Feel like a sturdy oak tree rooted to the floor.',
              pitfallToAvoid: 'The "nervous penguin" sway (rocking side to side or pacing aimlessly).',
              layer: 'mechanism',
              layerReasoning:
                'Physical stillness signals emotional confidence and commands subconscious respect from an audience.'
            },
            {
              stepNumber: 2,
              title: 'Open Torso & Expansive Gestures',
              durationRatio: 0.4,
              instructions:
                'Practice delivering your 90-second hook with hands above the waist and open palms visible. Use gestures that illustrate size, contrast, or direction. Never cross arms or hide hands in pockets.',
              focusCue: 'Open palms communicate honesty and safety to the human amygdala.',
              pitfallToAvoid: 'The "fig leaf" pose (clasping hands defensively in front of the groin).',
              layer: 'mechanism',
              layerReasoning:
                'Evolutionary biology predisposes humans to trust speakers whose open palms are readily visible.'
            },
            {
              stepNumber: 3,
              title: 'The Eye Contact Triangle Simulation',
              durationRatio: 0.3,
              instructions:
                'Pick 3 focal points in your room (Left, Center, Right). Practice delivering one complete thought or sentence to Point A (3–5 seconds), then smoothly transitioning to Point B for the next sentence.',
              focusCue: 'Speak to one person at a time; never spray your eyes randomly across the room.',
              pitfallToAvoid: 'The "lighthouse scan" (rapidly sweeping eyes across the room without connecting).',
              layer: 'adherence',
              layerReasoning:
                'Direct 3–5 second eye contact establishes intimate 1-on-1 micro-connections that captivate large rooms.'
            }
          ]
        },
        {
          workoutType: 'beat_sheet_memory',
          title: 'Beat-Sheet Memory: Idea Chunking vs Verbatim Scripts',
          focus: 'Structure your speech into conceptual beats instead of memorizing sentences word-for-word.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'The 3-Act Beat Sheet Construction',
              durationRatio: 0.4,
              instructions:
                'Break your speech into 3 primary acts: Act 1 (The Broken Status Quo), Act 2 (The Discovery / Breakthrough), Act 3 (The Transformed Vision & Call to Action). List exactly 3 key bullet points per act.',
              focusCue: 'Each beat is a stepping stone across a river; memorize the stones, not the water between them.',
              pitfallToAvoid: 'Writing out a 2,000-word essay and trying to memorize every adjective.',
              layer: 'mechanism',
              layerReasoning:
                'Verbatim memorization creates fragile panic: forget one word and the entire train of thought collapses. Concept chunking is resilient.'
            },
            {
              stepNumber: 2,
              title: 'Associative Mental Anchoring',
              durationRatio: 0.35,
              instructions:
                'Assign a vivid visual symbol or emotional keyword to each of the 9 beats. Walk through your room, associating each physical object with a beat (the Method of Loci / Memory Palace technique).',
              focusCue: 'Visualize the mental image clearly before speaking the beat aloud.',
              pitfallToAvoid: 'Relying on abstract logical bullet points that lack sensory imagery.',
              layer: 'mechanism',
              layerReasoning:
                'Spatial memory is biologically ancient and vastly more robust under stage adrenaline than rote verbal memory.'
            },
            {
              stepNumber: 3,
              title: 'Beat-to-Beat Improv Run',
              durationRatio: 0.25,
              instructions:
                'Deliver the outline of your speech out loud, moving from beat to beat using different words each time. Focus only on capturing the core truth of each beat.',
              focusCue: 'Embrace natural phrasing variations; you are having a conversation, not reciting poetry.',
              pitfallToAvoid: 'Stopping and restarting when you don’t say the "exact right sentence."',
              layer: 'adherence',
              layerReasoning:
                'Varied practice builds fluid rhetorical pathways, ensuring you can never get lost on stage.'
            }
          ]
        },
        {
          workoutType: 'slide_minimalism',
          title: 'Duarte Sparkline Design: Visual Minimalism',
          focus: 'Design high-impact, text-free visual slides that amplify emotion rather than distract from your presence.',
          isRestDay: false,
          baseDurationMinutes: 40,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'The Zero-Bullet-Point Rule Audit',
              durationRatio: 0.35,
              instructions:
                'Review your slide deck. Delete every bullet point, paragraph, and chart label. Restrict slides to a maximum of 1 evocative full-bleed photograph, 1 clean diagram, or 1 giant bold statistic per slide.',
              focusCue: 'You are the presentation; the screen is merely stage lighting.',
              pitfallToAvoid: 'Putting your speech notes on the screen so the audience reads ahead of you.',
              layer: 'mechanism',
              layerReasoning:
                'Cognitive psychology proves humans cannot read text and listen to a speaker simultaneously (the split-attention effect).'
            },
            {
              stepNumber: 2,
              title: 'The Sparkline "What Is vs What Could Be" Mapping',
              durationRatio: 0.4,
              instructions:
                'Map your presentation onto Nancy Duarte’s sparkline: identify where you introduce the tension of the current reality ("What Is") and where you pivot to the inspiring potential future ("What Could Be").',
              focusCue: 'Ensure every low point of problem awareness is answered by a high point of hopeful agency.',
              pitfallToAvoid: 'A flat linear recitation of facts with zero emotional contrast.',
              layer: 'mechanism',
              layerReasoning:
                'Contrast creates neurological dopamine spikes that sustain active audience engagement.'
            },
            {
              stepNumber: 3,
              title: 'Blank Slide Integration (The "B" Key Drill)',
              durationRatio: 0.25,
              instructions:
                'Identify 3 key moments in your talk where the audience should focus 100% on you. Insert a pure black slide or practice pressing the "B" key to blank the projector screen.',
              focusCue: 'When the screen goes dark, all human attention locks onto your eyes.',
              pitfallToAvoid: 'Leaving a bright irrelevant slide on screen while delivering an emotional climax.',
              layer: 'safety',
              layerReasoning:
                'Intentional visual blackouts direct maximum emotional focus toward critical rhetorical appeals.'
            }
          ]
        },
        {
          workoutType: 'dress_rehearsal_recording',
          title: 'Full Video Dress Rehearsal & Ah-Counter Audit',
          focus: 'Perform an unbroken video dress rehearsal of your current material; audit pacing and filler words.',
          isRestDay: false,
          baseDurationMinutes: 50,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Pre-Rehearsal Physiological Sigh & Centering',
              durationRatio: 0.15,
              instructions:
                'Execute 3 Andrew Huberman physiological sighs: two quick sniffs in through the nose, followed by a long, slow exhale through the mouth. Roll shoulders and ground your feet.',
              focusCue: 'Feel your heart rate decelerate and your peripheral vision widen.',
              pitfallToAvoid: 'Starting rehearsal while anxious and out of breath.',
              layer: 'safety',
              layerReasoning:
                'Physiological sighs rapidly rebalance oxygen/carbon-dioxide ratios and activate parasympathetic calming.'
            },
            {
              stepNumber: 2,
              title: 'Unbroken Video Dress Rehearsal',
              durationRatio: 0.6,
              instructions:
                'Record an unbroken video run of your speech material (minimum 5–8 minutes). Do not stop for mistakes; recover gracefully and push through to the end exactly as on a live stage.',
              focusCue: 'If you stumble, take a silent 2-second pause, smile, and deliver the next beat.',
              pitfallToAvoid: 'Stopping the recording midway because of a small mistake.',
              layer: 'adherence',
              layerReasoning:
                'Stage resilience is built by practicing recovery under simulated live performance constraints.'
            },
            {
              stepNumber: 3,
              title: 'The Harsh Video Audit: Ah-Counter & Pacing Count',
              durationRatio: 0.25,
              instructions:
                'Watch the video playback. Tally every single filler word ("um", "uh", "so", "like"). Calculate your filler word rate: (Total Fillers / Total Minutes). Write the score in your speech log.',
              focusCue: 'Observe your hands: are they open and expressive, or fidgeting?',
              pitfallToAvoid: 'Cringing and turning off the video; objective measurement is the only path to mastery.',
              layer: 'adherence',
              layerReasoning:
                'Self-confrontation via video playback extinguishes subconscious blind spots faster than any other method.'
            }
          ]
        },
        {
          workoutType: 'master_speech_study',
          title: 'Active Recovery: Master Orator Breakdown',
          focus: 'Rest your vocal cords; deconstruct a world-class TED speech (Sir Ken Robinson or Steve Jobs).',
          isRestDay: true,
          baseDurationMinutes: 20,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Sir Ken Robinson "Do Schools Kill Creativity?" Breakdown',
              durationRatio: 0.65,
              instructions:
                'Watch the first 10 minutes of Sir Ken Robinson’s famous TED talk. Note how he uses self-deprecating humor, deliberate 3-second pauses, and zero slides to completely captivate the room.',
              focusCue: 'Observe how comfortable he is with quiet chuckles and pauses before delivering a punchline.',
              pitfallToAvoid: 'Watching passively as entertainment; take notes on his vocal rhythm and pauses.',
              layer: 'mechanism',
              layerReasoning:
                'Studying the most-viewed TED talk in history reveals that warmth, authenticity, and humor trump flashy slide decks.'
            },
            {
              stepNumber: 2,
              title: 'Speech Journal Synthesis',
              durationRatio: 0.35,
              instructions:
                'Write down 2 specific techniques from the master talk that you want to borrow for your own speech (e.g., "Use a 3-second pause after asking the big question"). Hydrate with warm herbal tea.',
              focusCue: 'Synthesize inspiration into your personal delivery style.',
              pitfallToAvoid: 'Practicing public speaking on your vocal recovery day.',
              layer: 'safety',
              layerReasoning:
                'Vocal cords are delicate muscles; complete silence and hydration prevent vocal fatigue and strain.'
            }
          ]
        }
      ]
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Aristotle’s Rhetorical Triad: Ethos, Pathos, and Logos',
      objective: 'Balance credible evidence (logos), personal authority (ethos), and heartfelt emotion (pathos) in Act 1.',
      keyMilestone: 'Complete full script outline with all three rhetorical appeals explicitly audited and tagged.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'The Jaw-Dropping Moment: Creating the Emotional Climax',
      objective: 'Design and script the signature "Bill Gates releasing mosquitoes" memorable peak of the speech.',
      keyMilestone: 'Script and rehearse the 2-minute climax moment; verify it creates visceral audience emotional response.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Phase 1 Hard-Gate Milestone: 5-Minute Slide-Free Delivery',
      objective: 'Complete Phase 1 hard-gate evaluation: deliver opening 5 minutes slide-free with <3 fillers/min.',
      keyMilestone: 'Phase 1 Hard-Gate Cleared: 5-minute memory delivery audited at <3 filler words/min and locked throughline.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Vocal Variety: Pitch Drops, Whispers & Tempo Shifts',
      objective: 'Banish monotone speech patterns by introducing deliberate dynamic vocal range across emotional beats.',
      keyMilestone: 'Deliver Act 2 with audited pitch modulation and a dramatic volume drop during the core insight.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'The Stage Floor Grid: Purposeful Choreography',
      objective: 'Map the stage into 3 physical zones (Past, Present, Future); step intentionally with story transitions.',
      keyMilestone: 'Perform 8-minute run moving cleanly between 3 stage zones without nervous drifting or pacing.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Humor & Story Polish: The 3-Beat Comic Rule',
      objective: 'Weave 2 authentic humorous anecdotes into the narrative to release audience tension and build warmth.',
      keyMilestone: 'Test humor beats with 2 live listeners; verify punchline delivery pauses are held for 3 seconds.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Phase 2 Hard-Gate Milestone: Complete 12-Minute Memory Run',
      objective: 'Clear the 12-minute barrier on video with zero notes, zero slides, and <1 audible filler word per minute.',
      keyMilestone: 'Phase 2 Hard-Gate Cleared: 12-minute unbroken delivery recorded on video with <1 filler word/min.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Stress Inoculation & Distraction Resistance',
      objective: 'Rehearse under challenging simulated conditions: loud background noise, unexpected interruptions, and room heat.',
      keyMilestone: 'Deliver full speech without breaking focus while an assistant creates 3 planned stage interruptions.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'The Climax Call to Action & Unforgettable Closing Line',
      objective: 'Craft and polish the final 60-second empowering call to action and closing sentence that resonates.',
      keyMilestone: 'Deliver the 2-minute closing sequence with flawless resonance and a 5-second final silent gaze.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Full Dress Rehearsal with Microphones & Staging',
      objective: 'Rehearse in full stage outfit with lavalier/handheld microphone, stage clicker, and official timing lights.',
      keyMilestone: 'Complete two consecutive full 15-minute dress runs clocking between 14:00 and 14:45.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Phase 3 Mastery Capstone: The 15-Minute Live Keynote Delivery',
      objective: 'Deliver the official 15-minute TED-style keynote speech before a live audience with standing impact.',
      keyMilestone: 'Official 15-Minute TED-Style Speech Delivered to Live Audience with standing feedback and zero slide crutches.',
      targetIntensity: 100,
      workoutArchetypes: []
    }
  ]
};

// Replicate week 1 workoutArchetypes to weeks 2-12 if empty
for (let i = 1; i < speechPreset.weeks.length; i++) {
  if (!speechPreset.weeks[i].workoutArchetypes || speechPreset.weeks[i].workoutArchetypes.length === 0) {
    speechPreset.weeks[i].workoutArchetypes = speechPreset.weeks[0].workoutArchetypes;
  }
}
