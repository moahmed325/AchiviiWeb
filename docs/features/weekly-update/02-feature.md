# Achivii Weekly Update — Feature Definition

**Status:** APPROVED (2026-10-08). Paused until `docs/features/method-aware-recovery/` is done (WU-10).
**Date:** 2026-10-08
**Builds on:** `docs/features/weekly-update/01-brief.md`, `docs/architecture/plan-v2.md` (Weekly update, prompt 4)
**Decisions:** `docs/features/weekly-update/decisions.md`

## 1. Summary
At the end of every week, the plan looks at what really happened (the weekly test, the sessions done, the trend) and sets the targets for the weeks left, then writes next week. The person reads one kind sentence about what happens next. Weeks close on time even if the review is skipped, and someone back from a break restarts the way their goal's method says to.

**Main idea:** the plan follows the person, never the other way round, and it never blames them.

## 2. User journey
1. **Normal week.** The person does the test on test day and submits the weekly review. The weekly update runs, next week is written, and the review's last step shows the update's sentence and next week's target.
2. **Review skipped.** The week's last day closes. The next time they open the app, it closes the week by itself, runs the update and writes the new week. Today shows the update's sentence once, then the new week.
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
**Return rule:** how this goal's method says to come back after a break. Every goal has one.
**Moved days:** how many days breaks have pushed this plan later in total. At most 28.

## 4. Rules
**RULE-1 — One update per week.** Every week from 1 to 11 gets exactly one weekly update when it closes. Week 12 has none (RULE-11).

**RULE-2 — What the update reads.** This week's target and its stored test result (`RoadmapWeek.testResult`, whether logged with the review or late), sessions done and planned, key sessions done and skipped (a key session done only as the 10-minute version counts as skipped), 10-minute versions used, missed and dropped days (`weekCounts`), the person's note if any, the last 3 weeks (target, result, sessions, status), the weeks left with their current targets, and any break (RULE-13).

**RULE-3 — Status stays inside.** The status is stored for the next updates (trend, RULE-6) and never shown: no label, colour or wording that means "behind" or "failed".

**RULE-4 — Target rules, checked by code.** The update returns a target for every week left. Code rejects the answer if: the count is wrong; the metric, unit or kind changes; a target is below what they just achieved, or goes backwards; a target is above the final goal before the last week; the last week is not the final goal; or the status is `far_behind` and next week's target is not this week's. Deliverable targets follow the same rules in words: held means next week repeats this week's deliverable. A rejected answer gets one retry; if that fails too, the targets stay as they were and next week gets the neutral note.

**RULE-5 — Unlogged test (WU-3).** A week whose test was never logged is treated as "not logged", never as failed. The target is held, the sessions decide the status, and the next week's first practice day starts with that test. Its result shapes the following week like any test.

**RULE-6 — Two hard weeks in a row.** When this week and last week are both `far_behind`, the next week starts with a re-test (`retestFirst`), and Today asks once whether the daily time still works. They can keep it or choose a shorter one from the existing daily-time options (never fewer days a week, WU-7); a change applies from the next week written, not the current one. Code, not the model, decides `retestFirst` from the stored statuses.

**RULE-7 — The words.** The update writes one sentence for the person (neutral and encouraging; says plainly when a target is held or lowered) and a short note for whoever writes next week's tasks. The sentence is checked by code for the forbidden words (section 6); a sentence that fails gets the neutral fallback. It is stored as the week's review insight, so the progress history shows it.

