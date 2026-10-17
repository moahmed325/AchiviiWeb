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
**Decision:** when the week's test was not logged and the goal loads on Today, Today first shows a "Log last week's test" card. Logging the result closes the week with it. Any other action counts as Skip: tapping Skip, dismissing the card or going to another screen closes the week at once as unlogged and writes the new week, so today stays a practice day. On another screen no card is shown and the week closes as unlogged. RULE-5's re-test covers a test they did but didn't log. *(Changed 2026-10-17 by Mo: the first version waited for an answer until the day's close, which could cost a whole practice day.)*
**Why (Mo):** the update should get the real result when it's easy to give, but a lost practice day is worse than a re-test; nothing may hold the app hostage.
**Changes:** section 2; RULE-8; section 5; section 6 (card and copy); AC-6.

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

### WU-21 — A switch, an eval before any automatic close, one additive migration (2026-10-17)
**Question:** how is the feature turned on safely, checked before it acts on its own, and stored?
**Decision:** (1) Everything in the feature acts only when `WEEKLY_UPDATE_ENABLED` is exactly `true`, read per request, `sync: false` in `render.yaml` (unset means off), off by default, managed in the Render dashboard only and never turned on or off from code or tests. Off means exactly today's behaviour: targets as planned, no automatic close, no update call, no moved dates. Turning it on in production is an `O` row for Mo in `03-phases.md`. (2) An eval milestone runs the update call on recorded weeks right after the update call milestone, before the update runs inside the automatic close (reworded by WU-25: the close itself is built first, behind its own switch). (3) The feature gets one schema migration in total, decided in review after the check-the-code milestone; it only adds fields (nullable or with a default), so existing goals work without rewriting stored data.
**Why (Mo):** the update changes targets for every user, so it needs a kill switch; RULE-4 rejections and fallbacks are cheap to measure early; stored data must never need rewriting.
**Changes:** RULE-18 (new); section 5; section 7; AC-19; `03-phases.md` (eval milestone, O row). Switch split into two by WU-25.

### WU-22 — Weekly tests are light (2026-10-17)
**Question:** the update reads a weekly test every week. Is that test part of a normal session, or an exam? (The roadmap call writes each goal's test from the pathway's method; no pathway has a fixed one.)
**Decision:** each of the 10 pathways gets a hand-written weekly test, as its own milestone before the update call. For run10k, recomp, speech and spanish it is the lighter version (run10k: log the week's long run as written; recomp: morning weight and waist tape; speech: record the week's section and count filler words; spanish: a 1 to 2 minute timed voice note), with the big test only in weeks 4, 8 and 12. The roadmap call gets a general rule for custom goals: the test is part of a normal session, needs no special tools and is short. Existing goals keep their stored tests. Live goals that may already have a hard weekly test are backlog B-58.
**Why (Mo):** weekly tests should feel light; a weekly all-out run fights run10k's mostly-easy method; the update is only as good as the results people actually log.
**Changes:** RULE-19 (new); section 7; AC-20; `03-phases.md` (its own milestone before the update call); `docs/backlog.md` B-58.

### WU-23 — Safety wins over the final goal; the switch stays off until checkpoints (2026-10-17)
**Question:** for someone steadily behind, holds push the gap into week 12, and RULE-10 (high-load goals rise one safe step at a time) clashes with WU-15 (week 12 is the final goal). And should the update run in production before checkpoints exists?
**Decision:** (1) Safety wins: for a high-load goal (`run10k`, `recomp`) whose final goal is more than one safe step above week 11's target, week 12 takes the highest safe step, and the sentence says so honestly, for example "Week 12 aims at 7 km, a safe step. Your 10 km goal is the next step." (the next plan, I-10). It is the only case where week 12 is not the final goal. (2) `WEEKLY_UPDATE_ENABLED` stays off in production until the checkpoints feature ships (its `O` row waits on it), because week 12 = final goal is only honest once a week-8 checkpoint can offer a realistic day-90 target (I-9).
**Why (Mo):** an unsafe jump is never acceptable; turning the update on before checkpoints moves the impossible climb into one visible last week.
**Changes:** RULE-4; RULE-10; AC-8; `03-phases.md` (the O row waits on checkpoints).

