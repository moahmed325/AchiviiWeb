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

These vetted question sets are designed for rapid, stress-free scanning (2–6 words per answer choice) in `backend/prisma/seed.ts`.

---

### Goal 1: Build & Launch a SaaS MVP
* **Domain:** `PROJECT` | **Default Cadence:** `6–8 hrs/wk` | **Nominal Dose:** `60 min` | **MVS Dose:** `20 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your current hands-on software development experience?"*
* **Options:**
  1. `beginner`: Beginner (first-time builder)
  2. `intermediate`: Intermediate (know code, never shipped fullstack)
  3. `advanced`: Experienced (professional engineer)

#### Question 2 (Skill Asymmetry)
* **Question:** *"Where is your current technical comfort zone?"*
* **Options:**
  1. `frontend_heavy`: Frontend & UI design
  2. `backend_heavy`: Backend & databases
  3. `fullstack_balanced`: Balanced fullstack

#### Question 3 (Weekly Cadence)
* **Question:** *"How much dedicated building time can you sustainably protect each week?"*
* **Options:**
  1. `5_hours`: 5 hours / week (Light pace)
  2. `8_hours`: 8 hours / week (Recommended MVP pace)
  3. `12_hours`: 12 hours / week (Accelerated sprint)

#### Question 4 (Capstone Deliverable)
* **Question:** *"What is your target launch architecture for Day 90?"*
* **Options:**
  1. `web_saas`: Web SaaS (with Stripe subscriptions)
  2. `api_tool`: Developer Tool or API Service
  3. `internal_b2b`: B2B Niche Workflow App

---

### Goal 2: Run a 10K / Half-Marathon
* **Domain:** `PHYSICAL` | **Default Cadence:** `4–6 hrs/wk` | **Nominal Dose:** `45 min` | **MVS Dose:** `15 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is the furthest you have run continuously in the last 30 days without walking?"*
* **Options:**
  1. `0_to_2k`: 0–2 km (Starting out / returning)
  2. `5k_solid`: 5 km (Comfortable without walking)
  3. `10k_runner`: 10+ km (Regular weekly runner)

#### Question 2 (Skill Asymmetry)
* **Question:** *"How do your legs and lungs typically feel when running?"*
* **Options:**
  1. `cardio_limited`: Lungs & cardio get tired first
  2. `tendon_limited`: Legs & joints get sore first
  3. `balanced_engine`: Balanced (ready for intervals)

#### Question 3 (Weekly Cadence)
* **Question:** *"How many days per week can your body train and recover?"*
* **Options:**
  1. `3_days`: 3 days / week (~4 hours)
  2. `4_days`: 4 days / week (~5.5 hours)
  3. `5_days`: 5 days / week (~7 hours)

#### Question 4 (Event Milestone)
* **Question:** *"What is your target finish line for Day 90?"*
* **Options:**
  1. `solid_10k`: Continuous 10 km
  2. `finish_half`: Full Half-Marathon (21.1 km)
  3. `pace_breakthrough`: Personal Pace Record

---

### Goal 3: Learn Conversational Spanish to B1
* **Domain:** `COGNITIVE` | **Default Cadence:** `4–5 hrs/wk` | **Nominal Dose:** `30 min` | **MVS Dose:** `10 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your current grasp of spoken Spanish?"*
* **Options:**
  1. `complete_beginner`: Complete beginner
  2. `a1_elementary`: Know basic vocab, freeze speaking
  3. `a2_intermediate`: Can read, want spoken fluency

#### Question 2 (Skill Asymmetry)
* **Question:** *"Where is your current learning comfort zone?"*
* **Options:**
  1. `visual_reading`: Reading & written words
  2. `audio_mimic`: Listening & pronunciation
  3. `grammar_conscious`: Grammar & sentence rules

#### Question 3 (Weekly Cadence)
* **Question:** *"What daily immersion pace fits your schedule best?"*
* **Options:**
  1. `20m_daily`: 20 mins / day (~3.5 hrs/wk)
  2. `35m_daily`: 35 mins / day (~4.5 hrs/wk)
  3. `50m_daily`: 50 mins / day (~6 hrs/wk)

---

### Goal 4: Write & Publish a Non-Fiction Book
* **Domain:** `PROJECT` | **Default Cadence:** `5–7 hrs/wk` | **Nominal Dose:** `60 min` | **MVS Dose:** `20 min`

#### Question 1 (Baseline Gate)
* **Question:** *"Where does your book manuscript stand right now?"*
* **Options:**
  1. `idea_only`: Just an idea (0 words)
  2. `detailed_outline`: Outline ready (no drafts yet)
  3. `draft_in_progress`: Draft in progress (10k+ words)

#### Question 2 (Skill Asymmetry)
* **Question:** *"What part of writing comes most naturally to you?"*
* **Options:**
  1. `generative_flow`: Generating ideas & stories
  2. `logical_structure`: Outlining & structured arguments
  3. `editing_polish`: Line editing & polishing

#### Question 3 (Weekly Cadence)
* **Question:** *"What target weekly word output matches your bandwidth?"*
* **Options:**
  1. `light_sprint`: 2,000 words / week (Light pace)
  2. `standard_sprint`: 3,500 words / week (Recommended pace)
  3. `intensive_sprint`: 5,000 words / week (Intensive marathon)

#### Question 4 (Distribution Format)
* **Question:** *"How do you plan to publish this book upon completion?"*
* **Options:**
  1. `amazon_kdp`: Amazon Kindle & Paperback
  2. `digital_direct`: Digital download (PDF / EPUB)
  3. `industry_authority`: Free industry lead magnet

---

### Goal 5: Master Distributed Systems Architecture
* **Domain:** `COGNITIVE` | **Default Cadence:** `6–8 hrs/wk` | **Nominal Dose:** `60 min` | **MVS Dose:** `25 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your current backend engineering experience level?"*
* **Options:**
  1. `fullstack_pivot`: Frontend / Fullstack pivoting to backend
  2. `mid_backend`: Mid-level backend engineer
  3. `senior_engineer`: Senior engineer targeting Staff bar

