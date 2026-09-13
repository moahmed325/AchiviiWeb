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
      question: 'What is your current technical & engineering background?',
      options: [
        { label: 'Experienced Developer', value: 'experienced', baseline_level: 'ADVANCED', description: 'Comfortable with full-stack code, databases, and APIs' },
        { label: 'Junior / Self-Taught', value: 'junior', baseline_level: 'INTERMEDIATE', description: 'Know some code, need structured step-by-step guidance' },
        { label: 'No-Code / Non-Technical', value: 'nocode', baseline_level: 'BEGINNER', description: 'Planning to build with modern no-code/low-code tools or AI scaffolding' },
      ],
    },
    {
      id: 'product_concept_status',
      question: 'Where does your product concept stand today?',
      options: [
        { label: 'Crystal-clear problem & validated demand', value: 'validated' },
        { label: 'Rough idea, needs scoping & feature trimming', value: 'rough_idea' },
        { label: 'Still exploring 2–3 different concepts', value: 'exploring' },
      ],
    },
    {
      id: 'weekly_time_commitment',
      question: 'How many hours per week can you reliably dedicate outside your main job?',
      options: [
        { label: '5–7 hours / week (Laser focused, 1 hr/day)', value: '6', recommended_weekly_hours: 6 },
        { label: '8–10 hours / week (Standard pacing)', value: '9', recommended_weekly_hours: 9 },
        { label: '12+ hours / week (Aggressive acceleration)', value: '14', recommended_weekly_hours: 14 },
      ],
    },
    {
      id: 'primary_past_bottleneck',
      question: 'What has been your biggest past obstacle when shipping side projects?',
      options: [
        { label: 'Scope creep (trying to build too much before launch)', value: 'scope_creep' },
        { label: 'Friction finishing UI/UX and auth/billing details', value: 'finishing_details' },
        { label: 'Inconsistent daily energy after work', value: 'energy_depletion' },
      ],
    },
    {
      id: 'ideal_dose_frequency',
      question: 'What session format best fits your daily rhythm?',
      options: [
        { label: 'Daily micro-sprints (45–60 mins every weekday morning)', value: 'daily_micro' },
        { label: '3–4 deep work sessions (90 mins in evening/weekend)', value: 'deep_blocks' },
        { label: 'Weekend heavy focus with light weekday maintenance', value: 'weekend_heavy' },
      ],
    },
    {
      id: 'target_outcome_definition',
      question: 'What does "Day 90 Success" mean for you?',
      options: [
        { label: 'Production deployed with first paying customer transaction', value: 'paying_customer' },
        { label: 'Public beta launched with 25+ active weekly users', value: 'active_beta' },
        { label: 'Polished MVP ready to pitch investors or showcase in portfolio', value: 'demo_ready' },
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
      question: 'What is your current running distance baseline right now?',
      options: [
        { label: 'Can run 0–2 km (Beginner / returning from long break)', value: 'beginner', baseline_level: 'BEGINNER' },
        { label: 'Comfortable running 5 km without stopping', value: '5k_comfortable', baseline_level: 'INTERMEDIATE' },
        { label: 'Regularly running 8–10 km weekly', value: '10k_runner', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'weekly_run_frequency',
      question: 'How many days per week can your legs recover and train?',
      options: [
        { label: '3 days / week (Run + cross-train + rest)', value: '3_days', recommended_weekly_hours: 3.5 },
        { label: '4 days / week (Recommended marathon cadence)', value: '4_days', recommended_weekly_hours: 5 },
        { label: '5 days / week (High volume)', value: '5_days', recommended_weekly_hours: 6.5 },
      ],
    },
    {
      id: 'injury_history',
      question: 'Do you have any past knee, shin, or tendon sensitivity?',
      options: [
        { label: 'None, feeling strong and healthy', value: 'none' },
        { label: 'Occasional knee or shin splints when ramping up fast', value: 'moderate' },
        { label: 'High risk, need conservative slow mileage progression', value: 'high_risk' },
      ],
    },
    {
      id: 'preferred_training_time',
      question: 'When during your day can you reliably hit the road or treadmill?',
      options: [
        { label: 'Early Morning (before work/commitments)', value: 'early_morning' },
        { label: 'Late Afternoon / Right after work', value: 'afternoon' },
        { label: 'Weekend concentrated mornings', value: 'weekend' },
      ],
    },
    {
      id: 'target_event_timeline',
      question: 'What is your event goal at the end of 90 days?',
      options: [
        { label: 'Finish a 10K with steady breathing and zero walking', value: 'solid_10k' },
        { label: 'Complete a full Half-Marathon (21.1 km)', value: 'finish_half' },
        { label: 'Break a specific personal pace record', value: 'pace_pr' },
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
      question: 'How much Spanish do you know right now?',
      options: [
        { label: 'Complete beginner (Ola, gracias, adios)', value: 'beginner', baseline_level: 'BEGINNER' },
        { label: 'A1 / Elementary (Know basic vocab, struggle with grammar)', value: 'a1', baseline_level: 'INTERMEDIATE' },
        { label: 'A2 / Pre-intermediate (Can read simple text, freeze speaking)', value: 'a2', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'daily_consistency_capacity',
      question: 'How much daily immersion time can you maintain consistently?',
      options: [
        { label: '20–30 mins daily (High consistency spaced repetition)', value: '25', recommended_weekly_hours: 3.5 },
        { label: '45 mins daily (Vocab sprint + audio comprehension)', value: '45', recommended_weekly_hours: 5 },
        { label: '60+ mins daily (Accelerated native media immersion)', value: '60', recommended_weekly_hours: 7 },
      ],
    },
    {
      id: 'main_learning_goal',
      question: 'What is your primary motivation for Spanish?',
      options: [
        { label: 'Upcoming travel & everyday local conversations', value: 'travel' },
        { label: 'Connect with family, friends, or bilingual colleagues', value: 'relationship' },
        { label: 'Brain fitness and cultural appreciation', value: 'culture' },
      ],
    },
    {
      id: 'biggest_learning_blocker',
      question: 'What has caused you to drop language learning in the past?',
      options: [
        { label: 'Grammar overload and feeling lost in conjugate charts', value: 'grammar_friction' },
        { label: 'Boring flashcard apps that did not help spoken fluency', value: 'rote_monotony' },
        { label: 'Fear of sounding foolish when attempting to speak', value: 'speaking_anxiety' },
      ],
    },
    {
      id: 'preferred_learning_style',
      question: 'How do you absorb language best?',
      options: [
        { label: 'Audio & conversational podcasts during commutes/walks', value: 'audio' },
        { label: 'Reading dialogues and structured pattern breakdown', value: 'visual_text' },
        { label: 'Active speaking drills and prompt recording', value: 'active_recall' },
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
      question: 'Where is your book or manuscript right now?',
      options: [
        { label: 'Just an idea in my head and notes on my phone', value: 'idea_only', baseline_level: 'BEGINNER' },
        { label: 'Detailed outline and bullet points ready', value: 'outline_ready', baseline_level: 'INTERMEDIATE' },
        { label: '10,000+ words of raw drafts already written', value: 'draft_in_progress', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'target_word_count',
      question: 'What is your target book length for publication?',
      options: [
        { label: 'Short guide / Manifesto (20,000–30,000 words)', value: '25k', recommended_weekly_hours: 5 },
        { label: 'Standard non-fiction book (40,000–50,000 words)', value: '45k', recommended_weekly_hours: 7 },
        { label: 'Comprehensive authority deep-dive (60,000+ words)', value: '60k', recommended_weekly_hours: 9 },
      ],
    },
    {
      id: 'writing_environment',
      question: 'When is your creative mind clearest for drafting?',
      options: [
        { label: 'Early morning coffee window (before email/messages)', value: 'early_morning' },
        { label: 'Evening quiet hours after household settles', value: 'late_evening' },
        { label: 'Dedicated weekend half-day writing marathons', value: 'weekend_blocks' },
      ],
    },
    {
      id: 'biggest_editorial_challenge',
      question: 'What is your biggest fear or friction point in writing?',
      options: [
        { label: 'Perfectionism (editing the first paragraph 20 times)', value: 'inner_critic' },
        { label: 'Running out of structure and getting stuck midway', value: 'midpoint_slump' },
        { label: 'Self-publishing mechanics (formatting, cover, Amazon setup)', value: 'publishing_tech' },
      ],
    },
    {
      id: 'primary_distribution_channel',
      question: 'How do you intend to publish this book?',
      options: [
        { label: 'Amazon Kindle Direct Publishing (KDP) eBook & Paperback', value: 'kdp' },
        { label: 'Personal website / Gumroad digital download', value: 'gumroad' },
        { label: 'Lead magnet for business or professional brand', value: 'lead_magnet' },
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
      question: 'What is your current software engineering experience level?',
      options: [
        { label: 'Mid-level backend engineer (ready to step into Senior)', value: 'mid_backend', baseline_level: 'INTERMEDIATE' },
        { label: 'Senior engineer targeting Staff / Principal bar', value: 'senior_staff', baseline_level: 'ADVANCED' },
        { label: 'Frontend / Fullstack engineer pivoting to deep infrastructure', value: 'fullstack_pivot', baseline_level: 'BEGINNER' },
      ],
    },
    {
      id: 'weekly_study_bandwidth',
      question: 'How much focused technical study can you execute weekly?',
      options: [
        { label: '4–6 hours / week (Paced theoretical + paper reading)', value: '5', recommended_weekly_hours: 5 },
        { label: '7–9 hours / week (Intensive labs + whiteboarding)', value: '8', recommended_weekly_hours: 8 },
        { label: '10+ hours / week (Rapid interview crunch)', value: '11', recommended_weekly_hours: 11 },
      ],
    },
    {
      id: 'specific_interview_timeline',
      question: 'Do you have upcoming system design interviews scheduled?',
      options: [
        { label: 'Yes, within 60–90 days (FAANG / Tier-1 tech)', value: 'upcoming_interviews' },
        { label: 'No, long-term mastery for on-the-job architectural leadership', value: 'long_term_mastery' },
        { label: 'Exploring for architecture certifications', value: 'certification' },
      ],
    },
    {
      id: 'primary_knowledge_gap',
      question: 'Where do you feel least confident during architecture discussions?',
      options: [
        { label: 'Consensus algorithms (Raft, Paxos, quorum reads/writes)', value: 'consensus' },
        { label: 'Data storage engines (LSM-trees, WAL, sharding strategies)', value: 'storage_engines' },
        { label: 'High-throughput stream processing & event sourcing', value: 'stream_processing' },
      ],
    },
    {
      id: 'preferred_learning_format',
      question: 'How do you synthesize complex systems concepts fastest?',
      options: [
        { label: 'Mock whiteboarding & timed 45-minute architectural designs', value: 'whiteboarding' },
        { label: 'Hands-on code labs (building mini-Kafka or KV store)', value: 'code_labs' },
        { label: 'Reading foundational engineering papers (Google Spanner, Dynamo)', value: 'papers' },
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
      question: 'What is your past experience with meditation and breathwork?',
      options: [
        { label: 'Never meditated or struggled to sit still for 2 minutes', value: 'novice', baseline_level: 'BEGINNER' },
        { label: 'Used meditation apps (Headspace/Calm) intermittently', value: 'occasional', baseline_level: 'INTERMEDIATE' },
        { label: 'Have maintained an active practice in the past', value: 'experienced', baseline_level: 'ADVANCED' },
      ],
    },
    {
      id: 'primary_stress_driver',
      question: 'What is the main trigger you want to regulate?',
      options: [
        { label: 'Work burnout, racing thoughts, and sleep latency', value: 'burnout_sleep' },
        { label: 'Attention fragmentation and constant context switching', value: 'focus_attention' },
        { label: 'Physical tension and shallow breathing under deadlines', value: 'physical_tension' },
      ],
    },
    {
      id: 'daily_window_anchor',
      question: 'When can you best anchor a 15-minute daily reset?',
      options: [
        { label: 'First thing upon waking (before checking phone)', value: 'morning_anchor' },
        { label: 'Midday transition (between morning work and lunch)', value: 'midday_anchor' },
        { label: 'Nightly wind-down (30 mins before sleep)', value: 'evening_anchor' },
      ],
    },
    {
      id: 'preferred_breath_technique',
      question: 'Which style of practice resonates most?',
      options: [
        { label: 'Physiological breathwork (Box breathing, 4-7-8, physiological sigh)', value: 'breathwork' },
        { label: 'Mindful open-monitoring and sensory grounding', value: 'mindfulness' },
        { label: 'Somatic body scans and progressive muscle relaxation', value: 'somatic' },
      ],
    },
    {
      id: 'streak_vulnerability',
      question: 'What usually derails your daily habits?',
      options: [
        { label: 'Missing a single day and feeling like I failed completely', value: 'all_or_nothing' },
        { label: 'Travel, busy mornings, or unexpected calendar fires', value: 'schedule_volatility' },
        { label: 'Forgetting because it lacks a clear environmental cue', value: 'missing_trigger' },
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
