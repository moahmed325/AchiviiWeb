import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OnboardingQuestion {
  id: string;
  question: string;
  help_text?: string;
  options: {
    label: string;
    value: string;
    description?: string;
    baseline_level?: string;
    recommended_weekly_hours?: number;
  }[];
}

export interface BlueprintMetadata {
  nominal_session_duration_minutes: number;
  minimum_viable_session_minutes: number;
  preferred_window: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY';
  energy_requirement: 'HIGH' | 'MEDIUM' | 'LOW';
  capability_dag: {
    id: string;
    name: string;
    prerequisites: string[];
    description: string;
  }[];
  milestones: {
    week: number;
    title: string;
    exit_criteria: string;
  }[];
}

async function main() {
  console.log('🌱 Starting Goal Catalog seed with 5–7 Onboarding Questions & Blueprint Metadata...');

  // 1. SaaS MVP
  const saasQuestions: OnboardingQuestion[] = [
    {
      id: 'current_technical_level',
      question: 'What is your current hands-on software development experience?',
      options: [
        { label: 'Complete beginner (written basic scripts or tutorials, never deployed live software)', value: 'beginner', baseline_level: 'BEGINNER' },
        { label: 'Comfortable with frontend or backend code, but have never shipped a fullstack app with live auth and database', value: 'intermediate', baseline_level: 'INTERMEDIATE' },
        { label: 'Professional engineer (ship code daily, seeking a disciplined sprint to launch an independent product)', value: 'advanced', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'technical_comfort_zone',
      question: 'Where is your current technical comfort zone?',
      options: [
        { label: 'Stronger on UI/design/frontend; need clear scaffolding for database schemas, auth, and backend APIs', value: 'frontend_heavy' },
        { label: 'Stronger on databases and server logic; need structured layouts and clean component guidelines for UI', value: 'backend_heavy' },
        { label: 'Comfortable across both; primary need is ruthless feature scoping and shipping discipline', value: 'fullstack_balanced' },
      ],
    },
    {
      id: 'weekly_builder_bandwidth',
      question: 'How much dedicated building time can you sustainably protect each week?',
      options: [
        { label: '~5 hours / week (Light pace: 3 sessions of ~90 min or 4 of ~75 min)', value: '5', recommended_weekly_hours: 5 },
        { label: '~8 hours / week (Recommended MVP cadence: 4 sessions of ~2 hours)', value: '8', recommended_weekly_hours: 8 },
        { label: '~12 hours / week (Aggressive sprint pace)', value: '12', recommended_weekly_hours: 12 },
      ],
    },
    {
      id: 'target_launch_architecture',
      question: 'What is your target launch architecture for Day 90?',
      options: [
        { label: 'Web application with Stripe subscriptions and self-serve onboarding', value: 'web_saas' },
        { label: 'Developer tool, API service, or automated micro-SaaS workflow', value: 'api_tool' },
        { label: 'Targeted B2B workflow tool solved for a specific client or business niche', value: 'internal_b2b' },
      ],
    },
  ];

  const saasMetadata: BlueprintMetadata = {
    nominal_session_duration_minutes: 75,
    minimum_viable_session_minutes: 30,
    preferred_window: 'MORNING',
    energy_requirement: 'HIGH',
    capability_dag: [
      { id: 'spec_scope', name: 'PRD & Lean Architecture Spec', prerequisites: [], description: 'Define core user loop and data model' },
      { id: 'auth_db', name: 'Database & Auth Scaffold', prerequisites: ['spec_scope'], description: 'Postgres/Prisma and JWT/OAuth engine' },
      { id: 'core_loop', name: 'Core Feature Workflow API', prerequisites: ['auth_db'], description: 'Primary value-generating application endpoint' },
      { id: 'ui_dashboard', name: 'Responsive Frontend Dashboard', prerequisites: ['core_loop'], description: 'Clean user journey and state sync' },
      { id: 'billing_stripe', name: 'Stripe Billing & Subscriptions', prerequisites: ['ui_dashboard'], description: 'Checkout session and webhook handling' },
      { id: 'production_deploy', name: 'Production Cloud Deployment & Custom Domain', prerequisites: ['billing_stripe'], description: 'CI/CD and live traffic testing' },
    ],
    milestones: [
      { week: 4, title: 'Working Database & Auth Backend Complete', exit_criteria: 'User can sign up and execute core API loop' },
      { week: 8, title: 'End-to-End Functional Dashboard UI', exit_criteria: 'Full user journey interactive in staging' },
      { week: 12, title: 'Production Launch & Payment Readiness', exit_criteria: 'Stripe live payments active and 1st external user onboarded' },
    ],
  };

  await prisma.goalCatalog.upsert({
    where: { id: 'saas-mvp-catalog-id' },
    update: {
      onboarding_questions: JSON.stringify(saasQuestions),
      blueprint_metadata: JSON.stringify(saasMetadata),
      est_weekly_hours: 8,
    },
    create: {
      id: 'saas-mvp-catalog-id',
      title: 'Build & Launch a SaaS MVP',
      description: 'Go from initial concept to a deployed, revenue-ready software product with production auth, database, and billing in 90 days.',
      category: 'Technology',
      icon: 'Rocket',
      est_weekly_hours: 8,
      onboarding_questions: JSON.stringify(saasQuestions),
      blueprint_metadata: JSON.stringify(saasMetadata),
    },
  });

  // 2. Half-Marathon
  const runQuestions: OnboardingQuestion[] = [
    {
      id: 'current_running_baseline',
      question: 'What is the furthest you have run continuously in the last 30 days without walking?',
      options: [
        { label: '0 to 2 km (Complete beginner or returning from a long break)', value: '0_to_2k', baseline_level: 'BEGINNER' },
        { label: 'Comfortable running 5 km non-stop at an easy, conversational pace', value: '5k_solid', baseline_level: 'INTERMEDIATE' },
        { label: 'Regularly running 8–10 km weekly without difficulty', value: '10k_runner', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'cardio_tendon_balance',
      question: 'How do your legs and lungs typically feel when running?',
      options: [
        { label: 'Lungs and heart rate spike quickly, but muscles and joints feel fine', value: 'cardio_limited' },
        { label: 'Breathing feels effortless, but knees, shins, or calves get tight and sore', value: 'tendon_limited' },
        { label: 'Cardio and joint tolerance feel well-matched; ready for structured pacing intervals', value: 'balanced_engine' },
      ],
    },
    {
      id: 'weekly_run_cadence',
      question: 'How many days per week can your body train and recover?',
      options: [
        { label: '3 days / week (~3.5 to 4.5 hours total — optimal for busy schedules)', value: '3_days', recommended_weekly_hours: 4 },
        { label: '4 days / week (~5 to 6 hours total — recommended half-marathon cadence)', value: '4_days', recommended_weekly_hours: 5.5 },
        { label: '5 days / week (~6.5+ hours — high-volume endurance development)', value: '5_days', recommended_weekly_hours: 7 },
      ],
    },
    {
      id: 'target_event_finish',
      question: 'What is your target finish line for Day 90?',
      options: [
        { label: 'Finish a continuous 10 km with steady breathing and zero walking breaks', value: 'solid_10k' },
        { label: 'Complete a full 21.1 km Half-Marathon with comfortable, sustained pacing', value: 'finish_half' },
        { label: 'Break a specific personal record (10K sub-50 or Half sub-1:50)', value: 'pace_breakthrough' },
      ],
    },
  ];

  const runMetadata: BlueprintMetadata = {
    nominal_session_duration_minutes: 45,
    minimum_viable_session_minutes: 20,
    preferred_window: 'MORNING',
    energy_requirement: 'HIGH',
    capability_dag: [
      { id: 'aerobic_base_5k', name: 'Continuous 5K Aerobic Base', prerequisites: [], description: 'Zone 2 running for 30 uninterrupted minutes' },
      { id: 'leg_tendon_adaptation', name: 'Tendon & Joint Load Tolerance', prerequisites: ['aerobic_base_5k'], description: 'Progressive weekly volume increase <= 10%' },
      { id: 'tempo_threshold_8k', name: 'Lactate Threshold 8K Pace', prerequisites: ['leg_tendon_adaptation'], description: 'Sustained tempo intervals' },
      { id: 'long_run_15k', name: 'Long Run 15K Milestone', prerequisites: ['tempo_threshold_8k'], description: 'Overcoming glycogen depletion hurdle' },
      { id: 'taper_race_ready', name: 'Race Simulation & Taper Peak', prerequisites: ['long_run_15k'], description: 'Carb load, pacing discipline, race execution' },
    ],
    milestones: [
      { week: 4, title: '5K Non-Stop Aerobic Foundation Achieved', exit_criteria: 'Completed 5km with steady nose-breathing / Zone 2' },
      { week: 8, title: '12K Long Run Milestone Cleared', exit_criteria: 'Long run completed without joint pain' },
      { week: 12, title: 'Race Distance Achievement (21.1 km)', exit_criteria: 'Full distance completed with structured pacing' },
    ],
  };

  await prisma.goalCatalog.upsert({
    where: { id: 'half-marathon-catalog-id' },
    update: {
      onboarding_questions: JSON.stringify(runQuestions),
      blueprint_metadata: JSON.stringify(runMetadata),
      est_weekly_hours: 5,
    },
    create: {
      id: 'half-marathon-catalog-id',
      title: 'Run a 10K / Half-Marathon',
      description: 'Build aerobic capacity, cardiovascular stamina, and injury resilience through progressive mileage over 12 structured weeks.',
      category: 'Health & Fitness',
      icon: 'Flame',
      est_weekly_hours: 5,
      onboarding_questions: JSON.stringify(runQuestions),
      blueprint_metadata: JSON.stringify(runMetadata),
    },
  });

  // 3. Spanish Fluency
  const spanishQuestions: OnboardingQuestion[] = [
    {
      id: 'current_fluency_stage',
      question: 'What is your current grasp of spoken Spanish?',
      options: [
        { label: 'Complete beginner (know basic greetings like hola, gracias, adios)', value: 'complete_beginner', baseline_level: 'BEGINNER' },
        { label: 'Know basic vocabulary and present tense, but freeze when trying to speak real sentences', value: 'a1_elementary', baseline_level: 'INTERMEDIATE' },
        { label: 'Can read simple text and understand slow audio, but struggle with past tenses and fast conversations', value: 'a2_intermediate', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'learning_comfort_zone',
      question: 'Where is your current learning comfort zone?',
      options: [
        { label: 'Can recognize written words easily, but have trouble catching rapid spoken audio', value: 'visual_reading' },
        { label: 'Good at repeating pronunciation and sounds, but get lost in grammar rules and conjugation tables', value: 'audio_mimic' },
        { label: 'Understand the rules intellectually, but hesitate and overthink before speaking', value: 'grammar_conscious' },
      ],
    },
    {
      id: 'daily_immersion_pace',
      question: 'What daily immersion pace fits your schedule best?',
      options: [
        { label: '20–25 mins daily (~3.5 hrs/week — high consistency spaced repetition)', value: '20m_daily', recommended_weekly_hours: 3.5 },
        { label: '35–40 mins daily (~4.5 hrs/week — balanced vocab + audio comprehension)', value: '35m_daily', recommended_weekly_hours: 4.5 },
        { label: '50+ mins daily (~6 hrs/week — accelerated conversational sprint)', value: '50m_daily', recommended_weekly_hours: 6 },
      ],
    },
  ];

  const spanishMetadata: BlueprintMetadata = {
    nominal_session_duration_minutes: 30,
    minimum_viable_session_minutes: 15,
    preferred_window: 'MORNING',
    energy_requirement: 'MEDIUM',
    capability_dag: [
      { id: 'phonetics_500_vocab', name: 'High-Frequency 500 Words & Pronunciation', prerequisites: [], description: 'Core functional vocabulary for 70% of spoken words' },
      { id: 'present_past_conjugation', name: 'Present & Past (Pretérito) Mastery', prerequisites: ['phonetics_500_vocab'], description: 'Constructing narrative statements without hesitation' },
      { id: 'listening_ear_acclimation', name: 'Native Audio Comprehension at 0.9x', prerequisites: ['present_past_conjugation'], description: 'Dissecting contractions and connected speech' },
      { id: 'spontaneous_dialogue', name: '15-Minute Uninterrupted Dialogue Drill', prerequisites: ['listening_ear_acclimation'], description: 'Circumlocution and fluid responses' },
      { id: 'b1_checkpoint', name: 'B1 Conversational Fluency Certification', prerequisites: ['spontaneous_dialogue'], description: 'Able to handle unexpected travel and social situations' },
    ],
    milestones: [
      { week: 4, title: 'Top 500 Vocab & Present Tense Automaticity', exit_criteria: 'Pass 100-sentence translation test in under 10 minutes' },
      { week: 8, title: 'Past/Future Tenses & 5-Min Spoken Audio Diary', exit_criteria: 'Recorded 5-minute unscripted Spanish audio recap' },
      { week: 12, title: 'B1 Conversational Fluency Checkpoint', exit_criteria: '30-minute real-time spoken exchange completed' },
    ],
  };

  await prisma.goalCatalog.upsert({
    where: { id: 'spanish-fluency-catalog-id' },
    update: {
      onboarding_questions: JSON.stringify(spanishQuestions),
      blueprint_metadata: JSON.stringify(spanishMetadata),
      est_weekly_hours: 5,
    },
    create: {
      id: 'spanish-fluency-catalog-id',
      title: 'Learn Conversational Spanish to B1',
      description: 'Master practical everyday Spanish through daily spaced-repetition vocabulary, listening comprehension, and structured dialogue drills over 90 days.',
      category: 'Languages',
      icon: 'Globe',
      est_weekly_hours: 5,
      onboarding_questions: JSON.stringify(spanishQuestions),
      blueprint_metadata: JSON.stringify(spanishMetadata),
    },
  });

  // 4. Publish Book
  const bookQuestions: OnboardingQuestion[] = [
    {
      id: 'manuscript_starting_state',
      question: 'Where does your book manuscript stand right now?',
      options: [
        { label: 'Raw ideas, voice notes, or bullet points in my phone (0 words drafted)', value: 'idea_only', baseline_level: 'BEGINNER' },
        { label: 'Clear chapter outline and core thesis ready, but haven\'t started full drafting', value: 'detailed_outline', baseline_level: 'INTERMEDIATE' },
        { label: '10,000+ words of rough drafts already written', value: 'draft_in_progress', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'writing_comfort_zone',
      question: 'What part of writing comes most naturally to you?',
      options: [
        { label: 'Generating ideas, anecdotes, and stories is easy; structuring them into a coherent argument is hard', value: 'generative_flow' },
        { label: 'Bullet points and logical frameworks are easy; expanding them into engaging prose is hard', value: 'logical_structure' },
        { label: 'Line editing and sharpening sentences is easy; writing the messy first draft without self-censoring is hard', value: 'editing_polish' },
      ],
    },
    {
      id: 'target_weekly_words',
      question: 'What target weekly word output matches your bandwidth?',
      options: [
        { label: '~2,000 words / week (~4–5 hrs/wk — ideal for busy professionals)', value: 'light_sprint', recommended_weekly_hours: 4.5 },
        { label: '~3,500 words / week (~6–7 hrs/wk — complete draft in 8 weeks)', value: 'standard_sprint', recommended_weekly_hours: 6.5 },
        { label: '~5,000 words / week (~9 hrs/wk — dedicated writing marathon)', value: 'intensive_sprint', recommended_weekly_hours: 9 },
      ],
    },
    {
      id: 'distribution_format',
      question: 'How do you plan to publish this book upon completion?',
      options: [
        { label: 'Amazon Kindle eBook & Paperback with professional interior formatting', value: 'amazon_kdp' },
        { label: 'Personal website / Gumroad digital download (PDF/EPUB) for an existing audience', value: 'digital_direct' },
        { label: 'High-value lead magnet or manifesto to establish professional brand authority', value: 'industry_authority' },
      ],
    },
  ];

  const bookMetadata: BlueprintMetadata = {
    nominal_session_duration_minutes: 60,
    minimum_viable_session_minutes: 25,
    preferred_window: 'MORNING',
    energy_requirement: 'HIGH',
    capability_dag: [
      { id: 'thesis_chapter_outline', name: 'Comprehensive Table of Contents & Chapter Prompts', prerequisites: [], description: '10-chapter architectural blueprint with thesis hooks' },
      { id: 'fast_draft_sprint_1', name: 'First Draft Section 1 (Chapters 1–4)', prerequisites: ['thesis_chapter_outline'], description: 'Raw generative drafting without self-editing' },
      { id: 'fast_draft_sprint_2', name: 'First Draft Section 2 (Chapters 5–10)', prerequisites: ['fast_draft_sprint_1'], description: 'Completing full manuscript word count' },
      { id: 'developmental_editing', name: 'Structural & Line Editing Polish', prerequisites: ['fast_draft_sprint_2'], description: 'Flow, pacing, clarity, and case study sharpening' },
      { id: 'kdp_formatting_cover', name: 'Typography, Interior Layout & Cover Production', prerequisites: ['developmental_editing'], description: 'EPUB and print-ready PDF compilation' },
    ],
    milestones: [
      { week: 4, title: 'Complete Blueprint & First 12,000 Words Drafted', exit_criteria: 'Chapters 1-3 draft locked' },
      { week: 8, title: 'Zero-Draft Complete (35,000+ Words)', exit_criteria: 'Full beginning-to-end manuscript completed' },
      { week: 12, title: 'Published & Live on Amazon KDP', exit_criteria: 'Book live with ISBN and sample chapter readable' },
    ],
  };

  await prisma.goalCatalog.upsert({
    where: { id: 'publish-book-catalog-id' },
    update: {
      onboarding_questions: JSON.stringify(bookQuestions),
      blueprint_metadata: JSON.stringify(bookMetadata),
      est_weekly_hours: 6,
    },
    create: {
      id: 'publish-book-catalog-id',
      title: 'Write & Publish a Non-Fiction Book',
      description: 'Transform your knowledge into a published Amazon Kindle book in 12 structured weeks with deep-work writing sprints and professional formatting.',
      category: 'Writing & Creative',
      icon: 'BookOpen',
      est_weekly_hours: 6,
      onboarding_questions: JSON.stringify(bookQuestions),
      blueprint_metadata: JSON.stringify(bookMetadata),
    },
  });

  // 5. Distributed Systems
  const sysQuestions: OnboardingQuestion[] = [
    {
      id: 'current_engineering_level',
      question: 'What is your current backend engineering experience level?',
      options: [
        { label: 'Fullstack or frontend engineer pivoting to deep backend and distributed infrastructure', value: 'fullstack_pivot', baseline_level: 'BEGINNER' },
        { label: 'Mid-level backend engineer confident with single-node relational DBs, ready for distributed consensus, sharding, and scale', value: 'mid_backend', baseline_level: 'INTERMEDIATE' },
        { label: 'Senior engineer preparing for Staff/Principal architecture reviews or Tier-1 system design interviews', value: 'senior_staff', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'architecture_comfort_zone',
      question: 'Where do you feel least confident during architecture deep dives?',
      options: [
        { label: 'Database engines, LSM-trees vs B-Trees, WAL, write amplification, and sharding strategies', value: 'storage_internals' },
        { label: 'Raft, Paxos, quorum arithmetic, linearizability, and split-brain recovery', value: 'consensus_replication' },
        { label: 'Translating architectural knowledge into crisp 45-minute timed design presentations with clean math', value: 'whiteboard_defense' },
      ],
    },
    {
      id: 'weekly_study_bandwidth',
      question: 'How much deep-focus technical study can you execute weekly?',
      options: [
        { label: '4–5 hours / week (Paced theoretical deep dive + paper breakdowns)', value: '5', recommended_weekly_hours: 5 },
        { label: '7–8 hours / week (Balanced mix of paper reading + hands-on coding labs)', value: '8', recommended_weekly_hours: 8 },
        { label: '10+ hours / week (Accelerated interview crunch / rapid mastery)', value: '11', recommended_weekly_hours: 11 },
      ],
    },
  ];

  const sysMetadata: BlueprintMetadata = {
    nominal_session_duration_minutes: 60,
    minimum_viable_session_minutes: 30,
    preferred_window: 'EVENING',
    energy_requirement: 'HIGH',
    capability_dag: [
      { id: 'storage_indexing', name: 'Database Internals: B-Trees vs LSM-Trees', prerequisites: [], description: 'Read/write amplification and compaction mechanisms' },
      { id: 'replication_consensus', name: 'Replication, Raft Consensus & Linearizability', prerequisites: ['storage_indexing'], description: 'Split-brain prevention and quorum arithmetic' },
      { id: 'event_driven_streaming', name: 'Event Sourcing & Stream Processing Architectures', prerequisites: ['replication_consensus'], description: 'Kafka partition semantics and idempotency' },
      { id: 'scale_reliability_sre', name: 'Failure Modes, Circuit Breaking & Rate Limiting', prerequisites: ['event_driven_streaming'], description: 'Thundering herds, cascading failures, backoff' },
      { id: 'whiteboard_fluency', name: '45-Min End-to-End System Design Defense', prerequisites: ['scale_reliability_sre'], description: 'Clear estimations, API contracts, deep dive defense' },
    ],
    milestones: [
      { week: 4, title: 'Storage Engines & Partitioning Mastery', exit_criteria: 'Architected distributed KV-store with sharding plan' },
      { week: 8, title: 'Consensus & Event-Driven Labs Completed', exit_criteria: 'Implemented mini-raft leader election or Kafka pipeline' },
      { week: 12, title: 'Full Staff-Level System Design Simulation Passed', exit_criteria: 'Delivered flawless 45-min whiteboard presentation' },
    ],
  };

  await prisma.goalCatalog.upsert({
    where: { id: 'system-design-catalog-id' },
    update: {
      onboarding_questions: JSON.stringify(sysQuestions),
      blueprint_metadata: JSON.stringify(sysMetadata),
      est_weekly_hours: 7,
    },
    create: {
      id: 'system-design-catalog-id',
      title: 'Master Distributed Systems Architecture',
      description: 'Level up to Senior/Staff engineer with hands-on deep dives into replication, sharding, consensus, event-driven architectures, and high-throughput systems.',
      category: 'Career & Engineering',
      icon: 'Server',
      est_weekly_hours: 7,
      onboarding_questions: JSON.stringify(sysQuestions),
      blueprint_metadata: JSON.stringify(sysMetadata),
    },
  });

  // 6. Mindfulness Habit
  const mindQuestions: OnboardingQuestion[] = [
    {
      id: 'meditation_history',
      question: 'What is your past experience with daily meditation or breathwork?',
      options: [
        { label: 'Complete novice (struggle to sit still or focus on breath for 2 uninterrupted minutes)', value: 'novice', baseline_level: 'BEGINNER' },
        { label: 'Have used apps like Headspace or Calm on and off, but never maintained an unbreakable daily streak', value: 'intermittent', baseline_level: 'INTERMEDIATE' },
        { label: 'Comfortable with unguided sitting, looking to integrate physiological breath resets into high-stress days', value: 'experienced', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'practice_comfort_zone',
      question: 'What style of practice feels most intuitive and grounding for you?',
      options: [
        { label: 'Active breathing mechanics (Box breathing, physiological sigh, 4-7-8) that produce rapid physiological calm', value: 'physiological_breathwork' },
        { label: 'Silent observation of thoughts and sensory awareness without judgment or reaction', value: 'open_monitoring' },
        { label: 'Progressive muscle relaxation and body scans to release physical tension from the chest and shoulders', value: 'somatic_relaxation' },
      ],
    },
    {
      id: 'daily_session_duration',
      question: 'What daily session duration can you guarantee every single day without fail?',
      options: [
        { label: '10 minutes daily (Light, reliable baseline anchor)', value: '10m_daily', recommended_weekly_hours: 2 },
        { label: '15 minutes daily (Recommended standard dose for neuroplastic adaptation)', value: '15m_daily', recommended_weekly_hours: 3 },
        { label: '20 minutes daily (Deep meditation & nervous system regulation)', value: '20m_daily', recommended_weekly_hours: 4 },
      ],
    },
  ];

  const mindMetadata: BlueprintMetadata = {
    nominal_session_duration_minutes: 15,
    minimum_viable_session_minutes: 5,
    preferred_window: 'MORNING',
    energy_requirement: 'LOW',
    capability_dag: [
      { id: 'vagal_breath_mechanics', name: 'Physiological Sigh & Vagal Tone Activation', prerequisites: [], description: 'Mastering diaphragmatic pacing to downregulate sympathetic tone' },
      { id: 'morning_micro_anchor', name: 'Unbreakable 5-Minute Morning Habit Trigger', prerequisites: ['vagal_breath_mechanics'], description: 'Coupling breathwork to morning coffee/water' },
      { id: 'open_monitoring_10m', name: 'Open Monitoring & Sensory Non-Reactivity', prerequisites: ['morning_micro_anchor'], description: 'Observing intrusive thoughts without cognitive pursuit' },
      { id: 'stress_inoculation_reset', name: 'Real-Time Stress Inoculation Reset', prerequisites: ['open_monitoring_10m'], description: 'Deploying 60-second micro-resets during high pressure' },
      { id: 'autonomous_daily_practice', name: 'Autonomous Unguided 20-Minute Sitting', prerequisites: ['stress_inoculation_reset'], description: 'Effortless daily baseline established' },
    ],
    milestones: [
      { week: 4, title: '21 Consecutive Days of Morning Breathwork', exit_criteria: 'Zero missed days on 5-min minimum dose' },
      { week: 8, title: 'Open Monitoring Meditation (15 min daily)', exit_criteria: 'Comfortable unguided sitting for 15 minutes' },
      { week: 12, title: 'Integrated Mindfulness Operating System', exit_criteria: 'Lower resting heart rate and automatic stress interception' },
    ],
  };

  await prisma.goalCatalog.upsert({
    where: { id: 'mindfulness-catalog-id' },
    update: {
      onboarding_questions: JSON.stringify(mindQuestions),
      blueprint_metadata: JSON.stringify(mindMetadata),
      est_weekly_hours: 3,
    },
    create: {
      id: 'mindfulness-catalog-id',
      title: 'Daily Mindfulness & Breathwork Habit',
      description: 'Lower resting cortisol, improve focus, and build an unbreakable daily mindfulness practice through physiological breathwork and open monitoring.',
      category: 'Wellness & Mindset',
      icon: 'Heart',
      est_weekly_hours: 3,
      onboarding_questions: JSON.stringify(mindQuestions),
      blueprint_metadata: JSON.stringify(mindMetadata),
    },
  });

  console.log('🎉 Full 6-Goal Catalog Seed completed with rich questions and blueprint metadata!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
