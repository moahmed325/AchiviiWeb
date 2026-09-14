# QUESTION BLUEPRINT & ONBOARDING SPECIFICATION

## Strategic Specification for High-Leverage Goal Calibration & Task Execution

---

## 1. Core Philosophy & Architectural Boundary

The onboarding experience in Achivii is engineered for ambitious, busy individuals. It must feel lightweight, encouraging, and clear—taking less than 60 seconds to complete while providing maximum operational leverage to the adaptive planning engine.

### The Two Canonical Boundaries:
1. **Step 2 (Goal Questions) Owns the CRAFT:**
   * It only evaluates *where the user enters the domain capability graph* and *what their current comfort zone is*.
   * It **never** asks about sleep, wake times, work hours, time-of-day preference, or schedule predictability.
2. **Step 3 (Life Structure & Routines) Owns the TIME:**
   * Step 3 canonically models waking hours, sleep, fixed commitments (work, commute, meals, family), and schedule volatility (`HIGH` vs `MODERATE` vs `DYNAMIC`).
   * No question in Step 2 may duplicate or overlap with Step 3.

### The Zero-Interrogation Law:
* **Never ask "Why did you fail before?" or "How might you fail?":**
  Busy people fail for predictable, well-documented reasons specific to each domain (e.g., beginner runners ramping volume too fast and injuring tendons; developers spending weeks tweaking CSS instead of shipping core logic).
* **Bake Failure-Prevention Directly into the Blueprint:**
  The goal blueprint itself must incorporate protective constraints (volume increase caps $\le 8\%$, mandatory vertical slices, built-in recovery buffers). The user does not need to self-diagnose their flaws in an onboarding quiz.

---

## 2. The 3-to-4 Question Blueprint Formula

Every goal—whether chosen from the vetted catalog or created custom via AI—must adhere to this exact 3-to-4 question structure:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Q1: Objective Verifiable Baseline Gate                                    │
│ → Falsifiable benchmark in the last 30 days                               │
│ → Engine Variable: Sets the Starting Node in the Capability DAG           │
├───────────────────────────────────────────────────────────────────────────┤
│ Q2: Skill Asymmetry / Starting Comfort Zone                               │
│ → Where they have intuitive ease vs where they need hand-holding           │
│ → Engine Variable: Calibrates Phase 1 & 2 task guidance and scaffolding   │
├───────────────────────────────────────────────────────────────────────────┤
│ Q3: Sustainable Weekly Target Cadence                                     │
│ → How many hours/days per week can be reliably dedicated                   │
│ → Engine Variable: Sets Weekly Budget & Session Count (3 vs 4 vs 5 days)  │
├───────────────────────────────────────────────────────────────────────────┤
│ Q4 (Optional): Deliverable Specifics / Capstone Focus                     │
│ → Target event distance, tech stack focus, or publication format          │
│ → Engine Variable: Configures Gate 4 Capstone verification trial          │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 6 Premade Goal Question Sets (Canonical Seed Blueprint)

These vetted question sets are designed to replace the legacy questions in `backend/prisma/seed.ts`.

---

### Goal 1: Build & Launch a SaaS MVP
* **Domain:** `PROJECT` | **Default Cadence:** `6–8 hrs/wk` | **Nominal Dose:** `60 min` | **MVS Dose:** `20 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your current hands-on software development experience?"*
* **Options:**
  1. `beginner`: Complete beginner (have written basic scripts or tutorials, never deployed live software).
  2. `intermediate`: Comfortable with frontend or backend code, but have never shipped a fullstack app with live authentication and database.
  3. `advanced`: Professional engineer (ship code daily, but want a structured, disciplined sprint to launch an independent product).

#### Question 2 (Skill Asymmetry)
* **Question:** *"Where is your current technical comfort zone?"*
* **Options:**
  1. `frontend_heavy`: Stronger on UI/design/frontend; need clear scaffolding for database schemas, auth, and backend APIs.
  2. `backend_heavy`: Stronger on databases and server logic; need structured layouts and clean component guidelines for UI.
  3. `fullstack_balanced`: Comfortable across both; primary need is ruthless feature scoping and shipping discipline.

#### Question 3 (Weekly Cadence)
* **Question:** *"How much dedicated building time can you sustainably protect each week?"*
* **Options:**
  1. `5_hours`: ~5 hours / week (3 focused sessions of ~90 min or 4 of ~75 min)
  2. `8_hours`: ~8 hours / week (Recommended MVP cadence — 4 sessions of ~2 hours)
  3. `12_hours`: ~12 hours / week (Aggressive sprint pace)

#### Question 4 (Capstone Deliverable)
* **Question:** *"What is your target launch architecture for Day 90?"*
* **Options:**
  1. `web_saas`: Web application with Stripe subscriptions and self-serve onboarding.
  2. `api_tool`: Developer tool, API service, or automated micro-SaaS workflow.
  3. `internal_b2b`: Targeted B2B workflow tool solved for a specific client or business niche.

---

### Goal 2: Run a 10K / Half-Marathon
* **Domain:** `PHYSICAL` | **Default Cadence:** `4–6 hrs/wk` | **Nominal Dose:** `45 min` | **MVS Dose:** `15 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is the furthest you have run continuously in the last 30 days without walking?"*
* **Options:**
  1. `0_to_2k`: 0 to 2 km (Complete beginner or returning from a long break).
  2. `5k_solid`: Comfortable running 5 km non-stop at an easy, conversational pace.
  3. `10k_runner`: Regularly running 8–10 km weekly without difficulty.

