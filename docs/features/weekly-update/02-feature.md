# Achivii Weekly Update — Feature Definition

**Status:** APPROVED (2026-10-08). Resumed 2026-10-17: `docs/archive/method-aware-recovery/` is done (WU-10); updated for it (WU-11, WU-12), for the logic check of 2026-10-17 (`logic-check-2026-10-17.md`, WU-13 to WU-20) for the switch and migration (WU-21), for light weekly tests, safety before the final goal and the fresh plan (WU-22 to WU-24), for two switches (WU-25), and for the M1.1 code check (WU-26 to WU-30). Plan: `03-phases.md`.
**Date:** 2026-10-08
**Builds on:** `docs/features/weekly-update/01-brief.md`, `docs/architecture/plan-v2.md` (Weekly update, prompt 4), `docs/archive/method-aware-recovery/` (recovery profile, return rule, next-week handoff)
**Decisions:** `docs/features/weekly-update/decisions.md`

## 1. Summary
At the end of every week, the plan looks at what really happened (the weekly test, the sessions done, the trend) and sets the targets for the weeks left, then writes next week. The person reads one kind sentence about what happens next. Weeks close on time even if the review is skipped, and someone back from a break restarts the way their goal's method says to.

**Main idea:** the plan follows the person, never the other way round, and it never blames them.

## 2. User journey
1. **Normal week.** The person does the test on test day and submits the weekly review. The weekly update runs, next week is written, and the review's last step shows the update's sentence and next week's target.
2. **Review skipped.** The week's last day closes. The next time they open the app, Today first offers to log the week's test if it wasn't logged (anything else they do skips it), then the app closes the week by itself, runs the update and writes the new week. If they come back a few days late, the new week starts the day they return. Today shows the update's sentence once, then the new week.
3. **Test not logged.** The target is held. The new week's first practice day starts with the test they did not log.
4. **Two hard weeks in a row.** The new week starts with a re-test, and Today asks once whether their daily time still works.
5. **Back from a break** (more than a week away). The app follows the goal's return rule: it picks the level to restart at, moves the plan's dates so the first week back starts today, and writes that week. Today says welcome back and when the plan now ends.
6. **A very long break** (past the 4-week limit). Today offers a fresh plan from where they are, or to keep going with this one.

## 3. Words we use
**Week close:** the moment a week is finished, by the review or automatically. Every week closes exactly once.
**Weekly update:** the model call (prompt 4 in `plan-v2.md`) that runs at each week close for weeks 1 to 11.
**Status:** the update's internal judgement of the week: `on_track`, `a_bit_behind`, `far_behind`. Never shown.
**Held target:** next week's target is the same as this week's.
**Re-test:** the week's test, done at the start of the first practice day.
**Break:** the app was not opened for long enough that a whole week passed after the current week ended (RULE-13).
**Short gap:** the app was first opened 2 to 6 days after the new week should have started (RULE-13, WU-13).
**Jumped week:** a week the plan skips because a break went past the limit and the person chose to keep going (RULE-15, WU-19).
**Return rule:** how this goal's method says to come back after a break. Every goal has one.
**Moved days:** how many days breaks have pushed this plan later in total. At most 28.
**In-order kind:** a kind of step in the goal's recovery profile whose steps are done in written order and move when missed (new lessons, new topics, a new piece, strength workouts). **Steps behind:** how many of its steps are not done yet, from the finished week's handoff (MR-32).
**A week behind:** an in-order kind whose steps behind are at least the number of sessions of that kind in the finished week, and at least 2 (WU-11).

## 4. Rules
**RULE-1 — One update per week.** Every week from 1 to 11 gets exactly one weekly update when it closes. Week 12 has none (RULE-11). A jumped week (RULE-15) closes with no update.

**RULE-2 — What the update reads.** This week's target and its stored test result (`RoadmapWeek.testResult`, whether logged with the review or late), sessions done and planned, key sessions done and skipped (a key session done only as the 10-minute version counts as skipped), 10-minute versions used, missed and dropped days (`weekCounts`), the person's note if any, the last 3 weeks (target, result, sessions, status), the weeks left with their current targets, any break (RULE-13), and, for each in-order kind, where the person is (the first step not done), how many steps behind that is, and the kind's name (WU-11). The position comes from the finished week's handoff (`weekHandoff`, MR-32), which exists only when `METHOD_RECOVERY_ENABLED` is on; with it off the update reads no position. `weekCounts` (`backend/src/lib/missedSignals.ts`) exists but no production path calls it today; M3.1 wires it in (WU-30).

