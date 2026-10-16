# Weekly Update — Decisions

**Prefix:** WU

How this log works: `docs/templates/decisions.md`.

**Inherited:** this feature was started by `docs/archive/missed-sessions/04-phases.md` ND-19 (2026-10-08), which moved missed sessions' M4.2 (week-close handoff, AC-9, AC-11) here. See `01-brief.md`, section 10.

### WU-1 — Weeks close automatically (2026-10-08)
**Question:** a week ends today only when the review is submitted. What if it never is?
**Decision:** on the first app open after the week's last day has closed, the app closes the week by itself, runs the weekly update with what it knows and writes the next week.
**Why:** nobody should be stuck on an old week because they skipped a screen.
**Changes:** RULE-8, RULE-9; AC-6, AC-7.

### WU-2 — Checkpoints are a separate feature (2026-10-08)
**Question:** build the week 4 and week 8 checkpoint offers (lower goal or extension) now?
**Decision:** later, as their own feature. The problem is written up in `docs/features/checkpoints/01-brief.md`.
**Why:** an extension changes the plan's length, which touches many screens; the weekly update is useful without it.
**Changes:** section 8 (out of scope). The weekly update never returns `checkpointOffer`.

### WU-3 — An unlogged test means a re-test next week (2026-10-08)
**Question:** missed sessions' copy says "Take it now and we'll adjust". How does "take it now" work?
**Decision:** the target is held, and the next week's first practice day starts with the test that was not logged. Its result shapes the following week like any test.
**Why:** one path, no second update mid-week.
**Changes:** RULE-5; copy "Test not logged" replaces the missed-sessions wording; AC-4.

### WU-4 — A break follows the goal's own return rule (2026-10-08)
**Question:** someone is away for weeks. Jump to the current week, pause, or something else?
**Decision:** not a jump. Each goal has its own return rule (how its method says to come back after a break), and the plan follows it: the restart level comes from the rule, and the plan's dates move later so the same 12 weeks remain.
**Why (Mo):** every goal has its own way of dealing with missed time; the plan must use that goal's way.
**Changes:** RULE-12 to RULE-16; AC-9 to AC-12.

### WU-5 — At most 4 weeks of moving in total (2026-10-08)
**Question:** how far can breaks push the plan back?
**Decision:** 28 days in total per plan. A break beyond that offers a fresh plan from where they are, or continuing with the dates moved only up to the limit.
**Why:** a plan cannot stretch forever; matches plan-v2's "beyond that, start a revised plan".
**Changes:** RULE-15; AC-12.

### WU-6 — Breaks are part of this feature (2026-10-08)
**Question:** build breaks here, or as their own feature?
**Decision:** here, as the last phase, after the normal week close works.
**Why:** without it, the first person back from a break gets a broken plan.
**Changes:** scope (section 8).

### WU-7 — The daily-time check only offers a shorter time (2026-10-08)
**Question:** after two hard weeks, what can the person change?
**Decision:** only the daily time, to a shorter one from the existing options. Fewer days a week is "Later".
**Why:** changing practice days changes the week layout and the test day; the daily time only changes step minutes.
**Changes:** RULE-6.

### WU-8 — "Keep going" past the limit moves the plan 28 days at most (2026-10-08)
**Question:** a break goes past the 4-week limit and they keep this plan. Where do they restart?
**Decision:** the plan moves only up to the limit, so they restart at the week the calendar has reached after that move, at the return rule's level.
**Why:** the limit has to mean something; the fresh-plan choice is there for anyone who wants a full restart.
**Changes:** RULE-15.

### WU-9 — A fresh plan reuses the goal's text and archives the old goal (2026-10-08)
**Question:** what does "Start a fresh plan" do?
**Decision:** opens goal creation with this goal's text filled in; creating the new goal archives the old one. Custom goals still need Pro.
**Why:** least typing for the person, and one active goal at a time as today.
**Changes:** RULE-15.

### WU-10 — Paused for method-aware recovery (2026-10-08)
**Question:** missed sessions' recovery treats every task the same. Fix that first, or build the weekly update on top of it?
**Decision:** pause the weekly update and build `docs/archive/method-aware-recovery/` first. The return-after-a-break rule (RULE-12) becomes part of that feature's recovery profile (MR-2). The weekly update resumes when it is done.
**Why:** the break rule and day-level recovery need the same per-goal knowledge; build it once, first.
**Changes:** status (paused); RULE-12.

