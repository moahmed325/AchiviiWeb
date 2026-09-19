import { CertifiedPresetBlueprint } from './types.js';

export const run10kPreset: CertifiedPresetBlueprint = {
  id: 'run10k',
  matchingPatterns: [
    /10k/i,
    /sub[-\s]?50/i,
    /run.*10.*(k|km|kilometer)/i,
    /10.*(k|km).*under/i
  ],
  title: 'Run a 10K Under 50 Minutes',
  primaryDomain: 'Endurance Running & Aerobic Conditioning',
  clarifiedOutcome: 'Run a 10K in under 50 minutes with aerobic efficiency and continuous pacing',
  badge: 'Certified Endurance Science · Jack Daniels VDOT & 80/20 Polarized Base',
  scientificFrameworks: [
    {
      name: "Jack Daniels' VDOT Pacing Formula",
      description: 'Scientifically calibrated training zones (Easy, Marathon, Threshold, Interval, Repetition) derived from laboratory VO2 max kinetics.',
      application: 'Ensures every run has an exact physiological stimulus without overreaching or junk mileage.'
    },
    {
      name: "Stephen Seiler's 80/20 Polarized Training",
      description: 'Strict 80% low-intensity aerobic base (Zone 2) and 20% high-intensity threshold/interval distribution.',
      application: 'Maximizes mitochondrial biogenesis and capillary density while shielding against autonomic nervous system fatigue.'
    },
    {
      name: 'Arthur Lydiard Aerobic Periodization & Connective Tissue Remodeling',
      description: 'Phased macrocycle building aerobic volume and connective tissue strength before introducing high anaerobic stress.',
      application: 'Protects joints, tendons, and the plantar fascia against ground reaction forces through progressive musculoskeletal adaptation.'
    }
  ],
  verificationCriteria: 'Complete a continuous 10.0 km road or certified track run in 49:59 or faster verified by GPS or electronic timing.',
  diagnosticQuestions: [
    {
      id: 'baseline5k',
      question: 'What is your current comfortable 5K running baseline?',
      subtitle: 'Calibrates your exact Jack Daniels VDOT training paces and interval splits.',
      options: [
        'Sub-24 min (Current 5K < 24:00, aiming for 10K pacing endurance)',
        '24 to 27 min (Current 5K ~25:00-26:30, aiming for 5:00/km lock-in)',
        '27 to 30 min (Can complete 5K in ~28 min, need threshold expansion)',
        'Over 30 min or untimed (Can run 3-5 km continuously, building base)'
      ],
      allowCustom: true
    },
    {
      id: 'environment',
      question: 'What running surface and gear will you primarily use?',
      subtitle: 'Tailors warmup drills, elevation adjustments, and cadence mechanics.',
      options: [
        'Outdoor asphalt roads & flat pavement with GPS watch',
        'Gym or home motorized treadmill with incline control',
        'Outdoor standard 400m track and mixed park trails',
        'Hilly outdoor terrain with variable elevation'
      ],
      allowCustom: true
    },
    {
      id: 'injury_history',
      question: 'What has been your biggest historical physical or consistency bottleneck?',
      subtitle: 'Injects targeted pre-run activation and recovery guardrails into every session.',
      options: [
        'Shin splints, calf tightness, or Achilles tenderness when volume increases',
        "Runner's knee (patellar tendon) or IT band friction",
        'Aerobic burnout (starting too fast and gasping by kilometer 3)',
        'Schedule friction & difficulty maintaining consistency after Week 3'
      ],
      allowCustom: true
    }
  ],
  vdotPacingTable: [
    {
      baselineKey: 'under_24',
      label: 'Sub-24 min 5K (VDOT ~42)',
      vdot: 42,
      easyPace: '5:35 - 5:55 /km (9:00 - 9:30 /mi)',
      marathonPace: '5:10 /km (8:19 /mi)',
      thresholdPace: '4:40 - 4:48 /km (7:30 - 7:43 /mi)',
      intervalPace: '4:18 - 4:25 /km (6:55 - 7:06 /mi)',
      repetitionPace: '4:00 /km (6:26 /mi)',
      targetHeartRateRange: 'Easy: 138-152 bpm | Threshold: 168-175 bpm'
    },
    {
      baselineKey: '24_27',
      label: '24 to 27 min 5K (VDOT ~38)',
      vdot: 38,
      easyPace: '6:00 - 6:25 /km (9:39 - 10:20 /mi)',
      marathonPace: '5:30 /km (8:51 /mi)',
      thresholdPace: '5:05 - 5:15 /km (8:11 - 8:27 /mi)',
      intervalPace: '4:40 - 4:50 /km (7:30 - 7:46 /mi)',
      repetitionPace: '4:20 /km (6:58 /mi)',
      targetHeartRateRange: 'Easy: 135-148 bpm | Threshold: 165-172 bpm'
    },
    {
      baselineKey: '27_30',
      label: '27 to 30 min 5K (VDOT ~34)',
      vdot: 34,
      easyPace: '6:30 - 6:55 /km (10:27 - 11:08 /mi)',
      marathonPace: '5:55 /km (9:31 /mi)',
      thresholdPace: '5:28 - 5:38 /km (8:48 - 9:04 /mi)',
      intervalPace: '5:02 - 5:12 /km (8:06 - 8:22 /mi)',
      repetitionPace: '4:40 /km (7:30 /mi)',
      targetHeartRateRange: 'Easy: 130-145 bpm | Threshold: 162-169 bpm'
    },
    {
      baselineKey: 'over_30',
      label: 'Over 30 min 5K (VDOT ~30)',
      vdot: 30,
      easyPace: '7:00 - 7:30 /km (11:15 - 12:05 /mi)',
      marathonPace: '6:25 /km (10:20 /mi)',
      thresholdPace: '5:55 - 6:05 /km (9:31 - 9:47 /mi)',
      intervalPace: '5:30 - 5:40 /km (8:51 - 9:07 /mi)',
      repetitionPace: '5:05 /km (8:11 /mi)',
      targetHeartRateRange: 'Easy: 125-140 bpm | Threshold: 158-165 bpm'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Aerobic Base Conditioning, Connective Tissue Remodeling & 170-180 SPM Cadence Rhythm',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Gate: 5K Aerobic Efficiency & Cadence Diagnostic Benchmark',
      milestoneCriteria: 'Run a continuous 5.0 km at conversational effort with cadence locked between 172-180 SPM.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Lactate Threshold Expansion, Cruise Intervals & Sub-Threshold Speed Endurance',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Gate: 8K Continuous Pacing Simulation @ 5:10/km',
      milestoneCriteria: 'Complete 8.0 km continuously with negative or even splits, averaging ≤5:12/km pace.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'VO2 Max Intervals, Sub-50 Min Race Pace Lock-in (4:59/km) & 10-Day Taper',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Capstone: Sub-50 Minute 10K Continuous Benchmark Run',
      milestoneCriteria: 'Complete 10.0 km in 49:59 or faster (pace ≤ 4:59/km / 8:01/mi) without stopping.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Aerobic Base Baseline & Cadence Groundwork',
      objective: 'Establish conversational Zone 2 heart rate baseline and lock in 170-180 SPM turnover.',
      keyMilestone: 'Complete first 30-minute continuous Zone 2 aerobic run with cadence audit.',
      targetIntensity: 60,
      workoutArchetypes: [
        {
          workoutType: 'aerobic_base',
          title: 'Zone 2 Aerobic Base & Cadence Rhythm Run',
          focus: 'Low heart rate, nasal breathing check, and light quick foot turnover.',
          isRestDay: false,
          baseDurationMinutes: 40,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Dynamic Hip & Ankle Mobility Warmup',
              durationRatio: 0.15,
              instructions: 'Perform leg swings, ankle circles, A-skips, and glute bridges for 5-6 minutes before running.',
              focusCue: 'Activate glutes and calves before impact to protect knee joints.',
              pitfallToAvoid: 'Static stretching before running which reduces muscle tendon stiffness.',
              layer: 'safety',
              layerReasoning: 'Dynamic activation prepares synovial fluid in joints and reduces ground reaction strain.'
            },
            {
              stepNumber: 2,
              title: 'Zone 2 Conversational Aerobic Run',
              durationRatio: 0.70,
              instructions: 'Run at pure conversational pace. You must be able to speak a full sentence without gasping.',
              focusCue: 'Count steps for 60 seconds: aim for 86-90 strikes per foot (172-180 SPM total).',
              pitfallToAvoid: 'Running too fast because it "feels too easy"; Zone 2 must remain truly low intensity.',
              layer: 'mechanism',
              layerReasoning: 'Zone 2 stimulates mitochondrial biogenesis in slow-twitch muscle fibers.'
            },
            {
              stepNumber: 3,
              title: 'Post-Run Mobility & Calf Flush',
              durationRatio: 0.15,
              instructions: 'Light walking cooldown followed by calf wall stretch and quad/hamstring foam roll.',
              focusCue: 'Breathe deeply to shift nervous system into parasympathetic recovery.',
              pitfallToAvoid: 'Sitting down immediately after running without flushing metabolic waste.',
              layer: 'adherence',
              layerReasoning: 'Immediate post-session down-regulation accelerates glycogen replenishment.'
            }
          ]
        },
        {
          workoutType: 'threshold',
          title: 'Cadence Strides & Neuromuscular Coordination',
          focus: 'Easy aerobic jog punctuated with 4x20-second relaxed accelerations.',
          isRestDay: false,
          baseDurationMinutes: 35,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Dynamic Warmup & Heel Walks',
              durationRatio: 0.15,
              instructions: 'Warm up with high knees, butt kicks, and heel-to-toe walking drills.',
              focusCue: 'Engage the tibialis anterior muscle to bulletproof shins.',
              pitfallToAvoid: 'Rushing directly into running without ankle warm-up.',
              layer: 'safety',
              layerReasoning: 'Heel-toe articulation conditions shin muscles against anterior compartment stress.'
            },
            {
              stepNumber: 2,
              title: 'Aerobic Base with 4 Strides',
              durationRatio: 0.70,
              instructions: '25 min easy jog, then 4 x 20-second strides at 85% top speed focusing on tall posture and quick turnover.',
              focusCue: 'Run fast without sprinting; imagine running over hot coals with soft, silent footfalls.',
              pitfallToAvoid: 'Full-out sprinting which strains hamstrings; strides are smooth form accelerations.',
              layer: 'mechanism',
              layerReasoning: 'Strides recruit fast-twitch motor units without producing lactic acid accumulation.'
            },
            {
              stepNumber: 3,
              title: 'Walking Cooldown & Hip Flexor Stretch',
              durationRatio: 0.15,
              instructions: 'Walk 3 minutes, then perform standing quad stretch and kneeling hip flexor stretch.',
              focusCue: 'Keep hips square and spine tall.',
              pitfallToAvoid: 'Overextending lower back during hip stretch.',
              layer: 'adherence',
              layerReasoning: 'Restoring hip flexor length prevents anterior pelvic tilt during running gait.'
            }
          ]
        },
        {
          workoutType: 'recovery',
          title: 'Active Musculoskeletal Recovery & Foam Rolling',
          focus: 'Total rest from running impact, dedicated to tissue regeneration and joint mobility.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Lower Body Foam Rolling Routine',
              durationRatio: 0.50,
              instructions: 'Foam roll calves, IT bands, quads, and glutes for 60 seconds per muscle group.',
              focusCue: 'Breathe through tender trigger points; do not tense up.',
              pitfallToAvoid: 'Rolling directly over bony prominences or the knee joint.',
              layer: 'safety',
              layerReasoning: 'Self-myofascial release restores fascial gliding and downregulates neural hypertonicity.'
            },
            {
              stepNumber: 2,
              title: 'Weekly Training Log & Hydration Check',
              durationRatio: 0.50,
              instructions: 'Log your weekly mileage and confirm electrolyte/water intake for tomorrow.',
              focusCue: 'Review how your joints felt this week and note any asymmetries.',
              pitfallToAvoid: 'Neglecting hydration on rest days.',
              layer: 'adherence',
              layerReasoning: 'Consistent reflection builds metacognitive body awareness.'
            }
          ]
        },
        {
          workoutType: 'aerobic_base',
          title: 'Aerobic Efficiency & Nasal Breathing Run',
          focus: 'Controlled steady run testing pure aerobic lipid oxidation.',
          isRestDay: false,
          baseDurationMinutes: 40,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Dynamic Ankle Activation',
              durationRatio: 0.15,
              instructions: 'Calf raises, ankle dorsiflexion rocks, and walking lunges for 5 minutes.',
              focusCue: 'Feel ground contact under the balls of your feet.',
              pitfallToAvoid: 'Starting cold in morning temperatures.',
              layer: 'safety',
              layerReasoning: 'Warm achilles tendons absorb ground impact elastic strain efficiently.'
            },
            {
              stepNumber: 2,
              title: 'Continuous Zone 2 Aerobic Run',
              durationRatio: 0.70,
              instructions: 'Run at easy conversational pace. Check breathing: breathe strictly through your nose for 2-minute test segments.',
              focusCue: 'If you must open your mouth to gasp, you are running too fast. Slow down 15 sec/km.',
              pitfallToAvoid: 'Compromising aerobic threshold by creeping into Zone 3.',
              layer: 'mechanism',
              layerReasoning: 'Nasal breathing restricts hyperventilation and enforces strict aerobic zone discipline.'
            },
            {
              stepNumber: 3,
              title: 'Hamstring & Glute Mobility',
              durationRatio: 0.15,
              instructions: 'Gentle walk followed by seated forward fold and figure-4 glute stretch.',
              focusCue: 'Relax shoulders and neck completely.',
              pitfallToAvoid: 'Bouncing in stretches.',
              layer: 'adherence',
              layerReasoning: 'Static post-run stretching restores resting sarcomere length.'
            }
          ]
        },
        {
          workoutType: 'recovery',
          title: 'Active Recovery & Core Stability',
          focus: 'Strengthen running core and pelvic stability without ground impact.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Runner Core Circuit (Plank, Side Plank, Bird-Dog)',
              durationRatio: 0.60,
              instructions: 'Hold 45s front plank, 30s each side plank, and 12 controlled bird-dogs.',
              focusCue: 'Maintain level pelvis with zero pelvic drop or rotation.',
              pitfallToAvoid: 'Arching lower back during planks.',
              layer: 'mechanism',
              layerReasoning: 'Pelvic stability prevents hip drop (Trendelenburg gait) which causes IT band syndrome.'
            },
            {
              stepNumber: 2,
              title: 'Pre-flight Weekend Long Run Preparation',
              durationRatio: 0.40,
              instructions: 'Prepare shoes, hydration, and select your flat route for the weekend long run.',
              focusCue: 'Identify the exact start time to avoid midday heat.',
              pitfallToAvoid: 'Waking up unprepared and skipping the long run.',
              layer: 'adherence',
              layerReasoning: 'Implementation intentions remove friction for the highest-leverage weekly workout.'
            }
          ]
        },
        {
          workoutType: 'long_run',
          title: 'Progressive Aerobic Long Run (Foundation Volume)',
          focus: 'The weekly anchor run building total aerobic stamina and mental patience.',
          isRestDay: false,
          baseDurationMinutes: 50,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Comprehensive Pre-Long Run Warmup',
              durationRatio: 0.12,
              instructions: 'Dynamic lunges, hip circles, A-skips, and gentle jog for 6 minutes.',
              focusCue: 'Warm up thoroughly before continuous steady mileage.',
              pitfallToAvoid: 'Beginning the long run cold on stiff muscles.',
              layer: 'safety',
              layerReasoning: 'Cardiovascular and muscular warm-up reduces initial cardiac drift.'
            },
            {
              stepNumber: 2,
              title: 'Continuous Aerobic Long Run',
              durationRatio: 0.76,
              instructions: 'Run at steady, relaxed Zone 2 pace. Focus on light, soft landings and tall, proud posture.',
              focusCue: 'Keep shoulders relaxed and arms swinging compactly at 90 degrees.',
              pitfallToAvoid: 'Surging in the first 2 km; pace must stay perfectly steady throughout.',
              layer: 'mechanism',
              layerReasoning: 'Prolonged continuous aerobic load trains the body to spare glycogen and burn fatty acids.'
            },
            {
              stepNumber: 3,
              title: 'Cooling Down & Elevation Recovery',
              durationRatio: 0.12,
              instructions: 'Walk 5 minutes, drink 500ml water with electrolytes, and lie on back with legs elevated on a wall for 5 minutes.',
              focusCue: 'Feel venous blood drain from lower extremities back to central circulation.',
              pitfallToAvoid: 'Standing on tired legs immediately after finishing long mileage.',
              layer: 'safety',
              layerReasoning: 'Leg elevation and passive rehydration accelerates venous return and lymphatic drainage.'
            }
          ]
        },
        {
          workoutType: 'recovery',
          title: 'Weekly Milestone Reflection & Recovery Audit',
          focus: 'Metacognitive review of Week 1 mileage and preparation for Week 2.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Weekly Mileage & Cadence Review',
              durationRatio: 0.50,
              instructions: 'Review total kilometers completed this week and note your average cadence and heart rate.',
              focusCue: 'Celebrate hitting every planned session with zero skipped runs.',
              pitfallToAvoid: 'Fixating on pace rather than consistency in Phase 1.',
              layer: 'mechanism',
              layerReasoning: 'Self-monitoring reinforces habit identity as a committed athlete.'
            },
            {
              stepNumber: 2,
              title: 'Lock In Week 2 Schedule Blocks',
              durationRatio: 0.50,
              instructions: 'Review your calendar for the upcoming week and confirm your training slots.',
              focusCue: 'Protect your running windows against unexpected meetings.',
              pitfallToAvoid: 'Leaving run times flexible and open to calendar clutter.',
              layer: 'adherence',
              layerReasoning: 'Pre-committing slots enforces adherence under variable work schedules.'
            }
          ]
        }
      ]
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: Musculoskeletal Reinforcement & Cadence Calibration',
      objective: 'Progressive 8% volume expansion with emphasis on 175 SPM cadence efficiency.',
      keyMilestone: 'Complete 35-minute aerobic run maintaining ≥174 SPM average cadence.',
      targetIntensity: 62,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: Aerobic Threshold Consolidation & Consistency Shield',
      objective: 'Consolidate aerobic efficiency and guard against the common Week 3 drop-off.',
      keyMilestone: 'Execute 40-minute continuous Zone 2 run with strict nasal breathing check.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Phase 1 Hard Gate Milestone — 5K Diagnostic Benchmark',
      objective: 'Test current aerobic capacity and pacing control under continuous 5K conditions.',
      keyMilestone: 'Complete continuous 5.0 km benchmark run and audit baseline VDOT pace progression.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Lactate Threshold Introduction & Cruise Intervals',
      objective: 'Introduce lactate threshold cruise intervals (e.g. 3x1 mile / 4x1 km) at exact VDOT threshold pace.',
      keyMilestone: 'Execute 4 x 1000m cruise intervals at threshold pace with 60s recovery jog.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Continuous Tempo Pacing & Lactate Clearance',
      objective: 'Extend continuous tempo threshold duration to 20 continuous minutes at target 5:10-5:15/km pace.',
      keyMilestone: 'Complete 20-minute continuous tempo run without crossing above threshold heart rate.',
      targetIntensity: 78,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Speed-Endurance Expansion & Progressive Long Run',
      objective: 'Combine mid-week threshold cruise intervals with progressive long run ending at goal 10K pace.',
      keyMilestone: 'Execute 60-minute long run with final 2 km at target 10K pace (4:59/km).',
      targetIntensity: 82,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Phase 2 Hard Gate Milestone — 8K Pacing Benchmark',
      objective: 'Validate physical and mental endurance with an 8.0 km simulation at ≤5:10/km pace.',
      keyMilestone: 'Complete 8.0 km continuous benchmark run averaging ≤5:10/km without fading in final 2 km.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: VO2 Max Interval Calibration (800m Repeats)',
      objective: 'Stimulate maximal oxygen uptake with 5 x 800m intervals at 4:35-4:45/km pace with 2m recovery.',
      keyMilestone: 'Complete 5 x 800m VO2 max repeats with less than 3 seconds pace variance across sets.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Peak Volume & Race Pace Specificity (Sub-50 Lock-in)',
      objective: 'Final peak volume week featuring 3 x 2000m at exact goal pace (4:59/km) with 90s recovery.',
      keyMilestone: 'Execute 3 x 2000m race-pace simulation locked precisely at 4:58-5:00/km.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Scientific 10-Day Taper & Glycogen Optimization',
      objective: 'Reduce volume by 40% while maintaining intensity sharpness and restoring muscular glycogen stores.',
      keyMilestone: 'Execute sharp 20-minute shakeout run with 4 race-pace strides; legs feel springy and fresh.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Phase 3 Capstone — The Sub-50 Minute 10K Benchmark Attempt',
      objective: 'Execute pre-race strategy, pacing splits, and complete the 10K benchmark run in ≤49:59.',
      keyMilestone: 'Complete continuous 10.0 km run in 49:59 or faster (verified final proof of achievement).',
      targetIntensity: 100,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `You are Olympic endurance running coach and exercise physiologist applying Jack Daniels' VDOT formula and Stephen Seiler's 80/20 Polarized training.
When generating or calibrating this 10K Runner blueprint:
1. Pacing Precision: Use the provided VDOT pacing table to calculate EXACT min/km and min/mile target paces based on the user's 5K baseline quiz answer. Never give vague advice like "run at a medium pace". Always specify: e.g. "Run at 5:12 - 5:18 /km (8:22 - 8:32 /mi) with target HR 165-172 bpm".
2. Terrain & Environment: If the user runs on a treadmill, specify 1.0% incline to simulate outdoor air resistance and advise on treadmill pacing discipline. If road, advise on surface impact and cadence. If track, specify lane and lap splits (e.g. 1000m = 2.5 laps).
3. Injury & Friction Guardrails: If the user reported past shin splints or knee issues, mandate 174-180 SPM cadence, soft midfoot landings under the center of mass, and pre-run tibialis/calf activation in the detailed steps.
4. Schedule & Recovery: Strictly enforce the 80/20 polarized ratio. Never program consecutive hard days. Map the workouts to the user's active days and slot times with clear implementation intentions.`,
  evidenceTriad: {
    science: {
      title: 'Laboratory Aerobic Science',
      subtitle: 'Mitochondrial Biogenesis & VDOT Kinetics',
      tag: 'THEORY & BIOLOGY',
      coreRule: "Jack Daniels VDOT + Stephen Seiler's 80/20 Polarized Distribution.",
      realWorldApplication: '80% of training remains strictly in conversational Zone 2 to stimulate capillary beds and spare glycogen, while 20% targets the lactate inflection point.'
    },
    socialAdherence: {
      title: 'Busy Human Adherence Engine',
      subtitle: 'Designed for 40-Hour Workweeks & Real Friction',
      tag: 'REAL-LIFE PSYCHOLOGY',
      coreRule: 'High-Density 35-45m Sessions + 2-Day Rule + Zero-Guilt Buffers.',
      realWorldApplication: 'Sessions fit around work, commute, and family. Missed Tuesday? It shifts automatically into an open weekend buffer. Never two rest days in a row.'
    },
    proCoaching: {
      title: 'Elite Coach Ground Truth',
      subtitle: 'Injury Shielding & Practical Craft',
      tag: 'PRACTITIONER CRAFT',
      coreRule: 'Effort over dogmatic GPS watch obedience + The "Talk Test" + Joint Pre-Hab.',
      realWorldApplication: 'Coaches know tendons adapt 3x slower than heart and lungs. We mandate 174-180 SPM cadence, soft midfoot landings, and effort-based pacing on hot/stressful days.'
    }
  }
};
