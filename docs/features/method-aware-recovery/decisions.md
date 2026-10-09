# Method-Aware Recovery — Decisions

**Prefix:** MR

How this log works: `docs/templates/decisions.md`.

**Inherited:** started on 2026-10-08 from Mo's review of missed sessions' recovery rules (`docs/archive/missed-sessions/03-feature.md`), which treat every task the same. The weekly update is paused for it (`docs/features/weekly-update/decisions.md` WU-10).

### MR-1 — A small fixed set of actions (2026-10-08)
**Question:** what can the app do with a step whose day didn't happen?
**Decision:** four actions: move, continue, let go, fixed. Plus two week-level rules: keep the order, keep the rest gaps. Every goal uses the same set; goals differ in which kinds of step get which action.
**Why:** few enough to build and test thoroughly; together they cover the patterns real methods use.
**Changes:** the feature definition's rules.

### MR-2 — The method sets the rules, in a recovery profile made at goal creation (2026-10-08)
**Question:** who decides what each kind of task does?
**Decision:** each goal gets a recovery profile when it is created: its kinds of step and each kind's action, its order and rest-gap rules, and its return-after-a-break rule (from the weekly update). Pathway profiles are written by us; custom goals' come from a model call (MR-4).
**Why (Mo):** the type of goal and task decides how it is dealt with.
**Changes:** goal creation; the weekly update's RULE-12 (WU-10).

### MR-3 — The week writer categorises; code decides (2026-10-08)
**Question:** does the model choose the action for each step?
**Decision:** no. When writing a week, the model tags each step with one kind from the goal's profile. Code maps the kind to its action and enforces the hard limits whatever the tag says: the test is always fixed, high-load work never lands next to other high-load work, and a deliverable's work always continues.
**Why:** saying what a step is is easier and safer than deciding recovery; the result stays predictable and testable.
**Changes:** the week call; the carry and swap code.