**RULE-3 — Status stays inside.** The status is stored for the next updates (trend, RULE-6) and never shown: no label, colour or wording that means "behind" or "failed".

**RULE-4 — Target rules, checked by code.** The update returns a target for every week left. Code rejects the answer if: the count is wrong; the metric, unit or kind changes; a target is below what they just achieved, or goes backwards; a target is above the final goal before the last week; the last week is not the final goal; or the status is `far_behind` and next week's target is not this week's; or any in-order kind is a week behind and next week's target is higher than this week's (WU-11). That last check never applies when next week is week 12, which always keeps the final goal; it only blocks a raise, so a lower target another rule allows still passes, and later weeks are spread as usual. Being a week behind is not part of the status: it does not make the week `far_behind` and cannot start RULE-6's re-test on its own. **Week 12 comes first (WU-15):** no hold (`far_behind` here, the unlogged test in RULE-5, a week behind in WU-11) applies when next week is week 12, which keeps the final goal; the sentence then says the final week aims at the goal. The one exception is safety (RULE-10, WU-23). **After a break (WU-16):** in the first week back, the lower bound is the restart level from the return rule (RULE-16), not what they last achieved. **Deliverable targets (WU-20):** held means next week repeats this week's deliverable. Code checks the count, that the kind stays a deliverable, that the last week's text is the final goal's, and that a held week's text is this week's text exactly. Code cannot compare words for "lower" or "backwards"; for those the model is told the rule and nothing checks it. A rejected answer gets one retry; if that fails too, the targets stay as they were and next week gets the neutral note.

**RULE-5 — Unlogged test (WU-3).** A week whose test was never logged is treated as "not logged", never as failed. The target is held (not when next week is week 12, WU-15), the sessions decide the status, and the next week's first practice day starts with that test. The re-test's result is stored as the earlier week's `testResult`, as a late result (WU-17); the next update reads the new week's own test as its result and the re-test as part of the trend.

**RULE-6 — Two hard weeks in a row.** When this week and last week are both `far_behind`, the next week starts with a re-test (`retestFirst`), and Today asks once whether the daily time still works. The question is asked only when a shorter daily-time option exists, and again each time a new run of two hard weeks starts (after a week that was not `far_behind`) (WU-20). The week a break started in (RULE-13) does not count as `far_behind` here (WU-18). They can keep it or choose a shorter one from the existing daily-time options (never fewer days a week, WU-7); a change applies from the next week written, not the current one. Code, not the model, decides `retestFirst` from the stored statuses.

**RULE-7 — The words.** The update writes one sentence for the person (neutral and encouraging; says plainly when a target is held or lowered) and a short note for whoever writes next week's tasks. The sentence is checked by code for the forbidden words (section 6); a sentence that fails gets the neutral fallback. It is stored as the week's review insight, so the progress history shows it. When the target is held because a kind is a week behind (RULE-4), the sentence says so in plain words and names the kind, for example "…so you can catch up on new material". The name is the kind's `name` from the goal's recovery profile, in lower case (written by us for pathways and templates; the copy milestone checks each one reads well in this sentence and, if some do not, adds a list of plain words then, with no new stored field). A name the profile call wrote that fails the copy check is left out: "…so you can catch up".