#### Question 2 (Skill Asymmetry)
* **Question:** *"How do your legs and lungs typically feel when running?"*
* **Options:**
  1. `cardio_limited`: Lungs and heart rate spike quickly, but muscles and joints feel fine. *(Engine focus: Strict Zone 2 aerobic base building)*.
  2. `tendon_limited`: Breathing feels effortless, but knees, shins, or calves get tight and sore. *(Engine focus: Conservative volume ramp $\le 8\%$ + tendon priming)*.
  3. `balanced_engine`: Cardio and joint tolerance feel well-matched; ready for structured pacing intervals.

#### Question 3 (Weekly Cadence)
* **Question:** *"How many days per week can your body train and recover?"*
* **Options:**
  1. `3_days`: 3 days / week (~3.5 to 4.5 hours total — optimal for busy schedules).
  2. `4_days`: 4 days / week (~5 to 6 hours total — recommended half-marathon cadence).
  3. `5_days`: 5 days / week (~6.5+ hours — high-volume endurance development).

#### Question 4 (Event Milestone)
* **Question:** *"What is your target finish line for Day 90?"*
* **Options:**
  1. `solid_10k`: Finish a continuous 10 km with steady breathing and zero walking breaks.
  2. `finish_half`: Complete a full 21.1 km Half-Marathon with comfortable, sustained pacing.
  3. `pace_breakthrough`: Break a specific personal record (10K sub-50 or Half sub-1:50).

---

### Goal 3: Learn Conversational Spanish to B1
* **Domain:** `COGNITIVE` | **Default Cadence:** `4–5 hrs/wk` | **Nominal Dose:** `30 min` | **MVS Dose:** `10 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your current grasp of spoken Spanish?"*
* **Options:**
  1. `complete_beginner`: Complete beginner (know basic greetings like *hola, gracias, adios*).
  2. `a1_elementary`: Know basic vocabulary and present tense, but freeze when trying to speak real sentences.
  3. `a2_intermediate`: Can read simple text and understand slow audio, but struggle with past tenses and fast conversations.

#### Question 2 (Skill Asymmetry)
* **Question:** *"Where is your current learning comfort zone?"*
* **Options:**
  1. `visual_reading`: Can recognize written words easily, but have trouble catching rapid spoken audio.
  2. `audio_mimic`: Good at repeating pronunciation and sounds, but get lost in grammar rules and conjugation tables.
  3. `grammar_conscious`: Understand the rules intellectually, but hesitate and overthink before speaking.

#### Question 3 (Weekly Cadence)
* **Question:** *"What daily immersion pace fits your schedule best?"*
* **Options:**
  1. `20m_daily`: 20–25 mins daily (~3.5 hrs/week — high consistency spaced repetition).
  2. `35m_daily`: 35–40 mins daily (~4.5 hrs/week — balanced vocab + audio comprehension).
  3. `50m_daily`: 50+ mins daily (~6 hrs/week — accelerated conversational sprint).

---

### Goal 4: Write & Publish a Non-Fiction Book
* **Domain:** `PROJECT` | **Default Cadence:** `5–7 hrs/wk` | **Nominal Dose:** `60 min` | **MVS Dose:** `20 min`

#### Question 1 (Baseline Gate)
* **Question:** *"Where does your book manuscript stand right now?"*
* **Options:**
  1. `idea_only`: Raw ideas, voice notes, or bullet points in my phone (0 words drafted).
  2. `detailed_outline`: Clear chapter outline and core thesis ready, but haven't started full drafting.
  3. `draft_in_progress`: 10,000+ words of rough drafts already written.

#### Question 2 (Skill Asymmetry)
* **Question:** *"What part of writing comes most naturally to you?"*
* **Options:**
  1. `generative_flow`: Generating ideas, anecdotes, and stories is easy; structuring them into a coherent argument is hard.
  2. `logical_structure`: Bullet points and logical frameworks are easy; expanding them into engaging prose is hard.
  3. `editing_polish`: Line editing and sharpening sentences is easy; writing the messy first draft without self-censoring is hard.

#### Question 3 (Weekly Cadence)
* **Question:** *"What target weekly word output matches your bandwidth?"*
* **Options:**
  1. `light_sprint`: ~2,000 words / week (~4–5 hrs/wk — ideal for busy professionals).
  2. `standard_sprint`: ~3,500 words / week (~6–7 hrs/wk — complete draft in 8 weeks).
  3. `intensive_sprint`: ~5,000 words / week (~9 hrs/wk — dedicated writing marathon).

#### Question 4 (Distribution Format)
* **Question:** *"How do you plan to publish this book upon completion?"*
* **Options:**
  1. `amazon_kdp`: Amazon Kindle eBook & Paperback with professional interior formatting.
  2. `digital_direct`: Personal website / Gumroad digital download (PDF/EPUB) for an existing audience.
  3. `industry_authority`: High-value lead magnet or manifesto to establish professional brand authority.

---

### Goal 5: Master Distributed Systems Architecture
* **Domain:** `COGNITIVE` | **Default Cadence:** `6–8 hrs/wk` | **Nominal Dose:** `60 min` | **MVS Dose:** `25 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your current backend engineering experience level?"*
* **Options:**
  1. `fullstack_pivot`: Fullstack or frontend engineer pivoting to deep backend and distributed infrastructure.
  2. `mid_backend`: Mid-level backend engineer confident with single-node relational DBs, ready for distributed consensus, sharding, and scale.
  3. `senior_engineer`: Senior engineer preparing for Staff/Principal architecture reviews or Tier-1 system design interviews.