### WU-24 — A fresh plan copies the text only (2026-10-17)
**Question:** should "Start a fresh plan" after a long break carry over the person's level?
**Decision:** not in this feature. It stays as WU-9 (the goal's text, old goal archived). Carrying the level over is built once with the day-90 next plan (`docs/ideas.md` I-10), which shares the mechanism and its pricing (I-11).
**Why (Mo):** carrying the level needs per-pathway baseline mappings and a pricing decision before billing is live.
**Changes:** RULE-15.

### WU-25 — Two switches: the week close goes first (2026-10-17)
**Question:** the biggest live problem is that a skipped review means next week is never written, but `WEEKLY_UPDATE_ENABLED` stays off until checkpoints ships (WU-23). Can the parts that change no target go live first?
**Decision:** (1) A second switch, `WEEK_CLOSE_ENABLED` (exactly `true`, read per request, `sync: false`, off by default, Render dashboard only), turns on the automatic close (with the test card), days not offered, short gaps, moved dates, and the date side of breaks (the move, the length, the limit, the choice card, jumped weeks, the text-only fresh plan, the welcome-back line). With only it on, a closing week is written exactly as the review writes it today with the targets as planned, and the close shows the neutral line. (2) Breaks are split: dates under `WEEK_CLOSE_ENABLED`; the restart level, the re-test and the restart level as lower bound under `WEEKLY_UPDATE_ENABLED`. (3) The return rule's "first week back" note goes to the week writer under `WEEK_CLOSE_ENABLED`: it shapes that week's sessions, not its target. (4) `WEEKLY_UPDATE_ENABLED` acts only when `WEEK_CLOSE_ENABLED` is on, so three states are tested (both off, close only, both on). (5) The phases are reordered: the week close (P1, then O1 to turn it on), light weekly tests (P2), the weekly update (P3, its eval before it runs inside the automatic close), copy and acceptance (P4), then O2, which waits on checkpoints. (6) How a high-load goal's first week back stays safe with only the close switch on is decided before M1.5's prompt: checked 2026-10-17, neither `safetyClamps.ts` (it acts only on the goal's stored velocity table, when the goal is returned) nor RULE-21's easy line limits that week (corrected by M1.1's report: the easy line fires only when the closing week ended with 3 or more missed practice days, and then softens one step). Answered by WU-29.
**Why (Mo):** the week close fixes a live problem and changes no target, so it should not wait months for checkpoints.
**Changes:** RULE-18; section 5; section 7; AC-19; WU-21 (2); `03-phases.md`.

### WU-26 — A move shifts the stored start and end dates (2026-10-17)
**Question:** M1.1 (Q1): store `movedDays` and add it in each date formula, or shift the goal's stored `startDate` and `targetDate`?
**Decision:** a move shifts `Goal.startDate` and `Goal.targetDate` by the days moved, and `Goal.movedDays` counts them for the 28-day limit (the original start is `startDate` minus `movedDays`). Checked 2026-10-17: `startDate` is read only by `weekStartFor` when a new week is written (`planV2.ts:190`) and `targetDate` only for today's day number (`frontend/src/lib/today.ts:35`, `journeyAdapter.ts:28-36`); past days, done tasks, history and progress read their stored `weekNumber`, `dayNumber` and `date`, so nothing in the past moves. Today's day number then skips the moved days, as RULE-14 says, and lines up with the plan index the journey compares it to.
**Why:** every reader of the two dates, now and later, follows a move with no formula to remember; a missed formula would show a wrong day.
**Changes:** RULE-14; section 7; `03-phases.md` (M1.3 folded into M1.4).

### WU-27 — One winner, decided inside the save; the review gets the same guard (2026-10-17)
**Question:** M1.1 (Q2, Q8): what happens when two closes race, and what about the review route, which today has no guard (a repeat submit rewrites next week's tasks; an old week's review moves `currentWeek` back; five separate writes)?
**Decision:** two racing closes may both call the model; the winner is decided inside the all-or-nothing save by a conditional update on the week's status (still `active`), never by a read before it, and the loser saves nothing and answers with the week as closed. The review route gets the same guard and puts all its writes in one transaction after the model call, in every switch state: it is M1.2a's first requirement (B-59).
**Why (Mo):** a read-then-write check still lets two requests through; racing is rare, so paying for a second model call is fine.
**Changes:** RULE-9; `03-phases.md` (M1.2a); `docs/backlog.md` B-59.

### WU-28 — Days not offered, the test card, the line once (2026-10-17)
**Question:** M1.1 (Q3, Q4, Q5).
**Decision:** (1) `DailyTask.notOffered` is stored (in M1.2a's migration); which day kind it gets is decided in M1.4's prompt, leaning to a new kind that every consumer treats like `rest`, except that the in-order queue counts its steps as not done so they queue into the days left (WU-13). (2) While the test card waits, Today shows only the card and reconcile waits for the answer. Going to another screen still counts as Skip (WU-14); only closing the browser tab brings the card back on the next open, and the gap is still counted from the first open that tried. (3) "The sentence once" is stored per week (`RoadmapWeek.closeLineSeenAt`), so it holds across devices.
**Why (Mo):** reusing `rest` as it is would lose the steps WU-13 queues; a tab closed by accident shouldn't skip the test.
**Changes:** RULE-8; section 7.

### WU-29 — A high-load first week back is held down by guidance and the easy line; real limits are B-62 (2026-10-17)
**Question:** M1.1 (Q6, section 7): with only `WEEK_CLOSE_ENABLED` on, what keeps a run10k or recomp person's first week back after a break safe? And M1.1 found that `applySafetyClamps` acts on no plan v2 goal.
**Decision:** (1) For a high-load goal's first week back, the week writer gets the return rule's "first week back" note plus "they have been away N days; keep every session at or below what they last completed" (told, not checked), and code puts RULE-21's easy line on every hard step of that week (pure, deterministic, never fails the week). The stored target is not changed. Built in M1.5. (2) No code limit acts on plan v2 targets or sessions today: `safetyClamps.ts` runs only on `Goal.velocityTable`, which no code writes. This is `docs/backlog.md` B-62, a safety issue that affects every new goal now. RULE-10 and WU-23's "highest safe step" depend on limits that don't act today, so B-62 must land before M3.1; P1 does not depend on it (it changes no target).
**Why (Mo):** the close switch must not change targets, but must not send someone back to full load either; a "safe step" needs a real limit before the update uses it.
**Changes:** RULE-10; WU-25 (6); `03-phases.md` (M1.5, M3.1, risks); `docs/backlog.md` B-62; CLAUDE.md (the clamps paragraph).

### WU-30 — Plan changes from M1.1 (2026-10-17)
**Question:** what else does M1.1's report change?
**Decision:** (1) M1.2 is split: M1.2a (server close, the migration, the review-route guard B-59, a `[WeekClose]` log line per close for O1's checks) and M1.2b (the frontend: the close call before reconcile, "getting ready", the test card, the line once). M1.3 is folded into M1.4 (with WU-26 it is almost empty). (2) RULE-8: the automatic close acts only on a week still `active` whose last day's close has passed. (3) RULE-11: an automatic close of week 12 marks it closed and writes nothing. (4) R-2's test covers a review or close on the morning after the week ended, not only on time (M1.1 section 4 found a possible order difference there). (5) `weekCounts` never runs in production; M3.1 wires it in for RULE-2.
**Why:** facts from M1.1's report.
**Changes:** RULE-2; RULE-8; RULE-11; `03-phases.md`.

### WU-31 — A review that loses to an automatic close keeps its reflection (2026-10-17)
**Question:** M1.2a review: a review modal open in one tab while another tab's load closes the week automatically gets 409 `week_closed`; the typed reflection was cleared and the modal said "already saved", though the automatic close saved none.
**Decision:** when the week was closed automatically (`closedBy: 'auto'`) and has no reflection yet, the modal saves the typed reflection onto that week through a small endpoint (behind `WEEK_CLOSE_ENABLED`, only for that case, safe to repeat) and says exactly "This week had already closed. Your reflection is saved." Any other `week_closed` keeps M1.2a's message. Built in M1.2b.
**Why (Mo):** losing what someone wrote feels bad, and the fix is small.
**Changes:** section 5; section 6 (copy); `03-phases.md` (M1.2b).

### WU-32 — Dismissing the result entry goes back to the card (2026-10-17)
**Question:** M1.2b review: WU-14 makes dismissing count as Skip, so Esc or a tap outside the result entry closed the week unlogged and lost the result being typed, which is easy to do by accident.
**Decision:** in the result entry, Esc, the ✕ or a tap outside goes back to the test card and sends nothing; the entry keeps its "Skip" button. Dismissing the card itself is still Skip (WU-14), and going to another screen still is too.
**Why (Mo):** an accidental Esc shouldn't throw away a result; "Skip" stays one tap away.
**Changes:** RULE-8; CLAUDE.md and Design.md (M1.2b).

### WU-33 — Not-offered days, gaps of 7 or more, and the score (2026-10-17)
**Question:** M1.4's prompt: which day kind a not-offered day gets (WU-28 (1)), what M1.4 does with a gap of 7 days or more before M1.5 exists, and how a week's score treats days the person never saw.
**Decision:** (1) A not-offered day gets its own kind, `not_offered`. Every consumer treats it like `rest`, except that the in-order queue counts its steps as not done, so they queue into the days left. (2) M1.4 moves the plan for any gap of 2 days or more (up to the 28-day limit), 7+ included, as RULE-14 does for breaks. M1.5 adds what a break adds on top. Because a 7+ day break would otherwise get a full-load first week back (WU-29, a safety point for run10k and recomp), `WEEK_CLOSE_ENABLED` (O1) stays off until M1.5 is merged as well as P1's other milestones. (3) A week's score leaves not-offered days out of the planned count. A week whose every day is not offered has no score: `executionScore` stays empty, the review row stores 0 of 0 (its columns can't be empty), and every screen shows it as not counted, never 0%, with no benchmark line. (4) The "plan now ends on {date}" line is stored with `{date}` as written; the app fills it in the viewer's locale, like its other dates, with the year only when it isn't this year.
**Why (Mo):** a day nobody was shown can't be missed or lower a score; moving dates for every gap keeps one rule; the safety point means no automatic close before breaks are handled.
**Changes:** RULE-13; `03-phases.md` (M1.4, O1); M1.4's prompt.
### WU-34 — M1.4 review: records on not-offered days, the partial-move line, nothing to complete (2026-10-17)
**Question:** M1.4 review: may the in-order queue's `toNextWeek` records sit on a not-offered day's step (RULE-17 says reconcile never writes into days not offered)? What line does a close save when the 28-day limit moves only part of the gap, so the week did not start today? What does a review of a week with no day offered save? Can a not-offered day be marked complete?
**Decision:** (1) RULE-17's "never writes into days not offered" means never placing a step there; the queue's `toNextWeek` records may sit on a not-offered day's step, as on a missed day's, because they change nothing shown. (2) A partial move (0 < days moved < gap) saves "Your plan now ends on {date}."; a full move keeps "Your next week starts today. Your plan now ends on {date}.". (3) A review of a week whose every practice day was not offered saves "No practice days were offered this week." instead of "0 of 0 sessions done.". (4) A not-offered day opens as a rest day with no completion button, and the app never counts it as done (as the server never classifies it done). (5) The app fills `{date}` with the plan's end as it is now, so after a second move an older line in the progress history shows the newer end date (M1.4 prompt, kept).
**Why (Mo):** "starts today" is false after a partial move; a completion on a day nobody was shown would hide the step the queue moved from it.
**Changes:** 02-feature.md section 6 (two lines) and RULE-17 (a note); M1.4 (review fixes, `7a74d99`).

## Notes from method-aware recovery (not decisions)
- **2026-10-11, logic check finding 8:** a carried lesson can keep landing on a day the person never trains (the same weekday each week). When the weekly update resumes, consider letting the week writer avoid the day a step was missed on. *Handled: WU-12 (1), under Later.*
- **2026-10-11, MR-32:** the week writer is now told, per in-order kind, where the person is in the sequence and how many steps behind the plan. The weekly update's targets (and the weekly test, which may cover lessons not reached yet) should read that. *Handled: WU-11.*
- **2026-10-15, M3.1d review:** measured with a simulated writer, a carried lesson can wait up to 8 weeks even when the writer follows the prompt (11 when it ignores it), so someone can reach week 12 far behind on a sequence and the week-12 targets won't match where they are. The weekly update should read the position the writer is told (MR-32) and consider adding sessions of a kind whose backlog is long. Production logs `[Recovery] Handoff wait: ...` lines after switch-on for real numbers. *Handled: WU-11 (reading the position), WU-12 (3) and I-7 (extra sessions).*