### MR-4 — Custom profiles start from domain templates, with their own call and checks (2026-10-08)
**Question:** how do we make custom goals' profiles as good as possible?
**Decision:** we write about 12 domain templates. A dedicated model call picks the closest one and adjusts it for the goal. Code checks the profile (every kind has an action, the roadmap's work maps to the kinds, high-load is never moved without a rest gap, the test is fixed). On failure: one retry, then the template unchanged. A half-made profile is never saved.
**Why (Mo):** the profile is where quality is won or lost, especially for custom goals.
**Changes:** goal creation.

### MR-5 — No silent "let go" (2026-10-08)
**Question:** what happens to a step without a usable tag?
**Decision:** it cannot be saved. The tag is a fixed menu of the goal's kinds, and a missing or unknown tag fails the week's check and the week is retried. Every profile has a catch-all kind with an action the method chose. Let go happens only when the method says so.
**Why (Mo):** letting go of unlabeled work is not professional; every step must have a deliberate answer.
**Changes:** the week call's checks; the profile format.

### MR-6 — Existing steps keep today's behavior until rewritten (2026-10-08)
**Question:** what about weeks written before this feature?
**Decision:** their steps keep missed sessions' current, tested behavior until the goal's next week is written. The goal's profile is made the first time it is needed.
**Why:** no migration, and the gap closes within a week.
**Changes:** the carry and swap code.

### MR-7 — Measured before switch-on (2026-10-08)
**Question:** how do we know custom profiles are good enough?
**Decision:** hand-write the correct profile for 20 to 30 varied custom goals and score the model against them; it goes live only when the score is good enough (threshold set in the feature definition).
**Why:** measure instead of guessing.
**Changes:** a milestone before release.

### MR-8 — Feature definition approved as drafted (2026-10-08)
**Question:** five points in the draft: the 12 templates, in-order kinds shifting one session later, "no room this week" going to next week's plan, strict tagging (two failures: the week is not saved), and the eval thresholds.
**Decision:** all five as drafted ("whatever you think is best, approved").
**Why:** each keeps to the method and never guesses; the templates are refined by the eval (RULE-19) and by M1.2's review if a real method disagrees.
**Changes:** `02-feature.md` approved; `reference/domain-templates.md` is the starting point for M1.2.

### MR-9 — The profile is stored inside the goal's roadmap (2026-10-08)
**Question:** where is the profile stored (M1.1 Q1)?
**Decision:** under a `recovery` key inside `Goal.roadmap` (JSON). No migration. A missing or invalid profile reads as none, which means RULE-18 for the whole goal.
**Why:** written once at creation, already sent by `GET /active`, no schema change.
**Changes:** RULE-1, section 7.

### MR-10 — A moved step may use the first later day that passes (2026-10-08)
**Question:** a moved step cannot go to the next practice day because of a rest gap, order or a fixed step (M1.1 Q2). Missed sessions' ND-17 fixes one receiving day.
**Decision:** for steps with a kind, the receiving day is the first later practice day of the same week, not the test day, that passes RULE-12 to RULE-14, judged against the week as written plus its stored markers. It is worked out the same way every time, so a step is never carried twice. If that day is closed, done or taken, the step goes to "no room" (as ND-17 drops it today). Steps without a kind keep ND-17 exactly.
**Why:** keeps ND-17's guarantee (deterministic, never carried twice) while not giving up after one day.
**Changes:** RULE-9.

### MR-11 — A high-load step never continues (2026-10-08)
**Question:** a step marked `highLoad` whose kind's action is continue (M1.1 Q3).
**Decision:** it is treated as move: it moves if a day keeps the rest gap, otherwise it goes to "no room".
**Why:** heavy work is never quietly stretched into the next session.
**Changes:** RULE-7.

### MR-12 — The "moved" line wins (2026-10-08)
**Question:** a day's top step lets go but a lower step moved: which line shows (M1.1 Q4)?
**Decision:** if anything moved, the moved line shows; otherwise the line follows the top step's action.
**Why:** the person should hear about the change to their plan.
**Changes:** RULE-15.

### MR-13 — A 13th template, "General practice" (2026-10-08)
**Question:** what does a custom goal that fits none of the 12 templates use (M1.1 Q5, e.g. sourdough baking)?
**Decision:** a 13th template, General practice: practice session (move), review or reflection (let go), project work (continue), catch-all (move). It is also the default when no template matches.
**Why:** a neutral template is better than forcing a wrong domain; safety does not depend on the template (RULE-7).
**Changes:** templates reference; RULE-3, RULE-4.

### MR-14 — Templates picked by keywords until the eval passes; old goals never block the review (2026-10-08)
**Question:** how is the template picked before the eval passes, and for older custom goals; and what if making an old goal's profile fails (M1.1 Q6)?
**Decision:** a keyword table over the clarify domain (when there is one), the goal text and the method name picks the template, with no model call; no match gives General practice. Until the eval passes, custom goals use that template unchanged. If an old goal's profile cannot be made at the weekly review, the week is written without kinds (RULE-18 for one more week) and the review does not fail.
**Why:** no model call is needed to use a template unchanged; old goals must never block a review.
**Changes:** RULE-1, RULE-3, RULE-19.

### MR-15 — Rest-day steps have no kind; the 10-minute version takes its main step's kind (2026-10-08)
**Question:** do the optional rest-day step and the 10-minute version need a kind (M1.1 Q7)?
**Decision:** rest-day steps have none (a rest day is never a day that didn't happen). The 10-minute version takes the kind of the day's priority-1 step.
**Why:** keeps tagging to the steps that recovery actually acts on.
**Changes:** RULE-6.

### MR-16 — Strict tagging at week 1 too, measured (2026-10-08)
**Question:** strict tagging also applies to week 1 at goal creation, where two failures mean "Couldn't write your first week" (M1.1 Q8).
**Decision:** keep it strict. M2.1 measures the failure rate on sample weeks; above 2%, Mo revisits this.
**Why:** no guessed steps (MR-5), with a measured limit on the cost.
**Changes:** RULE-6; M2.1.

### MR-17 — A fixed step protects only its own place (2026-10-08)
**Question:** "no step is carried onto a fixed step": the step's place, or the whole day (M1.1 Q9)?
**Decision:** only its place. The fixed step is never replaced; the rest of the day can still receive a carry.
**Why:** protects what is fixed without blocking the whole day.
**Changes:** RULE-12.

### MR-18 — The rest gap beats the order (2026-10-08)
**Question:** a kind that is both hard and in order (strength): if keeping the order breaks the rest gap, which wins (M1.1 Q10)?
**Decision:** the rest gap. The step that cannot keep both goes to "no room".
**Why:** safety first.
**Changes:** RULE-13, RULE-14.

### MR-19 — The new counts are counted only (2026-10-08)
**Question:** are let go, continued and no room shown anywhere or sent in the week prompt (M1.1 Q11)?
**Decision:** counted only, in `weekCounts`, for the weekly update. No screen shows them. (No screen shows any skipped count today, so the review and progress need no change.)
**Why:** the weekly update is their reader; nothing on screen needs them.
**Changes:** RULE-17, AC-9.

### MR-20 — Template fixes before building (2026-10-08)
**Question:** M1.1 found templates that don't fit their pathways (Q12).
**Decision:** fix them in M1.2: Strength's return rule goes back 1 or 2 weeks with lighter loads in the first week back; Writing's return never rereads (closed-door) and starts from a short note on what comes next; Content creation gets "Titles and thumbnails" (move, first in order); Language gets "Daily speaking" (let go); Building a product gets "Daily distribution sprint" (let go); steps that only work together (a chess game and its review) are written as one step.
**Why:** each template must match its real method before code depends on it.
**Changes:** templates reference; RULE-8.

### MR-21 — Plan and wording fixes from M1.1 (2026-10-08)
**Question:** M1.1's other findings (section 11 of its report).
**Decision:** (1) the let-go line keeps today's drop wording ("Nothing needs making up: the plan carries on as it is."); (2) "Move now" stays the existing carry-now action, offered only when the held step's kind moves and its receiving day passes; no new action; (3) the Dashboard gets its own short line per action; (4) a goal "has deliverable targets" when its week-12 target is a deliverable; (5) the plan splits M1.3 into M1.3a and M1.3b and M3.1 into M3.1a and M3.1b; (6) unrelated problems go to `docs/backlog.md` (B-9 to B-14).
**Why:** what the code really does; milestones one chat can finish.
**Changes:** RULE-4, RULE-15, RULE-16, section 6; `03-phases.md`.

### MR-22 — The deliverable catch-all check applies only to profiles the model makes (2026-10-09)
**Question:** RULE-4's "a goal whose week-12 target is a deliverable needs a continue catch-all" also fails our own pathway and template profiles when the model writes a deliverable week 12 (for example "deliver a 15-minute talk"), so those goals get no profile (M1.3a report).
**Decision:** the check applies only to profiles the profile call makes (M1.3b). Pathway profiles and unchanged templates are saved without it.
**Why:** ours were checked by hand against each method; the rule guards the model's output. Forcing continue would be wrong for speech.
**Changes:** RULE-4; M1.3b (the create and review paths stop passing the deliverable fact for pathway and template profiles).

### MR-23 — Gemini only (2026-10-09)
**Question:** RULE-6 and section 10 describe Groq, which ND-22 removed.
**Decision:** the feature's model calls (profile and week) run on Gemini only. RULE-6's code check stays: Gemini can still drop the schema after an error.
**Why:** ND-22.
**Changes:** RULE-6; section 10.

### MR-24 — How the eval is scored (2026-10-09)
**Question:** RULE-19 sets the thresholds but not how to match the model's kinds to the hand-written ones, what counts as unsafe, or how to keep the answers honest (M2.2).
**Decision:** (1) **Order:** the goals and their roadmaps are committed first, then the hand-written answers, before any profile call runs; the answers are not changed after a run. The 6 weeks' tags are written from the steps alone, without seeing the model's tags. (2) **What is scored:** the profile the call returns (what the person would get), whatever its source; how many came from the model, the picked template or the keyword template is reported too. (3) **Template:** right when the returned profile's template equals the answer's. (4) **Actions:** each answer kind, except `weekly_test` and `fixed_time_session`, is matched to a returned kind by id, name (ignoring case) or one of its listed aliases; a match with the same action agrees; no match counts as a disagreement; extra returned kinds are listed but not counted. (5) **Unsafe:** a returned kind that is hard (or high-load) and continues, a high-load kind that is not hard, a test that is not fixed, and also a matched kind that continues or is not hard where the answer kind is hard or high-load. (6) **Tags:** practice-day steps only, leaving out the test step and the 10-minute version, which code tags. (7) **Two runs** of the profile call are recorded; Mo decides on O1 with both. A miss does not change the profile call in M2.2.
**Why:** a score fixed before the run cannot be bent to pass; the unsafe cases include the ones that would hurt someone, not only the ones code already blocks.
**Changes:** RULE-19 (scored per MR-24); M2.2.