#### Question 2 (Skill Asymmetry)
* **Question:** *"Where do you feel least confident during architecture deep dives?"*
* **Options:**
  1. `storage_internals`: Database engines, LSM-trees vs B-Trees, WAL, write amplification, and sharding strategies.
  2. `consensus_replication`: Raft, Paxos, quorum arithmetic, linearizability, and split-brain recovery.
  3. `whiteboard_defense`: Translating architectural knowledge into crisp 45-minute timed design presentations with clean math.

#### Question 3 (Weekly Cadence)
* **Question:** *"How much deep-focus technical study can you execute weekly?"*
* **Options:**
  1. `5_hours`: 4–5 hours / week (Paced theoretical deep dive + paper breakdowns).
  2. `8_hours`: 7–8 hours / week (Balanced mix of paper reading + hands-on coding labs).
  3. `11_hours`: 10+ hours / week (Accelerated interview crunch / rapid mastery).

---

### Goal 6: Daily Mindfulness & Breathwork Habit
* **Domain:** `PHYSICAL` | **Default Cadence:** `2–3 hrs/wk` | **Nominal Dose:** `15 min` | **MVS Dose:** `5 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your past experience with daily meditation or breathwork?"*
* **Options:**
  1. `novice`: Complete novice (struggle to sit still or focus on breath for 2 uninterrupted minutes).
  2. `intermittent`: Have used apps like Headspace or Calm on and off, but never maintained an unbreakable daily streak.
  3. `experienced`: Comfortable with unguided sitting, looking to integrate physiological breath resets into high-stress days.

#### Question 2 (Skill Asymmetry)
* **Question:** *"What style of practice feels most intuitive and grounding for you?"*
* **Options:**
  1. `physiological_breathwork`: Active breathing mechanics (Box breathing, physiological sigh, 4-7-8) that produce rapid physiological calm.
  2. `open_monitoring`: Silent observation of thoughts and sensory awareness without judgment or reaction.
  3. `somatic_relaxation`: Progressive muscle relaxation and body scans to release physical tension from the chest and shoulders.

#### Question 3 (Daily Cadence)
* **Question:** *"What daily session duration can you guarantee every single day without fail?"*
* **Options:**
  1. `10m_daily`: 10 minutes daily (Light, reliable baseline anchor).
  2. `15m_daily`: 15 minutes daily (Recommended standard dose for neuroplastic adaptation).
  3. `20m_daily`: 20 minutes daily (Deep meditation & nervous system regulation).

---

## 4. Custom Goal Gemini Prompt Specification

For any custom goal submitted by a user, Gemini generates the 3-to-4 questions dynamically using this strict contract.

### System Instruction:
```
You are the Lead Ambition Architect for Achivii, an elite Life + Ambition Execution System.
Your job is to generate strictly 3 (or at most 4) high-leverage onboarding questions for a user's custom 90-day ambition.