### WU-11 — A kind a week behind holds the target (2026-10-17)
**Question:** method-aware recovery tells the week writer where the person is in each in-order sequence (MR-32). Should the weekly update read it, and can it stop a raise when the test covers lessons not reached yet?
**Decision:** the update reads, for each in-order kind, where the person is, how many steps behind that is and the kind's name, from the finished week's handoff (`weekHandoff`). When any in-order kind is a week behind (steps behind at least that kind's sessions in the finished week, and at least 2), next week's target must not be higher than this week's; code rejects a raise. It never applies when next week is week 12 (the final goal stays, RULE-4), it only blocks a raise (a lower target another rule allows passes), and it is not part of the status (it cannot make a week `far_behind` or start RULE-6). Every in-order kind counts, because code cannot tell which kinds a weekly test measures (the test stores only type, instructions and pass rule); linking tests to kinds is idea I-8. The sentence names the kind by its profile `name` in lower case; the copy milestone checks each written name reads well and adds a plain-word list only if needed, with no new stored field; a model-written name that fails the copy check is left out. With `METHOD_RECOVERY_ENABLED` off there is no position and nothing is held for this reason.
**Why (Mo):** a test can cover material the person hasn't reached, so a raise would outrun them; but one step behind is normal noise and must not block a raise after a strong test, and a fixed number of steps treats a twice-a-week kind and a five-times-a-week kind differently.
**Changes:** section 3 (in-order kind, steps behind, a week behind); RULE-2; RULE-4; RULE-7; section 5; section 7; section 8 (Later); AC-15.

### WU-12 — What the method-aware recovery notes became (2026-10-17)
**Question:** what to do with the three notes left by method-aware recovery, and with RULE-12 written before the recovery profile existed?
**Decision:** (1) A carried lesson landing on a day never trained (logic check finding 8) is not part of this feature: since M3.1d code places carried steps in next week's first session of their kind, not the same weekday, and the rest means changing practice days, already out of scope. It goes under Later. (2) Reading the in-order position is WU-11. (3) Adding sessions of a kind whose backlog is long is not built now: it takes time from other kinds (a product decision) and there are no real numbers yet. It is idea I-7, to revisit with production `[Recovery] Handoff wait` logs. Someone far behind on a sequence still gets week 12 = final goal; lowering the goal is the checkpoints feature's question (`docs/features/checkpoints/01-brief.md`, open question 5). RULE-12 now says the return rule is the profile's `returnRule` (already built), from the pathway, a template or the profile call, with older goals getting a profile at their next weekly review; the roadmap call does not return one.
**Why:** keep this feature to the weekly update; decide the backlog-length question with data.
**Changes:** RULE-12; section 7 (no roadmap-call change); section 8 (Later); AC-9; checkpoints brief open question 5; ideas I-7, I-8.

### WU-13 — Days before a week is written are never missed; a short gap moves the plan (2026-10-17)
**Question:** the logic check of 2026-10-17 (`logic-check-2026-10-17.md`, finding 1) found that someone back 6 days after a week ended got 6 "missed" days they never saw and a crowded week, while someone back 8 days got a clean restart.
**Decision:** days of a new week that passed before it was written are "not offered": never missed, no miss line, no `weekCounts` miss, no status effect, nothing carried from them; their in-order steps queue into the days left. A 1-day gap keeps the week's dates (that day is not offered). A 2 to 6 day gap moves the plan's dates so the new week starts today, counted toward the 28-day limit, at the same level (no return rule, no re-test). When the limit has room for only part of the gap, the plan moves up to the limit and the rest is not offered; when it is used up, nothing moves and the whole gap is not offered (the test day stays). 7 days or more is a break (RULE-13 to RULE-16).
**Why (Mo):** the plan waits for the person; a day they were never shown can't be missed. Falling back to "not offered" keeps the 28-day limit real.
**Changes:** section 2; section 3 (short gap); RULE-13; RULE-14; section 5; section 6 (copy); section 7; AC-16.

### WU-14 — Log the test before an automatic close (2026-10-17)
**Question:** logic check finding 2: someone who did the test on the week's last day and opens the app the next morning finds the week closed, the test lost and a re-test planned.
**Decision:** when the week's test was not logged, the open that would close the week first shows a "Log last week's test" card with Skip on Today. Logging or skipping closes the week at once. The card never blocks the app: the rest of the app works while it waits, and the new week is written only after an answer. If they neither log nor skip, the week closes as unlogged at that day's close, and that day is not offered (WU-13), never missed.
**Why (Mo):** the update should get the real result; one card is cheap; nothing may hold the app hostage.
**Changes:** section 2; RULE-8; section 6 (card and copy); AC-6.

### WU-15 — Week 12 keeps the final goal over every hold (2026-10-17)
**Question:** logic check finding 3: when week 11 is `far_behind` or its test was not logged, the hold says week 12 equals week 11's target and RULE-4 says week 12 is the final goal, so every answer is rejected.
**Decision:** no hold (`far_behind`, an unlogged test, a kind a week behind) applies when next week is week 12. Week 12 always keeps the final goal, and the sentence says the final week aims at the goal.
**Why:** the two rules cannot both hold; the final goal is the plan's promise, and lowering it is the checkpoints feature's job (WU-2).
**Changes:** RULE-4; RULE-5; section 5; AC-4; AC-13.

### WU-16 — After a break, the restart level is the lower bound (2026-10-17)
**Question:** logic check finding 4: RULE-16 can restart one or two weeks of targets back, but RULE-4 rejects any target below what they last achieved.
**Decision:** in the first week back after a break, RULE-4's lower bound is the restart level from the return rule, not the last result. Every other RULE-4 check still applies.
**Why:** the return rule is the method's answer after a break; RULE-4's bound is for normal weeks.
**Changes:** RULE-4; RULE-16; AC-18.

### WU-17 — Close first, then missed sessions; the re-test is the earlier week's late result (2026-10-17)
**Question:** logic check findings 5 and 6: on a return, which runs first, the week close or reconcile's carry? And where does a re-test's result go?
**Decision:** (1) On an open that closes a week, the close (update, handoff, any move, the new week's tasks) is saved first; reconcile then runs on the plan as stored with its shipped scope, the week holding today and the week before it (method-aware recovery RULE-20, M3.1d). This is the order a review on time followed by the next open already has, so with nobody away the carry result is exactly today's; this is added to "Must not break". Reconcile never writes into gap days a move took out of the plan, days not offered, or jumped weeks. (2) A re-test's result is stored as the earlier week's `testResult`, as a late result. The next update reads the new week's own test as its result and the re-test as part of the trend.
**Why (Mo):** shipped carry behaviour must not change when nobody was away (checked in code: `planRecovery` acts on the week holding today and the week before; the queue skips steps a later week already holds, so the handoff and reconcile never double up).
**Changes:** RULE-5; RULE-17 (new); section 7 (Must not break); AC-4; AC-17.

### WU-18 — A break counts from the last done step (2026-10-17)
**Question:** logic check finding 7: a break counted from the week's end picks the wrong return rule for someone who stopped early in the week, and grades that week `far_behind`.
**Decision:** the break's length, used to pick the return rule's length, counts from the last day with a done step, or from the closing week's first day if no step of that week was done. Whether it is a break is still decided by RULE-13 (7 days or more after the new week should have started). The week the break started in does not count as `far_behind` for RULE-6.
**Why (Mo):** the return rule should match how long they were really away.
**Changes:** RULE-6; RULE-13; section 5; AC-18.

### WU-19 — Jumped weeks get no update (2026-10-17)
**Question:** logic check finding 8: under "keep going" past the limit (WU-8), the weeks the plan skips would each need an update under RULE-1.
**Decision:** the weeks between the closed week and the first week back are jumped weeks: each closes with no update, keeps its target and is stored as jumped; nothing is carried from them and none counts toward RULE-6. The break's one update (RULE-16) spreads the targets from the first week back.
**Why:** no model calls about weeks that never happened.
**Changes:** section 3 (jumped week); RULE-1; RULE-15; section 5; section 7; AC-12.

### WU-20 — Smaller points from the logic check (2026-10-17)
**Question:** the logic check's smaller points and hidden assumptions.
**Decision:** (1) RULE-6's daily-time question is asked only when a shorter option exists, and again each time a new run of two hard weeks starts (after a week that was not `far_behind`). (2) Week 1's target is the lowest restart level. (3) For deliverable targets, code checks the count, that the kind stays a deliverable, that the last week's text is the final goal's and that a held week's text is this week's exactly; "lower" and "backwards" in words are told to the model and not checked. (4) Any screen that loads the goal starts the automatic close; that screen shows "getting ready", Today shows the sentence once. (5) Days spent waiting on a failed week write count toward neither a short gap nor a break: both are measured to the first open that tried to close the week (stored per goal).
**Why (Mo):** each closes a gap the logic check found without changing the feature's direction.
**Changes:** RULE-4; RULE-6; RULE-8; RULE-9; RULE-16; section 5; section 7; AC-6; AC-16; AC-18.

## Notes from method-aware recovery (not decisions)
- **2026-10-11, logic check finding 8:** a carried lesson can keep landing on a day the person never trains (the same weekday each week). When the weekly update resumes, consider letting the week writer avoid the day a step was missed on. *Handled: WU-12 (1), under Later.*
- **2026-10-11, MR-32:** the week writer is now told, per in-order kind, where the person is in the sequence and how many steps behind the plan. The weekly update's targets (and the weekly test, which may cover lessons not reached yet) should read that. *Handled: WU-11.*
- **2026-10-15, M3.1d review:** measured with a simulated writer, a carried lesson can wait up to 8 weeks even when the writer follows the prompt (11 when it ignores it), so someone can reach week 12 far behind on a sequence and the week-12 targets won't match where they are. The weekly update should read the position the writer is told (MR-32) and consider adding sessions of a kind whose backlog is long. Production logs `[Recovery] Handoff wait: ...` lines after switch-on for real numbers. *Handled: WU-11 (reading the position), WU-12 (3) and I-7 (extra sessions).*
