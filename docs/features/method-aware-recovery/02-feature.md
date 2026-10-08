# Achivii Method-Aware Recovery — Feature Definition

**Status:** APPROVED (2026-10-08)
**Date:** 2026-10-08
**Builds on:** `docs/features/method-aware-recovery/01-brief.md`; changes the recovery rules of `docs/archive/missed-sessions/03-feature.md`
**Decisions:** `docs/features/method-aware-recovery/decisions.md`
**Reference:** `docs/features/method-aware-recovery/reference/domain-templates.md`

## 1. Summary
When a day doesn't happen, the app does what the goal's method would do for that kind of task: move it, continue it, let it go or leave it fixed, while keeping order and rest. Every goal gets a recovery profile from its method when it is created, every step is tagged with a kind from that profile when its week is written, and code applies the rules.

**Main idea:** the method decides, the model describes, the code acts.

## 2. User journey
1. **Goal creation.** A pathway goal gets its hand-written profile. A custom goal gets one from the profile call (a template adjusted for the goal), checked by code. The person sees nothing new.
2. **Each week is written.** Every step is tagged with one of the goal's kinds. The person sees nothing new.
3. **A day doesn't happen** (or they set it aside). Each step of that day follows its kind's action. Today shows one line that fits what happened.
4. **They swap two days or move a step.** Only the choices the rules allow are offered.
5. **Weekly review and progress.** Sessions done are counted honestly; let-go and continued steps are never listed as skipped.

## 3. Words we use
**Recovery profile:** a goal's kinds of step, each kind's action, its rest gap, and its return-after-a-break rule. Stored with the goal.
**Kind:** a type of step inside one goal, such as "Easy session" or "Drafting".
**Action:** what a kind does when its day doesn't happen: **move**, **continue**, **let go** or **fixed** (MR-1).
**Hard kind:** a kind that needs a rest gap around it.
**In-order kind:** steps of this kind must stay in the order they were written.
**Rest gap:** the number of full days (0 to 2) that must separate two hard steps.
**Domain template:** one of 12 starting profiles we write (reference file).
**Catch-all:** the kind every profile must have, for work that fits no other kind, with an action the method chose.

## 4. Rules
### Profiles
**RULE-1 — Every plan v2 goal has a profile (MR-2).** Made at goal creation and stored with the goal. A goal created before this feature gets one the first time its next week is written (MR-6).

**RULE-2 — Pathway profiles are ours.** Each of the 10 pathways has a hand-written profile based on its domain template. No model call.

**RULE-3 — Custom profiles start from a template (MR-4).** A dedicated model call picks the closest of the 12 templates and adjusts it: it may rename, add or remove kinds and change actions, within RULE-4. It gets the goal, the clarify answers, the roadmap's method, phases and weekly targets.

**RULE-4 — Profile checks, by code.** A profile is saved only if:
- every kind has one action, and there are 2 to 8 kinds plus the catch-all;
- every hard kind's action is move, let go or fixed (never continue), and the rest gap is 0 to 2 days;
- a kind the model marks high-load is hard;
- for a goal whose targets are deliverables, the catch-all is continue;
- the return rule restarts at the last level or 1 to 2 weeks back.

A failed profile gets one retry; if that fails, the chosen template is used unchanged, and if no template was chosen, the closest one by the goal's clarify domain. A half-made profile is never saved.

**RULE-5 — Two kinds are always there.** Code adds **Weekly test** (fixed) and **Fixed-time session** (fixed: a class, a group run, a call) to every profile.

### Tagging
**RULE-6 — Every step gets a kind (MR-3, MR-5).** The week call tags each step with one of the goal's kinds, offered as a fixed list. A missing or unknown kind fails the week's code checks, like wrong minutes do today; the week call retries once, and if that fails the week is not saved and the person is asked to try again, as today.

**RULE-7 — Code overrides the tag where safety needs it.** The test step is always Weekly test. A step marked `highLoad` counts as hard whatever its kind. A goal-level high-load goal (`run10k`, `recomp`) with a profile uses its kinds instead of making every step high-load.

**RULE-8 — A movable step stands alone.** The week call writes any step of a move kind with its own short warm-up in its instructions, so moving it never needs another step.