STRICT CONSTRAINTS:
1. NEVER ask about sleep, wake times, work hours, or daily routine. (The Life Structure engine handles this separately).
2. NEVER ask "How will you fail?" or "Why did you fail before?". Bake failure-prevention into the capability milestones directly.
3. Every question MUST be multiple-choice (3 to 4 options).
4. Every question MUST directly map to:
   - Q1: Objective Verifiable Baseline Gate (What can they objectively do right now?)
   - Q2: Skill Asymmetry / Comfort Zone (Where are they strong vs where do they need guidance?)
   - Q3: Weekly Sustainable Target Cadence (How much weekly time/frequency can they commit?)
   - Q4 (Optional): Specific deliverable, format, or target event.
```

### JSON Output Schema:
```json
{
  "questions": [
    {
      "id": "baseline_gate",
      "question": "Clear, objective question testing real-world capability in the last 30 days",
      "purpose": "BASELINE_CALIBRATION",
      "options": [
        { "value": "beginner", "label": "Clear plain English description of starting tier", "baseline_level": "BEGINNER", "score": 1 },
        { "value": "intermediate", "label": "Clear plain English description of middle tier", "baseline_level": "INTERMEDIATE", "score": 2 },
        { "value": "advanced", "label": "Clear plain English description of advanced tier", "baseline_level": "ADVANCED", "score": 3 }
      ]
    },
    {
      "id": "skill_asymmetry",
      "question": "Question assessing existing comfort zone vs areas needing structured guidance",
      "purpose": "GUIDANCE_SCAFFOLDING",
      "options": [
        { "value": "strength_a", "label": "Comfortable with X, need structured guidance on Y" },
        { "value": "strength_b", "label": "Comfortable with Y, need structured guidance on X" },
        { "value": "foundation_both", "label": "Need step-by-step foundation across both" }
      ]
    },
    {
      "id": "weekly_cadence",
      "question": "Question establishing sustainable weekly hours and session frequency",
      "purpose": "CAPACITY_BUDGET",
      "options": [
        { "value": "light", "label": "Light pace: ~3.5–4.5 hrs/week", "recommended_weekly_hours": 4 },
        { "value": "balanced", "label": "Balanced pace: ~5–7 hrs/week", "recommended_weekly_hours": 6 },
        { "value": "accelerated", "label": "Accelerated pace: ~8–10 hrs/week", "recommended_weekly_hours": 8 }
      ]
    }
  ]
}
```

---

## 5. The Task Output Contract (`why_this_matters` & MVS)

Every intervention item generated by the Master Planning Prompt and stored in `TrajectoryItem` / `DailyScheduleItem` MUST conform to this execution contract:

```typescript
export interface ExecutionItemContract {
  id: string;
  title: string;                          // Action-oriented name (e.g. "Zone 2 Aerobic Base Run")
  standard_duration_minutes: number;      // Full dose (e.g. 45 min)
  mvs_duration_minutes: number;           // Emergency dose (e.g. 15 min)
  why_this_matters: string;               // 1-2 plain English sentences explaining the biological/technical ROI
  mvs_fallback_description: string;       // Concrete low-friction task if slammed with zero time/energy
  capability_id: string;                  // Node in DAG this session develops
  priority_tier: 1 | 2 | 3;               // 1 = Critical adaptation, 2 = High leverage, 3 = Supportive
}
```

### Display Standard in the Daily UI:
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🏃 45-Min Zone 2 Aerobic Run                                           │
│ Scheduled: 07:00 – 07:45 AM • Half Marathon (Week 3)                   │
├────────────────────────────────────────────────────────────────────────┤
│ 💡 WHY THIS MATTERS:                                                   │
│ Running at a comfortable nose-breathing pace expands capillary density │
│ in leg muscles so your heart rate stays low during longer runs later. │
├────────────────────────────────────────────────────────────────────────┤
│ [Complete 45m]   │   [⚡ Switch to 15m MVS]   │   [Postpone Window]    │
└────────────────────────────────────────────────────────────────────────┘
```

### The MVS Rules of Engagement:
1. **Zero Backlog Debt:** Clicking "Switch to 15m MVS" completes the day at 100%. Tomorrow's schedule never doubles.
2. **Habit Integrity:** Neural and behavioral momentum remains intact.
3. **Adaptive Gate Review:** If a user runs MVS continuously for 3+ weeks, the engine does not fail them; at the 4-week gate checkpoint, it smooths Phase 2 pacing to ensure foundational capabilities are verified before scaling volume.
