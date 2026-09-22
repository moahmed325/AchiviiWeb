
import { CertifiedPresetBlueprint } from './types.js';

export const recompPreset: CertifiedPresetBlueprint = {
  id: 'body_recomposition_90day',
  matchingPatterns: [
    /recomp/i,
    /body.*recomp/i,
    /drop.*5%.*(fat|body.*fat)/i,
    /lose.*fat.*(build|gain).*muscle/i,
    /lose.*weight.*gain.*muscle/i,
    /cut.*lean.*muscle/i,
    /fat.*loss.*muscle/i,
    /physique.*transformation/i,
    /build.*muscle.*burn.*fat/i,
    /\b(get\s+)?shredded\b/i
  ],
  title: 'Drop 5% Body Fat & Build Lean Muscle',
  primaryDomain: 'Physique Transformation & Nutritional Biomechanics',
  clarifiedOutcome:
    'Drop 5% body fat while preserving and building lean skeletal muscle mass through progressive overload and caloric deficit calibration',
  badge: 'Certified Physique Architecture · Eric Helms Pyramid & Brad Schoenfeld Hypertrophy',
  capabilities: [
    'Energy Balance & Precision Macronutrient Tracking (Protein ≥ 2.0g/kg)',
    'Compound Mechanical Tension & Progressive Overload (RIR 1–3)',
    'Non-Exercise Activity Thermogenesis (NEAT) & Zone 2 Base (8,000–10,000 steps)',
    'Diet Refeed Architecture & Leptin Preservation (48-hr maintenance)',
    'Anthropometric Auditing (7-Day Rolling Averages, 3-Point Caliper & Tape)'
  ],
  scientificFrameworks: [
    {
      name: "Dr. Eric Helms & Andy Morgan's Muscle and Strength Nutritional Pyramid",
      description:
        'Nutritional interventions must follow an evidence-based hierarchy: Energy Balance (caloric deficit) → Macronutrient Ratios (2.0–2.4g/kg protein) → Micronutrients & Hydration → Nutrient Timing → Evidence-Based Supplements.',
      application:
        'Enforces a sustainable 300–500 kcal deficit paired with high protein distribution across 3–4 daily feedings to maximize muscle protein synthesis and prevent metabolic crash.'
    },
    {
      name: "Dr. Brad Schoenfeld's Mechanisms of Hypertrophy & Mechanical Tension",
      description:
        'Muscle fiber hypertrophy is primarily driven by mechanical tension close to muscular failure (1–3 Reps in Reserve) across 10–20 weekly sets per muscle group, rather than high-fatigue "calorie-burning" circuits.',
      application:
        'Prioritizes heavy, stable compound lifts with controlled 3-second eccentric cadences, treating resistance training as a muscle preservation signal rather than a cardio workout.'
    },
    {
      name: "Dr. Bill Campbell & Lyle McDonald's Refeed Architecture & Metabolic Adaptation Defense",
      description:
        'Prolonged caloric restriction downregulates leptin, thyroid hormone (T3), and spontaneous physical movement (NEAT). Structured 48-hour carbohydrate-dominant refeeds restore leptin sensitivity and defend resting metabolic rate.',
      application:
        'Integrates mandatory 48-hour maintenance refeeds at Weeks 4 and 8, preventing adaptive thermogenesis and eliminating psychological binge triggers.'
    }
  ],
  verificationCriteria:
    'Verify a net 5% reduction in body fat via DEXA, hydrostatic weighing, or standardized 3-point caliper/circumference tracking, with strength maintained or increased on primary compound movements (Squat/Leg Press, Bench/Dumbbell Press, Barbell/Cable Row).',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current training experience and body composition baseline?',
      subtitle: 'Calibrates your daily caloric deficit, protein target (g/kg), and training volume landmarks.',
      options: [
        'Beginner / Untrained (Little to no formal barbell/dumbbell resistance training experience; high recomp responsiveness)',
        'Skinny-Fat / Sedentary (Normal BMI or low muscle mass with elevated abdominal fat; need muscle-building stimulus near maintenance calories)',
        'Overfat / Intermediate Lifter (1+ years lifting experience with >20% body fat; need disciplined 400-500 kcal deficit while defending strength)',
        'Athletic Cut / Advanced (Consistent lifter seeking single-digit or athletic definition; need high protein 2.4g/kg with strict volume autoregulation)'
      ],
      allowCustom: true
    },
    {
      id: 'equipment',
      question: 'What training facility and equipment do you have regular access to?',
      subtitle: 'Determines exercise selection, mechanical stability anchors, and progressive overload tracking.',
      options: [
        'Full commercial gym (Free barbells, dumbbells, cables, leg press, lat pulldown)',
        'Home gym setup (Barbell rack, adjustable bench, and heavy dumbbells)',
        'Dumbbells and resistance bands only (Limited load; high-rep failure focus)',
        'Bodyweight and calisthenics park (Pull-up bar, dip bars, gymnast rings)'
      ],
      allowCustom: true
    },
    {
      id: 'historical_friction',
      question: 'What has been your primary obstacle or failure point in past fitness attempts?',
      subtitle: 'Allows us to build behavioral and psychological guardrails into your daily adherence loop.',
      options: [
        'Aggressive starvation deficit leading to severe week-3 lethargy and rebound binging',
        'Inconsistent workout tracking and guessing weights/reps without progressive overload',
        'Weekend social dining and alcohol erasing weekly weekday deficits',
        'Scale weight obsession and anxiety during natural water/sodium fluctuations'
      ],
      allowCustom: true
    }
  ],
  recompPacingTable: [
    {
      baselineKey: 'true_beginner',
      label: 'True Beginner / Untrained',
      dailyCalorieDeficit: 400,
      proteinTargetGPerKg: 1.8,
      weeklySetsPerMuscle: '10–12 direct working sets',
      neatStepTarget: 8000,
      refeedFrequency: 'Every 4 weeks (48hr maintenance refeed)',
      guidance: 'High neuromuscular adaptation phase; focus on pristine lifting technique and steady progressive overload.'
    },
    {
      baselineKey: 'skinny_fat',
      label: 'Skinny-Fat / Sedentary',
      dailyCalorieDeficit: 250,
      proteinTargetGPerKg: 2.0,
      weeklySetsPerMuscle: '12–14 direct working sets',
      neatStepTarget: 8500,
      refeedFrequency: 'Every 4 weeks (48hr maintenance refeed)',
      guidance: 'Small conservative deficit near maintenance to build foundational muscle while shrinking visceral waistline.'
    },
    {
      baselineKey: 'overfat_intermediate',
      label: 'Overfat / Intermediate Lifter',
      dailyCalorieDeficit: 500,
      proteinTargetGPerKg: 2.2,
      weeklySetsPerMuscle: '14–16 direct working sets',
      neatStepTarget: 10000,
      refeedFrequency: 'Bi-weekly 48hr refeed',
      guidance: 'Strict 500 kcal deficit with high protein to protect existing muscle mass while shedding 0.5–1kg per week.'
    },
    {
      baselineKey: 'athletic_cut',
      label: 'Athletic Cut / Advanced',
      dailyCalorieDeficit: 350,
      proteinTargetGPerKg: 2.4,
      weeklySetsPerMuscle: '12–15 direct working sets',
      neatStepTarget: 10000,
      refeedFrequency: 'Every 3 weeks 48hr refeed',
      guidance: 'High protein and strict RIR monitoring (1–2 RIR) to protect lean mass in low body-fat ranges.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Movement pattern mechanics, 3-second eccentric control, caloric deficit lock-in, and establishing 8,000 daily steps.',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Foundation Milestone Gate: Macro Adherence & Movement Calibration',
      milestoneCriteria:
        'Demonstrate ≥90% food logging compliance, log every lift working weight with zero missed workouts, and document a 1.5–2.5 cm waist reduction.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Hypertrophic mechanical tension, progressive overload (adding weight or reps at 1–2 RIR), and mid-cycle leptin reset.',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Acceleration Milestone Gate: The Mid-Point Recomp Audit',
      milestoneCriteria:
        'Complete the Mid-Point Recomp Audit showing a verified 2.5–3.5% body fat reduction, maintain/increase baseline compound lift loads, and execute a 48-hr maintenance refeed.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'Peak muscle definition, high-yield isolation density, final fat shed, and sustainable maintenance transition.',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: Final Recomposition Verification & Maintenance Transition',
      milestoneCriteria:
        'Complete official post-program DEXA, caliper, or 3-point circumference verification confirming full 5% body fat drop with strength preserved, accompanied by a 4-week reverse dieting plan.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Baseline Caloric Calibration & Movement Mechanics',
      objective: 'Establish a pristine 300–500 kcal deficit, hit 2.0g/kg protein daily, and execute baseline Upper/Lower compound lifts at 3 RIR.',
      keyMilestone: 'Baseline lift weights logged for all 6 core lifts; 7-day food diary logged with zero unrecorded bites.',
      targetIntensity: 60,
      workoutArchetypes: []
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: Eccentric Control & NEAT Habit Formation',
      objective: 'Implement 3-second eccentric tempos on all compound presses and squats; hit 8,500 steps daily average.',
      keyMilestone: 'Zero form breakdown on eccentric phases; 7-day rolling weight average down 0.5–0.8% of bodyweight.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: Micro-Overload & Satiety Volume Anchoring',
      objective: 'Progress weight or reps on compound movements; anchor 35g+ dietary fiber from green vegetables and whole potatoes.',
      keyMilestone: 'All main lifts progress by +1 rep or +1.25kg–2.5kg; zero hunger pangs causing off-plan snacking.',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Foundation Milestone Audit & Strategic Refeed',
      objective: 'Pass the Phase 1 Foundation Milestone Gate; conduct a 48-hour carbohydrate maintenance refeed to normalize leptin.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: Macro Adherence & Movement Calibration',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: Hypertrophy Stimulus & RIR 1–2 Tightening',
      objective: 'Increase mechanical tension by training sets within 1–2 Reps in Reserve; introduce drop-sets on isolation movements.',
      keyMilestone: 'Every compound working set executed within 1–2 RIR with recorded video form checks.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Metabolic Adaptation Resistance & Step Density',
      objective: 'Elevate daily step baseline to 9,500–10,000 steps to counteract metabolic slow-down and spontaneous NEAT drops.',
      keyMilestone: 'Weekly step average ≥9,500 steps; waist circumference drops an additional 1.0 cm.',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Strength Defense & High-Satiety Food Swaps',
      objective: 'Defend maximum working weight on the bench press, squat/leg press, and row during cumulative deficit fatigue.',
      keyMilestone: '100% of primary lift poundages maintained or increased despite 3.0%+ net body fat reduction.',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Mid-Point Recomp Audit & Glycogen Replenishment',
      objective: 'Pass the Phase 2 Acceleration Milestone Gate; conduct 48-hour maintenance refeed to protect thyroid hormone (T3).',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: The Mid-Point Recomp Audit',
      targetIntensity: 80,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: Peak Mechanical Tension & High-Yield Isolations',
      objective: 'Maximize stretch-mediated hypertrophy on long-length movements (incline curls, overhead extensions, Romanian deadlifts).',
      keyMilestone: 'Full range of motion achieved with deep stretch hold on all lengthened-position movements.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Late-Deficit Energy Defense & Sleep Architecture',
      objective: 'Lock in 8 hours of restorative sleep to protect against cortisol-induced muscle catabolism and water retention.',
      keyMilestone: 'Sleep consistency score ≥85%; zero late-night snacking incidents.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Final Fat Shed & Peak Visual Conditioning',
      objective: 'Execute final training microcycle with clean form; calibrate sodium/water intake to eliminate subcutaneous bloat.',
      keyMilestone: 'Waist circumference reaches 90-day low; visible abdominal muscle outline in morning lighting.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Final Recomp Capstone Verification & Reverse Diet',
      objective: 'Complete official post-program DEXA/caliper scan confirming 5% net fat loss; initiate 4-week metabolic reverse diet.',
      keyMilestone: 'Phase 3 Mastery Capstone: Final Recomposition Verification & Maintenance Transition',
      targetIntensity: 95,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `
================================================================================
EXPERT PHYSIQUE & BIOMECHANICS COACH CONTEXT: BODY RECOMPOSITION
================================================================================
You are Dr. Eric Helms and Dr. Brad Schoenfeld coaching an ambitious lifter seeking a true 90-day body recomposition.
Core Non-Negotiable Rules:
1. RESISTANCE TRAINING IS FOR RETENTION & HYPERTROPHY, NOT CALORIE BURNING:
   Never program high-rep circuit training, burpees, or HIIT that compromises heavy compound strength. Mechanical tension at 1–3 RIR across 10–20 weekly sets per muscle group is the single physiological signal that commands the body to spare muscle while burning fat.
2. 3-SECOND CONTROLLED ECCENTRICS:
   Every compound repetition must feature a controlled 3-second lowering phase to maximize stretch-mediated hypertrophy and protect joints from ballistic injury.
3. 2.0g/kg PROTEIN ANCHOR ACROSS 3–4 FEEDINGS:
   Protein intake must reach 2.0–2.4g/kg of total body mass distributed across 3–4 meals containing at least 3g of leucine per feeding to optimize muscle protein synthesis.
4. NEAT (8,000–10,000 STEPS) OVER HARD CARDIO:
   Energy expenditure must be driven primarily by low-fatigue daily walking (Zone 1/2 NEAT) rather than intense cardio that spikes cortisol and drives compensatory hunger.
================================================================================
`,
  evidenceTriad: {
    science: {
      title: "Mechanisms of Hypertrophy & Protein Turnover",
      subtitle: "Brad Schoenfeld & Eric Helms",
      tag: "Physiological Mechanism",
      coreRule: "Mechanical tension at 1–3 RIR + 2.0g/kg protein preserves muscle during a caloric deficit.",
      realWorldApplication:
        "Every working set is taken within 1–3 reps of technical failure with a controlled 3-second eccentric phase, triggering mechanosensitive mTOR signaling while fat stores supply the energy deficit."
    },
    socialAdherence: {
      title: "High-Satiety Food Volumetrics & Weekend Buffer",
      subtitle: "Dr. Barbara Rolls & James Clear",
      tag: "Behavioral Adherence",
      coreRule: "Never rely on willpower in an aggressive deficit; crowd out hunger with low-caloric-density bulk.",
      realWorldApplication:
        "Anchor daily meals around high-water, high-fiber staples (boiled potatoes, cruciferous vegetables, egg whites) and bank 150 kcal Mon–Thu to allow social dining on weekends without erasing progress."
    },
    proCoaching: {
      title: "Autoregulation & The Refeed Guardrail",
      subtitle: "Dr. Mike Israetel & Dr. Bill Campbell",
      tag: "Professional Guardrail",
      coreRule: "When performance drops on two consecutive sessions, insert a 48-hr maintenance refeed.",
      realWorldApplication:
        "Prevents the common failure mode of grinding through severe fatigue until an injury occurs or a binge cycle begins."
    }
  }
};

// Populate Week 1 workout archetypes
recompPreset.weeks[0].workoutArchetypes = [
  {
    workoutType: 'hypertrophy_upper_a',
    title: 'Upper Body A — Mechanical Tension & Horizontal Push/Pull',
    focus: 'Incline Dumbbell Press, Chest-Supported T-Bar Row, Cable Lateral Raises, and Overhead Triceps Extensions.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Rotator Cuff & Thoracic Mobilization Ramp',
        durationRatio: 0.15,
        instructions:
          'Perform 2 sets of 15 reps cable face pulls with external rotation, followed by 10 reps of scapular wall slides and empty-bar warm-up sets. Focus on activating the lower traps and serratus anterior.',
        focusCue: 'Depress shoulders down and back away from the ears; rotate thumbs back at peak contraction.',
        pitfallToAvoid: 'Rushing into heavy pressing with cold rotator cuffs and impinged shoulder joints.',
        layer: 'safety',
        layerReasoning:
          'Schoenfeld & Conti research demonstrates that pre-activating the rotator cuff reduces anterior shoulder capsule translation by 38% during heavy pressing.'
      },
      {
        stepNumber: 2,
        title: 'Incline Dumbbell Press & Chest-Supported Row (Mechanical Tension Core)',
        durationRatio: 0.55,
        instructions:
          'Incline DB Press (30° angle): 3 working sets of 8–10 reps at 2 RIR with a strict 3-second eccentric lower. Superset with Chest-Supported Cable or DB Row: 3 working sets of 10–12 reps, pausing for 1 second in full contraction.',
        focusCue: 'Tuck elbows to 45 degrees on the press; drive elbows behind the torso on the row.',
        pitfallToAvoid: 'Bouncing dumbbells at the bottom or flaring elbows out at 90 degrees.',
        layer: 'mechanism',
        layerReasoning:
          'Direct mechanical tension at 1–3 RIR triggers mechanosensitive titin kinase and mTORC1 phosphorylation, sending the primary anti-catabolic signal to preserve pectoral and lat fibers during caloric deficit.'
      },
      {
        stepNumber: 3,
        title: 'Lateral Deltoid & Long-Head Triceps Isolation',
        durationRatio: 0.3,
        instructions:
          'Cable Lateral Raises (cables set at wrist height): 3 sets of 12–15 reps with a 1-second hold at top. Overhead Cable Triceps Extensions: 3 sets of 12–15 reps emphasizing the deep stretch behind the head.',
        focusCue: 'Pour the water forward slightly with knuckles leading; feel the deep stretch behind the elbows on triceps.',
        pitfallToAvoid: 'Using torso swing or momentum to heave the lateral raises upward.',
        layer: 'adherence',
        layerReasoning:
          'Ending workouts with high-pump isolations delivers immediate visual feedback and endorphin release, significantly reinforcing workout consistency.'
      }
    ]
  },
  {
    workoutType: 'hypertrophy_lower_a',
    title: 'Lower Body A — Quad Dominance & Posterior Chain Tension',
    focus: 'Barbell or Hack Squat, Romanian Deadlift (RDL), Walking Lunges, and Standing Calf Raises.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Ankle Dorsiflexion & Hip Capsule Priming',
        durationRatio: 0.15,
        instructions:
          'Perform 2 minutes of banded ankle mobilization, 10 bodyweight Cossack squats, and 2 ramp-up squat sets with 50% working load. Ensure full depth without heel elevation.',
        focusCue: 'Screw feet into the floor; push knees out in line with the second toe.',
        pitfallToAvoid: 'Starting heavy squats with cold knees and tight hip flexors.',
        layer: 'safety',
        layerReasoning:
          'McGill spinal biomechanics research indicates that adequate ankle dorsiflexion prevents premature lumbar flexion (butt wink) at the bottom of the squat.'
      },
      {
        stepNumber: 2,
        title: 'Compound Squat & Romanian Deadlift Progression',
        durationRatio: 0.55,
        instructions:
          'Barbell Back Squat or Hack Squat: 3 sets of 6–8 reps at 2 RIR with a controlled 3-second descent. Rest 2.5 minutes. Romanian Deadlift (RDL): 3 sets of 8–10 reps pushing hips straight back until deep hamstring stretch.',
        focusCue: 'Brace abdominal wall 360 degrees; hinge back as if closing a car door with your glutes.',
        pitfallToAvoid: 'Rounding the lower spine on RDLs or cutting squat depth short.',
        layer: 'mechanism',
        layerReasoning:
          'Compound lower body recruitment releases local IGF-1 and commands massive metabolic energy expenditure while stimulating large-muscle preservation.'
      },
      {
        stepNumber: 3,
        title: 'Unilateral Quad Burnout & Standing Calf Volume',
        durationRatio: 0.3,
        instructions:
          'Walking Dumbbell Lunges: 2 sets of 12 paces per leg. Standing Calf Raise on a block: 3 sets of 12 reps with a full 2-second dead stop stretch at the bottom.',
        focusCue: 'Keep torso upright on lunges; pause completely at the bottom of calf raise to eliminate Achilles tendon spring recoil.',
        pitfallToAvoid: 'Bouncing up and down on calf raises without pausing at the bottom.',
        layer: 'adherence',
        layerReasoning:
          'Eliminating elastic recoil on calves forces pure gastrocnemius contractile recruitment, maximizing hypertrophy per unit of time.'
      }
    ]
  },
  {
    workoutType: 'recovery_neat',
    title: 'Active Recovery & NEAT Step Flush',
    focus: '8,000–10,000 daily steps in Zone 1/2, thoracic foam rolling, and hydration/protein auditing.',
    isRestDay: true,
    baseDurationMinutes: 15,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Outdoor Zone 1 Walking & Sunlight Exposure',
        durationRatio: 0.6,
        instructions:
          'Take a continuous 20–30 minute brisk walk outdoors. Aim to log 8,000 to 10,000 total steps for the day without breaking into a breathless sweat.',
        focusCue: 'Breathe rhythmically through your nose; maintain a relaxed, tall posture.',
        pitfallToAvoid: 'Sitting completely sedentary on rest days, which causes NEAT to plummet by 400+ kcal.',
        layer: 'mechanism',
        layerReasoning:
          'Low-intensity steady walking accelerates lactic clearance, stimulates lymphatic drainage, and increases caloric expenditure without triggering central nervous system fatigue or cortisol elevation.'
      },
      {
        stepNumber: 2,
        title: 'Hip Flexor & Thoracic Mobility Flow',
        durationRatio: 0.4,
        instructions:
          'Perform 5 minutes of 90/90 hip switches, couch stretch for the hip flexors (90s per side), and foam rolling along the upper thoracic spine.',
        focusCue: 'Squeeze the glute of the trailing leg on the couch stretch to actively open the anterior hip.',
        pitfallToAvoid: 'Hyperextending the lower back during hip flexor stretches.',
        layer: 'safety',
        layerReasoning:
          'Releasing anterior hip tension protects the lumbar spine from excessive lordosis and resets pelvic alignment before the next lower body training session.'
      }
    ]
  },
  {
    workoutType: 'hypertrophy_upper_b',
    title: 'Upper Body B — Vertical Pull/Push & Deltoid Width',
    focus: 'Neutral-Grip Lat Pulldown or Weighted Pull-ups, Standing Overhead Dumbbell Press, Cable Rows, and Incline Biceps Curls.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Scapular Depression & Shoulder Capsule Activation',
        durationRatio: 0.15,
        instructions:
          '2 sets of 10 dead hangs with active scapular pulls from a pull-up bar, followed by 15 reps of light band pull-aparts focusing on middle trapezius squeeze.',
        focusCue: 'Pull your shoulder blades into your back pockets without bending elbows.',
        pitfallToAvoid: 'Hanging passively with shoulders crammed against the ears.',
        layer: 'safety',
        layerReasoning:
          'Active scapular depression engages the lower trapezius and latissimus dorsi prior to heavy vertical pulling, preventing biceps tendonitis.'
      },
      {
        stepNumber: 2,
        title: 'Neutral-Grip Lat Pulldown & Seated Overhead Press',
        durationRatio: 0.55,
        instructions:
          'Neutral-Grip Lat Pulldown (or Weighted Chin-up): 3 sets of 8–10 reps at 2 RIR with a 2-second eccentric. Seated Overhead Dumbbell Press: 3 sets of 8–10 reps, lowering dumbbells smoothly to ear level.',
        focusCue: 'Drive elbows down to your hips on pulldown; press overhead in a slight arc over the crown of your head.',
        pitfallToAvoid: 'Leaning back excessively into a pseudo-bench press on overhead presses.',
        layer: 'mechanism',
        layerReasoning:
          'Vertical pulling at full stretch stimulates the latissimus dorsi at long muscle lengths, a primary driver of stretch-mediated muscle hypertrophy.'
      },
      {
        stepNumber: 3,
        title: 'Incline Dumbbell Curl & Cable Lateral Finisher',
        durationRatio: 0.3,
        instructions:
          'Incline Bench Dumbbell Curls (60° bench): 3 sets of 10–12 reps with arms hanging fully extended. Cable Lateral Raises: 3 sets of 15 reps taking the final set to 1 RIR.',
        focusCue: 'Keep shoulders back on the incline bench; feel the intense stretch on the long head of the bicep before curling.',
        pitfallToAvoid: 'Swinging elbows forward to cheat the curl using anterior deltoids.',
        layer: 'adherence',
        layerReasoning:
          'Targeting arms and lateral deltoids produces the sought-after V-taper aesthetic, reinforcing visual motivation during early fat loss stages.'
      }
    ]
  },
  {
    workoutType: 'hypertrophy_lower_b',
    title: 'Lower Body B — Unilateral Leg Strength & Hamstring Isolation',
    focus: 'Bulgarian Split Squats, Seated or Lying Hamstring Curls, Leg Press, and Hanging Knee Raises.',
    isRestDay: false,
    baseDurationMinutes: 60,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'Glute Medius & Core Brace Warm-Up',
        durationRatio: 0.15,
        instructions:
          'Perform 2 sets of 15 lateral monster band walks, 10 glute bridges with a 2-second hold, and 60 seconds of bird-dog core stabilization.',
        focusCue: 'Squeeze the glutes at full extension; brace the stomach as if taking a punch.',
        pitfallToAvoid: 'Arching the lower back instead of contracting the glutes.',
        layer: 'safety',
        layerReasoning:
          'Pre-activating the gluteus medius prevents dynamic knee valgus (knees caving inward) during demanding unilateral lower-body split squats.'
      },
      {
        stepNumber: 2,
        title: 'Bulgarian Split Squat & Hamstring Curl Hypertrophy Core',
        durationRatio: 0.55,
        instructions:
          'Bulgarian Split Squats (rear foot on bench): 3 sets of 8–10 reps per leg at 2 RIR with a slight forward torso lean for glute/quad loading. Lying or Seated Hamstring Curls: 3 sets of 10–12 reps with a 3-second controlled release.',
        focusCue: 'Drop the back knee straight toward the floor; pause for 1 second at the deep bottom stretch.',
        pitfallToAvoid: 'Pushing exclusively through the rear foot or allowing the front heel to lift.',
        layer: 'mechanism',
        layerReasoning:
          'Unilateral split squats correct bilateral strength asymmetries, while knee-flexion curls directly target the short head of the biceps femoris.'
      },
      {
        stepNumber: 3,
        title: 'Leg Press Burnout & Hanging Knee Raises',
        durationRatio: 0.3,
        instructions:
          'Leg Press (feet middle-stance): 2 sets of 12–15 reps at 2 RIR. Hanging Knee Raises or Captains Chair: 3 sets of 12–15 controlled reps pulling pelvis toward ribcage.',
        focusCue: 'Do not lock out knees violently at the top of the leg press; roll your pelvis upward on knee raises rather than just swinging legs.',
        pitfallToAvoid: 'Letting lower back round off the leg press seat at the bottom of the movement.',
        layer: 'adherence',
        layerReasoning:
          'Direct abdominal flexion builds rectus abdominis wall thickness so abdominal muscle definition is immediately apparent as body fat drops.'
      }
    ]
  },
  {
    workoutType: 'recovery_prep',
    title: 'Active Recovery, Satiety Meal Prep & Grocery Strategy',
    focus: '8,000 steps NEAT flush, batch-cooking high-satiety lean proteins and vegetables, and hydration review.',
    isRestDay: true,
    baseDurationMinutes: 15,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: 'High-Volume Satiety Prep (Crowding Out Hunger)',
        durationRatio: 0.6,
        instructions:
          'Batch cook 3–4 days of lean protein (chicken breast, 95% lean ground turkey, or extra firm tofu) and pre-roast high-volume cruciferous vegetables (broccoli, zucchini, asparagus) with zero-calorie cooking spray.',
        focusCue: 'Prepare 4 balanced containers with at least 35g of protein and 8g of dietary fiber each.',
        pitfallToAvoid: 'Leaving meals to impulse choices when hungry in an evening deficit.',
        layer: 'adherence',
        layerReasoning:
          'Research in behavioral economics shows pre-committed nutrition eliminates 80% of spontaneous binge episodes caused by decision fatigue.'
      },
      {
        stepNumber: 2,
        title: 'Restorative Foam Rolling & 8,000-Step Verification',
        durationRatio: 0.4,
        instructions:
          'Complete a gentle 15-minute foam rolling session for the quads, lats, and calves. Verify that daily step tracker reads ≥8,000 steps before dinner.',
        focusCue: 'Roll slowly; pause on tender trigger points for 30 seconds until muscle tone releases.',
        pitfallToAvoid: 'Rolling aggressively over bony prominences or bruised tissue.',
        layer: 'safety',
        layerReasoning:
          'Myofascial self-release reduces perceived muscle soreness (DOMS) and restores full resting sarcolemma length for upcoming workouts.'
      }
    ]
  },
  {
    workoutType: 'audit_refeed',
    title: 'Weekly Anthropometric Audit & Leptin Refeed Check',
    focus: '7-day rolling weight average, 3-point waist measurement, macro adherence audit, and refeed planning.',
    isRestDay: true,
    baseDurationMinutes: 15,
    drillStepsTemplate: [
      {
        stepNumber: 1,
        title: '7-Day Rolling Average & 3-Point Waist Circumference Audit',
        durationRatio: 0.5,
        instructions:
          'Calculate the 7-day rolling average of your morning weigh-ins (upon waking, post-urination). Measure waist circumference at the narrowest point, umbilicus (navel), and iliac crest. Record all data into the log.',
        focusCue: 'Measure relaxed on normal exhalation; do not suck in the stomach.',
        pitfallToAvoid: 'Reacting emotionally to single-day scale fluctuations caused by sodium or water retention.',
        layer: 'adherence',
        layerReasoning:
          'Weekly rolling averages smooth out up to 2.5kg of natural water fluctuations, preserving psychological motivation and preventing premature calorie slashing.'
      },
      {
        stepNumber: 2,
        title: 'Weekly Macro Adherence & Leptin Refeed Check',
        durationRatio: 0.5,
        instructions:
          'Review 7-day food logging: verify average daily deficit (300–500 kcal) and protein target (≥2.0g/kg). If entering Week 4 or Week 8, plan your upcoming 48-hour carbohydrate maintenance refeed.',
        focusCue: 'Assess energy levels, gym strength progression, and sleep quality across the past 7 days.',
        pitfallToAvoid: 'Treating a refeed as a "cheat day" of junk food; refeeds must consist of clean complex carbs at maintenance calories.',
        layer: 'mechanism',
        layerReasoning:
          'Controlled carbohydrate refeeds stimulate hepatic and adipocyte leptin secretion, sending the neuroendocrine satiety signal to the hypothalamus to sustain thyroid output.'
      }
    ]
  }
];
