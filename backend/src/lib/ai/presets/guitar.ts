import { CertifiedPresetBlueprint } from './types.js';

export const guitarPreset: CertifiedPresetBlueprint = {
  id: 'guitar5songs',
  matchingPatterns: [
    /guitar/i,
    /play.*5.*(song|classic)/i,
    /5.*(song|classic).*guitar/i,
    /popular.*guitar/i,
    /campfire.*guitar/i,
    /acoustic.*guitar/i,
    /learn.*guitar/i,
    /acoustic/i,
    /chords/i,
    /fingerpicking/i
  ],
  title: 'Play 5 Iconic Guitar Songs from Memory',
  primaryDomain: 'Acoustic Guitar & Neuromuscular Motor Chunking',
  clarifiedOutcome:
    'Play 5 universally recognized acoustic guitar songs completely from memory with clean chord transitions, steady rhythm, and zero hesitations',
  badge: 'Certified Deliberate Practice · JustinGuitar & Berklee Ergonomic Method',
  capabilities: [
    'Thumb-Behind-Neck Ergonomics & Clean String Fretting',
    'The 1-Minute Chord Change Protocol (Em, G, C, D, Am)',
    'Anchor Finger Economy & 16th-Note Syncopated Strumming',
    'The F-Barre Leverage Breakthrough & Percussive Muting',
    'Arpeggiated Fingerpicking (P-I-M-A) & Vocal Independence'
  ],
  scientificFrameworks: [
    {
      name: "Justin Sandercoe's 1-Minute Chord Change & Anchor Framework",
      description:
        'Time-boxed sub-skill isolation measuring clean transitions per 60 seconds combined with anchored pivot fingers.',
      application:
        'Enforces quantitative 30-to-60 switches/min benchmarks before permitting full-speed song playthroughs.'
    },
    {
      name: 'Berklee Ergonomics & P-I-M-A Motor Independence (William Leavitt)',
      description:
        'Gravity-assisted left-arm elbow leverage and classical right-hand fingerstyle mechanics (P-I-M-A).',
      application:
        'Eliminates thumb grip squeezing to prevent tendonitis and unlocks clean arpeggiated fingerpicking.'
    },
    {
      name: 'Suzuki Auditory Imprinting & Memory-Only Execution',
      description:
        'Pre-listening mental audio mapping and zero-tab performance automation.',
      application:
        'Bridges muscle memory from tablet reliance to confident campfire performance completely from memory.'
    }
  ],
  verificationCriteria:
    'Perform all 5 iconic songs in a continuous live recording or campfire setting completely from memory with steady 4/4 timing, clean chord resonance, and vocal or backing track accompaniment.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current comfortable acoustic guitar playing baseline?',
      subtitle: 'Calibrates your starting metronome tempo (BPM) and daily chord transition targets.',
      options: [
        'Complete beginner (Never held a guitar; starting from posture, tuning & first chords)',
        'Early beginner (Know 2-3 chords like Em, G, D, but pause for 2 seconds during switches)',
        'Novice at plateau (Can strum basic chords, but stuck on the F barre chord or singing while playing)',
        'Rusty returner (Played in the past; rebuilding fingertip calluses and muscle memory)'
      ],
      allowCustom: true
    },
    {
      id: 'hardware',
      question: 'What guitar hardware and setup will you primarily use?',
      subtitle: 'Tailors fingertip callus protection, neck ergonomics, and action height tips.',
      options: [
        'Steel-string acoustic (Standard dreadnought / campfire guitar with medium tension)',
        'Nylon-string classical (Wider fretboard spacing; gentler on fingertips)',
        'Electric guitar (Thinner neck profile, low string action; easiest on fingers)',
        'Need help choosing or setting up a guitar in Week 1'
      ],
      allowCustom: true
    },
    {
      id: 'bottleneck',
      question: 'What has been your biggest historical obstacle when trying to learn guitar?',
      subtitle: 'Injects targeted pre-practice warmups and recovery guardrails into every session.',
      options: [
        'Fingertip tenderness, raw skin, or left wrist fatigue after 15 minutes',
        'The "Stutter Gap" (strumming hand stops moving while left hand searches for frets)',
        'Cannot sing, talk, or look away from the fretboard while strumming',
        'Tutorial overload & inconsistency (learning 20 partial riffs without finishing 1 full song)'
      ],
      allowCustom: true
    }
  ],
  bpmPacingTable: [
    {
      baselineKey: 'complete_beginner',
      label: 'Complete Beginner (Starting BPM 55-60)',
      startingPracticeBPM: 55,
      switchesTargetPerMin: 30,
      songTargetBPM: 75,
      targetMetronomeRange: 'Practice: 55-60 BPM | Song 1 Target: 75 BPM'
    },
    {
      baselineKey: 'early_beginner',
      label: 'Early Beginner (Starting BPM 65-70)',
      startingPracticeBPM: 65,
      switchesTargetPerMin: 40,
      songTargetBPM: 85,
      targetMetronomeRange: 'Practice: 65-70 BPM | Song Target: 85 BPM'
    },
    {
      baselineKey: 'novice_plateau',
      label: 'Novice at Plateau (Starting BPM 75-80)',
      startingPracticeBPM: 75,
      switchesTargetPerMin: 50,
      songTargetBPM: 95,
      targetMetronomeRange: 'Practice: 75-80 BPM | Song Target: 95-105 BPM'
    },
    {
      baselineKey: 'rusty_returner',
      label: 'Rusty Returner (Starting BPM 80-85)',
      startingPracticeBPM: 80,
      switchesTargetPerMin: 60,
      songTargetBPM: 110,
      targetMetronomeRange: 'Practice: 80-85 BPM | Song Target: 110-120 BPM'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Fretboard Ergonomics, Callus Conditioning, Open Chords (Em, A7, G, C, D) & The 60-Switch Gate',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Gate: 60-Switch Diagnostic Benchmark & Song 1 Full Playthrough',
      milestoneCriteria:
        'Perform >=60 clean chord switches per minute between G<->C and Em<->D at 65 BPM without looking, and play Song 1 ("Stand By Me") from start to finish without pausing.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Anchor Finger Economy, 16th-Note Syncopated Strumming, Hybrid Picking & Songs 2 & 3',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Gate: The 3-Song Unbroken Memory Medley Gate',
      milestoneCriteria:
        'Play Song 1 ("Stand By Me"), Song 2 ("Wonderwall"), and Song 3 ("Wish You Were Here") back-to-back from memory at target tempo without pausing.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'The F-Barre Leverage Breakthrough, Arpeggiated Fingerpicking, Vocal Independence & Songs 4 & 5',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Capstone: The 5-Song Live Campfire Performance Benchmark',
      milestoneCriteria:
        'Perform all 5 iconic songs continuously from memory in front of an audience or continuous recording with steady 4/4 timing and vocal/accompaniment.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Posture, Clean Fretting Mechanics & The First 2 Chords (Em & A7)',
      objective: 'Establish correct thumb-behind-neck ergonomics, arch fingers cleanly without fret buzz, and execute 30 switches/min between Em and A7.',
      keyMilestone: 'Complete first 1-minute chord change test between Em and A7 hitting >=30 clean switches.',
      targetIntensity: 60,
      workoutArchetypes: [
        {
          workoutType: 'mechanics',
          title: 'Ergonomics, Thumb Pivot & The First 2 Chords (Em & A7)',
          focus: 'Posture, elbow leverage, eliminating buzz, and arching fingers cleanly.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Posture & Thumb Pivot Check',
              durationRatio: 0.15,
              instructions: 'Sit tall with guitar body resting against your torso. Place the left thumb flat behind the 2nd fret on the center of the neck.',
              focusCue: 'Keep wrist straight; imagine holding a small apple in the palm of your fretting hand.',
              pitfallToAvoid: 'Wrapping the thumb completely over the neck like a baseball bat, which flattens the fingers and mutes adjacent strings.',
              layer: 'safety',
              layerReasoning: 'Berklee ergonomic standard: straight wrist posture prevents median nerve compression and carpal tunnel inflammation.'
            },
            {
              stepNumber: 2,
              title: 'Clean Chord Architecture: Em & A7',
              durationRatio: 0.70,
              instructions: 'Fret E Minor using fingers 2 and 3 right behind the fret wire. Pick each string one by one to ensure all 6 ring cleanly. Switch to A7 using fingers 1 and 2.',
              focusCue: 'Land fingertips right on their tips at 90 degrees to the fretboard.',
              pitfallToAvoid: 'Pressing with the flat pads of your fingers, which unintentionally mutes the neighboring open strings.',
              layer: 'mechanism',
              layerReasoning: 'Single-string diagnostic audit provides immediate sensory feedback to accelerate motor cortical map calibration.'
            },
            {
              stepNumber: 3,
              title: 'Finger Callus Flush & Tendon Relaxation',
              durationRatio: 0.15,
              instructions: 'Place guitar on stand. Gently open and close your hands into soft fists, and lightly massage the forearms and fingertip pads.',
              focusCue: 'Breathe deeply and release any residual neck or shoulder tension.',
              pitfallToAvoid: 'Continuing to squeeze strings when fingertips are raw; calluses build from daily exposure, not blisters.',
              layer: 'adherence',
              layerReasoning: 'Short, daily 25-30m sessions stimulate keratinization of fingertip epidermal layers without dermal tearing.'
            }
          ]
        },
        {
          workoutType: 'chord_transitions',
          title: 'The 1-Minute Chord Change Test (Em <-> A7) & 60 BPM Down-Strums',
          focus: 'Speed isolation and locking in transitions without hesitation.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Fingertip Warm-up & Chromatic Spider Calibration',
              durationRatio: 0.15,
              instructions: 'Play 4 slow single notes on string 1 using fingers 1-2-3-4 with light pressure.',
              focusCue: 'Touch strings as softly as possible while still getting a clear ring.',
              pitfallToAvoid: 'Pressing as hard as you can; extra pressure wastes energy and slows transitions.',
              layer: 'safety',
              layerReasoning: 'Calibrates minimum necessary fretting force to prevent flexor tendonitis.'
            },
            {
              stepNumber: 2,
              title: 'JustinGuitar 1-Minute Chord Change Drill (Em <-> A7)',
              durationRatio: 0.70,
              instructions: 'Set a 60-second timer. Switch back and forth between Em and A7 as many times as possible with clean tone. Count every completed change.',
              focusCue: 'Move fingers as a unified unit rather than placing one finger at a time.',
              pitfallToAvoid: 'Stopping the right hand; strum once per change to confirm clean resonance.',
              layer: 'mechanism',
              layerReasoning: 'Time-boxed sub-skill isolation forces neuromuscular motor chunking by demanding rapid neural pathway retrieval.'
            },
            {
              stepNumber: 3,
              title: 'Log Change Count & Metronome Cooldown',
              durationRatio: 0.15,
              instructions: 'Log your exact number of completed changes. Strum Em to a 60 BPM metronome on beats 1, 2, 3, 4 for 2 minutes.',
              focusCue: 'Keep the right-hand wrist loose like brushing water off a table.',
              pitfallToAvoid: 'Stiff forearm strumming from the elbow.',
              layer: 'adherence',
              layerReasoning: 'Self-quantification reinforces progressive achievement and intrinsic motivation.'
            }
          ]
        },
        {
          workoutType: 'ear_recovery',
          title: 'Active Musculoskeletal Recovery & Ear Imprinting',
          focus: 'Fingertip skin recovery, tuning verification, and rhythm clapping.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Electronic Tuning & Pitch Verification',
              durationRatio: 0.50,
              instructions: 'Tune all 6 strings (E-A-D-G-B-E) using a clip-on tuner or phone app. Listen to each note ring out for 5 seconds.',
              focusCue: 'Sing or hum the pitch of the open A string as it rings.',
              pitfallToAvoid: 'Practicing on an out-of-tune guitar which corrupts pitch memory.',
              layer: 'safety',
              layerReasoning: 'Ensures auditory-motor mapping is formed on mathematically true acoustic intervals.'
            },
            {
              stepNumber: 2,
              title: 'Song 1 Auditory Imprinting (Stand By Me)',
              durationRatio: 0.50,
              instructions: 'Listen to Ben E. King\'s original "Stand By Me" with headphones. Tap your foot on beats 1, 2, 3, 4 and clap on beats 2 and 4.',
              focusCue: 'Feel the bassline groove and notice the 4-chord progression cycle.',
              pitfallToAvoid: 'Skipping active listening; internalizing the groove makes playing twice as fast.',
              layer: 'adherence',
              layerReasoning: 'Suzuki auditory imprinting creates a mental auditory template before physical motor execution.'
            }
          ]
        },
        {
          workoutType: 'chord_transitions',
          title: 'The 3rd-Finger Anchor Technique: Introducing G Major & C Major',
          focus: 'Expanding chord vocabulary using anchor finger shortcuts.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: '3rd-Finger Anchor Placement & Finger Walk',
              durationRatio: 0.15,
              instructions: 'Place finger 3 on the 3rd fret of the B string (or high E). Practice pivoting fingers 1 and 2 without moving finger 3.',
              focusCue: 'Finger 3 acts as the stationary hinge pin.',
              pitfallToAvoid: 'Lifting all 4 fingers off the fretboard when switching chords.',
              layer: 'mechanism',
              layerReasoning: 'Shared anchor points reduce degree-of-freedom motor complexity by 50%.'
            },
            {
              stepNumber: 2,
              title: 'G Major & C Major Architecture',
              durationRatio: 0.70,
              instructions: 'Form G Major cleanly. Strum and check each string. Move to C Major (or Cadd9 using the anchor). Execute 30 slow transitions.',
              focusCue: 'Aim for all notes to ring clear with zero dead thuds.',
              pitfallToAvoid: 'Muting the high E string with the palm.',
              layer: 'mechanism',
              layerReasoning: 'Iterative chord construction locks in spatial proprioception on the fretboard.'
            },
            {
              stepNumber: 3,
              title: 'Fingertip Press Relief & Post-Drill Shakeout',
              durationRatio: 0.15,
              instructions: 'Release left hand, shake out fingers, and perform gentle wrist extension stretches.',
              focusCue: 'Keep shoulders relaxed down away from ears.',
              pitfallToAvoid: 'Holding breath during difficult chord shapes.',
              layer: 'safety',
              layerReasoning: 'Restores capillary perfusion to flexor digitorum muscles following sustained isometric contraction.'
            }
          ]
        },
        {
          workoutType: 'rhythm_tempo',
          title: 'The "Invisible Pendulum" — Continuous Right-Hand Strumming',
          focus: 'Right-hand rhythmic automation and 4/4 meter consistency.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Muted String Rhythm Groove',
              durationRatio: 0.20,
              instructions: 'Lay left-hand fingers lightly across all 6 strings so they click percussively. Set metronome to 60 BPM.',
              focusCue: 'Swing right hand like a grandfather clock pendulum: Down on numbers (1, 2, 3, 4), Up on "ands".',
              pitfallToAvoid: 'Stopping the strumming hand when thinking; the hand NEVER stops moving.',
              layer: 'adherence',
              layerReasoning: 'Separates right-hand motor rhythm from left-hand cognitive chord changes to eliminate cognitive overload.'
            },
            {
              stepNumber: 2,
              title: 'Down-Down-Up-Up-Down-Up Strumming Pattern',
              durationRatio: 0.65,
              instructions: 'Practice the legendary campfire strumming pattern (D - D - U - U - D - U) on muted strings, then apply to E Minor.',
              focusCue: 'The "miss" motion: hand swings down on beat 3 without touching strings.',
              pitfallToAvoid: 'Strumming too loudly; keep a relaxed, dynamic brush stroke.',
              layer: 'mechanism',
              layerReasoning: 'Rhythmic automation allows executive cognitive function to focus exclusively on upcoming chord transitions.'
            },
            {
              stepNumber: 3,
              title: 'Song 1 Strumming Sync',
              durationRatio: 0.15,
              instructions: 'Strum the pattern 4 times consecutively without breaking tempo. Log your consistency.',
              focusCue: 'Count aloud: "1, 2-and, (miss)-and, 4-and".',
              pitfallToAvoid: 'Rushing ahead of the metronome click.',
              layer: 'adherence',
              layerReasoning: 'Verbal counting bridges rhythmic motor coordination with auditory processing.'
            }
          ]
        },
        {
          workoutType: 'repertoire',
          title: 'The 4-Chord Loop & Song 1 Integration (Stand By Me)',
          focus: 'Connecting G, Em, C, and D into an unbroken circular loop.',
          isRestDay: false,
          baseDurationMinutes: 30,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'D Major Clean Construction',
              durationRatio: 0.15,
              instructions: 'Fret D Major (fingers 1, 2, 3 in the triangle shape). Strum only the top 4 strings (D, G, B, E).',
              focusCue: 'Thumb can lightly mute the low E string to prevent low-end mud.',
              pitfallToAvoid: 'Hitting the low E and A strings on D Major.',
              layer: 'safety',
              layerReasoning: 'Clean string dampening prevents harmonic dissonance.'
            },
            {
              stepNumber: 2,
              title: 'The 4-Chord Progression Loop: G -> Em -> C -> D',
              durationRatio: 0.70,
              instructions: 'Play 4 strums per chord in sequence: G (2 bars), Em (2 bars), C (1 bar), D (1 bar), G (2 bars). Loop this continuously for 15 minutes at 55 BPM.',
              focusCue: 'On beat 4 of each bar, lift left hand slightly early to start moving toward the next chord while strumming the open strings.',
              pitfallToAvoid: 'Pausing between chords; keep the right hand in time even if the chord is 80% formed.',
              layer: 'mechanism',
              layerReasoning: 'The "open string switch trick" used by professional guitarists preserves groove momentum over robotic perfection.'
            },
            {
              stepNumber: 3,
              title: 'Continuous Song 1 Playthrough Attempt',
              durationRatio: 0.15,
              instructions: 'Play through the 4-chord loop 3 full cycles without stopping. Notice which transition had the most friction.',
              focusCue: 'Celebrate hearing the recognizable song emerge from your hands!',
              pitfallToAvoid: 'Focusing on missed notes instead of continuous forward momentum.',
              layer: 'adherence',
              layerReasoning: 'Recognizable song synthesis delivers immediate intrinsic dopamine reward, locking in identity as an active player.'
            }
          ]
        },
        {
          workoutType: 'milestone_audit',
          title: 'Week 1 Execution Audit & Metronome Speed Log',
          focus: 'Weekly progress verification, change speed audit, and Week 2 scheduling.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Speed Benchmark Audit: Em <-> A7 and G <-> C',
              durationRatio: 0.50,
              instructions: 'Execute a final 60-second test for Em <-> A7 and G <-> C. Log your switches per minute count.',
              focusCue: 'Compare today\'s score to Day 2; even a 5-switch improvement represents massive neural consolidation.',
              pitfallToAvoid: 'Judging your speed against professionals; progress is purely relative to your Day 1 baseline.',
              layer: 'mechanism',
              layerReasoning: 'Objective measurement confirms synaptic myelination and establishes next week\'s progressive overload target.'
            },
            {
              stepNumber: 2,
              title: 'Lock In Week 2 Practice Calendar Blocks',
              durationRatio: 0.50,
              instructions: 'Review your calendar for Week 2 and confirm your daily 30-minute practice slots.',
              focusCue: 'Leave your guitar on its stand in plain sight in your practice space.',
              pitfallToAvoid: 'Putting the guitar inside a zippered gig bag in a closet.',
              layer: 'adherence',
              layerReasoning: 'James Clear environmental architecture: reducing visual and physical friction increases habit initiation likelihood by 3x.'
            }
          ]
        }
      ]
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: Expanding to G & C + The 1-Minute Change Protocol',
      objective: 'Eliminate the stutter gap on G to C transitions and hit >=35 switches/min with metronome at 60 BPM.',
      keyMilestone: 'Achieve >=35 clean chord transitions per minute on G <-> C and G <-> Em.',
      targetIntensity: 62,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: Strumming Mechanics & Song 1 ("Stand By Me") Verse Chords',
      objective: 'Integrate the full campfire strumming pattern with the 4-chord progression of Stand By Me.',
      keyMilestone: 'Execute 4 consecutive cycles of Song 1 chords with steady right-hand pendulum at 65 BPM.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Phase 1 Gate — The 60-Switch Benchmark & Song 1 Full Playthrough',
      objective: 'Test open chord fluency and complete Song 1 from intro to outro from memory without pausing.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: The 60-Switch Benchmark & Song 1 ("Stand By Me") Full Playthrough',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Anchor Fingers & Song 2 ("Wonderwall") Syncopated Strumming',
      objective: 'Lock fingers 3 & 4 on strings 1 & 2 to master Em7, G, Cadd9, and Dsus4 with 16th-note rhythm.',
      keyMilestone: 'Play the 4-bar verse groove of Song 2 with locked anchor fingers and no hesitation.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Song 2 Memory Lock-in & Dynamic Accents',
      objective: 'Perform Song 2 ("Wonderwall") from verse to chorus with dynamic accents on beats 2 and 4.',
      keyMilestone: 'Play Song 2 completely from memory at full tempo (85 BPM) with clean string ring.',
      targetIntensity: 78,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Single-Note Hybrid Picking & Song 3 ("Wish You Were Here") Intro',
      objective: 'Combine single-string acoustic intro notes with open chords and expressive slides.',
      keyMilestone: 'Execute the iconic 12-bar intro riff of Song 3 followed by the acoustic rhythm groove.',
      targetIntensity: 82,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Phase 2 Gate — The 3-Song Unbroken Memory Medley Gate',
      objective: 'Perform Songs 1, 2, and 3 back-to-back from memory with zero sheet music or pauses.',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: The 3-Song Unbroken Memory Medley Gate',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: The F-Barre Leverage Breakthrough & Song 4 ("Riptide" / "Let It Be")',
      objective: 'Master F major using elbow weight leverage and modified Fmaj7 stepping-stone without hand strain.',
      keyMilestone: 'Transition cleanly into the F chord in time across 4 bars with zero muted strings.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Song 4 Full Automation & Percussive Palm Muting',
      objective: 'Integrate upbeat percussive chucks/palm mutes with the F-chord progression at full tempo.',
      keyMilestone: 'Play Song 4 completely from memory with steady percussive muting and zero fret buzz.',
      targetIntensity: 92,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Arpeggiated Fingerpicking & Song 5 ("Good Riddance" / "Fast Car")',
      objective: 'Develop independent right-hand thumb and finger picking with P-I-M-A patterns on Song 5.',
      keyMilestone: 'Execute clean arpeggiated picking pattern on Song 5 while singing or humming the melody.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Phase 3 Capstone — The 5-Song Live Campfire Performance Benchmark',
      objective: 'Perform all 5 iconic songs from memory in continuous performance order with vocals or backing tracks.',
      keyMilestone: 'Phase 3 Mastery Capstone: The 5-Song Live Campfire Performance Benchmark',
      targetIntensity: 100,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `You are a master guitar pedagogue, conservatory instructor, and deliberate practice coach combining Justin Sandercoe's beginner method, Berklee ergonomic leverage (William Leavitt), and the 12 Week Year.
When generating or calibrating this 5-Song Acoustic Guitar blueprint:
1. Metronome Precision: Use the provided BPM pacing table to calculate exact starting practice BPM, 1-minute switch targets, and song performance BPM based on the user's baseline answer. Never give vague instructions like "practice at a steady tempo". Always state: e.g. "Set metronome to 60 BPM. Strum on downbeats 1, 2, 3, 4; target >=40 clean switches per minute."
2. Ergonomics & Callus Guardrails: If the user reported fingertip pain or wrist fatigue, mandate thumb-behind-2nd-fret posture, elbow gravity leverage (pulling into the ribs rather than pinching with the thumb), and strict 25-30 minute session limits with rest days to allow keratinization.
3. Repertoire Integrity: Keep the 5 iconic songs central:
   - Song 1: "Stand By Me" (G - Em - C - D)
   - Song 2: "Wonderwall" (Anchor fingers on strings 1 & 2: Em7 - G - Cadd9 - Dsus4)
   - Song 3: "Wish You Were Here" (Hybrid picking intro riff + acoustic strumming)
   - Song 4: "Riptide" / "Let It Be" (The F-chord transition & percussive muting)
   - Song 5: "Good Riddance" / "Fast Car" (Precision arpeggiated fingerpicking & singing independence)
4. The Performance Rule: "The right hand never stops." Teach the open-string switch trick on the "and" of beat 4 so groove momentum is never broken by a late finger.`,
  evidenceTriad: {
    science: {
      title: 'Neurobiology & Motor Learning',
      subtitle: 'Motor Cortex Myelination & Deliberate Practice',
      tag: 'THEORY & BIOLOGY',
      coreRule: 'Anders Ericsson Deliberate Practice + 60 BPM Metronome Ramping.',
      realWorldApplication:
        'Myelination requires clean, error-free repetitions. Practicing at 60 BPM prevents the brain from hardwiring hesitation gaps into long-term muscle memory.'
    },
    socialAdherence: {
      title: 'Busy Human Adherence Engine',
      subtitle: 'Designed for 9-to-5 Adults & Real Friction',
      tag: 'REAL-LIFE PSYCHOLOGY',
      coreRule: 'Recognizable Riffs on Day 1 + 25-30m Sweet Spot + Zero-Guilt Buffers.',
      realWorldApplication:
        'No boring chromatic scales. Day 1 teaches chords to real anthems people love. Short daily sessions fit around work, and missed days slide into weekend buffers without streak guilt.'
    },
    proCoaching: {
      title: 'Veteran Teacher Ground Truth',
      subtitle: 'Ergonomic Craft & The Performance Rule',
      tag: 'PRACTITIONER CRAFT',
      coreRule: 'Elbow Weight Over Thumb Squeezing + "The Right Hand Never Stops".',
      realWorldApplication:
        'Master teachers know beginners squeeze the neck like a vise, causing tendonitis. We teach pulling with elbow weight. When switching chords, the strumming hand never stops—groove is sacred.'
    }
  }
};
