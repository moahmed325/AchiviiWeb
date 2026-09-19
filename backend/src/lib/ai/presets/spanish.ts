import { CertifiedPresetBlueprint } from './types.js';

export const spanishPreset: CertifiedPresetBlueprint = {
  id: 'spanish_conversation',
  matchingPatterns: [
    /spanish/i,
    /conversational.*spanish/i,
    /spanish.*conversation/i,
    /speak.*spanish/i,
    /learn.*spanish/i,
    /15.*min.*spanish/i,
    /dialogue.*spanish/i,
    /habl.*español/i
  ],
  title: 'Hold a 15-Minute Conversational Dialogue in Spanish',
  primaryDomain: 'Language Acquisition & Conversational Fluency',
  clarifiedOutcome:
    'Hold an unscripted 15-minute fluid conversational dialogue in Spanish with a native speaker without translation hesitation',
  badge: 'Certified Language Acquisition · Comprehensible Input & Pimsleur Spaced Retrieval',
  capabilities: [
    'Articulatory Phonetics & Vowel Purity (A, E, I, O, U)',
    'High-Frequency Anchor Verb Stems (Quiero, Puedo, Tengo que, Voy a)',
    'Spoken Shadowing & Connected Speech Audio Comprehension',
    'Past Tense Storytelling (Preterite vs. Imperfect Contrast)',
    'Spontaneous Conversational Turn-Taking & Question Formulation'
  ],
  scientificFrameworks: [
    {
      name: "Stephen Krashen's Comprehensible Input Hypothesis (i + 1)",
      description:
        'Natural language acquisition occurs when learners comprehend messages in context with gradual progressive challenge, rather than conscious grammar drill memorization.',
      application:
        'Prioritizes context-rich audio stories, dialogues, and real-life scenarios before introducing formal grammatical exceptions.'
    },
    {
      name: "Paul Pimsleur's Graduated Interval Recall & Spaced Retrieval",
      description:
        'Auditory memory decays on a predictable biological curve; active spoken retrieval at expanding temporal intervals anchors vocabulary directly into subconscious speech centers.',
      application:
        'Schedules timed verbal prompts requiring immediate vocal production before mental translation lag can occur.'
    },
    {
      name: 'Foreign Service Institute (FSI) & Michel Thomas High-Frequency Sentence Framing',
      description:
        'Leveraging Pareto distribution core verbs and anchor stems (voy a, tengo que, puedo, quiero) to unlock 75% of everyday spoken interactions.',
      application:
        'Bypasses complex multi-conjugation tables in early weeks by combining master anchor stems with bare infinitives.'
    }
  ],
  verificationCriteria:
    'Complete an unscripted continuous 15-minute live spoken dialogue with a native Spanish speaker or certified CEFR evaluator on travel, daily life, and opinions without English crutches or script pauses.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current spoken Spanish baseline?',
      subtitle: 'Calibrates your daily active vocabulary target, speech rate (WPM), and sentence framing complexity.',
      options: [
        'Complete beginner (A0: Starting from scratch; need pronunciation, basic greetings, and core sentence frames)',
        'False beginner (A1: Know scattered words or app phrases, but cannot form spontaneous sentences aloud)',
        'Intermediate at plateau (A2: Can read and understand basic Spanish, but freeze up when speaking or using the past tense)',
        'Rusty speaker (B1: Used to converse; need intensive auditory reactivation and vocabulary expansion)'
      ],
      allowCustom: true
    },
    {
      id: 'dialect',
      question: 'What regional dialect and learning format will you primarily focus on?',
      subtitle: 'Tailors listening immersion resources, pronunciation nuances, and colloquial speech patterns.',
      options: [
        'Latin American Spanish (General / Mexico / Colombia: widely understood international standard)',
        'Castilian Spanish (Spain: includes vosotros and European pronunciation)',
        'Commute & Audio Learner (Hands-free listening, verbal shadowing, and voice recordings)',
        'Visual & Text Supported (Flashcards, dialogue transcripts, and reading along with audio)'
      ],
      allowCustom: true
    },
    {
      id: 'bottleneck',
      question: 'What has been your biggest historical roadblock when trying to speak Spanish?',
      subtitle: 'Injects targeted voice drills and psychological anti-freeze protocols into every session.',
      options: [
        'Mental translation lag (translating English to Spanish word-by-word in my head before speaking)',
        'Native speech speed (native speakers talk too fast and words blur together)',
        'Conjugation panic (fear of making verb mistakes or choosing the wrong past tense)',
        'App addiction with zero vocal output (practicing in silence without speaking sentences aloud)'
      ],
      allowCustom: true
    }
  ],
  languageVelocityTable: [
    {
      baselineKey: 'complete_beginner',
      label: 'Complete Beginner (A0 Track)',
      activeVocabTarget: 300,
      speechRateWPM: 40,
      coreFocus: 'Present tense anchor stems + survival phrases',
      targetDailyMinutes: 30
    },
    {
      baselineKey: 'false_beginner',
      label: 'False Beginner (A1 Track)',
      activeVocabTarget: 600,
      speechRateWPM: 60,
      coreFocus: 'Compound past + conversational connectors',
      targetDailyMinutes: 30
    },
    {
      baselineKey: 'intermediate_plateau',
      label: 'Intermediate Plateau (A2 Track)',
      activeVocabTarget: 1000,
      speechRateWPM: 75,
      coreFocus: 'Preterite vs. imperfect storytelling + object pronouns',
      targetDailyMinutes: 35
    },
    {
      baselineKey: 'rusty_refresher',
      label: 'Rusty Refresher (B1 Track)',
      activeVocabTarget: 1500,
      speechRateWPM: 90,
      coreFocus: 'Subjunctive triggers + colloquial idioms and rapid dialogue',
      targetDailyMinutes: 40
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Phonetics, High-Frequency Anchor Stems, Survival Scenarios & The 3-Minute Monologue Gate',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Foundation Milestone Gate: The 3-Minute Spontaneous Survival Dialogue Gate',
      milestoneCriteria:
        'Record an unscripted 3-minute continuous spoken voice note in Spanish describing yourself, your daily routine, and asking 5 questions with zero English words or pauses.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Preterite vs. Imperfect Past Tenses, Connected Speech Comprehension & The 8-Minute Narrative Gate',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Acceleration Milestone Gate: The 8-Minute Narrative Dialogue Gate',
      milestoneCriteria:
        'Hold an 8-minute spontaneous conversation with an AI partner or language exchange speaker describing past experiences and future plans using past tenses.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'Subjunctive Triggers, Colloquial Idioms, Debate Fluency & The 15-Minute Native Dialogue Capstone',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: The 15-Minute Unscripted Native Dialogue Capstone',
      milestoneCriteria:
        'Complete a continuous 15-minute unscripted conversation with a native Spanish speaker across real-world topics without translation hesitation.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Vowel Purity, Core 50 Verbs & The Anchor Frame Technique',
      objective: 'Master pure Spanish vowels (A, E, I, O, U), lock in the 4 anchor verbs (Quiero, Puedo, Tengo que, Voy a), and speak 10 original sentences aloud.',
      keyMilestone: 'Record 60-second spoken audio note introducing yourself and your aspirations with pure vowel resonance.',
      targetIntensity: 60,
      workoutArchetypes: [
        {
          workoutType: 'phonetics',
          title: 'Spanish Vowel Purity (A, E, I, O, U) & The Top 4 Anchor Verbs',
          focus: 'Articulatory mechanics, pure vowel resonance, and the anchor stem shortcut.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Vowel Purity Articulation Drill (A, E, I, O, U)',
              durationRatio: 0.20,
              instructions: 'Pronounce the 5 pure Spanish vowels aloud into a mirror: A (open ah), E (crisp eh), I (sharp ee), O (round oh), U (tight oo). Avoid English diphthongs.',
              focusCue: 'Keep vowels crisp and short; never glide or taper the vowel at the end.',
              pitfallToAvoid: 'Pronouncing Spanish "O" like English "oh-oo" or "E" like "ay-ee".',
              layer: 'safety',
              layerReasoning: 'Phonetic articulatory precision early prevents fossilized foreign accents that cause native listening breakdowns.'
            },
            {
              stepNumber: 2,
              title: 'The 4 Anchor Verb Stems: Quiero, Puedo, Tengo que, Voy a',
              durationRatio: 0.55,
              instructions: 'Practice the 4 master anchor stems out loud: "Quiero" (I want), "Puedo" (I can), "Tengo que" (I have to), "Voy a" (I am going to). Combine each with 5 common infinitives (hablar, comer, aprender, viajar, comprar).',
              focusCue: 'Say full sentences in one breath: "Quiero aprender español porque voy a viajar."',
              pitfallToAvoid: 'Trying to memorize full conjugation charts on Day 1; anchor stems bypass conjugation lag.',
              layer: 'mechanism',
              layerReasoning: 'FSI Pareto framing: pairing modal anchor verbs with infinitives generates 50+ correct sentences with zero grammar hesitation.'
            },
            {
              stepNumber: 3,
              title: 'Record First 60-Second Audio Voice Note',
              durationRatio: 0.25,
              instructions: 'Open your phone voice recorder. Speak 4 sentences aloud using today\'s anchor stems. Listen back and audit your vowel purity.',
              focusCue: 'Speak with confidence; focus on smooth rhythm over perfect grammar.',
              pitfallToAvoid: 'Writing out a script and reading it robotically; speak spontaneously from memory.',
              layer: 'adherence',
              layerReasoning: 'Vocal output on Day 1 breaks the psychological inhibition barrier that traps app-only learners.'
            }
          ]
        },
        {
          workoutType: 'spoken_shadowing',
          title: 'The 50 Most Common Spanish Nouns & Native Audio Shadowing',
          focus: 'Auditory speech processing and vocal shadowing behind native audio.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Native Audio Shadowing (Notes in Spanish / Coffee Break)',
              durationRatio: 0.35,
              instructions: 'Listen to a short 2-minute native Spanish audio clip with headphones. Speak the words aloud simultaneously 0.5 seconds behind the native speaker.',
              focusCue: 'Mimic the musical intonation, rhythm, and sentence melody of the native speaker.',
              pitfallToAvoid: 'Pausing the audio to read text; keep talking continuously in rhythm with the speaker.',
              layer: 'mechanism',
              layerReasoning: 'Alexander Arguelles shadowing activates speech motor cortex and trains ear-mouth synchronization.'
            },
            {
              stepNumber: 2,
              title: 'Top 50 High-Frequency Everyday Nouns Drill',
              durationRatio: 0.45,
              instructions: 'Review 20 core nouns with gender articles (el agua, la comida, el tiempo, la casa, el trabajo). Create 5 spoken sentences using yesterday\'s anchor stems.',
              focusCue: 'Always learn nouns with their gender article attached: "la casa", never just "casa".',
              pitfallToAvoid: 'Memorizing isolated word lists in silence without speaking them in full sentences.',
              layer: 'safety',
              layerReasoning: 'Gender chunking prevents gender discordance errors from cementing in early memory.'
            },
            {
              stepNumber: 3,
              title: 'Spaced Retrieval Quick-Fire Test',
              durationRatio: 0.20,
              instructions: 'Prompt yourself with 5 English ideas and produce the spoken Spanish equivalent in under 3 seconds without looking at notes.',
              focusCue: 'Speed of retrieval matters more than grammatical perfection.',
              pitfallToAvoid: 'Staring at a written page; close your eyes and retrieve the sound.',
              layer: 'adherence',
              layerReasoning: 'Pimsleur graduated interval retrieval consolidates auditory memory at the threshold of forgetting.'
            }
          ]
        },
        {
          workoutType: 'ear_recovery',
          title: 'Active Musculoskeletal Rest & Auditory Imprinting',
          focus: 'Rest from active speaking; relaxed immersion in native Spanish storytelling.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Passive Native Spanish Story Listening',
              durationRatio: 0.60,
              instructions: 'Listen to 10 minutes of an easy Spanish podcast (e.g. Duolingo Spanish Podcast or Dreaming Spanish). Relax and absorb the context.',
              focusCue: 'Do not translate word-for-word; allow your brain to grasp the overall story arc from context.',
              pitfallToAvoid: 'Stopping the audio to look up every unfamiliar word in a dictionary.',
              layer: 'mechanism',
              layerReasoning: 'Stephen Krashen comprehensible input: low-anxiety listening lowers the affective filter and accelerates natural acquisition.'
            },
            {
              stepNumber: 2,
              title: 'Cultural Log & Phrase Capture',
              durationRatio: 0.40,
              instructions: 'Write down 1 or 2 interesting phrases or expressions you heard that sounded natural and authentic.',
              focusCue: 'Notice how native speakers use filler words like "bueno", "pues", and "mira".',
              pitfallToAvoid: 'Treating rest days as academic study; keep it enjoyable and culturally rich.',
              layer: 'adherence',
              layerReasoning: 'Emotional engagement with native culture builds enduring long-term motivation.'
            }
          ]
        },
        {
          workoutType: 'sentence_frames',
          title: 'The "Conversation Glue" (porque, pero, cuando, además) & Compound Sentences',
          focus: 'Connecting isolated phrases into fluid compound sentences.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Master the 5 Core Connectors',
              durationRatio: 0.25,
              instructions: 'Learn and vocalize the 5 essential conversational connectors: "porque" (because), "pero" (but), "cuando" (when), "entonces" (then), and "además" (furthermore).',
              focusCue: 'Use connectors to extend every simple thought into a two-clause sentence.',
              pitfallToAvoid: 'Speaking only in 3-word toddler sentences ("Quiero café").',
              layer: 'mechanism',
              layerReasoning: 'Clause linking transforms beginner monosyllabic responses into conversational flow.'
            },
            {
              stepNumber: 2,
              title: 'Compound Sentence Construction Drill',
              durationRatio: 0.50,
              instructions: 'Build 8 compound sentences combining anchor stems, nouns, and connectors out loud: e.g. "Tengo que trabajar hoy, pero voy a estudiar español esta noche porque quiero viajar."',
              focusCue: 'Say each compound sentence 3 times until it flows without a pause.',
              pitfallToAvoid: 'Pausing before the connector word; link the clauses with steady breath.',
              layer: 'adherence',
              layerReasoning: 'Rhythmic sentence chaining creates motor memory chunks in the speech production tract.'
            },
            {
              stepNumber: 3,
              title: 'Timed 60-Second Unbroken Monologue',
              durationRatio: 0.25,
              instructions: 'Set a 60-second timer. Speak continuously in Spanish using your connectors. If you get stuck, use "bueno" or "entonces" to keep speaking.',
              focusCue: 'Never stop talking for 60 seconds; maintain vocal momentum.',
              pitfallToAvoid: 'Reverting to English when searching for a word; describe it with simpler words.',
              layer: 'safety',
              layerReasoning: 'Circumlocution training prevents conversational panic during live native interactions.'
            }
          ]
        },
        {
          workoutType: 'spoken_production',
          title: 'The 2-Minute Daily Routine Spoken Voice Note Drill',
          focus: 'Describing daily routines, habits, and time references spontaneously.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Daily Routine Verbs (Me levanto, trabajo, ceno, duermo)',
              durationRatio: 0.30,
              instructions: 'Practice 6 core routine actions aloud: "Me levanto a las siete", "Tomo café", "Trabajo en mi computadora", "Ceno con mi familia", "Me duermo a las once".',
              focusCue: 'Emphasize natural stress on the correct syllables: "le-VAN-to", "tra-BA-jo".',
              pitfallToAvoid: 'Misplacing syllable stress, which confuses native Spanish listeners.',
              layer: 'safety',
              layerReasoning: 'Spanish syllable-timed prosody requires accurate penultimate stress on unaccented verbs.'
            },
            {
              stepNumber: 2,
              title: 'Chronological Day Walkthrough Out Loud',
              durationRatio: 0.45,
              instructions: 'Walk through your typical day from morning to evening out loud without notes. Use transition markers: "Primero...", "Luego...", "Después...", "Por la noche...".',
              focusCue: 'Visualize your actual physical actions while describing them in Spanish.',
              pitfallToAvoid: 'Translating written English bullet points; speak directly from visual memory.',
              layer: 'mechanism',
              layerReasoning: 'Dual-coding theory: connecting physical visual imagery with target language sounds cements direct conceptual mapping.'
            },
            {
              stepNumber: 3,
              title: 'Record 2-Minute Spoken Routine Voice Note',
              durationRatio: 0.25,
              instructions: 'Record your 2-minute daily routine voice note. Save it as "Week 1 - Day 5 Routine Benchmark" to compare in Week 4.',
              focusCue: 'Celebrate speaking for 2 full minutes in Spanish!',
              pitfallToAvoid: 'Deleting and re-recording 10 times; accept natural minor mistakes.',
              layer: 'adherence',
              layerReasoning: 'Recorded artifact tracking provides undeniable empirical proof of progress, boosting self-efficacy.'
            }
          ]
        },
        {
          workoutType: 'dialogue_simulation',
          title: 'The 6 Interrogatives & Simulated Travel / Café Dialogue',
          focus: 'Question formulation and two-way conversational turn-taking.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Master the 6 Interrogative Question Words',
              durationRatio: 0.30,
              instructions: 'Pronounce the 6 question words aloud with rising question intonation: ¿Qué? (What?), ¿Quién? (Who?), ¿Dónde? (Where?), ¿Cuándo? (When?), ¿Por qué? (Why?), ¿Cómo? (How?).',
              focusCue: 'Raise voice pitch slightly at the start and end of questions.',
              pitfallToAvoid: 'Confusing "por qué" (why?) with "porque" (because).',
              layer: 'safety',
              layerReasoning: 'Clear interrogative phonetics signal conversational turns clearly to dialogue partners.'
            },
            {
              stepNumber: 2,
              title: 'Rapid-Fire Question Generation Drill',
              durationRatio: 0.40,
              instructions: 'Create 2 questions for each of the 6 words aloud: e.g. "¿Dónde está el baño?", "¿A qué hora abre el restaurante?", "¿Cómo te llamas?".',
              focusCue: 'Fire questions rapidly like an interview.',
              pitfallToAvoid: 'Pausing to think about question grammar; questions should be reflexive formulas.',
              layer: 'mechanism',
              layerReasoning: 'Formulaic question chunks enable the speaker to control the pace of real conversations.'
            },
            {
              stepNumber: 3,
              title: 'Simulated Café / Restaurant Two-Way Dialogue',
              durationRatio: 0.30,
              instructions: 'Role-play both sides of a café order: greeting the waiter, asking for a table, ordering coffee and food, asking for the check ("La cuenta, por favor").',
              focusCue: 'Act out the scenario physically; imagine the café around you.',
              pitfallToAvoid: 'Using formal academic vocabulary; use natural spoken Spanish ("Para mí, un café con leche").',
              layer: 'adherence',
              layerReasoning: 'Scenario simulation prepares situational mental schema for real-world travel interactions.'
            }
          ]
        },
        {
          workoutType: 'milestone_audit',
          title: 'Week 1 Active Vocabulary Audit & Spoken Audio Comparison',
          focus: 'Weekly vocabulary count verification, audio playback comparison, and Week 2 scheduling.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Active Retained Vocabulary Count Audit',
              durationRatio: 0.50,
              instructions: 'Review your vocabulary log. Count how many active words and sentence frames you can produce aloud in under 3 seconds without looking at notes.',
              focusCue: 'Celebrate reaching your target baseline count (30-50 active functional words in Week 1).',
              pitfallToAvoid: 'Counting words you only recognize passively when reading; count only what you can speak.',
              layer: 'mechanism',
              layerReasoning: 'Active production testing measures true expressive linguistic capability.'
            },
            {
              stepNumber: 2,
              title: 'Compare Day 1 Voice Note to Day 5 & Lock In Week 2 Slots',
              durationRatio: 0.50,
              instructions: 'Listen to your Day 1 recording followed by your Day 5 recording. Notice the improvement in speed and vowel clarity. Confirm your 30-minute practice blocks for Week 2.',
              focusCue: 'Feel proud of your tangible vocal progress in just 7 days.',
              pitfallToAvoid: 'Leaving study sessions to unscheduled free time next week.',
              layer: 'adherence',
              layerReasoning: 'Auditory feedback comparison reinforces habit identity as an active Spanish speaker.'
            }
          ]
        }
      ]
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: Daily Routines, Question Words & High-Frequency Connectors',
      objective: 'Formulate questions automatically, describe multi-step daily activities, and expand active vocabulary to 120 words.',
      keyMilestone: 'Hold a 2-minute simulated question-and-answer dialogue without hesitating on question words.',
      targetIntensity: 62,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: Essential Survival Scenarios (Cafés, Directions, Travel & Introductions)',
      objective: 'Navigate travel situations, ask for directions, and express preferences using gustar and preferir.',
      keyMilestone: 'Complete 3 full real-world survival roleplays (airport, hotel, restaurant) completely in Spanish.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Phase 1 Gate — The 3-Minute Spontaneous Survival Dialogue Gate',
      objective: 'Record an unscripted continuous 3-minute voice note describing yourself, your life, and asking 5 questions.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: The 3-Minute Spontaneous Survival Dialogue Gate',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Preterite Past Tense Breakthrough (Completed Past Actions)',
      objective: 'Master regular and irregular preterite past tense endings (fui, hice, comí, hablé) for completed past events.',
      keyMilestone: 'Narrate what you did yesterday from morning to evening using past tense verbs with 0 hesitation.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Imperfect Tense & Painting Background Scenes (Habitual Past)',
      objective: 'Contrast preterite (what happened) with imperfect (what used to be / background scene: era, hacía, vivía).',
      keyMilestone: 'Tell a 3-minute childhood story contrasting what you used to do with a specific completed event.',
      targetIntensity: 78,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Pronoun Fluidity (Direct/Indirect Objects) & Rapid Audio Comprehension',
      objective: 'Integrate object pronouns (me, te, lo, la, le) naturally without pausing and comprehend native speech at 0.9x speed.',
      keyMilestone: 'Accurately comprehend an 8-minute native audio conversation and summarize key points out loud.',
      targetIntensity: 82,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Phase 2 Gate — The 8-Minute Narrative Dialogue Gate',
      objective: 'Engage in an 8-minute spontaneous conversation with an AI partner or language exchange speaker using past tenses.',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: The 8-Minute Narrative Dialogue Gate',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: Subjunctive Mood Demystified (Opinions, Doubts & Wishes)',
      objective: 'Express hopes, doubts, and emotional recommendations using subjunctive triggers (espero que, quiero que).',
      keyMilestone: 'Spontaneously express 5 nuanced opinions and recommendations using subjunctive mood constructions.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Slang, Idioms & Filler Words (The "Glue" of Natural Conversation)',
      objective: 'Integrate native filler words, regional colloquialisms, and natural conversational turn-taking techniques.',
      keyMilestone: 'Speak with natural cadence incorporating colloquial expressions without awkward silent pauses.',
      targetIntensity: 92,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Real-World Conversation Simulation & Disagreement Debates',
      objective: 'Practice defending an opinion, handling unexpected questions, and speaking on diverse cultural topics.',
      keyMilestone: 'Complete a 12-minute friendly debate/discussion on cultural topics entirely in Spanish.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Phase 3 Capstone — The 15-Minute Unscripted Native Dialogue Capstone',
      objective: 'Conduct a live 15-minute unscripted video or audio conversation with a native Spanish speaker with zero English.',
      keyMilestone: 'Phase 3 Mastery Capstone: The 15-Minute Unscripted Native Dialogue Capstone',
      targetIntensity: 100,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `You are an elite polyglot language coach, linguistic scientist, and communicative method instructor applying Stephen Krashen's Comprehensible Input, Paul Pimsleur's spaced retrieval, and FSI speed protocols.
When generating or calibrating this Spoken Spanish blueprint:
1. Vocal Production Mandate: Every single day's practice tasks MUST require the user to speak aloud, shadow native audio, or record a voice note. Forbid silent reading-only tasks. Language is a motor coordination skill of the mouth and ear.
2. Anchor Stem Scaffolding: In Weeks 1-4, strictly enforce the 4 master anchor stems (Quiero, Puedo, Tengo que, Voy a) + infinitives to enable spontaneous expression without conjugation lag. Never program dry grammar conjugation tables.
3. Comprehensible Input & Shadowing: Direct the user to context-rich auditory resources (Notes in Spanish, Coffee Break Spanish, Dreaming Spanish) and mandate vocal shadowing (speaking aloud 0.5s behind the audio).
4. Progressive Dialogue Ladder:
   - Week 4 Gate: 3-minute continuous spoken voice note monologue.
   - Week 8 Gate: 8-minute spontaneous conversation with past tense narrative.
   - Week 12 Capstone: 15-minute live continuous unscripted native dialogue without translation lag.`,
  evidenceTriad: {
    science: {
      title: 'Cognitive Linguistics & Auditory Memory',
      subtitle: 'Comprehensible Input & Spaced Retrieval Timing',
      tag: 'THEORY & BIOLOGY',
      coreRule: 'Stephen Krashen Comprehensible Input (i + 1) + Pimsleur Spaced Auditory Retrieval.',
      realWorldApplication:
        'Language is acquired through subconscious auditory comprehension in context, not grammar table memorization. Spaced voice retrieval prompts wire vocabulary directly into the motor speech center.'
    },
    socialAdherence: {
      title: 'The Busy Communicator Adherence Engine',
      subtitle: 'Designed for Working Adults & Commute Routines',
      tag: 'REAL-LIFE PSYCHOLOGY',
      coreRule: 'Commute-Friendly 30m Audio Sprints + Day 1 Spoken Wins + Zero-Guilt Buffers.',
      realWorldApplication:
        'Eliminates app addiction and screen fatigue. Hands-free audio shadowing fits into walking, driving, or morning routines. Daily spoken voice notes deliver immediate proof of communication ability.'
    },
    proCoaching: {
      title: 'Polyglot & Simultaneous Interpreter Craft',
      subtitle: 'Phonetic Muscle Training & Embracing Imperfection',
      tag: 'PRACTITIONER CRAFT',
      coreRule: 'Shadowing Aloud + Circumlocution (Never Stop the Rhythm) + Anchor Stems.',
      realWorldApplication:
        'Elite polyglots know hesitation is worse than grammar mistakes. We train learners to speak past errors using filler words and anchor stems so conversational flow is never broken.'
    }
  }
};