#### Question 2 (Skill Asymmetry)
* **Question:** *"Where do you feel least confident during architecture deep dives?"*
* **Options:**
  1. `storage_internals`: Storage engines & database internals
  2. `consensus_replication`: Consensus & replication (Raft/Paxos)
  3. `whiteboard_defense`: Timed 45-min whiteboard defense

#### Question 3 (Weekly Cadence)
* **Question:** *"How much deep-focus technical study can you execute weekly?"*
* **Options:**
  1. `5_hours`: 5 hours / week (Paced study)
  2. `8_hours`: 8 hours / week (Balanced study + labs)
  3. `11_hours`: 11 hours / week (Accelerated crunch)

---

### Goal 6: Daily Mindfulness & Breathwork Habit
* **Domain:** `PHYSICAL` | **Default Cadence:** `2–3 hrs/wk` | **Nominal Dose:** `15 min` | **MVS Dose:** `5 min`

#### Question 1 (Baseline Gate)
* **Question:** *"What is your past experience with daily meditation or breathwork?"*
* **Options:**
  1. `novice`: Complete novice
  2. `intermittent`: Used meditation apps on and off
  3. `experienced`: Experienced daily practitioner

#### Question 2 (Skill Asymmetry)
* **Question:** *"What style of practice feels most intuitive and grounding for you?"*
* **Options:**
  1. `physiological_breathwork`: Breathwork (Box, 4-7-8, sigh)
  2. `open_monitoring`: Silent open monitoring
  3. `somatic_relaxation`: Body scan & somatic release

#### Question 3 (Daily Cadence)
* **Question:** *"What daily session duration can you guarantee every single day without fail?"*
* **Options:**
  1. `10m_daily`: 10 minutes / day (Light)
  2. `15m_daily`: 15 minutes / day (Recommended)
  3. `20m_daily`: 20 minutes / day (Deep reset)

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
4. STRICTLY KEEP ALL ANSWER LABELS SHORT, CRISP, AND TO THE POINT (2 to 6 words max). NEVER write long paragraphs or stressful explanations in answer options. Keep choices easy and zero-stress to scan.
5. Every question MUST directly map to:
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
        { "value": "beginner", "label": "Complete beginner", "baseline_level": "BEGINNER", "score": 1 },
        { "value": "intermediate", "label": "Intermediate (solid fundamentals)", "baseline_level": "INTERMEDIATE", "score": 2 },
        { "value": "advanced", "label": "Experienced / Advanced", "baseline_level": "ADVANCED", "score": 3 }
      ]
    },
    {
      "id": "skill_asymmetry",
      "question": "Question assessing existing comfort zone vs areas needing structured guidance",
      "purpose": "GUIDANCE_SCAFFOLDING",
      "options": [
        { "value": "strength_a", "label": "Concepts & strategy first" },
        { "value": "strength_b", "label": "Hands-on action first" },
        { "value": "foundation_both", "label": "Starting fresh across both" }
      ]
    },
    {
      "id": "weekly_cadence",
      "question": "Question establishing sustainable weekly hours and session frequency",
      "purpose": "CAPACITY_BUDGET",
      "options": [
        { "value": "light", "label": "Light (~4 hrs / week)", "recommended_weekly_hours": 4 },
        { "value": "balanced", "label": "Balanced (~6 hrs / week)", "recommended_weekly_hours": 6 },
        { "value": "accelerated", "label": "Intensive (~8 hrs / week)", "recommended_weekly_hours": 8 }
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