### Actions when a day doesn't happen
These apply to each step of a day that closed undone, or was set aside. Missed sessions' guarantees stay: no day gets longer, nothing piles up, the test day is protected, the most recent day wins, nothing is carried out of a run of several days in a row, writes are guarded and happen once, and nothing is written while `MISSED_SESSIONS_CARRY_ENABLED` is off (ND-15).

**RULE-9 — Move.** The day's highest-priority step of a move kind goes to the next open practice day where it fits, as today (it replaces that day's lowest-priority steps; the day never gets longer). It may not land where it breaks RULE-13 or RULE-14; the next day that passes is used instead. If no day this week passes, it is not done this week, and that is counted (RULE-17).

**RULE-10 — Continue.** Nothing moves. The next session this week that has a step of the same kind gets a line at the top of that step: "Pick up where {Weekday} stopped." The day does not get longer. If there is no later step of that kind this week, the count tells the weekly update (RULE-17).

**RULE-11 — Let go.** Nothing moves and nothing is added.

**RULE-12 — Fixed.** Nothing moves. A fixed step is never moved by a swap, a carry or "move now", and no step is carried onto it.

**RULE-13 — Keep the order.** A step of an in-order kind may only land before the next step of that kind. When it moves onto a day that already has the next step of its kind, it takes that step's place, and that step and the later ones of the kind each move one session later; the last one this week goes to the count (RULE-17). No day gets longer.

**RULE-14 — Keep the rest gap.** After any carry, swap or "move now", two hard steps are never closer than the rest gap. Two hard steps never share a day unless they did in the week as written.

**RULE-15 — One line, about the most important step.** Today shows one line for the day that didn't happen, chosen by the action of that day's highest-priority step (section 6).

### Person's actions
**RULE-16 — Only allowed choices are offered.**
- **Set today aside:** always offered; then RULES 9 to 14 apply.
- **Swap:** only days whose swap passes RULE-12, RULE-13 and RULE-14 are offered; a day with a fixed step is never offered.
- **Move now:** only for a step of a move kind, to a day that passes RULE-9.
- **Key-session swap offer:** as today, only when the key session's main step is a move kind.

### Counting
**RULE-17 — Honest counts.** The week's counts (`weekCounts`) add: let go, continued, and moved-but-no-room (not done this week). Sessions done still count only what was done. The weekly review and progress never call a let-go or continued step "skipped"; key sessions skipped are counted as today.

### Steps from before this feature
**RULE-18 — Old steps keep today's behavior (MR-6).** A step without a kind, written before this feature, follows missed sessions' current rules, until the goal's next week is written.

### Measured before switch-on
**RULE-19 — The eval (MR-7).** A set of 24 custom goals (2 per template), each with a hand-written correct profile, and 6 written weeks with correct tags. The profile call must pick the right template for at least 22 of 24, agree on actions for at least 90% of the kinds, and produce **zero** unsafe results (a hard kind that continues, a high-load step that is not hard, a test that is not fixed). Tagging must agree on at least 90% of steps. Until it passes, custom goals use their template unchanged.

## 5. States and edge cases
| Situation | What happens |
|---|---|
| Easy run didn't happen (endurance) | Let go; "no need to make it up" line. |
| Interval run didn't happen, next day is the long run | Not moved to the long-run day (rest gap); the next day that passes is used, or it is counted. |
| Lesson 3 didn't happen, Lesson 4 is tomorrow | Lesson 3 takes tomorrow's lesson place; Lesson 4 moves to the next lesson session; the last lesson of the week goes to the count. |
| Drafting day didn't happen | The next drafting step gets "Pick up where Tuesday stopped." |
| Daily focus block didn't happen | Let go. |
| Group run (fixed-time) didn't happen | Nothing moves; no swap offered onto or off its day. |
| Several days in a row didn't happen | As today: nothing is carried out of the run; the gentle-return line shows. |
| A day with a move step and a let-go step | Each follows its action; the line follows the highest-priority step. |
| Model invents a kind | Week check fails; retry; second failure: week not saved, "try again". |
| Profile call fails twice | Template used unchanged. |
| Week written before this feature | Today's behavior (RULE-18). |
| Carry switch off | Planned actions reported, nothing written (ND-15). |

