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

### WU-35 — M1.5 is split; the first-week-back line; how the break's length picks the rule (2026-10-18)
**Question:** M1.5's prompt: M1.5 holds breaks, the first-week-back note, the high-load hold, the limit's choice card, jumped weeks and the fresh plan, well past one milestone. WU-29 puts "RULE-21's easy line" on every hard step of the first week back, but that line says "First hard session after a few days off" and a swap strips it from every step but one. And which length picks `1-2 weeks` or `3+ weeks`?
**Decision:** (1) M1.5 is split: M1.5a (the break, its length stored as `breakDays`, the note to the writer, the high-load hold, the welcome-back line) and M1.5b (past the limit: the choice card, "Keep going" with jumped weeks, the fresh plan; its prompt decides what other screens do while the choice waits, and a move that lands past week 12). Until M1.5b, a break past the limit keeps M1.4's partial move and saves the welcome-back line. O1 waits for both. (2) The first week back of a high-load goal gets its own line, exactly "First week back: keep the effort easy today.", first on every step that is hard in the profile and high-load, once; a step holding it never also gets RULE-21's line, and a swap leaves it in place. (3) A break under 21 days uses the `1-2 weeks` entry, 21 or more `3+ weeks`. (4) A high-load goal is `isHighLoadGoal` or a goal whose profile has a `highLoad` kind.
**Why:** a smaller milestone is easier to check; RULE-21's words are wrong on the second hard step of a week, and its swap rule would strip the line; "3+ weeks" means 21 days.
**Changes:** `03-phases.md` (M1.5a, M1.5b, O1); WU-29 (1) (the line's wording); M1.5a's prompt.

### WU-36 — The first-week-back line belongs to the week (2026-10-19)
**Question:** M1.5a review: a step handed on out of the first week back kept "First week back: keep the effort easy today." in the next week.
**Decision:** a step holds the line exactly when the day it lands on is in a first week back of a high-load goal and the step takes it; anywhere else the line is removed (`lineForDay`). Today only the handoff moves a step into another week; reconcile's carry, reorder and swap stay inside one week, so they need nothing. Whether the goal is high-load is worked out once per close (`goalLoad`).
**Why:** the line describes that week; it is wrong a week later.
**Changes:** M1.5a review fixes (`ac4cad8`); CLAUDE.md.

### WU-37 — Past the limit: how far the plan moves, when the card shows (2026-10-19)
**Question:** logic check 2026-10-19 findings 1 to 3: with the limit, the week the calendar reaches usually starts days ago (RULE-14 says the first week back starts today); M1.5a writes a week wholly in the past that closes again as another break; the card would offer a fresh plan after 8 days away.
**Decision:** (1) When a break goes past the limit, "Keep going" moves the plan by the most days within the room (`28 − movedDays`) that make a week start on the first try's local date: the largest `d ≤ room` with `gap − d` a multiple of 7. If no such `d` exists (the room is smaller than `gap mod 7`), the plan moves by the room and the passed days of the week holding that date are not offered (M1.4). The weeks between the closing week and the week holding that date are jumped (WU-19); that week is the first week back. (2) No week wholly in the past is ever written: while the choice waits nothing is written, and "Keep going" writes the week holding the first try's date. (3) The choice card shows only when at least one whole week would be jumped (overflow = gap − room of 7 days or more). Below that, a break keeps M1.4's partial move with days not offered and M1.5a's welcome-back line.
**Why (Mo, logic check recommendations):** a first week back should be a whole week starting today; a week in the past must never close again; a fresh plan is too much to offer after a week away.
**Changes:** RULE-14, RULE-15, section 5; M1.5b's prompt.

### WU-38 — While the choice waits; past week 12 (2026-10-19)
**Question:** logic check findings 4 and 5: what other screens do while the choice waits (counting another screen as "Keep going" can't be undone), and what "Keep going" means when the move lands past week 12.
**Decision:** (1) While a choice waits nothing closes and reconcile does not run; any screen that loads the goal sends the person to Today, which shows only the card. Closing the tab brings the card back on the next open; the gap still counts from the first try (RULE-9). A weekly review sent while a choice waits is refused (409 `choice_needed`) before any model call, saves nothing, and the app reloads the goal so the card shows. (2) When the week holding the first try's date (after the most the limit allows) is past week 12, the card offers "Start a fresh plan" or "Do my final week". "Do my final week" jumps every week up to 11 and starts week 12 on that date, moving past the 28-day limit if needed: the only case where `movedDays` passes 28.
**Why (Mo, logic check recommendations):** the person's choice is not to be made for them; a plan whose dates have passed still has a final week worth doing.
**Changes:** RULE-8, RULE-15, section 5, section 6; M1.5b's prompt.

### WU-39 — No test card after a break (2026-10-19)
**Question:** logic check finding 6: after weeks away Today asks "Did you do last week's test?" about a week long gone, whose test day often fell after the break started.
**Decision:** a close that is a break (gap of 7 days or more, RULE-13) shows no test card, on any screen, and closes as unlogged (RULE-5's re-test covers it, M3.3). This changes M1.5a's break path too; it is built in M1.5b.
**Why (Mo, logic check recommendation):** "last week" is wrong after a break, and the result would be stale.
**Changes:** RULE-8; M1.5b's prompt.

### WU-40 — Jumped weeks on screen; the lines (2026-10-19)
**Question:** logic check findings 7 and 8 and a smaller point: how jumped weeks look, what the welcome-back line says after a jump, and the fresh-plan copy promising the person's level (WU-24 carries only the text).
**Decision:** (1) A jumped week is stored `jumped: true`, `status: 'completed'`, `closedBy: 'jumped'`, `closedAt`, with no tasks and no review row. Roadmap, Progress and the journey show it muted with the label "Paused", no score and no benchmark line, and leave it out of any average or count of weeks done. (2) "Keep going" saves "Welcome back. Your plan picks up at week {n} and now ends on {date}." on the closing week's review row (`{n}` written in, `{date}` as written, filled by `fillPlanEnd`). "Do my final week" saves "Welcome back. Your final week starts today and ends on {date}.". (3) The card's copy: "Welcome back. This break is longer than your plan can move. Start a fresh 12-week plan, or keep going with this one." Buttons "Start a fresh plan", "Keep going". Past week 12: "Welcome back. Your plan's dates have passed. Start a fresh 12-week plan, or do your final week now." Buttons "Start a fresh plan", "Do my final week". (4) "Start a fresh plan" opens goal creation with the goal's text filled in, as switching goal does; creating it archives the old goal (WU-9); nothing closes the old week, and leaving goal creation brings the card back. A custom goal still needs Pro; "Keep going" needs nothing.
**Why (Mo, logic check recommendations):** no word that means missed; the person should know the weeks were skipped; the copy must not promise what WU-24 doesn't do.
**Changes:** section 6; M1.5b's prompt.

### WU-41 — A light test in a high-load first week back (2026-10-19)
**Question:** logic check finding 9: a first week back can land on a big-test week (4 or 8, more likely with jumps); the stored test may be a time trial or a max test; B-63's scan refuses those only in weeks 1 to 3, and a sentence copied from the stored test is only logged.
**Decision:** in a first week back of a high-load goal (WU-35 (4)), with `WEEK_CLOSE_ENABLED` on: the FIRST WEEK BACK block tells the writer that this week's test is a light version (no time trial, no max test, nothing to failure), and the weeks 1 to 3 rules of `ai/safetyScan.ts` apply to that week's steps, with a sentence copied from the stored test refused, not just logged (one retry, then the existing 503). The stored test and target do not change. Built in M1.5b.
**Why (Mo, logic check recommendation):** a time trial after weeks off is the injury risk WU-29 exists to stop.
**Changes:** RULE-16 note; M1.5b's prompt.

### WU-42 — M1.5b review: the light test always writes; the time-trial rule; week 12's test card (2026-10-19)
**Question:** M1.5b: B-63's scan has no time-trial pattern (the prompt said stop rather than add one); with one, a stored time-trial test in a high-load first week back could fail both tries on every open, leaving the goal stuck on "Couldn't get your next week ready"; and week 12 closing after a long gap still shows the test card (WU-39 is about breaks, which need a next week).
**Decision:** (1) One narrow time-trial rule (`time_trial`: "time trial", or "all-out", "flat-out", "as fast as you can" in a sentence with a distance; negated wording is safe) acts only in a high-load first week back, with the weeks 1 to 3 rules; everywhere else the scan is unchanged (the wider question is B-78). (2) In such a week every step and 10-minute version is scanned; the prompt asks for "a light version of the weekly test above"; the fallback test step and, on the last try, a test step that is the only refusal are replaced by a fixed step: "Weekly test: an easy version", "First week back: do this week's test at an easy, comfortable effort, never all-out. Note what you did and how it felt.", pass mark "No pass mark this week; just log what you did." (logged `[Safety]` outcome `light_test`). A refusal on any other step still fails the week. The stored test and target never change. (3) Week 12 closing keeps the test card after any gap: RULE-11 leaves week 12 as it is, and its test is the plan's final result. (4) Jumped weeks are left out of every count, including the Achievement summary, and the Roadmap's week strip shows them outlined with no fill.
**Why (Mo, M1.5b review):** a safety check must never leave a goal unable to move on; the fixed light step is safe by construction; week 12's result is worth asking for late.
**Changes:** WU-41 (built as above); M1.5b review fixes (`4cc99a3`); CLAUDE.md; `docs/backlog.md` B-78.

### WU-43 — Light tests and the target: the big test measures it (2026-10-19)
**Question:** logic check of 2026-10-19 on RULE-19 (`logic-check-2026-10-19-light-tests.md`): a light weekly test (a long run, a weigh-in, a voice note) can't measure a target in the final goal's metric, yet the roadmap says a target is what they can do on that week's test and the result form asks for a number in the target's unit; the model writes each test, so "hand-written" was not defined; the custom rule clashes with the roadmap prompt and allows short all-out tests.
**Decision:** (1) For run10k, recomp, speech and spanish, the target keeps the final goal's metric and unit and is measured only by the big test in weeks 4, 8 and 12. Each light week shows the next big-test week's target as what it builds toward (weeks 1 to 3 show week 4's, 5 to 7 week 8's, 9 to 11 week 12's). (2) A light test is logged as done plus a short note, not as a number checked against the target; in P3 the update moves targets only from big-test results and reads the light weeks' sessions and notes. (3) Code puts each pathway's hand-written test in place of the model's after the roadmap call: weeks 4, 8 and 12 get the big test with that week's target filled in, light weeks the light test with the pass mark "Done as written". The other six pathways get a hand-written test that measures the target every week, as today. (4) The roadmap prompt's custom-goal rule: the test is part of a normal session, needs no special tools, is short, and has no all-out effort, no max and nothing to failure (WU-41's words); any big test only in weeks 4, 8 and 12; the prompt's mock-exam and harder-test lines are rewritten to match. (5) The week writer puts the test day on the session the test belongs to (the long run, the morning of a weigh-in, a session with the talk); code checks the test day holds a step of that kind where it can, else a backlog row. (6) A big-test week whose test is light (a high-load first week back, RULE-16, WU-41) does not measure its target; the next big-test week is the next check. (7) Week 12's big test is the roadmap's `finalTest`, not a second test. (8) "Keep going" may jump week 4 or 8 (up to 7 weeks without a big test): fine as it is; revisit in P3. Existing goals keep their stored tests and targets (B-58).
**Why (Mo, option A):** keeps week 12 as the final goal and one metric for all 12 weeks; the person never sees a light result set against a target it can't measure; showing the next check's target moves forward the same way in every week.
**Changes:** RULE-19, RULE-4 (a note for P3), AC-20 in `02-feature.md`; M2.1's prompt.

### WU-44 — M2.1 review: the week-1 rule reads the model's climb; a pathway's model tests are not checked (2026-10-19)
**Question:** M2.1 stop: giving light weeks 1 to 3 week 4's target (WU-43 (1)) can break `checkRoadmapAnswer`'s 40% week-1 rule (`MAX_WEEK1_SHARE`), e.g. run10k start 70, week 4 65, week 12 58. And in review: the model's tests on a pathway are scanned (B-63, hard) and held to one type, though code throws them away.
**Decision:** (1) `checkRoadmapAnswer`, the 40% rule included, runs on the model's answer as now; `withPathwayTests` runs after it, and the 40% rule is not checked again. Every other rule still holds after the rewrite (tested). (2) When the goal's pathway has hand-written tests (`RoadmapCheckContext.pathwayTests`), the model's tests skip B-63's roadmap test scan and the one-type check; custom goals keep both. The hand-written tests are scanned in tests for weeks 1 to 12. (3) A logged light test reaches the week writer as "light test done" plus the note, never "passed". (4) recomp's tests need a scale and a tape measure, as RULE-19's own example does.
**Why:** the 40% rule is there so the model's own week 1 is an early win; on a split pathway week 1 shows week 4's target as "Next check, week 4", not as week 1's goal. Checking tests that are thrown away only costs retries and 503s.
**Changes:** M2.1 (`roadmap.ts`, `planV2.ts`); requirement 3's "every rule" reads "every rule but the 40% week-1 rule".

### WU-45 — M3.1: what the first update call does (2026-10-21)
**Question:** writing M3.1's prompt: where the update runs first, how it treats light-test goals, safety, an unlogged test, the bad sentence and the fallback.
**Decision:** (1) M3.1 runs the update only on the review path, with `weeklyUpdateEnabled()`, weeks 1 to 11, and not on a close that is a break (M3.4 owns that; its targets stay as planned). The automatic close gets it in M3.3. (2) On a light-test goal (run10k, recomp, speech, spanish) the model sets targets only for the big weeks left (4, 8, 12); code fills each light week with its next big week's target before the checks; a hold compares the target each week shows; the lower bound is the last big-test result. (3) Safety lowers, it does not reject: after the RULE-4 checks pass, code runs the targets left through the roadmap's climb from this week's target (`safeTargetClimb`, or `safeCheckWeekClimb` on a light-test goal's big weeks) and lowers any week past a safe step; week 12 lowered only by this is accepted, its `Goal.roadmap.loweredTargets` entry is set in the close's transaction so `week12Line` keeps showing, and the sentence is code's: "Week 12 aims at {safe}, a safe step. Your {goal} goal is the next step." The model is told next week's safe maximum (`nextSafeStep`). Each lowered week logs `[Safety]` `target_step` with outcome `lowered_on_update`. (4) An unlogged test on a review holds: next week may not be above this week's target, except when next week is week 12 (RULE-5's hold); the re-test step, `retestOfWeek` and Today's line stay in M3.3. (5) The call has no `retestFirst` (code decides it in M3.3) and no checkpoint fields (WU-2). (6) A sentence with a forbidden word or a question is a rejection reason inside the one retry; a second rejection for any reason is the whole fallback (targets as planned, "Next week is ready. Your targets stay as planned.", no coach's note), so that line never follows changed targets. (7) The fallback stores no `updateStatus`; M3.3 decides how RULE-6 reads an empty one.
**Why (Mo):** each settles a gap the prompt needed: one path first keeps M3.1 small and M3.2's eval clean; light weeks only show the next check (WU-43); rejecting a safety-forced week 12 would make an answer whose holds push the climb into week 12 unpassable; a fallback line must stay true.
**Changes:** M3.1's prompt (`milestones/m3.1-update-call.md`); M3.3 (an empty status in RULE-6); M3.4 (the update after a break).

### WU-46 — M3.1 review: holds, the lower bound and the safe-step sentence (2026-10-21)
**Question:** M3.1 review: a hold (`far_behind`, an unlogged test, a kind a week behind) and RULE-4's "never below what they last achieved" can't both pass when the result beat this week's target; a result above week 12's target (a week 12 lowered to a safe step) makes every later answer fail; the model's sentence can name a number code then lowered.
**Decision:** (1) A hold wins over the lower bound: under a hold, next week's floor is this week's target when the bound is above it (not lower); later weeks keep the bound. (2) The lower bound never goes above week 12's current target. (3) When safety lowers next week and not week 12, the sentence is code's: "Next week aims at {target}, a safe step." (`{target}` from `formatTarget`). Also from the review: when the update stores week 12, `Goal.roadmap.finalTest` follows it in the same transaction; a week is stored when it differs from the week as read (`safeGoalTargets`), plus any week a read-back of the saved goal would read differently (an older goal's stored week that now climbs from a changed week), always the safe value the model was shown.
**Why (Mo):** without (1) and (2) the update always falls back exactly when the person did well; a sentence must not name a number the plan doesn't hold.
**Changes:** `ai/weeklyUpdate.ts`, `weekClose/update.ts`; `docs/architecture/plan-v2.md` prompt 4.

### WU-47 — No hold when next week shows week 12's target (amends WU-15) (2026-10-21)
**Question:** M3.1 review: on a light-test goal closing week 8, next week (9) shows week 12's target, which can't change, so any hold makes every answer fail.
**Decision:** no hold (`far_behind`, an unlogged test, a kind a week behind) applies when next week shows week 12's target: week 12 itself, or a light week whose next check is week 12. The message then says the final week aims at the goal.
**Why (Mo):** the same reason as WU-15: week 12 keeps the final goal, and a light week only shows it.
**Changes:** RULE-4's week-12 sentence reads "when next week shows week 12's target"; `ai/weeklyUpdate.ts` (`nextWeekIsLast`).

### WU-48 — A fallback keeps the holds code can see (2026-10-22)
**Question:** M3.2 eval: with both answers rejected, the targets stay as planned, so a week that must be held (test not logged, a kind a week behind) went ahead raised (`youtube-w4`, `spanish-w4`, both runs).
**Decision:** on a fallback, code holds next week at this week's target when a hold code can see applies: an unlogged test (RULE-5) or an in-order kind a week behind (WU-11). `far_behind` is the model's call, so a fallback never applies it. WU-47 stands: no hold when next week shows week 12's target. The fallback that holds gets its own true line (not "Your targets stay as planned"); its exact wording waits for M4.1.
**Why (Mo):** these holds are facts code reads, not judgments, and a fallback must not undo them; the status is the model's.
**Changes:** RULE-4 and AC-2 (a fallback keeps code's holds); `weekClose/update.ts` (the fallback path); M3.2b.

### WU-49 — The hold lines name the week the model sets (2026-10-22)
**Question:** M3.2 eval: on a light-test goal the prompt said "week 5's target must not be higher than this week's", but the model sets only weeks 8 and 12, so the WU-11 hold failed 4 of 4 attempts.
**Decision:** every hold line in prompt 4 and in its retry reasons names the week the model actually sets: next week, or on a light-test goal the next big week (which next week shows).
**Why (Mo):** the model can only keep a rule about a week it writes.
**Changes:** `ai/weeklyUpdate.ts` (`buildWeeklyUpdatePrompt`, `checkWeeklyUpdate`'s reasons); M3.2b.

### WU-50 — Code keeps the metric and unit when the model's unit is the same (2026-10-22)
**Question:** M3.2 eval: the top rejection was the model rewriting the metric or unit ("body fat" / "%" for "Body fat percentage" / "percent") and retrying into a fallback.
**Decision:** for a number week, code takes only the model's value and keeps the week's current metric and unit, but only when the model's unit is the same unit (`aliasesFor`) or missing. A different unit, or a changed kind, stays a rejection.
**Why (Mo):** the metric's wording carries no meaning code needs; a real change of unit or kind does.
**Changes:** RULE-4 (the metric is not compared; the unit is, through its aliases); `ai/weeklyUpdate.ts` (`readTarget`); M3.2b.

### WU-51 — The sentence must not say held for a raise, or raised for a hold (2026-10-22)
**Question:** M3.2 eval: 6 of 41 sentences said "held" while next week went up (and 2 for a deliverable that moved on).
**Decision:** a retry reason, both ways and kept narrow: words of holding ("held", "kept", "stays") while next week's target went up, or words of raising ("goes up", "went up", "moves up", "rises", "raised") while it stayed the same. Never a bare "up": "catch up" (WU-11's sentence), "build up" and "keep it up" pass (amended 2026-10-22, main - review). Next week's target is the one next week shows; a deliverable that changed counts as gone up.
**Why (Mo):** RULE-7 says the sentence says plainly when a target is held; a sentence that says the opposite of what happened is worse than none. Narrow, so it doesn't reject good sentences.
**Changes:** RULE-7; `ai/weeklyUpdate.ts` (`sentenceReason` or a check beside it); M3.2b.

### WU-52 — M3.3 is split; the update in the automatic close has a time limit (2026-10-22)
**Question:** M3.3 holds the update in the automatic close, RULE-5's re-test, RULE-6 with the daily-time card, and two M3.2b fixes; and M3.2/M3.2b saw rate-limited updates take 21 to 27 s, which every goal load would wait for.
**Decision:** (1) M3.3a is the server (the update in the automatic close, the time limit, the re-test, RULE-6's `retestFirst`, the deliverable schema, the WU-51 line in prompt 4); M3.3b is the app (Today's lines, the re-test's result entry, the daily-time card). (2) The update's model call has a 15 s limit on both paths; a time out, and an error from the model call, give the WU-48 fallback with the holds code can see (this also fixes M3.2b review finding 3).
**Why (Mo):** one milestone per side keeps each reviewable; a goal load must not wait on rate-limit retries, and a fallback must not drop a hold code can see.
**Changes:** `03-phases.md` (M3.3a, M3.3b); `weekClose/update.ts`.

### WU-53 — A week with no stored status is not far_behind (2026-10-22)
**Question:** WU-45 (7): a fallback stores no `updateStatus`; how does RULE-6 read it?
**Decision:** a week with no stored status (a fallback, the week a break started in, any week before the switch) is not `far_behind`, so it ends a run of hard weeks. A fallback never starts one.
**Why (Mo):** a re-test should never come from a guess.
**Changes:** RULE-6; M3.3a.

### WU-54 — An unlogged light week holds nothing (2026-10-22)
**Question:** on a light-test goal, a light week whose "I did it" wasn't logged held the target as "not logged" (RULE-5), but a light test is not a result against the target (WU-43).
**Decision:** an unlogged light week is not "not logged" for RULE-5: no hold and no re-test. On a light-test goal only the big weeks 4 and 8 can be not logged.
**Why (Mo):** holding a target for a test that measures nothing holds the person back for no reason.
**Changes:** RULE-5; `holdsOf` in `ai/weeklyUpdate.ts`; M3.3a.

### WU-55 — A re-test on a load goal counts as a hard session (2026-10-22)
**Question:** a re-test of a missed big test on run10k or recomp is a hard timed effort on the first day, in the same week as that week's own test.
**Decision:** the re-test step counts in the week's load checks like the code-made measured test step (on a running goal a hard run of its minutes). When only the re-test step breaks a limit on the last attempt, code swaps it for a fixed easy re-test step, kept only when the swapped week passes the week checks (as M1.5b's light-step swap). An easy re-test's result is a light result, not a result against the target.
**Why (Mo):** safety limits must see every hard effort; the week must still be writable.
**Changes:** `ai/weekPlan.ts`; M3.3a.

### WU-56 — One re-test, of the closing week; none after a light week (2026-10-22)
**Question:** writing M3.3a: what the re-test re-tests, where its result goes, and the automatic close's line when the plan also moved.
**Decision:** (1) An unlogged test and two hard weeks in the same close give one re-test. (2) Both re-test the closing week's stored test; the result is stored as that week's `testResult` (the latest wins, as a late result) through the test-result endpoint, which takes it only for the week the open week's `retestOfWeek` names. *Amended 2026-10-22 (M3.3a review, Mo): an easy re-test (WU-55) stores nothing on the earlier week, since a light result is not a result (WU-43); only the measured re-test sets `retestOfWeek`.* (3) No re-test after a light week, for either rule (a light week has no measured test to repeat). (4) An automatic close that ran the update and moved the plan stores the move line followed by the update's sentence; when the update's line is the plain neutral line, only the move line (M3.3a review). *(Proposed by main - review in M3.3a's prompt; accepted by Mo.)*
**Why:** one path for both rules; a light week's test is not a measure (WU-43); the person must see both the new end date and what happened to the target.
**Changes:** RULE-5; RULE-6; M3.3a.

### WU-57 — M3.3a review: the re-test ranks after the day's lead (2026-10-22)
**Question:** M3.3a review: the re-test step became its day's priority-1 step, so a missed re-test day (method switch off) would carry the hard re-test onto a later day, possibly the test day.
**Decision:** the re-test is first in order on its day but ranks right after the model's lead (priority 2); the day's priority-1 step, its 10-minute version and what a missed day carries stay the model's; a carry never removes the re-test. The update's retry is not started once the 15 s limit has passed (WU-52). The deliverable-only schema is used only when this week and every week the model sets are deliverables.
**Why (Mo):** a hard test must never be carried onto another hard day; a timed-out update must not keep spending quota; a mixed goal must stay writable.
**Changes:** `ai/weekPlan.ts`, `carryForward.ts`, `ai/weeklyUpdate.ts`.

### WU-58 — M3.3b: the server sends the re-test and the daily-time check (2026-10-22)
**Question:** writing M3.3b: the re-test's reason is not stored, a re-tested week may already hold a result, and nothing changes the daily time today.
**Decision:** (1) The server works out the re-test for the app: goal responses add `retest: { ofWeek, reason, logged }` (non-null only when the open week has `retestOfWeek`) and `dailyTimeCheck: { minutes, shorter } | null`; the app never reads `updateStatus`. (2) When the unlogged test and two hard weeks both apply, the reason is `not_logged` and Today shows the "Test not logged" line. (3) A result stored through the re-test path adds `retestLoggedInWeek: <open week>` to the stored `testResult` JSON (one key, no migration, no stored row changed); `logged` reads it. Every write replaces the whole `testResult`, so a later result stored any other way carries no key. Every reader of `testResult` (`isLogged`, `resultNumber`, `lastWeekResult`, the result screens) must ignore the key, checked and reported in M3.3b. (4) `POST /api/goal/daily-time` saves the answer: it sets the open week's `dailyTimeAskedAt` and, when shorter, `routine.dailyMinutes`, applied from the next written week; it refuses 409 `weekly_update_disabled` while `WEEKLY_UPDATE_ENABLED` (or `WEEK_CLOSE_ENABLED`) is off, like the other new endpoints. `plannedMinutes` is set only on a week written after the change, if any reader needs it; no other week is rewritten.
**Why (Mo):** one source for the reason, so the app and the log can't disagree; the hold is the fact the person most needs; the app must know when the re-test is done without a migration; the switch stays the kill switch.
*Amended 2026-10-22 (M3.3b review, Mo): (4)'s check follows two hard weeks, not the re-test: it is asked when the two weeks before the open week both stored `far_behind`, with or without a stored re-test (an easy re-test, a light closing week or no re-test day gives none), and never while week 12 is open (no week is written after it). `retest` also names its day (`taskId`, `date`, from `codeMadeRetestStep`), and the test-result route stores `retestLoggedInWeek` but does not send it back.*
**Changes:** M3.3b; RULE-5 and RULE-6 unchanged.

### WU-59 — M3.4: the restart level, its check, the re-test after a break (2026-10-22)
**Question:** writing M3.4's prompt: which week's target "back 1 week" means (also on a light-test goal and after "Keep going"), how code holds the model to it, what a fallback does, which re-test a break gets, and what Today and the close line say.
**Decision:** (1) The restart level is the stored target of week `max(1, n − back)` (`n` the closing week, `back` 0/1/2 from the entry `returnRuleEntry` picks; no profile or entry is `last level`), never harder than week `n`'s; on a light-test goal the target that week shows, binding the week the model sets. (2) On a break the week the model sets for next week must equal it (checked); it is the lower bound of every week left; the other holds don't apply to next week; the status is not stored; no restart when next week shows week 12's target. (3) A fallback keeps the restart. (4) One re-test, reason `break` (with `not_logged` when unlogged), of the closing week's measured test; none after a light week; the easy re-test from the start on a high-load goal, storing nothing; a measured result is week `n`'s late result, the latest wins. (5) The app's `retest.reason` gains `break` (from the open week's `breakDays`), with no line on Today. (6) An automatic close stores the welcome-back line, then the update's sentence (only the welcome-back line after the plain neutral line). (7) The update treats the weeks to be jumped as closed and never stores one. *(Proposed by main - review in M3.4's prompt; built and merged in M3.4, `5af3091`.)*
**Why:** the stored targets are the only levels the plan has; week 1 is the floor (WU-20 (2)); a time trial after weeks off is what WU-41 stops; the welcome-back line already explains the week.
**Changes:** M3.4's prompt (`milestones/m3.4-break-restart.md`).

### WU-60 — After a break, safety may lower week 12 (2026-10-23)
**Question:** M3.4 review: after a restart one or two weeks back, the safe-step climb from the restart level may not reach the final goal by week 12 (a 12 km restart at week 8 reaches 17.4 km, not 20).
**Decision:** accepted, as WU-23 already says: safety wins, week 12 is lowered to the highest safe step, its `loweredTargets` entry is stored and the app shows the honest week-12 line. The restart is not raised to make room. Lowering or keeping the final goal after a break is the checkpoints feature's question.
**Why:** the return rule and the safe steps are both the method's answer; a break costs time the plan can't always win back safely.
**Changes:** none in code (M3.4 behaves this way); M3.4 Review.

## Notes from method-aware recovery (not decisions)
- **2026-10-11, logic check finding 8:** a carried lesson can keep landing on a day the person never trains (the same weekday each week). When the weekly update resumes, consider letting the week writer avoid the day a step was missed on. *Handled: WU-12 (1), under Later.*
- **2026-10-11, MR-32:** the week writer is now told, per in-order kind, where the person is in the sequence and how many steps behind the plan. The weekly update's targets (and the weekly test, which may cover lessons not reached yet) should read that. *Handled: WU-11.*
- **2026-10-15, M3.1d review:** measured with a simulated writer, a carried lesson can wait up to 8 weeks even when the writer follows the prompt (11 when it ignores it), so someone can reach week 12 far behind on a sequence and the week-12 targets won't match where they are. The weekly update should read the position the writer is told (MR-32) and consider adding sessions of a kind whose backlog is long. Production logs `[Recovery] Handoff wait: ...` lines after switch-on for real numbers. *Handled: WU-11 (reading the position), WU-12 (3) and I-7 (extra sessions).*
