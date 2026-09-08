import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Goal Catalog seed...');

  // Upsert Goal 1: Build & Launch a SaaS MVP
  const saasGoal = await prisma.goalCatalog.upsert({
    where: { id: 'saas-mvp-catalog-id' },
    update: {},
    create: {
      id: 'saas-mvp-catalog-id',
      title: 'Build & Launch a SaaS MVP',
      description: 'Go from initial concept to a deployed, revenue-ready software product with production auth, database, and billing in 90 days.',
      category: 'Technology',
      icon: 'Rocket',
      est_weekly_hours: 8,
      phases: {
        create: [
          {
            phase_order: 1,
            title: 'Phase 1: Foundation & Core Backend (Weeks 1–4)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Data Architecture & API Design',
                  sessions_per_week: 3,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'evening',
                },
                {
                  title: 'Authentication & Security Engine',
                  sessions_per_week: 2,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          },
          {
            phase_order: 2,
            title: 'Phase 2: Interactive Frontend & User Flows (Weeks 5–8)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Dashboard Layout & Core Feature UI',
                  sessions_per_week: 3,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'evening',
                },
                {
                  title: 'API Integration & Client State Sync',
                  sessions_per_week: 2,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'afternoon',
                },
              ],
            },
          },
          {
            phase_order: 3,
            title: 'Phase 3: Testing, Billing & Product Launch (Weeks 9–12)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'End-to-End Testing & Critical Bug Fixes',
                  sessions_per_week: 3,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'evening',
                },
                {
                  title: 'Landing Page, Payment Setup & Launch',
                  sessions_per_week: 2,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded goal: ${saasGoal.title}`);

  // Upsert Goal 2: Run a 10K / Half-Marathon
  const runningGoal = await prisma.goalCatalog.upsert({
    where: { id: 'half-marathon-catalog-id' },
    update: {},
    create: {
      id: 'half-marathon-catalog-id',
      title: 'Run a 10K / Half-Marathon',
      description: 'Build aerobic capacity, cardiovascular stamina, and injury resilience through progressive mileage over 12 structured weeks.',
      category: 'Health & Fitness',
      icon: 'Flame',
      est_weekly_hours: 5,
      phases: {
        create: [
          {
            phase_order: 1,
            title: 'Phase 1: Aerobic Base & Routine Consistency (Weeks 1–4)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Easy Aerobic Base Run',
                  sessions_per_week: 3,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Core & Leg Stability Workout',
                  sessions_per_week: 2,
                  session_duration_minutes: 30,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 2,
            title: 'Phase 2: Endurance & Distance Building (Weeks 5–8)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Paced Tempo Run',
                  sessions_per_week: 2,
                  session_duration_minutes: 50,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Weekend Progression Long Run',
                  sessions_per_week: 1,
                  session_duration_minutes: 75,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Active Mobility & Recovery Routine',
                  sessions_per_week: 2,
                  session_duration_minutes: 30,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 3,
            title: 'Phase 3: Peak Mileage & Race Readiness (Weeks 9–12)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Threshold Interval Training',
                  sessions_per_week: 2,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Peak Distance Endurance Run',
                  sessions_per_week: 1,
                  session_duration_minutes: 90,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Pre-Race Shakeout & Recovery',
                  sessions_per_week: 2,
                  session_duration_minutes: 25,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`✅ Seeded goal: ${runningGoal.title}`);

  // Upsert Goal 3: Learn Conversational Spanish to B1
  const spanishGoal = await prisma.goalCatalog.upsert({
    where: { id: 'spanish-fluency-catalog-id' },
    update: {},
    create: {
      id: 'spanish-fluency-catalog-id',
      title: 'Learn Conversational Spanish to B1',
      description: 'Master practical everyday Spanish through daily spaced-repetition vocabulary, listening comprehension, and structured dialogue drills over 90 days.',
      category: 'Languages',
      icon: 'Globe',
      est_weekly_hours: 5,
      phases: {
        create: [
          {
            phase_order: 1,
            title: 'Phase 1: Core Phonetics, Top 500 Words & Present Tense (Weeks 1–4)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Spaced-Repetition Vocabulary Sprint',
                  sessions_per_week: 4,
                  session_duration_minutes: 25,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Present Tense Patterns & Sentence Construction',
                  sessions_per_week: 3,
                  session_duration_minutes: 35,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 2,
            title: 'Phase 2: Past/Future Tenses, Listening Drills & Real Dialogue (Weeks 5–8)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Native Audio Dialogue & Ear Training',
                  sessions_per_week: 3,
                  session_duration_minutes: 30,
                  preferred_time_of_day: 'afternoon',
                },
                {
                  title: 'Conversational Exchange & Verbal Journaling',
                  sessions_per_week: 3,
                  session_duration_minutes: 35,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 3,
            title: 'Phase 3: Subjunctive Mood, Native Media & 30-Min Fluency Talks (Weeks 9–12)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Native Podcast & Cultural Immersion',
                  sessions_per_week: 3,
                  session_duration_minutes: 30,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: '1-on-1 Conversation Practice & Debate',
                  sessions_per_week: 2,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`✅ Seeded goal: ${spanishGoal.title}`);

  // Upsert Goal 4: Write & Publish a 120-Page Non-Fiction Book
  const bookGoal = await prisma.goalCatalog.upsert({
    where: { id: 'publish-book-catalog-id' },
    update: {},
    create: {
      id: 'publish-book-catalog-id',
      title: 'Write & Publish a Non-Fiction Book',
      description: 'Transform your knowledge into a published Amazon Kindle book in 12 structured weeks with deep-work writing sprints and professional formatting.',
      category: 'Writing & Creative',
      icon: 'BookOpen',
      est_weekly_hours: 6,
      phases: {
        create: [
          {
            phase_order: 1,
            title: 'Phase 1: Thesis, Outline & Reader Architecture (Weeks 1–4)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Chapter Blueprinting & Thesis Mapping',
                  sessions_per_week: 3,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Case Study Research & Evidence Synthesis',
                  sessions_per_week: 2,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 2,
            title: 'Phase 2: Deep Work First-Draft Word Sprints (Weeks 5–8)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: '1,000-Word Fast-Draft Sprint',
                  sessions_per_week: 4,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Chapter Review & Flow Cohesion Pass',
                  sessions_per_week: 2,
                  session_duration_minutes: 30,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 3,
            title: 'Phase 3: Developmental Editing, Cover & KDP Launch (Weeks 9–12)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Line Editing & Reader Experience Polish',
                  sessions_per_week: 3,
                  session_duration_minutes: 50,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Typography, Interior Formatting & KDP Setup',
                  sessions_per_week: 2,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'afternoon',
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`✅ Seeded goal: ${bookGoal.title}`);

  // Upsert Goal 5: Master Distributed Systems & Senior Backend Architecture
  const sysDesignGoal = await prisma.goalCatalog.upsert({
    where: { id: 'system-design-catalog-id' },
    update: {},
    create: {
      id: 'system-design-catalog-id',
      title: 'Master Distributed Systems Architecture',
      description: 'Level up to Senior/Staff engineer with hands-on deep dives into replication, sharding, consensus, event-driven architectures, and high-throughput systems.',
      category: 'Career & Engineering',
      icon: 'Server',
      est_weekly_hours: 7,
      phases: {
        create: [
          {
            phase_order: 1,
            title: 'Phase 1: Storage Engines, Sharding & Caching (Weeks 1–4)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'LSM-Trees, B-Trees & Distributed Caching',
                  sessions_per_week: 3,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'evening',
                },
                {
                  title: 'Storage Teardowns (Redis, Postgres, Cassandra)',
                  sessions_per_week: 2,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          },
          {
            phase_order: 2,
            title: 'Phase 2: Consensus, Queues & High-Scale Microservices (Weeks 5–8)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Event-Driven Architectures & Kafka Labs',
                  sessions_per_week: 3,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'evening',
                },
                {
                  title: 'Raft Consensus & CAP Trade-Off Analysis',
                  sessions_per_week: 2,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'morning',
                },
              ],
            },
          },
          {
            phase_order: 3,
            title: 'Phase 3: Complex Case Studies & Whiteboard Mastery (Weeks 9–12)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'High-Scale Mock System Design Whiteboarding',
                  sessions_per_week: 3,
                  session_duration_minutes: 60,
                  preferred_time_of_day: 'evening',
                },
                {
                  title: 'SRE Chaos Engineering & Postmortem Analysis',
                  sessions_per_week: 2,
                  session_duration_minutes: 45,
                  preferred_time_of_day: 'afternoon',
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`✅ Seeded goal: ${sysDesignGoal.title}`);

  // Upsert Goal 6: Daily Mindfulness & Breathwork Routine
  const mindfulnessGoal = await prisma.goalCatalog.upsert({
    where: { id: 'mindfulness-catalog-id' },
    update: {},
    create: {
      id: 'mindfulness-catalog-id',
      title: 'Daily Mindfulness & Breathwork Habit',
      description: 'Lower resting cortisol, improve focus, and build an unbreakable daily mindfulness practice through physiological breathwork and open monitoring.',
      category: 'Wellness & Mindset',
      icon: 'Heart',
      est_weekly_hours: 3,
      phases: {
        create: [
          {
            phase_order: 1,
            title: 'Phase 1: Foundational Breathwork & Habit Triggers (Weeks 1–4)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Morning Box Breathing & Somatic Reset',
                  sessions_per_week: 5,
                  session_duration_minutes: 15,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Evening Parasympathetic Down-Regulation',
                  sessions_per_week: 3,
                  session_duration_minutes: 15,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
          {
            phase_order: 2,
            title: 'Phase 2: Open Monitoring & Deep Body Scans (Weeks 5–8)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Vipassana Sensory Awareness Session',
                  sessions_per_week: 5,
                  session_duration_minutes: 20,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Midday Focused Attentional Reset',
                  sessions_per_week: 3,
                  session_duration_minutes: 15,
                  preferred_time_of_day: 'afternoon',
                },
              ],
            },
          },
          {
            phase_order: 3,
            title: 'Phase 3: Autonomous Practice & Stress Inoculation (Weeks 9–12)',
            duration_weeks: 4,
            task_templates: {
              create: [
                {
                  title: 'Unguided Presence & Awareness Meditation',
                  sessions_per_week: 5,
                  session_duration_minutes: 20,
                  preferred_time_of_day: 'morning',
                },
                {
                  title: 'Evening Gratitude & HRV Optimization',
                  sessions_per_week: 3,
                  session_duration_minutes: 15,
                  preferred_time_of_day: 'evening',
                },
              ],
            },
          },
        ],
      },
    },
  });
  console.log(`✅ Seeded goal: ${mindfulnessGoal.title}`);

  console.log('🎉 Full 6-Goal Catalog Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