## 6. Screens and copy
- **Today:** the miss line follows the action (table below). The swap and move-now choices show only allowed days.
- **Focus:** a continued step shows its "Pick up where …" line at the top of its instructions.
- **Weekly review and progress:** let-go and continued steps are not shown as skipped.
- **Pathway pages and onboarding:** any line about what happens when a day doesn't happen matches the pathway's profile.

**Copy rules:** as missed sessions: never "missed", "behind", "failed" or "fail"; never ask why; one line that moves forward. `{Day}` is "Yesterday" or a weekday, and missed sessions' "today" wording applies when the day is today.

| Situation | Exact words |
|---|---|
| Moved (unchanged) | "{Day}'s session didn't happen. We moved its most important step to {Weekday}, so that day stays the same length." |
| Moved, in order | "{Day}'s session didn't happen. We moved it to {Weekday}, and the next ones follow on." |
| Continue | "{Day}'s session didn't happen. {Weekday}'s session picks up where you left off." |
| Let go | "{Day}'s session didn't happen. No need to make it up: the plan carries on as it is." |
| Fixed | "{Day}'s session didn't happen. It was set for that day, so the plan carries on as it is." |
| No room this week | "{Day}'s session didn't happen. There's no room for it this week without making a day longer, so next week's plan takes it into account." |
| Continued step, in Focus and Today | "Pick up where {Weekday} stopped." |

## 7. Data and system changes
- **Profile:** stored with the goal (for example inside the stored roadmap JSON, so no migration is needed; M1.1 decides).
- **Step kind:** a new field in each step of `DailyTask.detailedSteps` (JSON, no migration).
- **Profile call:** a new model call at goal creation for custom goals, through the same Gemini-then-Groq cascade, with the profile as a schema.
- **Week call:** the kind list as a fixed menu in the schema; code checks the kind on every step.
- **Carry, swap, mark today missed, move now:** follow RULES 9 to 16.
- **Counts:** `weekCounts` adds the RULE-17 counts.
- **Presets:** each of the 10 carries its profile.
- **Docs:** `docs/architecture/plan-v2.md` describes profiles and kinds.

**Must not break:** all of missed sessions' guarantees (listed above RULE-9) and their tests; goal creation for pathways and custom goals; the week call's other checks; Today, Focus, the weekly review, the late test, the closing stretch; Pro gating.

## 8. Scope
**In scope:** everything above.
**Out of scope:** the weekly update and moving plan dates (paused, WU-10; it reads the profile's return rule later); the person editing kinds or actions; reminders.
**Later:** letting the person mark a step fixed-time themselves.

## 9. Acceptance criteria
- **AC-1** Every new plan v2 goal is saved with a profile that passes RULE-4; pathways use their hand-written profile without a model call. (RULE-1, RULE-2, RULE-4)
- **AC-2** A custom goal's profile starts from a template; after two failed calls the template is used unchanged. (RULE-3, RULE-4)
- **AC-3** Every saved step of a new week has a kind from its goal's profile; a week with a missing or unknown kind is never saved. (RULE-6)
- **AC-4** The test step is always fixed, and a `highLoad` step is always hard. (RULE-5, RULE-7)
- **AC-5** Each action behaves as written: move, continue, let go and fixed, each with its own test. (RULE-9 to RULE-12)
- **AC-6** Generated weeks show that no carry, swap or move-now ever breaks the order or the rest gap, and no day gets longer. (RULE-13, RULE-14)
- **AC-7** Today shows the line for the highest-priority step's action, with the exact words. (RULE-15, section 6)
- **AC-8** Swap and move-now offer only allowed days; a fixed day is never offered. (RULE-16)
- **AC-9** The week counts include let go, continued and no-room; review and progress never show them as skipped. (RULE-17)
- **AC-10** Steps from before this feature behave exactly as before. (RULE-18)
- **AC-11** The eval meets RULE-19's thresholds before custom profiles are switched on, and the results are recorded. (RULE-19)
- **AC-12** Missed sessions' guarantees and all existing tests still pass. (section 7)
- **AC-13** Pathway and onboarding lines about missed days match each pathway's profile. (section 6)

## 10. Other concerns
- **Cost and speed:** one more model call at custom goal creation (a few seconds). Pathways add none. The week call's answer grows by one short field per step.
- **Providers:** Gemini holds the kind list as a schema; Groq does not, so RULE-6's code check is the real guard.