**RULE-8 — How a week closes (WU-1).** A week closes when the review is submitted, or automatically on the first app open after its last day has closed (the missed-sessions day close: bedtime plus 2 hours, never later than 04:00, in the person's time zone). An automatic close saves no reflection. After a week has closed, its late-test card and its review are no longer offered.

**RULE-9 — Close once, all or nothing.** Two tabs, a repeat request or a review racing an automatic close still close the week once. The update's targets, the week's close and the new week's tasks are saved together or not at all. If the new week cannot be written, nothing is saved, the person sees an honest "try again", and the next open tries again.

**RULE-10 — Safety first.** A raised target never breaks the existing safety limits for its domain (running volume ramps, calorie-deficit bounds, early-week lifting intensity in `backend/src/lib/research/safetyClamps.ts`). High-load goals (`run10k`, `recomp`) never raise more than one step at a time.

**RULE-11 — Week 12.** Closing week 12 runs no update and writes no week; the closing stretch takes over as today.

**RULE-12 — Every goal has a return rule (WU-4).** The rule is part of the goal's recovery profile (changed 2026-10-08, WU-10; `docs/features/method-aware-recovery/`). The rule says, for a break of a given length, the level to restart at (the last level reached, or one or two weeks of targets back) and what the first week back should include. It may have up to two lengths (for example "1-2 weeks away" and "3+ weeks away"). The 10 certified pathways have rules written by us from their real methods. Custom goals get one from the roadmap call, checked by code. A goal created before this feature gets one generated the first time it is needed; if that fails, "restart at the last level reached" is used.

**RULE-13 — What counts as a break.** When a week closes automatically and the next week would already have ended too, that is a break. Shorter gaps are normal weeks; missed sessions handles the days.

**RULE-14 — The plan moves (WU-4).** After a break, the plan's remaining weeks move later on the calendar so the first week back starts on the day they return. The plan keeps its 12 weeks and their numbers. Everything that shows dates follows: the week dates, "Day N of 90" (break days are not counted), the end date, the closing stretch, the roadmap and progress screens.

**RULE-15 — The limit (WU-5).** Moved days never go above 28 for a plan. When a break would go past it, Today offers a fresh plan from where they are, or keeping this plan; keeping it moves the plan only up to the limit, so the first week back is the week the calendar has reached after that move (WU-8). A fresh plan opens goal creation with this goal's text filled in and archives this goal; custom goals still need Pro (WU-9).

**RULE-16 — The first week back.** The break's weekly update gets the break length and the return rule. Next week's target is the restart level from the rule, the remaining targets are spread over the weeks left (RULE-4 still applies), the first practice day is a re-test, and the week's tasks follow the rule's "first week back".

## 5. States and edge cases
| Situation | What happens |
|---|---|
| Review submitted on test day | Update runs at once; review's last step shows the sentence and next target. |
| Review never submitted, app opened 2 days later | Automatic close; the new week started 2 days ago, and missed sessions handles those days. |
| App opened before the last day has closed (e.g. 01:00 after a late session) | Nothing closes yet. |
| Two tabs open at the new week | One close; the other tab gets the same result. |
| Update fails twice | Targets unchanged, neutral note, the week is still written. |
| Week writing fails | Nothing saved; "try again" on Today; next open retries. |
| Test logged late, then week closes automatically | The logged result is used. |
| Week 11 closes | Update runs; week 12's target is the final goal. |
| Week 12 closes | No update; closing stretch. |
| Week ends, then away 10 days | A break: return rule, the plan moves 10 days, the first week back starts today. |
| Away 6 weeks, nothing moved before | Past the limit: fresh plan or keep going (moves 28 days). |
| Rest day is the day they return | The first week back still starts today; today is a rest day only if the week layout says so. |
| Goal is not plan v2 | Refused with `not_plan_v2`, as everywhere (ND-21). |

## 6. Screens and copy
- **Weekly review, last step:** the update's sentence replaces the session count; next week's target is shown when it changed.
- **Today, after an automatic close:** a short "getting ready" state while the week is written, then the sentence once, dismissible.
- **Today, re-test weeks:** the first practice day's re-test step uses the normal step layout.
- **Today, daily-time check:** one card, once, after two hard weeks.
- **Today, after a break:** a welcome-back line with the new end date; past the limit, a choice card.
- **Roadmap and progress:** show the updated targets and the moved dates. No status labels.

**Copy rules:** neutral and encouraging; never "missed", "behind", "failed" or "fail"; never ask why; one line that moves forward.

| Situation | Exact words |
|---|---|
| Writing the new week | "Getting your next week ready…" |
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
- **Week close on the server.** A way to close a week automatically that is safe to call repeatedly, used by Today on open; the review keeps closing weeks as today.
- **The weekly update call** (prompt 4) with its code checks, and the week call receiving the coach's note and `retestFirst`.
- **Stored per week:** the update's status (for trend and `retestFirst`).
- **Stored per goal:** the return rule and the moved days. The routine's daily minutes can change (RULE-6).
- **Roadmap call:** also returns the return rule for custom goals. Each certified preset carries its own rule.
- **Dates:** every place that derives a date from `Goal.startDate` (`weekStartFor`, Today's day number, the journey adapter) also accounts for moved days.

**Must not break:** missed sessions (reconcile, carry, swap, mark today missed, late test), the weekly review flow, the closing stretch, Pro gating, goal creation.

## 8. Scope
**In scope:** everything above.
**Out of scope:** checkpoint offers at weeks 4 and 8 (WU-2, `docs/features/checkpoints/01-brief.md`); changing the days per week; letting the person edit targets; reminders; photo and video tests.
**Later:** checkpoints; changing practice days after two hard weeks.

## 9. Acceptance criteria
- **AC-1** Each week 1 to 11 runs exactly one update when it closes, and the update sees the stored test result however it was logged. (RULE-1, RULE-2)
- **AC-2** Targets that break any RULE-4 check are never saved; after a second bad answer the old targets stay and the neutral note shows. (RULE-4, RULE-7)
- **AC-3** No screen shows a status, and no update sentence uses a forbidden word. (RULE-3, RULE-7)
- **AC-4** A week with no logged test holds the target, and the next week's first practice day starts with that test; Today shows the "Test not logged" line. (RULE-5)
- **AC-5** Two `far_behind` weeks in a row give a re-test first and one daily-time check; a shorter time applies from the next written week. (RULE-6)
- **AC-6** A week whose review was skipped closes on the first open after its last day closed, and Today shows the new week and the sentence once. (RULE-8)
- **AC-7** Repeated or simultaneous closes close once; a failed week write saves nothing and shows "try again". (RULE-9)
- **AC-8** For running and recomp goals, raised targets stay within the safety limits and rise at most one step. (RULE-10)
- **AC-9** Every plan v2 goal has a return rule: the presets' are written, custom goals get one from the roadmap call, older goals get one when needed with a safe default. (RULE-12)
- **AC-10** After a break, the first week back starts today, at the rule's restart level, with a re-test first. (RULE-13, RULE-16)
- **AC-11** After a break, every screen with dates (Today, roadmap, progress, closing stretch) shows the moved dates, and "Day N of 90" skips the break. (RULE-14)
- **AC-12** Moved days never pass 28; past it, Today offers the two choices and both work. (RULE-15)
- **AC-13** Week 12 closes into the closing stretch with no update. (RULE-11)
- **AC-14** Everything under "Must not break" still passes its tests. (section 7)

## 10. Other concerns
- **Cost and speed:** one more model call per person per week. An automatic close happens while they wait on Today, so it needs the "getting ready" state; the week call already takes about 10 to 30 seconds.
- **Providers:** the update uses the same Gemini-then-Groq cascade as the other calls.