**RULE-8 — How a week closes (WU-1).** A week closes when the review is submitted, or automatically on the first app open after its last day has closed (the missed-sessions day close: bedtime plus 2 hours, never later than 04:00, in the person's time zone). It closes only a week that is still open (`active`) whose last day's close has passed; a week the review closed early is already closed (WU-30). Any screen that loads the goal starts the automatic close, not only Today (WU-20); that screen shows the "getting ready" state, and Today shows the sentence once. **The test first (WU-14, changed 2026-10-17):** when the week's test was not logged and the goal is loaded on Today, Today first shows a "Log last week's test" card. Logging the result closes the week with it. Any other action counts as Skip: tapping Skip, dismissing the card or going to another screen closes the week at once as unlogged and writes the new week, so today stays a practice day. Dismissing the result entry (Esc, ✕, a tap outside) goes back to the card instead (WU-32). When the goal is loaded on another screen, no card is shown and the week closes as unlogged. A test they did but didn't log is covered by RULE-5's re-test. While the card waits, Today shows only the card and reconcile waits for the answer (RULE-17). Closing the browser tab is not an action: the card shows again on the next open, and the gap is still counted from the first open that tried (RULE-9, WU-28). An automatic close saves no reflection. After a week has closed, its late-test card and its review are no longer offered.

**RULE-9 — Close once, all or nothing.** Two tabs, a repeat request or a review racing an automatic close still close the week once. The update's targets, the week's close and the new week's tasks are saved together or not at all. If the new week cannot be written, nothing is saved, the person sees an honest "try again", and the next open tries again. Days spent waiting on a failed write do not count toward a short gap or a break: both are measured to the first open that tried to close the week, not to the write that worked (WU-20). Who closes the week is decided inside that save, by a conditional update on the week's status (still `active`), never by a read before it; the request that loses saves nothing and answers with the week as already closed (it may already have called the model). The weekly review uses the same guard, in every switch state (WU-27).

**RULE-10 — Safety first.** A raised target never breaks the existing safety limits for its domain (running volume ramps, calorie-deficit bounds, early-week lifting intensity in `backend/src/lib/research/safetyClamps.ts`). High-load goals (`run10k`, `recomp`) never raise more than one step at a time. **Safety wins over the final goal (WU-23):** when the final goal is more than one safe step above week 11's target for a high-load goal, week 12 takes the highest safe step instead, and the sentence says so honestly, for example "Week 12 aims at 7 km, a safe step. Your 10 km goal is the next step." (the next plan from their real level is `docs/ideas.md` I-10). This is the only case where week 12 is not the final goal. **Today no code limit acts on plan v2 targets or sessions:** `safetyClamps.ts` runs only on a stored velocity table, which no v2 goal has (`docs/backlog.md` B-62, a safety issue). RULE-10 and the "highest safe step" above need B-62's limits, before M3.1 (WU-29).

**RULE-11 — Week 12.** Closing week 12 runs no update and writes no week; the closing stretch takes over as today. An automatic close of week 12 marks it closed (closed automatically) and writes nothing (WU-30).

**RULE-12 — Every goal has a return rule (WU-4).** The rule is the `returnRule` of the goal's recovery profile (WU-10, WU-12; `docs/archive/method-aware-recovery/`, MR-2), already built and checked by code (`backend/src/lib/recovery/profile.ts`). It says, for a break of a given length, the level to restart at (`last level`, `back 1 week` or `back 2 weeks`) and a note on what the first week back should include. It has one rule for any length, or two ("1-2 weeks" then "3+ weeks"). The 10 certified pathways have profiles written by us from their real methods. A custom goal gets its profile from a keyword-picked template, or from the profile call when `CUSTOM_RECOVERY_PROFILES_ENABLED` is on. A goal created before method-aware recovery gets one at its next weekly review (`ensureRecoveryProfile`). A goal with no readable profile when a break is closed uses "restart at the last level reached".

**RULE-13 — Gaps and breaks.** The gap is counted from the day the new week should have started to the first open that tried to close the week (RULE-9).
- **Days not offered (WU-13):** days of the new week that passed before it was written are never counted as missed: no miss line, no `weekCounts` miss, no effect on the status, and nothing is carried from them. Their in-order steps queue into the days left.
- **No gap, or 1 day:** the new week keeps its dates; a day that passed is not offered.
- **Short gap, 2 to 6 days (WU-13):** the plan's dates move so the new week starts today (RULE-14), and the moved days count toward the 28-day limit. The level stays: no return rule, no re-test. When the limit has room for only part of the gap, the plan moves up to the limit and the rest of the gap is days not offered. When the limit is used up, nothing moves and the whole gap is days not offered; the test day stays where it is.
- **Break, 7 days or more** (the new week would already have ended): the return rule applies (RULE-16) and the plan moves (RULE-14, RULE-15). The break's length, used to pick the return rule's length, counts from the last day with a done step, or from the closing week's first day if no step of that week was done (WU-18).

**RULE-14 — The plan moves (WU-4).** After a break or a short gap (RULE-13), the plan's remaining weeks move later on the calendar so the first week back starts on the day they return. The plan keeps its 12 weeks and their numbers. Everything that shows dates follows: the week dates, "Day N of 90" (break days are not counted), the end date, the closing stretch, the roadmap and progress screens. A move shifts the goal's stored `startDate` and `targetDate` by the days moved; past days keep their stored week, day number and date, and only today's day number and the weeks written later follow the move (WU-26).

**RULE-15 — The limit (WU-5).** Moved days never go above 28 for a plan. When a break would go past it, Today offers a fresh plan from where they are, or keeping this plan; keeping it moves the plan only up to the limit, so the first week back is the week the calendar has reached after that move (WU-8). The weeks between the closed week and the first week back are jumped weeks (WU-19): each closes with no update, keeps its target and is stored as jumped; nothing is carried from them and none counts toward RULE-6. The break's one update (RULE-16) spreads the targets from the first week back. A fresh plan opens goal creation with this goal's text filled in and archives this goal; custom goals still need Pro (WU-9). It carries over only the text, not their level (WU-24; carrying the level over is I-10).

**RULE-16 — The first week back.** The break's weekly update gets the break length and the return rule. Next week's target is the restart level from the rule, the remaining targets are spread over the weeks left (RULE-4 still applies, with the restart level as the lower bound, WU-16), the first practice day is a re-test, and the week's tasks follow the rule's "first week back". "Back 1 week" or "back 2 weeks" never goes before week 1's target: week 1 is the lowest restart level (WU-20).

**RULE-17 — Close first, then missed sessions (WU-17).** On an open that closes a week, the close (update, handoff, any move and the new week's tasks, RULE-9) runs and is saved first; reconcile then runs on the plan as stored, with its shipped scope (the week holding today and the week before it, method-aware recovery RULE-20, M3.1d). This is the same order as a review submitted on time followed by the next open, so when nobody was away the carry result is exactly today's. Reconcile never writes into gap days a move took out of the plan, into days not offered, or into jumped weeks.

**RULE-18 — Two switches (WU-21, WU-25).** `WEEK_CLOSE_ENABLED` turns on the week close: the automatic close (RULE-8, RULE-9, RULE-17) with its test card, days not offered and short gaps (RULE-13), moved dates (RULE-14), and the date side of breaks (RULE-13 to RULE-15: the move, the length, the limit, the choice card, jumped weeks, the text-only fresh plan, the welcome-back line), plus passing the return rule's "first week back" note to the week writer. With only it on, a closing week is written exactly as the review writes it today, targets stay as planned, no update call runs, and the close shows the neutral line ("Next week is ready. Your targets stay as planned."). `WEEKLY_UPDATE_ENABLED` turns on everything that changes targets or adds a test: the update call and its checks (RULE-1 to RULE-7, RULE-10, RULE-11, WU-11, WU-15, WU-23), the unlogged-test re-test (RULE-5), two hard weeks (RULE-6), and the break restart (RULE-16: restart level, re-test first, the restart level as lower bound). It acts only when `WEEK_CLOSE_ENABLED` is also on, on the review path and in the automatic close alike. Each switch is on only when exactly `true`, is read per request, is `sync: false` in `render.yaml` (unset means off), is off by default, and is managed in the Render dashboard only, never turned on or off from code or tests. Both off means exactly today's behaviour: the review writes next week with the targets as planned, nothing closes a week automatically, no update call runs and no date moves. RULE-19 is behind neither switch.

**RULE-19 — Light weekly tests (WU-22).** A weekly test is part of a normal session, needs no special tools and is short. Each of the 10 pathways has a hand-written weekly test; for run10k, recomp, speech and spanish it is the lighter version (run10k: log the week's long run as written; recomp: morning weight and waist tape; speech: record the week's section of the talk and count filler words; spanish: a 1 to 2 minute timed voice note), with the big test (a time trial, a body-fat estimate, the full talk, a longer conversation) only in weeks 4, 8 and 12. The roadmap call tells custom goals the same general rule. Existing goals keep their stored tests. This applies at goal creation in every switch state; it is not behind RULE-18.

## 5. States and edge cases
| Situation | What happens |
|---|---|
| Review submitted on test day | Update runs at once; review's last step shows the sentence and next target. |
| Review never submitted, app opened on the new week's first day | Test card if the test wasn't logged; then automatic close; the new week starts as planned. |
| App opened 1 day late | The new week keeps its dates; the day that passed is not offered, never missed. |
| App opened 4 days late | The plan moves 4 days (counted toward 28); the new week starts today at the same level; no re-test. |
| App opened 4 days late, 26 days already moved | The plan moves 2 days; the other 2 days are not offered. |
| A review open in another tab when the week closes automatically | Its reflection is saved onto that week and the modal says so (WU-31). |
| Test card shown, they dismiss it or go to another screen | Counts as Skip: the week closes as unlogged at once and the new week is written; today is a practice day. |
| Both switches off | Exactly today's behaviour: targets as planned, no automatic close, no moved dates. |
| Only `WEEK_CLOSE_ENABLED` on | Weeks close automatically and gaps and breaks move dates; targets stay as planned; no re-test, no restart level; the neutral line shows. |
| Only `WEEKLY_UPDATE_ENABLED` on | Nothing changes: it acts only with `WEEK_CLOSE_ENABLED` on. |
| Week writing fails on every open for 8 days | The gap is counted to the first open that tried, so it is not a break. |
| Opened on the roadmap screen, not Today | The close still runs; that screen shows "getting ready". |
| App opened before the last day has closed (e.g. 01:00 after a late session) | Nothing closes yet. |
| Two tabs open at the new week | One close; the other tab gets the same result. |
| Update fails twice | Targets unchanged, neutral note, the week is still written. |
| Week writing fails | Nothing saved; "try again" on Today; next open retries. |
| Test logged late, then week closes automatically | The logged result is used. |
| Week 11 closes | Update runs; week 12's target is the final goal. |
| Week 12 closes | No update; closing stretch. |
| Week ends, then away 10 days | A break: return rule, the plan moves 10 days, the first week back starts today. |
| Trained Mon and Tue of week 5, then away 3 weeks | A break of about 3.5 weeks (from Tuesday), so the "3+ weeks" rule; week 5 does not count toward RULE-6. |
| Break in week 2, rule says "back 2 weeks" | Restart at week 1's target. |
| Week 11 far behind, or its test not logged | Week 12 keeps the final goal; the sentence says the final week aims at the goal. |
| Away 6 weeks, chose Keep going | The plan moves 28 days; the weeks in between are jumped, with no updates; one break update spreads the targets. |
| Two hard weeks, already on the shortest daily time | No daily-time question; re-test first as usual. |
| Away 6 weeks, nothing moved before | Past the limit: fresh plan or keep going (moves 28 days). |
| A kind is a week behind and the test went well | Next week's target is held, not raised; later weeks are spread as usual; the sentence says they're catching up on that kind. |
| A kind is a week behind and next week is week 12 | Week 12 keeps the final goal; no hold. |
| A kind is one step behind | Not a week behind; a good test raises the target as usual. |
| Rest day is the day they return | The first week back still starts today; today is a rest day only if the week layout says so. |
| Goal is not plan v2 | Refused with `not_plan_v2`, as everywhere (ND-21). |

## 6. Screens and copy
- **Weekly review, last step:** the update's sentence replaces the session count; next week's target is shown when it changed.
- **Today, before an automatic close with no logged test:** one card to log last week's test, with Skip; any other action skips it (WU-14).
- **Today, after a short gap that moved the plan:** one line with the new end date.
- **Today, after an automatic close:** a short "getting ready" state while the week is written, then the sentence once, dismissible.
- **Today, re-test weeks:** the first practice day's re-test step uses the normal step layout.
- **Today, daily-time check:** one card, once, after two hard weeks.
- **Today, after a break:** a welcome-back line with the new end date; past the limit, a choice card.
- **Roadmap and progress:** show the updated targets and the moved dates. No status labels.

**Copy rules:** neutral and encouraging; never "missed", "behind", "failed" or "fail"; never ask why; one line that moves forward.

| Situation | Exact words |
|---|---|
| Writing the new week | "Getting your next week ready…" |
| Test not logged before the close | "Did you do last week's test? Log your result to shape next week." Buttons: "Log result", "Skip" |
| Short gap moved the plan | "Your next week starts today. Your plan now ends on {date}." |
| A review sent after the week closed automatically | "This week had already closed. Your reflection is saved." |
| Week could not be written | "Couldn't get your next week ready. Please try again." Button: "Try again" |
| Update failed, neutral note | "Next week is ready. Your targets stay as planned." |
| Test not logged | "Last week's test wasn't logged, so we're holding your target. This week starts with a quick re-test so we can adjust." |
| Two hard weeks | "The last two weeks were hard to fit in. This week starts with a re-test to find your real level." |
| Daily-time check | "Does {N} minutes a day still work?" Buttons: "Keep {N} minutes", "Make it shorter" |
| Daily time changed | "From next week, your sessions are {M} minutes." |
| Back from a break | "Welcome back. Your plan picks up from here and now ends on {date}." |
| Past the limit | "Welcome back. This break is longer than your plan can move. Start a fresh plan from where you are now, or keep going with this one." Buttons: "Start a fresh plan", "Keep going" |

The weekly sentence itself is written by the model under RULE-7.

## 7. Data and system changes
- **Roadmap call and pathways (RULE-19):** each pathway carries its hand-written weekly test (with the weeks 4, 8 and 12 versions where they differ), and the roadmap prompt gives custom goals the light-test rule. Stored tests of existing goals are not changed.
- **The switches (RULE-18):** `WEEK_CLOSE_ENABLED` and `WEEKLY_UPDATE_ENABLED` in `render.yaml` (`sync: false`) and `backend/.env.example`.
- **One migration for the whole feature (WU-21):** decided in review after M1.1; it only adds fields (nullable or with a default), so existing goals work without rewriting stored data.
- **Week close on the server.** A way to close a week automatically that is safe to call repeatedly, runs before reconcile (RULE-17) and starts whenever the app loads the goal (WU-20), used by Today on open; the review keeps closing weeks as today.
- **The weekly update call** (prompt 4) with its code checks, and the week call receiving the coach's note and `retestFirst`.
- **The update's inputs:** the in-order position from the finished week's handoff (`weekHandoff` in `backend/src/lib/recovery/handoff.ts`, the same position the week writer is told as `whereTheyAre`).
- **Stored (one migration, M1.2a; shape in M1.1's report section 8, WU-26 to WU-28):** per goal `movedDays`, `closeTriedAt`, `closeTriedWeek` (and a move shifts `startDate` and `targetDate`); per week `closedBy`, `closedAt`, `jumped`, `breakDays`, `updateStatus`, `retestOfWeek`, `dailyTimeAskedAt`, `closeLineSeenAt`; per day `notOffered`.
- **Dates (WU-26):** a move shifts `Goal.startDate` and `Goal.targetDate`, so `weekStartFor`, the day number (`frontend/src/lib/today.ts` `dayNumber`) and the journey adapter follow with no formula change; past days are read from their stored rows.

**Must not break:** missed sessions (reconcile, carry, swap, mark today missed, late test), including carry reading the week before at a normal week change (method-aware recovery RULE-20, M3.1d): with nobody away, the carry result is exactly today's (RULE-17); the weekly review flow, the closing stretch, Pro gating, goal creation.

## 8. Scope
**In scope:** everything above.
**Out of scope:** checkpoint offers at weeks 4 and 8 (WU-2, `docs/features/checkpoints/01-brief.md`); changing the days per week; letting the person edit targets; reminders; photo and video tests.
**Later:** checkpoints; changing practice days after two hard weeks; the week writer avoiding a day that keeps getting missed (WU-12); adding sessions of a kind whose backlog is long (WU-12, `docs/ideas.md` I-7); counting only the kinds a weekly test measures (WU-11, I-8).

## 9. Acceptance criteria
- **AC-1** Each week 1 to 11 runs exactly one update when it closes, and the update sees the stored test result however it was logged. (RULE-1, RULE-2)
- **AC-2** Targets that break any RULE-4 check are never saved; after a second bad answer the old targets stay and the neutral note shows. (RULE-4, RULE-7)
- **AC-3** No screen shows a status, and no update sentence uses a forbidden word. (RULE-3, RULE-7)
- **AC-4** A week with no logged test holds the target (except before week 12), its re-test result is stored as that week's late result, and the next week's first practice day starts with that test; Today shows the "Test not logged" line. (RULE-5)
- **AC-5** Two `far_behind` weeks in a row give a re-test first and one daily-time check; a shorter time applies from the next written week. (RULE-6)
- **AC-6** A week whose review was skipped closes on the first open after its last day closed, from any screen. When the test wasn't logged and the goal loads on Today, the test card comes first; logging closes the week with the result, and any other action (Skip, dismissing, another screen) closes it at once as unlogged, so today stays a practice day. Today shows the new week and the sentence once. (RULE-8)
- **AC-7** Repeated or simultaneous closes close once; a failed week write saves nothing and shows "try again". (RULE-9)
- **AC-8** For running and recomp goals, raised targets stay within the safety limits, week 12 takes the highest safe step when the final goal is further (with the honest sentence), and rise at most one step. (RULE-10)
- **AC-9** Every plan v2 goal has a return rule: the presets' are written, custom goals get one from their template or the profile call, older goals get one at their next weekly review, and a goal with no readable profile restarts at the last level reached. (RULE-12)
- **AC-10** After a break, the first week back starts today, at the rule's restart level, with a re-test first. (RULE-13, RULE-16)
- **AC-11** After a break, every screen with dates (Today, roadmap, progress, closing stretch) shows the moved dates, and "Day N of 90" skips the break. (RULE-14)
- **AC-12** Moved days never pass 28; past it, Today offers the two choices and both work; jumped weeks get no update. (RULE-15)
- **AC-13** Week 12 closes into the closing stretch with no update, and week 12's target is always the final goal, even after a hold. (RULE-4, RULE-11)
- **AC-14** Everything under "Must not break" still passes its tests. (section 7)
- **AC-15** When an in-order kind is a week behind, next week's target is never higher than this week's, except when next week is week 12; one step behind does not block a raise; the sentence names the kind in plain words. With `METHOD_RECOVERY_ENABLED` off, nothing is held for this reason. (RULE-2, RULE-4, RULE-7)
- **AC-16** Days that passed before a week was written are never counted as missed; a 2 to 6 day gap moves the plan (within the limit) with no re-test; days spent on a failed week write count toward neither a gap nor a break. (RULE-9, RULE-13)
- **AC-17** At a normal week change with nobody away, reconcile's carry result is the same as before this feature; on a closing open, the close is saved before reconcile runs. (RULE-17)
- **AC-18** After a break, targets in the first week back are never below the restart level and never before week 1's; the break length counts from the last done step; the week the break started in does not trigger RULE-6. (RULE-6, RULE-13, RULE-16)
- **AC-19** With both switches unset or anything but `true`, the review, Today, the dates and every missed-sessions body behave exactly as before this feature. With only `WEEK_CLOSE_ENABLED` on, weeks close automatically and dates move, but every target stays as planned and no update call runs. `WEEKLY_UPDATE_ENABLED` alone changes nothing. The migration's new fields are empty or default on existing goals, except `closedBy` and `closedAt`, which every close (the review included) writes in every switch state (M1.2a); nothing reads them while both are off. (RULE-18)
- **AC-20** A new goal on any of the 10 pathways gets the pathway's hand-written weekly test; run10k, recomp, speech and spanish have the light test in every week except 4, 8 and 12; a custom goal's test follows the light-test rule; existing goals' stored tests are unchanged. (RULE-19)

## 10. Other concerns
- **Cost and speed:** one more model call per person per week. An automatic close happens while they wait on Today, so it needs the "getting ready" state; the week call already takes about 10 to 30 seconds.
- **Providers:** the update uses the same Gemini call as the others (Gemini only, ND-22).
