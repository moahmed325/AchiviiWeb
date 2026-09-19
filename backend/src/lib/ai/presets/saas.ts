import { CertifiedPresetBlueprint } from './types.js';

export const saasPreset: CertifiedPresetBlueprint = {
  id: 'saas_first_customer',
  matchingPatterns: [
    /saas/i,
    /ship.*(saas|product|app|web)/i,
    /build.*ship.*(saas|product|app)/i,
    /full[-\s]?stack.*(app|project|saas|web)/i,
    /launch.*(saas|app|product)/i,
    /micro[-\s]?saas/i,
    /first.*paying.*(user|customer)/i,
    /paying.*customer/i,
    /monetiz.*(app|saas|software)/i
  ],
  title: 'Build and Ship a SaaS to First Paying User',
  primaryDomain: 'Software Engineering & Product Delivery',
  clarifiedOutcome:
    'Build, deploy, and launch a full-stack SaaS web application to production and acquire your first paying customer',
  badge: 'Certified Product Velocity · Vertical Slice Architecture & Lean MVP',
  capabilities: [
    'Production CI/CD Deployment & Monolithic Project Setup',
    'Relational Schema Modeling & Database Migrations (SQL/Prisma)',
    'End-to-End Vertical Slice Execution (DB -> API -> UI)',
    'Stripe Billing Lifecycle, Webhooks & Entitlement Guardrails',
    'Conversion Landing Page & Cold Distribution Channels'
  ],
  scientificFrameworks: [
    {
      name: 'Vertical Slice Architecture (Jimmy Bogard)',
      description:
        'Delivering features end-to-end across all layers simultaneously rather than horizontal technical tiers in isolation.',
      application:
        'Ensures every sprint produces a functional, testable slice of user value that works in production.'
    },
    {
      name: 'The Lean Startup MVP & Riskiest Assumption Testing (Eric Ries)',
      description:
        'Validating customer willingness to pay through minimal functional iterations before engineering complex features.',
      application:
        'Eliminates feature bloat by strictly focusing on the single core pain-relieving action.'
    },
    {
      name: 'Trunk-Based Continuous Deployment (Paul Hammant / Martin Fowler)',
      description:
        'Shipping small, incremental commits to live production from Day 1 to eliminate deployment anxiety.',
      application:
        'Deploys to a live URL in Week 1, ensuring zero surprise configuration issues at launch.'
    }
  ],
  verificationCriteria:
    'Acquire at least 1 real paying customer who completes a live credit card transaction ($>0) through automated Stripe billing on your public production URL.',
  diagnosticQuestions: [
    {
      id: 'baseline',
      question: 'What is your current technical engineering baseline?',
      subtitle: 'Calibrates recommended tech stack complexity, boilerplate scaffolding, and backend vs. frontend focus.',
      options: [
        'First-time builder (Learning web development; need simple, opinionated tools like Next.js & Supabase)',
        'Frontend / UI specialist (Strong in React/CSS; need guidance on database modeling and API security)',
        'Backend / Systems engineer (Strong in SQL/APIs; need clean UI components and conversion copywriting)',
        'Full-stack developer (Experienced across stack; need ruthless scope pruning and distribution sprints)'
      ],
      allowCustom: true
    },
    {
      id: 'stage',
      question: 'What is the current stage of your product idea?',
      subtitle: 'Tailors Week 1 problem validation, value proposition scope, and target customer framing.',
      options: [
        'Validated problem hypothesis (Talked to potential users; clear specific pain point identified)',
        'Unvalidated tool concept (Have an idea for a tool, need to test willingness to pay in Week 1)',
        'Existing prototype or MVP (Built initial code; need monetization, polish, and real users)',
        'Exploring problem spaces (Looking for a high-value B2B or niche problem to solve)'
      ],
      allowCustom: true
    },
    {
      id: 'bottleneck',
      question: 'What has been your biggest historical roadblock when building software projects?',
      subtitle: 'Injects targeted velocity guardrails and scope-pruning constraints into every sprint.',
      options: [
        'Scope creep & endless refactoring (spending weeks on auth, settings, or dark mode before launching)',
        'Architecture paralysis (stuck debating frameworks, ORMs, and hosting instead of building)',
        'Distribution & marketing fear (hesitating to share publicly or ask people to pay)',
        'Project abandonment (losing momentum after Week 3 when initial excitement fades)'
      ],
      allowCustom: true
    }
  ],
  saasVelocityTable: [
    {
      baselineKey: 'first_time',
      label: 'First-Time Builder (Managed Monolith Track)',
      recommendedStack: 'Next.js App Router + Supabase (Auth/Postgres) + Vercel + Stripe Checkout',
      coreLoopScope: 'Single CRUD Value Action (e.g. input data -> generate structured report/export)',
      targetLaunchWeek: 10,
      guidance: 'Use managed Auth and pre-built Stripe Checkout portals to avoid writing custom billing UI.'
    },
    {
      baselineKey: 'frontend_spec',
      label: 'Frontend Specialist (UI-First Track)',
      recommendedStack: 'Next.js / React + Tailwind/shadcn + Supabase/Prisma + Stripe',
      coreLoopScope: 'Polished form submission -> database persistence -> interactive dashboard view',
      targetLaunchWeek: 8,
      guidance: 'Focus on clean relational database normalization and avoid over-engineering backend abstractions.'
    },
    {
      baselineKey: 'backend_spec',
      label: 'Backend Specialist (API-First Track)',
      recommendedStack: 'Node / Express / Fastify + PostgreSQL / Prisma + Tailwind/shadcn + Stripe',
      coreLoopScope: 'Data processing / webhook pipeline with clean output dashboard',
      targetLaunchWeek: 8,
      guidance: 'Use pre-built component libraries (shadcn/ui) and do not waste time writing custom CSS from scratch.'
    },
    {
      baselineKey: 'full_stack',
      label: 'Full-Stack Developer (Rapid Deployment Track)',
      recommendedStack: 'Next.js App Router / Remix + Prisma / Drizzle + PostgreSQL + Stripe Webhooks',
      coreLoopScope: 'Complete end-to-end SaaS workflow with transactional notifications',
      targetLaunchWeek: 7,
      guidance: 'Ruthlessly cut secondary features (team accounts, multiple tiers) to ship the v1 core loop by Week 4.'
    }
  ],
  phases: [
    {
      phaseNumber: 1,
      phaseName: 'Foundation',
      weeks: [1, 2, 3, 4],
      focus: 'Problem Framing, Database Schema, Production CI/CD & The Vertical Slice Gate',
      targetIntensity: 65,
      milestoneWeek: 4,
      milestoneTitle: 'Phase 1 Foundation Milestone Gate: The Live Production Vertical Slice Gate',
      milestoneCriteria:
        'An external user can sign up, log in on your live production URL, complete the single core value action, and see persistent results saved in the database.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Acceleration',
      weeks: [5, 6, 7, 8],
      focus: 'Dashboard Workflows, Transactional Emails, Stripe Billing & The Monetization Gate',
      targetIntensity: 80,
      milestoneWeek: 8,
      milestoneTitle: 'Phase 2 Acceleration Milestone Gate: The Monetization Gate',
      milestoneCriteria:
        'Live Stripe subscription/checkout workflow active in production; successfully processes a real test transaction, triggers webhooks, and unlocks paid tier access.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Mastery',
      weeks: [9, 10, 11, 12],
      focus: 'High-Converting Landing Page, Beta Distribution Sprints, Public Launch & First Dollar',
      targetIntensity: 95,
      milestoneWeek: 12,
      milestoneTitle: 'Phase 3 Mastery Capstone: The First Paying Customer & Public Launch Gate',
      milestoneCriteria:
        'Acquire at least 1 real paying customer through live public distribution (Product Hunt, Reddit, cold outreach) with verified revenue generated.'
    }
  ],
  weeks: [
    {
      weekNumber: 1,
      phase: 'Foundation',
      theme: 'Week 1: Problem Definition, Database Schema & Production Hello World',
      objective: 'Define the single core value proposition, initialize monorepo with CI/CD to production, and draft relational database schema.',
      keyMilestone: 'Production Hello World deployed on live URL with SSL and initial database migration applied.',
      targetIntensity: 60,
      workoutArchetypes: [
        {
          workoutType: 'architecture',
          title: 'Single Core Value Proposition & Production Monolith Init',
          focus: 'Ruthless problem framing, monorepo setup, and Day 1 production deployment.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Write 1-Paragraph Problem & Value Hypothesis',
              durationRatio: 0.20,
              instructions: 'Write down the exact target user persona, the painful manual problem they face, and the single output your tool produces in 1 click.',
              focusCue: 'If the value statement takes more than 2 sentences to explain, simplify it.',
              pitfallToAvoid: 'Describing features rather than the specific outcome or time saved for the customer.',
              layer: 'adherence',
              layerReasoning: 'Y Combinator problem validation rule: clarity of outcome anchors all technical scoping decisions.'
            },
            {
              stepNumber: 2,
              title: 'Initialize TypeScript Monolith Repository',
              durationRatio: 0.50,
              instructions: 'Create git repository with Next.js or Node/React template. Configure strict TypeScript, ESLint, and Tailwind CSS. Commit initial commit to GitHub.',
              focusCue: 'Stick to boring, established templates; zero custom webpack or build configs.',
              pitfallToAvoid: 'Spending hours comparing experimental frameworks; use the stack you know best.',
              layer: 'safety',
              layerReasoning: 'Boring technology principle (Dan McKinley): familiar tooling minimizes unforced infrastructure errors.'
            },
            {
              stepNumber: 3,
              title: 'Day 1 Production Deployment (Vercel / Railway)',
              durationRatio: 0.30,
              instructions: 'Connect GitHub repository to Vercel or Railway. Deploy the initial commit to a public live URL with automatic branch deployments.',
              focusCue: 'Confirm the public URL loads on your phone with valid HTTPS.',
              pitfallToAvoid: 'Keeping code only on localhost for weeks; early deployment eliminates deployment dread.',
              layer: 'mechanism',
              layerReasoning: 'Trunk-based continuous deployment ensures the release pipeline is verified from Day 1.'
            }
          ]
        },
        {
          workoutType: 'data_modeling',
          title: 'Relational Database Schema & Initial Migration',
          focus: 'Designing normalized relational models and connecting staging database.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Entity Relationship Diagram (ERD) Blueprint',
              durationRatio: 0.25,
              instructions: 'Draw the 3 essential models: User (auth/billing), Project/Workspace (ownership), and CoreItem (the primary value record).',
              focusCue: 'Keep foreign keys simple and indexed. Do not add speculative tables for future features.',
              pitfallToAvoid: 'Creating 12 normalized tables on Day 2; build only what the single core action requires.',
              layer: 'safety',
              layerReasoning: 'Premature database over-normalization creates compounding migration friction during early iterations.'
            },
            {
              stepNumber: 2,
              title: 'Prisma / Drizzle Schema Definition & Local Migration',
              durationRatio: 0.55,
              instructions: 'Write the schema.prisma or SQL migration file. Run migration command to create tables on local/staging PostgreSQL database.',
              focusCue: 'Verify all timestamps (createdAt, updatedAt) and unique constraints.',
              pitfallToAvoid: 'Writing raw database queries without schema validation or migration history.',
              layer: 'mechanism',
              layerReasoning: 'Type-safe ORMs and migrations guarantee referential integrity and synchronized TypeScript types.'
            },
            {
              stepNumber: 3,
              title: 'Database Seed Script & Healthcheck Query',
              durationRatio: 0.20,
              instructions: 'Write a seed script with 1 test user and 2 sample core items. Verify data loads via Prisma Studio or SQL console.',
              focusCue: 'Confirm foreign key relationships populate cleanly.',
              pitfallToAvoid: 'Skipping seeds, which leaves local dev empty and slows UI testing.',
              layer: 'adherence',
              layerReasoning: 'Immediate sample data in development environment reduces cognitive friction during UI prototyping.'
            }
          ]
        },
        {
          workoutType: 'rest_strategy',
          title: 'Active Product Strategy & Target User Friction Audit',
          focus: 'Rest from writing code; review competitor pricing models and customer friction points.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Competitor Pricing & Onboarding Audit',
              durationRatio: 0.50,
              instructions: 'Visit 3 competitor landing pages. Note their headline copy, pricing tiers (e.g. $19/mo or $49/mo), and how fast they get users to the "aha moment".',
              focusCue: 'Notice where their onboarding is confusing or bloated with too many form fields.',
              pitfallToAvoid: 'Trying to compete on being cheaper; compete on being simpler and faster.',
              layer: 'mechanism',
              layerReasoning: 'Benchmarking customer onboarding expectations prevents pricing hesitation and friction at launch.'
            },
            {
              stepNumber: 2,
              title: 'Draft User Onboarding Happy Path',
              durationRatio: 0.50,
              instructions: 'Write down the exact 3 steps a user takes from landing page to their first successful export or output.',
              focusCue: 'Cut every non-essential step; aim for under 60 seconds from signup to value.',
              pitfallToAvoid: 'Requiring email verification or payment before demonstrating any value.',
              layer: 'adherence',
              layerReasoning: 'Time-to-value is the primary predictor of early SaaS trial-to-paid conversion.'
            }
          ]
        },
        {
          workoutType: 'auth_security',
          title: 'Authentication Plumbing & Protected Dashboard Shell',
          focus: 'Integrating managed authentication and securing dashboard routes.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Configure Auth Provider (Clerk / Supabase / NextAuth)',
              durationRatio: 0.40,
              instructions: 'Install auth SDK and set environment variables. Implement sign-up, sign-in, and sign-out UI components with email/password and Google OAuth.',
              focusCue: 'Verify JWT tokens or session cookies persist across page reloads.',
              pitfallToAvoid: 'Writing custom password hashing and session management from scratch.',
              layer: 'safety',
              layerReasoning: 'Managed auth providers protect against CSRF, session hijacking, and credential stuffing vulnerabilities.'
            },
            {
              stepNumber: 2,
              title: 'Protected Route Middleware & User Profile Sync',
              durationRatio: 0.40,
              instructions: 'Implement route middleware that redirects unauthenticated visitors to /sign-in. Sync auth user ID to database User record on first login.',
              focusCue: 'Confirm /dashboard cannot be accessed without an active session.',
              pitfallToAvoid: 'Relying solely on client-side route protection without server-side middleware verification.',
              layer: 'mechanism',
              layerReasoning: 'Server-side authorization guards API endpoints against unauthorized data access.'
            },
            {
              stepNumber: 3,
              title: 'Dashboard Shell Layout & User Navigation Bar',
              durationRatio: 0.20,
              instructions: 'Build basic dashboard navigation layout with user email badge, sign-out button, and empty state container for the core action.',
              focusCue: 'Keep styling minimal and functional; do not get stuck polishing color palettes.',
              pitfallToAvoid: 'Spending hours designing custom navigation icons before core functionality exists.',
              layer: 'adherence',
              layerReasoning: 'A clean working shell provides visual confirmation of progress and establishes layout context.'
            }
          ]
        },
        {
          workoutType: 'vertical_slice',
          title: 'Core Action Backend API Route & Zod Validation',
          focus: 'Building the authenticated backend endpoint for the single primary value feature.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Define Request & Response Zod Schemas',
              durationRatio: 0.25,
              instructions: 'Write strict Zod validation schema for the core action payload (e.g. title, inputData, parameters). Validate all field lengths and types.',
              focusCue: 'Return descriptive error messages when input validation fails.',
              pitfallToAvoid: 'Accepting raw JSON without schema validation.',
              layer: 'safety',
              layerReasoning: 'Schema validation at API boundaries prevents SQL injection, data corruption, and runtime crashes.'
            },
            {
              stepNumber: 2,
              title: 'Implement Authenticated POST Handler & Database Write',
              durationRatio: 0.55,
              instructions: 'Write the API route handler. Extract authenticated user session, validate body with Zod, execute business logic/transformation, and persist record to database.',
              focusCue: 'Wrap in try/catch block with structured error logging.',
              pitfallToAvoid: 'Hardcoding mock data; connect directly to the real database table.',
              layer: 'mechanism',
              layerReasoning: 'Vertical slice engineering mandates real data persistence rather than placeholder stubs.'
            },
            {
              stepNumber: 3,
              title: 'API Integration Smoke Test with Postman or Curl',
              durationRatio: 0.20,
              instructions: 'Send authenticated POST request using curl, Postman, or Thunder Client. Verify 200/201 response and check record in database.',
              focusCue: 'Inspect response headers and confirmed payload shape.',
              pitfallToAvoid: 'Proceeding to frontend wiring before verifying the API endpoint independently.',
              layer: 'adherence',
              layerReasoning: 'Isolated backend verification eliminates debugging ambiguity when connecting frontend state.'
            }
          ]
        },
        {
          workoutType: 'integration',
          title: 'Frontend Form Component & Production Smoke Test',
          focus: 'Connecting UI form to API mutation and verifying end-to-end loop in production.',
          isRestDay: false,
          baseDurationMinutes: 45,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Build Core Action Input Form with Loading State',
              durationRatio: 0.40,
              instructions: 'Build form component inside dashboard with input fields, submit button, loading spinner, and error banner.',
              focusCue: 'Disable the submit button while the request is in flight to prevent double submissions.',
              pitfallToAvoid: 'Leaving user with no visual feedback while async processing occurs.',
              layer: 'safety',
              layerReasoning: 'Idempotency and button debouncing prevent accidental duplicate database entries.'
            },
            {
              stepNumber: 2,
              title: 'Connect API Mutation & Optimistic UI Update',
              durationRatio: 0.40,
              instructions: 'Wire form submit handler to the API endpoint using fetch, TanStack Query, or Server Actions. Display the newly created item on the page immediately.',
              focusCue: 'Confirm the item appears on screen and persists after page refresh.',
              pitfallToAvoid: 'Requiring a full page reload to view newly created data.',
              layer: 'mechanism',
              layerReasoning: 'Instant visual feedback closes the feedback loop and verifies full-stack communication.'
            },
            {
              stepNumber: 3,
              title: 'Push to Main & Production Smoke Test',
              durationRatio: 0.20,
              instructions: 'Commit changes, push to GitHub, and let CI/CD deploy to production. Log in on your live production URL and execute the core action.',
              focusCue: 'Celebrate completing your first live end-to-end vertical slice in production!',
              pitfallToAvoid: 'Testing only on localhost and assuming production will work identically.',
              layer: 'adherence',
              layerReasoning: 'Shipping live working code in Week 1 eliminates launch anxiety and locks in momentum.'
            }
          ]
        },
        {
          workoutType: 'milestone_audit',
          title: 'Week 1 Code Review & Week 2 Sprint Planning',
          focus: 'Weekly sprint reflection, error boundary audit, and locking in Week 2 calendar slots.',
          isRestDay: true,
          baseDurationMinutes: 15,
          drillStepsTemplate: [
            {
              stepNumber: 1,
              title: 'Audit Production Vertical Slice & Error Logs',
              durationRatio: 0.50,
              instructions: 'Check Vercel/Railway runtime logs for any unhandled rejections or slow database queries. Confirm database backups are enabled.',
              focusCue: 'Verify zero console errors in browser developer tools on production.',
              pitfallToAvoid: 'Ignoring runtime warnings early before they compound.',
              layer: 'mechanism',
              layerReasoning: 'Early log monitoring establishes operational discipline and prevents silent production failures.'
            },
            {
              stepNumber: 2,
              title: 'Schedule Week 2 Focus Blocks on Calendar',
              durationRatio: 0.50,
              instructions: 'Confirm your daily 45-minute sprint windows for Week 2 (Authentication edge cases & relational data models).',
              focusCue: 'Block out protected morning or evening slots before work meetings encroach.',
              pitfallToAvoid: 'Leaving coding time to "whenever I have free time", which guarantees skipped days.',
              layer: 'adherence',
              layerReasoning: 'Implementation intentions and scheduled focus blocks are the #1 predictor of side-project completion.'
            }
          ]
        }
      ]
    },
    {
      weekNumber: 2,
      phase: 'Foundation',
      theme: 'Week 2: User Authentication & Relational Data Models',
      objective: 'Harden session handling, associate all records with authenticated user IDs, and build project workspace models.',
      keyMilestone: 'Multi-entity relational data model working with strict user row-level security.',
      targetIntensity: 62,
      workoutArchetypes: []
    },
    {
      weekNumber: 3,
      phase: 'Foundation',
      theme: 'Week 3: The Single Core Value Loop (End-to-End Slice: DB -> API -> UI)',
      objective: 'Refine the core user action so it reliably transforms input into value in under 3 seconds with polished UI feedback.',
      keyMilestone: 'The single core value loop complete from form input to output display with 0 console errors.',
      targetIntensity: 65,
      workoutArchetypes: []
    },
    {
      weekNumber: 4,
      phase: 'Foundation',
      theme: 'Week 4: Phase 1 Gate — The Live Production Vertical Slice Gate',
      objective: 'Invite 3 external test users to sign up, run the core feature in production, and provide qualitative feedback.',
      keyMilestone: 'Phase 1 Foundation Milestone Gate: The Live Production Vertical Slice Gate',
      targetIntensity: 70,
      workoutArchetypes: []
    },
    {
      weekNumber: 5,
      phase: 'Acceleration',
      theme: 'Week 5: User Workspace / Dashboard & Persistent Data Views',
      objective: 'Build searchable, filterable list views of user items with delete, edit, and export capabilities.',
      keyMilestone: 'Full CRUD workspace operational with optimistic UI updates and empty states.',
      targetIntensity: 75,
      workoutArchetypes: []
    },
    {
      weekNumber: 6,
      phase: 'Acceleration',
      theme: 'Week 6: Edge Case Hardening, Error Boundaries & Transactional Notifications (Resend)',
      objective: 'Add global error boundaries, toast notifications, rate limiting, and transactional welcome emails.',
      keyMilestone: 'Automated transactional email triggers on signup and critical user actions with <1s delivery.',
      targetIntensity: 78,
      workoutArchetypes: []
    },
    {
      weekNumber: 7,
      phase: 'Acceleration',
      theme: 'Week 7: Stripe Billing Architecture, Webhooks & Subscription Plans',
      objective: 'Implement Stripe Checkout, customer billing portal, webhook event handlers, and subscription plan tiers.',
      keyMilestone: 'Stripe webhook handler processes checkout.session.completed and updates user plan in database.',
      targetIntensity: 82,
      workoutArchetypes: []
    },
    {
      weekNumber: 8,
      phase: 'Acceleration',
      theme: 'Week 8: Phase 2 Gate — The Monetization Gate',
      objective: 'Execute live $1 transaction in production; verify paid tier entitlements lock/unlock automatically.',
      keyMilestone: 'Phase 2 Acceleration Milestone Gate: The Monetization Gate',
      targetIntensity: 85,
      workoutArchetypes: []
    },
    {
      weekNumber: 9,
      phase: 'Mastery',
      theme: 'Week 9: High-Converting Landing Page & Value Proposition Copywriting',
      objective: 'Build responsive marketing landing page with hero demo, feature benefits, pricing table, and FAQ.',
      keyMilestone: 'Landing page live with Lighthouse performance score >=90 and clear primary CTA.',
      targetIntensity: 90,
      workoutArchetypes: []
    },
    {
      weekNumber: 10,
      phase: 'Mastery',
      theme: 'Week 10: Beta User Onboarding Funnel & Direct Outreach Sprints',
      objective: 'Execute 20 personalized cold outreach DMs/emails per day to target niche users; onboard 5 beta testers.',
      keyMilestone: '5 external users onboarded to the platform with documented usability feedback.',
      targetIntensity: 92,
      workoutArchetypes: []
    },
    {
      weekNumber: 11,
      phase: 'Mastery',
      theme: 'Week 11: Public Launch Execution (Product Hunt, Indie Hackers, Niche Communities)',
      objective: 'Launch publicly across Product Hunt, Reddit, Hacker News, and Twitter/X with launch day checklist.',
      keyMilestone: 'Public launch live with >=100 unique site visitors in 24 hours.',
      targetIntensity: 95,
      workoutArchetypes: []
    },
    {
      weekNumber: 12,
      phase: 'Mastery',
      theme: 'Week 12: Phase 3 Capstone — The First Paying Customer & Public Launch Gate',
      objective: 'Convert beta pipeline into paid subscribers, resolve launch customer feedback, and celebrate first dollar.',
      keyMilestone: 'Phase 3 Mastery Capstone: The First Paying Customer & Public Launch Gate',
      targetIntensity: 100,
      workoutArchetypes: []
    }
  ],
  expertPromptContext: `You are an elite Y Combinator startup mentor, principal full-stack systems engineer, and execution coach applying Vertical Slice Architecture and Lean Startup principles.
When generating or calibrating this SaaS Builder blueprint:
1. Velocity & Stack Precision: Use the SaaS velocity table to calibrate recommended boilerplate scope and technical recommendations based on the user's technical baseline. Never recommend microservices, Docker Kubernetes clusters, or multi-tenant complexity for early MVPs. Mandate boring, monolithic stacks (Next.js, Supabase/PostgreSQL, Tailwind, Vercel/Railway).
2. The Vertical Slice Rule: Ensure every sprint produces a functional, testable slice of user value (DB schema + API route + UI component) rather than horizontal layers in isolation.
3. The "No Settings Page" Mandate: Forbid building secondary features (dark mode toggles, team permissions, avatar uploaders) until the single core pain-relieving action is deployed and working for external users.
4. Monetization Urgency: Strictly enforce the Week 8 Monetization Gate. Every task in Weeks 7-8 must prioritize connecting Stripe Checkout and handling webhooks so the user can charge money.
5. Distribution Discipline: In Weeks 9-11, program daily 20-minute distribution sprints (Product Hunt preparation, cold direct outreach, niche community sharing) directly into the tasks. A SaaS that isn't distributed is dead on arrival.`,
  evidenceTriad: {
    science: {
      title: 'Software Engineering & Reliability Science',
      subtitle: 'Vertical Slice Architecture & Continuous Deployment',
      tag: 'THEORY & ARCHITECTURE',
      coreRule: 'Vertical Slice Feature Delivery + Automated CI/CD from Day 1.',
      realWorldApplication:
        'Building full-stack slices (DB -> API -> UI) prevents the integration collapse that kills 70% of multi-layer architectures. Continuous deployment to live URLs in Week 1 eliminates release friction.'
    },
    socialAdherence: {
      title: 'Solo Founder Adherence Engine',
      subtitle: 'Designed for 9-to-5 Builders & Real Fatigue',
      tag: 'REAL-LIFE PSYCHOLOGY',
      coreRule: 'Boring Stack Mandate + 45-Minute Time-Boxed Sprints + Zero-Guilt Buffers.',
      realWorldApplication:
        'Prevents framework rabbit holes and weekend burnout. 45-minute daily sprints fit around work and family, while missed sessions shift seamlessly into weekend buffers without streak shame.'
    },
    proCoaching: {
      title: 'Venture & Indie Hacker Ground Truth',
      subtitle: 'YC Launch Mechanics & The First Dollar Metric',
      tag: 'PRACTITIONER CRAFT',
      coreRule: '"Launch before you feel ready" + The Week 8 Monetization Gate + Cold Outreach.',
      realWorldApplication:
        'Master founders know building is an excuse to avoid selling. We mandate connecting Stripe by Week 8 and program daily direct outreach into Phase 3 so you talk to real customers.'
    }
  }
};
